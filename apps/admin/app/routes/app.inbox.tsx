import type { LoaderFunctionArgs, ActionFunctionArgs } from '@remix-run/node';
import { json, redirect } from '@remix-run/node';
import { Form as RemixForm, useLoaderData, useSearchParams } from '@remix-run/react';
import {
  Badge,
  BlockStack,
  Box,
  Button,
  Card,
  DataTable,
  EmptyState,
  InlineStack,
  Layout,
  Page,
  Text,
  TextField,
} from '@shopify/polaris';
import { authenticate } from '../shopify.server';
import { getShopByDomain } from '../lib/install.server';
import {
  appendMessage,
  getThreadWithMessages,
  listThreads,
  markThreadRead,
  updateThreadStatus,
} from '../lib/inbox.server';

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = await getShopByDomain(session.shop);
  if (!shop) throw new Response('Shop not found', { status: 404 });
  const url = new URL(request.url);
  const threadId = url.searchParams.get('thread');
  const threads = await listThreads({ shopId: shop.id, limit: 100 });
  const active = threadId ? await getThreadWithMessages(threadId) : null;
  return json({ threads, active });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = await getShopByDomain(session.shop);
  if (!shop) throw new Response('Shop not found', { status: 404 });
  const body = await request.formData();
  const intent = String(body.get('intent') ?? '');
  const threadId = String(body.get('threadId') ?? '');
  if (intent === 'read' && threadId) {
    await markThreadRead(threadId);
  } else if (intent === 'resolve' && threadId) {
    await updateThreadStatus(threadId, 'resolved');
  } else if (intent === 'reopen' && threadId) {
    await updateThreadStatus(threadId, 'open');
  } else if (intent === 'reply' && threadId) {
    const message = String(body.get('message') ?? '').trim();
    const orderId = String(body.get('orderId') ?? '');
    if (message && orderId) {
      await appendMessage({
        threadId,
        orderId,
        direction: 'outbound',
        body: message,
        provider: 'whatsapp-mock',
      });
    }
  }
  return redirect(`/app/inbox${threadId ? `?thread=${threadId}` : ''}`);
};

export default function InboxRoute() {
  const { threads, active } = useLoaderData<typeof loader>();
  const [params] = useSearchParams();
  const activeId = params.get('thread');

  const rows = threads.map((t) => [
    <a key={t.id} href={`/app/inbox?thread=${t.id}`}>
      {t.customerName ?? t.customerPhone ?? 'Unknown'}
    </a>,
    t.channel,
    t.lastPreview ?? '—',
    t.unreadCount > 0 ? (
      <Badge tone="attention">{`${t.unreadCount} new`}</Badge>
    ) : (
      <Badge>Read</Badge>
    ),
    <Badge
      key={`s-${t.id}`}
      tone={t.status === 'open' ? 'info' : t.status === 'resolved' ? 'success' : undefined}
    >
      {t.status}
    </Badge>,
    new Date(t.lastMessageAt).toLocaleString(),
  ]);

  return (
    <Page
      title="Inbox"
      subtitle="2-way WhatsApp / SMS conversations with your customers."
    >
      <Layout>
        <Layout.Section>
          <Card>
            {threads.length === 0 ? (
              <EmptyState
                heading="No conversations yet"
                image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
              >
                <p>New inbound WhatsApp messages will appear here automatically.</p>
              </EmptyState>
            ) : (
              <DataTable
                columnContentTypes={['text', 'text', 'text', 'text', 'text', 'text']}
                headings={['Customer', 'Channel', 'Preview', 'Unread', 'Status', 'Last message']}
                rows={rows}
              />
            )}
          </Card>
        </Layout.Section>

        {active ? (
          <Layout.Section>
            <Card>
              <BlockStack gap="300">
                <InlineStack align="space-between" blockAlign="center">
                  <Text as="h2" variant="headingMd">
                    {active.customerName ?? active.customerPhone ?? 'Conversation'}
                  </Text>
                  <InlineStack gap="200">
                    <RemixForm method="post">
                      <input type="hidden" name="intent" value="read" />
                      <input type="hidden" name="threadId" value={active.id} />
                      <Button submit variant="plain">
                        Mark read
                      </Button>
                    </RemixForm>
                    <RemixForm method="post">
                      <input
                        type="hidden"
                        name="intent"
                        value={active.status === 'resolved' ? 'reopen' : 'resolve'}
                      />
                      <input type="hidden" name="threadId" value={active.id} />
                      <Button submit>
                        {active.status === 'resolved' ? 'Reopen' : 'Resolve'}
                      </Button>
                    </RemixForm>
                  </InlineStack>
                </InlineStack>
                <Box paddingBlockStart="200" paddingBlockEnd="200">
                  <BlockStack gap="200">
                    {active.messages.map((m) => (
                      <Box
                        key={m.id}
                        background={
                          m.direction === 'outbound' ? 'bg-surface-info' : 'bg-surface-secondary'
                        }
                        padding="200"
                        borderRadius="200"
                      >
                        <BlockStack gap="100">
                          <Text as="span" tone="subdued" variant="bodySm">
                            {m.direction} • {new Date(m.createdAt).toLocaleString()}
                          </Text>
                          <Text as="p">{m.body ?? '—'}</Text>
                        </BlockStack>
                      </Box>
                    ))}
                  </BlockStack>
                </Box>
                {active.order ? (
                  <RemixForm method="post">
                    <input type="hidden" name="intent" value="reply" />
                    <input type="hidden" name="threadId" value={active.id} />
                    <input type="hidden" name="orderId" value={active.order.id} />
                    <BlockStack gap="200">
                      <TextField
                        label="Your reply"
                        name="message"
                        autoComplete="off"
                        multiline={3}
                      />
                      <InlineStack align="end">
                        <Button submit variant="primary">
                          Send
                        </Button>
                      </InlineStack>
                    </BlockStack>
                  </RemixForm>
                ) : (
                  <Text as="p" tone="subdued">
                    No linked order — open a new order to reply through this thread.
                  </Text>
                )}
              </BlockStack>
            </Card>
          </Layout.Section>
        ) : threads.length > 0 ? (
          <Layout.Section>
            <Card>
              <Text as="p" tone="subdued">
                Select a conversation from the list above to view messages.
                {activeId ? ` (Thread ${activeId} not found.)` : ''}
              </Text>
            </Card>
          </Layout.Section>
        ) : null}
      </Layout>
    </Page>
  );
}
