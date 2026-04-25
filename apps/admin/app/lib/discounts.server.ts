/**
 * Discount-code engine.
 *
 * `validateDiscount` evaluates a code against a (shop, customerKey, subtotal,
 * productIds) tuple and returns either a normalized result or an error code.
 * `applyDiscountToOrder` records a redemption row and increments the
 * usage counter inside a single transaction.
 */
import { createHash } from 'node:crypto';
import type { Discount, Prisma } from '@prisma/client';
import prisma from '../db.server';

export type DiscountValidationError =
  | 'NOT_FOUND'
  | 'INACTIVE'
  | 'EXPIRED'
  | 'NOT_STARTED'
  | 'MIN_SUBTOTAL'
  | 'USAGE_LIMIT'
  | 'PER_CUSTOMER_LIMIT'
  | 'NOT_ELIGIBLE_PRODUCT';

export interface DiscountValidationOk {
  ok: true;
  discount: Discount;
  amount: number;
  freeShipping: boolean;
}

export interface DiscountValidationErr {
  ok: false;
  reason: DiscountValidationError;
  message: string;
}

export type DiscountValidationResult = DiscountValidationOk | DiscountValidationErr;

export interface ValidateInput {
  shopId: string;
  code: string;
  subtotal: number;
  productIds?: string[];
  customerKey?: string | null;
}

export async function validateDiscount(input: ValidateInput): Promise<DiscountValidationResult> {
  const code = input.code.trim().toUpperCase();
  if (!code) {
    return { ok: false, reason: 'NOT_FOUND', message: 'Discount code missing' };
  }
  const discount = await prisma.discount.findUnique({
    where: { shopId_code: { shopId: input.shopId, code } },
  });
  if (!discount) return { ok: false, reason: 'NOT_FOUND', message: 'Code not recognized' };
  if (!discount.isActive) {
    return { ok: false, reason: 'INACTIVE', message: 'This code is no longer active' };
  }
  const now = new Date();
  if (discount.startsAt && discount.startsAt > now) {
    return { ok: false, reason: 'NOT_STARTED', message: 'This code is not yet active' };
  }
  if (discount.expiresAt && discount.expiresAt < now) {
    return { ok: false, reason: 'EXPIRED', message: 'This code has expired' };
  }
  if (discount.usageLimit && discount.usageCount >= discount.usageLimit) {
    return { ok: false, reason: 'USAGE_LIMIT', message: 'This code has hit its usage limit' };
  }
  if (
    discount.minSubtotal != null &&
    input.subtotal < Number(discount.minSubtotal as unknown as number)
  ) {
    return {
      ok: false,
      reason: 'MIN_SUBTOTAL',
      message: `Minimum subtotal of ${Number(discount.minSubtotal)} required`,
    };
  }
  if (discount.appliesTo === 'products') {
    const ids = (discount.productIds as string[]) ?? [];
    const requested = input.productIds ?? [];
    if (!requested.some((p) => ids.includes(p))) {
      return {
        ok: false,
        reason: 'NOT_ELIGIBLE_PRODUCT',
        message: 'No eligible products in cart for this code',
      };
    }
  }
  if (discount.perCustomer && input.customerKey) {
    const key = hashCustomerKey(input.customerKey);
    const used = await prisma.discountRedemption.count({
      where: { discountId: discount.id, customerKey: key },
    });
    if (used >= discount.perCustomer) {
      return {
        ok: false,
        reason: 'PER_CUSTOMER_LIMIT',
        message: 'You have already used this code',
      };
    }
  }

  const amount = computeDiscountAmount(discount, input.subtotal);
  return {
    ok: true,
    discount,
    amount,
    freeShipping: discount.type === 'free_shipping',
  };
}

export function computeDiscountAmount(discount: Discount, subtotal: number): number {
  const value = Number(discount.value as unknown as number);
  switch (discount.type) {
    case 'percent':
      return Math.max(0, Math.min(subtotal, (subtotal * value) / 100));
    case 'flat':
      return Math.max(0, Math.min(subtotal, value));
    case 'free_shipping':
      // Shipping is calculated downstream — discount is recorded as informational here.
      return 0;
    default:
      return 0;
  }
}

export async function recordDiscountRedemption(args: {
  shopId: string;
  discountId: string;
  submissionId?: string | null;
  orderId?: string | null;
  amount: number;
  customerKey?: string | null;
}): Promise<void> {
  await prisma.$transaction([
    prisma.discountRedemption.create({
      data: {
        shopId: args.shopId,
        discountId: args.discountId,
        submissionId: args.submissionId ?? null,
        orderId: args.orderId ?? null,
        amount: args.amount as unknown as Prisma.Decimal,
        customerKey: args.customerKey ? hashCustomerKey(args.customerKey) : null,
      },
    }),
    prisma.discount.update({
      where: { id: args.discountId },
      data: { usageCount: { increment: 1 } },
    }),
  ]);
}

export function hashCustomerKey(raw: string): string {
  return createHash('sha256').update(raw.trim().toLowerCase()).digest('hex');
}
