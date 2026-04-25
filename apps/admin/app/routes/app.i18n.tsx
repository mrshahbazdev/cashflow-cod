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
import { SUPPORTED_LANGUAGES, isRtl } from '../lib/i18n.server';
import prisma from '../db.server';

const LANGUAGE_NAMES: Record<string, string> = {
  en: 'English',
  ur: 'Urdu (اردو)',
  ar: 'Arabic (العربية)',
  hi: 'Hindi (हिन्दी)',
  fr: 'Français',
  es: 'Español',
  it: 'Italiano',
  de: 'Deutsch',
  nl: 'Nederlands',
  pt: 'Português',
  'pt-br': 'Português (Brasil)',
  'pt-pt': 'Português (Portugal)',
  pl: 'Polski',
  sv: 'Svenska',
  nb: 'Norsk (Bokmål)',
  no: 'Norsk',
  da: 'Dansk',
  fi: 'Suomi',
  cs: 'Čeština',
  tr: 'Türkçe',
  th: 'ไทย',
  ja: '日本語',
  ko: '한국어',
  zh: '中文',
  'zh-cn': '中文 (简体)',
  'zh-tw': '中文 (繁體)',
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = await getShopByDomain(session.shop);
  if (!shop) throw new Response('Shop not found', { status: 404 });
  return json({
    defaultLanguage: shop.defaultLanguage,
    enabledLanguages: shop.enabledLanguages as string[],
    supported: SUPPORTED_LANGUAGES.map((code) => ({
      code,
      name: LANGUAGE_NAMES[code] ?? code,
      rtl: isRtl(code),
    })),
  });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = await getShopByDomain(session.shop);
  if (!shop) throw new Response('Shop not found', { status: 404 });
  const body = await request.formData();
  const defaultLanguage = String(body.get('defaultLanguage') ?? 'en');
  const enabled = body.getAll('enabled').map(String);
  const list = enabled.length ? enabled : ['en'];
  if (!list.includes(defaultLanguage)) list.push(defaultLanguage);
  await prisma.shop.update({
    where: { id: shop.id },
    data: {
      defaultLanguage,
      enabledLanguages: list,
    },
  });
  return redirect('/app/i18n');
};

export default function I18nRoute() {
  const { defaultLanguage, enabledLanguages, supported } = useLoaderData<typeof loader>();
  const [lang, setLang] = useState(defaultLanguage);
  const [enabled, setEnabled] = useState<string[]>(enabledLanguages);

  return (
    <Page
      title="Languages & direction"
      subtitle="Enable multi-language support for your COD form. Urdu, Arabic, and Hebrew render right-to-left automatically."
    >
      <Layout>
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <RemixForm method="post">
                <BlockStack gap="400">
                  <Select
                    label="Default language"
                    name="defaultLanguage"
                    options={supported.map((s) => ({
                      label: `${s.name}${s.rtl ? ' (RTL)' : ''}`,
                      value: s.code,
                    }))}
                    value={lang}
                    onChange={setLang}
                  />
                  <ChoiceList
                    allowMultiple
                    title="Enabled languages"
                    choices={supported.map((s) => ({
                      label: `${s.name}${s.rtl ? ' (RTL)' : ''}`,
                      value: s.code,
                    }))}
                    selected={enabled}
                    onChange={setEnabled}
                  />
                  {enabled.map((code) => (
                    <input key={code} type="hidden" name="enabled" value={code} />
                  ))}
                  <Text as="p" tone="subdued">
                    Visitors can override the language at runtime with <code>?lang=xx</code> on the
                    form URL. RTL languages flip the layout automatically.
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
