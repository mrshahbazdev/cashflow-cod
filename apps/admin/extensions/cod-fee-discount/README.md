# Cashflow COD — fee-as-discount Shopify Function (scaffold)

Applies the merchant's configured COD surcharge to the cart at checkout via a
Shopify cart-transform Function. Configuration lives in the shop metafield
`cashflow.function-config` (managed by the admin UI at `/app/functions`).

## Deploy

```bash
cd apps/admin
shopify app function typegen      # codegen for src/run.ts
shopify app function build        # compile to .wasm via Javy
shopify app deploy
```

## Files

- `shopify.extension.toml` — extension manifest (target, build, UI paths)
- `src/run.ts` — function entrypoint (no-op stub)
- `src/run.graphql` — input query (cart + shop metafield)
