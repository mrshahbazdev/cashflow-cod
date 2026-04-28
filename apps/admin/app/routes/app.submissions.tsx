import type { LoaderFunctionArgs } from '@remix-run/node';
import { json } from '@remix-run/node';
import { Link as RemixLink, useLoaderData, useSearchParams } from '@remix-run/react';
import {
  Badge,
  BlockStack,
  Button,
  Card,
  EmptyState,
  IndexTable,
  InlineStack,
  Layout,
  Page,
  Select,
  Text,
  useIndexResourceState,
} from '@shopify/polaris';
import type { SubmissionStatus } from '@prisma/client';
import { authenticate } from '../shopify.server';
import { getShopByDomain } from '../lib/install.server';
import prisma from '../db.server';

const STATUS_OPTIONS: Array<{ label: string; value: SubmissionStatus | 'ALL' }> = [
  { label: 'All statuses', value: 'ALL' },
  { label: 'Pending — needs manual order', value: 'PENDING' },
  { label: 'Verified — OTP confirmed', value: 'VERIFIED' },
  { label: 'Converted — order created', value: 'CONVERTED' },
  { label: 'Rejected — fraud / duplicate', value: 'REJECTED' },
  { label: 'Abandoned', value: 'ABANDONED' },
];

const PAGE_SIZE = 50;

function statusTone(s: SubmissionStatus): 'success' | 'attention' | 'warning' | 'critical' | 'info' {
  switch (s) {
    case 'CONVERTED':
      return 'success';
    case 'VERIFIED':
      return 'info';
    case 'PENDING':
      return 'attention';
    case 'ABANDONED':
      return 'warning';
    case 'REJECTED':
      return 'critical';
    default:
      return 'info';
  }
}

function fmtDate(d: Date): string {
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(d);
}

function fmtMoney(amount: unknown, currency: string | null): string {
  if (amount == null) return '';
  const n = typeof amount === 'number' ? amount : Number(amount);
  if (!isFinite(n)) return '';
  if (!currency) return n.toFixed(2);
  try {
    return new Intl.NumberFormat('en', { style: 'currency', currency }).format(n);
  } catch {
    return `${n.toFixed(2)} ${currency}`;
  }
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = await getShopByDomain(session.shop);
  if (!shop) throw new Response('Shop not found', { status: 404 });

  const url = new URL(request.url);
  const statusParam = url.searchParams.get('status') ?? 'ALL';
  const formId = url.searchParams.get('formId') ?? 'ALL';
  const cursor = url.searchParams.get('cursor');

  const where: Record<string, unknown> = {
    form: { shopId: shop.id, ...(formId !== 'ALL' ? { id: formId } : {}) },
  };
  if (statusParam !== 'ALL') {
    where.status = statusParam as SubmissionStatus;
  }

  const submissions = await prisma.submission.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: PAGE_SIZE + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    select: {
      id: true,
      createdAt: true,
      status: true,
      phone: true,
      email: true,
      country: true,
      fields: true,
      form: { select: { id: true, name: true, slug: true } },
      order: {
        select: {
          shopifyOrderId: true,
          total: true,
          currency: true,
          disposition: true,
        },
      },
    },
  });

  const hasMore = submissions.length > PAGE_SIZE;
  const rows = hasMore ? submissions.slice(0, PAGE_SIZE) : submissions;
  const nextCursor = hasMore ? rows[rows.length - 1]!.id : null;

  const forms = await prisma.form.findMany({
    where: { shopId: shop.id },
    orderBy: [{ isActive: 'desc' }, { updatedAt: 'desc' }],
    select: { id: true, name: true, slug: true },
  });

  return json({
    rows: rows.map((r) => ({
      id: r.id,
      createdAt: r.createdAt.toISOString(),
      status: r.status,
      phone: r.phone,
      email: r.email,
      country: r.country,
      formId: r.form?.id ?? null,
      formName: r.form?.name ?? '',
      formSlug: r.form?.slug ?? '',
      orderId: r.order?.shopifyOrderId ?? null,
      orderTotal: r.order?.total != null ? Number(r.order.total) : null,
      orderCurrency: r.order?.currency ?? null,
      name:
        ((r.fields as Record<string, unknown> | null)?.['name'] as string | undefined) ??
        ((r.fields as Record<string, unknown> | null)?.['full_name'] as string | undefined) ??
        '',
      city:
        ((r.fields as Record<string, unknown> | null)?.['city'] as string | undefined) ?? '',
    })),
    nextCursor,
    forms,
    selected: { status: statusParam, formId },
  });
};

export default function SubmissionsRoute() {
  const data = useLoaderData<typeof loader>();
  const [search, setSearch] = useSearchParams();

  const handleStatusChange = (value: string) => {
    const next = new URLSearchParams(search);
    if (value === 'ALL') next.delete('status');
    else next.set('status', value);
    next.delete('cursor');
    setSearch(next, { replace: true });
  };
  const handleFormChange = (value: string) => {
    const next = new URLSearchParams(search);
    if (value === 'ALL') next.delete('formId');
    else next.set('formId', value);
    next.delete('cursor');
    setSearch(next, { replace: true });
  };

  const formOptions = [
    { label: 'All forms', value: 'ALL' },
    ...data.forms.map((f) => ({ label: f.name, value: f.id })),
  ];

  const resourceName = { singular: 'submission', plural: 'submissions' };
  const { selectedResources, allResourcesSelected, handleSelectionChange } =
    useIndexResourceState(data.rows.map((r) => ({ id: r.id })));

  const exportHref = `/app/submissions/export${
    data.selected.formId !== 'ALL' ? `?formId=${data.selected.formId}` : ''
  }`;

  const rowMarkup = data.rows.map((row, index) => (
    <IndexTable.Row
      id={row.id}
      key={row.id}
      position={index}
      selected={selectedResources.includes(row.id)}
    >
      <IndexTable.Cell>
        <Text as="span" variant="bodySm" tone="subdued">
          {fmtDate(new Date(row.createdAt))}
        </Text>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <BlockStack gap="050">
          <Text as="span" variant="bodyMd" fontWeight="medium">
            {row.name || '—'}
          </Text>
          <Text as="span" variant="bodySm" tone="subdued">
            {[row.phone, row.email].filter(Boolean).join(' · ') || '—'}
          </Text>
        </BlockStack>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Text as="span" variant="bodySm">
          {row.formName}
          {row.formSlug ? ` · ${row.formSlug}` : ''}
        </Text>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Badge tone={statusTone(row.status)}>{row.status}</Badge>
      </IndexTable.Cell>
      <IndexTable.Cell>
        {row.orderId ? (
          <Text as="span" variant="bodySm">
            #{row.orderId} · {fmtMoney(row.orderTotal, row.orderCurrency)}
          </Text>
        ) : (
          <Text as="span" variant="bodySm" tone="subdued">
            —
          </Text>
        )}
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Text as="span" variant="bodySm" tone="subdued">
          {[row.city, row.country].filter(Boolean).join(', ') || '—'}
        </Text>
      </IndexTable.Cell>
    </IndexTable.Row>
  ));

  const nextHref = data.nextCursor
    ? (() => {
        const next = new URLSearchParams(search);
        next.set('cursor', data.nextCursor);
        return `?${next.toString()}`;
      })()
    : null;

  return (
    <Page
      title="Submissions"
      subtitle="Every COD form entry on your storefront, oldest converted to newest pending."
      backAction={{ content: 'Dashboard', url: '/app' }}
      primaryAction={{
        content: 'Export CSV',
        url: exportHref,
        external: true,
      }}
    >
      <Layout>
        <Layout.Section>
          <Card>
            <BlockStack gap="300">
              <InlineStack gap="300" wrap={false}>
                <Select
                  label="Status"
                  labelInline
                  options={STATUS_OPTIONS}
                  value={data.selected.status}
                  onChange={handleStatusChange}
                />
                <Select
                  label="Form"
                  labelInline
                  options={formOptions}
                  value={data.selected.formId}
                  onChange={handleFormChange}
                />
              </InlineStack>
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section>
          <Card padding="0">
            {data.rows.length === 0 ? (
              <div style={{ padding: 24 }}>
                <EmptyState
                  heading="No submissions match these filters"
                  image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                  action={{ content: 'Reset filters', url: '/app/submissions' }}
                  secondaryAction={{ content: 'Browse templates', url: '/app/templates' }}
                >
                  <p>
                    Submissions captured by your COD forms appear here. Try widening the date range
                    or filter set.
                  </p>
                </EmptyState>
              </div>
            ) : (
              <IndexTable
                resourceName={resourceName}
                itemCount={data.rows.length}
                selectedItemsCount={
                  allResourcesSelected ? 'All' : selectedResources.length
                }
                onSelectionChange={handleSelectionChange}
                selectable={false}
                headings={[
                  { title: 'Date' },
                  { title: 'Customer' },
                  { title: 'Form' },
                  { title: 'Status' },
                  { title: 'Order' },
                  { title: 'Location' },
                ]}
              >
                {rowMarkup}
              </IndexTable>
            )}
          </Card>
        </Layout.Section>

        {nextHref ? (
          <Layout.Section>
            <InlineStack align="end">
              <Button url={nextHref} variant="secondary">
                Load older submissions
              </Button>
            </InlineStack>
          </Layout.Section>
        ) : null}

        <Layout.Section>
          <Card>
            <BlockStack gap="200">
              <Text as="h3" variant="headingSm">
                Pending submissions
              </Text>
              <Text as="p" tone="subdued">
                Submissions in <strong>PENDING</strong> status were captured but Shopify rejected
                the draft order — usually because the merchant hasn't yet granted{' '}
                <strong>Protected Customer Data Access</strong> in the Partner dashboard. After
                approval, reinstall the app and future submissions will move directly to{' '}
                <strong>CONVERTED</strong>. You can also create a Shopify draft order by hand from
                the entry's customer details.
              </Text>
              <RemixLink to="/app/abandoned">View abandoned forms instead →</RemixLink>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
