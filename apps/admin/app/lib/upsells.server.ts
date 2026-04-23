/**
 * Phase 2.1 — Upsell management.
 */
import type { Prisma, UpsellOffer, UpsellTrigger } from '@prisma/client';
import prisma from '../db.server';

export async function listUpsells(formId: string) {
  return prisma.upsell.findMany({
    where: { formId },
    orderBy: { position: 'asc' },
  });
}

export async function upsertUpsell(args: {
  id?: string;
  formId: string;
  name: string;
  triggerType: UpsellTrigger;
  offerType: UpsellOffer;
  title: string;
  description?: string | null;
  productId?: string | null;
  variantId?: string | null;
  imageUrl?: string | null;
  discountType?: 'percent' | 'flat' | null;
  discountValue?: number | null;
  position?: number;
  isActive?: boolean;
  triggerRule?: Record<string, unknown>;
}) {
  const data = {
    formId: args.formId,
    name: args.name,
    triggerType: args.triggerType,
    offerType: args.offerType,
    title: args.title,
    description: args.description ?? null,
    productId: args.productId ?? null,
    variantId: args.variantId ?? null,
    imageUrl: args.imageUrl ?? null,
    discountType: args.discountType ?? null,
    discountValue: args.discountValue ?? null,
    position: args.position ?? 0,
    isActive: args.isActive ?? true,
    triggerRule: (args.triggerRule ?? {}) as Prisma.InputJsonValue,
  };
  if (args.id) {
    return prisma.upsell.update({ where: { id: args.id }, data });
  }
  return prisma.upsell.create({ data });
}

export async function deleteUpsell(id: string): Promise<void> {
  await prisma.upsell.delete({ where: { id } });
}

export function applyDiscount(price: number, type: string | null, value: number | null): number {
  if (!type || value == null) return price;
  if (type === 'percent') return Math.max(0, price * (1 - value / 100));
  if (type === 'flat') return Math.max(0, price - value);
  return price;
}
