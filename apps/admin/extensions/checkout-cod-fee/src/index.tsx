/**
 * Cashflow COD — Shopify Checkout UI extension scaffold.
 *
 * Renders a COD surcharge notice and an optional one-tick upsell button on
 * Shopify's native checkout. Configured per-shop via the extension settings
 * (fee_percent, upsell_title, upsell_handle).
 *
 * NOTE: this is a scaffold for `shopify app build`. To compile, run:
 *   pnpm install --filter checkout-cod-fee
 *   shopify app build
 *
 * It is intentionally not part of the Remix server build and is excluded from
 * tsc / eslint at the workspace root.
 */
import {
  reactExtension,
  Banner,
  BlockStack,
  Button,
  Heading,
  Text,
  useApi,
  useApplyCartLinesChange,
  useSettings,
} from '@shopify/ui-extensions-react/checkout';

export default reactExtension('purchase.checkout.block.render', () => <CodFeeBlock />);

function CodFeeBlock() {
  const { i18n } = useApi();
  const settings = useSettings();
  const applyChange = useApplyCartLinesChange();

  const feePercent = Number(settings.fee_percent ?? 0);
  const upsellTitle = String(settings.upsell_title ?? '').trim();
  const upsellHandle = String(settings.upsell_handle ?? '').trim();

  async function addUpsell() {
    if (!upsellHandle) return;
    await applyChange({
      type: 'addCartLine',
      merchandiseId: `gid://shopify/ProductVariant/${upsellHandle}`,
      quantity: 1,
    });
  }

  return (
    <BlockStack spacing="base">
      {feePercent > 0 ? (
        <Banner status="info">
          <Text>
            {i18n.translate('cashflow.cod.fee', {
              percent: feePercent,
              fallback: `A ${feePercent}% Cash on Delivery surcharge applies at checkout.`,
            })}
          </Text>
        </Banner>
      ) : null}
      {upsellTitle && upsellHandle ? (
        <BlockStack spacing="tight">
          <Heading level={3}>{upsellTitle}</Heading>
          <Button onPress={addUpsell}>Add to order</Button>
        </BlockStack>
      ) : null}
    </BlockStack>
  );
}
