import type {
  PixelAdapter,
  PixelCredentials,
  PixelEventContext,
  PixelFireResult,
  StandardEvent,
} from '../index.js';
import { normalizePhone, sha256 } from '../index.js';

const API_VERSION = 'v21.0';

/**
 * Meta (Facebook) Conversions API adapter.
 *
 * Required credentials:
 *   pixelId      — Meta Pixel ID (numeric)
 *   accessToken  — System User access token with `ads_management` scope
 *   testCode     — (optional) test_event_code for Meta Events Manager
 *
 * Reference: https://developers.facebook.com/docs/marketing-api/conversions-api
 */
export const metaAdapter: PixelAdapter = {
  provider: 'meta',
  displayName: 'Meta (Facebook) Conversions API',
  async fire(
    credentials: PixelCredentials,
    event: StandardEvent,
    ctx: PixelEventContext,
  ): Promise<PixelFireResult> {
    const { pixelId, accessToken, testCode } = credentials;
    if (!pixelId || !accessToken) {
      return { ok: false, error: 'Meta CAPI requires pixelId and accessToken' };
    }
    const userData: Record<string, unknown> = {};
    const em = sha256(ctx.email);
    const ph = sha256(normalizePhone(ctx.phone) ?? undefined);
    const fn = sha256(ctx.firstName);
    const ln = sha256(ctx.lastName);
    const ct = sha256(ctx.city);
    const country = sha256(ctx.country);
    const zp = sha256(ctx.postalCode);
    const externalId = sha256(ctx.externalId);
    if (em) userData.em = [em];
    if (ph) userData.ph = [ph];
    if (fn) userData.fn = [fn];
    if (ln) userData.ln = [ln];
    if (ct) userData.ct = [ct];
    if (country) userData.country = [country];
    if (zp) userData.zp = [zp];
    if (externalId) userData.external_id = [externalId];
    if (ctx.fbp) userData.fbp = ctx.fbp;
    if (ctx.fbc) userData.fbc = ctx.fbc;
    if (ctx.ip) userData.client_ip_address = ctx.ip;
    if (ctx.userAgent) userData.client_user_agent = ctx.userAgent;

    const customData: Record<string, unknown> = {};
    if (ctx.currency) customData.currency = ctx.currency;
    if (typeof ctx.value === 'number') customData.value = ctx.value;
    if (ctx.orderId) customData.order_id = ctx.orderId;
    if (ctx.contents?.length) {
      customData.contents = ctx.contents.map((c) => ({
        id: c.id,
        quantity: c.quantity,
        item_price: c.price,
      }));
      customData.content_type = 'product';
      customData.content_ids = ctx.contents.map((c) => c.id);
      customData.num_items = ctx.contents.reduce((sum, c) => sum + c.quantity, 0);
    }

    const payload: Record<string, unknown> = {
      data: [
        {
          event_name: event,
          event_time: Math.floor(ctx.eventTime / 1000),
          event_id: ctx.eventId,
          event_source_url: ctx.sourceUrl,
          action_source: 'website',
          user_data: userData,
          custom_data: customData,
        },
      ],
    };
    if (testCode) payload.test_event_code = testCode;

    const url = `https://graph.facebook.com/${API_VERSION}/${pixelId}/events?access_token=${encodeURIComponent(accessToken)}`;
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const body = (await res.json()) as { events_received?: number; error?: { message?: string } };
      if (!res.ok) {
        return { ok: false, error: body.error?.message ?? `HTTP ${res.status}`, raw: body };
      }
      return { ok: true, raw: body };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  },
};
