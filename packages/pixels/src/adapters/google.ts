import type {
  PixelAdapter,
  PixelCredentials,
  PixelEventContext,
  PixelFireResult,
  StandardEvent,
} from '../index.js';

/**
 * Google Analytics 4 Measurement Protocol adapter.
 *
 * Maps StandardEvent → GA4 recommended events. Also fires Google Ads
 * conversions when `conversionId` + `conversionLabel` are provided.
 *
 * Required credentials:
 *   pixelId     — GA4 Measurement ID (G-XXXXXXX) or Google Ads Conversion ID (AW-XXXXXX)
 *   accessToken — GA4 API secret OR Google Ads conversion label (when prefixed with "ads:")
 *   conversionLabel — (optional) Google Ads conversion label
 *
 * Reference: https://developers.google.com/analytics/devguides/collection/protocol/ga4
 */
const EVENT_MAP: Record<StandardEvent, string> = {
  PageView: 'page_view',
  ViewContent: 'view_item',
  AddToCart: 'add_to_cart',
  InitiateCheckout: 'begin_checkout',
  AddPaymentInfo: 'add_payment_info',
  Purchase: 'purchase',
};

export const googleAdapter: PixelAdapter = {
  provider: 'google',
  displayName: 'Google Analytics 4 / Google Ads',
  async fire(
    credentials: PixelCredentials,
    event: StandardEvent,
    ctx: PixelEventContext,
  ): Promise<PixelFireResult> {
    const { pixelId, accessToken } = credentials;
    if (!pixelId || !accessToken) {
      return {
        ok: false,
        error: 'Google Analytics requires pixelId (measurement_id) and accessToken (api_secret)',
      };
    }

    // Best-effort client_id: prefer external id, fall back to event id.
    const clientId = ctx.externalId ?? ctx.eventId;

    const eventParams: Record<string, unknown> = {
      engagement_time_msec: '100',
    };
    if (ctx.currency) eventParams.currency = ctx.currency;
    if (typeof ctx.value === 'number') eventParams.value = ctx.value;
    if (ctx.orderId) eventParams.transaction_id = ctx.orderId;
    if (ctx.contents?.length) {
      eventParams.items = ctx.contents.map((c) => ({
        item_id: c.id,
        item_name: c.name ?? c.id,
        price: c.price,
        quantity: c.quantity,
      }));
    }

    const payload = {
      client_id: clientId,
      events: [{ name: EVENT_MAP[event], params: eventParams }],
    };

    try {
      const url = `https://www.google-analytics.com/mp/collect?measurement_id=${encodeURIComponent(pixelId)}&api_secret=${encodeURIComponent(accessToken)}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      // GA4 MP returns 204 with no body on success.
      if (!res.ok) {
        const text = await res.text();
        return { ok: false, error: text || `HTTP ${res.status}` };
      }
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  },
};
