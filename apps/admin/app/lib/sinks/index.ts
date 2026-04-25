/**
 * Marketing-sink registry + dispatcher.
 *
 * `dispatchSinkEvent` loads all active `Integration` rows for a shop and fires
 * the matching adapter in parallel. Each call records `lastFiredAt` /
 * `lastError` so merchants can debug from the admin UI without log access.
 */
import prisma from '../../db.server';
import type { SinkAdapter, SinkEvent } from './types';
import { klaviyoSink } from './klaviyo';
import { omnisendSink } from './omnisend';
import { googleSheetsSink } from './google-sheets';

const ADAPTERS: SinkAdapter[] = [klaviyoSink, omnisendSink, googleSheetsSink];
const ADAPTERS_BY_PROVIDER = new Map<string, SinkAdapter>(ADAPTERS.map((a) => [a.provider, a]));

export type { SinkAdapter, SinkEvent } from './types';
export { ADAPTERS };

export function listSinkAdapters() {
  return ADAPTERS.map((a) => ({
    provider: a.provider,
    displayName: a.displayName,
    credentialsHelp: a.credentialsHelp,
    credentialFields: a.credentialFields,
  }));
}

export function getSinkAdapter(provider: string): SinkAdapter | undefined {
  return ADAPTERS_BY_PROVIDER.get(provider);
}

export async function dispatchSinkEvent(shopId: string, event: SinkEvent): Promise<void> {
  const integrations = await prisma.integration.findMany({
    where: { shopId, isActive: true },
  });
  if (integrations.length === 0) return;

  await Promise.all(
    integrations.map(async (integration) => {
      const adapter = ADAPTERS_BY_PROVIDER.get(integration.provider);
      if (!adapter) return;
      try {
        const result = await adapter.fire(
          (integration.credentials as Record<string, unknown>) ?? {},
          (integration.settings as Record<string, unknown>) ?? {},
          event,
        );
        await prisma.integration.update({
          where: { id: integration.id },
          data: {
            lastFiredAt: new Date(),
            lastError: result.ok ? null : (result.error ?? 'unknown error').slice(0, 500),
          },
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        // eslint-disable-next-line no-console
        console.warn(`[sink:${integration.provider}] fire failed: ${message}`);
        await prisma.integration
          .update({
            where: { id: integration.id },
            data: { lastError: message.slice(0, 500) },
          })
          .catch(() => undefined);
      }
    }),
  );
}
