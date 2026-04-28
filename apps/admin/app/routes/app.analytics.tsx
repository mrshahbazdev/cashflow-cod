import type { LoaderFunctionArgs } from '@remix-run/node';
import { json } from '@remix-run/node';
import { useLoaderData, Link as RemixLink, useSearchParams } from '@remix-run/react';
import {
  BlockStack,
  Button,
  Card,
  DataTable,
  InlineGrid,
  InlineStack,
  Layout,
  Page,
  ProgressBar,
  Select,
  Text,
} from '@shopify/polaris';
import { authenticate } from '../shopify.server';
import { getShopByDomain } from '../lib/install.server';
import prisma from '../db.server';

const RANGE_OPTIONS = [
  { label: 'Last 7 days', value: '7' },
  { label: 'Last 30 days', value: '30' },
  { label: 'Last 90 days', value: '90' },
];

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = await getShopByDomain(session.shop);
  if (!shop) throw new Response('Shop not found', { status: 404 });

  const url = new URL(request.url);
  const days = Math.min(180, Math.max(1, Number(url.searchParams.get('range') ?? '30')));
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const [
    totalViews,
    totalSubmissions,
    verifiedSubs,
    convertedOrders,
    totalOrders,
    delivered,
    returned,
    byDisposition,
    revenueAgg,
  ] = await Promise.all([
    prisma.formView.count({
      where: { form: { shopId: shop.id }, createdAt: { gte: since } },
    }),
    prisma.submission.count({
      where: { form: { shopId: shop.id }, createdAt: { gte: since } },
    }),
    prisma.submission.count({
      where: {
        form: { shopId: shop.id },
        createdAt: { gte: since },
        status: { in: ['VERIFIED', 'CONVERTED'] },
      },
    }),
    prisma.submission.count({
      where: { form: { shopId: shop.id }, createdAt: { gte: since }, status: 'CONVERTED' },
    }),
    prisma.order.count({ where: { shopId: shop.id, createdAt: { gte: since } } }),
    prisma.order.count({
      where: { shopId: shop.id, createdAt: { gte: since }, disposition: 'DELIVERED' },
    }),
    prisma.order.count({
      where: { shopId: shop.id, createdAt: { gte: since }, disposition: 'RETURNED' },
    }),
    prisma.order.groupBy({
      by: ['disposition'],
      where: { shopId: shop.id, createdAt: { gte: since } },
      _count: { _all: true },
    }),
    prisma.order.aggregate({
      where: { shopId: shop.id, createdAt: { gte: since } },
      _sum: { total: true },
    }),
  ]);

  const viewsToSubmit = totalViews > 0 ? (totalSubmissions / totalViews) * 100 : 0;
  const submitToVerified = totalSubmissions > 0 ? (verifiedSubs / totalSubmissions) * 100 : 0;
  const verifiedToConverted = verifiedSubs > 0 ? (convertedOrders / verifiedSubs) * 100 : 0;
  const conversion = totalViews > 0 ? (convertedOrders / totalViews) * 100 : 0;
  const rto = delivered + returned > 0 ? (returned / (delivered + returned)) * 100 : 0;
  const revenue = Number(revenueAgg._sum.total ?? 0);

  return json({
    days,
    totalViews,
    totalSubmissions,
    verifiedSubs,
    convertedOrders,
    totalOrders,
    delivered,
    returned,
    conversion,
    viewsToSubmit,
    submitToVerified,
    verifiedToConverted,
    rto,
    revenue,
    byDisposition,
  });
};

export default function AnalyticsRoute() {
  const d = useLoaderData<typeof loader>();
  const [params, setParams] = useSearchParams();

  const rows = d.byDisposition.map((r) => [r.disposition, String(r._count._all)]);

  return (
    <Page
      title="Analytics"
      subtitle={`Last ${d.days} days`}
      primaryAction={
        <RemixLink to="/app/submissions/export" reloadDocument>
          <Button variant="primary">Download CSV</Button>
        </RemixLink>
      }
    >
      <Layout>
        <Layout.Section>
          <Card>
            <InlineStack align="space-between" blockAlign="center">
              <Text as="p" tone="subdued">
                Time range
              </Text>
              <div style={{ minWidth: 200 }}>
                <Select
                  label=""
                  labelHidden
                  options={RANGE_OPTIONS}
                  value={String(d.days)}
                  onChange={(v) => {
                    const next = new URLSearchParams(params);
                    next.set('range', v);
                    setParams(next);
                  }}
                />
              </div>
            </InlineStack>
          </Card>
        </Layout.Section>
        <Layout.Section>
          <InlineGrid columns={{ xs: 2, sm: 3, md: 4 }} gap="400">
            <Stat label="Form views" value={d.totalViews.toLocaleString()} />
            <Stat label="Submissions" value={d.totalSubmissions.toLocaleString()} />
            <Stat label="Orders" value={d.totalOrders.toLocaleString()} />
            <Stat label="Conversion" value={`${d.conversion.toFixed(1)}%`} />
            <Stat label="Revenue" value={d.revenue.toFixed(2)} />
            <Stat label="RTO rate" value={`${d.rto.toFixed(1)}%`} />
          </InlineGrid>
        </Layout.Section>
        <Layout.Section>
          <Card>
            <BlockStack gap="300">
              <Text as="h2" variant="headingMd">
                Conversion funnel
              </Text>
              <FunnelStep
                label={`Form views → submissions (${d.viewsToSubmit.toFixed(1)}%)`}
                value={d.viewsToSubmit}
              />
              <FunnelStep
                label={`Submissions → verified (${d.submitToVerified.toFixed(1)}%)`}
                value={d.submitToVerified}
              />
              <FunnelStep
                label={`Verified → orders (${d.verifiedToConverted.toFixed(1)}%)`}
                value={d.verifiedToConverted}
              />
            </BlockStack>
          </Card>
        </Layout.Section>
        <Layout.Section>
          <Card>
            <BlockStack gap="300">
              <Text as="h2" variant="headingMd">
                Orders by disposition
              </Text>
              {rows.length === 0 ? (
                <Text as="p" tone="subdued">
                  No orders yet. Data will appear once shoppers submit COD forms.
                </Text>
              ) : (
                <DataTable
                  columnContentTypes={['text', 'numeric']}
                  headings={['Disposition', 'Orders']}
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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <BlockStack gap="100">
        <Text as="p" tone="subdued" variant="bodySm">
          {label}
        </Text>
        <Text as="p" variant="heading2xl">
          {value}
        </Text>
      </BlockStack>
    </Card>
  );
}

function FunnelStep({ label, value }: { label: string; value: number }) {
  return (
    <BlockStack gap="100">
      <Text as="p" variant="bodyMd">
        {label}
      </Text>
      <ProgressBar progress={Math.min(100, Math.max(0, value))} tone="primary" />
    </BlockStack>
  );
}
