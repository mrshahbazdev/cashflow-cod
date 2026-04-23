/**
 * Phase 3.5 — Form template marketplace.
 * Seed catalog of industry/region templates. Merchants clone a template into
 * their own Form row with a fresh slug.
 */
import type { Prisma } from '@prisma/client';
import { nanoid } from 'nanoid';
import prisma from '../db.server';

export async function listTemplates(args?: {
  category?: string;
  region?: string;
  featuredOnly?: boolean;
}) {
  return prisma.formTemplate.findMany({
    where: {
      category: args?.category,
      region: args?.region,
      isFeatured: args?.featuredOnly ? true : undefined,
    },
    orderBy: [{ isFeatured: 'desc' }, { installCount: 'desc' }, { name: 'asc' }],
  });
}

export async function getTemplate(slug: string) {
  return prisma.formTemplate.findUnique({ where: { slug } });
}

export async function installTemplate(args: {
  shopId: string;
  templateSlug: string;
  name?: string;
}): Promise<{ formId: string; slug: string }> {
  const tpl = await prisma.formTemplate.findUnique({ where: { slug: args.templateSlug } });
  if (!tpl) throw new Error('Template not found');
  const baseSlug = slugify(args.name ?? tpl.name);
  const slug = `${baseSlug}-${nanoid(6).toLowerCase()}`;
  const form = await prisma.form.create({
    data: {
      shopId: args.shopId,
      name: args.name ?? tpl.name,
      slug,
      schema: tpl.schema as Prisma.InputJsonValue,
      placement: 'product',
    },
  });
  await prisma.formTemplate.update({
    where: { id: tpl.id },
    data: { installCount: { increment: 1 } },
  });
  return { formId: form.id, slug: form.slug };
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}
