import type { ActionFunctionArgs } from '@remix-run/node';
import { z } from 'zod';
import prisma from '../db.server';
import { corsHeaders, handleOptions } from '../lib/cors.server';
import { recordAbandonment } from '../lib/abandoned.server';
import { resolveFormSlug } from '../lib/forms.server';

// Storefront widget sends empty optional fields as `null` (rather than
// omitting the key) — accept null and empty string as "absent".
const optionalString = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((v) => (v == null || v === '' ? undefined : v));

const optionalEmail = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((v) => (v == null || v === '' ? undefined : v))
  .refine(
    (v) => v === undefined || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
    { message: 'Invalid email' },
  );

const bodySchema = z.object({
  formSlug: z.string(),
  shop: z.string(),
  visitorId: z.string().min(1),
  phone: optionalString,
  email: optionalEmail,
  partialData: z.record(z.unknown()).default({}),
  lastStep: optionalString,
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
  const resolvedSlug = await resolveFormSlug(body.shop, body.formSlug);
  const form = await prisma.form.findFirst({
    where: { shopId: shop.id, slug: resolvedSlug },
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
