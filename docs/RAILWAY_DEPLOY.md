# Railway deployment guide

Cashflow COD ships as a single Docker container (Remix SSR + Prisma migrate on boot). Postgres is provisioned by Railway. The Shopify admin app and public API (`/api/public/...`) run from the same deployment.

## One-time setup

1. Install the Railway CLI (optional, Dashboard also works):
   ```bash
   npm i -g @railway/cli
   railway login
   ```

2. Create a new project:
   ```bash
   railway init cashflow-cod
   ```

3. Add a Postgres plugin (Dashboard → **+ New → Database → PostgreSQL**). Railway will expose `DATABASE_URL` as a shared variable.

4. Link your GitHub repo (Dashboard → **Settings → Service → Source**). Railway reads `railway.json` + `Dockerfile` automatically.

## Environment variables

Set these on the service (Dashboard → **Variables**):

| Variable | Value | Notes |
| --- | --- | --- |
| `DATABASE_URL` | (Postgres plugin) | auto-provided |
| `SHOPIFY_API_KEY` | Partner app Client ID | |
| `SHOPIFY_API_SECRET` | Partner app Client secret | |
| `SHOPIFY_APP_URL` | `https://<railway-domain>` | set after first deploy |
| `SCOPES` | `read_orders,write_orders,read_products,write_draft_orders,write_customers,read_customers` | |
| `NODE_ENV` | `production` | |
| `PORT` | `3000` | Railway also injects this |
| `TWILIO_ACCOUNT_SID` | (optional) | if OTP provider = `twilio` |
| `TWILIO_AUTH_TOKEN` | (optional) | |
| `TWILIO_SMS_FROM` | (optional) | |
| `TWILIO_WA_FROM` | (optional) | |

## First deploy

1. Railway auto-detects `railway.json` + `Dockerfile` and builds:
   - `pnpm install --frozen-lockfile`
   - `prisma generate`
   - `remix vite:build`
2. On container boot, `docker-start` runs `prisma migrate deploy` before `remix-serve`.
3. Health check hits `GET /healthz` → `200 { "status": "ok" }`.
4. Once live, copy the Railway-generated URL (e.g. `cashflow-cod-production.up.railway.app`) and:
   - Set `SHOPIFY_APP_URL` to `https://<that-url>` and redeploy.
   - In the Shopify Partner dashboard → **Cashflow COD → Configuration**, update:
     - **App URL:** `https://<railway-url>`
     - **Allowed redirection URLs:**
       - `https://<railway-url>/auth/callback`
       - `https://<railway-url>/auth/shopify/callback`
       - `https://<railway-url>/api/auth/callback`
5. Install the app on your dev store (Partner dashboard → **Test your app**).

## Post-deploy sanity checks

```bash
# Health check
curl https://<railway-url>/healthz
# → {"status":"ok","uptime":...}

# Public form endpoint (after creating a form in admin)
curl "https://<railway-url>/api/public/forms/default?shop=<your-store>.myshopify.com"
```

## Managing the Theme App Extension

The extension (`apps/admin/extensions/cod-form-embed`) is deployed separately via Shopify CLI. On a developer machine with the dev store linked:

```bash
cd apps/admin
pnpm exec shopify app deploy
```

Then enable the **Cashflow COD Form** app embed from the storefront theme editor → **App embeds**, set the API origin to your Railway URL, and choose a form slug.
