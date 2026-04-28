/**
 * Multi-currency FX rates.
 *
 * Stores per-shop conversion rates keyed by (base, target). Rates are either
 * entered manually (`source = 'manual'`) or refreshed from a public provider
 * (defaults to https://api.exchangerate.host which is free + key-less; users
 * can switch to Fixer / OpenExchangeRates by configuring credentials in
 * `Shop.settings.fxProvider`).
 */
import prisma from '../db.server';

export type FxProvider = 'manual' | 'exchangerate-host' | 'fixer' | 'openexchangerates';

export interface RefreshOptions {
  provider?: FxProvider;
  apiKey?: string;
  base: string;
  targets: string[];
}

interface RawRates {
  base: string;
  rates: Record<string, number>;
  source: string;
}

export async function listRates(shopId: string) {
  return prisma.fxRate.findMany({
    where: { shopId },
    orderBy: [{ base: 'asc' }, { target: 'asc' }],
  });
}

export async function upsertRate(args: {
  shopId: string;
  base: string;
  target: string;
  rate: number;
  source?: FxProvider;
}) {
  return prisma.fxRate.upsert({
    where: {
      shopId_base_target: {
        shopId: args.shopId,
        base: args.base.toUpperCase(),
        target: args.target.toUpperCase(),
      },
    },
    create: {
      shopId: args.shopId,
      base: args.base.toUpperCase(),
      target: args.target.toUpperCase(),
      rate: args.rate,
      source: args.source ?? 'manual',
    },
    update: { rate: args.rate, source: args.source ?? 'manual', fetchedAt: new Date() },
  });
}

export async function deleteRate(shopId: string, id: string) {
  await prisma.fxRate.deleteMany({ where: { id, shopId } });
}

export async function refreshRates(shopId: string, opts: RefreshOptions) {
  const provider: FxProvider = opts.provider ?? 'exchangerate-host';
  const data = await fetchProvider(provider, opts);
  const upserts = Object.entries(data.rates).map(([target, rate]) =>
    upsertRate({ shopId, base: data.base, target, rate, source: provider }),
  );
  return Promise.all(upserts);
}

async function fetchProvider(provider: FxProvider, opts: RefreshOptions): Promise<RawRates> {
  if (provider === 'manual') {
    return { base: opts.base, rates: {}, source: 'manual' };
  }
  if (provider === 'exchangerate-host') {
    const url = new URL('https://api.exchangerate.host/latest');
    url.searchParams.set('base', opts.base);
    if (opts.targets.length) url.searchParams.set('symbols', opts.targets.join(','));
    const res = await fetch(url.toString());
    if (!res.ok) throw new Error(`exchangerate.host ${res.status}`);
    const json = (await res.json()) as { base: string; rates: Record<string, number> };
    return { base: json.base, rates: json.rates ?? {}, source: provider };
  }
  if (provider === 'fixer') {
    if (!opts.apiKey) throw new Error('Fixer provider requires apiKey');
    const url = new URL('https://data.fixer.io/api/latest');
    url.searchParams.set('access_key', opts.apiKey);
    url.searchParams.set('base', opts.base);
    if (opts.targets.length) url.searchParams.set('symbols', opts.targets.join(','));
    const res = await fetch(url.toString());
    if (!res.ok) throw new Error(`fixer ${res.status}`);
    const json = (await res.json()) as { base: string; rates: Record<string, number> };
    return { base: json.base, rates: json.rates ?? {}, source: provider };
  }
  if (provider === 'openexchangerates') {
    if (!opts.apiKey) throw new Error('OpenExchangeRates provider requires apiKey');
    const url = new URL('https://openexchangerates.org/api/latest.json');
    url.searchParams.set('app_id', opts.apiKey);
    url.searchParams.set('base', opts.base);
    if (opts.targets.length) url.searchParams.set('symbols', opts.targets.join(','));
    const res = await fetch(url.toString());
    if (!res.ok) throw new Error(`openexchangerates ${res.status}`);
    const json = (await res.json()) as { base: string; rates: Record<string, number> };
    return { base: json.base, rates: json.rates ?? {}, source: provider };
  }
  return { base: opts.base, rates: {}, source: provider };
}

export async function convert(
  shopId: string,
  amount: number,
  from: string,
  to: string,
): Promise<number | null> {
  const fromU = from.toUpperCase();
  const toU = to.toUpperCase();
  if (fromU === toU) return amount;
  const direct = await prisma.fxRate.findUnique({
    where: { shopId_base_target: { shopId, base: fromU, target: toU } },
  });
  if (direct) return amount * Number(direct.rate);
  const inverse = await prisma.fxRate.findUnique({
    where: { shopId_base_target: { shopId, base: toU, target: fromU } },
  });
  if (inverse && Number(inverse.rate) !== 0) return amount / Number(inverse.rate);
  return null;
}
