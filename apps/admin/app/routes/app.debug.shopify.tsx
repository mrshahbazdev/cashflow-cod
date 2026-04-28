import { useEffect, useState } from 'react';
import type { ActionFunctionArgs, LoaderFunctionArgs } from '@remix-run/node';
import { json } from '@remix-run/node';
import { useFetcher, useLoaderData } from '@remix-run/react';
import {
  Banner,
  BlockStack,
  Box,
  Button,
  Card,
  InlineStack,
  Layout,
  Page,
  Text,
} from '@shopify/polaris';
import { authenticate } from '../shopify.server';
import prisma from '../db.server';

/**
 * Debug surface for the still-403-on-every-call problem on shahbazsevnns.
 *
 * Three actions, all scoped to the currently-authenticated shop:
 *
 *   probe-online   — run `query { shop { name } }` using the merchant's
 *                    online (per-user) admin client.
 *   probe-offline  — run the same query using the offline (shop-wide)
 *                    client returned by `unauthenticated.admin()`.
 *   reset-offline  — delete the offline Session row from PrismaSessionStorage.
 *                    Forces a fresh token-exchange on the next admin request,
 *                    which is the only documented way to recover from a
 *                    poisoned offline token.
 */

type DebugLoaderData = {
  shopDomain: string;
  offlineSession: {
    id: string;
    scope: string | null;
    expires: string | null;
    tokenLen: number;
    tokenPrefix: string;
  } | null;
};

export async function loader({ request }: LoaderFunctionArgs) {
  const { session } = await authenticate.admin(request);
  const offline = await prisma.session.findFirst({
    where: { shop: session.shop, isOnline: false },
    orderBy: { expires: 'desc' },
  });
  return json<DebugLoaderData>({
    shopDomain: session.shop,
    offlineSession: offline
      ? {
          id: offline.id,
          scope: offline.scope,
          expires: offline.expires?.toISOString() ?? null,
          tokenLen: offline.accessToken.length,
          tokenPrefix: offline.accessToken.slice(0, 8),
        }
      : null,
  });
}

type ActionResult =
  | { kind: 'probe-online'; ok: boolean; raw: string }
  | { kind: 'probe-offline'; ok: boolean; raw: string }
  | { kind: 'probe-rest-online'; ok: boolean; status: number; raw: string }
  | { kind: 'probe-rest-offline'; ok: boolean; status: number; raw: string }
  | { kind: 'reset-offline'; ok: boolean; deleted: number };

// shopify-app-remix sometimes throws the raw Response object instead of an
// Error subclass — String(response) returns "[object Response]" which is
// useless. Try harder to surface the actual body.
async function explainError(err: unknown): Promise<string> {
  if (err instanceof Error) return `${err.name}: ${err.message}`;
  if (err instanceof Response) {
    let body = '';
    try {
      body = await err.text();
    } catch {
      body = '(unreadable)';
    }
    return `Response status=${err.status} ${err.statusText}\n` +
      `headers=${JSON.stringify(Object.fromEntries(err.headers.entries()))}\n` +
      `body=${body}`;
  }
  if (err && typeof err === 'object') return JSON.stringify(err, null, 2);
  return String(err);
}

export async function action({ request }: ActionFunctionArgs) {
  const { session, admin } = await authenticate.admin(request);
  const form = await request.formData();
  const intent = form.get('intent');
  const apiVersion = (form.get('apiVersion') as string) || '2025-01';

  if (intent === 'probe-online') {
    try {
      const r = await admin.graphql('query { shop { name myshopifyDomain } }');
      const j = (await r.json()) as unknown;
      return json<ActionResult>({
        kind: 'probe-online',
        ok: true,
        raw: JSON.stringify(j, null, 2),
      });
    } catch (err) {
      return json<ActionResult>({
        kind: 'probe-online',
        ok: false,
        raw: await explainError(err),
      });
    }
  }

  if (intent === 'probe-offline') {
    const { unauthenticated } = await import('../shopify.server');
    try {
      const { admin: a } = await unauthenticated.admin(session.shop);
      const r = await a.graphql('query { shop { name myshopifyDomain } }');
      const j = (await r.json()) as unknown;
      return json<ActionResult>({
        kind: 'probe-offline',
        ok: true,
        raw: JSON.stringify(j, null, 2),
      });
    } catch (err) {
      return json<ActionResult>({
        kind: 'probe-offline',
        ok: false,
        raw: await explainError(err),
      });
    }
  }

  // Direct REST fetch with X-Shopify-Access-Token header — bypasses the
  // shopify-app-remix wrapper completely. If this also returns 403 the
  // problem is at the Shopify edge, not in our code.
  if (intent === 'probe-rest-online' || intent === 'probe-rest-offline') {
    const useOnline = intent === 'probe-rest-online';
    const sessionRow = await prisma.session.findFirst({
      where: { shop: session.shop, isOnline: useOnline },
      orderBy: { expires: 'desc' },
    });
    if (!sessionRow) {
      return json<ActionResult>({
        kind: useOnline ? 'probe-rest-online' : 'probe-rest-offline',
        ok: false,
        status: 0,
        raw: `No ${useOnline ? 'online' : 'offline'} session row in DB`,
      });
    }
    const url = `https://${session.shop}/admin/api/${apiVersion}/shop.json`;
    let status = 0;
    let body = '';
    try {
      const res = await fetch(url, {
        headers: {
          'X-Shopify-Access-Token': sessionRow.accessToken,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
      });
      status = res.status;
      body = await res.text();
    } catch (fetchErr) {
      body = `fetch threw: ${fetchErr instanceof Error ? fetchErr.message : String(fetchErr)}`;
    }
    return json<ActionResult>({
      kind: useOnline ? 'probe-rest-online' : 'probe-rest-offline',
      ok: status >= 200 && status < 300,
      status,
      raw: `URL: ${url}\nstatus=${status}\nbody=${body.slice(0, 4000)}`,
    });
  }

  if (intent === 'reset-offline') {
    const result = await prisma.session.deleteMany({
      where: { shop: session.shop, isOnline: false },
    });
    return json<ActionResult>({
      kind: 'reset-offline',
      ok: true,
      deleted: result.count,
    });
  }

  return json({ ok: false, error: 'Unknown intent' }, { status: 400 });
}

export default function DebugShopify() {
  const { shopDomain, offlineSession } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const [resetCount, setResetCount] = useState(0);

  // After a successful reset, the existing online session is also stale;
  // tell the user to reload so the new token-exchange happens.
  useEffect(() => {
    const data = fetcher.data as ActionResult | undefined;
    if (data?.kind === 'reset-offline' && data.ok) {
      setResetCount((n) => n + 1);
    }
  }, [fetcher.data]);

  const submit = (intent: string) => {
    const fd = new FormData();
    fd.set('intent', intent);
    fetcher.submit(fd, { method: 'post' });
  };

  return (
    <Page title="Shopify auth debug">
      <Layout>
        <Layout.Section>
          <Banner tone="warning">
            Internal debugging surface. Lets us reproduce the
            "403 Forbidden / GraphQL Client: Forbidden" issue on this shop and
            recover by deleting the poisoned offline session row.
          </Banner>
        </Layout.Section>

        <Layout.Section>
          <Card>
            <BlockStack gap="200">
              <Text as="h2" variant="headingMd">
                Current shop
              </Text>
              <Text as="p" variant="bodyMd">
                {shopDomain}
              </Text>

              <Text as="h3" variant="headingSm">
                Offline session row
              </Text>
              {offlineSession ? (
                <BlockStack gap="100">
                  <Text as="p" variant="bodyMd">
                    id: {offlineSession.id}
                  </Text>
                  <Text as="p" variant="bodyMd">
                    scope: {offlineSession.scope ?? '(none)'}
                  </Text>
                  <Text as="p" variant="bodyMd">
                    expires: {offlineSession.expires ?? '(none)'}
                  </Text>
                  <Text as="p" variant="bodyMd">
                    accessToken: {offlineSession.tokenPrefix}…
                    (len={offlineSession.tokenLen})
                  </Text>
                </BlockStack>
              ) : (
                <Text as="p" variant="bodyMd" tone="subdued">
                  No offline session row in PrismaSessionStorage.
                </Text>
              )}
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section>
          <Card>
            <BlockStack gap="300">
              <Text as="h2" variant="headingMd">
                Token probes
              </Text>
              <Text as="p" variant="bodyMd">
                Both run <code>{'query { shop { name } }'}</code>. If
                offline 403s but online succeeds, the offline token is
                poisoned and a reset will fix it.
              </Text>
              <InlineStack gap="200">
                <Button
                  loading={
                    fetcher.state !== 'idle' &&
                    (fetcher.formData?.get('intent') ?? '') === 'probe-online'
                  }
                  onClick={() => submit('probe-online')}
                >
                  Probe ONLINE (GraphQL)
                </Button>
                <Button
                  loading={
                    fetcher.state !== 'idle' &&
                    (fetcher.formData?.get('intent') ?? '') === 'probe-offline'
                  }
                  onClick={() => submit('probe-offline')}
                >
                  Probe OFFLINE (GraphQL)
                </Button>
                <Button
                  loading={
                    fetcher.state !== 'idle' &&
                    (fetcher.formData?.get('intent') ?? '') === 'probe-rest-online'
                  }
                  onClick={() => submit('probe-rest-online')}
                >
                  Probe ONLINE (REST, raw fetch)
                </Button>
                <Button
                  loading={
                    fetcher.state !== 'idle' &&
                    (fetcher.formData?.get('intent') ?? '') === 'probe-rest-offline'
                  }
                  onClick={() => submit('probe-rest-offline')}
                >
                  Probe OFFLINE (REST, raw fetch)
                </Button>
              </InlineStack>
              <Text as="p" variant="bodySm" tone="subdued">
                REST probes bypass shopify-app-remix entirely — they issue a
                bare <code>fetch()</code> with the access token, so they tell us
                whether Shopify is rejecting the token at the edge or whether
                only our wrapper sees the 403.
              </Text>
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section>
          <Card>
            <BlockStack gap="300">
              <Text as="h2" variant="headingMd">
                Reset offline session
              </Text>
              <Text as="p" variant="bodyMd">
                Deletes the offline Session row for this shop from
                PrismaSessionStorage. The next admin request will trigger a
                fresh token exchange and write a new row.
              </Text>
              {resetCount > 0 && (
                <Banner tone="success">
                  Offline session deleted. <strong>Reload this page</strong> to
                  trigger a fresh token exchange, then re-run the offline probe.
                </Banner>
              )}
              <InlineStack gap="200">
                <Button
                  tone="critical"
                  loading={
                    fetcher.state !== 'idle' &&
                    (fetcher.formData?.get('intent') ?? '') === 'reset-offline'
                  }
                  onClick={() => submit('reset-offline')}
                >
                  Reset offline session
                </Button>
              </InlineStack>
            </BlockStack>
          </Card>
        </Layout.Section>

        {fetcher.data && (
          <Layout.Section>
            <Card>
              <BlockStack gap="200">
                <Text as="h2" variant="headingMd">
                  Last result
                </Text>
                <Box
                  background="bg-surface-secondary"
                  padding="300"
                  borderRadius="200"
                >
                  <pre style={{ whiteSpace: 'pre-wrap', margin: 0 }}>
                    {JSON.stringify(fetcher.data, null, 2)}
                  </pre>
                </Box>
              </BlockStack>
            </Card>
          </Layout.Section>
        )}
      </Layout>
    </Page>
  );
}
