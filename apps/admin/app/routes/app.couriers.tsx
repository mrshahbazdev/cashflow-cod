import type { LoaderFunctionArgs, ActionFunctionArgs } from '@remix-run/node';
import { json, redirect } from '@remix-run/node';
import { Form as RemixForm, useLoaderData } from '@remix-run/react';
import { useState } from 'react';
import {
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
import { courierRegistry, type CourierAdapter } from '@cashflow-cod/couriers';
import { authenticate } from '../shopify.server';
import { getShopByDomain } from '../lib/install.server';
import {
  deleteCourierAccount,
  listCourierAccounts,
  upsertCourierAccount,
} from '../lib/couriers.server';

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = await getShopByDomain(session.shop);
  if (!shop) throw new Response('Shop not found', { status: 404 });
  const accounts = await listCourierAccounts(shop.id);
  const supported = courierRegistry
    .list()
    .map((a: CourierAdapter) => ({ code: a.code as string, name: a.displayName }));
  return json({ accounts, supported });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = await getShopByDomain(session.shop);
  if (!shop) throw new Response('Shop not found', { status: 404 });

  const body = await request.formData();
  const intent = body.get('intent');

  if (intent === 'save') {
    const courier = String(body.get('courier') ?? '');
    const label = String(body.get('label') ?? courier);
    const apiKey = String(body.get('apiKey') ?? '');
    const apiPassword = String(body.get('apiPassword') ?? '');
    const accountNumber = String(body.get('accountNumber') ?? '');
    const mode = body.get('mode') ? String(body.get('mode')) : '';
    if (!courier) return json({ error: 'Courier required' }, { status: 400 });
    await upsertCourierAccount({
      shopId: shop.id,
      courier,
      label,
      credentials: { apiKey, apiPassword, accountNumber, mode },
    });
  }
  if (intent === 'delete') {
    const id = String(body.get('id') ?? '');
    await deleteCourierAccount(shop.id, id);
  }
  return redirect('/app/couriers');
};

export default function CouriersRoute() {
  const { accounts, supported } = useLoaderData<typeof loader>();
  const [courier, setCourier] = useState(supported[0]?.code ?? 'postex');
  const [label, setLabel] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [apiPassword, setApiPassword] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [mode, setMode] = useState('mock');

  const rows = accounts.map((a) => [
    a.label,
    a.courier,
    a.isActive ? 'Active' : 'Inactive',
    new Date(a.createdAt).toLocaleString(),
    <RemixForm key={a.id} method="post">
      <input type="hidden" name="intent" value="delete" />
      <input type="hidden" name="id" value={a.id} />
      <Button submit tone="critical" variant="plain">
        Delete
      </Button>
    </RemixForm>,
  ]);

  return (
    <Page
      title="Couriers"
      subtitle="Connect shipping carriers. Credentials are stored per shop and used for one-click booking."
    >
      <Layout>
        <Layout.Section>
          <Card>
            <BlockStack gap="300">
              <Text as="h2" variant="headingMd">
                Add / update courier account
              </Text>
              <RemixForm method="post">
                <input type="hidden" name="intent" value="save" />
                <BlockStack gap="300">
                  <InlineStack gap="300" align="start" blockAlign="end">
                    <Select
                      label="Courier"
                      name="courier"
                      options={supported.map((s: { code: string; name: string }) => ({
                        label: s.name,
                        value: s.code,
                      }))}
                      value={courier}
                      onChange={setCourier}
                    />
                    <div style={{ flex: 1 }}>
                      <TextField
                        label="Label"
                        name="label"
                        value={label}
                        onChange={setLabel}
                        autoComplete="off"
                        placeholder="Pakistan PostEx main account"
                      />
                    </div>
                    <Select
                      label="Mode"
                      name="mode"
                      options={[
                        { label: 'Mock (sandbox)', value: 'mock' },
                        { label: 'Live', value: '' },
                      ]}
                      value={mode}
                      onChange={setMode}
                    />
                  </InlineStack>
                  <InlineStack gap="300" align="start" blockAlign="end">
                    <div style={{ flex: 1 }}>
                      <TextField
                        label="API key / token"
                        name="apiKey"
                        value={apiKey}
                        onChange={setApiKey}
                        autoComplete="off"
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <TextField
                        label="API password (if any)"
                        name="apiPassword"
                        type="password"
                        value={apiPassword}
                        onChange={setApiPassword}
                        autoComplete="off"
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <TextField
                        label="Account number (BlueEx)"
                        name="accountNumber"
                        value={accountNumber}
                        onChange={setAccountNumber}
                        autoComplete="off"
                      />
                    </div>
                  </InlineStack>
                  <InlineStack align="end">
                    <Button submit variant="primary">
                      Save account
                    </Button>
                  </InlineStack>
                </BlockStack>
              </RemixForm>
            </BlockStack>
          </Card>
        </Layout.Section>
        <Layout.Section>
          <Card>
            {accounts.length === 0 ? (
              <EmptyState heading="No courier connected yet" image="">
                <p>Add your first courier account above to enable one-click booking.</p>
              </EmptyState>
            ) : (
              <DataTable
                columnContentTypes={['text', 'text', 'text', 'text', 'text']}
                headings={['Label', 'Courier', 'Status', 'Added', '']}
                rows={rows}
              />
            )}
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
