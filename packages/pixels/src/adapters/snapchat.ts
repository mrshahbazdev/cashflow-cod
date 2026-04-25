import type {
  PixelAdapter,
  PixelCredentials,
  PixelEventContext,
  PixelFireResult,
  StandardEvent,
} from '../index.js';
import { normalizePhone, sha256 } from '../index.js';

/**
 * Snapchat Conversions API adapter.
 *
 * Required credentials:
 *   pixelId     — Snap Pixel ID
 *   accessToken — Snap Conversions API token (long-lived OAuth token)
 *   testCode    — (optional) test_event_code
 *
 * Reference: https://marketingapi.snapchat.com/docs/conversion.html
 */
const EVENT_MAP: Record<StandardEvent, string> = {
  PageView: 'PAGE_VIEW',
  ViewContent: 'VIEW_CONTENT',
  AddToCart: 'ADD_CART',
  InitiateCheckout: 'START_CHECKOUT',
  AddPaymentInfo: 'ADD_BILLING',
  Purchase: 'PURCHASE',
};

export const snapchatAdapter: PixelAdapter = {
  provider: 'snapchat',
  displayName: 'Snap Conversions API',
  async fire(
    credentials: PixelCredentials,
    event: StandardEvent,
    ctx: PixelEventContext,
  ): Promise<PixelFireResult> {
    const { pixelId, accessToken, testCode } = credentials;
    if (!pixelId || !accessToken) {
      return { ok: false, error: 'Snap CAPI requires pixelId and accessToken' };
    }

    const userData: Record<string, unknown> = {};
    const em = sha256(ctx.email);
    const ph = sha256(normalizePhone(ctx.phone) ?? undefined);
    const ext = sha256(ctx.externalId);
    if (em) userData.em = [em];
    if (ph) userData.ph = [ph];
    if (ext) userData.external_id = [ext];
    if (ctx.scClickId) userData.sc_click_id = ctx.scClickId;
    if (ctx.ip) userData.client_ip_address = ctx.ip;
    if (ctx.userAgent) userData.client_user_agent = ctx.userAgent;

    const customData: Record<string, unknown> = {};
    if (ctx.currency) customData.currency = ctx.currency;
    if (typeof ctx.value === 'number') customData.value = ctx.value;
    if (ctx.orderId) customData.order_id = ctx.orderId;
    if (ctx.contents?.length) {
      customData.content_ids = ctx.contents.map((c) => c.id);
      customData.num_items = ctx.contents.reduce((sum, c) => sum + c.quantity, 0);
    }

    const payload = {
      data: [
        {
          event_name: EVENT_MAP[event],
          event_time: Math.floor(ctx.eventTime / 1000),
          event_id: ctx.eventId,
          event_source_url: ctx.sourceUrl,
          action_source: 'website',
          user_data: userData,
          custom_data: customData,
        },
      ],
      ...(testCode ? { test_event_code: testCode } : {}),
    };

    try {
      const url = `https://tr.snapchat.com/v3/${encodeURIComponent(pixelId)}/events?access_token=${encodeURIComponent(accessToken)}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const body = (await res.json().catch(() => ({}))) as {
        events_received?: number;
        error_message?: string;
      };
      if (!res.ok) {
        return { ok: false, error: body.error_message ?? `HTTP ${res.status}`, raw: body };
      }
      return { ok: true, raw: body };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  },
};
