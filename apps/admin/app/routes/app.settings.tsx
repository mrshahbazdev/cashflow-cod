import type { LoaderFunctionArgs, ActionFunctionArgs } from '@remix-run/node';
import { json, redirect } from '@remix-run/node';
import { Form as RemixForm, useLoaderData } from '@remix-run/react';
import { useState } from 'react';
import {
  BlockStack,
  Button,
  Card,
  Checkbox,
  InlineGrid,
  Layout,
  Page,
  Select,
  Text,
  TextField,
} from '@shopify/polaris';
import { authenticate } from '../shopify.server';
import { getShopByDomain } from '../lib/install.server';
import prisma from '../db.server';

type Settings = {
  currency?: string;
  timezone?: string;
  defaultLanguage?: string;
  branding?: { accentColor?: string };
  otp?: {
    enabled?: boolean;
    channel?: 'SMS' | 'WHATSAPP' | 'EMAIL' | 'VOICE';
    provider?: string;
    timeoutMinutes?: number;
    riskThreshold?: number;
    alwaysRequire?: boolean;
  };
  fraud?: {
    maxOrdersPerPhonePerDay?: number;
    maxOrdersPerIpPerDay?: number;
    allowedCountries?: string[];
    blockedCountries?: string[];
  };
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = await getShopByDomain(session.shop);
  if (!shop) throw new Response('Shop not found', { status: 404 });
  return json({ shop });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = await getShopByDomain(session.shop);
  if (!shop) throw new Response('Shop not found', { status: 404 });
  const body = await request.formData();

  const current = (shop.settings as Settings) ?? {};
  const channel = String(body.get('otpChannel') ?? 'SMS') as NonNullable<
    Settings['otp']
  >['channel'];
  const next: Settings = {
    currency: String(body.get('currency') ?? current.currency ?? 'USD'),
    timezone: String(body.get('timezone') ?? current.timezone ?? 'UTC'),
    defaultLanguage: String(body.get('defaultLanguage') ?? current.defaultLanguage ?? 'en'),
    branding: {
      accentColor: String(body.get('accentColor') ?? current.branding?.accentColor ?? '#008060'),
    },
    otp: {
      enabled: body.get('otpEnabled') === 'on',
      channel,
      provider: String(body.get('otpProvider') ?? current.otp?.provider ?? 'custom'),
      timeoutMinutes: parseInt(String(body.get('otpTimeout') ?? '10'), 10) || 10,
      riskThreshold: parseInt(String(body.get('otpRiskThreshold') ?? '30'), 10) || 30,
      alwaysRequire: body.get('otpAlways') === 'on',
    },
    fraud: {
      maxOrdersPerPhonePerDay: parseInt(String(body.get('maxOrdersPhone') ?? '5'), 10) || 5,
      maxOrdersPerIpPerDay: parseInt(String(body.get('maxOrdersIp') ?? '10'), 10) || 10,
      allowedCountries: parseCsv(String(body.get('allowedCountries') ?? '')),
      blockedCountries: parseCsv(String(body.get('blockedCountries') ?? '')),
    },
  };

  await prisma.shop.update({
    where: { id: shop.id },
    data: { settings: next as unknown as object },
  });
  return redirect('/app/settings');
};

function parseCsv(s: string): string[] {
  return s
    .split(/[\s,]+/)
    .map((x) => x.trim().toUpperCase())
    .filter(Boolean);
}

export default function SettingsRoute() {
  const { shop } = useLoaderData<typeof loader>();
  const s = (shop.settings as Settings) ?? {};

  const [currency, setCurrency] = useState(s.currency ?? 'USD');
  const [timezone, setTimezone] = useState(s.timezone ?? 'UTC');
  const [lang, setLang] = useState(s.defaultLanguage ?? 'en');
  const [accent, setAccent] = useState(s.branding?.accentColor ?? '#008060');
  const [otpEnabled, setOtpEnabled] = useState(s.otp?.enabled ?? false);
  const [otpChannel, setOtpChannel] = useState(s.otp?.channel ?? 'SMS');
  const [otpProvider, setOtpProvider] = useState(s.otp?.provider ?? 'custom');
  const [otpTimeout, setOtpTimeout] = useState(String(s.otp?.timeoutMinutes ?? 10));
  const [otpRisk, setOtpRisk] = useState(String(s.otp?.riskThreshold ?? 30));
  const [otpAlways, setOtpAlways] = useState(s.otp?.alwaysRequire ?? false);
  const [maxPhone, setMaxPhone] = useState(String(s.fraud?.maxOrdersPerPhonePerDay ?? 5));
  const [maxIp, setMaxIp] = useState(String(s.fraud?.maxOrdersPerIpPerDay ?? 10));
  const [allowedCountries, setAllowedCountries] = useState(
    (s.fraud?.allowedCountries ?? []).join(', '),
  );
  const [blockedCountries, setBlockedCountries] = useState(
    (s.fraud?.blockedCountries ?? []).join(', '),
  );

  return (
    <Page title="Settings" subtitle="Configure branding, OTP, fraud rules, and localization.">
      <RemixForm method="post">
        <Layout>
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">
                  General
                </Text>
                <InlineGrid columns={{ xs: 1, sm: 3 }} gap="300">
                  <TextField
                    label="Currency"
                    name="currency"
                    value={currency}
                    onChange={setCurrency}
                    autoComplete="off"
                  />
                  <TextField
                    label="Timezone"
                    name="timezone"
                    value={timezone}
                    onChange={setTimezone}
                    autoComplete="off"
                  />
                  <Select
                    label="Default language"
                    name="defaultLanguage"
                    options={[
                      { label: 'English', value: 'en' },
                      { label: 'Urdu', value: 'ur' },
                      { label: 'Arabic', value: 'ar' },
                      { label: 'Hindi', value: 'hi' },
                      { label: 'Bengali', value: 'bn' },
                      { label: 'Indonesian', value: 'id' },
                    ]}
                    value={lang}
                    onChange={setLang}
                  />
                </InlineGrid>
                <TextField
                  label="Accent color"
                  name="accentColor"
                  value={accent}
                  onChange={setAccent}
                  autoComplete="off"
                />
              </BlockStack>
            </Card>
          </Layout.Section>
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">
                  OTP verification
                </Text>
                <Checkbox
                  label="Enable phone/email OTP verification"
                  checked={otpEnabled}
                  onChange={setOtpEnabled}
                  name="otpEnabled"
                />
                <InlineGrid columns={{ xs: 1, sm: 3 }} gap="300">
                  <Select
                    label="Channel"
                    name="otpChannel"
                    options={[
                      { label: 'SMS', value: 'SMS' },
                      { label: 'WhatsApp', value: 'WHATSAPP' },
                      { label: 'Email', value: 'EMAIL' },
                      { label: 'Voice', value: 'VOICE' },
                    ]}
                    value={otpChannel}
                    onChange={(v) => setOtpChannel(v as typeof otpChannel)}
                  />
                  <Select
                    label="Provider"
                    name="otpProvider"
                    options={[
                      { label: 'Console (dev)', value: 'custom' },
                      { label: 'Twilio', value: 'twilio' },
                    ]}
                    value={otpProvider}
                    onChange={setOtpProvider}
                  />
                  <TextField
                    label="Code timeout (minutes)"
                    type="number"
                    name="otpTimeout"
                    value={otpTimeout}
                    onChange={setOtpTimeout}
                    autoComplete="off"
                  />
                </InlineGrid>
                <InlineGrid columns={{ xs: 1, sm: 2 }} gap="300">
                  <TextField
                    label="Require OTP when risk score ≥"
                    type="number"
                    name="otpRiskThreshold"
                    value={otpRisk}
                    onChange={setOtpRisk}
                    autoComplete="off"
                  />
                  <Checkbox
                    label="Always require OTP"
                    checked={otpAlways}
                    onChange={setOtpAlways}
                    name="otpAlways"
                  />
                </InlineGrid>
              </BlockStack>
            </Card>
          </Layout.Section>
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">
                  Fraud rules
                </Text>
                <InlineGrid columns={{ xs: 1, sm: 2 }} gap="300">
                  <TextField
                    label="Max orders per phone / day"
                    type="number"
                    name="maxOrdersPhone"
                    value={maxPhone}
                    onChange={setMaxPhone}
                    autoComplete="off"
                  />
                  <TextField
                    label="Max orders per IP / day"
                    type="number"
                    name="maxOrdersIp"
                    value={maxIp}
                    onChange={setMaxIp}
                    autoComplete="off"
                  />
                </InlineGrid>
                <TextField
                  label="Allowed countries (comma-separated ISO codes)"
                  name="allowedCountries"
                  value={allowedCountries}
                  onChange={setAllowedCountries}
                  helpText="Leave empty to allow all."
                  autoComplete="off"
                />
                <TextField
                  label="Blocked countries (comma-separated ISO codes)"
                  name="blockedCountries"
                  value={blockedCountries}
                  onChange={setBlockedCountries}
                  autoComplete="off"
                />
              </BlockStack>
            </Card>
          </Layout.Section>
          <Layout.Section>
            <Button submit variant="primary" size="large">
              Save settings
            </Button>
          </Layout.Section>
        </Layout>
      </RemixForm>
    </Page>
  );
}
