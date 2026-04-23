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
  createTest,
  listTests,
  stopTest,
  summarizeTest,
} from '../lib/ab-testing.server';
import prisma from '../db.server';

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = await getShopByDomain(session.shop);
  if (!shop) throw new Response('Shop not found', { status: 404 });
  const tests = await listTests(shop.id);
  const summaries = await Promise.all(
    tests.map(async (t) => ({ id: t.id, stats: await summarizeTest(t.id) })),
  );
  const forms = await prisma.form.findMany({
    where: { shopId: shop.id },
    select: { id: true, name: true, slug: true },
    orderBy: { createdAt: 'desc' },
  });
  return json({ tests, summaries, forms });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = await getShopByDomain(session.shop);
  if (!shop) throw new Response('Shop not found', { status: 404 });
  const body = await request.formData();
  const intent = String(body.get('intent') ?? '');

  if (intent === 'create') {
    const name = String(body.get('name') ?? 'Untitled test');
    const formId = String(body.get('formId') ?? '');
    if (!formId) return json({ error: 'Form required' }, { status: 400 });
    await createTest({
      shopId: shop.id,
      name,
      entityType: 'form',
      entityId: formId,
      variants: [
        { key: 'a', label: 'Control', weight: 50 },
        { key: 'b', label: 'Variant B', weight: 50 },
      ],
    });
  } else if (intent === 'stop') {
    const id = String(body.get('id') ?? '');
    const winner = String(body.get('winner') ?? '');
    await stopTest(id, winner || undefined);
  }
  return redirect('/app/ab-tests');
};

export default function ABTestsRoute() {
  const { tests, summaries, forms } = useLoaderData<typeof loader>();
  const [name, setName] = useState('');
  const [formId, setFormId] = useState(forms[0]?.id ?? '');

  const statsById = new Map(summaries.map((s) => [s.id, s.stats]));

  const rows = tests.map((t) => {
    const stats = statsById.get(t.id) ?? [];
    const summary = stats
      .map((v) => `${v.key}: ${(v.rate * 100).toFixed(1)}% (${v.conversions}/${v.views})`)
      .join(' • ');
    return [
      t.name || '(unnamed)',
      t.entityType,
      <Badge
        key={`s-${t.id}`}
        tone={t.status === 'running' ? 'info' : 'success'}
      >
        {t.status}
      </Badge>,
      summary || '—',
      t.winner ?? '—',
      new Date(t.startedAt).toLocaleDateString(),
      t.status === 'running' ? (
        <RemixForm key={t.id} method="post">
          <input type="hidden" name="intent" value="stop" />
          <input type="hidden" name="id" value={t.id} />
          <Button submit variant="plain" tone="critical">
            Stop
          </Button>
        </RemixForm>
      ) : (
        '—'
      ),
    ];
  });

  return (
    <Page
      title="A/B tests"
      subtitle="Run experiments on your COD forms. Variants are split deterministically per visitor."
    >
      <Layout>
        <Layout.Section>
          <Card>
            <BlockStack gap="300">
              <Text as="h2" variant="headingMd">
                Create a new test
              </Text>
              <RemixForm method="post">
                <input type="hidden" name="intent" value="create" />
                <BlockStack gap="300">
                  <InlineStack gap="300" align="start" blockAlign="end">
                    <div style={{ flex: 1 }}>
                      <TextField
                        label="Name"
                        name="name"
                        value={name}
                        onChange={setName}
                        autoComplete="off"
                        placeholder="Headline copy test"
                      />
                    </div>
                    <Select
                      label="Form"
                      name="formId"
                      options={forms.map((f) => ({ label: f.name, value: f.id }))}
                      value={formId}
                      onChange={setFormId}
                    />
                  </InlineStack>
                  <InlineStack align="end">
                    <Button submit variant="primary" disabled={!formId}>
                      Create test
                    </Button>
                  </InlineStack>
                </BlockStack>
              </RemixForm>
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section>
          <Card>
            {tests.length === 0 ? (
              <EmptyState
                heading="No experiments yet"
                image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
              >
                <p>Create an A/B test above to start experimenting with form variants.</p>
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
                ]}
                headings={[
                  'Name',
                  'Entity',
                  'Status',
                  'Stats',
                  'Winner',
                  'Started',
                  'Actions',
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
