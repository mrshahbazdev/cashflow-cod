import type { Session } from '@shopify/shopify-app-remix/server';
import type { Plan } from '@prisma/client';
import prisma from '../db.server';

const DEFAULT_SHOP_SETTINGS = {
  currency: undefined,
  timezone: undefined,
  defaultLanguage: 'en',
  onboarding: {
    completed: false,
    firstFormCreated: false,
    themeEmbedEnabled: false,
    paymentConfigured: false,
    testOrderPlaced: false,
  },
  otp: {
    enabled: false,
    channel: 'SMS' as const,
    timeoutMinutes: 10,
  },
  fraud: {
    maxOrdersPerPhonePerDay: 5,
    maxOrdersPerIpPerDay: 10,
    allowedCountries: [],
    blockedCountries: [],
  },
  branding: {
    accentColor: '#008060',
    logoUrl: null,
  },
};

export type ShopSettings = typeof DEFAULT_SHOP_SETTINGS;

/**
 * Ensure a Shop record exists for the authenticated session. Creates the
 * Shop + an OWNER Agent on first install, merges default settings on every
 * install, and clears `uninstalledAt` on re-install.
 */
export async function ensureShopForSession(session: Session): Promise<void> {
  const shopDomain = session.shop;
  const ownerUserId = session.onlineAccessInfo?.associated_user?.id
    ? String(session.onlineAccessInfo.associated_user.id)
    : `offline:${shopDomain}`;
  const ownerName =
    [
      session.onlineAccessInfo?.associated_user?.first_name,
      session.onlineAccessInfo?.associated_user?.last_name,
    ]
      .filter(Boolean)
      .join(' ')
      .trim() || 'Store owner';
  const ownerEmail = session.onlineAccessInfo?.associated_user?.email ?? null;

  const existing = await prisma.shop.findUnique({ where: { domain: shopDomain } });

  if (!existing) {
    await prisma.shop.create({
      data: {
        domain: shopDomain,
        plan: 'FREE' as Plan,
        settings: DEFAULT_SHOP_SETTINGS,
        agents: {
          create: {
            userId: ownerUserId,
            name: ownerName,
            email: ownerEmail,
            role: 'OWNER',
          },
        },
      },
    });
    return;
  }

  // Re-install or scope update: keep existing settings but merge in any newly
  // introduced defaults, and clear uninstalledAt if previously set.
  const mergedSettings = mergeSettings(existing.settings, DEFAULT_SHOP_SETTINGS);
  await prisma.shop.update({
    where: { domain: shopDomain },
    data: {
      settings: mergedSettings,
      uninstalledAt: null,
    },
  });

  await prisma.agent.upsert({
    where: { shopId_userId: { shopId: existing.id, userId: ownerUserId } },
    update: { name: ownerName, email: ownerEmail, isActive: true, role: 'OWNER' },
    create: {
      shopId: existing.id,
      userId: ownerUserId,
      name: ownerName,
      email: ownerEmail,
      role: 'OWNER',
    },
  });
}

/**
 * Fetch the Shop record for a domain, ensuring settings are typed.
 */
export async function getShopByDomain(domain: string) {
  return prisma.shop.findUnique({ where: { domain } });
}

/**
 * Update the onboarding checklist flags atomically (reads current settings,
 * merges, writes back).
 */
export async function markOnboardingStep(
  domain: string,
  step: keyof ShopSettings['onboarding'],
  value: boolean,
): Promise<void> {
  const shop = await prisma.shop.findUnique({ where: { domain } });
  if (!shop) return;
  const current = (shop.settings ?? {}) as Partial<ShopSettings>;
  const onboarding = {
    ...DEFAULT_SHOP_SETTINGS.onboarding,
    ...(current.onboarding ?? {}),
    [step]: value,
  };
  onboarding.completed =
    onboarding.firstFormCreated && onboarding.themeEmbedEnabled && onboarding.paymentConfigured;

  await prisma.shop.update({
    where: { domain },
    data: {
      settings: { ...current, onboarding },
    },
  });
}

function mergeSettings(current: unknown, defaults: ShopSettings): ShopSettings {
  if (!current || typeof current !== 'object') return defaults;
  const curr = current as Partial<ShopSettings>;
  return {
    ...defaults,
    ...curr,
    onboarding: { ...defaults.onboarding, ...(curr.onboarding ?? {}) },
    otp: { ...defaults.otp, ...(curr.otp ?? {}) },
    fraud: { ...defaults.fraud, ...(curr.fraud ?? {}) },
    branding: { ...defaults.branding, ...(curr.branding ?? {}) },
  };
}
