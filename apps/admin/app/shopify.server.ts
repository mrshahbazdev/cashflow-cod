import '@shopify/shopify-app-remix/adapters/node';
import { ApiVersion, AppDistribution, shopifyApp } from '@shopify/shopify-app-remix/server';
import { PrismaSessionStorage } from '@shopify/shopify-app-session-storage-prisma';
import prisma from './db.server';
import { ensureShopForSession } from './lib/install.server';

if (!process.env.SHOPIFY_API_KEY) {
  throw new Error(
    'SHOPIFY_API_KEY is not set. The Shopify admin auth will return 401 for every request. ' +
      'Set it to the Client ID from your Shopify Partner Dashboard → App → API credentials.',
  );
}
if (!process.env.SHOPIFY_API_SECRET) {
  throw new Error(
    'SHOPIFY_API_SECRET is not set. Session-token validation will fail with 401. ' +
      'Set it to the Client secret from your Shopify Partner Dashboard → App → API credentials.',
  );
}
if (!process.env.SHOPIFY_APP_URL) {
  throw new Error(
    'SHOPIFY_APP_URL is not set. Auth redirects will break. ' +
      'Set it to your app\'s public URL (e.g. https://cashflow-cod.up.railway.app).',
  );
}

const shopify = shopifyApp({
  apiKey: process.env.SHOPIFY_API_KEY,
  apiSecretKey: process.env.SHOPIFY_API_SECRET,
  apiVersion: ApiVersion.January25,
  scopes: process.env.SCOPES?.split(','),
  appUrl: process.env.SHOPIFY_APP_URL,
  authPathPrefix: '/auth',
  sessionStorage: new PrismaSessionStorage(prisma),
  distribution: AppDistribution.AppStore,
  future: {
    unstable_newEmbeddedAuthStrategy: true,
    // Required since Apr 1, 2026: public apps must request expiring offline
    // access tokens. Without this flag Shopify rejects every Admin API call
    // with: "[API] Non-expiring access tokens are no longer accepted".
    expiringOfflineAccessTokens: true,
  },
  hooks: {
    afterAuth: async ({ session }) => {
      await ensureShopForSession(session);
    },
  },
  ...(process.env.SHOP_CUSTOM_DOMAIN
    ? { customShopDomains: [process.env.SHOP_CUSTOM_DOMAIN] }
    : {}),
});

export default shopify;
export const apiVersion = ApiVersion.January25;
export const addDocumentResponseHeaders = shopify.addDocumentResponseHeaders;
export const authenticate = shopify.authenticate;
export const unauthenticated = shopify.unauthenticated;
export const login = shopify.login;
export const registerWebhooks = shopify.registerWebhooks;
export const sessionStorage = shopify.sessionStorage;
