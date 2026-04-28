import type { Shop } from '@prisma/client';

/**
 * Lightweight address validation utilities. The library exposes:
 *   - `validatePostalCode(country, code)` — pure regex check against per-country
 *     formats; returns `{ ok, normalized, reason }`. Used inline in the
 *     storefront submit handler.
 *   - `validateAddressViaProvider(shop, address)` — optional provider-backed
 *     validation. Currently supports Google Address Validation API and
 *     Smarty (US/intl) — both opt-in via shop settings or env vars; otherwise
 *     returns `{ ok: true, provider: 'none' }`.
 *
 * The provider call is best-effort: if the upstream is down, we degrade to
 * `{ ok: true, provider: 'fallback' }` so we never block a COD checkout on
 * an upstream outage.
 */

export interface AddressInput {
  line1?: string | null;
  line2?: string | null;
  city?: string | null;
  region?: string | null;
  postalCode?: string | null;
  country?: string | null;
}

export interface ValidatePostalResult {
  ok: boolean;
  normalized?: string;
  reason?: string;
}

const POSTAL_PATTERNS: Record<string, RegExp> = {
  US: /^\d{5}(-\d{4})?$/,
  CA: /^[A-CEGHJ-NPR-TVXY]\d[A-CEGHJ-NPR-TV-Z] ?\d[A-CEGHJ-NPR-TV-Z]\d$/i,
  GB: /^[A-Z]{1,2}\d[A-Z\d]? ?\d[A-Z]{2}$/i,
  PK: /^\d{5}$/,
  IN: /^\d{6}$/,
  BD: /^\d{4}$/,
  AE: /^\d{0,5}$/, // optional in UAE
  SA: /^\d{5}(-\d{4})?$/,
  EG: /^\d{5}$/,
  DE: /^\d{5}$/,
  FR: /^\d{5}$/,
  IT: /^\d{5}$/,
  ES: /^\d{5}$/,
  NL: /^\d{4} ?[A-Z]{2}$/i,
  BE: /^\d{4}$/,
  PL: /^\d{2}-\d{3}$/,
  SE: /^\d{3} ?\d{2}$/,
  NO: /^\d{4}$/,
  DK: /^\d{4}$/,
  FI: /^\d{5}$/,
  CH: /^\d{4}$/,
  AT: /^\d{4}$/,
  PT: /^\d{4}-\d{3}$/,
  CZ: /^\d{3} ?\d{2}$/,
  TR: /^\d{5}$/,
  BR: /^\d{5}-?\d{3}$/,
  MX: /^\d{5}$/,
  AU: /^\d{4}$/,
  JP: /^\d{3}-?\d{4}$/,
  KR: /^\d{5}$/,
  CN: /^\d{6}$/,
  ID: /^\d{5}$/,
  MY: /^\d{5}$/,
  TH: /^\d{5}$/,
  PH: /^\d{4}$/,
  NG: /^\d{6}$/,
  KE: /^\d{5}$/,
  ZA: /^\d{4}$/,
};

export function validatePostalCode(
  country: string | null | undefined,
  code: string | null | undefined,
): ValidatePostalResult {
  const normalized = (code ?? '').trim().toUpperCase();
  if (!country) {
    if (!normalized) return { ok: true };
    return { ok: true, normalized };
  }
  const cc = country.trim().toUpperCase();
  const pattern = POSTAL_PATTERNS[cc];
  if (!pattern) {
    // Unknown country – accept anything non-empty.
    return { ok: true, normalized };
  }
  if (!normalized) {
    if (cc === 'AE') return { ok: true };
    return { ok: false, reason: `Postal code is required for ${cc}` };
  }
  if (!pattern.test(normalized)) {
    return { ok: false, reason: `Invalid postal code format for ${cc}` };
  }
  return { ok: true, normalized };
}

export interface ProviderValidationResult {
  ok: boolean;
  provider: 'google' | 'smarty' | 'none' | 'fallback';
  raw?: unknown;
  reason?: string;
  suggestion?: AddressInput;
}

interface AddressProviderConfig {
  google?: { apiKey: string };
  smarty?: { authId: string; authToken: string };
}

function readProviderConfig(shop: Shop): AddressProviderConfig {
  const settings = (shop.settings as Record<string, unknown>) ?? {};
  const addr = (settings.address as Record<string, unknown>) ?? {};
  const cfg: AddressProviderConfig = {};
  const googleKey = (addr.googleApiKey as string) ?? process.env.GOOGLE_ADDRESS_API_KEY ?? '';
  if (googleKey) cfg.google = { apiKey: googleKey };
  const smartyId = (addr.smartyAuthId as string) ?? process.env.SMARTY_AUTH_ID ?? '';
  const smartyToken = (addr.smartyAuthToken as string) ?? process.env.SMARTY_AUTH_TOKEN ?? '';
  if (smartyId && smartyToken) cfg.smarty = { authId: smartyId, authToken: smartyToken };
  return cfg;
}

export async function validateAddressViaProvider(
  shop: Shop,
  address: AddressInput,
): Promise<ProviderValidationResult> {
  const cfg = readProviderConfig(shop);
  if (cfg.google) {
    return validateWithGoogle(cfg.google.apiKey, address);
  }
  if (cfg.smarty) {
    return validateWithSmarty(cfg.smarty.authId, cfg.smarty.authToken, address);
  }
  return { ok: true, provider: 'none' };
}

async function validateWithGoogle(
  apiKey: string,
  address: AddressInput,
): Promise<ProviderValidationResult> {
  try {
    const resp = await fetch(
      `https://addressvalidation.googleapis.com/v1:validateAddress?key=${encodeURIComponent(apiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address: {
            regionCode: address.country ?? '',
            postalCode: address.postalCode ?? '',
            locality: address.city ?? '',
            administrativeArea: address.region ?? '',
            addressLines: [address.line1, address.line2].filter(Boolean) as string[],
          },
        }),
      },
    );
    const json = (await resp.json()) as {
      result?: {
        verdict?: { addressComplete?: boolean; hasUnconfirmedComponents?: boolean };
        address?: {
          formattedAddress?: string;
          postalAddress?: { regionCode?: string; postalCode?: string; locality?: string };
        };
      };
    };
    const v = json.result?.verdict ?? {};
    const ok = Boolean(v.addressComplete) && !v.hasUnconfirmedComponents;
    const postal = json.result?.address?.postalAddress;
    return {
      ok,
      provider: 'google',
      raw: json,
      reason: ok ? undefined : 'Address could not be verified',
      suggestion: postal
        ? {
            country: postal.regionCode ?? address.country ?? null,
            postalCode: postal.postalCode ?? address.postalCode ?? null,
            city: postal.locality ?? address.city ?? null,
          }
        : undefined,
    };
  } catch (err) {
    return {
      ok: true,
      provider: 'fallback',
      reason: (err as Error).message,
    };
  }
}

async function validateWithSmarty(
  authId: string,
  authToken: string,
  address: AddressInput,
): Promise<ProviderValidationResult> {
  try {
    const url = new URL('https://international-street.api.smarty.com/verify');
    url.searchParams.set('auth-id', authId);
    url.searchParams.set('auth-token', authToken);
    url.searchParams.set('country', address.country ?? '');
    url.searchParams.set('address1', address.line1 ?? '');
    if (address.line2) url.searchParams.set('address2', address.line2);
    if (address.city) url.searchParams.set('locality', address.city);
    if (address.region) url.searchParams.set('administrative_area', address.region);
    if (address.postalCode) url.searchParams.set('postal_code', address.postalCode);
    const resp = await fetch(url.toString());
    const json = (await resp.json()) as Array<{
      analysis?: { verification_status?: string };
      components?: { postal_code?: string; locality?: string };
    }>;
    const top = json[0];
    const status = top?.analysis?.verification_status ?? '';
    const ok = status === 'Verified' || status === 'Partial';
    return {
      ok,
      provider: 'smarty',
      raw: json,
      reason: ok ? undefined : 'Smarty could not verify address',
      suggestion: top?.components
        ? {
            postalCode: top.components.postal_code ?? address.postalCode ?? null,
            city: top.components.locality ?? address.city ?? null,
          }
        : undefined,
    };
  } catch (err) {
    return {
      ok: true,
      provider: 'fallback',
      reason: (err as Error).message,
    };
  }
}
