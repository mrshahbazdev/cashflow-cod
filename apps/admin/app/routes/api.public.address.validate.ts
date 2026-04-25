/**
 * Public address validation endpoint. Called by the storefront widget when
 * the shopper finishes typing the address. Always returns ok=true on
 * upstream failures so we never block a COD checkout on third-party outages.
 */
import type { ActionFunctionArgs } from '@remix-run/node';
import { json } from '@remix-run/node';
import prisma from '../db.server';
import { postOnlyLoader, preflight, withCors } from '../lib/cors.server';
import {
  validatePostalCode,
  validateAddressViaProvider,
  type AddressInput,
} from '../lib/address.server';

export const loader = postOnlyLoader;

export const action = async ({ request }: ActionFunctionArgs) => {
  if (request.method === 'OPTIONS') return preflight();
  if (request.method !== 'POST') {
    return withCors(json({ error: 'Method not allowed' }, { status: 405 }));
  }
  let body: { shop?: string; address?: AddressInput };
  try {
    body = await request.json();
  } catch {
    return withCors(json({ ok: false, error: 'Invalid JSON' }, { status: 400 }));
  }
  const { shop, address } = body;
  if (!shop || !address) {
    return withCors(json({ ok: false, error: 'Missing fields' }, { status: 400 }));
  }
  const postal = validatePostalCode(address.country ?? null, address.postalCode ?? null);
  if (!postal.ok) {
    return withCors(json({ ok: false, postal: false, reason: postal.reason }, { status: 200 }));
  }
  const shopRow = await prisma.shop.findUnique({
    where: { domain: shop },
  });
  if (!shopRow) {
    return withCors(json({ ok: false, error: 'Unknown shop' }, { status: 404 }));
  }
  const provider = await validateAddressViaProvider(shopRow, address);
  return withCors(
    json({
      ok: provider.ok,
      postal: true,
      provider: provider.provider,
      reason: provider.reason,
      suggestion: provider.suggestion,
      normalized: { postalCode: postal.normalized },
    }),
  );
};
