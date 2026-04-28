/**
 * Public REST API keys.
 *
 * Each merchant can issue Bearer tokens (format `cf_<prefix><secret>`). The
 * raw secret is shown to the merchant once and stored as sha-256.
 *
 * Authentication helpers:
 *   - `authenticateApiKey(request)`  → `{ shopId, scopes, apiKeyId } | null`
 *   - `requireScope(scopes, scope)` → throws Response(403) if missing
 */
import { createHash, randomBytes } from 'crypto';
import prisma from '../db.server';
import { ALL_SCOPES, type ApiScope } from './api-scopes';

export { ALL_SCOPES };
export type { ApiScope };

const PREFIX_LEN = 8;

function hash(secret: string) {
  return createHash('sha256').update(secret).digest('hex');
}

export async function listApiKeys(shopId: string) {
  return prisma.apiKey.findMany({
    where: { shopId },
    orderBy: { createdAt: 'desc' },
  });
}

export async function createApiKey(args: { shopId: string; label: string; scopes: ApiScope[] }) {
  const raw = randomBytes(24).toString('base64url');
  const prefix = `cf_${raw.slice(0, PREFIX_LEN)}`;
  const secret = `${prefix}_${raw}`;
  const row = await prisma.apiKey.create({
    data: {
      shopId: args.shopId,
      label: args.label,
      prefix,
      secretHash: hash(secret),
      scopes: args.scopes,
    },
  });
  return { row, secret };
}

export async function revokeApiKey(shopId: string, id: string) {
  await prisma.apiKey.updateMany({
    where: { id, shopId },
    data: { isActive: false, revokedAt: new Date() },
  });
}

export async function deleteApiKey(shopId: string, id: string) {
  await prisma.apiKey.deleteMany({ where: { id, shopId } });
}

function readBearer(request: Request): string | null {
  const auth = request.headers.get('authorization') ?? '';
  if (!auth.toLowerCase().startsWith('bearer ')) return null;
  return auth.slice(7).trim() || null;
}

export interface AuthenticatedApiCall {
  apiKeyId: string;
  shopId: string;
  scopes: ApiScope[];
}

export async function authenticateApiKey(request: Request): Promise<AuthenticatedApiCall | null> {
  const secret = readBearer(request);
  if (!secret) return null;
  const idx = secret.indexOf('_', 3);
  if (idx === -1) return null;
  const prefix = secret.slice(0, idx);
  const row = await prisma.apiKey.findUnique({ where: { prefix } });
  if (!row || !row.isActive) return null;
  if (row.secretHash !== hash(secret)) return null;
  await prisma.apiKey
    .update({ where: { id: row.id }, data: { lastUsedAt: new Date() } })
    .catch(() => undefined);
  return {
    apiKeyId: row.id,
    shopId: row.shopId,
    scopes: Array.isArray(row.scopes) ? (row.scopes as ApiScope[]) : [],
  };
}

export function requireScope(scopes: ApiScope[], required: ApiScope): void {
  if (!scopes.includes(required)) {
    throw new Response(JSON.stringify({ error: `missing scope: ${required}` }), {
      status: 403,
      headers: { 'content-type': 'application/json' },
    });
  }
}

export async function logApiCall(args: {
  apiKeyId: string;
  path: string;
  method: string;
  status: number;
  ip?: string | null;
  durationMs?: number;
}) {
  await prisma.apiKeyUsage
    .create({
      data: {
        apiKeyId: args.apiKeyId,
        path: args.path,
        method: args.method,
        status: args.status,
        ip: args.ip ?? null,
        durationMs: args.durationMs,
      },
    })
    .catch(() => undefined);
}
