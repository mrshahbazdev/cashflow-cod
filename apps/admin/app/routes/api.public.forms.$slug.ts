import type { LoaderFunctionArgs, ActionFunctionArgs } from '@remix-run/node';
import { json } from '@remix-run/node';
import { getFormBySlug } from '../lib/forms.server';
import { preflight, withCors } from '../lib/cors.server';

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  if (request.method === 'OPTIONS') return preflight();
  const url = new URL(request.url);
  const shop = url.searchParams.get('shop');
  const slug = params.slug;
  if (!shop || !slug) {
    return withCors(
      json({ error: 'Query params `shop` and `slug` are required' }, { status: 400 }),
    );
  }
  const form = await getFormBySlug(shop, slug);
  if (!form) {
    return withCors(json({ error: 'Form not found or inactive' }, { status: 404 }));
  }
  return withCors(json({ form }));
};

export const action = async ({ request }: ActionFunctionArgs) => {
  if (request.method === 'OPTIONS') return preflight();
  return withCors(json({ error: 'Method not allowed' }, { status: 405 }));
};
