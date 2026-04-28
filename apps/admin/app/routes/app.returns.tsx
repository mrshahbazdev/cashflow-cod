import type { LoaderFunctionArgs, ActionFunctionArgs } from '@remix-run/node';
import { json, redirect } from '@remix-run/node';
import { Form as RemixForm, useLoaderData } from '@remix-run/react';
import {
  Badge,
  Button,
  Card,
  DataTable,
  Layout,
  Page,
  Text,
} from '@shopify/polaris';
import type { ReturnStatus } from '@prisma/client';
import { authenticate } from '../shopify.server';
import { getShopByDomain } from '../lib/install.server';
import { deleteReturn, listReturns, updateReturnStatus } from '../lib/returns.server';

const STATUS_FLOW: ReturnStatus[] = ['PENDING', 'APPROVED', 'PICKED_UP', 'RECEIVED', 'RESOLVED'];

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = await getShopByDomain(session.shop);
  if (!shop) throw new Response('Shop not found', { status: 404 });
  const rows = await listReturns(shop.id);
  return json({
    returns: rows.map((r) => ({
      id: r.id,
      trackingCode: r.trackingCode,
      reason: r.reason,
      resolution: r.resolution,
      status: r.status,
      createdAt: r.createdAt.toISOString(),
      orderId: r.orderId,
      customerName: r.order?.customerName ?? null,
      phone: r.order?.phone ?? null,
      total: r.order?.total ? Number(r.order.total) : 0,
    })),
  });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = await getShopByDomain(session.shop);
  if (!shop) throw new Response('Shop not found', { status: 404 });
  const body = await request.formData();
  const intent = String(body.get('intent') ?? '');
  if (intent === 'status') {
    await updateReturnStatus(shop.id, String(body.get('id') ?? ''), String(body.get('status') ?? '') as ReturnStatus);
  } else if (intent === 'reject') {
    await updateReturnStatus(shop.id, String(body.get('id') ?? ''), 'REJECTED');
  } else if (intent === 'delete') {
    await deleteReturn(shop.id, String(body.get('id') ?? ''));
  }
  return redirect('/app/returns');
};

export default function ReturnsRoute() {
  const { returns } = useLoaderData<typeof loader>();
  const rows = returns.map((r) => [
    r.trackingCode,
    r.customerName ?? '—',
    r.phone ?? '—',
    r.reason,
    <Badge key={`b-${r.id}`}>{r.resolution}</Badge>,
    <Badge key={`s-${r.id}`} tone={r.status === 'RESOLVED' ? 'success' : r.status === 'REJECTED' ? 'critical' : undefined}>
      {r.status}
    </Badge>,
    new Date(r.createdAt).toLocaleString(),
    <div key={`a-${r.id}`} style={{ display: 'flex', gap: 6 }}>
      {(() => {
        const next = nextStatus(r.status);
        if (!next) return null;
        return (
          <RemixForm method="post">
            <input type="hidden" name="intent" value="status" />
            <input type="hidden" name="id" value={r.id} />
            <input type="hidden" name="status" value={next} />
            <Button submit size="slim">
              → {next}
            </Button>
          </RemixForm>
        );
      })()}
      {r.status !== 'REJECTED' && r.status !== 'RESOLVED' ? (
        <RemixForm method="post">
          <input type="hidden" name="intent" value="reject" />
          <input type="hidden" name="id" value={r.id} />
          <Button submit size="slim" tone="critical" variant="plain">
            Reject
          </Button>
        </RemixForm>
      ) : null}
      <RemixForm method="post">
        <input type="hidden" name="intent" value="delete" />
        <input type="hidden" name="id" value={r.id} />
        <Button submit size="slim" tone="critical" variant="plain">
          Delete
        </Button>
      </RemixForm>
    </div>,
  ]);

  return (
    <Page title="Returns / RMA" subtitle="Customer-initiated returns and refund/replace workflow.">
      <Layout>
        <Layout.Section>
          <Card>
            {returns.length === 0 ? (
              <div style={{ padding: 24 }}>
                <Text as="p" tone="subdued">
                  No return requests yet. Customers open them from <code>/returns</code> with their order tracking code.
                </Text>
              </div>
            ) : (
              <DataTable
                columnContentTypes={['text', 'text', 'text', 'text', 'text', 'text', 'text', 'text']}
                headings={['Code', 'Customer', 'Phone', 'Reason', 'Resolution', 'Status', 'Created', '']}
                rows={rows}
              />
            )}
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}

function nextStatus(s: ReturnStatus): ReturnStatus | null {
  if (s === 'REJECTED' || s === 'RESOLVED') return null;
  const idx = STATUS_FLOW.indexOf(s);
  if (idx === -1) return null;
  return STATUS_FLOW[idx + 1] ?? null;
}
