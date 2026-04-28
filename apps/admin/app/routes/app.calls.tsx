import type { LoaderFunctionArgs, ActionFunctionArgs } from '@remix-run/node';
import { json, redirect } from '@remix-run/node';
import { Form as RemixForm, useLoaderData } from '@remix-run/react';
import { useState } from 'react';
import {
  Badge,
  Banner,
  BlockStack,
  Button,
  Card,
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
import prisma from '../db.server';
import { placeConfirmationCall } from '../lib/calls.server';

const PROVIDERS = [
  { label: 'A — Twilio TTS + DTMF', value: 'twilio' },
  { label: 'B — ElevenLabs + Twilio', value: 'elevenlabs-twilio' },
  { label: 'C — Retell AI', value: 'retell' },
  { label: 'C — OpenAI Realtime', value: 'openai-realtime' },
];

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = await getShopByDomain(session.shop);
  if (!shop) throw new Response('Shop not found', { status: 404 });
  const sessions = await prisma.callSession.findMany({
    where: { order: { shopId: shop.id } },
    orderBy: { createdAt: 'desc' },
    take: 100,
    include: {
      order: { select: { id: true, customerName: true, phone: true, total: true } },
    },
  });
  const voiceSettings = ((shop.settings as Record<string, unknown>)?.voice ?? {}) as Record<
    string,
    unknown
  >;
  return json({ sessions, voiceEnabled: !!voiceSettings.enabled });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = await getShopByDomain(session.shop);
  if (!shop) throw new Response('Shop not found', { status: 404 });

  const body = await request.formData();
  const intent = body.get('intent');
  if (intent === 'call') {
    const orderId = String(body.get('orderId') ?? '');
    const language = String(body.get('language') ?? 'en');
    const provider = String(body.get('provider') ?? '');
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (order && order.shopId === shop.id) {
      await placeConfirmationCall({
        orderId,
        language,
        provider: provider || undefined,
      });
    }
  }
  return redirect('/app/calls');
};

function tone(status: string): 'success' | 'warning' | 'critical' | 'info' {
  if (status === 'completed' || status === 'answered') return 'success';
  if (status === 'failed' || status === 'no_answer') return 'critical';
  if (status === 'queued' || status === 'dialing') return 'info';
  return 'warning';
}

function providerLabel(p: string): string {
  if (p === 'twilio-voice') return 'Twilio';
  if (p === 'elevenlabs-twilio') return 'ElevenLabs';
  if (p === 'retell') return 'Retell AI';
  if (p === 'openai-realtime') return 'OpenAI RT';
  return p;
}

export default function CallsRoute() {
  const { sessions, voiceEnabled } = useLoaderData<typeof loader>();
  const [provider, setProvider] = useState('twilio');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows = sessions.map((s: any) => [
    new Date(s.createdAt).toLocaleString(),
    s.order.customerName ?? '—',
    s.order.phone ?? '—',
    <Badge key={s.id} tone={tone(s.status)}>
      {s.status}
    </Badge>,
    providerLabel(s.provider),
    s.language,
    s.dispositionCapture ?? '—',
    s.durationSec != null ? `${s.durationSec}s` : '—',
  ]);

  return (
    <Page
      title="AI voice calls"
      subtitle="Automated confirmation calls — Twilio DTMF, ElevenLabs natural voice, or full AI agent."
    >
      <Layout>
        {!voiceEnabled && (
          <Layout.Section>
            <Banner tone="warning">
              <p>
                Voice calling is disabled. Go to{' '}
                <a href="/app/settings">Settings</a> to enable it and configure
                your provider credentials.
              </p>
            </Banner>
          </Layout.Section>
        )}
        <Layout.Section>
          <Card>
            <BlockStack gap="300">
              <Text as="h2" variant="headingMd">
                Manual call
              </Text>
              <Text as="p" tone="subdued">
                Paste an order ID, pick a provider and language, then place a confirmation call.
              </Text>
              <RemixForm method="post">
                <input type="hidden" name="intent" value="call" />
                <InlineStack gap="200" align="start" blockAlign="end">
                  <div style={{ minWidth: 240 }}>
                    <TextField
                      label="Order ID"
                      name="orderId"
                      autoComplete="off"
                      value=""
                      onChange={() => {}}
                    />
                  </div>
                  <Select
                    label="Provider"
                    name="provider"
                    options={PROVIDERS}
                    value={provider}
                    onChange={setProvider}
                  />
                  <Select
                    label="Language"
                    name="language"
                    options={[
                      { label: 'English', value: 'en' },
                      { label: 'Urdu', value: 'ur' },
                      { label: 'Arabic', value: 'ar' },
                    ]}
                    value="en"
                    onChange={() => {}}
                  />
                  <Button submit variant="primary">
                    Call now
                  </Button>
                </InlineStack>
              </RemixForm>
            </BlockStack>
          </Card>
        </Layout.Section>
        <Layout.Section>
          <Card>
            {sessions.length === 0 ? (
              <EmptyState heading="No calls placed yet" image="">
                <p>
                  When a submission comes in, our worker will place an AI confirmation call
                  (if auto-call is enabled in Settings).
                </p>
              </EmptyState>
            ) : (
              <DataTable
                columnContentTypes={[
                  'text',
                  'text',
                  'text',
                  'text',
                  'text',
                  'text',
                  'text',
                  'text',
                ]}
                headings={[
                  'Placed at',
                  'Customer',
                  'Phone',
                  'Status',
                  'Provider',
                  'Language',
                  'Disposition',
                  'Duration',
                ]}
                rows={rows}
              />
            )}
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
