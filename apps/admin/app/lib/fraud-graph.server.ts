/**
 * Phase 3.1 — Fraud Graph cross-store blacklist.
 * Shops opt-in via `Shop.fraudGraphOptIn`. Reports are stored as `FraudGraphReport`
 * rows and aggregated into `FraudGraphEntry`. Queries never expose raw PII — the
 * identifier is hashed with SHA-256 before persistence.
 */
import { createHash } from 'node:crypto';
import type { BlocklistType } from '@prisma/client';
import prisma from '../db.server';

export function hashIdentifier(type: BlocklistType, raw: string): string {
  const normalized = normalize(type, raw);
  return createHash('sha256').update(`${type}:${normalized}`).digest('hex');
}

function normalize(type: BlocklistType, raw: string): string {
  const s = raw.trim().toLowerCase();
  if (type === 'PHONE') return s.replace(/\D/g, '');
  if (type === 'EMAIL') return s;
  return s;
}

export async function reportToFraudGraph(args: {
  shopId: string;
  type: BlocklistType;
  value: string;
  reason: string;
  disposition?: string;
  linkedOrderId?: string;
}): Promise<{ entryId: string; severity: number; reportCount: number }> {
  const shop = await prisma.shop.findUnique({
    where: { id: args.shopId },
    select: { fraudGraphOptIn: true },
  });
  if (!shop || !shop.fraudGraphOptIn) {
    throw new Error('Shop has not opted in to the fraud graph');
  }
  const valueHash = hashIdentifier(args.type, args.value);

  const entry = await prisma.fraudGraphEntry.upsert({
    where: { type_valueHash: { type: args.type, valueHash } },
    create: {
      type: args.type,
      valueHash,
      reportCount: 1,
      offenderHits: args.disposition === 'FAKE' || args.disposition === 'RETURNED' ? 1 : 0,
      severity: 1,
    },
    update: {
      reportCount: { increment: 1 },
      offenderHits:
        args.disposition === 'FAKE' || args.disposition === 'RETURNED'
          ? { increment: 1 }
          : undefined,
      lastSeenAt: new Date(),
    },
  });

  await prisma.fraudGraphReport.create({
    data: {
      entryId: entry.id,
      shopId: args.shopId,
      reason: args.reason,
      disposition: args.disposition ?? null,
      linkedOrderId: args.linkedOrderId ?? null,
    },
  });

  const severity = computeSeverity(entry.reportCount, entry.offenderHits);
  if (severity !== entry.severity) {
    await prisma.fraudGraphEntry.update({
      where: { id: entry.id },
      data: { severity },
    });
  }
  return { entryId: entry.id, severity, reportCount: entry.reportCount };
}

export async function lookupFraudGraph(
  type: BlocklistType,
  value: string,
): Promise<{ hit: boolean; severity: number; reportCount: number; offenderHits: number } | null> {
  const valueHash = hashIdentifier(type, value);
  const entry = await prisma.fraudGraphEntry.findUnique({
    where: { type_valueHash: { type, valueHash } },
    select: { severity: true, reportCount: true, offenderHits: true },
  });
  if (!entry) return { hit: false, severity: 0, reportCount: 0, offenderHits: 0 };
  return { hit: true, ...entry };
}

export async function listFraudGraphEntries(limit = 100) {
  return prisma.fraudGraphEntry.findMany({
    orderBy: [{ severity: 'desc' }, { reportCount: 'desc' }],
    take: limit,
    select: {
      id: true,
      type: true,
      valueHash: true,
      reportCount: true,
      offenderHits: true,
      severity: true,
      firstSeenAt: true,
      lastSeenAt: true,
    },
  });
}

function computeSeverity(reportCount: number, offenderHits: number): number {
  const score = reportCount + offenderHits * 3;
  if (score >= 20) return 5;
  if (score >= 10) return 4;
  if (score >= 5) return 3;
  if (score >= 2) return 2;
  return 1;
}
