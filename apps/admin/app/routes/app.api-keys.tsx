import type { LoaderFunctionArgs, ActionFunctionArgs } from '@remix-run/node';
import { json, redirect } from '@remix-run/node';
import { Form as RemixForm, useActionData, useLoaderData } from '@remix-run/react';
import { useState } from 'react';
import {
  Badge,
  Banner,
  BlockStack,
  Button,
  Card,
  Checkbox,
  DataTable,
  InlineStack,
  Layout,
  Page,
  Text,
  TextField,
} from '@shopify/polaris';
import { authenticate } from '../shopify.server';
import { getShopByDomain } from '../lib/install.server';
import { ALL_SCOPES, type ApiScope } from '../lib/api-scopes';
import { createApiKey, deleteApiKey, listApiKeys, revokeApiKey } from '../lib/api-keys.server';

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = await getShopByDomain(session.shop);
  if (!shop) throw new Response('Shop not found', { status: 404 });
  const keys = await listApiKeys(shop.id);
  return json({
    keys: keys.map((k) => ({
      id: k.id,
      label: k.label,
      prefix: k.prefix,
      scopes: Array.isArray(k.scopes) ? (k.scopes as string[]) : [],
      isActive: k.isActive,
      lastUsedAt: k.lastUsedAt?.toISOString() ?? null,
      createdAt: k.createdAt.toISOString(),
    })),
  });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = await getShopByDomain(session.shop);
  if (!shop) throw new Response('Shop not found', { status: 404 });
  const body = await request.formData();
  const intent = String(body.get('intent') ?? '');
  if (intent === 'create') {
    const label = String(body.get('label') ?? '').trim() || 'API key';
    const scopes = ALL_SCOPES.filter((s) => body.get(`scope_${s}`) === 'on');
    const { secret } = await createApiKey({ shopId: shop.id, label, scopes });
    return json({ secret });
  }
  if (intent === 'revoke') {
    await revokeApiKey(shop.id, String(body.get('id') ?? ''));
  } else if (intent === 'delete') {
    await deleteApiKey(shop.id, String(body.get('id') ?? ''));
  }
  return redirect('/app/api-keys');
};

export default function ApiKeysRoute() {
  const { keys } = useLoaderData<typeof loader>();
  const data = useActionData<typeof action>();
  const [label, setLabel] = useState('');
  const [scopes, setScopes] = useState<Record<ApiScope, boolean>>({
    'orders:read': true,
    'orders:write': false,
    'submissions:read': true,
    'submissions:write': false,
    'returns:read': true,
    'returns:write': false,
    'broadcasts:write': false,
    'analytics:read': true,
  });

  const rows = keys.map((k) => [
    k.label,
    k.prefix,
    k.scopes.join(', '),
    <Badge key={`a-${k.id}`} tone={k.isActive ? 'success' : 'critical'}>
      {k.isActive ? 'Active' : 'Revoked'}
    </Badge>,
    k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleString() : 'never',
    <div key={`act-${k.id}`} style={{ display: 'flex', gap: 6 }}>
      {k.isActive ? (
        <RemixForm method="post">
          <input type="hidden" name="intent" value="revoke" />
          <input type="hidden" name="id" value={k.id} />
          <Button submit size="slim" tone="critical" variant="plain">
            Revoke
          </Button>
        </RemixForm>
      ) : null}
      <RemixForm method="post">
        <input type="hidden" name="intent" value="delete" />
        <input type="hidden" name="id" value={k.id} />
        <Button submit size="slim" tone="critical" variant="plain">
          Delete
        </Button>
      </RemixForm>
    </div>,
  ]);

  return (
    <Page
      title="API keys"
      subtitle="Issue Bearer tokens for the public REST API at /api/v1/*. Keep secrets safe — they are shown once."
    >
      <Layout>
        {data && 'secret' in data ? (
          <Layout.Section>
            <Banner tone="warning" title="Save this secret now">
              <p>
                Copy this token immediately — it will not be shown again. Use it as
                <code> Authorization: Bearer &lt;token&gt;</code>.
              </p>
              <pre style={{ background: '#0f172a', color: '#fff', padding: 12, borderRadius: 6 }}>{data.secret}</pre>
            </Banner>
          </Layout.Section>
        ) : null}

        <Layout.Section>
          <Card>
            <BlockStack gap="300">
              <Text as="h2" variant="headingMd">
                Create API key
              </Text>
              <RemixForm method="post">
                <input type="hidden" name="intent" value="create" />
                <BlockStack gap="200">
                  <TextField label="Label" name="label" value={label} onChange={setLabel} autoComplete="off" />
                  <Text as="p" variant="bodySm">
                    Scopes
                  </Text>
                  <InlineStack gap="200" wrap>
                    {ALL_SCOPES.map((s) => (
                      <Checkbox
                        key={s}
                        label={s}
                        name={`scope_${s}`}
                        checked={scopes[s]}
                        onChange={(v) => setScopes((prev) => ({ ...prev, [s]: v }))}
                      />
                    ))}
                  </InlineStack>
                  <div>
                    <Button submit variant="primary">
                      Generate
                    </Button>
                  </div>
                </BlockStack>
              </RemixForm>
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section>
          <Card>
            {keys.length === 0 ? (
              <div style={{ padding: 24 }}>
                <Text as="p" tone="subdued">
                  No API keys yet. Issue one above.
                </Text>
              </div>
            ) : (
              <DataTable
                columnContentTypes={['text', 'text', 'text', 'text', 'text', 'text']}
                headings={['Label', 'Prefix', 'Scopes', 'State', 'Last used', '']}
                rows={rows}
              />
            )}
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
