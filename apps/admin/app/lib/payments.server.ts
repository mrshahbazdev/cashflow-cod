/**
 * Phase 4.2 — Partial / split payment (COD advance) orchestration.
 *
 * The merchant configures one or more `PaymentProviderAccount` rows via the
 * admin UI. When a new high-risk order arrives (or on explicit button click),
 * `createAdvanceForOrder` picks an adapter, asks for a hosted checkout URL,
 * and creates a `PaymentAdvance` row in `pending`. The provider webhook later
 * updates the row to `paid` / `failed`.
 */
import type { Prisma } from '@prisma/client';
import {
  easypaisaAdapter,
  jazzcashAdapter,
  paymentRegistry,
  razorpayAdapter,
  sadapayAdapter,
  stripeAdapter,
  type PaymentProviderCode,
} from '@cashflow-cod/payments';
import prisma from '../db.server';

let registered = false;
function ensureAdaptersRegistered(): void {
  if (registered) return;
  paymentRegistry.register(jazzcashAdapter);
  paymentRegistry.register(easypaisaAdapter);
  paymentRegistry.register(sadapayAdapter);
  paymentRegistry.register(stripeAdapter);
  paymentRegistry.register(razorpayAdapter);
  registered = true;
}

export function listPaymentAdapters() {
  ensureAdaptersRegistered();
  return paymentRegistry.list().map((a) => ({
    code: a.code,
    displayName: a.displayName,
    supportedCurrencies: a.supportedCurrencies,
  }));
}

export async function listPaymentAccounts(shopId: string) {
  return prisma.paymentProviderAccount.findMany({
    where: { shopId },
    orderBy: { createdAt: 'desc' },
  });
}

export async function upsertPaymentAccount(args: {
  shopId: string;
  id?: string;
  provider: PaymentProviderCode;
  label: string;
  mode?: 'mock' | 'live';
  isActive?: boolean;
  credentials?: Record<string, unknown>;
}) {
  const data = {
    shopId: args.shopId,
    provider: args.provider,
    label: args.label,
    mode: args.mode ?? 'mock',
    isActive: args.isActive ?? true,
    credentials: (args.credentials ?? {}) as Prisma.InputJsonValue,
  };
  if (args.id) {
    return prisma.paymentProviderAccount.update({ where: { id: args.id }, data });
  }
  return prisma.paymentProviderAccount.upsert({
    where: {
      shopId_provider_label: {
        shopId: args.shopId,
        provider: args.provider,
        label: args.label,
      },
    },
    create: data,
    update: data,
  });
}

export async function deletePaymentAccount(shopId: string, id: string) {
  await prisma.paymentProviderAccount.deleteMany({ where: { shopId, id } });
}

export interface CreateAdvanceArgs {
  orderId: string;
  providerAccountId: string;
  amount: number;
  currency?: string;
  returnUrl?: string;
  cancelUrl?: string;
}

export async function createAdvanceForOrder(args: CreateAdvanceArgs) {
  ensureAdaptersRegistered();
  const account = await prisma.paymentProviderAccount.findUnique({
    where: { id: args.providerAccountId },
  });
  if (!account) throw new Error('Payment account not found');
  const adapter = paymentRegistry.get(account.provider as PaymentProviderCode);
  if (!adapter) throw new Error(`No adapter for provider '${account.provider}'`);

  const order = await prisma.order.findUnique({
    where: { id: args.orderId },
    select: { id: true, customerName: true, phoneNormalized: true, email: true },
  });
  if (!order) throw new Error('Order not found');

  const res = await adapter.createAdvance(account.credentials as Record<string, string>, {
    orderId: order.id,
    amount: args.amount,
    currency: args.currency ?? 'PKR',
    customer: {
      name: order.customerName ?? undefined,
      phone: order.phoneNormalized ?? undefined,
      email: order.email ?? undefined,
    },
    returnUrl: args.returnUrl ?? `https://example.com/return/${order.id}`,
    cancelUrl: args.cancelUrl ?? `https://example.com/cancel/${order.id}`,
  });

  return prisma.paymentAdvance.create({
    data: {
      orderId: order.id,
      providerAccountId: account.id,
      amount: args.amount,
      currency: args.currency ?? 'PKR',
      status: res.status,
      providerRef: res.providerRef,
      checkoutUrl: res.checkoutUrl,
    },
  });
}

export async function markAdvancePaid(advanceId: string, providerRef?: string) {
  return prisma.paymentAdvance.update({
    where: { id: advanceId },
    data: {
      status: 'paid',
      paidAt: new Date(),
      ...(providerRef ? { providerRef } : {}),
    },
  });
}

export async function listAdvancesForOrder(orderId: string) {
  return prisma.paymentAdvance.findMany({
    where: { orderId },
    orderBy: { createdAt: 'desc' },
    include: { providerAccount: true },
  });
}

/**
 * Compute a suggested advance amount given the order total + risk score.
 * Steady-state rule: riskScore 0-30 → 0 advance, 30-60 → 20%, 60-80 → 40%,
 * 80+ → 60%. Callers are free to override.
 */
export function suggestedAdvancePercent(riskScore: number | null | undefined): number {
  const s = Number(riskScore ?? 0);
  if (s >= 80) return 60;
  if (s >= 60) return 40;
  if (s >= 30) return 20;
  return 0;
}
