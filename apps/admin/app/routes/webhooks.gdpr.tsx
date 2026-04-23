/**
 * Phase 4.5 — Shopify mandatory GDPR webhooks.
 *
 * Shopify sends the following topics to all public apps:
 *   - customers/data_request
 *   - customers/redact
 *   - shop/redact
 *
 * We persist each request to `GdprExport` and process it asynchronously. The
 * endpoint must respond 200 quickly to avoid retries.
 */
import type { ActionFunctionArgs } from '@remix-run/node';
import { json } from '@remix-run/node';
import { authenticate } from '../shopify.server';
import { getShopByDomain } from '../lib/install.server';
import {
  processGdprRequest,
  recordGdprRequest,
  type GdprKind,
  type GdprWebhookBody,
} from '../lib/gdpr.server';

function mapTopicToKind(topic: string): GdprKind | null {
  switch (topic) {
    case 'CUSTOMERS_DATA_REQUEST':
      return 'customer_data_request';
    case 'CUSTOMERS_REDACT':
      return 'customer_redact';
    case 'SHOP_REDACT':
      return 'shop_redact';
    default:
      return null;
  }
}

export const action = async ({ request }: ActionFunctionArgs) => {
  const { topic, shop, payload } = await authenticate.webhook(request);
  const kind = mapTopicToKind(topic);
  if (!kind) return new Response('Unsupported topic', { status: 400 });

  const shopRow = await getShopByDomain(shop);
  if (!shopRow) return new Response('Shop not found', { status: 404 });

  const body = payload as GdprWebhookBody;
  const record = await recordGdprRequest({
    shopId: shopRow.id,
    kind,
    customerId: body.customer?.email ?? body.customer?.phone,
    payload: body,
  });
  void processGdprRequest(record.id).catch(() => undefined);
  return json({ ok: true });
};
