import type { PixelProvider } from '@cashflow-cod/shared-types';
import { createHash } from 'node:crypto';

export type StandardEvent =
  | 'PageView'
  | 'ViewContent'
  | 'AddToCart'
  | 'InitiateCheckout'
  | 'AddPaymentInfo'
  | 'Purchase';

export interface PixelEventContext {
  eventId: string;
  eventTime: number;
  sourceUrl: string;
  userAgent?: string;
  ip?: string;
  email?: string;
  phone?: string;
  externalId?: string;
  fbp?: string;
  fbc?: string;
  ttclid?: string;
  ttp?: string;
  scClickId?: string;
  epik?: string;
  currency?: string;
  value?: number;
  orderId?: string;
  contents?: { id: string; quantity: number; price?: number; name?: string }[];
  firstName?: string;
  lastName?: string;
  city?: string;
  country?: string;
  postalCode?: string;
}

export interface PixelCredentials {
  pixelId: string;
  accessToken?: string;
  testCode?: string;
  // provider-specific extras (e.g. Pinterest ad_account_id)
  [k: string]: string | undefined;
}

export interface PixelFireResult {
  ok: boolean;
  raw?: unknown;
  error?: string;
}

export interface PixelAdapter {
  readonly provider: PixelProvider;
  readonly displayName: string;
  fire(
    credentials: PixelCredentials,
    event: StandardEvent,
    ctx: PixelEventContext,
  ): Promise<PixelFireResult>;
}

export class PixelRegistry {
  private adapters = new Map<PixelProvider, PixelAdapter>();

  register(adapter: PixelAdapter): void {
    this.adapters.set(adapter.provider, adapter);
  }

  get(provider: PixelProvider): PixelAdapter | undefined {
    return this.adapters.get(provider);
  }

  list(): PixelAdapter[] {
    return Array.from(this.adapters.values());
  }
}

export const pixelRegistry = new PixelRegistry();

/** SHA-256 hex digest of a normalized string (lower-cased, trimmed). */
export function sha256(input: string | undefined | null): string | undefined {
  if (!input) return undefined;
  return createHash('sha256').update(input.trim().toLowerCase()).digest('hex');
}

/** Normalize a phone for CAPI hashing — digits only, no leading +. */
export function normalizePhone(phone: string | undefined | null): string | undefined {
  if (!phone) return undefined;
  return phone.replace(/[^0-9]/g, '');
}

import { metaAdapter } from './adapters/meta.js';
import { tiktokAdapter } from './adapters/tiktok.js';
import { googleAdapter } from './adapters/google.js';
import { snapchatAdapter } from './adapters/snapchat.js';
import { pinterestAdapter } from './adapters/pinterest.js';

pixelRegistry.register(metaAdapter);
pixelRegistry.register(tiktokAdapter);
pixelRegistry.register(googleAdapter);
pixelRegistry.register(snapchatAdapter);
pixelRegistry.register(pinterestAdapter);

export { metaAdapter, tiktokAdapter, googleAdapter, snapchatAdapter, pinterestAdapter };
