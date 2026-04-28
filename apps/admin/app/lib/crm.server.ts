/**
 * Phase 5.2 — CRM segments + broadcasts.
 *
 * Segments are saved filters over Order data (disposition, risk, city, country,
 * language, tags). Broadcasts send WhatsApp / SMS / Email to a segment's
 * members. This file handles segment CRUD, member resolution, and broadcast
 * lifecycle (draft → queued → sending → sent/failed).
 */
import type { Prisma } from '@prisma/client';
import prisma from '../db.server';

export interface SegmentFilter {
  disposition?: string[];
  minRisk?: number;
  maxRisk?: number;
  city?: string;
  country?: string;
  language?: string;
  tags?: string[];
  createdAfter?: string;
  createdBefore?: string;
}

export async function listSegments(shopId: string) {
  return prisma.customerSegment.findMany({
    where: { shopId },
    orderBy: { updatedAt: 'desc' },
  });
}

export async function getSegment(shopId: string, id: string) {
  return prisma.customerSegment.findFirst({ where: { id, shopId } });
}

export async function upsertSegment(args: {
  shopId: string;
  id?: string;
  name: string;
  description?: string | null;
  filter: SegmentFilter;
}) {
  if (args.id) {
    return prisma.customerSegment.update({
      where: { id: args.id },
      data: {
        name: args.name,
        description: args.description ?? null,
        filter: args.filter as Prisma.InputJsonValue,
      },
    });
  }
  return prisma.customerSegment.create({
    data: {
      shopId: args.shopId,
      name: args.name,
      description: args.description ?? null,
      filter: args.filter as Prisma.InputJsonValue,
    },
  });
}

export async function deleteSegment(shopId: string, id: string) {
  await prisma.customerSegment.deleteMany({ where: { id, shopId } });
}

/**
 * Resolve a segment to the actual matching Order rows. Used for both the UI
 * preview and broadcast worker dispatch. Cap at `limit` to avoid runaway loads.
 */
export async function resolveSegmentMembers(segmentId: string, limit = 10000) {
  const segment = await prisma.customerSegment.findUnique({ where: { id: segmentId } });
  if (!segment) return [];
  const filter = (segment.filter ?? {}) as SegmentFilter;
  const where = buildWhereFromFilter(segment.shopId, filter);
  return prisma.order.findMany({
    where,
    select: {
      id: true,
      customerName: true,
      phone: true,
      phoneNormalized: true,
      email: true,
      city: true,
      country: true,
    },
    take: limit,
  });
}

export async function buildSegment(segmentId: string) {
  const members = await resolveSegmentMembers(segmentId);
  const segment = await prisma.customerSegment.update({
    where: { id: segmentId },
    data: {
      memberCount: members.length,
      lastBuiltAt: new Date(),
    },
  });
  return { segment, memberCount: members.length };
}

function buildWhereFromFilter(shopId: string, filter: SegmentFilter): Prisma.OrderWhereInput {
  const where: Prisma.OrderWhereInput = { shopId };
  if (filter.disposition && filter.disposition.length) {
    where.disposition = { in: filter.disposition as never };
  }
  if (filter.minRisk !== undefined) {
    where.riskScore = { ...(where.riskScore as object), gte: filter.minRisk };
  }
  if (filter.maxRisk !== undefined) {
    where.riskScore = { ...(where.riskScore as object), lte: filter.maxRisk };
  }
  if (filter.city) where.city = { contains: filter.city, mode: 'insensitive' };
  if (filter.country) where.country = filter.country;
  if (filter.createdAfter) where.createdAt = { ...(where.createdAt as object), gte: new Date(filter.createdAfter) };
  if (filter.createdBefore) where.createdAt = { ...(where.createdAt as object), lte: new Date(filter.createdBefore) };
  return where;
}

export async function listBroadcasts(shopId: string) {
  return prisma.broadcast.findMany({
    where: { shopId },
    include: { segment: { select: { id: true, name: true, memberCount: true } } },
    orderBy: { createdAt: 'desc' },
  });
}

export async function createBroadcast(args: {
  shopId: string;
  name: string;
  channel: 'whatsapp' | 'sms' | 'email';
  body: string;
  segmentId?: string | null;
  scheduledAt?: Date | null;
}) {
  return prisma.broadcast.create({
    data: {
      shopId: args.shopId,
      name: args.name,
      channel: args.channel,
      body: args.body,
      segmentId: args.segmentId ?? null,
      scheduledAt: args.scheduledAt ?? null,
    },
  });
}

export async function markBroadcastQueued(id: string) {
  return prisma.broadcast.update({
    where: { id },
    data: { status: 'queued' },
  });
}

export async function markBroadcastSending(id: string) {
  return prisma.broadcast.update({
    where: { id },
    data: { status: 'sending', startedAt: new Date() },
  });
}

export async function markBroadcastSent(id: string, sent: number, failed: number) {
  return prisma.broadcast.update({
    where: { id },
    data: {
      status: failed > 0 && sent === 0 ? 'failed' : 'sent',
      sent,
      failed,
      finishedAt: new Date(),
    },
  });
}

export async function deleteBroadcast(shopId: string, id: string) {
  await prisma.broadcast.deleteMany({ where: { id, shopId } });
}

/**
 * Dispatch a broadcast — resolves the target segment, iterates members, and
 * records send/failure counts on the Broadcast row. Messaging transport is a
 * thin pluggable adapter (WhatsApp via packages/messaging, SMS via Twilio,
 * email via the email-integration adapters).
 */
export async function dispatchBroadcast(
  id: string,
  sender: (to: string, body: string, channel: string) => Promise<boolean>,
): Promise<{ sent: number; failed: number }> {
  const broadcast = await prisma.broadcast.findUnique({ where: { id } });
  if (!broadcast) return { sent: 0, failed: 0 };
  await markBroadcastSending(id);

  let members: Array<{ phone: string | null; email: string | null }> = [];
  if (broadcast.segmentId) {
    members = await resolveSegmentMembers(broadcast.segmentId);
  } else {
    members = await prisma.order.findMany({
      where: { shopId: broadcast.shopId },
      select: { phone: true, email: true },
      take: 10000,
    });
  }

  let sent = 0;
  let failed = 0;
  for (const m of members) {
    const to = broadcast.channel === 'email' ? m.email : m.phone;
    if (!to) {
      failed++;
      continue;
    }
    try {
      const ok = await sender(to, broadcast.body, broadcast.channel);
      if (ok) sent++;
      else failed++;
    } catch {
      failed++;
    }
  }
  await markBroadcastSent(id, sent, failed);
  return { sent, failed };
}
