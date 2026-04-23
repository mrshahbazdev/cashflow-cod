/**
 * Phase 3.3 — Multi-store merchant group.
 * A merchant group owns N shops. Aggregates come from summing per-shop stats.
 */
import prisma from '../db.server';

export async function createMerchantGroup(args: {
  name: string;
  ownerEmail?: string;
}) {
  return prisma.merchantGroup.create({
    data: { name: args.name, ownerEmail: args.ownerEmail ?? null },
  });
}

export async function attachShopToGroup(shopId: string, groupId: string) {
  await prisma.shop.update({ where: { id: shopId }, data: { merchantGroupId: groupId } });
}

export async function detachShopFromGroup(shopId: string) {
  await prisma.shop.update({ where: { id: shopId }, data: { merchantGroupId: null } });
}

export async function listGroups() {
  return prisma.merchantGroup.findMany({
    orderBy: { createdAt: 'desc' },
    include: { shops: { select: { id: true, domain: true, plan: true } } },
  });
}

export async function getGroupOverview(groupId: string) {
  const group = await prisma.merchantGroup.findUnique({
    where: { id: groupId },
    include: { shops: { select: { id: true, domain: true, plan: true } } },
  });
  if (!group) return null;
  const shopIds = group.shops.map((s) => s.id);
  if (shopIds.length === 0) {
    return { group, totals: { orders: 0, rto: 0, delivered: 0, confirmed: 0 } };
  }
  const grouped = await prisma.order.groupBy({
    by: ['disposition'],
    where: { shopId: { in: shopIds } },
    _count: { _all: true },
  });
  let orders = 0;
  let rto = 0;
  let delivered = 0;
  let confirmed = 0;
  for (const g of grouped) {
    const n = g._count._all;
    orders += n;
    if (g.disposition === 'RETURNED') rto += n;
    if (g.disposition === 'DELIVERED') delivered += n;
    if (g.disposition === 'CONFIRMED') confirmed += n;
  }
  return { group, totals: { orders, rto, delivered, confirmed } };
}
