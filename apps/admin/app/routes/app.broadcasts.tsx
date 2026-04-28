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
import {
  createBroadcast,
  deleteBroadcast,
  listBroadcasts,
  listSegments,
  markBroadcastQueued,
} from '../lib/crm.server';

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = await getShopByDomain(session.shop);
  if (!shop) throw new Response('Shop not found', { status: 404 });
  const [broadcasts, segments] = await Promise.all([
    listBroadcasts(shop.id),
    listSegments(shop.id),
  ]);
  return json({ broadcasts, segments });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = await getShopByDomain(session.shop);
  if (!shop) throw new Response('Shop not found', { status: 404 });
  const body = await request.formData();
  const intent = String(body.get('intent') ?? '');

  if (intent === 'create') {
    const name = String(body.get('name') ?? '').trim();
    const channel = (String(body.get('channel') ?? 'whatsapp') as 'whatsapp' | 'sms' | 'email');
    const bodyText = String(body.get('body') ?? '').trim();
    const segmentId = String(body.get('segmentId') ?? '') || null;
    if (!name || !bodyText) return json({ error: 'Name + body required' }, { status: 400 });
    await createBroadcast({
      shopId: shop.id,
      name,
      channel,
      body: bodyText,
      segmentId,
    });
  } else if (intent === 'queue') {
    await markBroadcastQueued(String(body.get('id') ?? ''));
  } else if (intent === 'delete') {
    await deleteBroadcast(shop.id, String(body.get('id') ?? ''));
  }
  return redirect('/app/broadcasts');
};

export default function BroadcastsRoute() {
  const { broadcasts, segments } = useLoaderData<typeof loader>();
  const [name, setName] = useState('');
  const [channel, setChannel] = useState<'whatsapp' | 'sms' | 'email'>('whatsapp');
  const [bodyText, setBodyText] = useState('');
  const [segmentId, setSegmentId] = useState('');

  const rows = broadcasts.map((b) => [
    b.name,
    b.channel,
    b.segment?.name ?? 'All customers',
    <Badge key={`s-${b.id}`} tone={b.status === 'sent' ? 'success' : b.status === 'failed' ? 'critical' : undefined}>
      {b.status}
    </Badge>,
    `${b.sent} / ${b.failed}`,
    new Date(b.createdAt).toLocaleString(),
    <InlineStack key={`act-${b.id}`} gap="200">
      {b.status === 'draft' && (
        <RemixForm method="post">
          <input type="hidden" name="intent" value="queue" />
          <input type="hidden" name="id" value={b.id} />
          <Button submit variant="plain">
            Queue
          </Button>
        </RemixForm>
      )}
      <RemixForm method="post">
        <input type="hidden" name="intent" value="delete" />
        <input type="hidden" name="id" value={b.id} />
        <Button submit tone="critical" variant="plain">
          Delete
        </Button>
      </RemixForm>
    </InlineStack>,
  ]);

  return (
    <Page
      title="Broadcasts"
      subtitle="Send one-off WhatsApp, SMS, or email messages to a customer segment."
    >
      <Layout>
        <Layout.Section>
          <Card>
            <BlockStack gap="300">
              <Text as="h2" variant="headingMd">
                New broadcast
              </Text>
              <RemixForm method="post">
                <input type="hidden" name="intent" value="create" />
                <BlockStack gap="300">
                  <InlineStack gap="300">
                    <div style={{ flex: 1 }}>
                      <TextField
                        label="Name"
                        name="name"
                        value={name}
                        onChange={setName}
                        autoComplete="off"
                      />
                    </div>
                    <Select
                      label="Channel"
                      name="channel"
                      options={[
                        { label: 'WhatsApp', value: 'whatsapp' },
                        { label: 'SMS', value: 'sms' },
                        { label: 'Email', value: 'email' },
                      ]}
                      value={channel}
                      onChange={(v) => setChannel(v as typeof channel)}
                    />
                    <Select
                      label="Segment"
                      name="segmentId"
                      options={[
                        { label: 'All customers', value: '' },
                        ...segments.map((s) => ({ label: s.name, value: s.id })),
                      ]}
                      value={segmentId}
                      onChange={setSegmentId}
                    />
                  </InlineStack>
                  <TextField
                    label="Message body"
                    name="body"
                    value={bodyText}
                    onChange={setBodyText}
                    autoComplete="off"
                    multiline={4}
                    helpText="For WhatsApp with template APIs the body becomes the variable payload."
                  />
                  <InlineStack align="end">
                    <Button submit variant="primary">
                      Save broadcast
                    </Button>
                  </InlineStack>
                </BlockStack>
              </RemixForm>
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section>
          <Card>
            {broadcasts.length === 0 ? (
              <EmptyState
                heading="No broadcasts yet"
                image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
              >
                <p>Save a broadcast above, then click Queue to dispatch.</p>
              </EmptyState>
            ) : (
              <DataTable
                columnContentTypes={['text', 'text', 'text', 'text', 'numeric', 'text', 'text']}
                headings={['Name', 'Channel', 'Segment', 'Status', 'Sent / failed', 'Created', 'Actions']}
                rows={rows}
              />
            )}
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
