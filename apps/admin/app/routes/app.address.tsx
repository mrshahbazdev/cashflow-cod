import type { LoaderFunctionArgs, ActionFunctionArgs } from '@remix-run/node';
import { json, redirect } from '@remix-run/node';
import { Form as RemixForm, useLoaderData } from '@remix-run/react';
import { useState } from 'react';
import {
  BlockStack,
  Button,
  Card,
  InlineStack,
  Layout,
  Link,
  Page,
  Select,
  Text,
  TextField,
} from '@shopify/polaris';
import { authenticate } from '../shopify.server';
import { getShopByDomain } from '../lib/install.server';
import prisma from '../db.server';

const PROVIDERS = [
  { label: 'None (postal-code regex only)', value: 'none' },
  { label: 'Google Address Validation API', value: 'google' },
  { label: 'Smarty international street', value: 'smarty' },
];

interface AddressSettings {
  provider?: 'none' | 'google' | 'smarty';
  googleApiKey?: string;
  smartyAuthId?: string;
  smartyAuthToken?: string;
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = await getShopByDomain(session.shop);
  if (!shop) throw new Response('Shop not found', { status: 404 });
  const settings = (shop.settings as Record<string, unknown> | null) ?? {};
  const addr = (settings.address as AddressSettings | undefined) ?? {};
  return json({
    provider: addr.provider ?? 'none',
    googleApiKey: addr.googleApiKey ?? '',
    smartyAuthId: addr.smartyAuthId ?? '',
    smartyAuthToken: addr.smartyAuthToken ?? '',
  });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = await getShopByDomain(session.shop);
  if (!shop) throw new Response('Shop not found', { status: 404 });
  const body = await request.formData();
  const provider = String(body.get('provider') ?? 'none') as AddressSettings['provider'];
  const googleApiKey = String(body.get('googleApiKey') ?? '').trim();
  const smartyAuthId = String(body.get('smartyAuthId') ?? '').trim();
  const smartyAuthToken = String(body.get('smartyAuthToken') ?? '').trim();
  const current = (shop.settings as Record<string, unknown> | null) ?? {};
  await prisma.shop.update({
    where: { id: shop.id },
    data: {
      settings: {
        ...current,
        address: {
          provider,
          googleApiKey: googleApiKey || undefined,
          smartyAuthId: smartyAuthId || undefined,
          smartyAuthToken: smartyAuthToken || undefined,
        },
      } as object,
    },
  });
  return redirect('/app/address');
};

export default function AddressRoute() {
  const data = useLoaderData<typeof loader>();
  const [provider, setProvider] = useState<string>(data.provider);
  const [googleApiKey, setGoogleApiKey] = useState(data.googleApiKey);
  const [smartyAuthId, setSmartyAuthId] = useState(data.smartyAuthId);
  const [smartyAuthToken, setSmartyAuthToken] = useState(data.smartyAuthToken);

  return (
    <Page
      title="Address validation"
      subtitle="Verify shipping addresses before the COD form is submitted."
    >
      <Layout>
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text as="p">
                Postal-code format checks always run server-side using a curated set of country
                regexes (40+ countries supported). Optionally enable a third-party provider for
                deeper verification (deliverability, address normalisation).
              </Text>
              <RemixForm method="post">
                <BlockStack gap="400">
                  <Select
                    label="Provider"
                    name="provider"
                    options={PROVIDERS}
                    value={provider}
                    onChange={setProvider}
                  />
                  {provider === 'google' && (
                    <BlockStack gap="200">
                      <Text as="p" tone="subdued">
                        Use the{' '}
                        <Link
                          url="https://developers.google.com/maps/documentation/address-validation/overview"
                          target="_blank"
                        >
                          Google Address Validation API
                        </Link>
                        . Enable it on the same Cloud project you used for Places.
                      </Text>
                      <TextField
                        label="Google Address Validation API key"
                        name="googleApiKey"
                        value={googleApiKey}
                        onChange={setGoogleApiKey}
                        autoComplete="off"
                        type="password"
                      />
                    </BlockStack>
                  )}
                  {provider === 'smarty' && (
                    <BlockStack gap="200">
                      <Text as="p" tone="subdued">
                        Smarty international street (
                        <Link
                          url="https://www.smarty.com/products/international-address-verification"
                          target="_blank"
                        >
                          docs
                        </Link>
                        ).
                      </Text>
                      <TextField
                        label="Smarty Auth ID"
                        name="smartyAuthId"
                        value={smartyAuthId}
                        onChange={setSmartyAuthId}
                        autoComplete="off"
                      />
                      <TextField
                        label="Smarty Auth Token"
                        name="smartyAuthToken"
                        value={smartyAuthToken}
                        onChange={setSmartyAuthToken}
                        autoComplete="off"
                        type="password"
                      />
                    </BlockStack>
                  )}
                  <InlineStack align="end">
                    <Button submit variant="primary">
                      Save
                    </Button>
                  </InlineStack>
                </BlockStack>
              </RemixForm>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
