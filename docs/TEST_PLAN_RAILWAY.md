# Cashflow COD — Railway E2E Test Plan (v2: split test)

## Why this was revised
My VM browser is hit by a Cloudflare human-verification challenge on every Shopify domain (`accounts.shopify.com`, `partners.shopify.com`, `*.myshopify.com`). The `Verify you are human` checkbox loops indefinitely on this VM — confirmed 3× in this session. I cannot click the Install button from my side. So the test is split:
- **User actions (UI, minimal):** install on `prodevnns` + create 1 form + send 2 screenshots (~90 seconds of user work).
- **Devin actions (backend verification):** the hard-to-fake assertions — public form API returns saved schema, submissions validate correctly, valid submission creates row, negative tests reject invalid input.

## Summary of what's being tested
Phases 1.1–1.7 live on Railway at `https://cashflow-cod-production-2aff.up.railway.app`.

## Primary E2E flow

### User steps (must be done by Muhammad on his machine)
1. https://partners.shopify.com → Apps → **Cashflow COD** → top-right **Test your app** → pick **prodevnns** → **Install app** → Install.
2. On `/app` (onboarding home): take a **full-page screenshot** and send it to me.
3. Click **Create your first form** → on `/app/forms` type `E2E Test Form` in "Form name" → click **Create form** → redirects to `/app/forms/<id>`.
4. On the builder page: click **Save** button (top right) — a toast saying `Form saved` should appear.
5. Read the `Slug` value visible in the "Basics" card (e.g. `e2e-test-form`) and send it to me in chat, along with a screenshot of the builder page.
6. (Optional, after I run my API tests) navigate to **Orders** (left nav) and take a screenshot showing the submitted order I created via curl.

### Devin steps (I will run these with curl against Railway)
Only after user confirms form is saved + I have the slug:

- **T1**: `curl https://cashflow-cod-production-2aff.up.railway.app/healthz` → `{ "status":"ok", ... }` HTTP 200.
- **T2**: `curl "https://cashflow-cod-production-2aff.up.railway.app/api/public/forms/<slug>?shop=prodevnns.myshopify.com"` → HTTP 200, JSON matches `{ form: { id, name: "E2E Test Form", slug: "<slug>", schema: { version, steps: [...] } } }`.
- **T3** (negative): same URL **without** `?shop=` → HTTP 400, body `{"error":"Query params `shop` and `slug` are required"}`.
- **T4** (validation negative): `POST /api/public/submissions` with `data: {}` (missing phone/name) → HTTP 200 body `{ ok:false, error:"Validation failed", fieldErrors: { <phone-field-key>: "... is required" } }`.
- **T5** (happy path): `POST /api/public/submissions` with valid `{ name, phone:"+923001234567", email:"test@example.com", city:"Karachi", address:"123 Test Rd" }` → HTTP 200, body `{ ok:true, submissionId: <non-empty-string>, requiresOtp: <bool>, orderId: <string|null> }`.

## Key adversarial assertions

| # | What & how | Would fail visibly if broken |
|---|---|---|
| A1 | `/app` title literally `Welcome to Cashflow COD`, subtitle `Installed on prodevnns.myshopify.com`, badge `FREE` | Install hook didn't run → Shop row missing → loader throws 404 |
| A2 | `/app` shows exactly `0 of 4 complete` with the 4 named step rows | Onboarding settings weren't seeded |
| A3 | Stat card `Team members 1` (NOT `0`) | OWNER Agent wasn't inserted — only Shop was created. Catches incomplete install hook. |
| A4 | Form creation redirects to `/app/forms/<id>` with non-empty id; Save shows `Form saved` toast | Builder action broken → stays on list page or error banner |
| A5 | T2 response body has `form.name === "E2E Test Form"` (the name user typed) AND `form.schema.steps` array non-empty | Form wasn't persisted, or public loader doesn't join schema |
| A6 | T3 returns HTTP 400, not 500 or 200 — proves `api.public.forms.$slug.ts:10-13` param validation runs | Missing validation → would 200 or 500 |
| A7 | T4 has `fieldErrors` object with the phone field's key AND error string ending in `is required` | Server-side validation bypassed → would 200 with submissionId |
| A8 | T5 `submissionId` is a non-empty string AND `requiresOtp` is boolean (not undefined) | Submission path broken; response shape is the contract the widget depends on |
| A9 | After T5, `/app/orders` (user screenshot) shows a new row with `customerName` = "Test Customer" and phone `+923001234567` | Submission→order wiring broken. If `requiresOtp:true` this row won't appear — I'll mark A9 as **expected-fail by design** and verify via `/app/analytics` / Submissions table instead. |

## Out of scope (explicitly)
- Shopify draft order creation on real Shopify store (depends on access token + store inventory; we verify at submission-response level not at Shopify order level).
- Theme App Embed UI test (requires storefront theme editing; API contract tested instead).
- OTP SMS delivery (adapter is `console` in prod — logs OTP, no real SMS).

## Evidence I will capture
- User screenshots (3): `/app` home, form builder with slug visible, `/app/orders` with submitted row.
- My terminal output for T1–T5 (all curl commands with request + response status + body).
- Full test report `.md` with all assertions marked pass/fail/inconclusive.

## If I am still blocked after user install
If user install fails or user can't send slug, I will at minimum run T1, T3, T4 (which need no app data). Those still prove: Railway service is healthy, routes are mounted, public API validation works. T2, T5, A9 would be marked untested in the report.
