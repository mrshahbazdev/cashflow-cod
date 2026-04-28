/**
 * Phase 5.3 — Klaviyo + Omnisend email-marketing integrations.
 *
 * Each merchant can connect one or more providers. Submissions and orders are
 * pushed to the provider's list/profile via a thin adapter. Mock mode is
 * enabled by default; live mode requires real credentials.
 */
import type { Prisma } from '@prisma/client';
import prisma from '../db.server';

export type EmailProvider = 'klaviyo' | 'omnisend' | 'mailchimp' | 'custom';

export interface EmailSyncPayload {
  email: string;
  phone?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  city?: string | null;
  country?: string | null;
  attributes?: Record<string, unknown>;
}

export interface EmailAdapter {
  readonly provider: EmailProvider;
  readonly displayName: string;
  upsertProfile(credentials: Record<string, string>, payload: EmailSyncPayload): Promise<boolean>;
  trackEvent(
    credentials: Record<string, string>,
    email: string,
    eventName: string,
    properties?: Record<string, unknown>,
  ): Promise<boolean>;
}

/** Klaviyo adapter — uses the 2024-02-15 revision API. */
const klaviyoAdapter: EmailAdapter = {
  provider: 'klaviyo',
  displayName: 'Klaviyo',
  async upsertProfile(credentials, payload) {
    if (!credentials.apiKey || credentials.mode === 'mock') return true;
    try {
      const resp = await fetch('https://a.klaviyo.com/api/profiles/', {
        method: 'POST',
        headers: {
          Authorization: `Klaviyo-API-Key ${credentials.apiKey}`,
          accept: 'application/json',
          'content-type': 'application/json',
          revision: '2024-02-15',
        },
        body: JSON.stringify({
          data: {
            type: 'profile',
            attributes: {
              email: payload.email,
              phone_number: payload.phone ?? undefined,
              first_name: payload.firstName ?? undefined,
              last_name: payload.lastName ?? undefined,
              location: {
                city: payload.city ?? undefined,
                country: payload.country ?? undefined,
              },
              properties: payload.attributes ?? {},
            },
          },
        }),
      });
      return resp.ok || resp.status === 409;
    } catch {
      return false;
    }
  },
  async trackEvent(credentials, email, eventName, properties) {
    if (!credentials.apiKey || credentials.mode === 'mock') return true;
    try {
      const resp = await fetch('https://a.klaviyo.com/api/events/', {
        method: 'POST',
        headers: {
          Authorization: `Klaviyo-API-Key ${credentials.apiKey}`,
          accept: 'application/json',
          'content-type': 'application/json',
          revision: '2024-02-15',
        },
        body: JSON.stringify({
          data: {
            type: 'event',
            attributes: {
              properties: properties ?? {},
              metric: { data: { type: 'metric', attributes: { name: eventName } } },
              profile: { data: { type: 'profile', attributes: { email } } },
            },
          },
        }),
      });
      return resp.ok;
    } catch {
      return false;
    }
  },
};

/** Omnisend adapter — uses the v3 contacts API. */
const omnisendAdapter: EmailAdapter = {
  provider: 'omnisend',
  displayName: 'Omnisend',
  async upsertProfile(credentials, payload) {
    if (!credentials.apiKey || credentials.mode === 'mock') return true;
    try {
      const resp = await fetch('https://api.omnisend.com/v3/contacts', {
        method: 'POST',
        headers: { 'X-API-KEY': credentials.apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifiers: [
            { type: 'email', id: payload.email, channels: { email: { status: 'subscribed' } } },
            ...(payload.phone ? [{ type: 'phone', id: payload.phone, channels: { sms: { status: 'subscribed' } } }] : []),
          ],
          firstName: payload.firstName ?? undefined,
          lastName: payload.lastName ?? undefined,
          city: payload.city ?? undefined,
          country: payload.country ?? undefined,
          customProperties: payload.attributes ?? {},
        }),
      });
      return resp.ok || resp.status === 409;
    } catch {
      return false;
    }
  },
  async trackEvent(credentials, email, eventName, properties) {
    if (!credentials.apiKey || credentials.mode === 'mock') return true;
    try {
      const resp = await fetch('https://api.omnisend.com/v3/events', {
        method: 'POST',
        headers: { 'X-API-KEY': credentials.apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventName,
          email,
          properties: properties ?? {},
        }),
      });
      return resp.ok;
    } catch {
      return false;
    }
  },
};

const ADAPTERS: Record<EmailProvider, EmailAdapter> = {
  klaviyo: klaviyoAdapter,
  omnisend: omnisendAdapter,
  mailchimp: klaviyoAdapter, // placeholder — reuses klaviyo shape; swap when live
  custom: klaviyoAdapter,
};

export function listEmailProviders(): Array<{ code: EmailProvider; displayName: string }> {
  return [
    { code: 'klaviyo', displayName: 'Klaviyo' },
    { code: 'omnisend', displayName: 'Omnisend' },
  ];
}

export async function listEmailIntegrations(shopId: string) {
  return prisma.emailIntegration.findMany({
    where: { shopId },
    orderBy: { createdAt: 'desc' },
  });
}

export async function upsertEmailIntegration(args: {
  shopId: string;
  id?: string;
  provider: EmailProvider;
  label: string;
  credentials?: Record<string, string>;
  syncSubmissions?: boolean;
  syncOrders?: boolean;
  isActive?: boolean;
}) {
  const data = {
    provider: args.provider,
    label: args.label,
    credentials: (args.credentials ?? {}) as Prisma.InputJsonValue,
    syncSubmissions: args.syncSubmissions ?? true,
    syncOrders: args.syncOrders ?? true,
    isActive: args.isActive ?? true,
  };
  if (args.id) {
    return prisma.emailIntegration.update({
      where: { id: args.id },
      data,
    });
  }
  return prisma.emailIntegration.create({
    data: { ...data, shopId: args.shopId },
  });
}

export async function deleteEmailIntegration(shopId: string, id: string) {
  await prisma.emailIntegration.deleteMany({ where: { id, shopId } });
}

export async function syncProfileToAll(shopId: string, payload: EmailSyncPayload): Promise<void> {
  const integrations = await prisma.emailIntegration.findMany({
    where: { shopId, isActive: true },
  });
  await Promise.all(
    integrations.map(async (integration) => {
      const adapter = ADAPTERS[integration.provider as EmailProvider];
      if (!adapter) return;
      try {
        await adapter.upsertProfile(integration.credentials as Record<string, string>, payload);
        await prisma.emailIntegration.update({
          where: { id: integration.id },
          data: { lastSyncAt: new Date() },
        });
      } catch {
        // swallow; per-provider errors shouldn't block the caller
      }
    }),
  );
}

export async function trackEventOnAll(
  shopId: string,
  email: string,
  eventName: string,
  properties?: Record<string, unknown>,
): Promise<void> {
  const integrations = await prisma.emailIntegration.findMany({
    where: { shopId, isActive: true },
  });
  await Promise.all(
    integrations.map((integration) => {
      const adapter = ADAPTERS[integration.provider as EmailProvider];
      if (!adapter) return Promise.resolve(false);
      return adapter
        .trackEvent(integration.credentials as Record<string, string>, email, eventName, properties)
        .catch(() => false);
    }),
  );
}
