/**
 * Returns / RMA workflow.
 *
 * Customers submit a return request via the public storefront (`/returns/:code`)
 * by entering their order tracking code + reason. The merchant reviews from
 * `/app/returns`, can approve/reject, mark picked-up/received/resolved, and
 * optionally trigger a refund (Decimal amount) or replacement order id.
 */
import { randomBytes } from 'crypto';
import type { ReturnResolution, ReturnStatus } from '@prisma/client';
import prisma from '../db.server';

export interface CreateReturnInput {
  shopId: string;
  orderId: string;
  reason: string;
  resolution?: ReturnResolution;
  notes?: string;
}

function generateTrackingCode(): string {
  return `RMA-${randomBytes(4).toString('hex').toUpperCase()}`;
}

export async function listReturns(shopId: string) {
  return prisma.returnRequest.findMany({
    where: { shopId },
    orderBy: { createdAt: 'desc' },
    take: 100,
    include: { order: { select: { id: true, customerName: true, phone: true, total: true } } },
  });
}

export async function getReturnByCode(code: string) {
  return prisma.returnRequest.findUnique({
    where: { trackingCode: code },
    include: { order: { select: { customerName: true, phone: true, total: true, currency: true } } },
  });
}

export async function createReturn(input: CreateReturnInput) {
  const order = await prisma.order.findFirst({ where: { id: input.orderId, shopId: input.shopId } });
  if (!order) throw new Error('Order not found');
  return prisma.returnRequest.create({
    data: {
      shopId: input.shopId,
      orderId: input.orderId,
      reason: input.reason,
      resolution: input.resolution ?? 'REFUND',
      notes: input.notes,
      trackingCode: generateTrackingCode(),
    },
  });
}

export async function updateReturnStatus(
  shopId: string,
  id: string,
  status: ReturnStatus,
  extras: { refundAmount?: number; replacementOrderId?: string; notes?: string } = {},
) {
  return prisma.returnRequest.updateMany({
    where: { id, shopId },
    data: {
      status,
      refundAmount: extras.refundAmount,
      replacementOrderId: extras.replacementOrderId,
      notes: extras.notes,
    },
  });
}

export async function deleteReturn(shopId: string, id: string) {
  await prisma.returnRequest.deleteMany({ where: { id, shopId } });
}
