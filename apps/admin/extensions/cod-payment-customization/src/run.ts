/**
 * Shopify Function — hides Cash on Delivery as a payment method when the
 * cart total exceeds the merchant's configured threshold (e.g. high-risk
 * orders must pay online).
 *
 * Config metafield: cashflow.function-config = { "maxCodAmount": 5000 }
 */
interface FunctionInput {
  cart: { cost: { totalAmount: { amount: string } } };
  paymentMethods: Array<{ id: string; name: string }>;
  shop: { metafield: { value: string } | null };
}
interface FunctionResult {
  operations: Array<{ hide?: { paymentMethodId: string } }>;
}

export function run(input: FunctionInput): FunctionResult {
  const ops: FunctionResult['operations'] = [];
  const value = input?.shop?.metafield?.value;
  if (!value) return { operations: ops };
  try {
    const cfg = JSON.parse(value) as { maxCodAmount?: number };
    if (!cfg.maxCodAmount) return { operations: ops };
    const total = parseFloat(input.cart.cost.totalAmount.amount);
    if (Number.isNaN(total) || total <= cfg.maxCodAmount) return { operations: ops };
    for (const m of input.paymentMethods) {
      if (/cod|cash/i.test(m.name)) ops.push({ hide: { paymentMethodId: m.id } });
    }
    return { operations: ops };
  } catch {
    return { operations: ops };
  }
}
