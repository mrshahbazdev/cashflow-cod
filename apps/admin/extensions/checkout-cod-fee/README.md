# Checkout COD Fee + Upsell extension

Shopify Checkout UI extension that:

- shows a COD surcharge banner (configurable percentage)
- renders an optional one-tick upsell button that adds a product variant to the
  cart

This is a **scaffold** — wire it up to your store via the Shopify CLI:

```bash
cd apps/admin
shopify app build
shopify app deploy
```

## Settings

| Key             | Type                  | Notes |
|-----------------|------------------------|-------|
| `fee_percent`   | `number_decimal`       | e.g. `2.5` |
| `upsell_title`  | `single_line_text_field` | optional |
| `upsell_handle` | `single_line_text_field` | product variant ID (numeric) |

## Local development

```bash
pnpm install --filter checkout-cod-fee
shopify app dev
```

## File map

```
extensions/checkout-cod-fee/
├── shopify.extension.toml   # extension manifest
├── package.json             # extension-only deps
├── tsconfig.json            # extension TS config
├── locales/                 # i18n strings
└── src/index.tsx            # entry — renders Banner + Upsell button
```
