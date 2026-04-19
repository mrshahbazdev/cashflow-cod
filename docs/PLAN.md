# CODify Pro — Advanced COD Form App for Shopify
### Design & Product Plan (v0.1)

> **Working repo name (suggested):** `mrshahbazdev/codify-pro`
> (alternatives: `cod-form-pro`, `advanced-cod-form`, `cashflow-cod`)
> **Tagline:** *The most advanced COD order form for Shopify — built for high-RTO markets.*

---

## 1. Executive Summary

COD (Cash on Delivery) accounts for **50%+ of ecommerce transactions** in Pakistan, MENA, South Asia, and SEA. Shopify's native checkout is built around credit cards and adds friction (account creation, multi-step flow, English-only) that kills conversions in these markets.

Existing COD form apps (Releasit, EasySell, CodMonster, EasyOrder, CodForm) have solved the **basic** one-page / popup form + upsell + OTP problem well. But they share significant gaps — especially around **fraud intelligence, courier integration, AI automation, and agent/operations workflows** — that we will exploit.

This app's positioning:

> **"The only COD form app that doesn't stop at the form — it runs your entire COD ops pipeline: form → verify → ship → track → analyze → recover."**

---

## 2. Competitor Analysis

| App | Rating | Pricing | Strengths | Gaps / Weaknesses |
|---|---|---|---|---|
| **Releasit** | 4.8 (2,624) | Free → $9.99 → $29.99 → $69.99 | Best-in-class form + upsells/downsells, A/B testing, 20+ languages, pixels, Google Sheets, OTP, abandoned recovery | No built-in courier integration, no AI fraud scoring, no call-center/agent workflow, no analytics beyond basics, no RTO prediction |
| **EasySell** | 9.3 (658) | Free → $9.95 → $24.95 | Clean UI, solid upsells, pixel integration, Google Sheets export | Limited form builder flexibility, no WhatsApp business API, no CRM, no courier booking |
| **CodMonster** | — | Free plan | Quantity offers, WhatsApp confirm | Limited analytics, no AI, no courier |
| **CodForm** | 5.0 (4) | Free plan | Auto-WhatsApp confirmation, pixels | Small scale, limited features |
| **COD-Verify** | 5.0 (1) | Free | WhatsApp OTP + auto-cancel | Only OTP, not a form builder |
| **Cartsaver OTP CoD** | 5.0 (30) | Free plan | OTP focus | Only OTP |
| **PostEx / Universal Courier** | 3.3 (11) | Free + usage | Pakistan courier integrations | Not a form app — just fulfillment |
| **Payflow** | 4.9 (110) | Free plan | COD fee + payment method rules | Not a form builder |

### Common features across competitors (table stakes)
- Popup & embedded form layouts
- Name / phone / address / city / notes fields
- Product variant + quantity selection
- Pre-purchase, post-purchase, one-tick upsells
- Quantity discounts / bulk offers
- SMS & WhatsApp OTP
- IP blocking, phone blocklist, postal code allow/deny
- Google Sheets sync, abandoned cart recovery
- Facebook / TikTok / Google / Snapchat / Pinterest pixel + CAPI
- Multi-language (English + a few regional)
- Google Places autocomplete

### Gaps we will exploit (our differentiation)
1. **AI RTO-risk scoring** — Score every order 0-100 for likelihood of refusal/return based on address quality, phone pattern, city, order history, time-of-day, device fingerprint, velocity. *No existing COD form app does this.*
2. **Full Pakistan courier integration inside the form app** — Postex, Leopard, TCS, Trax, M&P, BlueEx, Swyft, Call Courier, Daewoo — one-click booking, label printing, live tracking, auto-fulfillment. Competitors either only do forms OR only do courier, never both integrated.
3. **Agent / call-center workflow** — Orders inbox with queues, agent assignment, call attempts log, disposition codes (confirmed, reschedule, no-answer, fake), WhatsApp chat drawer per order, keyboard-shortcut-driven. Designed for human confirmation teams that high-RTO stores already run.
4. **AI confirmation agent (voice + chat)** — Auto-calls customer in Urdu/English/Arabic via ElevenLabs+Twilio, confirms order, captures disposition. Reduces manual call-center load by 60–80%.
5. **Smart abandoned-form recovery** — Detects form abandonment (email/phone captured but not submitted), triggers WhatsApp template message with deep-link to pre-filled form. Competitors recover *checkout* abandonment; we recover *form* abandonment.
6. **Fraud Graph** — Cross-store blacklist network (opt-in). If a phone number has refused orders on 3+ stores in our network, flag it. Network-effect fraud prevention.
7. **Real-time RTO dashboard per city / courier / product** — Merchants see which cities/couriers/products have the worst RTO and can automatically disable COD for them or charge an advance fee.
8. **Partial advance / split payment on COD** — Take 10–50% advance via JazzCash/EasyPaisa/Stripe, rest on delivery. Drastically reduces RTO for risky orders — triggered automatically by AI risk score.
9. **Native WhatsApp Business API** — Not just notifications: full 2-way WA chat widget in merchant dashboard, template management, broadcast to customer segments.
10. **Form builder is truly drag-and-drop** — Every competitor has a "customization panel" (colors/fields). Ours is a visual builder (like Typeform/Tally) with conditional logic, multi-step forms, custom HTML blocks, and saved templates.
11. **A/B test *everything*** — Not just upsells. Test form headlines, field order, button colors, layouts, pricing, shipping displays — all with automatic winner picking.
12. **Shopify Functions-powered shipping rates** — City-based, weight-based, COD-fee-based dynamic rates computed server-side with Shopify Functions (compliant + fast).
13. **Offline/low-bandwidth mode** — Progressive form that works on 2G. Critical for rural Pakistan / Tier-3 Indian cities.
14. **Multi-store / merchant group** — One subscription covers multiple stores. Central ops dashboard, shared blocklists. Dropshipper-friendly.
15. **Native RTL + Urdu + Arabic + Hindi + Pashto + Bengali** — Proper right-to-left, Urdu Nastaliq font (Jameel Noori), translation quality checked by native speakers.

---

## 3. Feature List

### 3.1 MVP (Phase 1) — shippable to App Store in ~4–6 weeks

#### Core form
- Popup + embedded layouts, product page + cart page + dedicated landing page placement
- Drag-and-drop form builder with conditional logic
- Fields: name, phone (country picker), email (optional), address, city, postal code, notes, custom fields
- Multi-step form option
- Google Places autocomplete (and a free Nominatim fallback)
- Mobile-first responsive design, dark-mode aware

#### COD essentials
- Replace Shopify checkout's COD step (opt-in — merchant chooses)
- Creates native Shopify order via Admin API (so Shopify reports, reports, analytics all work)
- COD fee (flat / % / weight-based) — visible on form
- Quantity offers (Buy 2 get 10% off etc.)
- Pre-purchase & post-purchase one-tick upsells
- Discount code field

#### Fraud & verification
- SMS OTP (Twilio / MessageBird / Vonage / local PK providers: Jazz, Ufone SMS)
- WhatsApp OTP (Twilio WA Business / 360Dialog / Gupshup)
- Auto-cancel unverified orders after configurable timeout
- IP blocklist, phone blocklist, country allow/deny
- Postal code / city allow/deny
- Order velocity limits (max N orders per phone/IP/day)

#### Notifications & recovery
- Auto WhatsApp confirmation message after order
- Abandoned form recovery (email/WA if phone+email captured but form not submitted)
- SMS shipping updates

#### Integrations
- Google Sheets (real-time append + history)
- Webhooks (generic)
- Meta Pixel + CAPI, TikTok Pixel + Events API, Google Ads + Analytics 4, Snapchat, Pinterest
- Klaviyo, Omnisend (email)

#### Admin
- Shopify embedded admin (Polaris)
- Orders inbox with search/filter/bulk actions
- Analytics dashboard (form views, submits, conversion, AOV, RTO)
- Settings (branding, languages, fields, rules)

#### Platform
- 15+ languages with RTL (EN, UR, AR, HI, BN, FR, ES, PT, TR, ID, VI, TH, ZH, DE, IT)
- Multi-currency (via Shopify Markets)
- GDPR compliance (data export + delete endpoints)

### 3.2 Phase 2 (weeks 6–10) — the "why we win" features

- **AI RTO-risk scoring** (ML model, trained on merchant's own data + our network)
- **Pakistan courier integrations** (Postex, Leopard, TCS, Trax, M&P, BlueEx, Swyft, Call Courier, Daewoo) — one-click booking, label printing, live tracking, auto-fulfillment
- **Global courier integrations** (ShipRocket India, Aramex MENA, DHL, local carriers per region via ShipStation-like abstraction)
- **Agent / call-center workflow** — queues, assignments, dispositions, attempt logs
- **WhatsApp Business API native chat** (2-way, in-app inbox)
- **Shopify Functions**-based shipping rate calculator
- **Partial / split payment** on COD (advance via JazzCash, EasyPaisa, SadaPay, Stripe, Razorpay)
- **Smart abandoned-form recovery** with WhatsApp deep-link
- **A/B testing framework** for any element
- **Custom domain landing pages** (store.codifypro.app/form/:slug) for ad campaigns that bypass Shopify entirely

### 3.3 Phase 3 (weeks 10–16+) — moat

- **AI confirmation voice agent** (auto-call in native language, capture disposition)
- **Fraud Graph** cross-store blacklist network
- **RTO analytics suite** (per city, courier, product, SKU, time)
- **Multi-store / merchant group** (one dashboard, many stores)
- **Native mobile app** for agents (React Native) — call, confirm, dispatch on the go
- **Offline-capable form** (2G/3G progressive form)
- **Marketplace of form templates** (industry-specific, region-specific)

---

## 4. Technical Architecture

### 4.1 Stack

| Layer | Choice | Why |
|---|---|---|
| **App framework** | Shopify Remix (latest official template) + App Bridge 4 | SSR, official path, future-proof |
| **Admin UI** | Shopify Polaris v13 + Polaris Web Components | Native feel, App Store approval friendly |
| **Storefront injection** | Theme App Extension (App Embed Block) with vanilla JS + Web Components | Theme-agnostic, no code edits by merchant |
| **Form renderer (storefront)** | Preact (10KB) + Shoelace / custom Web Components | Small bundle, fast FCP |
| **Database** | PostgreSQL 16 | Relational, transactional, merchant data |
| **ORM** | Prisma | Type-safe, Remix-native |
| **Cache / queue** | Redis + BullMQ | OTP rate limit, webhook retries, job queue |
| **Search / analytics** | ClickHouse (events, pixels, RTO stats) | Columnar, fast aggregation |
| **File storage** | Cloudflare R2 / AWS S3 | Labels, CSV exports, form assets |
| **Background workers** | Node.js BullMQ workers | OTP, webhooks, courier bookings, AI scoring |
| **AI / ML** | OpenAI / Gemini for LLM features; internal XGBoost model for RTO scoring (served via FastAPI microservice) | Cost-controlled, domain-specific |
| **Voice AI** | ElevenLabs + Twilio Programmable Voice | Best-in-class TTS, multi-lingual |
| **SMS** | Twilio (default) + pluggable (MessageBird, Vonage, Jazz, Ufone, Gupshup) | Global + local |
| **WhatsApp** | 360Dialog / Gupshup (WA Business API) + Twilio fallback | Lower cost for PK/IN |
| **Hosting** | Fly.io (app + workers) + Neon (Postgres) + Upstash (Redis) | Scale-to-zero, low cost, global edge |
| **CDN** | Cloudflare (theme extension assets) | Free, global |
| **Monitoring** | Sentry + Axiom (logs) + BetterStack (uptime) | Startup-friendly |
| **Testing** | Vitest + Playwright + Shopify CLI test utilities | Fast, modern |
| **CI/CD** | GitHub Actions → Fly deploy on merge | Standard |
| **Lint / format** | ESLint + Prettier + TypeScript strict | Quality |

### 4.2 Repository Structure (monorepo via pnpm workspaces)

```
codify-pro/
├── apps/
│   ├── admin/                    # Shopify Remix embedded app (merchant admin)
│   │   ├── app/
│   │   │   ├── routes/           # Remix routes (Polaris pages)
│   │   │   ├── lib/              # Server-side helpers (Shopify API, Prisma)
│   │   │   ├── components/       # Polaris-based components
│   │   │   └── db.server.ts
│   │   ├── prisma/
│   │   ├── extensions/
│   │   │   ├── cod-form-embed/   # Theme app extension (App Embed Block)
│   │   │   │   ├── blocks/*.liquid
│   │   │   │   ├── assets/form-widget.js  (Preact bundle)
│   │   │   │   ├── assets/form-widget.css
│   │   │   │   └── shopify.extension.toml
│   │   │   ├── shipping-function/ # Shopify Function (Rust/WASM) for dynamic COD rates
│   │   │   └── checkout-ui/      # Optional Checkout UI extension for COD fee/upsell
│   │   └── shopify.app.toml
│   ├── worker/                   # Node + BullMQ background workers
│   │   ├── jobs/otp.ts
│   │   ├── jobs/webhook.ts
│   │   ├── jobs/courier-booking.ts
│   │   └── jobs/rto-scoring.ts
│   ├── ml-service/               # Python FastAPI for RTO model + AI agent
│   │   ├── rto_model/
│   │   └── main.py
│   └── landing/                  # Marketing site (Astro) + docs
├── packages/
│   ├── shared-types/             # TS types shared admin/worker/form-widget
│   ├── form-schema/              # Form JSON schema + validators (Zod)
│   ├── couriers/                 # Courier adapters (Postex, TCS, ...)
│   ├── messaging/                # SMS/WA provider adapters
│   ├── pixels/                   # Pixel + CAPI abstractions
│   └── ui-storefront/            # Preact form renderer
├── .github/workflows/
├── docker-compose.yml            # Postgres + Redis + ClickHouse for local dev
├── pnpm-workspace.yaml
└── README.md
```

### 4.3 Data Model (Prisma — condensed)

```
Shop (id, domain, plan, settings, accessToken, installedAt)
Form (id, shopId, name, slug, schema JSONB, layout, placement, isActive, abTestGroup)
FormView (id, formId, visitorId, ip, userAgent, country, createdAt)
Submission (id, formId, visitorId, status, fieldsEncrypted, createdAt)
Order (id, shopId, shopifyOrderId, submissionId, formId, riskScore, riskReason, phone, phoneNormalized, email, address, city, lineItems JSONB, total, codFee, upsells JSONB, discounts, agentId, disposition, attempts, createdAt, ...)
OtpToken (id, orderId, channel, code, verifiedAt, expiresAt)
Blocklist (id, shopId, type[phone|ip|email|postal], value, reason, expiresAt)
NetworkBlocklist (id, valueHash, type, confirmedCount, lastReportedAt)  // cross-store
Agent (id, shopId, userId, role, isActive, lastSeenAt)
AgentAction (id, orderId, agentId, actionType, note, nextFollowUpAt, createdAt)
CourierBooking (id, orderId, courier, consignmentNumber, labelUrl, status, trackingEvents JSONB, bookedAt)
Message (id, orderId, channel[sms|wa|email|voice], direction, templateId, payload, status, sentAt, providerId)
ABTest (id, shopId, entity[form|upsell|...], variants JSONB, metric, winner, startedAt, endedAt)
Webhook (id, shopId, topic, url, secret, lastDeliveryAt)
Pixel (id, shopId, provider, pixelId, accessToken, capiEnabled, testCode)
Event (ClickHouse — id, shopId, type, payload, ts)  // form_view, form_submit, otp_sent, otp_verified, order_created, rto_predicted, rto_actual
```

### 4.4 Storefront Form Architecture

1. Merchant installs app → Theme App Extension becomes available in theme editor.
2. Merchant enables "COD Form" app embed block on product page / cart page.
3. On page load, `form-widget.js` (~30KB gz) fetches form schema from our edge API (`https://api.codifypro.app/shop/:domain/form/:slug`) with 24h cache.
4. Preact renders form with merchant's theme colors (reads CSS variables).
5. On submit:
   - Client-side validation (Zod)
   - POST to `https://api.codifypro.app/submit` with Shopify shop + form + visitor metadata
   - Server: fraud checks → RTO scoring → OTP trigger (if enabled) → Shopify order create → webhook fan-out → pixel fire
   - Response: order number + next step (OTP screen / thank-you / upsell)

### 4.5 Security & Compliance

- OAuth via Shopify Managed Installation
- Webhooks HMAC-verified (Shopify + internal)
- Customer PII encrypted at rest (field-level AES-GCM with envelope keys in AWS KMS)
- GDPR: customers/data_request, customers/redact, shop/redact webhooks handled
- Billing via Shopify Billing API (GraphQL) — no external payments
- Rate limits on OTP (5/hour/phone), form submit (10/min/IP)
- SOC2 roadmap for enterprise tier

---

## 5. UI / UX Approach

### 5.1 Merchant admin (Shopify embedded)

Navigation (Polaris sidebar):
1. **Home** — setup checklist, today's stats, AI insights
2. **Forms** — list + drag-and-drop builder + preview
3. **Orders** — inbox with agent workflow, filters, bulk actions, RTO risk column
4. **Customers** — phone/email lookup, blocklist management, history
5. **Shipping** — courier accounts, rules, label printing, tracking
6. **Upsells** — pre/post/one-tick upsells, quantity offers, A/B tests
7. **Integrations** — pixels, Google Sheets, webhooks, Klaviyo, WhatsApp
8. **Analytics** — funnels, RTO, AOV, cohorts, attribution
9. **Settings** — branding, languages, team/agents, billing, API keys

### 5.2 Storefront form

- Three layouts: **Popup** (button trigger), **Embedded inline** (below Add-to-Cart), **Slide-over** (mobile bottom sheet)
- Multi-step option: Step 1 info → Step 2 address → Step 3 review+upsells → Step 4 OTP → Thank you
- Skeleton loaders, optimistic UI, trust badges, social proof counters

### 5.3 Mockup outline (to be built in Figma before code)

- 8 admin screens (home, form builder, order inbox, agent view, courier settings, analytics, settings, billing)
- 6 storefront screens (embed CTA, popup open, multi-step, OTP, upsell, thank-you)
- 3 mobile app agent screens (phase 3)

---

## 6. Monetization

| Plan | Price | Orders/month | Features |
|---|---|---|---|
| **Free** | $0 | 50 | Core form, 1 upsell, SMS OTP (50/mo), Google Sheets, basic pixels |
| **Starter** | $14.99/mo | 500 | + unlimited upsells, WA OTP, abandoned recovery, 3 pixels, 3 languages |
| **Pro** | $39.99/mo | 2,500 | + AI RTO scoring, courier integrations (PK+global), agent workflow (3 seats), A/B testing, all pixels + CAPI |
| **Scale** | $99.99/mo | 10,000 | + unlimited agents, WhatsApp Business API, AI voice agent (500 calls), multi-store (3), fraud graph, priority support |
| **Enterprise** | Custom | Unlimited | + SLA, dedicated support, custom ML models, SSO, audit logs |

Usage-based add-ons (pay as you go): SMS (cost + 10%), WA messages (cost + 10%), AI voice minutes (cost + 20%), ML scoring requests (covered by plan).

Target: 500 paying merchants @ avg $35/mo = **~$17.5k MRR** by month 6.

---

## 7. Development Roadmap

| Week | Milestone | Output |
|---|---|---|
| 0 (now) | Plan approved, repo created, Figma mockups | This doc, wireframes |
| 1 | Scaffold monorepo, Remix app boots, Prisma schema v1, theme app extension renders "Hello world" block | First PR |
| 2 | Form schema + storefront renderer (Preact), admin form builder v1 (simple field editor), order creation via Admin API | Working end-to-end "plain" form |
| 3 | OTP (SMS + WA), fraud rules (blocklist, velocity), abandoned form recovery | Fraud + verify layer |
| 4 | Upsells (pre/post/one-tick), quantity offers, discount codes, COD fee | AOV layer |
| 5 | Pixels (Meta + TikTok + Google CAPI), Google Sheets sync, webhooks, Klaviyo | Integrations layer |
| 6 | Analytics dashboard v1, multi-language (5 core: EN, UR, AR, HI, ES), RTL support, mobile polish | MVP ready for beta |
| 7 | Beta with 10 merchants, feedback iteration, App Store submission | App listed |
| 8–10 | Phase 2: AI RTO scoring, PK couriers, agent workflow, WA Business API, Shopify Functions shipping | Premium-plan features |
| 11–14 | Phase 2 cont'd: A/B testing engine, partial payments (JazzCash/EasyPaisa/Stripe/Razorpay), global couriers | International expansion |
| 15–18 | Phase 3: AI voice agent, fraud graph, advanced analytics, multi-store | Moat features |
| 19+ | Native agent mobile app, offline form, template marketplace | Platform |

---

## 8. Immediate Next Steps (after you approve this plan)

1. Confirm repo name (I suggest **`codify-pro`** — short, memorable, brand-ready).
2. I create the repo + monorepo scaffold + Shopify CLI app init + first Remix route + theme app extension hello-world.
3. Open first PR with the scaffold so you can see the skeleton on CI, then iterate feature-by-feature (one PR per feature for easy review).
4. In parallel, I'll draft Figma-style HTML mockups of the key screens so you can validate the visual direction before we invest in code.

---

## 9. Open Questions for You

1. **Repo name**: `codify-pro` OK, or different?
2. **Shopify Partner account**: Do you already have one? Do we target App Store listing (public app) or embedded custom app (your store only)?
3. **Hosting**: Fly.io + Neon OK (cheap + fast), or do you prefer AWS / Vercel / your own servers?
4. **Domain**: Do you own one for the app (e.g. `codifypro.app`), or want me to suggest + register?
5. **Priority phase cut**: Is the Phase 1 MVP scope above OK, or should we also include 1–2 Phase 2 items in v1 (e.g. PK courier integration, since that's your stated market)?
6. **SMS/WA providers in Pakistan**: Do you have an existing account (Jazz, Ufone, Gupshup, 360Dialog)? If not, I'll bake in Twilio as default and add local providers later.
7. **Design**: Do you want me to build HTML mockups (fast, reviewable in browser) or skip straight to code? Given you chose "plan first," I'd suggest mockups — safer.
8. **Timeline**: Are the above week estimates acceptable, or do you need the MVP faster (I can aggressively parallelize and cut Phase 1 scope to 2–3 weeks)?

---

*Once you approve (or tweak) this plan, I'll scaffold the repo and start shipping PRs. No code will be written until you confirm.*
