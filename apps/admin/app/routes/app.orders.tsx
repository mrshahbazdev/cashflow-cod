import type { LoaderFunctionArgs, ActionFunctionArgs } from '@remix-run/node';
import { json, redirect } from '@remix-run/node';
import { Form as RemixForm, useLoaderData, useSearchParams } from '@remix-run/react';
import {
  Badge,
  BlockStack,
  Button,
  Card,
  DataTable,
  EmptyState,
  InlineStack,
  Layout,
  Page,
  Select,
  Text,
  TextField,
} from '@shopify/polaris';
import type { Disposition } from '@prisma/client';
import { authenticate } from '../shopify.server';
import { getShopByDomain } from '../lib/install.server';
import prisma from '../db.server';

const DISPOSITIONS: Disposition[] = [
  'UNASSIGNED',
  'NEW',
  'CONFIRMED',
  'RESCHEDULED',
  'NO_ANSWER',
  'WRONG_NUMBER',
  'FAKE',
  'CANCELLED',
  'SHIPPED',
  'DELIVERED',
  'RETURNED',
];

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = await getShopByDomain(session.shop);
  if (!shop) throw new Response('Shop not found', { status: 404 });

  const url = new URL(request.url);
  const disposition = url.searchParams.get('disposition') ?? '';
  const q = url.searchParams.get('q') ?? '';

  const where = {
    shopId: shop.id,
    ...(disposition ? { disposition: disposition as Disposition } : {}),
    ...(q
      ? {
          OR: [
            { phone: { contains: q } },
            { email: { contains: q, mode: 'insensitive' as const } },
            { customerName: { contains: q, mode: 'insensitive' as const } },
            { shopifyOrderId: { contains: q } },
          ],
        }
      : {}),
  };

  const orders = await prisma.order.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 100,
    include: { form: { select: { name: true, slug: true } } },
  });

  return json({ orders, filter: { disposition, q } });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = await getShopByDomain(session.shop);
  if (!shop) throw new Response('Shop not found', { status: 404 });

  const body = await request.formData();
  const intent = body.get('intent');
  const id = String(body.get('id') ?? '');

  if (intent === 'set-disposition' && id) {
    const disposition = String(body.get('disposition') ?? 'NEW') as Disposition;
    await prisma.order.updateMany({
      where: { id, shopId: shop.id },
      data: { disposition },
    });
  }
  if (intent === 'delete' && id) {
    await prisma.order.deleteMany({ where: { id, shopId: shop.id } });
  }
  return redirect('/app/orders');
};

export default function OrdersRoute() {
  const { orders, filter } = useLoaderData<typeof loader>();
  const [params, setParams] = useSearchParams();

  const rows = orders.map((o) => [
    o.createdAt ? new Date(o.createdAt).toLocaleString() : '—',
    o.customerName ?? '—',
    o.phone ?? '—',
    o.city ?? '—',
    o.form?.name ?? '—',
    <Badge tone={riskTone(o.riskScore)}>{o.riskScore != null ? String(o.riskScore) : '—'}</Badge>,
    <DispositionSelect id={o.id} value={o.disposition} />,
    <InlineStack gap="200">
      <RemixForm method="post">
        <input type="hidden" name="intent" value="delete" />
        <input type="hidden" name="id" value={o.id} />
        <Button size="slim" tone="critical" variant="tertiary" submit>
          Delete
        </Button>
      </RemixForm>
    </InlineStack>,
  ]);

  return (
    <Page title="Orders" subtitle="Cash-on-delivery orders from your Cashflow COD forms.">
      <Layout>
        <Layout.Section>
          <Card>
            <BlockStack gap="300">
              <InlineStack gap="300" align="start">
                <div style={{ flex: 1 }}>
                  <TextField
                    label="Search"
                    labelHidden
                    placeholder="Name, phone, email, or order #"
                    value={filter.q}
                    onChange={(v) => {
                      const next = new URLSearchParams(params);
                      if (v) next.set('q', v);
                      else next.delete('q');
                      setParams(next);
                    }}
                    autoComplete="off"
                  />
                </div>
                <Select
                  label="Disposition"
                  labelHidden
                  options={[
                    { label: 'All dispositions', value: '' },
                    ...DISPOSITIONS.map((d) => ({ label: d, value: d })),
                  ]}
                  value={filter.disposition}
                  onChange={(v) => {
                    const next = new URLSearchParams(params);
                    if (v) next.set('disposition', v);
                    else next.delete('disposition');
                    setParams(next);
                  }}
                />
              </InlineStack>
              {orders.length === 0 ? (
                <EmptyState
                  heading="No orders yet"
                  image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                >
                  <p>
                    Once shoppers submit your Cashflow COD form, their orders will appear here with
                    risk score and disposition workflow.
                  </p>
                </EmptyState>
              ) : (
                <DataTable
                  columnContentTypes={[
                    'text',
                    'text',
                    'text',
                    'text',
                    'text',
                    'text',
                    'text',
                    'text',
                  ]}
                  headings={[
                    'Placed',
                    'Customer',
                    'Phone',
                    'City',
                    'Form',
                    'Risk',
                    'Disposition',
                    '',
                  ]}
                  rows={rows}
                />
              )}
              <Text as="p" variant="bodySm" tone="subdued">
                Showing up to 100 most recent orders.
              </Text>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}

function DispositionSelect({ id, value }: { id: string; value: Disposition }) {
  return (
    <RemixForm method="post">
      <input type="hidden" name="intent" value="set-disposition" />
      <input type="hidden" name="id" value={id} />
      <InlineStack gap="200" blockAlign="center">
        <Select
          label=""
          labelHidden
          name="disposition"
          options={DISPOSITIONS.map((d) => ({ label: d, value: d }))}
          value={value}
          onChange={() => {
            /* submit via button */
          }}
        />
        <Button size="slim" submit>
          Save
        </Button>
      </InlineStack>
    </RemixForm>
  );
}

function riskTone(score: number | null | undefined) {
  if (score == null) return 'info' as const;
  if (score >= 70) return 'critical' as const;
  if (score >= 40) return 'warning' as const;
  return 'success' as const;
}
