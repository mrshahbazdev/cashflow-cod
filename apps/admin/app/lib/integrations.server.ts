/**
 * Pixel CRUD helpers for the admin Integrations page.
 *
 * Re-uses the `Pixel` model defined in Prisma; one row per (shop, provider,
 * pixelId). We surface a stable `displayName` from the adapter registry so
 * the admin UI can render readable labels.
 */
import { pixelRegistry } from '@cashflow-cod/pixels';
import type { PixelProvider } from '@cashflow-cod/shared-types';
import prisma from '../db.server';

export interface PixelInput {
  shopId: string;
  provider: PixelProvider;
  pixelId: string;
  accessToken?: string | null;
  testCode?: string | null;
  capiEnabled?: boolean;
  isActive?: boolean;
}

export async function listPixels(shopId: string) {
  return prisma.pixel.findMany({
    where: { shopId },
    orderBy: [{ isActive: 'desc' }, { createdAt: 'desc' }],
  });
}

export function listPixelAdapters() {
  return pixelRegistry.list().map((a) => ({
    provider: a.provider,
    displayName: a.displayName,
  }));
}

export async function upsertPixel(input: PixelInput) {
  const {
    shopId,
    provider,
    pixelId,
    accessToken = null,
    testCode = null,
    capiEnabled = true,
    isActive = true,
  } = input;
  if (!shopId || !provider || !pixelId) {
    throw new Error('shopId, provider, and pixelId are required');
  }
  if (!pixelRegistry.get(provider)) {
    throw new Error(`Unknown pixel provider: ${provider}`);
  }
  return prisma.pixel.upsert({
    where: {
      shopId_provider_pixelId: { shopId, provider, pixelId },
    },
    create: {
      shopId,
      provider,
      pixelId,
      accessToken: accessToken ?? null,
      testCode: testCode ?? null,
      capiEnabled,
      isActive,
    },
    update: {
      accessToken: accessToken ?? null,
      testCode: testCode ?? null,
      capiEnabled,
      isActive,
    },
  });
}

export async function deletePixel(shopId: string, id: string) {
  await prisma.pixel.deleteMany({ where: { id, shopId } });
}

export async function togglePixel(shopId: string, id: string, isActive: boolean) {
  await prisma.pixel.updateMany({ where: { id, shopId }, data: { isActive } });
}
