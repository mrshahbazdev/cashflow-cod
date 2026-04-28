import type {
  PixelAdapter,
  PixelCredentials,
  PixelEventContext,
  PixelFireResult,
  StandardEvent,
} from '../index.js';
import { normalizePhone, sha256 } from '../index.js';

/**
 * TikTok Events API adapter.
 *
 * Required credentials:
 *   pixelId     — TikTok Pixel Code
 *   accessToken — TikTok Business API long-lived access token
 *   testCode    — (optional) test_event_code
 *
 * Reference: https://business-api.tiktok.com/portal/docs?id=1771101027431425
 */
const EVENT_MAP: Record<StandardEvent, string> = {
  PageView: 'PageView',
  ViewContent: 'ViewContent',
  AddToCart: 'AddToCart',
  InitiateCheckout: 'InitiateCheckout',
  AddPaymentInfo: 'AddPaymentInfo',
  Purchase: 'CompletePayment',
};

export const tiktokAdapter: PixelAdapter = {
  provider: 'tiktok',
  displayName: 'TikTok Events API',
  async fire(
    credentials: PixelCredentials,
    event: StandardEvent,
    ctx: PixelEventContext,
  ): Promise<PixelFireResult> {
    const { pixelId, accessToken, testCode } = credentials;
    if (!pixelId || !accessToken) {
      return { ok: false, error: 'TikTok Events API requires pixelId and accessToken' };
    }

    const user: Record<string, unknown> = {};
    const em = sha256(ctx.email);
    const ph = sha256(normalizePhone(ctx.phone) ?? undefined);
    const ext = sha256(ctx.externalId);
    if (em) user.email = em;
    if (ph) user.phone = ph;
    if (ext) user.external_id = ext;
    if (ctx.ttclid) user.ttclid = ctx.ttclid;
    if (ctx.ttp) user.ttp = ctx.ttp;
    if (ctx.ip) user.ip = ctx.ip;
    if (ctx.userAgent) user.user_agent = ctx.userAgent;

    const properties: Record<string, unknown> = {};
    if (ctx.currency) properties.currency = ctx.currency;
    if (typeof ctx.value === 'number') properties.value = ctx.value;
    if (ctx.orderId) properties.order_id = ctx.orderId;
    if (ctx.contents?.length) {
      properties.contents = ctx.contents.map((c) => ({
        content_id: c.id,
        quantity: c.quantity,
        price: c.price,
        content_name: c.name,
      }));
      properties.content_type = 'product';
    }

    const payload = {
      event_source: 'web',
      event_source_id: pixelId,
      data: [
        {
          event: EVENT_MAP[event],
          event_time: Math.floor(ctx.eventTime / 1000),
          event_id: ctx.eventId,
          user,
          properties,
          page: { url: ctx.sourceUrl },
        },
      ],
      ...(testCode ? { test_event_code: testCode } : {}),
    };

    try {
      const res = await fetch('https://business-api.tiktok.com/open_api/v1.3/event/track/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Access-Token': accessToken },
        body: JSON.stringify(payload),
      });
      const body = (await res.json()) as { code?: number; message?: string };
      if (!res.ok || (typeof body.code === 'number' && body.code !== 0)) {
        return { ok: false, error: body.message ?? `HTTP ${res.status}`, raw: body };
      }
      return { ok: true, raw: body };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  },
};
