/**
 * Payment adapter registry (Phase 4.2 — partial advance / split payment).
 *
 * Each adapter knows how to:
 *   - create a hosted-checkout session for a partial advance amount
 *   - verify a webhook notification from the provider
 *   - return a normalized payment status
 *
 * The admin stores provider credentials (keys / merchant IDs) per shop; the
 * adapter receives them at call time. Adapters never hold state themselves.
 */

export type PaymentProviderCode =
  | 'jazzcash'
  | 'easypaisa'
  | 'sadapay'
  | 'stripe'
  | 'razorpay';

export interface CreateAdvanceRequest {
  orderId: string;
  amount: number; // minor-unit-agnostic; 199.00
  currency: string; // PKR, INR, USD, ...
  customer: {
    name?: string;
    email?: string;
    phone?: string;
  };
  returnUrl: string;
  cancelUrl: string;
  metadata?: Record<string, string>;
}

export interface CreateAdvanceResult {
  providerRef: string;
  checkoutUrl: string;
  status: 'pending' | 'paid' | 'failed';
  raw?: unknown;
}

export interface VerifyWebhookRequest {
  headers: Record<string, string>;
  rawBody: string;
  credentials: Record<string, string>;
}

export interface VerifyWebhookResult {
  ok: boolean;
  providerRef?: string;
  status?: 'pending' | 'paid' | 'failed' | 'refunded';
  reason?: string;
}

export interface PaymentAdapter {
  readonly code: PaymentProviderCode;
  readonly displayName: string;
  readonly supportedCurrencies: string[];

  createAdvance(
    credentials: Record<string, string>,
    req: CreateAdvanceRequest,
  ): Promise<CreateAdvanceResult>;

  verifyWebhook(req: VerifyWebhookRequest): Promise<VerifyWebhookResult>;
}

export class PaymentRegistry {
  private adapters = new Map<PaymentProviderCode, PaymentAdapter>();

  register(adapter: PaymentAdapter): void {
    this.adapters.set(adapter.code, adapter);
  }

  get(code: PaymentProviderCode): PaymentAdapter | undefined {
    return this.adapters.get(code);
  }

  list(): PaymentAdapter[] {
    return Array.from(this.adapters.values());
  }
}

export const paymentRegistry = new PaymentRegistry();

export { jazzcashAdapter } from './adapters/jazzcash.js';
export { easypaisaAdapter } from './adapters/easypaisa.js';
export { sadapayAdapter } from './adapters/sadapay.js';
export { stripeAdapter } from './adapters/stripe.js';
export { razorpayAdapter } from './adapters/razorpay.js';
