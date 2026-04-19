import type { PixelProvider } from '@cashflow-cod/shared-types';

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
  currency?: string;
  value?: number;
  contents?: { id: string; quantity: number; price?: number }[];
}

export interface PixelAdapter {
  readonly provider: PixelProvider;
  fire(
    credentials: { pixelId: string; accessToken?: string; testCode?: string },
    event: StandardEvent,
    ctx: PixelEventContext,
  ): Promise<{ ok: boolean; raw?: unknown }>;
}

export class PixelRegistry {
  private adapters = new Map<PixelProvider, PixelAdapter>();

  register(adapter: PixelAdapter): void {
    this.adapters.set(adapter.provider, adapter);
  }

  get(provider: PixelProvider): PixelAdapter | undefined {
    return this.adapters.get(provider);
  }
}

export const pixelRegistry = new PixelRegistry();
