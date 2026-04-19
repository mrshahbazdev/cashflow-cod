import type { LoaderFunctionArgs, ActionFunctionArgs } from '@remix-run/node';
import { json, redirect } from '@remix-run/node';
import { Form as RemixForm, useLoaderData } from '@remix-run/react';
import { useState } from 'react';
import {
  BlockStack,
  Button,
  Card,
  DataTable,
  EmptyState,
  InlineStack,
  Layout,
  Page,
  Select,
  TextField,
} from '@shopify/polaris';
import type { BlocklistType } from '@prisma/client';
import { createHash } from 'crypto';
import { authenticate } from '../shopify.server';
import { getShopByDomain } from '../lib/install.server';
import prisma from '../db.server';

const TYPES: BlocklistType[] = ['PHONE', 'IP', 'EMAIL', 'POSTAL_CODE', 'DEVICE'];

function hashValue(t: BlocklistType, v: string) {
  const normalized =
    t === 'EMAIL' ? v.trim().toLowerCase() : t === 'PHONE' ? v.replace(/[^\d+]/g, '') : v.trim();
  return createHash('sha256').update(`${t}:${normalized}`).digest('hex');
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = await getShopByDomain(session.shop);
  if (!shop) throw new Response('Shop not found', { status: 404 });
  const entries = await prisma.blocklist.findMany({
    where: { shopId: shop.id },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });
  return json({ entries });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = await getShopByDomain(session.shop);
  if (!shop) throw new Response('Shop not found', { status: 404 });

  const body = await request.formData();
  const intent = body.get('intent');

  if (intent === 'add') {
    const type = String(body.get('type') ?? 'PHONE') as BlocklistType;
    const value = String(body.get('value') ?? '').trim();
    const reason = String(body.get('reason') ?? '').trim();
    if (!value) return json({ error: 'Value required' }, { status: 400 });
    const normalized =
      type === 'EMAIL'
        ? value.toLowerCase()
        : type === 'PHONE'
          ? value.replace(/[^\d+]/g, '')
          : value;
    await prisma.blocklist.upsert({
      where: {
        shopId_type_valueHash: { shopId: shop.id, type, valueHash: hashValue(type, value) },
      },
      create: {
        shopId: shop.id,
        type,
        value: normalized,
        valueHash: hashValue(type, value),
        reason: reason || null,
      },
      update: { reason: reason || null },
    });
  }
  if (intent === 'delete') {
    const id = String(body.get('id') ?? '');
    await prisma.blocklist.deleteMany({ where: { id, shopId: shop.id } });
  }
  return redirect('/app/blocklist');
};

export default function BlocklistRoute() {
  const { entries } = useLoaderData<typeof loader>();
  const [value, setValue] = useState('');
  const [type, setType] = useState<BlocklistType>('PHONE');
  const [reason, setReason] = useState('');

  return (
    <Page
      title="Blocklist"
      subtitle="Automatically block submissions matching these values. Applied in real time."
    >
      <Layout>
        <Layout.Section>
          <Card>
            <BlockStack gap="300">
              <RemixForm method="post">
                <input type="hidden" name="intent" value="add" />
                <InlineStack gap="300" align="start" blockAlign="end">
                  <Select
                    label="Type"
                    name="type"
                    options={TYPES.map((t) => ({ label: t, value: t }))}
                    value={type}
                    onChange={(v) => setType(v as BlocklistType)}
                  />
                  <div style={{ flex: 1, minWidth: 220 }}>
                    <TextField
                      label="Value"
                      name="value"
                      value={value}
                      onChange={setValue}
                      placeholder={
                        type === 'PHONE'
                          ? '+923001234567'
                          : type === 'EMAIL'
                            ? 'abuser@example.com'
                            : '10.0.0.1'
                      }
                      autoComplete="off"
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <TextField
                      label="Reason (optional)"
                      name="reason"
                      value={reason}
                      onChange={setReason}
                      autoComplete="off"
                    />
                  </div>
                  <Button submit variant="primary">
                    Add to blocklist
                  </Button>
                </InlineStack>
              </RemixForm>
            </BlockStack>
          </Card>
        </Layout.Section>
        <Layout.Section>
          <Card>
            {entries.length === 0 ? (
              <EmptyState
                heading="Blocklist is empty"
                image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
              >
                <p>Add phones, emails, IPs, postal codes, or devices you want to block.</p>
              </EmptyState>
            ) : (
              <DataTable
                columnContentTypes={['text', 'text', 'text', 'text', 'text']}
                headings={['Type', 'Value', 'Reason', 'Added', '']}
                rows={entries.map((e) => [
                  e.type,
                  e.value,
                  e.reason ?? '—',
                  new Date(e.createdAt).toLocaleString(),
                  <RemixForm method="post" key={e.id}>
                    <input type="hidden" name="intent" value="delete" />
                    <input type="hidden" name="id" value={e.id} />
                    <Button size="slim" tone="critical" variant="tertiary" submit>
                      Remove
                    </Button>
                  </RemixForm>,
                ])}
              />
            )}
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
