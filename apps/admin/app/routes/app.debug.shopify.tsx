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
  | { kind: 'reset-offline'; ok: boolean; deleted: number };

export async function action({ request }: ActionFunctionArgs) {
  const { session, admin } = await authenticate.admin(request);
  const form = await request.formData();
  const intent = form.get('intent');

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
        raw: err instanceof Error ? err.message : String(err),
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
        raw: err instanceof Error ? err.message : String(err),
      });
    }
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
                  Probe ONLINE token
                </Button>
                <Button
                  loading={
                    fetcher.state !== 'idle' &&
                    (fetcher.formData?.get('intent') ?? '') === 'probe-offline'
                  }
                  onClick={() => submit('probe-offline')}
                >
                  Probe OFFLINE token
                </Button>
              </InlineStack>
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
