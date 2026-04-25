import type { SinkAdapter, SinkResult } from './types';

/**
 * Klaviyo events adapter.
 *
 * Uses the Klaviyo Events API (revision 2024-10-15). On `order.placed` we
 * push a "Placed COD Order" event with order_id, value, and a basic profile
 * (email/phone). Klaviyo will create or update the profile automatically.
 *
 * Reference: https://developers.klaviyo.com/en/reference/create_event
 */
const REVISION = '2024-10-15';

export const klaviyoSink: SinkAdapter = {
  provider: 'klaviyo',
  displayName: 'Klaviyo',
  credentialsHelp: 'Klaviyo Private API Key (Account → Settings → API Keys → Private)',
  credentialFields: [
    {
      key: 'apiKey',
      label: 'Private API key',
      type: 'password',
      required: true,
      placeholder: 'pk_…',
    },
  ],
  async fire(credentials, _settings, event): Promise<SinkResult> {
    const apiKey = (credentials.apiKey as string) ?? (credentials.api_key as string);
    if (!apiKey) return { ok: false, error: 'Klaviyo apiKey missing' };
    const eventName =
      event.kind === 'order.placed'
        ? 'Placed COD Order'
        : event.kind === 'submission.created'
          ? 'Started Checkout'
          : 'COD Order Updated';

    const profile: Record<string, unknown> = {};
    if (event.kind === 'order.placed' || event.kind === 'order.disposition.changed') {
      const o = event.order;
      if (o.email) profile.email = o.email;
      if (o.phone) profile.phone_number = o.phone;
      if (o.customerName) {
        const [first, ...rest] = o.customerName.split(/\s+/);
        if (first) profile.first_name = first;
        if (rest.length) profile.last_name = rest.join(' ');
      }
    } else if (event.kind === 'submission.created') {
      if (event.submission.email) profile.email = event.submission.email;
      if (event.submission.phone) profile.phone_number = event.submission.phone;
    }
    if (!profile.email && !profile.phone_number) {
      return { ok: false, error: 'No email or phone available — Klaviyo skipped' };
    }

    const properties: Record<string, unknown> = { kind: event.kind };
    let value = 0;
    let orderId: string | undefined;
    if (event.kind === 'order.placed' || event.kind === 'order.disposition.changed') {
      const o = event.order;
      orderId = o.shopifyOrderId ?? o.id;
      value = typeof o.total === 'number' ? Number(o.total) : 0;
      properties.order_id = orderId;
      properties.disposition = o.disposition;
      properties.shopify_order_id = o.shopifyOrderId;
      properties.line_items = o.lineItems;
      if (o.currency) properties.currency = o.currency;
    } else {
      properties.submission_id = event.submission.id;
    }

    const payload = {
      data: {
        type: 'event',
        attributes: {
          properties,
          metric: { data: { type: 'metric', attributes: { name: eventName } } },
          profile: { data: { type: 'profile', attributes: profile } },
          unique_id:
            orderId ?? `submission_${'submission' in event ? event.submission.id : Date.now()}`,
          ...(orderId ? { value, value_currency: properties.currency ?? 'USD' } : {}),
        },
      },
    };

    try {
      const res = await fetch('https://a.klaviyo.com/api/events/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          accept: 'application/json',
          revision: REVISION,
          Authorization: `Klaviyo-API-Key ${apiKey}`,
        },
        body: JSON.stringify(payload),
      });
      if (res.status === 202) return { ok: true, responseStatus: 202 };
      if (res.ok) return { ok: true, responseStatus: res.status };
      const text = await res.text();
      return { ok: false, error: text || `HTTP ${res.status}`, responseStatus: res.status };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  },
};
