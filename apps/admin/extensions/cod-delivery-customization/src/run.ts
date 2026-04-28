/**
 * Shopify Function — hides delivery options for customers in cities the
 * merchant marked as "high-RTO" via the admin UI (/app/functions).
 *
 * Config metafield: cashflow.function-config = { "blockedCities": ["X","Y"] }
 */
interface FunctionInput {
  cart: { deliveryGroups: Array<{ deliveryAddress: { city: string | null } | null }> };
  deliveryOptions: Array<{ id: string; title: string }>;
  shop: { metafield: { value: string } | null };
}
interface FunctionResult {
  operations: Array<{ hide?: { deliveryOptionHandle: string } }>;
}

export function run(input: FunctionInput): FunctionResult {
  const ops: FunctionResult['operations'] = [];
  const value = input?.shop?.metafield?.value;
  if (!value) return { operations: ops };
  try {
    const cfg = JSON.parse(value) as { blockedCities?: string[] };
    const blocked = (cfg.blockedCities ?? []).map((c) => c.toLowerCase());
    if (!blocked.length) return { operations: ops };
    const cities = (input.cart.deliveryGroups ?? [])
      .map((g) => g.deliveryAddress?.city?.toLowerCase())
      .filter(Boolean);
    const isBlocked = cities.some((c) => c && blocked.includes(c));
    if (isBlocked) {
      for (const opt of input.deliveryOptions) {
        if (/cod|cash/i.test(opt.title)) {
          ops.push({ hide: { deliveryOptionHandle: opt.id } });
        }
      }
    }
    return { operations: ops };
  } catch {
    return { operations: ops };
  }
}
