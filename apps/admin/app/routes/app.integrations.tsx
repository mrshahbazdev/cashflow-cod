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
import type { PixelProvider } from '@cashflow-cod/shared-types';
import { authenticate } from '../shopify.server';
import { getShopByDomain } from '../lib/install.server';
import {
  deletePixel,
  listPixelAdapters,
  listPixels,
  upsertPixel,
} from '../lib/integrations.server';

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = await getShopByDomain(session.shop);
  if (!shop) throw new Response('Shop not found', { status: 404 });
  const pixels = await listPixels(shop.id);
  const adapters = listPixelAdapters();
  return json({ pixels, adapters });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = await getShopByDomain(session.shop);
  if (!shop) throw new Response('Shop not found', { status: 404 });
  const body = await request.formData();
  const intent = String(body.get('intent') ?? '');

  if (intent === 'save') {
    const provider = String(body.get('provider') ?? '') as PixelProvider;
    const pixelId = String(body.get('pixelId') ?? '').trim();
    const accessToken = String(body.get('accessToken') ?? '').trim();
    const testCode = String(body.get('testCode') ?? '').trim();
    const capiEnabled = body.get('capiEnabled') === 'on';
    if (!provider || !pixelId) {
      return json({ error: 'Provider and pixelId required' }, { status: 400 });
    }
    await upsertPixel({
      shopId: shop.id,
      provider,
      pixelId,
      accessToken: accessToken || null,
      testCode: testCode || null,
      capiEnabled,
    });
  } else if (intent === 'delete') {
    const id = String(body.get('id') ?? '');
    await deletePixel(shop.id, id);
  }
  return redirect('/app/integrations');
};

const PROVIDER_HELP: Record<string, string> = {
  meta: 'Pixel ID + System User access token (with ads_management scope)',
  tiktok: 'Pixel Code + Long-lived Access Token (Business API → Events Manager)',
  google:
    'GA4 Measurement ID (G-XXXXXXX) + API Secret (Admin → Data Streams → Measurement Protocol API secrets)',
  snapchat: 'Snap Pixel ID + Conversions API token (Ads Manager → Events Manager)',
  pinterest: 'Pinterest Ad Account ID + Conversions API token (Bearer)',
};

export default function IntegrationsRoute() {
  const { pixels, adapters } = useLoaderData<typeof loader>();
  const [provider, setProvider] = useState<PixelProvider>(
    (adapters[0]?.provider as PixelProvider) ?? 'meta',
  );
  const [pixelId, setPixelId] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [testCode, setTestCode] = useState('');
  const [capiEnabled, setCapiEnabled] = useState(true);

  const rows = pixels.map((p) => [
    p.provider,
    p.pixelId,
    p.capiEnabled ? (
      <Badge key={`c-${p.id}`} tone="success">
        CAPI on
      </Badge>
    ) : (
      <Badge key={`c-${p.id}`}>Browser only</Badge>
    ),
    p.isActive ? (
      <Badge key={`a-${p.id}`} tone="success">
        Active
      </Badge>
    ) : (
      <Badge key={`a-${p.id}`}>Paused</Badge>
    ),
    new Date(p.createdAt).toLocaleString(),
    <RemixForm key={`del-${p.id}`} method="post">
      <input type="hidden" name="intent" value="delete" />
      <input type="hidden" name="id" value={p.id} />
      <Button submit tone="critical" variant="plain">
        Delete
      </Button>
    </RemixForm>,
  ]);

  return (
    <Page
      title="Integrations"
      subtitle="Connect Meta, TikTok, Google, Snapchat, and Pinterest pixels with server-side Conversions API for accurate iOS 14+ attribution."
      secondaryActions={[
        { content: 'Marketing & data sinks', url: '/app/integrations/sinks' },
        { content: 'Outbound webhooks', url: '/app/integrations/webhooks' },
      ]}
    >
      <Layout>
        <Layout.Section>
          <Card>
            <BlockStack gap="300">
              <Text as="h2" variant="headingMd">
                Add / update pixel
              </Text>
              <RemixForm method="post">
                <input type="hidden" name="intent" value="save" />
                <BlockStack gap="300">
                  <InlineStack gap="300" align="start" blockAlign="end">
                    <Select
                      label="Provider"
                      name="provider"
                      options={adapters.map((a) => ({
                        label: a.displayName,
                        value: a.provider,
                      }))}
                      value={provider}
                      onChange={(v) => setProvider(v as PixelProvider)}
                    />
                    <div style={{ flex: 1 }}>
                      <TextField
                        label="Pixel ID"
                        name="pixelId"
                        value={pixelId}
                        onChange={setPixelId}
                        autoComplete="off"
                        helpText={PROVIDER_HELP[provider] ?? undefined}
                      />
                    </div>
                  </InlineStack>
                  <InlineStack gap="300" align="start" blockAlign="end">
                    <div style={{ flex: 2 }}>
                      <TextField
                        label="Access token / API secret"
                        name="accessToken"
                        value={accessToken}
                        onChange={setAccessToken}
                        autoComplete="off"
                        type="password"
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <TextField
                        label="Test event code (optional)"
                        name="testCode"
                        value={testCode}
                        onChange={setTestCode}
                        autoComplete="off"
                      />
                    </div>
                  </InlineStack>
                  <Checkbox
                    label="Fire server-side via Conversions API (recommended)"
                    name="capiEnabled"
                    checked={capiEnabled}
                    onChange={setCapiEnabled}
                  />
                  <InlineStack align="end">
                    <Button submit variant="primary">
                      Save pixel
                    </Button>
                  </InlineStack>
                </BlockStack>
              </RemixForm>
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section>
          <Card>
            {pixels.length === 0 ? (
              <EmptyState
                heading="No pixels connected yet"
                image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
              >
                <p>
                  Add a pixel above. The form widget will fire <code>InitiateCheckout</code> on
                  submit and <code>Purchase</code> on order placement, both client-side and
                  server-side via CAPI.
                </p>
              </EmptyState>
            ) : (
              <DataTable
                columnContentTypes={['text', 'text', 'text', 'text', 'text', 'text']}
                headings={['Provider', 'Pixel ID', 'CAPI', 'Status', 'Created', 'Actions']}
                rows={rows}
              />
            )}
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
