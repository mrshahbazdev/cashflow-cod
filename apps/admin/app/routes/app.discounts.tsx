import type { LoaderFunctionArgs, ActionFunctionArgs } from '@remix-run/node';
import { json, redirect } from '@remix-run/node';
import { Form as RemixForm, useLoaderData } from '@remix-run/react';
import { useState } from 'react';
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
import { authenticate } from '../shopify.server';
import { getShopByDomain } from '../lib/install.server';
import prisma from '../db.server';

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = await getShopByDomain(session.shop);
  if (!shop) throw new Response('Shop not found', { status: 404 });
  const discounts = await prisma.discount.findMany({
    where: { shopId: shop.id },
    orderBy: [{ isActive: 'desc' }, { createdAt: 'desc' }],
  });
  return json({ discounts });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = await getShopByDomain(session.shop);
  if (!shop) throw new Response('Shop not found', { status: 404 });
  const body = await request.formData();
  const intent = String(body.get('intent') ?? '');

  if (intent === 'save') {
    const code = String(body.get('code') ?? '')
      .trim()
      .toUpperCase();
    const type = String(body.get('type') ?? 'percent');
    const value = parseFloat(String(body.get('value') ?? '0'));
    const minSubtotalRaw = String(body.get('minSubtotal') ?? '').trim();
    const expiresAtRaw = String(body.get('expiresAt') ?? '').trim();
    const usageLimitRaw = String(body.get('usageLimit') ?? '').trim();
    const perCustomerRaw = String(body.get('perCustomer') ?? '').trim();
    if (!code) return json({ error: 'Code required' }, { status: 400 });
    await prisma.discount.upsert({
      where: { shopId_code: { shopId: shop.id, code } },
      create: {
        shopId: shop.id,
        code,
        type,
        value,
        minSubtotal: minSubtotalRaw ? parseFloat(minSubtotalRaw) : null,
        expiresAt: expiresAtRaw ? new Date(expiresAtRaw) : null,
        usageLimit: usageLimitRaw ? parseInt(usageLimitRaw, 10) : null,
        perCustomer: perCustomerRaw ? parseInt(perCustomerRaw, 10) : null,
      },
      update: {
        type,
        value,
        minSubtotal: minSubtotalRaw ? parseFloat(minSubtotalRaw) : null,
        expiresAt: expiresAtRaw ? new Date(expiresAtRaw) : null,
        usageLimit: usageLimitRaw ? parseInt(usageLimitRaw, 10) : null,
        perCustomer: perCustomerRaw ? parseInt(perCustomerRaw, 10) : null,
        isActive: true,
      },
    });
  } else if (intent === 'delete') {
    const id = String(body.get('id') ?? '');
    await prisma.discount.deleteMany({ where: { id, shopId: shop.id } });
  } else if (intent === 'toggle') {
    const id = String(body.get('id') ?? '');
    const target = await prisma.discount.findFirst({ where: { id, shopId: shop.id } });
    if (target) {
      await prisma.discount.update({
        where: { id },
        data: { isActive: !target.isActive },
      });
    }
  }
  return redirect('/app/discounts');
};

export default function DiscountsRoute() {
  const { discounts } = useLoaderData<typeof loader>();
  const [code, setCode] = useState('');
  const [type, setType] = useState<'percent' | 'flat' | 'free_shipping'>('percent');
  const [value, setValue] = useState('10');
  const [minSubtotal, setMinSubtotal] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [usageLimit, setUsageLimit] = useState('');
  const [perCustomer, setPerCustomer] = useState('');

  const rows = discounts.map((d) => [
    <code key={`c-${d.id}`}>{d.code}</code>,
    d.type,
    d.type === 'free_shipping' ? '—' : Number(d.value).toString(),
    d.minSubtotal ? Number(d.minSubtotal).toString() : '—',
    d.expiresAt ? new Date(d.expiresAt).toLocaleDateString() : '—',
    `${d.usageCount}${d.usageLimit ? ` / ${d.usageLimit}` : ''}`,
    d.isActive ? (
      <Badge key={`a-${d.id}`} tone="success">
        Active
      </Badge>
    ) : (
      <Badge key={`a-${d.id}`}>Paused</Badge>
    ),
    <InlineStack key={`act-${d.id}`} gap="200">
      <RemixForm method="post">
        <input type="hidden" name="intent" value="toggle" />
        <input type="hidden" name="id" value={d.id} />
        <Button submit variant="plain">
          {d.isActive ? 'Pause' : 'Activate'}
        </Button>
      </RemixForm>
      <RemixForm method="post">
        <input type="hidden" name="intent" value="delete" />
        <input type="hidden" name="id" value={d.id} />
        <Button submit tone="critical" variant="plain">
          Delete
        </Button>
      </RemixForm>
    </InlineStack>,
  ]);

  return (
    <Page
      title="Discount codes"
      subtitle="Percentage, flat, or free-shipping codes that customers can apply at the COD form."
      secondaryActions={[{ content: 'Quantity offers', url: '/app/quantity-offers' }]}
    >
      <Layout>
        <Layout.Section>
          <Card>
            <BlockStack gap="300">
              <Text as="h2" variant="headingMd">
                Add / update code
              </Text>
              <RemixForm method="post">
                <input type="hidden" name="intent" value="save" />
                <BlockStack gap="300">
                  <InlineStack gap="300" align="start" blockAlign="end">
                    <div style={{ flex: 1 }}>
                      <TextField
                        label="Code"
                        name="code"
                        value={code}
                        onChange={(v) => setCode(v.toUpperCase())}
                        autoComplete="off"
                        placeholder="WELCOME10"
                      />
                    </div>
                    <Select
                      label="Type"
                      name="type"
                      value={type}
                      onChange={(v) => setType(v as 'percent' | 'flat' | 'free_shipping')}
                      options={[
                        { label: 'Percentage off', value: 'percent' },
                        { label: 'Flat amount off', value: 'flat' },
                        { label: 'Free shipping', value: 'free_shipping' },
                      ]}
                    />
                    {type !== 'free_shipping' && (
                      <div style={{ width: 140 }}>
                        <TextField
                          label={type === 'percent' ? 'Percent (%)' : 'Amount'}
                          name="value"
                          value={value}
                          onChange={setValue}
                          autoComplete="off"
                          type="number"
                        />
                      </div>
                    )}
                  </InlineStack>
                  <InlineStack gap="300" align="start" blockAlign="end">
                    <div style={{ flex: 1 }}>
                      <TextField
                        label="Minimum subtotal (optional)"
                        name="minSubtotal"
                        value={minSubtotal}
                        onChange={setMinSubtotal}
                        autoComplete="off"
                        type="number"
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <TextField
                        label="Expires at (optional)"
                        name="expiresAt"
                        value={expiresAt}
                        onChange={setExpiresAt}
                        autoComplete="off"
                        type="date"
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <TextField
                        label="Usage limit (optional)"
                        name="usageLimit"
                        value={usageLimit}
                        onChange={setUsageLimit}
                        autoComplete="off"
                        type="number"
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <TextField
                        label="Per customer (optional)"
                        name="perCustomer"
                        value={perCustomer}
                        onChange={setPerCustomer}
                        autoComplete="off"
                        type="number"
                      />
                    </div>
                  </InlineStack>
                  <InlineStack align="end">
                    <Button submit variant="primary">
                      Save code
                    </Button>
                  </InlineStack>
                </BlockStack>
              </RemixForm>
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section>
          <Card>
            {discounts.length === 0 ? (
              <EmptyState
                heading="No discount codes yet"
                image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
              >
                <p>
                  Create your first code above. Customers will see a code-entry field on the form.
                </p>
              </EmptyState>
            ) : (
              <DataTable
                columnContentTypes={[
                  'text',
                  'text',
                  'numeric',
                  'numeric',
                  'text',
                  'text',
                  'text',
                  'text',
                ]}
                headings={[
                  'Code',
                  'Type',
                  'Value',
                  'Min subtotal',
                  'Expires',
                  'Used',
                  'Status',
                  'Actions',
                ]}
                rows={rows}
              />
            )}
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
