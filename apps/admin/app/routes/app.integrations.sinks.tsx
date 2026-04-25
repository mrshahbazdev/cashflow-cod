import type { LoaderFunctionArgs, ActionFunctionArgs } from '@remix-run/node';
import { json, redirect } from '@remix-run/node';
import { Form as RemixForm, useLoaderData } from '@remix-run/react';
import { useMemo, useState } from 'react';
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
import { listSinkAdapters, getSinkAdapter } from '../lib/sinks';
import prisma from '../db.server';

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = await getShopByDomain(session.shop);
  if (!shop) throw new Response('Shop not found', { status: 404 });
  const integrations = await prisma.integration.findMany({
    where: { shopId: shop.id },
    orderBy: [{ isActive: 'desc' }, { createdAt: 'desc' }],
  });
  return json({ integrations, adapters: listSinkAdapters() });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = await getShopByDomain(session.shop);
  if (!shop) throw new Response('Shop not found', { status: 404 });
  const body = await request.formData();
  const intent = String(body.get('intent') ?? '');

  if (intent === 'save') {
    const provider = String(body.get('provider') ?? '');
    const label = String(body.get('label') ?? '').trim() || provider;
    const adapter = getSinkAdapter(provider);
    if (!adapter) return json({ error: 'Unknown provider' }, { status: 400 });
    const credentials: Record<string, unknown> = {};
    for (const f of adapter.credentialFields) {
      const v = String(body.get(`cred_${f.key}`) ?? '').trim();
      if (v) credentials[f.key] = v;
    }
    await prisma.integration.upsert({
      where: { shopId_provider_label: { shopId: shop.id, provider, label } },
      create: {
        shopId: shop.id,
        provider,
        label,
        credentials: credentials as object,
        isActive: true,
      },
      update: { credentials: credentials as object, isActive: true, lastError: null },
    });
  } else if (intent === 'delete') {
    const id = String(body.get('id') ?? '');
    await prisma.integration.deleteMany({ where: { id, shopId: shop.id } });
  } else if (intent === 'toggle') {
    const id = String(body.get('id') ?? '');
    const isActive = body.get('isActive') === 'on';
    await prisma.integration.updateMany({
      where: { id, shopId: shop.id },
      data: { isActive },
    });
  }
  return redirect('/app/integrations/sinks');
};

export default function SinksRoute() {
  const { integrations, adapters } = useLoaderData<typeof loader>();
  const [provider, setProvider] = useState<string>(adapters[0]?.provider ?? '');
  const [label, setLabel] = useState('');
  const [creds, setCreds] = useState<Record<string, string>>({});
  const adapter = useMemo(
    () => adapters.find((a) => a.provider === provider),
    [adapters, provider],
  );

  const rows = integrations.map((i) => [
    i.label,
    i.provider,
    i.isActive ? (
      <Badge key={`s-${i.id}`} tone="success">
        Active
      </Badge>
    ) : (
      <Badge key={`s-${i.id}`}>Paused</Badge>
    ),
    i.lastFiredAt ? new Date(i.lastFiredAt).toLocaleString() : '—',
    i.lastError ? (
      <Badge key={`e-${i.id}`} tone="critical">
        {i.lastError.slice(0, 60)}
      </Badge>
    ) : (
      '—'
    ),
    <RemixForm key={`del-${i.id}`} method="post">
      <input type="hidden" name="intent" value="delete" />
      <input type="hidden" name="id" value={i.id} />
      <Button submit tone="critical" variant="plain">
        Delete
      </Button>
    </RemixForm>,
  ]);

  return (
    <Page
      title="Marketing & data sinks"
      subtitle="Forward COD orders to Klaviyo, Omnisend, or Google Sheets in real time."
      backAction={{ content: 'Integrations', url: '/app/integrations' }}
    >
      <Layout>
        <Layout.Section>
          <Card>
            <BlockStack gap="300">
              <Text as="h2" variant="headingMd">
                Add / update sink
              </Text>
              <RemixForm method="post">
                <input type="hidden" name="intent" value="save" />
                <BlockStack gap="300">
                  <InlineStack gap="300" align="start" blockAlign="end">
                    <Select
                      label="Provider"
                      name="provider"
                      options={adapters.map((a) => ({
                        label: a.displayName,
                        value: a.provider,
                      }))}
                      value={provider}
                      onChange={(v) => {
                        setProvider(v);
                        setCreds({});
                      }}
                    />
                    <div style={{ flex: 1 }}>
                      <TextField
                        label="Label"
                        name="label"
                        value={label}
                        onChange={setLabel}
                        autoComplete="off"
                        placeholder="Main account"
                      />
                    </div>
                  </InlineStack>
                  {adapter ? (
                    <Text as="p" tone="subdued">
                      {adapter.credentialsHelp}
                    </Text>
                  ) : null}
                  {(adapter?.credentialFields ?? []).map((f) => (
                    <TextField
                      key={f.key}
                      label={f.label}
                      name={`cred_${f.key}`}
                      value={creds[f.key] ?? ''}
                      onChange={(v) => setCreds({ ...creds, [f.key]: v })}
                      autoComplete="off"
                      type={f.type === 'password' ? 'password' : 'text'}
                      multiline={f.type === 'textarea' ? 6 : undefined}
                      placeholder={f.placeholder}
                    />
                  ))}
                  <InlineStack align="end">
                    <Button submit variant="primary">
                      Save sink
                    </Button>
                  </InlineStack>
                </BlockStack>
              </RemixForm>
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section>
          <Card>
            {integrations.length === 0 ? (
              <EmptyState
                heading="No sinks configured"
                image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
              >
                <p>
                  Connect Klaviyo, Omnisend, or Google Sheets above. Each placed COD order will fan
                  out in real time.
                </p>
              </EmptyState>
            ) : (
              <DataTable
                columnContentTypes={['text', 'text', 'text', 'text', 'text', 'text']}
                headings={['Label', 'Provider', 'Status', 'Last fired', 'Last error', 'Actions']}
                rows={rows}
              />
            )}
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
