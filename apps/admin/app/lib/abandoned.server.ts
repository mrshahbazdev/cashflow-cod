/**
 * Phase 2.5 — Abandoned form recovery.
 * When a visitor types a phone/email but doesn't submit, we persist a partial record
 * keyed by visitorId. A background job (or manual trigger) then messages them with a
 * deep-link token that pre-fills the form.
 */
import { randomBytes } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import prisma from '../db.server';

export async function recordAbandonment(args: {
  formId: string;
  visitorId: string;
  phone?: string | null;
  email?: string | null;
  partialData: Record<string, unknown>;
  lastStep?: string | null;
}): Promise<{ id: string; token: string }> {
  const existing = await prisma.abandonedForm.findFirst({
    where: { formId: args.formId, visitorId: args.visitorId, convertedAt: null },
  });
  const token = existing?.recoveryToken ?? randomBytes(16).toString('hex');
  const row = existing
    ? await prisma.abandonedForm.update({
        where: { id: existing.id },
        data: {
          phone: args.phone ?? existing.phone,
          email: args.email?.toLowerCase() ?? existing.email,
          partialData: args.partialData as Prisma.InputJsonValue,
          lastStep: args.lastStep ?? existing.lastStep,
        },
      })
    : await prisma.abandonedForm.create({
        data: {
          formId: args.formId,
          visitorId: args.visitorId,
          phone: args.phone ?? null,
          email: args.email?.toLowerCase() ?? null,
          partialData: args.partialData as Prisma.InputJsonValue,
          lastStep: args.lastStep ?? null,
          recoveryToken: token,
        },
      });
  return { id: row.id, token: row.recoveryToken };
}

export async function markAbandonmentConverted(visitorId: string, formId: string): Promise<void> {
  await prisma.abandonedForm.updateMany({
    where: { formId, visitorId, convertedAt: null },
    data: { convertedAt: new Date() },
  });
}

export async function listPendingRecoveries(shopId: string, limit = 100) {
  return prisma.abandonedForm.findMany({
    where: {
      convertedAt: null,
      form: { shopId },
      createdAt: { lte: new Date(Date.now() - 15 * 60 * 1000) },
      OR: [{ phone: { not: null } }, { email: { not: null } }],
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: { form: { select: { slug: true, shopId: true, name: true } } },
  });
}

export async function markRecoveryNotified(id: string): Promise<void> {
  await prisma.abandonedForm.update({
    where: { id },
    data: { notifiedAt: new Date() },
  });
}

export function buildRecoveryUrl(appUrl: string, formSlug: string, token: string): string {
  const clean = appUrl.replace(/\/$/, '');
  return `${clean}/r/${formSlug}?t=${encodeURIComponent(token)}`;
}
