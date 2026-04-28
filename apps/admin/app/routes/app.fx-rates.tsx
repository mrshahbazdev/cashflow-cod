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
  InlineStack,
  Layout,
  Page,
  Select,
  Text,
  TextField,
} from '@shopify/polaris';
import { authenticate } from '../shopify.server';
import { getShopByDomain } from '../lib/install.server';
import {
  deleteRate,
  listRates,
  refreshRates,
  upsertRate,
  type FxProvider,
} from '../lib/fx-rates.server';
import { CURRENCIES } from '../lib/currency';

const PROVIDERS: { code: FxProvider; label: string }[] = [
  { code: 'manual', label: 'Manual' },
  { code: 'exchangerate-host', label: 'exchangerate.host (free)' },
  { code: 'fixer', label: 'Fixer.io' },
  { code: 'openexchangerates', label: 'OpenExchangeRates' },
];

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = await getShopByDomain(session.shop);
  if (!shop) throw new Response('Shop not found', { status: 404 });
  const rates = await listRates(shop.id);
  return json({
    rates: rates.map((r) => ({
      id: r.id,
      base: r.base,
      target: r.target,
      rate: Number(r.rate),
      source: r.source,
      fetchedAt: r.fetchedAt.toISOString(),
    })),
  });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = await getShopByDomain(session.shop);
  if (!shop) throw new Response('Shop not found', { status: 404 });
  const body = await request.formData();
  const intent = String(body.get('intent') ?? '');

  if (intent === 'save') {
    await upsertRate({
      shopId: shop.id,
      base: String(body.get('base') ?? '').toUpperCase(),
      target: String(body.get('target') ?? '').toUpperCase(),
      rate: Number(body.get('rate') ?? 0),
      source: 'manual',
    });
  } else if (intent === 'refresh') {
    const provider = String(body.get('provider') ?? 'exchangerate-host') as FxProvider;
    const base = String(body.get('refreshBase') ?? 'USD').toUpperCase();
    const targets = String(body.get('refreshTargets') ?? '')
      .split(',')
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean);
    const apiKey = String(body.get('apiKey') ?? '').trim() || undefined;
    await refreshRates(shop.id, { provider, base, targets, apiKey });
  } else if (intent === 'delete') {
    await deleteRate(shop.id, String(body.get('id') ?? ''));
  }
  return redirect('/app/fx-rates');
};

export default function FxRatesRoute() {
  const { rates } = useLoaderData<typeof loader>();
  const [base, setBase] = useState('USD');
  const [target, setTarget] = useState('PKR');
  const [rate, setRate] = useState('280');
  const [provider, setProvider] = useState<FxProvider>('exchangerate-host');
  const [refreshBase, setRefreshBase] = useState('USD');
  const [refreshTargets, setRefreshTargets] = useState('PKR,INR,AED,EUR,GBP');
  const [apiKey, setApiKey] = useState('');

  const rows = rates.map((r) => [
    r.base,
    r.target,
    r.rate.toString(),
    <Badge key={`s-${r.id}`}>{r.source}</Badge>,
    new Date(r.fetchedAt).toLocaleString(),
    <RemixForm key={r.id} method="post">
      <input type="hidden" name="intent" value="delete" />
      <input type="hidden" name="id" value={r.id} />
      <Button submit tone="critical" variant="plain">
        Delete
      </Button>
    </RemixForm>,
  ]);

  const currencyOptions = CURRENCIES.map((c) => ({ label: `${c.code} — ${c.label}`, value: c.code }));

  return (
    <Page title="FX rates" subtitle="Manual or auto-refreshed currency conversion rates per shop.">
      <Layout>
        <Layout.Section>
          <Card>
            <BlockStack gap="300">
              <Text as="h2" variant="headingMd">
                Add manual rate
              </Text>
              <RemixForm method="post">
                <input type="hidden" name="intent" value="save" />
                <InlineStack gap="300">
                  <Select label="Base" name="base" options={currencyOptions} value={base} onChange={setBase} />
                  <Select label="Target" name="target" options={currencyOptions} value={target} onChange={setTarget} />
                  <div style={{ flex: 1 }}>
                    <TextField label="Rate" name="rate" value={rate} onChange={setRate} autoComplete="off" type="number" />
                  </div>
                </InlineStack>
                <div style={{ marginTop: 12 }}>
                  <Button submit variant="primary">
                    Save rate
                  </Button>
                </div>
              </RemixForm>
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section>
          <Card>
            <BlockStack gap="300">
              <Text as="h2" variant="headingMd">
                Refresh from provider
              </Text>
              <RemixForm method="post">
                <input type="hidden" name="intent" value="refresh" />
                <InlineStack gap="300">
                  <Select
                    label="Provider"
                    name="provider"
                    options={PROVIDERS.map((p) => ({ label: p.label, value: p.code }))}
                    value={provider}
                    onChange={(v) => setProvider(v as FxProvider)}
                  />
                  <Select
                    label="Base"
                    name="refreshBase"
                    options={currencyOptions}
                    value={refreshBase}
                    onChange={setRefreshBase}
                  />
                  <div style={{ flex: 1 }}>
                    <TextField
                      label="Targets (comma)"
                      name="refreshTargets"
                      value={refreshTargets}
                      onChange={setRefreshTargets}
                      autoComplete="off"
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <TextField
                      label="API key (optional)"
                      name="apiKey"
                      value={apiKey}
                      onChange={setApiKey}
                      autoComplete="off"
                      type="password"
                    />
                  </div>
                </InlineStack>
                <div style={{ marginTop: 12 }}>
                  <Button submit>Refresh now</Button>
                </div>
              </RemixForm>
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section>
          <Card>
            <DataTable
              columnContentTypes={['text', 'text', 'numeric', 'text', 'text', 'text']}
              headings={['Base', 'Target', 'Rate', 'Source', 'Updated', '']}
              rows={rows}
            />
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
