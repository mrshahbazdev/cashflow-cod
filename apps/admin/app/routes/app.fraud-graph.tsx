import type { LoaderFunctionArgs, ActionFunctionArgs } from '@remix-run/node';
import { json, redirect } from '@remix-run/node';
import { Form as RemixForm, useLoaderData } from '@remix-run/react';
import {
  Badge,
  BlockStack,
  Button,
  Card,
  DataTable,
  InlineStack,
  Layout,
  Page,
  Text,
} from '@shopify/polaris';
import { authenticate } from '../shopify.server';
import { getShopByDomain } from '../lib/install.server';
import prisma from '../db.server';
import { listFraudGraphEntries } from '../lib/fraud-graph.server';

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = await getShopByDomain(session.shop);
  if (!shop) throw new Response('Shop not found', { status: 404 });
  const entries = await listFraudGraphEntries(200);
  return json({
    fraudGraphOptIn: shop.fraudGraphOptIn,
    entries: entries.map((e) => ({
      ...e,
      firstSeenAt: e.firstSeenAt.toISOString(),
      lastSeenAt: e.lastSeenAt.toISOString(),
    })),
  });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = await getShopByDomain(session.shop);
  if (!shop) throw new Response('Shop not found', { status: 404 });

  const body = await request.formData();
  const intent = String(body.get('intent') ?? '');
  if (intent === 'toggle') {
    await prisma.shop.update({
      where: { id: shop.id },
      data: { fraudGraphOptIn: !shop.fraudGraphOptIn },
    });
  }
  return redirect('/app/fraud-graph');
};

function severityBadge(s: number) {
  if (s >= 4) return <Badge tone="critical">High</Badge>;
  if (s >= 3) return <Badge tone="warning">Medium</Badge>;
  if (s >= 2) return <Badge tone="info">Low</Badge>;
  return <Badge>Minimal</Badge>;
}

export default function FraudGraphRoute() {
  const { fraudGraphOptIn, entries } = useLoaderData<typeof loader>();

  const rows = entries.map((e) => [
    e.type,
    `${e.valueHash.slice(0, 10)}…${e.valueHash.slice(-6)}`,
    String(e.reportCount),
    String(e.offenderHits),
    severityBadge(e.severity),
    new Date(e.lastSeenAt).toLocaleDateString(),
  ]);

  return (
    <Page
      title="Fraud graph"
      subtitle="Cross-store blacklist network. Shops opt-in to report confirmed fake orders; everyone benefits from the aggregated signal."
    >
      <Layout>
        <Layout.Section>
          <Card>
            <BlockStack gap="300">
              <InlineStack align="space-between" blockAlign="center">
                <BlockStack gap="100">
                  <Text as="h2" variant="headingMd">
                    Your participation
                  </Text>
                  <Text as="p" tone="subdued">
                    Only SHA-256 hashes of phone / IP / email leave your store. No raw PII is
                    ever shared.
                  </Text>
                </BlockStack>
                <InlineStack gap="200" blockAlign="center">
                  {fraudGraphOptIn ? (
                    <Badge tone="success">Opted in</Badge>
                  ) : (
                    <Badge tone="attention">Not participating</Badge>
                  )}
                  <RemixForm method="post">
                    <input type="hidden" name="intent" value="toggle" />
                    <Button submit>
                      {fraudGraphOptIn ? 'Leave network' : 'Opt in'}
                    </Button>
                  </RemixForm>
                </InlineStack>
              </InlineStack>
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section>
          <Card>
            <BlockStack gap="300">
              <Text as="h2" variant="headingMd">
                Network signal ({entries.length})
              </Text>
              {entries.length === 0 ? (
                <Text as="p" tone="subdued">
                  No signal yet. Entries appear once merchants report fake / RTO orders.
                </Text>
              ) : (
                <DataTable
                  columnContentTypes={['text', 'text', 'numeric', 'numeric', 'text', 'text']}
                  headings={[
                    'Type',
                    'Hash (truncated)',
                    'Reports',
                    'Offender hits',
                    'Severity',
                    'Last seen',
                  ]}
                  rows={rows}
                />
              )}
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
