import type { SinkAdapter, SinkResult } from './types';

/**
 * Omnisend custom-events adapter.
 *
 * Pushes `placed_cod_order` / `started_cod_checkout` events into Omnisend
 * along with a minimal contact (email + phone). Omnisend auto-creates the
 * contact if it does not exist.
 *
 * Reference: https://api-docs.omnisend.com/reference/post_events
 */
export const omnisendSink: SinkAdapter = {
  provider: 'omnisend',
  displayName: 'Omnisend',
  credentialsHelp:
    'Omnisend API key (Store Settings → Integrations & API → API keys → Create API key)',
  credentialFields: [
    {
      key: 'apiKey',
      label: 'API key',
      type: 'password',
      required: true,
    },
  ],
  async fire(credentials, _settings, event): Promise<SinkResult> {
    const apiKey = (credentials.apiKey as string) ?? (credentials.api_key as string);
    if (!apiKey) return { ok: false, error: 'Omnisend apiKey missing' };

    let email: string | null = null;
    let phone: string | null = null;
    let eventName = 'cod_event';
    const fields: Record<string, unknown> = { kind: event.kind };

    if (event.kind === 'order.placed' || event.kind === 'order.disposition.changed') {
      const o = event.order;
      email = o.email ?? null;
      phone = o.phone ?? null;
      eventName = event.kind === 'order.placed' ? 'placed_cod_order' : 'cod_order_updated';
      fields.order_id = o.shopifyOrderId ?? o.id;
      fields.value = o.total;
      fields.currency = o.currency;
      fields.disposition = o.disposition;
    } else if (event.kind === 'submission.created') {
      email = event.submission.email ?? null;
      phone = event.submission.phone ?? null;
      eventName = 'started_cod_checkout';
      fields.submission_id = event.submission.id;
    }
    if (!email && !phone) {
      return { ok: false, error: 'No email or phone — Omnisend skipped' };
    }

    const payload = {
      eventID: `cf_${'submission' in event ? event.submission.id : Date.now()}`,
      eventName,
      contact: {
        ...(email ? { email } : {}),
        ...(phone ? { phone } : {}),
      },
      origin: 'api',
      properties: fields,
    };

    try {
      const res = await fetch('https://api.omnisend.com/v3/events', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-KEY': apiKey,
        },
        body: JSON.stringify(payload),
      });
      if (res.ok) return { ok: true, responseStatus: res.status };
      const text = await res.text();
      return { ok: false, error: text || `HTTP ${res.status}`, responseStatus: res.status };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  },
};
