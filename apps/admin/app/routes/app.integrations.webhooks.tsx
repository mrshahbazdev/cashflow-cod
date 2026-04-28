import type { LoaderFunctionArgs, ActionFunctionArgs } from '@remix-run/node';
import { json, redirect } from '@remix-run/node';
import { Form as RemixForm, useLoaderData } from '@remix-run/react';
import { useState } from 'react';
import {
  Badge,
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

const TOPICS = ['submission.created', 'order.placed', 'order.disposition.changed'] as const;

function generateSecret() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID().replace(/-/g, '');
  }
  return Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = await getShopByDomain(session.shop);
  if (!shop) throw new Response('Shop not found', { status: 404 });
  const [subs, deliveries] = await Promise.all([
    prisma.webhookSubscription.findMany({
      where: { shopId: shop.id },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.webhookDelivery.findMany({
      where: { shopId: shop.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    }),
  ]);
  return json({ subs, deliveries, topics: TOPICS });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = await getShopByDomain(session.shop);
  if (!shop) throw new Response('Shop not found', { status: 404 });
  const body = await request.formData();
  const intent = String(body.get('intent') ?? '');
  if (intent === 'create') {
    const topic = String(body.get('topic') ?? '');
    const url = String(body.get('url') ?? '').trim();
    if (!topic || !url) return json({ error: 'Topic and URL required' }, { status: 400 });
    await prisma.webhookSubscription.create({
      data: {
        shopId: shop.id,
        topic,
        url,
        secret: generateSecret(),
        isActive: true,
      },
    });
  } else if (intent === 'delete') {
    const id = String(body.get('id') ?? '');
    await prisma.webhookSubscription.deleteMany({ where: { id, shopId: shop.id } });
  }
  return redirect('/app/integrations/webhooks');
};

export default function WebhooksRoute() {
  const { subs, deliveries, topics } = useLoaderData<typeof loader>();
  const [topic, setTopic] = useState<string>(topics[0]);
  const [url, setUrl] = useState('');

  const subRows = subs.map((s) => [
    s.topic,
    s.url,
    s.isActive ? (
      <Badge key={`a-${s.id}`} tone="success">
        Active
      </Badge>
    ) : (
      <Badge key={`a-${s.id}`}>Paused</Badge>
    ),
    s.lastDeliveryAt ? new Date(s.lastDeliveryAt).toLocaleString() : '—',
    String(s.failures),
    <code key={`sec-${s.id}`} style={{ fontSize: 11 }}>
      {s.secret.slice(0, 8)}…
    </code>,
    <RemixForm key={`d-${s.id}`} method="post">
      <input type="hidden" name="intent" value="delete" />
      <input type="hidden" name="id" value={s.id} />
      <Button submit tone="critical" variant="plain">
        Delete
      </Button>
    </RemixForm>,
  ]);

  const deliveryRows = deliveries.map((d) => [
    new Date(d.createdAt).toLocaleString(),
    d.topic,
    d.url,
    d.statusCode ? (
      <Badge
        key={`s-${d.id}`}
        tone={d.statusCode >= 200 && d.statusCode < 300 ? 'success' : 'critical'}
      >
        {String(d.statusCode)}
      </Badge>
    ) : (
      <Badge key={`s-${d.id}`} tone="warning">
        no response
      </Badge>
    ),
    `${d.durationMs ?? 0} ms`,
    d.errorMessage ? d.errorMessage.slice(0, 80) : '—',
  ]);

  return (
    <Page
      title="Outbound webhooks"
      subtitle="Send signed JSON to your CRM/ERP each time a COD order moves through the funnel."
      backAction={{ content: 'Integrations', url: '/app/integrations' }}
    >
      <Layout>
        <Layout.Section>
          <Card>
            <BlockStack gap="300">
              <Text as="h2" variant="headingMd">
                Add subscription
              </Text>
              <RemixForm method="post">
                <input type="hidden" name="intent" value="create" />
                <BlockStack gap="300">
                  <InlineStack gap="300" align="start" blockAlign="end">
                    <Select
                      label="Topic"
                      name="topic"
                      options={topics.map((t) => ({ label: t, value: t }))}
                      value={topic}
                      onChange={setTopic}
                    />
                    <div style={{ flex: 1 }}>
                      <TextField
                        label="Endpoint URL"
                        name="url"
                        value={url}
                        onChange={setUrl}
                        autoComplete="off"
                        placeholder="https://api.example.com/webhooks/cashflow"
                      />
                    </div>
                  </InlineStack>
                  <Text as="p" tone="subdued">
                    A unique HMAC secret will be generated. Validate{' '}
                    <code>X-Cashflow-Signature: sha256=…</code> on your server.
                  </Text>
                  <InlineStack align="end">
                    <Button submit variant="primary">
                      Add subscription
                    </Button>
                  </InlineStack>
                </BlockStack>
              </RemixForm>
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section>
          <Card>
            {subs.length === 0 ? (
              <EmptyState
                heading="No webhook subscriptions"
                image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
              >
                <p>Subscribe to one of the topics above to receive signed JSON in real time.</p>
              </EmptyState>
            ) : (
              <DataTable
                columnContentTypes={['text', 'text', 'text', 'text', 'numeric', 'text', 'text']}
                headings={[
                  'Topic',
                  'URL',
                  'Status',
                  'Last delivery',
                  'Failures',
                  'Secret',
                  'Actions',
                ]}
                rows={subRows}
              />
            )}
          </Card>
        </Layout.Section>

        <Layout.Section>
          <Card>
            <BlockStack gap="200">
              <Text as="h2" variant="headingMd">
                Recent deliveries (last 50)
              </Text>
              {deliveries.length === 0 ? (
                <Text as="p" tone="subdued">
                  No deliveries yet. They will appear here as soon as a subscribed event fires.
                </Text>
              ) : (
                <DataTable
                  columnContentTypes={['text', 'text', 'text', 'text', 'text', 'text']}
                  headings={['When', 'Topic', 'URL', 'HTTP', 'Latency', 'Error']}
                  rows={deliveryRows}
                />
              )}
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
