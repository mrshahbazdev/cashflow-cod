/**
 * Phase 4.1 — WhatsApp / SMS 2-way inbox.
 *
 * Each (shop, channel, customerPhone) tuple is a single InboxThread. Messages
 * attach to both the thread and (when resolvable) the originating Order. The
 * unreadCount is incremented for inbound messages and reset when the merchant
 * marks the thread read.
 */
import type { Prisma } from '@prisma/client';
import prisma from '../db.server';

export async function listThreads(args: {
  shopId: string;
  status?: 'open' | 'resolved' | 'snoozed';
  limit?: number;
}) {
  return prisma.inboxThread.findMany({
    where: {
      shopId: args.shopId,
      ...(args.status ? { status: args.status } : {}),
    },
    orderBy: { lastMessageAt: 'desc' },
    take: args.limit ?? 100,
  });
}

export async function getThreadWithMessages(threadId: string) {
  return prisma.inboxThread.findUnique({
    where: { id: threadId },
    include: {
      order: true,
      messages: { orderBy: { createdAt: 'asc' } },
    },
  });
}

export async function getOrCreateThread(args: {
  shopId: string;
  channel?: string;
  customerPhone: string;
  customerName?: string | null;
  customerEmail?: string | null;
  orderId?: string | null;
}) {
  const channel = args.channel ?? 'whatsapp';
  const existing = await prisma.inboxThread.findUnique({
    where: {
      shopId_channel_customerPhone: {
        shopId: args.shopId,
        channel,
        customerPhone: args.customerPhone,
      },
    },
  });
  if (existing) return existing;
  return prisma.inboxThread.create({
    data: {
      shopId: args.shopId,
      channel,
      customerPhone: args.customerPhone,
      customerName: args.customerName ?? null,
      customerEmail: args.customerEmail ?? null,
      orderId: args.orderId ?? null,
    },
  });
}

export async function appendMessage(args: {
  threadId: string;
  orderId: string;
  direction: 'inbound' | 'outbound';
  channel?: string;
  body: string;
  fromAddress?: string;
  toAddress?: string;
  provider?: string;
  providerId?: string;
  status?: string;
  payload?: Record<string, unknown>;
}) {
  const channel = args.channel ?? 'whatsapp';
  const [message] = await prisma.$transaction([
    prisma.message.create({
      data: {
        orderId: args.orderId,
        threadId: args.threadId,
        channel,
        direction: args.direction,
        body: args.body,
        fromAddress: args.fromAddress,
        toAddress: args.toAddress,
        provider: args.provider,
        providerId: args.providerId,
        status: args.status ?? (args.direction === 'outbound' ? 'sent' : 'delivered'),
        payload: (args.payload ?? {}) as Prisma.InputJsonValue,
        sentAt: args.direction === 'outbound' ? new Date() : null,
        deliveredAt: args.direction === 'inbound' ? new Date() : null,
      },
    }),
    prisma.inboxThread.update({
      where: { id: args.threadId },
      data: {
        lastMessageAt: new Date(),
        lastDirection: args.direction,
        lastPreview: args.body.slice(0, 140),
        unreadCount:
          args.direction === 'inbound' ? { increment: 1 } : undefined,
      },
    }),
  ]);
  return message;
}

export async function markThreadRead(threadId: string) {
  return prisma.inboxThread.update({
    where: { id: threadId },
    data: { unreadCount: 0 },
  });
}

export async function updateThreadStatus(
  threadId: string,
  status: 'open' | 'resolved' | 'snoozed',
) {
  return prisma.inboxThread.update({
    where: { id: threadId },
    data: { status },
  });
}

export async function assignThread(threadId: string, agentId: string | null) {
  return prisma.inboxThread.update({
    where: { id: threadId },
    data: { assignedAgentId: agentId },
  });
}
