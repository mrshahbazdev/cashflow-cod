/**
 * Phase 3.2 — RTO analytics suite.
 * Rolls up orders into `RtoStat` rows per (shop, dimension, dimensionKey, day).
 * Supported dimensions: city | courier | product | sku | hour | day_of_week | country.
 */
import { Prisma } from '@prisma/client';
import prisma from '../db.server';

export type RtoDimension =
  | 'city'
  | 'courier'
  | 'product'
  | 'sku'
  | 'hour'
  | 'day_of_week'
  | 'country';

type OrderRow = {
  id: string;
  city: string | null;
  country: string | null;
  disposition: string;
  createdAt: Date;
  lineItems: Prisma.JsonValue;
};

export async function rebuildRtoStatsForShop(
  shopId: string,
  windowDays = 90,
): Promise<{ dimensionsProcessed: number; rowsUpserted: number }> {
  const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);
  const orders = (await prisma.order.findMany({
    where: { shopId, createdAt: { gte: since } },
    select: {
      id: true,
      city: true,
      country: true,
      disposition: true,
      createdAt: true,
      lineItems: true,
    },
  })) as unknown as OrderRow[];

  const bookings = await prisma.courierBooking.findMany({
    where: { order: { shopId, createdAt: { gte: since } } },
    select: { orderId: true, courierAccount: { select: { courier: true } } },
  });
  const courierByOrder = new Map<string, string>();
  for (const b of bookings) {
    courierByOrder.set(b.orderId, b.courierAccount.courier);
  }

  type Bucket = {
    total: number;
    rto: number;
    delivered: number;
    confirmed: number;
  };
  const buckets = new Map<string, Bucket>();
  const key = (
    dimension: RtoDimension,
    dimensionKey: string,
    bucketDate: string,
  ): string => `${dimension}::${dimensionKey}::${bucketDate}`;

  const bump = (
    dimension: RtoDimension,
    dimensionKey: string,
    bucketDate: string,
    disposition: string,
  ) => {
    const k = key(dimension, dimensionKey, bucketDate);
    const b = buckets.get(k) ?? { total: 0, rto: 0, delivered: 0, confirmed: 0 };
    b.total += 1;
    if (disposition === 'RETURNED') b.rto += 1;
    else if (disposition === 'DELIVERED') b.delivered += 1;
    else if (disposition === 'CONFIRMED') b.confirmed += 1;
    buckets.set(k, b);
  };

  for (const o of orders) {
    const day = o.createdAt.toISOString().slice(0, 10);
    const disp = o.disposition;
    if (o.city) bump('city', o.city.trim().toLowerCase(), day, disp);
    if (o.country) bump('country', o.country.trim().toUpperCase(), day, disp);
    bump('hour', String(o.createdAt.getUTCHours()), day, disp);
    bump('day_of_week', String(o.createdAt.getUTCDay()), day, disp);
    const courier = courierByOrder.get(o.id);
    if (courier) bump('courier', courier, day, disp);
    const items = Array.isArray(o.lineItems)
      ? (o.lineItems as Array<Record<string, unknown>>)
      : [];
    for (const it of items) {
      const productId = typeof it.productId === 'string' ? it.productId : null;
      const sku = typeof it.sku === 'string' ? it.sku : null;
      if (productId) bump('product', productId, day, disp);
      if (sku) bump('sku', sku, day, disp);
    }
  }

  let rowsUpserted = 0;
  const dimensionsSeen = new Set<string>();
  for (const [k, b] of buckets) {
    const [dimension, dimensionKey, bucketDate] = k.split('::');
    if (!dimension || !dimensionKey || !bucketDate) continue;
    dimensionsSeen.add(dimension);
    const rtoRate = b.total > 0 ? b.rto / b.total : 0;
    await prisma.rtoStat.upsert({
      where: {
        shopId_dimension_dimensionKey_bucketDate: {
          shopId,
          dimension,
          dimensionKey,
          bucketDate: new Date(bucketDate),
        },
      },
      create: {
        shopId,
        dimension,
        dimensionKey,
        bucketDate: new Date(bucketDate),
        totalOrders: b.total,
        rtoOrders: b.rto,
        deliveredOrders: b.delivered,
        confirmedOrders: b.confirmed,
        rtoRate: new Prisma.Decimal(rtoRate.toFixed(4)),
      },
      update: {
        totalOrders: b.total,
        rtoOrders: b.rto,
        deliveredOrders: b.delivered,
        confirmedOrders: b.confirmed,
        rtoRate: new Prisma.Decimal(rtoRate.toFixed(4)),
      },
    });
    rowsUpserted += 1;
  }
  return { dimensionsProcessed: dimensionsSeen.size, rowsUpserted };
}

export async function getRtoBreakdown(args: {
  shopId: string;
  dimension: RtoDimension;
  days?: number;
  limit?: number;
}): Promise<
  Array<{
    dimensionKey: string;
    totalOrders: number;
    rtoOrders: number;
    deliveredOrders: number;
    confirmedOrders: number;
    rtoRate: number;
  }>
> {
  const since = new Date(Date.now() - (args.days ?? 30) * 24 * 60 * 60 * 1000);
  const rows = await prisma.rtoStat.findMany({
    where: {
      shopId: args.shopId,
      dimension: args.dimension,
      bucketDate: { gte: since },
    },
  });
  const agg = new Map<
    string,
    { total: number; rto: number; delivered: number; confirmed: number }
  >();
  for (const r of rows) {
    const a = agg.get(r.dimensionKey) ?? { total: 0, rto: 0, delivered: 0, confirmed: 0 };
    a.total += r.totalOrders;
    a.rto += r.rtoOrders;
    a.delivered += r.deliveredOrders;
    a.confirmed += r.confirmedOrders;
    agg.set(r.dimensionKey, a);
  }
  const out = Array.from(agg.entries())
    .map(([dimensionKey, a]) => ({
      dimensionKey,
      totalOrders: a.total,
      rtoOrders: a.rto,
      deliveredOrders: a.delivered,
      confirmedOrders: a.confirmed,
      rtoRate: a.total > 0 ? a.rto / a.total : 0,
    }))
    .sort((x, y) => y.totalOrders - x.totalOrders)
    .slice(0, args.limit ?? 20);
  return out;
}

