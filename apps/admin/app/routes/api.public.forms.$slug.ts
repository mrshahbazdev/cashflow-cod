import type { LoaderFunctionArgs, ActionFunctionArgs } from '@remix-run/node';
import { json } from '@remix-run/node';
import { getFormBySlug } from '../lib/forms.server';
import { preflight, withCors } from '../lib/cors.server';
import prisma from '../db.server';
import { assignVariant, recordView, type Variant } from '../lib/ab-testing.server';

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  if (request.method === 'OPTIONS') return preflight();
  const url = new URL(request.url);
  const shop = url.searchParams.get('shop');
  const slug = params.slug;
  const visitorId = url.searchParams.get('visitor') ?? '';
  if (!shop || !slug) {
    return withCors(
      json({ error: 'Query params `shop` and `slug` are required' }, { status: 400 }),
    );
  }
  const form = await getFormBySlug(shop, slug);
  if (!form) {
    return withCors(json({ error: 'Form not found or inactive' }, { status: 404 }));
  }

  let abVariant: string | null = null;
  let abSchemaOverride: Record<string, unknown> | null = null;
  if (visitorId) {
    const activeTest = await prisma.aBTest.findFirst({
      where: { entityId: form.id, entityType: 'form', status: 'running' },
    });
    if (activeTest) {
      const variants = (activeTest.variants as unknown as Variant[]) ?? [];
      const assigned = assignVariant(variants, visitorId, activeTest.id);
      if (assigned) {
        abVariant = assigned.key;
        abSchemaOverride = assigned.schemaOverride ?? null;
        void recordView(activeTest.id, assigned.key);
      }
    }
  }

  return withCors(json({ form, abVariant, abSchemaOverride }));
};

export const action = async ({ request }: ActionFunctionArgs) => {
  if (request.method === 'OPTIONS') return preflight();
  return withCors(json({ error: 'Method not allowed' }, { status: 405 }));
};
