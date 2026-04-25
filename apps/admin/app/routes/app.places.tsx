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
  Text,
  TextField,
} from '@shopify/polaris';
import { authenticate } from '../shopify.server';
import { getShopByDomain } from '../lib/install.server';
import prisma from '../db.server';

interface ShopSettings {
  googlePlacesKey?: string;
  googlePlacesCountries?: string;
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = await getShopByDomain(session.shop);
  if (!shop) throw new Response('Shop not found', { status: 404 });
  const settings = (shop.settings as ShopSettings | null) ?? {};
  return json({
    placesKey: settings.googlePlacesKey ?? '',
    countries: settings.googlePlacesCountries ?? '',
  });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = await getShopByDomain(session.shop);
  if (!shop) throw new Response('Shop not found', { status: 404 });
  const body = await request.formData();
  const placesKey = String(body.get('placesKey') ?? '').trim();
  const countries = String(body.get('countries') ?? '').trim();
  const current = (shop.settings as Record<string, unknown> | null) ?? {};
  await prisma.shop.update({
    where: { id: shop.id },
    data: {
      settings: {
        ...current,
        googlePlacesKey: placesKey || undefined,
        googlePlacesCountries: countries || undefined,
      } as object,
    },
  });
  return redirect('/app/places');
};

export default function PlacesRoute() {
  const data = useLoaderData<typeof loader>();
  const [placesKey, setPlacesKey] = useState(data.placesKey);
  const [countries, setCountries] = useState(data.countries);

  return (
    <Page
      title="Address autocomplete"
      subtitle="Use Google Places to suggest addresses while customers fill in the form."
      backAction={{ content: 'Currency', url: '/app/currency' }}
    >
      <Layout>
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text as="p">
                Cashflow uses the Google Maps JavaScript API + Places library on the storefront.
                Create a publishable key in the{' '}
                <Link
                  url="https://console.cloud.google.com/google/maps-apis/credentials"
                  target="_blank"
                >
                  Google Cloud Console
                </Link>{' '}
                and restrict it to your storefront domain. The key is treated as a publishable
                secret &mdash; it is exposed to the storefront so the autocomplete widget can attach
                to the address field.
              </Text>
              <RemixForm method="post">
                <BlockStack gap="400">
                  <TextField
                    label="Google Places publishable key"
                    name="placesKey"
                    value={placesKey}
                    onChange={setPlacesKey}
                    autoComplete="off"
                    helpText="Restrict the key to HTTP referrers matching your storefront domain."
                  />
                  <TextField
                    label="Country bias (comma-separated ISO codes, optional)"
                    name="countries"
                    value={countries}
                    onChange={setCountries}
                    autoComplete="off"
                    placeholder="pk,in,ae"
                    helpText="Limits suggestions to a list of countries. Leave blank for global."
                  />
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
