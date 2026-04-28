import type { LoaderFunctionArgs, ActionFunctionArgs } from '@remix-run/node';
import { json, redirect } from '@remix-run/node';
import { Form as RemixForm, useLoaderData } from '@remix-run/react';
import { useState } from 'react';
import {
  BlockStack,
  Banner,
  Button,
  Card,
  InlineStack,
  Layout,
  Page,
  Text,
  TextField,
} from '@shopify/polaris';
import { authenticate } from '../shopify.server';
import { getShopByDomain } from '../lib/install.server';
import prisma from '../db.server';

interface FunctionConfig {
  codFeeAmount?: number;
  blockedCities?: string[];
  maxCodAmount?: number;
}

function readConfig(value: unknown): FunctionConfig {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const o = value as Record<string, unknown>;
  return {
    codFeeAmount: typeof o.codFeeAmount === 'number' ? o.codFeeAmount : undefined,
    blockedCities: Array.isArray(o.blockedCities) ? (o.blockedCities as string[]) : undefined,
    maxCodAmount: typeof o.maxCodAmount === 'number' ? o.maxCodAmount : undefined,
  };
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = await getShopByDomain(session.shop);
  if (!shop) throw new Response('Shop not found', { status: 404 });
  const settings = (shop.settings && typeof shop.settings === 'object' && !Array.isArray(shop.settings)
    ? (shop.settings as Record<string, unknown>)
    : {}) as Record<string, unknown>;
  const cfg = readConfig(settings.functionConfig);
  return json({ cfg });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = await getShopByDomain(session.shop);
  if (!shop) throw new Response('Shop not found', { status: 404 });
  const body = await request.formData();
  const cfg: FunctionConfig = {
    codFeeAmount: Number(body.get('codFeeAmount') ?? 0) || undefined,
    maxCodAmount: Number(body.get('maxCodAmount') ?? 0) || undefined,
    blockedCities: String(body.get('blockedCities') ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  };
  const settings = (shop.settings && typeof shop.settings === 'object' && !Array.isArray(shop.settings)
    ? { ...(shop.settings as Record<string, unknown>) }
    : {}) as Record<string, unknown>;
  settings.functionConfig = cfg;
  await prisma.shop.update({
    where: { id: shop.id },
    data: { settings: settings as never },
  });
  return redirect('/app/functions');
};

export default function FunctionsRoute() {
  const { cfg } = useLoaderData<typeof loader>();
  const [codFeeAmount, setCodFeeAmount] = useState(String(cfg.codFeeAmount ?? ''));
  const [maxCodAmount, setMaxCodAmount] = useState(String(cfg.maxCodAmount ?? ''));
  const [blockedCities, setBlockedCities] = useState((cfg.blockedCities ?? []).join(', '));

  return (
    <Page
      title="Shopify Functions"
      subtitle="Configure COD fee, payment-method gating, and delivery-method gating at native checkout."
    >
      <Layout>
        <Layout.Section>
          <Banner tone="info" title="Deployment">
            <p>
              These settings are written to the shop metafield <code>cashflow.function-config</code>. After saving,
              deploy the bundled Functions with:
            </p>
            <pre style={{ background: '#0f172a', color: '#fff', padding: 12, borderRadius: 6 }}>
              cd apps/admin && shopify app function build && shopify app deploy
            </pre>
          </Banner>
        </Layout.Section>
        <Layout.Section>
          <Card>
            <BlockStack gap="300">
              <Text as="h2" variant="headingMd">
                Configuration
              </Text>
              <RemixForm method="post">
                <BlockStack gap="200">
                  <InlineStack gap="200">
                    <div style={{ flex: 1 }}>
                      <TextField
                        label="COD fee amount"
                        name="codFeeAmount"
                        value={codFeeAmount}
                        onChange={setCodFeeAmount}
                        autoComplete="off"
                        type="number"
                        helpText="Surcharge added at checkout when buyer chooses Cash on Delivery."
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <TextField
                        label="Max COD order amount"
                        name="maxCodAmount"
                        value={maxCodAmount}
                        onChange={setMaxCodAmount}
                        autoComplete="off"
                        type="number"
                        helpText="Hide COD payment method when cart total exceeds this value."
                      />
                    </div>
                  </InlineStack>
                  <TextField
                    label="Blocked cities (comma-separated)"
                    name="blockedCities"
                    value={blockedCities}
                    onChange={setBlockedCities}
                    autoComplete="off"
                    helpText="Hide COD delivery option for shipping addresses in these cities."
                  />
                  <div>
                    <Button submit variant="primary">
                      Save
                    </Button>
                  </div>
                </BlockStack>
              </RemixForm>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
