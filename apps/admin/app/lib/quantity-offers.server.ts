/**
 * Volume / quantity-discount engine.
 *
 * Each `QuantityOffer.ladder` is `[{ minQuantity, discountType, discountValue }]`.
 * For a given (shop, productId/variantId, quantity, unitPrice) we pick the
 * highest ladder rung the cart qualifies for and return the discounted unit
 * price plus the savings amount.
 */
import prisma from '../db.server';

export interface LadderRung {
  minQuantity: number;
  discountType: 'percent' | 'flat';
  discountValue: number;
}

export interface QuantityDiscountResult {
  applied: boolean;
  rung?: LadderRung;
  unitPriceAfter: number;
  savingsPerUnit: number;
  totalSavings: number;
}

export async function listActiveOffers(shopId: string) {
  return prisma.quantityOffer.findMany({
    where: { shopId, isActive: true },
    orderBy: { createdAt: 'desc' },
  });
}

export async function bestQuantityDiscount(args: {
  shopId: string;
  productId?: string | null;
  variantId?: string | null;
  quantity: number;
  unitPrice: number;
}): Promise<QuantityDiscountResult> {
  if (args.quantity <= 0) {
    return {
      applied: false,
      unitPriceAfter: args.unitPrice,
      savingsPerUnit: 0,
      totalSavings: 0,
    };
  }
  const offers = await prisma.quantityOffer.findMany({
    where: {
      shopId: args.shopId,
      isActive: true,
      OR: [
        { productId: args.productId ?? undefined },
        { variantId: args.variantId ?? undefined },
        { productId: null, variantId: null },
      ],
    },
  });
  let best: LadderRung | null = null;
  let bestSavings = 0;
  for (const o of offers) {
    const ladder = (o.ladder as unknown as LadderRung[]) ?? [];
    for (const rung of ladder) {
      if (typeof rung?.minQuantity !== 'number') continue;
      if (args.quantity < rung.minQuantity) continue;
      const savings =
        rung.discountType === 'percent'
          ? (args.unitPrice * rung.discountValue) / 100
          : rung.discountValue;
      const clamped = Math.max(0, Math.min(args.unitPrice, savings));
      if (clamped > bestSavings) {
        bestSavings = clamped;
        best = rung;
      }
    }
  }
  if (!best) {
    return {
      applied: false,
      unitPriceAfter: args.unitPrice,
      savingsPerUnit: 0,
      totalSavings: 0,
    };
  }
  return {
    applied: true,
    rung: best,
    unitPriceAfter: Math.max(0, args.unitPrice - bestSavings),
    savingsPerUnit: bestSavings,
    totalSavings: bestSavings * args.quantity,
  };
}
