import type { Form, Shop } from '@prisma/client';
import type { Field, FormSchema } from '@cashflow-cod/form-schema';
import prisma from '../db.server';
import { createDraftOrderForSubmission } from './shopify-orders.server';
import { scoreRisk, recordRiskEvaluation, type RiskFeatures } from './risk.server';
import { markAbandonmentConverted } from './abandoned.server';
import { contextFromOrder, firePixelsForShop, type ClientTrackingContext } from './pixels.server';
import { dispatchSinkEvent } from './sinks';
import { dispatchWebhook } from './webhooks.server';
import { recordDiscountRedemption, validateDiscount } from './discounts.server';
import { bestQuantityDiscount } from './quantity-offers.server';
import { validatePostalCode } from './address.server';
import { sendWhatsAppOrderConfirmation } from './whatsapp-confirm.server';

type SubmitInput = {
  form: Form & { shop: Shop };
  schema: FormSchema;
  data: Record<string, unknown>;
  visitorId: string;
  ip: string | null;
  userAgent: string | null;
  abVariant: string | null;
  productId: string | null;
  variantId: string | null;
  tracking?: ClientTrackingContext;
  discountCode?: string | null;
  cartSubtotal?: number;
  quantity?: number;
  unitPrice?: number;
};

export type SubmitResult =
  | {
      ok: true;
      submissionId: string;
      orderId: string | null;
      requiresOtp: boolean;
      message?: string;
    }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

export async function submitForOrder(input: SubmitInput): Promise<SubmitResult> {
  const {
    form,
    schema,
    data,
    visitorId,
    ip,
    userAgent,
    abVariant,
    productId,
    variantId,
    tracking,
    discountCode,
    cartSubtotal,
    quantity,
    unitPrice,
  } = input;

  const allFields: Field[] = schema.steps.flatMap((s) => s.fields);
  const visible = allFields.filter((f) => fieldIsVisible(f, data));

  const fieldErrors: Record<string, string> = {};
  for (const f of visible) {
    const v = data[f.key];
    if (f.validation?.required && !hasValue(v)) {
      fieldErrors[f.key] = `${f.label || f.key} is required`;
      continue;
    }
    if (f.type === 'email' && hasValue(v) && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v))) {
      fieldErrors[f.key] = 'Invalid email';
    }
    if (f.type === 'phone' && hasValue(v) && !/^[+0-9()\-\s]{6,20}$/.test(String(v))) {
      fieldErrors[f.key] = 'Invalid phone number';
    }
  }
  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, error: 'Validation failed', fieldErrors };
  }

  const phoneField = allFields.find((f) => f.type === 'phone');
  const emailField = allFields.find((f) => f.type === 'email');
  const phone = phoneField ? (data[phoneField.key] as string | undefined) : undefined;
  const email = emailField ? (data[emailField.key] as string | undefined) : undefined;
  const phoneNormalized = phone ? normalizePhone(phone) : null;

  const blocked = await isBlocked(form.shopId, { phone: phoneNormalized, email, ip });
  if (blocked) {
    return { ok: false, error: 'This order cannot be placed. Please contact support.' };
  }

  const postalCodeValue =
    (allFields.find((f) => f.type === 'postal_code')?.key
      ? (data[allFields.find((f) => f.type === 'postal_code')!.key] as string)
      : null) ?? null;
  const countryValue =
    (allFields.find((f) => f.type === 'country')?.key
      ? (data[allFields.find((f) => f.type === 'country')!.key] as string)
      : null) ?? null;
  const postalCheck = validatePostalCode(countryValue, postalCodeValue);
  if (!postalCheck.ok) {
    return { ok: false, error: postalCheck.reason ?? 'Invalid postal code' };
  }

  const features = await buildRiskFeatures(form.shopId, {
    phone: phoneNormalized,
    ip,
    address:
      (allFields.find((f) => f.type === 'address')?.key
        ? (data[allFields.find((f) => f.type === 'address')!.key] as string)
        : null) ?? null,
    city:
      (allFields.find((f) => f.type === 'city')?.key
        ? (data[allFields.find((f) => f.type === 'city')!.key] as string)
        : null) ?? null,
    postalCode:
      (allFields.find((f) => f.type === 'postal_code')?.key
        ? (data[allFields.find((f) => f.type === 'postal_code')!.key] as string)
        : null) ?? null,
    country:
      (allFields.find((f) => f.type === 'country')?.key
        ? (data[allFields.find((f) => f.type === 'country')!.key] as string)
        : null) ?? null,
    userAgent,
  });
  const risk = await scoreRisk(features);
  const requiresOtp = shouldRequireOtp(form.shop, risk.score);

  const submission = await prisma.submission.create({
    data: {
      formId: form.id,
      visitorId,
      status: requiresOtp ? 'PENDING' : 'VERIFIED',
      fields: data as object,
      phone: phoneNormalized,
      email: email?.toLowerCase() ?? null,
      ipAddress: ip,
      userAgent,
      riskScore: risk.score,
      riskReasons: risk.reasons as object,
      requiresOtp,
      abVariant: abVariant ?? undefined,
    },
  });

  await recordRiskEvaluation({
    submissionId: submission.id,
    features,
    result: risk,
  });
  await markAbandonmentConverted(visitorId, form.id);

  if (requiresOtp) {
    // Pre-purchase intent: still fire InitiateCheckout for ad attribution.
    void firePixelsForShop({
      shopId: form.shopId,
      event: 'InitiateCheckout',
      ctx: {
        eventId: `init_${submission.id}`,
        eventTime: Date.now(),
        sourceUrl: tracking?.sourceUrl ?? `https://${form.shop.domain}/`,
        userAgent: userAgent ?? undefined,
        ip: ip ?? undefined,
        email: email?.toLowerCase(),
        phone: phoneNormalized ?? undefined,
        externalId: visitorId,
        fbp: tracking?.fbp,
        fbc: tracking?.fbc,
        ttclid: tracking?.ttclid,
        ttp: tracking?.ttp,
        scClickId: tracking?.scClickId,
        epik: tracking?.epik,
        currency: (form.shop.settings as Record<string, unknown> | null)?.currency as
          | string
          | undefined,
        contents: variantId
          ? [{ id: variantId, quantity: 1 }]
          : productId
            ? [{ id: productId, quantity: 1 }]
            : undefined,
      },
    });

    void dispatchSinkEvent(form.shopId, {
      kind: 'submission.created',
      submission,
      form,
      shop: form.shop,
    });
    void dispatchWebhook(form.shopId, {
      topic: 'submission.created',
      data: {
        submissionId: submission.id,
        formSlug: form.slug,
        email: submission.email,
        phone: submission.phone,
        riskScore: risk.score,
      },
    });

    return {
      ok: true,
      submissionId: submission.id,
      orderId: null,
      requiresOtp: true,
      message: 'Please verify your phone number to complete the order.',
    };
  }

  // Resolve any discount + quantity-ladder savings before creating the draft.
  let discountSummary: {
    id: string;
    code: string;
    type: string;
    amount: number;
    freeShipping: boolean;
  } | null = null;
  if (discountCode && cartSubtotal && cartSubtotal > 0) {
    const validated = await validateDiscount({
      shopId: form.shopId,
      code: discountCode,
      subtotal: cartSubtotal,
      productIds: productId ? [productId] : [],
      customerKey: phoneNormalized ?? email ?? null,
    });
    if (validated.ok) {
      discountSummary = {
        id: validated.discount.id,
        code: validated.discount.code,
        type: validated.discount.type,
        amount: validated.amount,
        freeShipping: validated.freeShipping,
      };
    }
  }
  let qtyDiscount: { description: string; amount: number } | null = null;
  if (quantity && quantity > 1 && unitPrice && unitPrice > 0) {
    const result = await bestQuantityDiscount({
      shopId: form.shopId,
      productId,
      variantId,
      quantity,
      unitPrice,
    });
    if (result.applied && result.rung) {
      qtyDiscount = {
        description: `Buy ${result.rung.minQuantity}+ → ${result.rung.discountValue}${result.rung.discountType === 'percent' ? '%' : ''} off`,
        amount: result.totalSavings,
      };
    }
  }

  let orderRow = null as Awaited<ReturnType<typeof createDraftOrderForSubmission>> | null;
  try {
    orderRow = await createDraftOrderForSubmission({
      shop: form.shop,
      form,
      submission,
      data,
      productId,
      variantId,
      discount: discountSummary,
      quantityDiscount: qtyDiscount,
    });
  } catch (err) {
    await prisma.submission.update({
      where: { id: submission.id },
      data: { status: 'PENDING' },
    });
    const raw = err instanceof Error ? err.message : 'Unknown error';
    // The Shopify Admin API now requires merchants to opt into "Protected
    // Customer Data Access" before any app can read/write a customer's
    // PII (name, phone, address) on draft orders. Without that approval
    // every draftOrderCreate mutation fails with a top-level 403 Forbidden
    // (not a userErrors entry). We return ok:true to the storefront so
    // the customer sees a success screen — the submission is safely
    // persisted as PENDING and the merchant can convert it to an order
    // by hand from the admin until they grant the data-access scope.
    const isForbidden = /403\s*Forbidden|GraphQL Client:\s*Forbidden/i.test(raw);
    if (isForbidden) {
      // eslint-disable-next-line no-console
      console.warn(
        `[Cashflow COD] Shopify order create blocked for shop ${form.shop.domain}: ` +
          `Protected Customer Data Access not granted. Submission ${submission.id} ` +
          `saved as PENDING. Merchant must approve customer-data access in the ` +
          `Partner dashboard (App setup → Customer data → Protected customer data).`,
      );
      // Dump the raw error and the shop's currently-stored offline session so
      // we can debug whether the access-token actually carries the expected
      // scopes after a reinstall.
      try {
        const session = await prisma.session.findFirst({
          where: { shop: form.shop.domain, isOnline: false },
          orderBy: { expires: 'desc' },
          select: { id: true, scope: true, expires: true, accessToken: true },
        });
        // eslint-disable-next-line no-console
        console.warn(
          `[Cashflow COD] 403 raw error: ${raw}\n` +
            `[Cashflow COD] offline session for ${form.shop.domain}: ` +
            `id=${session?.id ?? 'none'} ` +
            `scope=${session?.scope ?? 'none'} ` +
            `expires=${session?.expires?.toISOString() ?? 'none'} ` +
            `tokenLen=${session?.accessToken?.length ?? 0}`,
        );
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn(`[Cashflow COD] could not introspect session: ${String(e)}`);
      }
      return {
        ok: true,
        submissionId: submission.id,
        orderId: null,
        requiresOtp: false,
        message:
          'Order received. Our team will contact you shortly to confirm and dispatch.',
      };
    }
    return {
      ok: false,
      error: `Could not create order: ${raw}`,
    };
  }

  await prisma.submission.update({
    where: { id: submission.id },
    data: { status: 'CONVERTED' },
  });

  if (orderRow && discountSummary) {
    void recordDiscountRedemption({
      shopId: form.shopId,
      discountId: discountSummary.id,
      submissionId: submission.id,
      orderId: orderRow.id,
      amount: discountSummary.amount,
      customerKey: phoneNormalized ?? email ?? null,
    });
  }

  if (orderRow) {
    void firePixelsForShop({
      shopId: form.shopId,
      event: 'Purchase',
      ctx: contextFromOrder({
        order: orderRow,
        form,
        submission,
        client: {
          ...(tracking ?? {}),
          ip,
          userAgent,
          sourceUrl: tracking?.sourceUrl ?? `https://${form.shop.domain}/`,
        },
        productId,
        variantId,
      }),
    });
    void dispatchSinkEvent(form.shopId, {
      kind: 'order.placed',
      order: orderRow,
      submission,
      form,
      shop: form.shop,
    });
    void dispatchWebhook(form.shopId, {
      topic: 'order.placed',
      data: {
        orderId: orderRow.shopifyOrderId ?? orderRow.id,
        shopifyOrderId: orderRow.shopifyOrderId,
        total: orderRow.total,
        currency: orderRow.currency,
        customerName: orderRow.customerName,
        email: orderRow.email,
        phone: orderRow.phone,
        addressLine1: orderRow.addressLine1,
        city: orderRow.city,
        country: orderRow.country,
        postalCode: orderRow.postalCode,
        formSlug: form.slug,
      },
    });
  }

  if (orderRow && phoneNormalized) {
    const shopSettings = (form.shop.settings ?? {}) as Record<string, unknown>;
    const currencyStr = (shopSettings.currency as string) ?? 'PKR';
    void sendWhatsAppOrderConfirmation({
      shopId: form.shopId,
      phone: phoneNormalized,
      customerName: orderRow.customerName ?? undefined,
      orderId: orderRow.shopifyOrderId ?? orderRow.id,
      orderTotal: orderRow.total ? String(orderRow.total) : undefined,
      currency: currencyStr,
    });
  }

  return {
    ok: true,
    submissionId: submission.id,
    orderId: orderRow?.id ?? null,
    requiresOtp: false,
    message: 'Thanks! Your order has been placed.',
  };
}

function fieldIsVisible(field: Field, data: Record<string, unknown>): boolean {
  if (!field.conditions || field.conditions.length === 0) return true;
  return field.conditions.every((c) => {
    const v = data[c.fieldKey];
    switch (c.operator) {
      case 'eq':
        return String(v ?? '') === String(c.value ?? '');
      case 'neq':
        return String(v ?? '') !== String(c.value ?? '');
      case 'contains':
        return String(v ?? '').includes(String(c.value ?? ''));
      case 'in':
        return Array.isArray(c.value) && c.value.map(String).includes(String(v ?? ''));
      case 'not_in':
        return Array.isArray(c.value) && !c.value.map(String).includes(String(v ?? ''));
      case 'exists':
        return hasValue(v);
      default:
        return true;
    }
  });
}

function hasValue(v: unknown): boolean {
  if (v === null || v === undefined) return false;
  if (typeof v === 'string') return v.trim().length > 0;
  if (Array.isArray(v)) return v.length > 0;
  return true;
}

export function normalizePhone(raw: string): string {
  return raw.replace(/[^\d+]/g, '');
}

async function isBlocked(
  shopId: string,
  keys: { phone: string | null; email: string | null | undefined; ip: string | null },
): Promise<boolean> {
  const or: Array<Record<string, unknown>> = [];
  if (keys.phone) or.push({ type: 'PHONE' as const, value: keys.phone });
  if (keys.email) or.push({ type: 'EMAIL' as const, value: keys.email.toLowerCase() });
  if (keys.ip) or.push({ type: 'IP' as const, value: keys.ip });
  if (or.length === 0) return false;
  const hit = await prisma.blocklist.findFirst({
    where: { shopId, OR: or },
    select: { id: true },
  });
  return Boolean(hit);
}

async function buildRiskFeatures(
  shopId: string,
  keys: {
    phone: string | null;
    ip: string | null;
    address: string | null;
    city: string | null;
    postalCode: string | null;
    country: string | null;
    userAgent: string | null;
  },
): Promise<RiskFeatures> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [phoneCount, ipCount, prevOrders] = await Promise.all([
    keys.phone
      ? prisma.submission.count({
          where: { phone: keys.phone, createdAt: { gte: since }, form: { shopId } },
        })
      : Promise.resolve(0),
    keys.ip
      ? prisma.submission.count({
          where: { ipAddress: keys.ip, createdAt: { gte: since }, form: { shopId } },
        })
      : Promise.resolve(0),
    keys.phone
      ? prisma.order.findMany({
          where: { phoneNormalized: keys.phone, shopId },
          select: { disposition: true },
          take: 10,
        })
      : Promise.resolve([]),
  ]);
  const rtoPrev = prevOrders.filter((o) => o.disposition === 'RETURNED').length;
  const prevRtoRate = prevOrders.length ? rtoPrev / prevOrders.length : 0;

  const now = new Date();
  const ua = (keys.userAgent ?? '').toLowerCase();
  const deviceType = /mobile|android|iphone|ipad/.test(ua)
    ? 'mobile'
    : /tablet|ipad/.test(ua)
      ? 'tablet'
      : 'desktop';

  return {
    phone: keys.phone,
    ip: keys.ip,
    address: keys.address,
    city: keys.city,
    postalCode: keys.postalCode,
    country: keys.country,
    orderAmount: null,
    phoneVelocity24h: phoneCount,
    ipVelocity24h: ipCount,
    hourOfDay: now.getUTCHours(),
    dayOfWeek: (now.getUTCDay() + 6) % 7,
    deviceType,
    isRepeatCustomer: prevOrders.length > 0,
    prevRtoRate,
  };
}

function shouldRequireOtp(shop: Shop, riskScore: number): boolean {
  const settings = (shop.settings as Record<string, unknown>) ?? {};
  const otp = (settings.otp as Record<string, unknown>) ?? {};
  if (otp.enabled !== true) return false;
  const threshold = typeof otp.riskThreshold === 'number' ? otp.riskThreshold : 30;
  const alwaysRequire = otp.alwaysRequire === true;
  return alwaysRequire || riskScore >= threshold;
}
