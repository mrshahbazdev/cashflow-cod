import { defaultFormSchema, formSchema, type FormSchema } from '@cashflow-cod/form-schema';
import type { FormLayout } from '@prisma/client';
import prisma from '../db.server';
import { markOnboardingStep } from './install.server';

export async function listForms(shopId: string) {
  return prisma.form.findMany({
    where: { shopId },
    orderBy: [{ isActive: 'desc' }, { updatedAt: 'desc' }],
    select: {
      id: true,
      name: true,
      slug: true,
      layout: true,
      placement: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
      _count: { select: { submissions: true, views: true } },
    },
  });
}

export async function getForm(shopId: string, id: string) {
  return prisma.form.findFirst({ where: { id, shopId } });
}

export async function getFormBySlug(shopDomain: string, slug: string) {
  return prisma.form.findFirst({
    where: {
      slug,
      shop: { domain: shopDomain },
      isActive: true,
    },
    select: {
      id: true,
      name: true,
      slug: true,
      layout: true,
      placement: true,
      schema: true,
    },
  });
}

function slugify(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

export async function createForm(shopDomain: string, shopId: string, name: string) {
  const base = slugify(name) || 'cod-form';
  let slug = base;
  let i = 1;
  while (await prisma.form.findFirst({ where: { shopId, slug } })) {
    slug = `${base}-${i++}`;
  }

  const form = await prisma.form.create({
    data: {
      shopId,
      name: name.trim() || 'Untitled form',
      slug,
      schema: defaultFormSchema as unknown as object,
      isActive: false,
    },
  });

  await markOnboardingStep(shopDomain, 'firstFormCreated', true);
  return form;
}

export type UpdateFormInput = {
  name?: string;
  slug?: string;
  layout?: FormLayout;
  placement?: string;
  isActive?: boolean;
  schema?: FormSchema;
};

export async function updateForm(shopId: string, id: string, input: UpdateFormInput) {
  const data: Record<string, unknown> = {};
  if (input.name !== undefined) data.name = input.name.trim() || 'Untitled form';
  if (input.slug !== undefined) {
    const nextSlug = slugify(input.slug);
    if (!nextSlug) throw new Error('Slug cannot be empty');
    data.slug = nextSlug;
  }
  if (input.layout !== undefined) data.layout = input.layout;
  if (input.placement !== undefined) data.placement = input.placement;
  if (input.isActive !== undefined) data.isActive = input.isActive;
  if (input.schema !== undefined) {
    const parsed = formSchema.safeParse(input.schema);
    if (!parsed.success) {
      throw new Error(
        `Invalid form schema: ${parsed.error.issues.map((i) => i.message).join('; ')}`,
      );
    }
    data.schema = parsed.data as unknown as object;
  }

  return prisma.form.update({
    where: { id, shopId },
    data,
  });
}

export async function deleteForm(shopId: string, id: string) {
  await prisma.form.delete({ where: { id, shopId } });
}

export async function duplicateForm(shopId: string, id: string) {
  const src = await prisma.form.findFirst({ where: { id, shopId } });
  if (!src) throw new Error('Form not found');
  const base = `${src.slug}-copy`;
  let slug = base;
  let i = 1;
  while (await prisma.form.findFirst({ where: { shopId, slug } })) {
    slug = `${base}-${i++}`;
  }
  return prisma.form.create({
    data: {
      shopId,
      name: `${src.name} (copy)`,
      slug,
      schema: src.schema as unknown as object,
      layout: src.layout,
      placement: src.placement,
      isActive: false,
    },
  });
}
