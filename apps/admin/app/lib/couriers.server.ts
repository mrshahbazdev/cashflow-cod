/**
 * Phase 2.2 — Courier booking orchestration.
 * Loads a courier account row, picks the adapter, creates a CourierBooking row.
 */
import type { Prisma } from '@prisma/client';
import { courierRegistry } from '@cashflow-cod/couriers';
import prisma from '../db.server';

export async function listCourierAccounts(shopId: string) {
  return prisma.courierAccount.findMany({
    where: { shopId },
    orderBy: { createdAt: 'desc' },
  });
}

export async function upsertCourierAccount(args: {
  shopId: string;
  id?: string;
  courier: string;
  label: string;
  isActive?: boolean;
  credentials?: Record<string, unknown>;
  settings?: Record<string, unknown>;
}) {
  const data = {
    shopId: args.shopId,
    courier: args.courier,
    label: args.label,
    isActive: args.isActive ?? true,
    credentials: (args.credentials ?? {}) as Prisma.InputJsonValue,
    settings: (args.settings ?? {}) as Prisma.InputJsonValue,
  };
  if (args.id) {
    return prisma.courierAccount.update({ where: { id: args.id }, data });
  }
  return prisma.courierAccount.upsert({
    where: { shopId_courier: { shopId: args.shopId, courier: args.courier } },
    create: data,
    update: data,
  });
}

export async function deleteCourierAccount(shopId: string, id: string) {
  await prisma.courierAccount.deleteMany({ where: { id, shopId } });
}

export async function bookCourierForOrder(args: {
  orderId: string;
  courierAccountId: string;
  weightKg?: number;
  notes?: string;
}): Promise<{ ok: true; bookingId: string; consignmentNumber: string } | { ok: false; error: string }> {
  const order = await prisma.order.findUnique({ where: { id: args.orderId } });
  if (!order) return { ok: false, error: 'Order not found' };
  const account = await prisma.courierAccount.findUnique({ where: { id: args.courierAccountId } });
  if (!account || account.shopId !== order.shopId) {
    return { ok: false, error: 'Courier account not found' };
  }
  const adapter = courierRegistry.get(account.courier as Parameters<typeof courierRegistry.get>[0]);
  if (!adapter) return { ok: false, error: `Unsupported courier: ${account.courier}` };

  const result = await adapter.book(
    (account.credentials as Record<string, string>) ?? {},
    {
      orderId: order.id,
      customerName: order.customerName ?? 'Customer',
      phone: order.phone ?? '',
      addressLine1: order.addressLine1 ?? '',
      addressLine2: order.addressLine2 ?? undefined,
      city: order.city ?? '',
      postalCode: order.postalCode ?? undefined,
      amount: Number(order.total ?? 0),
      currency: order.currency ?? 'USD',
      weightKg: args.weightKg,
      notes: args.notes,
    },
  );

  const booking = await prisma.courierBooking.create({
    data: {
      orderId: order.id,
      courierAccountId: account.id,
      consignmentNumber: result.consignmentNumber || null,
      labelUrl: result.labelUrl ?? null,
      trackingUrl: result.trackingUrl ?? null,
      status: result.status,
      trackingEvents: [] as unknown as Prisma.InputJsonValue,
      bookedAt: result.status === 'booked' ? new Date() : null,
    },
  });

  if (result.status !== 'booked') {
    return { ok: false, error: `Booking failed (${JSON.stringify(result.raw).slice(0, 120)})` };
  }
  return { ok: true, bookingId: booking.id, consignmentNumber: result.consignmentNumber };
}

export async function syncTrackingEvents(bookingId: string): Promise<void> {
  const booking = await prisma.courierBooking.findUnique({
    where: { id: bookingId },
    include: { courierAccount: true },
  });
  if (!booking || !booking.consignmentNumber) return;
  const adapter = courierRegistry.get(
    booking.courierAccount.courier as Parameters<typeof courierRegistry.get>[0],
  );
  if (!adapter) return;
  const events = await adapter.track(
    (booking.courierAccount.credentials as Record<string, string>) ?? {},
    booking.consignmentNumber,
  );
  await prisma.courierBooking.update({
    where: { id: booking.id },
    data: {
      trackingEvents: events as unknown as Prisma.InputJsonValue,
      lastSyncedAt: new Date(),
    },
  });
}
