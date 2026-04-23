import type { ActionFunctionArgs } from '@remix-run/node';
import { z } from 'zod';
import prisma from '../db.server';
import { corsHeaders, handleOptions } from '../lib/cors.server';
import { recordAbandonment } from '../lib/abandoned.server';

const bodySchema = z.object({
  formSlug: z.string(),
  shop: z.string(),
  visitorId: z.string().min(1),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  partialData: z.record(z.unknown()).default({}),
  lastStep: z.string().optional(),
});

export async function loader({ request }: ActionFunctionArgs) {
  if (request.method === 'OPTIONS') return handleOptions(request);
  return new Response('Method not allowed', { status: 405, headers: corsHeaders(request) });
}

export async function action({ request }: ActionFunctionArgs) {
  if (request.method === 'OPTIONS') return handleOptions(request);
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders(request) });
  }
  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await request.json());
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: String(err) }), {
      status: 400,
      headers: { ...corsHeaders(request), 'Content-Type': 'application/json' },
    });
  }

  const shop = await prisma.shop.findUnique({ where: { domain: body.shop } });
  if (!shop) {
    return new Response(JSON.stringify({ ok: false, error: 'Shop not found' }), {
      status: 404,
      headers: { ...corsHeaders(request), 'Content-Type': 'application/json' },
    });
  }
  const form = await prisma.form.findFirst({
    where: { shopId: shop.id, slug: body.formSlug },
    select: { id: true },
  });
  if (!form) {
    return new Response(JSON.stringify({ ok: false, error: 'Form not found' }), {
      status: 404,
      headers: { ...corsHeaders(request), 'Content-Type': 'application/json' },
    });
  }

  const rec = await recordAbandonment({
    formId: form.id,
    visitorId: body.visitorId,
    phone: body.phone ?? null,
    email: body.email ?? null,
    partialData: body.partialData,
    lastStep: body.lastStep ?? null,
  });

  return new Response(JSON.stringify({ ok: true, id: rec.id, token: rec.token }), {
    status: 200,
    headers: { ...corsHeaders(request), 'Content-Type': 'application/json' },
  });
}
