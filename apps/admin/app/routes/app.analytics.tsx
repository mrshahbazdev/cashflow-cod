import type { LoaderFunctionArgs } from '@remix-run/node';
import { json } from '@remix-run/node';
import { useLoaderData } from '@remix-run/react';
import { BlockStack, Card, DataTable, InlineGrid, Layout, Page, Text } from '@shopify/polaris';
import { authenticate } from '../shopify.server';
import { getShopByDomain } from '../lib/install.server';
import prisma from '../db.server';

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = await getShopByDomain(session.shop);
  if (!shop) throw new Response('Shop not found', { status: 404 });

  const now = new Date();
  const since30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [totalSubmissions, convertedOrders, totalOrders, delivered, returned, recentByDay] =
    await Promise.all([
      prisma.submission.count({
        where: { form: { shopId: shop.id }, createdAt: { gte: since30 } },
      }),
      prisma.submission.count({
        where: {
          form: { shopId: shop.id },
          createdAt: { gte: since30 },
          status: 'CONVERTED',
        },
      }),
      prisma.order.count({ where: { shopId: shop.id, createdAt: { gte: since30 } } }),
      prisma.order.count({
        where: { shopId: shop.id, createdAt: { gte: since30 }, disposition: 'DELIVERED' },
      }),
      prisma.order.count({
        where: { shopId: shop.id, createdAt: { gte: since30 }, disposition: 'RETURNED' },
      }),
      prisma.order.groupBy({
        by: ['disposition'],
        where: { shopId: shop.id, createdAt: { gte: since30 } },
        _count: { _all: true },
      }),
    ]);

  const conversion = totalSubmissions > 0 ? (convertedOrders / totalSubmissions) * 100 : 0;
  const rto = delivered + returned > 0 ? (returned / (delivered + returned)) * 100 : 0;

  return json({
    totalSubmissions,
    convertedOrders,
    totalOrders,
    delivered,
    returned,
    conversion,
    rto,
    byDisposition: recentByDay,
  });
};

export default function AnalyticsRoute() {
  const d = useLoaderData<typeof loader>();

  const rows = d.byDisposition.map((r) => [r.disposition, String(r._count._all)]);

  return (
    <Page title="Analytics" subtitle="Last 30 days">
      <Layout>
        <Layout.Section>
          <InlineGrid columns={{ xs: 2, sm: 3, md: 4 }} gap="400">
            <Stat label="Submissions" value={d.totalSubmissions.toLocaleString()} />
            <Stat label="Orders created" value={d.totalOrders.toLocaleString()} />
            <Stat label="Conversion" value={`${d.conversion.toFixed(1)}%`} />
            <Stat label="RTO rate" value={`${d.rto.toFixed(1)}%`} />
          </InlineGrid>
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
