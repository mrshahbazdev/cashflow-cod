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
import type { PaymentProviderCode } from '@cashflow-cod/payments';
import { authenticate } from '../shopify.server';
import { getShopByDomain } from '../lib/install.server';
import {
  deletePaymentAccount,
  listPaymentAccounts,
  listPaymentAdapters,
  upsertPaymentAccount,
} from '../lib/payments.server';

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = await getShopByDomain(session.shop);
  if (!shop) throw new Response('Shop not found', { status: 404 });
  const accounts = await listPaymentAccounts(shop.id);
  const adapters = listPaymentAdapters();
  return json({ accounts, adapters });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = await getShopByDomain(session.shop);
  if (!shop) throw new Response('Shop not found', { status: 404 });
  const body = await request.formData();
  const intent = String(body.get('intent') ?? '');

  if (intent === 'save') {
    const provider = String(body.get('provider') ?? '') as PaymentProviderCode;
    const label = String(body.get('label') ?? provider);
    const mode = (String(body.get('mode') ?? 'mock') as 'mock' | 'live') ?? 'mock';
    const apiKey = String(body.get('apiKey') ?? '');
    const apiSecret = String(body.get('apiSecret') ?? '');
    const merchantId = String(body.get('merchantId') ?? '');
    if (!provider) return json({ error: 'Provider required' }, { status: 400 });
    await upsertPaymentAccount({
      shopId: shop.id,
      provider,
      label,
      mode,
      credentials: { apiKey, apiSecret, merchantId },
    });
  } else if (intent === 'delete') {
    const id = String(body.get('id') ?? '');
    await deletePaymentAccount(shop.id, id);
  }
  return redirect('/app/payments');
};

export default function PaymentsRoute() {
  const { accounts, adapters } = useLoaderData<typeof loader>();
  const [provider, setProvider] = useState<PaymentProviderCode>(
    (adapters[0]?.code as PaymentProviderCode) ?? 'jazzcash',
  );
  const [label, setLabel] = useState('');
  const [mode, setMode] = useState<'mock' | 'live'>('mock');
  const [apiKey, setApiKey] = useState('');
  const [apiSecret, setApiSecret] = useState('');
  const [merchantId, setMerchantId] = useState('');

  const rows = accounts.map((a) => [
    a.label,
    a.provider,
    <Badge key={`m-${a.id}`} tone={a.mode === 'live' ? 'success' : undefined}>
      {a.mode}
    </Badge>,
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
      title="Partial advance payments"
      subtitle="Configure JazzCash, EasyPaisa, SadaPay, Stripe, or Razorpay to collect a partial advance on high-risk COD orders."
    >
      <Layout>
        <Layout.Section>
          <Card>
            <BlockStack gap="300">
              <Text as="h2" variant="headingMd">
                Add / update payment account
              </Text>
              <RemixForm method="post">
                <input type="hidden" name="intent" value="save" />
                <BlockStack gap="300">
                  <InlineStack gap="300" align="start" blockAlign="end">
                    <Select
                      label="Provider"
                      name="provider"
                      options={adapters.map((a) => ({ label: a.displayName, value: a.code }))}
                      value={provider}
                      onChange={(v) => setProvider(v as PaymentProviderCode)}
                    />
                    <div style={{ flex: 1 }}>
                      <TextField
                        label="Label"
                        name="label"
                        value={label}
                        onChange={setLabel}
                        autoComplete="off"
                        placeholder="Main JazzCash account"
                      />
                    </div>
                    <Select
                      label="Mode"
                      name="mode"
                      options={[
                        { label: 'Mock (sandbox)', value: 'mock' },
                        { label: 'Live', value: 'live' },
                      ]}
                      value={mode}
                      onChange={(v) => setMode(v as 'mock' | 'live')}
                    />
                  </InlineStack>
                  <InlineStack gap="300" align="start" blockAlign="end">
                    <div style={{ flex: 1 }}>
                      <TextField
                        label="API key"
                        name="apiKey"
                        value={apiKey}
                        onChange={setApiKey}
                        autoComplete="off"
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <TextField
                        label="API secret"
                        name="apiSecret"
                        value={apiSecret}
                        onChange={setApiSecret}
                        autoComplete="off"
                        type="password"
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <TextField
                        label="Merchant ID"
                        name="merchantId"
                        value={merchantId}
                        onChange={setMerchantId}
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
              <EmptyState
                heading="No payment accounts yet"
                image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
              >
                <p>Add an account above — mock mode works without real credentials.</p>
              </EmptyState>
            ) : (
              <DataTable
                columnContentTypes={['text', 'text', 'text', 'text', 'text', 'text']}
                headings={['Label', 'Provider', 'Mode', 'Active', 'Created', 'Actions']}
                rows={rows}
              />
            )}
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
