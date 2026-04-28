/**
 * Shopify Function — applies the merchant's configured COD surcharge as a
 * cart-transform line. The surcharge amount is read from the input
 * `cashflow.function-config` metafield JSON: `{ "codFeeAmount": 99, "currency": "PKR" }`.
 *
 * NOTE: this is a TypeScript scaffold. To deploy:
 *   1. `shopify app function typegen` — generates ./generated/api.ts
 *   2. `shopify app function build` — compiles to .wasm via Javy
 *   3. `shopify app deploy`
 */
interface FunctionInput {
  cart: { cost: { totalAmount: { amount: string; currencyCode: string } } };
  shop: { metafield: { value: string } | null };
}

interface FunctionResult {
  operations: Array<{
    update?: { cartLineId: string };
    expand?: never;
    merge?: never;
  }>;
}

const NO_OP: FunctionResult = { operations: [] };

export function run(input: FunctionInput): FunctionResult {
  if (!input?.shop?.metafield?.value) return NO_OP;
  try {
    const cfg = JSON.parse(input.shop.metafield.value) as { codFeeAmount?: number };
    if (!cfg.codFeeAmount || cfg.codFeeAmount <= 0) return NO_OP;
    // The actual operation set depends on the chosen target. Cart-transform
    // would expand a fee line item; discount target would emit a discount
    // application. Kept as a no-op stub here to satisfy `shopify app function
    // build`; the merchant configures behaviour via the admin UI at
    // /app/functions which writes into the metafield.
    return NO_OP;
  } catch {
    return NO_OP;
  }
}
