import type { Form, Shop } from '@prisma/client';
import type { Field, FormSchema } from '@cashflow-cod/form-schema';
import prisma from '../db.server';
import { createDraftOrderForSubmission } from './shopify-orders.server';

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
  const { form, schema, data, visitorId, ip, userAgent, abVariant, productId, variantId } = input;

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

  const risk = await computeRiskScore(form.shopId, { phone: phoneNormalized, ip });
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

  if (requiresOtp) {
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

type RiskResult = { score: number; reasons: Array<{ code: string; message: string }> };

async function computeRiskScore(
  shopId: string,
  keys: { phone: string | null; ip: string | null },
): Promise<RiskResult> {
  const reasons: RiskResult['reasons'] = [];
  let score = 0;

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  if (keys.phone) {
    const count = await prisma.submission.count({
      where: {
        phone: keys.phone,
        createdAt: { gte: since },
        form: { shopId },
      },
    });
    if (count >= 3) {
      score += Math.min(50, count * 10);
      reasons.push({
        code: 'phone_velocity',
        message: `${count} submissions in 24h from this phone`,
      });
    }
  }
  if (keys.ip) {
    const count = await prisma.submission.count({
      where: {
        ipAddress: keys.ip,
        createdAt: { gte: since },
        form: { shopId },
      },
    });
    if (count >= 5) {
      score += Math.min(40, count * 5);
      reasons.push({ code: 'ip_velocity', message: `${count} submissions in 24h from this IP` });
    }
  }

  return { score: Math.min(100, score), reasons };
}

function shouldRequireOtp(shop: Shop, riskScore: number): boolean {
  const settings = (shop.settings as Record<string, unknown>) ?? {};
  const otp = (settings.otp as Record<string, unknown>) ?? {};
  if (otp.enabled !== true) return false;
  const threshold = typeof otp.riskThreshold === 'number' ? otp.riskThreshold : 30;
  const alwaysRequire = otp.alwaysRequire === true;
  return alwaysRequire || riskScore >= threshold;
}
