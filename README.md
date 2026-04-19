# Cashflow COD

> **Advanced Cash-on-Delivery order form app for Shopify — built for high-RTO markets.**

Cashflow COD replaces Shopify's default checkout for cash-on-delivery orders with a
fast, customizable one-page / popup form designed for markets where COD is the
dominant payment method (Pakistan, India, MENA, South-east Asia).

Beyond the form, the app runs the entire COD operations pipeline:
**form → verify → ship → track → analyze → recover.**

## Status

**Pre-alpha / scaffolding.** The initial product plan lives in
[`docs/PLAN.md`](docs/PLAN.md). Code scaffolding and first feature PRs are
tracked in GitHub Issues / pull requests.

## Planned Highlights

- Drag-and-drop form builder with conditional logic & multi-step forms
- Popup, embedded, and slide-over layouts (mobile-first)
- SMS & WhatsApp OTP, phone / IP / postal-code fraud rules, velocity limits
- Pre-purchase, post-purchase, one-tick upsells + quantity offers + A/B testing
- AI RTO-risk scoring for every order
- One-click Pakistan & global courier booking (Postex, Leopards, TCS, Trax,
  M&P, BlueEx, Swyft, Call Courier, Daewoo, Aramex, DHL, ShipRocket, …)
- Call-center / agent workflow (queues, dispositions, attempt logs)
- AI voice confirmation agent (Urdu / English / Arabic)
- Native WhatsApp Business API 2-way chat
- Abandoned-form recovery (not just checkout)
- Cross-store fraud graph, partial-advance COD payments, custom landing pages
- Pixel + CAPI for Meta / TikTok / Google / Snapchat / Pinterest
- Google Sheets, Klaviyo, Omnisend, generic webhooks
- 15+ languages with full RTL (Urdu Nastaliq, Arabic)
- Shopify-embedded admin (Polaris) + Shopify Functions shipping rates

See [`docs/PLAN.md`](docs/PLAN.md) for the full product plan, feature list,
architecture, data model, roadmap, and pricing.

## Tech Stack

- **App framework:** Shopify Remix + Polaris + App Bridge 4
- **Storefront injection:** Theme App Extension (App Embed Block) with a
  Preact-powered form renderer (~30 KB gz)
- **Database:** PostgreSQL + Prisma
- **Cache / queues:** Redis + BullMQ
- **Analytics:** ClickHouse
- **ML service:** Python + FastAPI (RTO risk scoring)
- **Messaging:** Twilio / 360Dialog / Gupshup / local PK providers (pluggable)
- **Hosting:** Fly.io + Neon + Upstash + Cloudflare R2
- **Language:** TypeScript (strict) end-to-end; Python for ML service

## Repository Layout (planned)

```
cashflow-cod/
├── apps/
│   ├── admin/          # Shopify Remix embedded merchant app
│   ├── worker/         # BullMQ background workers
│   ├── ml-service/     # FastAPI RTO scoring + AI agent
│   └── landing/        # Marketing / docs site
├── packages/
│   ├── shared-types/
│   ├── form-schema/
│   ├── couriers/       # PK + global courier adapters
│   ├── messaging/      # SMS / WA / voice provider adapters
│   ├── pixels/         # Meta / TikTok / Google CAPI
│   └── ui-storefront/  # Preact form renderer
├── docs/
│   └── PLAN.md
└── README.md
```

## Development

Scaffold arrives in the first feature PR (`devin/*-scaffold`). Once merged,
local setup will be:

```bash
pnpm install
pnpm docker:up          # Postgres + Redis + ClickHouse
pnpm --filter admin db:push
pnpm dev                # Runs all apps in parallel
```

## Contributing

PRs welcome once the scaffold lands. Until then, feedback on
[`docs/PLAN.md`](docs/PLAN.md) is the most useful contribution.

## License

MIT — see [`LICENSE`](LICENSE).
