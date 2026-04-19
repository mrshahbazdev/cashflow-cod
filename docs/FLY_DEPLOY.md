# Fly.io deployment guide

Cashflow COD ships as a single Docker container (Remix SSR + Prisma migrate on boot). Fly.io managed Postgres is provisioned separately. The Shopify admin app and public API (`/api/public/...`) run from the same deployment.

## One-time setup

1. Install flyctl + sign in:
   ```bash
   curl -L https://fly.io/install.sh | sh
   export PATH="$HOME/.fly/bin:$PATH"
   fly auth login    # or: export FLY_API_TOKEN=<token>
   ```

2. Launch the app (from repo root):
   ```bash
   fly launch --name cashflow-cod --region fra --no-deploy --copy-config
   ```
   - Answers: use existing `fly.toml`? **yes** · create Postgres? **no** (we'll attach one below) · create Upstash Redis? **no** (not required for MVP)

3. Provision managed Postgres + attach:
   ```bash
   fly postgres create --name cashflow-cod-db --region fra --initial-cluster-size 1 --vm-size shared-cpu-1x --volume-size 3
   fly postgres attach cashflow-cod-db --app cashflow-cod
   ```
   Fly injects `DATABASE_URL` automatically into the app.

4. Set Shopify + messaging secrets:
   ```bash
   fly secrets set \
     SHOPIFY_API_KEY=<client-id> \
     SHOPIFY_API_SECRET=<client-secret> \
     SHOPIFY_APP_URL=https://cashflow-cod.fly.dev \
     SCOPES=read_orders,write_orders,read_products,write_draft_orders,write_customers,read_customers \
     --app cashflow-cod

   # Optional (only if OTP provider = twilio):
   fly secrets set TWILIO_ACCOUNT_SID=... TWILIO_AUTH_TOKEN=... TWILIO_SMS_FROM=... --app cashflow-cod
   ```

5. Deploy:
   ```bash
   fly deploy --app cashflow-cod
   ```
   - Builds the Dockerfile, runs `prisma migrate deploy` on container boot (via `docker-start`), then starts `remix-serve`.
   - Health check hits `GET /healthz` → `200`.

## After first deploy

1. Copy the live URL (e.g. `https://cashflow-cod.fly.dev`).
2. In Shopify Partner dashboard → **Cashflow COD → Configuration**:
   - **App URL:** `https://cashflow-cod.fly.dev`
   - **Allowed redirection URLs** (add all three):
     ```
     https://cashflow-cod.fly.dev/auth/callback
     https://cashflow-cod.fly.dev/auth/shopify/callback
     https://cashflow-cod.fly.dev/api/auth/callback
     ```
3. Install the app on your dev store: Partner dashboard → **Test your app** → pick your store → **Install**.

## Post-deploy sanity checks

```bash
curl https://cashflow-cod.fly.dev/healthz
# → {"status":"ok","uptime":...}

fly status --app cashflow-cod
fly logs --app cashflow-cod
```

## Redeploys

```bash
git push origin main          # merge PR
fly deploy --app cashflow-cod # rebuild + ship
```

## Theme App Extension

The storefront embed (`apps/admin/extensions/cod-form-embed`) is deployed separately via Shopify CLI from a developer machine:

```bash
cd apps/admin
pnpm exec shopify app deploy
```

Then enable the **Cashflow COD Form** app embed in the storefront theme editor → **App embeds**, set `api_origin` to `https://cashflow-cod.fly.dev`, and choose a form slug.
