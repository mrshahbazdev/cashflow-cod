/**
 * Phase 4.4 — Custom landing pages hosted by the app.
 *
 * Merchants point paid-ad campaigns at /f/:slug (e.g. facebook ad → landing
 * page → form submit → draft order). The slug is globally unique across the
 * network (short, campaign-style), scoped only by the `shopId` relation.
 */
import type { Prisma } from '@prisma/client';
import prisma from '../db.server';

export async function listLandingPages(shopId: string) {
  return prisma.landingPage.findMany({
    where: { shopId },
    include: { form: { select: { id: true, name: true, slug: true } } },
    orderBy: { createdAt: 'desc' },
  });
}

export async function getLandingPageBySlug(slug: string) {
  return prisma.landingPage.findUnique({
    where: { slug },
    include: {
      form: true,
      shop: { select: { id: true, domain: true } },
    },
  });
}

export async function createLandingPage(args: {
  shopId: string;
  formId: string;
  slug: string;
  title: string;
  headline?: string;
  subheadline?: string;
  heroImage?: string;
  bodyHtml?: string;
  theme?: Record<string, unknown>;
  utmDefault?: Record<string, unknown>;
  isPublished?: boolean;
}) {
  return prisma.landingPage.create({
    data: {
      shopId: args.shopId,
      formId: args.formId,
      slug: args.slug,
      title: args.title,
      headline: args.headline,
      subheadline: args.subheadline,
      heroImage: args.heroImage,
      bodyHtml: args.bodyHtml,
      theme: (args.theme ?? {}) as Prisma.InputJsonValue,
      utmDefault: (args.utmDefault ?? {}) as Prisma.InputJsonValue,
      isPublished: args.isPublished ?? false,
      publishedAt: args.isPublished ? new Date() : null,
    },
  });
}

export async function updateLandingPage(args: {
  id: string;
  shopId: string;
  title?: string;
  headline?: string;
  subheadline?: string;
  heroImage?: string;
  bodyHtml?: string;
  theme?: Record<string, unknown>;
  utmDefault?: Record<string, unknown>;
  isPublished?: boolean;
}) {
  const existing = await prisma.landingPage.findFirst({
    where: { id: args.id, shopId: args.shopId },
  });
  if (!existing) throw new Error('Landing page not found');
  return prisma.landingPage.update({
    where: { id: args.id },
    data: {
      title: args.title ?? existing.title,
      headline: args.headline ?? existing.headline,
      subheadline: args.subheadline ?? existing.subheadline,
      heroImage: args.heroImage ?? existing.heroImage,
      bodyHtml: args.bodyHtml ?? existing.bodyHtml,
      theme: (args.theme ?? (existing.theme as Prisma.InputJsonValue)) as Prisma.InputJsonValue,
      utmDefault:
        (args.utmDefault ?? (existing.utmDefault as Prisma.InputJsonValue)) as Prisma.InputJsonValue,
      isPublished: args.isPublished ?? existing.isPublished,
      publishedAt:
        args.isPublished && !existing.publishedAt ? new Date() : existing.publishedAt,
    },
  });
}

export async function deleteLandingPage(shopId: string, id: string) {
  await prisma.landingPage.deleteMany({ where: { id, shopId } });
}

export async function recordLandingView(slug: string) {
  await prisma.landingPage.updateMany({
    where: { slug },
    data: { views: { increment: 1 } },
  });
}

export async function recordLandingConversion(slug: string) {
  await prisma.landingPage.updateMany({
    where: { slug },
    data: { conversions: { increment: 1 } },
  });
}
