import type { LoaderFunctionArgs, ActionFunctionArgs } from '@remix-run/node';
import { json, redirect } from '@remix-run/node';
import { Form as RemixForm, useLoaderData } from '@remix-run/react';
import { useState } from 'react';
import {
  Badge,
  BlockStack,
  Button,
  Card,
  Checkbox,
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
import {
  deleteEmailIntegration,
  listEmailIntegrations,
  listEmailProviders,
  upsertEmailIntegration,
  type EmailProvider,
} from '../lib/email-integrations.server';

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = await getShopByDomain(session.shop);
  if (!shop) throw new Response('Shop not found', { status: 404 });
  const integrations = await listEmailIntegrations(shop.id);
  const providers = listEmailProviders();
  return json({ integrations, providers });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = await getShopByDomain(session.shop);
  if (!shop) throw new Response('Shop not found', { status: 404 });
  const body = await request.formData();
  const intent = String(body.get('intent') ?? '');

  if (intent === 'save') {
    const provider = String(body.get('provider') ?? '') as EmailProvider;
    const label = String(body.get('label') ?? '').trim() || provider;
    const apiKey = String(body.get('apiKey') ?? '').trim();
    const listId = String(body.get('listId') ?? '').trim();
    const syncSubmissions = body.get('syncSubmissions') === 'on';
    const syncOrders = body.get('syncOrders') === 'on';
    await upsertEmailIntegration({
      shopId: shop.id,
      provider,
      label,
      credentials: { apiKey, listId, mode: apiKey ? 'live' : 'mock' },
      syncSubmissions,
      syncOrders,
    });
  } else if (intent === 'delete') {
    await deleteEmailIntegration(shop.id, String(body.get('id') ?? ''));
  }
  return redirect('/app/email-integrations');
};

export default function EmailIntegrationsRoute() {
  const { integrations, providers } = useLoaderData<typeof loader>();
  const [provider, setProvider] = useState<EmailProvider>('klaviyo');
  const [label, setLabel] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [listId, setListId] = useState('');
  const [syncSubmissions, setSyncSubmissions] = useState(true);
  const [syncOrders, setSyncOrders] = useState(true);

  const rows = integrations.map((i) => [
    i.label,
    i.provider,
    <Badge key={`a-${i.id}`} tone={i.isActive ? 'success' : undefined}>
      {i.isActive ? 'Active' : 'Inactive'}
    </Badge>,
    i.syncSubmissions ? 'yes' : 'no',
    i.syncOrders ? 'yes' : 'no',
    i.lastSyncAt ? new Date(i.lastSyncAt).toLocaleString() : 'never',
    <RemixForm key={i.id} method="post">
      <input type="hidden" name="intent" value="delete" />
      <input type="hidden" name="id" value={i.id} />
      <Button submit tone="critical" variant="plain">
        Delete
      </Button>
    </RemixForm>,
  ]);

  return (
    <Page
      title="Email marketing integrations"
      subtitle="Sync submissions + orders to Klaviyo, Omnisend, or another ESP. Leave API key empty to run in mock mode."
    >
      <Layout>
        <Layout.Section>
          <Card>
            <BlockStack gap="300">
              <Text as="h2" variant="headingMd">
                Connect provider
              </Text>
              <RemixForm method="post">
                <input type="hidden" name="intent" value="save" />
                <BlockStack gap="300">
                  <InlineStack gap="300">
                    <Select
                      label="Provider"
                      name="provider"
                      options={providers.map((p) => ({ label: p.displayName, value: p.code }))}
                      value={provider}
                      onChange={(v) => setProvider(v as EmailProvider)}
                    />
                    <div style={{ flex: 1 }}>
                      <TextField
                        label="Label"
                        name="label"
                        value={label}
                        onChange={setLabel}
                        autoComplete="off"
                        placeholder="Main Klaviyo account"
                      />
                    </div>
                  </InlineStack>
                  <InlineStack gap="300">
                    <div style={{ flex: 1 }}>
                      <TextField
                        label="API key"
                        name="apiKey"
                        value={apiKey}
                        onChange={setApiKey}
                        autoComplete="off"
                        type="password"
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <TextField
                        label="List ID (optional)"
                        name="listId"
                        value={listId}
                        onChange={setListId}
                        autoComplete="off"
                      />
                    </div>
                  </InlineStack>
                  <InlineStack gap="400">
                    <Checkbox
                      label="Sync form submissions"
                      name="syncSubmissions"
                      checked={syncSubmissions}
                      onChange={setSyncSubmissions}
                    />
                    <Checkbox
                      label="Sync orders"
                      name="syncOrders"
                      checked={syncOrders}
                      onChange={setSyncOrders}
                    />
                  </InlineStack>
                  <InlineStack align="end">
                    <Button submit variant="primary">
                      Save integration
                    </Button>
                  </InlineStack>
                </BlockStack>
              </RemixForm>
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section>
          <Card>
            {integrations.length === 0 ? (
              <EmptyState
                heading="No email integrations yet"
                image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
              >
                <p>Add a provider above. Leave the API key empty to run in mock mode.</p>
              </EmptyState>
            ) : (
              <DataTable
                columnContentTypes={['text', 'text', 'text', 'text', 'text', 'text', 'text']}
                headings={['Label', 'Provider', 'Status', 'Submissions', 'Orders', 'Last sync', 'Actions']}
                rows={rows}
              />
            )}
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
