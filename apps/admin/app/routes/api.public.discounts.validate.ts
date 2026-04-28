/**
 * Public discount validate endpoint, called by the storefront widget when a
 * customer enters a code. Always responds with CORS headers so it can be
 * called from the merchant's storefront origin.
 */
import type { ActionFunctionArgs } from '@remix-run/node';
import { json } from '@remix-run/node';
import prisma from '../db.server';
import { postOnlyLoader, preflight, withCors } from '../lib/cors.server';
import { validateDiscount } from '../lib/discounts.server';

export const loader = postOnlyLoader;

export const action = async ({ request }: ActionFunctionArgs) => {
  if (request.method === 'OPTIONS') return preflight();
  if (request.method !== 'POST') {
    return withCors(json({ error: 'Method not allowed' }, { status: 405 }));
  }
  let body: {
    shop?: string;
    code?: string;
    subtotal?: number;
    productIds?: string[];
    customerKey?: string;
  };
  try {
    body = await request.json();
  } catch {
    return withCors(json({ error: 'Invalid JSON' }, { status: 400 }));
  }
  const { shop, code, subtotal, productIds, customerKey } = body;
  if (!shop || !code || typeof subtotal !== 'number') {
    return withCors(json({ ok: false, error: 'Missing required fields' }, { status: 400 }));
  }
  const shopRow = await prisma.shop.findUnique({ where: { domain: shop }, select: { id: true } });
  if (!shopRow) {
    return withCors(json({ ok: false, error: 'Unknown shop' }, { status: 404 }));
  }
  const result = await validateDiscount({
    shopId: shopRow.id,
    code,
    subtotal,
    productIds: productIds ?? [],
    customerKey: customerKey ?? null,
  });
  if (!result.ok) {
    return withCors(json({ ok: false, reason: result.reason, error: result.message }));
  }
  return withCors(
    json({
      ok: true,
      discount: {
        code: result.discount.code,
        type: result.discount.type,
        value: Number(result.discount.value),
        amount: result.amount,
        freeShipping: result.freeShipping,
      },
    }),
  );
};
