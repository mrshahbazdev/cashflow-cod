import type { LoaderFunctionArgs, ActionFunctionArgs } from '@remix-run/node';
import { json, redirect } from '@remix-run/node';
import { Form as RemixForm, useLoaderData } from '@remix-run/react';
import { useState } from 'react';
import {
  Banner,
  BlockStack,
  Button,
  Card,
  Checkbox,
  Divider,
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

type VoiceSettings = {
  enabled?: boolean;
  autoCallOnOrder?: boolean;
  provider?: string;
  maxRetries?: number;
  retryDelayMinutes?: number;
  twilioAccountSid?: string;
  twilioAuthToken?: string;
  twilioFromNumber?: string;
  elevenLabsApiKey?: string;
  elevenLabsVoiceId?: string;
  retellApiKey?: string;
  retellAgentId?: string;
  retellFromNumber?: string;
  openaiApiKey?: string;
  openaiRelayUrl?: string;
};

type Settings = {
  currency?: string;
  timezone?: string;
  defaultLanguage?: string;
  defaultFormSlug?: string;
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
  voice?: VoiceSettings;
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = await getShopByDomain(session.shop);
  if (!shop) throw new Response('Shop not found', { status: 404 });
  const forms = await prisma.form.findMany({
    where: { shopId: shop.id, isActive: true },
    orderBy: [{ updatedAt: 'desc' }],
    select: { slug: true, name: true },
  });
  return json({ shop, forms });
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
    defaultFormSlug: String(body.get('defaultFormSlug') ?? current.defaultFormSlug ?? ''),
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
    voice: {
      enabled: body.get('voiceEnabled') === 'on',
      autoCallOnOrder: body.get('voiceAutoCall') === 'on',
      provider: String(body.get('voiceProvider') ?? current.voice?.provider ?? 'twilio'),
      maxRetries: parseInt(String(body.get('voiceMaxRetries') ?? '3'), 10) || 3,
      retryDelayMinutes: parseInt(String(body.get('voiceRetryDelay') ?? '5'), 10) || 5,
      twilioAccountSid: String(body.get('twilioAccountSid') ?? current.voice?.twilioAccountSid ?? ''),
      twilioAuthToken: String(body.get('twilioAuthToken') ?? current.voice?.twilioAuthToken ?? ''),
      twilioFromNumber: String(body.get('twilioFromNumber') ?? current.voice?.twilioFromNumber ?? ''),
      elevenLabsApiKey: String(body.get('elevenLabsApiKey') ?? current.voice?.elevenLabsApiKey ?? ''),
      elevenLabsVoiceId: String(body.get('elevenLabsVoiceId') ?? current.voice?.elevenLabsVoiceId ?? ''),
      retellApiKey: String(body.get('retellApiKey') ?? current.voice?.retellApiKey ?? ''),
      retellAgentId: String(body.get('retellAgentId') ?? current.voice?.retellAgentId ?? ''),
      retellFromNumber: String(body.get('retellFromNumber') ?? current.voice?.retellFromNumber ?? ''),
      openaiApiKey: String(body.get('openaiApiKey') ?? current.voice?.openaiApiKey ?? ''),
      openaiRelayUrl: String(body.get('openaiRelayUrl') ?? current.voice?.openaiRelayUrl ?? ''),
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

const VOICE_PROVIDERS = [
  { label: 'A — Twilio TTS + DTMF (basic)', value: 'twilio' },
  { label: 'B — ElevenLabs + Twilio (natural voice)', value: 'elevenlabs-twilio' },
  { label: 'C — Retell AI (2-way AI agent)', value: 'retell' },
  { label: 'C — OpenAI Realtime (2-way AI agent)', value: 'openai-realtime' },
];

export default function SettingsRoute() {
  const { shop, forms } = useLoaderData<typeof loader>();
  const s = (shop.settings as Settings) ?? {};

  const [currency, setCurrency] = useState(s.currency ?? 'USD');
  const [timezone, setTimezone] = useState(s.timezone ?? 'UTC');
  const [lang, setLang] = useState(s.defaultLanguage ?? 'en');
  const [defaultFormSlug, setDefaultFormSlug] = useState(s.defaultFormSlug ?? '');
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

  // Voice / AI calling settings
  const v = s.voice ?? {};
  const [voiceEnabled, setVoiceEnabled] = useState(v.enabled ?? false);
  const [voiceAutoCall, setVoiceAutoCall] = useState(v.autoCallOnOrder ?? false);
  const [voiceProvider, setVoiceProvider] = useState(v.provider ?? 'twilio');
  const [voiceMaxRetries, setVoiceMaxRetries] = useState(String(v.maxRetries ?? 3));
  const [voiceRetryDelay, setVoiceRetryDelay] = useState(String(v.retryDelayMinutes ?? 5));
  const [twilioSid, setTwilioSid] = useState(v.twilioAccountSid ?? '');
  const [twilioToken, setTwilioToken] = useState(v.twilioAuthToken ?? '');
  const [twilioFrom, setTwilioFrom] = useState(v.twilioFromNumber ?? '');
  const [elApiKey, setElApiKey] = useState(v.elevenLabsApiKey ?? '');
  const [elVoiceId, setElVoiceId] = useState(v.elevenLabsVoiceId ?? '');
  const [retellKey, setRetellKey] = useState(v.retellApiKey ?? '');
  const [retellAgent, setRetellAgent] = useState(v.retellAgentId ?? '');
  const [retellFrom, setRetellFrom] = useState(v.retellFromNumber ?? '');
  const [openaiKey, setOpenaiKey] = useState(v.openaiApiKey ?? '');
  const [openaiRelay, setOpenaiRelay] = useState(v.openaiRelayUrl ?? '');

  const showTwilio = voiceProvider === 'twilio' || voiceProvider === 'elevenlabs-twilio' || voiceProvider === 'openai-realtime';
  const showElevenLabs = voiceProvider === 'elevenlabs-twilio';
  const showRetell = voiceProvider === 'retell';
  const showOpenai = voiceProvider === 'openai-realtime';

  return (
    <Page title="Settings" subtitle="Configure branding, OTP, fraud rules, voice calling, and localization.">
      <RemixForm method="post">
        <Layout>
          {/* ── General ────────────────────────────────────────── */}
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
                <Select
                  label="Default storefront form"
                  name="defaultFormSlug"
                  helpText="Theme blocks set to slug 'default' will open this form. If unset, the most recently updated active form is used."
                  options={[
                    { label: '(Auto: most recently updated active form)', value: '' },
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    ...forms.map((f: any) => ({ label: `${f.name} (${f.slug})`, value: f.slug })),
                  ]}
                  value={defaultFormSlug}
                  onChange={setDefaultFormSlug}
                />
              </BlockStack>
            </Card>
          </Layout.Section>

          {/* ── OTP ────────────────────────────────────────────── */}
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
                    onChange={(v2) => setOtpChannel(v2 as typeof otpChannel)}
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

          {/* ── Fraud rules ────────────────────────────────────── */}
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

          {/* ── AI Voice Calling (A + B + C) ───────────────────── */}
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">
                  AI voice calling
                </Text>
                <Banner tone="info">
                  <p>
                    <strong>Option A</strong> — Basic Twilio TTS + DTMF keypresses.{' '}
                    <strong>Option B</strong> — ElevenLabs natural voice (Urdu/Arabic) + Twilio call.{' '}
                    <strong>Option C</strong> — Full AI conversational agent (Retell AI or OpenAI Realtime).
                  </p>
                </Banner>

                <Checkbox
                  label="Enable AI voice confirmation calls"
                  checked={voiceEnabled}
                  onChange={setVoiceEnabled}
                  name="voiceEnabled"
                />
                <Checkbox
                  label="Auto-call when a new order comes in"
                  checked={voiceAutoCall}
                  onChange={setVoiceAutoCall}
                  name="voiceAutoCall"
                  helpText="Worker will automatically place a confirmation call for every new order."
                />
                <InlineGrid columns={{ xs: 1, sm: 3 }} gap="300">
                  <Select
                    label="Voice provider"
                    name="voiceProvider"
                    options={VOICE_PROVIDERS}
                    value={voiceProvider}
                    onChange={setVoiceProvider}
                  />
                  <TextField
                    label="Max retries"
                    type="number"
                    name="voiceMaxRetries"
                    value={voiceMaxRetries}
                    onChange={setVoiceMaxRetries}
                    helpText="How many times to retry a failed call."
                    autoComplete="off"
                  />
                  <TextField
                    label="Retry delay (minutes)"
                    type="number"
                    name="voiceRetryDelay"
                    value={voiceRetryDelay}
                    onChange={setVoiceRetryDelay}
                    autoComplete="off"
                  />
                </InlineGrid>

                {/* Twilio credentials (A, B, C-OpenAI) */}
                {showTwilio && (
                  <>
                    <Divider />
                    <Text as="h3" variant="headingSm">
                      Twilio credentials
                    </Text>
                    <InlineGrid columns={{ xs: 1, sm: 3 }} gap="300">
                      <TextField
                        label="Account SID"
                        name="twilioAccountSid"
                        value={twilioSid}
                        onChange={setTwilioSid}
                        autoComplete="off"
                      />
                      <TextField
                        label="Auth Token"
                        name="twilioAuthToken"
                        type="password"
                        value={twilioToken}
                        onChange={setTwilioToken}
                        autoComplete="off"
                      />
                      <TextField
                        label="From number"
                        name="twilioFromNumber"
                        value={twilioFrom}
                        onChange={setTwilioFrom}
                        placeholder="+1234567890"
                        autoComplete="off"
                      />
                    </InlineGrid>
                  </>
                )}

                {/* ElevenLabs credentials (B) */}
                {showElevenLabs && (
                  <>
                    <Divider />
                    <Text as="h3" variant="headingSm">
                      ElevenLabs credentials
                    </Text>
                    <Text as="p" tone="subdued">
                      Generates realistic Urdu / Arabic / English speech. Requires an ElevenLabs
                      subscription.
                    </Text>
                    <InlineGrid columns={{ xs: 1, sm: 2 }} gap="300">
                      <TextField
                        label="API Key"
                        name="elevenLabsApiKey"
                        type="password"
                        value={elApiKey}
                        onChange={setElApiKey}
                        autoComplete="off"
                      />
                      <TextField
                        label="Voice ID"
                        name="elevenLabsVoiceId"
                        value={elVoiceId}
                        onChange={setElVoiceId}
                        helpText="Leave empty for default multilingual voice."
                        autoComplete="off"
                      />
                    </InlineGrid>
                  </>
                )}

                {/* Retell AI credentials (C) */}
                {showRetell && (
                  <>
                    <Divider />
                    <Text as="h3" variant="headingSm">
                      Retell AI credentials
                    </Text>
                    <Text as="p" tone="subdued">
                      Full 2-way AI conversational agent. Create an agent at{' '}
                      <a href="https://www.retellai.com" target="_blank" rel="noreferrer">
                        retellai.com
                      </a>{' '}
                      and paste the keys below.
                    </Text>
                    <InlineGrid columns={{ xs: 1, sm: 3 }} gap="300">
                      <TextField
                        label="API Key"
                        name="retellApiKey"
                        type="password"
                        value={retellKey}
                        onChange={setRetellKey}
                        autoComplete="off"
                      />
                      <TextField
                        label="Agent ID"
                        name="retellAgentId"
                        value={retellAgent}
                        onChange={setRetellAgent}
                        autoComplete="off"
                      />
                      <TextField
                        label="From number"
                        name="retellFromNumber"
                        value={retellFrom}
                        onChange={setRetellFrom}
                        placeholder="+1234567890"
                        helpText="Phone number registered in Retell."
                        autoComplete="off"
                      />
                    </InlineGrid>
                  </>
                )}

                {/* OpenAI Realtime credentials (C) */}
                {showOpenai && (
                  <>
                    <Divider />
                    <Text as="h3" variant="headingSm">
                      OpenAI Realtime API
                    </Text>
                    <Text as="p" tone="subdued">
                      Uses Twilio to place the call and bridges audio to OpenAI Realtime for 2-way
                      conversation. Requires a WebSocket relay server.
                    </Text>
                    <InlineGrid columns={{ xs: 1, sm: 2 }} gap="300">
                      <TextField
                        label="OpenAI API Key"
                        name="openaiApiKey"
                        type="password"
                        value={openaiKey}
                        onChange={setOpenaiKey}
                        autoComplete="off"
                      />
                      <TextField
                        label="Relay WebSocket URL"
                        name="openaiRelayUrl"
                        value={openaiRelay}
                        onChange={setOpenaiRelay}
                        placeholder="wss://your-app.fly.dev/api/voice/openai-relay"
                        autoComplete="off"
                      />
                    </InlineGrid>
                  </>
                )}
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
