/**
 * Phase 4.3 — A/B testing framework.
 *
 * The merchant defines variants on a Form (or any entity) with optional weights.
 * At storefront boot, `assignVariant` picks one based on a stable visitor-id
 * hash so the same visitor always sees the same variant. Each view/conversion
 * is aggregated into an ABTestExposure row keyed by (test, variant, day).
 */
import type { Prisma } from '@prisma/client';
import prisma from '../db.server';

export interface Variant {
  key: string;
  label: string;
  weight?: number;
  schemaOverride?: Record<string, unknown>;
}

export async function listTests(shopId: string) {
  return prisma.aBTest.findMany({
    where: { shopId },
    orderBy: { startedAt: 'desc' },
  });
}

export async function getTest(testId: string) {
  return prisma.aBTest.findUnique({
    where: { id: testId },
    include: { exposures: { orderBy: { bucketDate: 'desc' }, take: 60 } },
  });
}

export async function createTest(args: {
  shopId: string;
  name: string;
  entityType: string;
  entityId: string;
  variants: Variant[];
  metric?: string;
}) {
  return prisma.aBTest.create({
    data: {
      shopId: args.shopId,
      name: args.name,
      entityType: args.entityType,
      entityId: args.entityId,
      variants: args.variants as unknown as Prisma.InputJsonValue,
      metric: args.metric ?? 'conversion_rate',
      status: 'running',
    },
  });
}

export async function stopTest(testId: string, winner?: string) {
  return prisma.aBTest.update({
    where: { id: testId },
    data: {
      status: 'stopped',
      endedAt: new Date(),
      ...(winner ? { winner } : {}),
    },
  });
}

function hash(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h * 31 + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

/**
 * Deterministic variant selection: same visitor → same variant. Uses weight
 * sums; defaults to equal weights.
 */
export function assignVariant(
  variants: Variant[],
  visitorId: string,
  testId: string,
): Variant | null {
  if (!variants.length) return null;
  const weights = variants.map((v) => (v.weight && v.weight > 0 ? v.weight : 1));
  const total = weights.reduce((a, b) => a + b, 0);
  const bucket = hash(`${visitorId}:${testId}`) % total;
  let acc = 0;
  for (let i = 0; i < variants.length; i++) {
    acc += weights[i] ?? 1;
    const variant = variants[i];
    if (variant && bucket < acc) return variant;
  }
  return variants[variants.length - 1] ?? null;
}

function today(): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

export async function recordView(testId: string, variantKey: string) {
  return prisma.aBTestExposure.upsert({
    where: {
      abTestId_variantKey_bucketDate: {
        abTestId: testId,
        variantKey,
        bucketDate: today(),
      },
    },
    create: { abTestId: testId, variantKey, bucketDate: today(), views: 1 },
    update: { views: { increment: 1 } },
  });
}

export async function recordConversion(testId: string, variantKey: string) {
  return prisma.aBTestExposure.upsert({
    where: {
      abTestId_variantKey_bucketDate: {
        abTestId: testId,
        variantKey,
        bucketDate: today(),
      },
    },
    create: {
      abTestId: testId,
      variantKey,
      bucketDate: today(),
      conversions: 1,
    },
    update: { conversions: { increment: 1 } },
  });
}

export interface VariantStats {
  key: string;
  views: number;
  conversions: number;
  rate: number;
}

export async function summarizeTest(testId: string): Promise<VariantStats[]> {
  const rows = await prisma.aBTestExposure.findMany({
    where: { abTestId: testId },
  });
  const byKey = new Map<string, { views: number; conversions: number }>();
  for (const r of rows) {
    const cur = byKey.get(r.variantKey) ?? { views: 0, conversions: 0 };
    cur.views += r.views;
    cur.conversions += r.conversions;
    byKey.set(r.variantKey, cur);
  }
  return Array.from(byKey.entries()).map(([key, v]) => ({
    key,
    views: v.views,
    conversions: v.conversions,
    rate: v.views === 0 ? 0 : v.conversions / v.views,
  }));
}
