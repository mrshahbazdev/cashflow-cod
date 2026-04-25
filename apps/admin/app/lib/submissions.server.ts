import type { Form, Shop } from '@prisma/client';
import type { Field, FormSchema } from '@cashflow-cod/form-schema';
import prisma from '../db.server';
import { createDraftOrderForSubmission } from './shopify-orders.server';
import { scoreRisk, recordRiskEvaluation, type RiskFeatures } from './risk.server';
import { markAbandonmentConverted } from './abandoned.server';
import { contextFromOrder, firePixelsForShop, type ClientTrackingContext } from './pixels.server';

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

    return {
      ok: true,
      submissionId: submission.id,
      orderId: null,
      requiresOtp: true,
      message: 'Please verify your phone number to complete the order.',
    };
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
    });
  } catch (err) {
    await prisma.submission.update({
      where: { id: submission.id },
      data: { status: 'PENDING' },
    });
    return {
      ok: false,
      error: `Could not create order: ${err instanceof Error ? err.message : 'Unknown error'}`,
    };
  }

  await prisma.submission.update({
    where: { id: submission.id },
    data: { status: 'CONVERTED' },
  });

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
