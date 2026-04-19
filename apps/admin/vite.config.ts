import { vitePlugin as remix } from '@remix-run/dev';
import { defineConfig } from 'vite';
import tsconfigPaths from 'vite-tsconfig-paths';

declare module '@remix-run/node' {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface Future {
    v3_singleFetch: true;
  }
}

const host = new URL(process.env.SHOPIFY_APP_URL ?? 'http://localhost').hostname;

let hmrConfig: { protocol: string; host: string; port: number; clientPort: number } | boolean;
if (host === 'localhost') {
  hmrConfig = {
    protocol: 'ws',
    host: 'localhost',
    port: 64999,
    clientPort: 64999,
  };
} else {
  hmrConfig = {
    protocol: 'wss',
    host,
    port: Number(process.env.FRONTEND_PORT) || 8002,
    clientPort: 443,
  };
}

const allowedHosts = [
  'localhost',
  ...(host && host !== 'localhost' ? [host] : []),
  ...(process.env.ALLOWED_HOSTS?.split(',')
    .map((h) => h.trim())
    .filter(Boolean) ?? []),
];

export default defineConfig({
  server: {
    port: Number(process.env.PORT || 3000),
    hmr: hmrConfig,
    fs: {
      allow: ['app', 'node_modules'],
    },
    allowedHosts,
  },
  plugins: [
    remix({
      ignoredRouteFiles: ['**/.*'],
      future: {
        v3_fetcherPersist: true,
        v3_relativeSplatPath: true,
        v3_throwAbortReason: true,
        v3_lazyRouteDiscovery: true,
        v3_singleFetch: true,
        v3_routeConfig: false,
      },
    }),
    tsconfigPaths(),
  ],
  build: {
    assetsInlineLimit: 0,
  },
  optimizeDeps: {
    include: ['@shopify/app-bridge-react', '@shopify/polaris'],
  },
});
