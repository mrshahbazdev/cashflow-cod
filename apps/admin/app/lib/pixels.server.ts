/**
 * Pixel event firing — server-side conversions API gateway.
 *
 * Loads active `Pixel` rows for a shop and fires a `StandardEvent` against
 * each provider's CAPI endpoint. Errors are isolated per provider so one
 * misconfigured pixel never blocks the others.
 */
import { pixelRegistry, type PixelEventContext, type StandardEvent } from '@cashflow-cod/pixels';
import type { Order, Form, Submission } from '@prisma/client';
import prisma from '../db.server';

export interface ClientTrackingContext {
  fbp?: string;
  fbc?: string;
  ttclid?: string;
  ttp?: string;
  scClickId?: string;
  epik?: string;
  ip?: string | null;
  userAgent?: string | null;
  sourceUrl?: string;
}

export interface FirePixelsArgs {
  shopId: string;
  event: StandardEvent;
  ctx: PixelEventContext;
}

interface FireSummary {
  provider: string;
  ok: boolean;
  error?: string;
}

/**
 * Fire a single event against every active pixel for a shop. Returns one
 * `FireSummary` per provider attempted (so callers can log failures).
 */
export async function firePixelsForShop(args: FirePixelsArgs): Promise<FireSummary[]> {
  const pixels = await prisma.pixel.findMany({
    where: { shopId: args.shopId, isActive: true, capiEnabled: true },
  });
  if (pixels.length === 0) return [];

  const results = await Promise.all(
    pixels.map(async (p): Promise<FireSummary> => {
      const adapter = pixelRegistry.get(p.provider as never);
      if (!adapter) {
        return { provider: p.provider, ok: false, error: 'No adapter registered' };
      }
      try {
        const out = await adapter.fire(
          {
            pixelId: p.pixelId,
            accessToken: p.accessToken ?? undefined,
            testCode: p.testCode ?? undefined,
          },
          args.event,
          args.ctx,
        );
        return { provider: p.provider, ok: out.ok, error: out.error };
      } catch (err) {
        return {
          provider: p.provider,
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    }),
  );

  // Best-effort logging: never throw out of pixel firing.
  for (const r of results) {
    if (!r.ok) {
      // eslint-disable-next-line no-console
      console.warn(`[pixels] ${r.provider} fire failed: ${r.error}`);
    }
  }
  return results;
}

/** Build a `PixelEventContext` from an Order + Form + Submission. */
export function contextFromOrder(args: {
  order: Order;
  form: Form;
  submission: Submission;
  client: ClientTrackingContext;
  productId: string | null;
  variantId: string | null;
}): PixelEventContext {
  const { order, form, submission, client, productId, variantId } = args;
  const data = (submission.fields as Record<string, unknown>) ?? {};
  const firstName = order.customerName?.split(/\s+/)[0];
  const lastName = order.customerName?.split(/\s+/).slice(1).join(' ');

  // Try to derive a content list from line items, falling back to product/variant id.
  const lineItems =
    (order.lineItems as Array<{ id?: string; quantity?: number; price?: number }>) ?? [];
  const contents = lineItems.length
    ? lineItems.map((li, idx) => ({
        id: li.id ?? variantId ?? productId ?? `${form.id}_${idx}`,
        quantity: typeof li.quantity === 'number' ? li.quantity : 1,
        price: typeof li.price === 'number' ? li.price : undefined,
      }))
    : [
        {
          id: variantId ?? productId ?? form.slug,
          quantity: 1,
          price: typeof order.subtotal === 'number' ? Number(order.subtotal) : undefined,
        },
      ];

  return {
    eventId: `purchase_${order.id}`,
    eventTime: order.createdAt.getTime(),
    sourceUrl:
      client.sourceUrl ??
      `https://${(form as unknown as { shop?: { domain?: string } }).shop?.domain ?? 'shop'}/`,
    userAgent: client.userAgent ?? undefined,
    ip: client.ip ?? undefined,
    email: order.email ?? undefined,
    phone: order.phoneNormalized ?? order.phone ?? undefined,
    externalId: submission.visitorId,
    fbp: client.fbp,
    fbc: client.fbc,
    ttclid: client.ttclid,
    ttp: client.ttp,
    scClickId: client.scClickId,
    epik: client.epik,
    currency: order.currency ?? undefined,
    value: typeof order.total === 'number' ? Number(order.total) : undefined,
    orderId: order.shopifyOrderId ?? order.id,
    contents,
    firstName,
    lastName,
    city: order.city ?? undefined,
    country: order.country ?? undefined,
    postalCode: order.postalCode ?? undefined,
    ...(typeof data === 'object' ? extractCustomFields(data) : {}),
  };
}

function extractCustomFields(data: Record<string, unknown>): Partial<PixelEventContext> {
  const out: Partial<PixelEventContext> = {};
  if (typeof data.first_name === 'string') out.firstName = data.first_name;
  if (typeof data.last_name === 'string') out.lastName = data.last_name;
  return out;
}
