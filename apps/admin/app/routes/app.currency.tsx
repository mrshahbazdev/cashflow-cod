import type { LoaderFunctionArgs, ActionFunctionArgs } from '@remix-run/node';
import { json, redirect } from '@remix-run/node';
import { Form as RemixForm, useLoaderData } from '@remix-run/react';
import { useState } from 'react';
import {
  BlockStack,
  Button,
  Card,
  ChoiceList,
  InlineStack,
  Layout,
  Page,
  Select,
  Text,
} from '@shopify/polaris';
import { authenticate } from '../shopify.server';
import { getShopByDomain } from '../lib/install.server';
import { CURRENCIES, formatMoney } from '../lib/currency';
import prisma from '../db.server';

interface ShopSettings {
  currency?: string;
  enabledCurrencies?: string[];
  locale?: string;
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = await getShopByDomain(session.shop);
  if (!shop) throw new Response('Shop not found', { status: 404 });
  const settings = (shop.settings as ShopSettings | null) ?? {};
  return json({
    base: settings.currency ?? 'USD',
    enabled: settings.enabledCurrencies ?? [settings.currency ?? 'USD'],
    locale: settings.locale ?? '',
    currencies: CURRENCIES.map((c) => ({
      code: c.code,
      label: `${c.code} — ${c.label}`,
      symbol: c.symbol,
      sample: formatMoney(1234.56, c.code),
    })),
  });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = await getShopByDomain(session.shop);
  if (!shop) throw new Response('Shop not found', { status: 404 });
  const body = await request.formData();
  const base = String(body.get('base') ?? 'USD');
  const locale = String(body.get('locale') ?? '').trim() || undefined;
  const enabled = body.getAll('enabled').map(String);
  if (!enabled.includes(base)) enabled.push(base);
  const current = (shop.settings as ShopSettings | null) ?? {};
  await prisma.shop.update({
    where: { id: shop.id },
    data: {
      settings: {
        ...current,
        currency: base,
        enabledCurrencies: enabled,
        locale,
      } as object,
    },
  });
  return redirect('/app/currency');
};

export default function CurrencyRoute() {
  const data = useLoaderData<typeof loader>();
  const [base, setBase] = useState(data.base);
  const [enabled, setEnabled] = useState<string[]>(data.enabled);
  const [locale, setLocale] = useState(data.locale);

  return (
    <Page
      title="Currency & locale"
      subtitle="Pick a base currency and optionally enable presentation currencies for Shopify Markets."
      backAction={{ content: 'Languages', url: '/app/i18n' }}
    >
      <Layout>
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <RemixForm method="post">
                <BlockStack gap="400">
                  <Select
                    label="Base currency"
                    name="base"
                    options={data.currencies.map((c) => ({
                      label: `${c.label} (${c.sample})`,
                      value: c.code,
                    }))}
                    value={base}
                    onChange={setBase}
                  />
                  <ChoiceList
                    allowMultiple
                    title="Presentation currencies (Shopify Markets)"
                    choices={data.currencies.map((c) => ({
                      label: `${c.label} (${c.sample})`,
                      value: c.code,
                    }))}
                    selected={enabled}
                    onChange={setEnabled}
                  />
                  {enabled.map((code) => (
                    <input key={code} type="hidden" name="enabled" value={code} />
                  ))}
                  <Select
                    label="Locale override (optional)"
                    name="locale"
                    options={[
                      { label: 'Use language default', value: '' },
                      { label: 'en-US', value: 'en-US' },
                      { label: 'en-GB', value: 'en-GB' },
                      { label: 'en-IN', value: 'en-IN' },
                      { label: 'fr-FR', value: 'fr-FR' },
                      { label: 'de-DE', value: 'de-DE' },
                      { label: 'es-ES', value: 'es-ES' },
                      { label: 'es-MX', value: 'es-MX' },
                      { label: 'pt-BR', value: 'pt-BR' },
                      { label: 'pt-PT', value: 'pt-PT' },
                      { label: 'it-IT', value: 'it-IT' },
                      { label: 'nl-NL', value: 'nl-NL' },
                      { label: 'pl-PL', value: 'pl-PL' },
                      { label: 'tr-TR', value: 'tr-TR' },
                      { label: 'ar-AE', value: 'ar-AE' },
                      { label: 'ur-PK', value: 'ur-PK' },
                      { label: 'hi-IN', value: 'hi-IN' },
                      { label: 'th-TH', value: 'th-TH' },
                      { label: 'ja-JP', value: 'ja-JP' },
                      { label: 'ko-KR', value: 'ko-KR' },
                      { label: 'zh-CN', value: 'zh-CN' },
                      { label: 'zh-TW', value: 'zh-TW' },
                    ]}
                    value={locale}
                    onChange={setLocale}
                  />
                  <Text as="p" tone="subdued">
                    The base currency is used to record COD orders in Shopify. Presentation
                    currencies are surfaced to the storefront widget so it can render the cart total
                    in the buyer&rsquo;s preferred currency.
                  </Text>
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
