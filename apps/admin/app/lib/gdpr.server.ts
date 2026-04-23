/**
 * Phase 4.5 — GDPR compliance: data export + redaction handlers.
 *
 * Shopify sends three mandatory webhooks for every public app:
 *   - customers/data_request → we compile + email/ship data we hold for that
 *     customer.
 *   - customers/redact       → 48h after uninstall, we delete customer PII.
 *   - shop/redact            → 48h after uninstall, we delete the shop's data.
 *
 * Each webhook body is persisted to `GdprExport` for auditability, then a
 * background job processes it.
 */
import type { Prisma } from '@prisma/client';
import prisma from '../db.server';

export type GdprKind =
  | 'customer_data_request'
  | 'customer_redact'
  | 'shop_redact';

export interface GdprWebhookBody {
  shop_id?: number;
  shop_domain?: string;
  customer?: { id?: number; email?: string; phone?: string };
  orders_requested?: number[];
  orders_to_redact?: number[];
}

export async function recordGdprRequest(args: {
  shopId: string;
  kind: GdprKind;
  customerId?: string;
  payload: GdprWebhookBody;
}) {
  return prisma.gdprExport.create({
    data: {
      shopId: args.shopId,
      kind: args.kind,
      customerId: args.customerId,
      payload: args.payload as unknown as Prisma.InputJsonValue,
      status: 'received',
    },
  });
}

export async function processGdprRequest(id: string) {
  const job = await prisma.gdprExport.findUnique({ where: { id } });
  if (!job) return null;
  if (job.kind === 'customer_redact') {
    await redactCustomer(job.shopId, job.customerId);
  } else if (job.kind === 'shop_redact') {
    await redactShop(job.shopId);
  }
  return prisma.gdprExport.update({
    where: { id },
    data: { status: 'completed', processedAt: new Date() },
  });
}

async function redactCustomer(shopId: string, customerId: string | null) {
  if (!customerId) return;
  const redactedPayload = {
    name: null,
    email: null,
    phone: null,
    addressLine1: null,
    addressLine2: null,
  };
  await prisma.order.updateMany({
    where: {
      shopId,
      OR: [{ email: customerId }, { phoneNormalized: customerId }, { phone: customerId }],
    },
    data: {
      customerName: null,
      email: null,
      phone: null,
      phoneNormalized: null,
      addressLine1: null,
      addressLine2: null,
    },
  });
  await prisma.submission.updateMany({
    where: {
      form: { shopId },
      OR: [{ email: customerId }, { phone: customerId }],
    },
    data: {
      fields: redactedPayload,
      email: null,
      phone: null,
    },
  });
}

async function redactShop(shopId: string) {
  await prisma.shop.update({
    where: { id: shopId },
    data: { uninstalledAt: new Date() },
  });
  await prisma.submission.deleteMany({ where: { form: { shopId } } });
  await prisma.order.deleteMany({ where: { shopId } });
  await prisma.blocklist.deleteMany({ where: { shopId } });
}

export async function exportCustomerData(args: {
  shopId: string;
  email?: string;
  phone?: string;
}) {
  const or: Array<Record<string, unknown>> = [];
  if (args.email) or.push({ email: args.email });
  if (args.phone) or.push({ phoneNormalized: args.phone });
  if (!or.length) return { shopId: args.shopId, exportedAt: new Date().toISOString(), orders: [] };
  const orders = await prisma.order.findMany({
    where: { shopId: args.shopId, OR: or as Prisma.OrderWhereInput[] },
    include: { submission: true, messages: true },
  });
  return {
    shopId: args.shopId,
    email: args.email,
    phone: args.phone,
    exportedAt: new Date().toISOString(),
    orders,
  };
}
