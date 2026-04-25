/**
 * Outbound webhook delivery.
 *
 * Loads `WebhookSubscription` rows for a shop+topic and POSTs an HMAC-signed
 * payload to each URL. Every attempt is logged in `WebhookDelivery`, so
 * merchants can audit success/failure history from the admin UI.
 *
 * Signing scheme: `X-Cashflow-Signature: sha256=<hex(hmac_sha256(secret, body))>`,
 * matching Shopify's webhook signing convention.
 */
import { createHmac } from 'node:crypto';
import prisma from '../db.server';

export interface WebhookPayload {
  topic: string;
  data: Record<string, unknown>;
}

export async function dispatchWebhook(shopId: string, payload: WebhookPayload): Promise<void> {
  const subs = await prisma.webhookSubscription.findMany({
    where: { shopId, isActive: true, topic: payload.topic },
  });
  if (subs.length === 0) return;

  const body = JSON.stringify({
    topic: payload.topic,
    data: payload.data,
    sentAt: new Date().toISOString(),
  });

  await Promise.all(
    subs.map(async (sub) => {
      const signature = 'sha256=' + createHmac('sha256', sub.secret).update(body).digest('hex');
      const start = Date.now();
      let statusCode: number | null = null;
      let responseBody: string | null = null;
      let errorMessage: string | null = null;
      try {
        const res = await fetch(sub.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Cashflow-Topic': payload.topic,
            'X-Cashflow-Signature': signature,
          },
          body,
        });
        statusCode = res.status;
        responseBody = (await res.text().catch(() => null))?.slice(0, 1000) ?? null;
        if (!res.ok) errorMessage = `HTTP ${res.status}`;
      } catch (err) {
        errorMessage = err instanceof Error ? err.message : String(err);
      }
      const durationMs = Date.now() - start;
      const ok = !errorMessage;

      await Promise.all([
        prisma.webhookDelivery.create({
          data: {
            shopId,
            subscriptionId: sub.id,
            topic: payload.topic,
            url: sub.url,
            payload: payload.data as object,
            statusCode: statusCode ?? null,
            responseBody: responseBody ?? null,
            errorMessage: errorMessage ?? null,
            durationMs,
            deliveredAt: ok ? new Date() : null,
          },
        }),
        prisma.webhookSubscription.update({
          where: { id: sub.id },
          data: {
            lastDeliveryAt: new Date(),
            lastStatusCode: statusCode ?? null,
            failures: ok ? 0 : { increment: 1 },
          },
        }),
      ]).catch((err) => {
        // eslint-disable-next-line no-console
        console.warn('[webhooks] delivery log write failed:', err);
      });
    }),
  );
}
