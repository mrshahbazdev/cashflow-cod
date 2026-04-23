import type {
  CreateAdvanceRequest,
  CreateAdvanceResult,
  VerifyWebhookRequest,
  VerifyWebhookResult,
} from '../index.js';

/**
 * Shared mock implementation used by every adapter when the merchant chose
 * "mock" mode or when live credentials are not configured. Generates a fake
 * checkout URL and a predictable-looking provider ref.
 */
export function mockCreateAdvance(
  code: string,
  req: CreateAdvanceRequest,
): Promise<CreateAdvanceResult> {
  const providerRef = `mock_${code}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const q = new URLSearchParams({
    provider: code,
    ref: providerRef,
    amount: String(req.amount),
    currency: req.currency,
    orderId: req.orderId,
    return: req.returnUrl,
  });
  return Promise.resolve({
    providerRef,
    checkoutUrl: `https://mock-payments.example/${code}?${q.toString()}`,
    status: 'pending',
  });
}

export function mockVerifyWebhook(
  _code: string,
  req: VerifyWebhookRequest,
): Promise<VerifyWebhookResult> {
  try {
    const parsed = JSON.parse(req.rawBody) as Record<string, unknown>;
    const providerRef = typeof parsed.ref === 'string' ? parsed.ref : undefined;
    const status = typeof parsed.status === 'string' ? parsed.status : 'paid';
    return Promise.resolve({
      ok: true,
      providerRef,
      status: status as 'pending' | 'paid' | 'failed' | 'refunded',
    });
  } catch (e) {
    return Promise.resolve({ ok: false, reason: String(e) });
  }
}
