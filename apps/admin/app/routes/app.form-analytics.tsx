import type { LoaderFunctionArgs } from '@remix-run/node';
import { json } from '@remix-run/node';
import { useLoaderData, useSearchParams } from '@remix-run/react';
import {
  BlockStack,
  Card,
  DataTable,
  InlineGrid,
  Layout,
  Page,
  Select,
  Text,
} from '@shopify/polaris';
import { authenticate } from '../shopify.server';
import { getShopByDomain } from '../lib/install.server';
import prisma from '../db.server';

interface FormStat {
  formId: string;
  formName: string;
  slug: string;
  total: number;
  pending: number;
  verified: number;
  converted: number;
  rejected: number;
  abandoned: number;
  conversionRate: number;
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = await getShopByDomain(session.shop);
  if (!shop) throw new Response('Shop not found', { status: 404 });

  const url = new URL(request.url);
  const days = Number(url.searchParams.get('days')) || 30;
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const forms = await prisma.form.findMany({
    where: { shopId: shop.id },
    select: { id: true, name: true, slug: true },
    orderBy: { createdAt: 'desc' },
  });

  const submissions = await prisma.submission.groupBy({
    by: ['formId', 'status'],
    where: {
      form: { shopId: shop.id },
      createdAt: { gte: since },
    },
    _count: { id: true },
  });

  const abandonedCounts = await prisma.abandonedForm.groupBy({
    by: ['formId'],
    where: {
      form: { shopId: shop.id },
      createdAt: { gte: since },
    },
    _count: { id: true },
  });

  const statsMap: Record<string, FormStat> = {};
  for (const f of forms) {
    statsMap[f.id] = {
      formId: f.id,
      formName: f.name,
      slug: f.slug,
      total: 0,
      pending: 0,
      verified: 0,
      converted: 0,
      rejected: 0,
      abandoned: 0,
      conversionRate: 0,
    };
  }

  for (const row of submissions) {
    const stat = statsMap[row.formId];
    if (!stat) continue;
    const count = row._count.id;
    stat.total += count;
    if (row.status === 'PENDING') stat.pending = count;
    if (row.status === 'VERIFIED') stat.verified = count;
    if (row.status === 'CONVERTED') stat.converted = count;
    if (row.status === 'REJECTED') stat.rejected = count;
    if (row.status === 'ABANDONED') stat.abandoned += count;
  }

  for (const row of abandonedCounts) {
    const stat = statsMap[row.formId];
    if (stat) stat.abandoned += row._count.id;
  }

  const formStats = Object.values(statsMap).map((s) => ({
    ...s,
    conversionRate: s.total > 0 ? Math.round((s.converted / s.total) * 1000) / 10 : 0,
  }));

  const totals = formStats.reduce(
    (acc, s) => ({
      total: acc.total + s.total,
      converted: acc.converted + s.converted,
      abandoned: acc.abandoned + s.abandoned,
      rejected: acc.rejected + s.rejected,
    }),
    { total: 0, converted: 0, abandoned: 0, rejected: 0 },
  );

  return json({
    formStats,
    totals: {
      ...totals,
      conversionRate:
        totals.total > 0 ? Math.round((totals.converted / totals.total) * 1000) / 10 : 0,
    },
    days,
  });
};

export default function FormAnalyticsPage() {
  const { formStats, totals, days } = useLoaderData<typeof loader>();
  const [searchParams, setSearchParams] = useSearchParams();

  return (
    <Page title="Form Analytics">
      <Layout>
        <Layout.Section>
          <BlockStack gap="400">
            <InlineGrid columns={['oneThird', 'twoThirds']} gap="400">
              <Select
                label="Time range"
                options={[
                  { label: 'Last 7 days', value: '7' },
                  { label: 'Last 30 days', value: '30' },
                  { label: 'Last 90 days', value: '90' },
                ]}
                value={String(days)}
                onChange={(v) => {
                  const p = new URLSearchParams(searchParams);
                  p.set('days', v);
                  setSearchParams(p);
                }}
              />
              <div />
            </InlineGrid>

            <InlineGrid columns={4} gap="400">
              <Card>
                <BlockStack gap="100">
                  <Text variant="headingSm" as="h3">
                    Total Submissions
                  </Text>
                  <Text variant="heading2xl" as="p">
                    {totals.total}
                  </Text>
                </BlockStack>
              </Card>
              <Card>
                <BlockStack gap="100">
                  <Text variant="headingSm" as="h3">
                    Converted
                  </Text>
                  <Text variant="heading2xl" as="p">
                    {totals.converted}
                  </Text>
                </BlockStack>
              </Card>
              <Card>
                <BlockStack gap="100">
                  <Text variant="headingSm" as="h3">
                    Abandoned
                  </Text>
                  <Text variant="heading2xl" as="p">
                    {totals.abandoned}
                  </Text>
                </BlockStack>
              </Card>
              <Card>
                <BlockStack gap="100">
                  <Text variant="headingSm" as="h3">
                    Conversion Rate
                  </Text>
                  <Text variant="heading2xl" as="p">
                    {totals.conversionRate}%
                  </Text>
                </BlockStack>
              </Card>
            </InlineGrid>

            <Card>
              <DataTable
                columnContentTypes={[
                  'text',
                  'text',
                  'numeric',
                  'numeric',
                  'numeric',
                  'numeric',
                  'numeric',
                ]}
                headings={[
                  'Form',
                  'Slug',
                  'Total',
                  'Converted',
                  'Abandoned',
                  'Rejected',
                  'Conv. Rate',
                ]}
                rows={formStats.map((s) => [
                  s.formName,
                  s.slug,
                  s.total,
                  s.converted,
                  s.abandoned,
                  s.rejected,
                  `${s.conversionRate}%`,
                ])}
              />
            </Card>
          </BlockStack>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
