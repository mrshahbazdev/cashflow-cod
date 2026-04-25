import type {
  PixelAdapter,
  PixelCredentials,
  PixelEventContext,
  PixelFireResult,
  StandardEvent,
} from '../index.js';
import { normalizePhone, sha256 } from '../index.js';

/**
 * Pinterest Conversions API adapter.
 *
 * Required credentials:
 *   pixelId       — Pinterest Ad Account ID
 *   accessToken   — Long-lived Conversions API token (Bearer)
 *   tagId         — (optional) Pinterest Tag ID — preferred over ad_account when provided
 *   testCode      — (optional) Mark events as test (`test_metadata`)
 *
 * Reference: https://developers.pinterest.com/docs/api/v5/events-create
 */
const EVENT_MAP: Record<StandardEvent, string> = {
  PageView: 'page_visit',
  ViewContent: 'view_category',
  AddToCart: 'add_to_cart',
  InitiateCheckout: 'checkout',
  AddPaymentInfo: 'checkout',
  Purchase: 'checkout',
};

export const pinterestAdapter: PixelAdapter = {
  provider: 'pinterest',
  displayName: 'Pinterest Conversions API',
  async fire(
    credentials: PixelCredentials,
    event: StandardEvent,
    ctx: PixelEventContext,
  ): Promise<PixelFireResult> {
    const { pixelId, accessToken, testCode } = credentials;
    if (!pixelId || !accessToken) {
      return {
        ok: false,
        error: 'Pinterest CAPI requires pixelId (ad_account_id) and accessToken',
      };
    }

    const userData: Record<string, unknown> = {};
    const em = sha256(ctx.email);
    const ph = sha256(normalizePhone(ctx.phone) ?? undefined);
    const ext = sha256(ctx.externalId);
    if (em) userData.em = [em];
    if (ph) userData.ph = [ph];
    if (ext) userData.external_id = [ext];
    if (ctx.epik) userData.click_id = ctx.epik;
    if (ctx.ip) userData.client_ip_address = ctx.ip;
    if (ctx.userAgent) userData.client_user_agent = ctx.userAgent;

    const customData: Record<string, unknown> = {};
    if (ctx.currency) customData.currency = ctx.currency;
    if (typeof ctx.value === 'number') customData.value = String(ctx.value);
    if (ctx.orderId) customData.order_id = ctx.orderId;
    if (ctx.contents?.length) {
      customData.content_ids = ctx.contents.map((c) => c.id);
      customData.num_items = ctx.contents.reduce((sum, c) => sum + c.quantity, 0);
      customData.contents = ctx.contents.map((c) => ({
        id: c.id,
        quantity: c.quantity,
        item_price: c.price?.toString(),
      }));
    }

    const payload = {
      data: [
        {
          event_name: EVENT_MAP[event],
          action_source: 'web',
          event_time: Math.floor(ctx.eventTime / 1000),
          event_id: ctx.eventId,
          event_source_url: ctx.sourceUrl,
          user_data: userData,
          custom_data: customData,
        },
      ],
      ...(testCode ? { test: true } : {}),
    };

    try {
      const url = `https://api.pinterest.com/v5/ad_accounts/${encodeURIComponent(pixelId)}/events`;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(payload),
      });
      const body = (await res.json().catch(() => ({}))) as {
        num_events_received?: number;
        message?: string;
      };
      if (!res.ok) {
        return { ok: false, error: body.message ?? `HTTP ${res.status}`, raw: body };
      }
      return { ok: true, raw: body };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  },
};
