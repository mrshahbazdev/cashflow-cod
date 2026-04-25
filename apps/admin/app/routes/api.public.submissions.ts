import type { ActionFunctionArgs } from '@remix-run/node';
import { json } from '@remix-run/node';
import { formSchema } from '@cashflow-cod/form-schema';
import prisma from '../db.server';
import { postOnlyLoader, preflight, withCors } from '../lib/cors.server';
import { resolveFormSlug } from '../lib/forms.server';
import { submitForOrder } from '../lib/submissions.server';

export const loader = postOnlyLoader;

export const action = async ({ request }: ActionFunctionArgs) => {
  if (request.method === 'OPTIONS') return preflight();
  if (request.method !== 'POST') {
    return withCors(json({ error: 'Method not allowed' }, { status: 405 }));
  }

  let body: {
    shop?: string;
    formSlug?: string;
    visitorId?: string;
    data?: Record<string, unknown>;
    abVariant?: string | null;
    productId?: string | null;
    variantId?: string | null;
    tracking?: {
      fbp?: string;
      fbc?: string;
      ttclid?: string;
      ttp?: string;
      scClickId?: string;
      epik?: string;
      sourceUrl?: string;
    };
    discountCode?: string | null;
    cartSubtotal?: number;
    quantity?: number;
    unitPrice?: number;
  };
  try {
    body = await request.json();
  } catch {
    return withCors(json({ error: 'Invalid JSON' }, { status: 400 }));
  }

  const { shop, formSlug, visitorId, data } = body;
  if (!shop || !formSlug || !data || typeof data !== 'object') {
    return withCors(json({ error: 'Missing required fields' }, { status: 400 }));
  }

  const resolvedSlug = await resolveFormSlug(shop, formSlug);
  const form = await prisma.form.findFirst({
    where: { slug: resolvedSlug, shop: { domain: shop }, isActive: true },
    include: { shop: true },
  });
  if (!form) {
    return withCors(json({ error: 'Form not found or inactive' }, { status: 404 }));
  }

  const parsedSchema = formSchema.safeParse(form.schema);
  if (!parsedSchema.success) {
    return withCors(json({ error: 'Form schema is invalid' }, { status: 500 }));
  }

  const xff = request.headers.get('x-forwarded-for') ?? '';
  const ip = xff.split(',')[0]?.trim() || null;
  const userAgent = request.headers.get('user-agent') || null;

  try {
    const result = await submitForOrder({
      form,
      schema: parsedSchema.data,
      data,
      visitorId: visitorId ?? cryptoRandomId(),
      ip,
      userAgent,
      abVariant: body.abVariant ?? null,
      productId: body.productId ?? null,
      variantId: body.variantId ?? null,
      tracking: body.tracking ? { ...body.tracking, ip, userAgent } : { ip, userAgent },
      discountCode: body.discountCode ?? null,
      cartSubtotal: body.cartSubtotal,
      quantity: body.quantity,
      unitPrice: body.unitPrice,
    });
    return withCors(json(result));
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return withCors(json({ ok: false, error: message }, { status: 400 }));
  }
};

function cryptoRandomId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `v_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}
