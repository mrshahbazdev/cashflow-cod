import type { LoaderFunctionArgs, ActionFunctionArgs } from '@remix-run/node';
import { json, redirect } from '@remix-run/node';
import { Form as RemixForm, useLoaderData } from '@remix-run/react';
import {
  Badge,
  BlockStack,
  Button,
  Card,
  DataTable,
  EmptyState,
  Layout,
  Page,
  Text,
} from '@shopify/polaris';
import { authenticate } from '../shopify.server';
import { getShopByDomain } from '../lib/install.server';
import prisma from '../db.server';
import { placeConfirmationCall } from '../lib/calls.server';

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
  return json({ sessions });
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
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (order && order.shopId === shop.id) {
      await placeConfirmationCall({ orderId, language });
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

export default function CallsRoute() {
  const { sessions } = useLoaderData<typeof loader>();

  const rows = sessions.map((s) => [
    new Date(s.createdAt).toLocaleString(),
    s.order.customerName ?? '—',
    s.order.phone ?? '—',
    <Badge key={s.id} tone={tone(s.status)}>{s.status}</Badge>,
    s.language,
    s.dispositionCapture ?? '—',
    s.durationSec != null ? `${s.durationSec}s` : '—',
  ]);

  return (
    <Page
      title="AI voice calls"
      subtitle="Automated confirmation calls placed to order-givers. Uses Twilio programmable voice."
    >
      <Layout>
        <Layout.Section>
          <Card>
            <BlockStack gap="300">
              <Text as="h2" variant="headingMd">
                Quick manual call
              </Text>
              <Text as="p" tone="subdued">
                Paste an order ID from the Orders page and pick a language to place a confirmation call.
              </Text>
              <RemixForm method="post">
                <input type="hidden" name="intent" value="call" />
                <input
                  name="orderId"
                  placeholder="Order ID"
                  style={{
                    padding: '6px 10px',
                    border: '1px solid #dcdcdc',
                    borderRadius: 6,
                    marginRight: 8,
                    minWidth: 240,
                  }}
                />
                <select
                  name="language"
                  defaultValue="en"
                  style={{ padding: '6px 10px', border: '1px solid #dcdcdc', borderRadius: 6 }}
                >
                  <option value="en">English</option>
                  <option value="ur">Urdu</option>
                  <option value="ar">Arabic</option>
                </select>{' '}
                <Button submit variant="primary">
                  Call now
                </Button>
              </RemixForm>
            </BlockStack>
          </Card>
        </Layout.Section>
        <Layout.Section>
          <Card>
            {sessions.length === 0 ? (
              <EmptyState heading="No calls placed yet" image="">
                <p>When a submission comes in, our worker will place an AI confirmation call.</p>
              </EmptyState>
            ) : (
              <DataTable
                columnContentTypes={['text', 'text', 'text', 'text', 'text', 'text', 'text']}
                headings={[
                  'Placed at',
                  'Customer',
                  'Phone',
                  'Status',
                  'Language',
                  'Disposition digit',
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
