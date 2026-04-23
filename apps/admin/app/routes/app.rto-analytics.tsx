import type { LoaderFunctionArgs, ActionFunctionArgs } from '@remix-run/node';
import { json, redirect } from '@remix-run/node';
import { Form as RemixForm, useLoaderData, useSearchParams } from '@remix-run/react';
import {
  Badge,
  BlockStack,
  Button,
  Card,
  DataTable,
  InlineStack,
  Layout,
  Page,
  Select,
  Text,
} from '@shopify/polaris';
import { authenticate } from '../shopify.server';
import { getShopByDomain } from '../lib/install.server';
import {
  getRtoBreakdown,
  rebuildRtoStatsForShop,
  type RtoDimension,
} from '../lib/rto-analytics.server';

const DIMENSIONS: { label: string; value: RtoDimension }[] = [
  { label: 'City', value: 'city' },
  { label: 'Courier', value: 'courier' },
  { label: 'Product', value: 'product' },
  { label: 'SKU', value: 'sku' },
  { label: 'Hour of day', value: 'hour' },
  { label: 'Day of week', value: 'day_of_week' },
  { label: 'Country', value: 'country' },
];

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = await getShopByDomain(session.shop);
  if (!shop) throw new Response('Shop not found', { status: 404 });
  const url = new URL(request.url);
  const dimension = (url.searchParams.get('dimension') as RtoDimension | null) ?? 'city';
  const days = Number(url.searchParams.get('days') ?? '30');
  const breakdown = await getRtoBreakdown({ shopId: shop.id, dimension, days, limit: 50 });
  return json({ dimension, days, breakdown });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = await getShopByDomain(session.shop);
  if (!shop) throw new Response('Shop not found', { status: 404 });
  const body = await request.formData();
  if (String(body.get('intent')) === 'rebuild') {
    await rebuildRtoStatsForShop(shop.id, 90);
  }
  return redirect('/app/rto-analytics');
};

function rateBadge(rate: number) {
  const pct = Math.round(rate * 1000) / 10;
  if (pct >= 25) return <Badge tone="critical">{`${pct}%`}</Badge>;
  if (pct >= 15) return <Badge tone="warning">{`${pct}%`}</Badge>;
  if (pct >= 5) return <Badge tone="info">{`${pct}%`}</Badge>;
  return <Badge tone="success">{`${pct}%`}</Badge>;
}

export default function RtoAnalyticsRoute() {
  const { dimension, days, breakdown } = useLoaderData<typeof loader>();
  const [params, setParams] = useSearchParams();

  const rows = breakdown.map((b) => [
    b.dimensionKey,
    String(b.totalOrders),
    String(b.confirmedOrders),
    String(b.deliveredOrders),
    String(b.rtoOrders),
    rateBadge(b.rtoRate),
  ]);

  const totalOrders = breakdown.reduce((n, r) => n + r.totalOrders, 0);
  const totalRto = breakdown.reduce((n, r) => n + r.rtoOrders, 0);
  const overallRate = totalOrders > 0 ? totalRto / totalOrders : 0;

  return (
    <Page
      title="RTO insights"
      subtitle="Return-to-origin breakdown across city, courier, product, SKU, and time dimensions."
    >
      <Layout>
        <Layout.Section>
          <Card>
            <BlockStack gap="300">
              <InlineStack gap="300" align="space-between" blockAlign="end">
                <InlineStack gap="300" blockAlign="end">
                  <Select
                    label="Dimension"
                    options={DIMENSIONS}
                    value={dimension}
                    onChange={(v) => {
                      const next = new URLSearchParams(params);
                      next.set('dimension', v);
                      setParams(next);
                    }}
                  />
                  <Select
                    label="Window"
                    options={[
                      { label: '7 days', value: '7' },
                      { label: '30 days', value: '30' },
                      { label: '90 days', value: '90' },
                    ]}
                    value={String(days)}
                    onChange={(v) => {
                      const next = new URLSearchParams(params);
                      next.set('days', v);
                      setParams(next);
                    }}
                  />
                </InlineStack>
                <RemixForm method="post">
                  <input type="hidden" name="intent" value="rebuild" />
                  <Button submit variant="primary">
                    Rebuild stats
                  </Button>
                </RemixForm>
              </InlineStack>
              <InlineStack gap="400">
                <Text as="p">
                  <strong>Total orders:</strong> {totalOrders}
                </Text>
                <Text as="p">
                  <strong>RTO orders:</strong> {totalRto}
                </Text>
                <Text as="p">
                  <strong>RTO rate:</strong> {(overallRate * 100).toFixed(1)}%
                </Text>
              </InlineStack>
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section>
          <Card>
            <BlockStack gap="300">
              <Text as="h2" variant="headingMd">
                Breakdown by {dimension}
              </Text>
              {breakdown.length === 0 ? (
                <Text as="p" tone="subdued">
                  No data yet. Click "Rebuild stats" after you have orders.
                </Text>
              ) : (
                <DataTable
                  columnContentTypes={['text', 'numeric', 'numeric', 'numeric', 'numeric', 'text']}
                  headings={['Key', 'Orders', 'Confirmed', 'Delivered', 'RTO', 'Rate']}
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
