import type { LoaderFunctionArgs } from '@remix-run/node';
import prisma from '../db.server';
import { corsHeaders, handleOptions } from '../lib/cors.server';

export async function loader({ request, params }: LoaderFunctionArgs) {
  if (request.method === 'OPTIONS') return handleOptions(request);
  const url = new URL(request.url);
  const shopDomain = url.searchParams.get('shop');
  const slug = params.formSlug;
  if (!shopDomain || !slug) {
    return new Response(JSON.stringify({ ok: false, error: 'Missing shop or slug' }), {
      status: 400,
      headers: { ...corsHeaders(request), 'Content-Type': 'application/json' },
    });
  }
  const shop = await prisma.shop.findUnique({ where: { domain: shopDomain } });
  if (!shop) {
    return new Response(JSON.stringify({ ok: false, error: 'Shop not found' }), {
      status: 404,
      headers: { ...corsHeaders(request), 'Content-Type': 'application/json' },
    });
  }
  const form = await prisma.form.findFirst({
    where: { shopId: shop.id, slug },
    select: { id: true },
  });
  if (!form) {
    return new Response(JSON.stringify({ ok: false, error: 'Form not found' }), {
      status: 404,
      headers: { ...corsHeaders(request), 'Content-Type': 'application/json' },
    });
  }
  const upsells = await prisma.upsell.findMany({
    where: { formId: form.id, isActive: true },
    orderBy: { position: 'asc' },
  });
  return new Response(JSON.stringify({ ok: true, upsells }), {
    status: 200,
    headers: { ...corsHeaders(request), 'Content-Type': 'application/json' },
  });
}
