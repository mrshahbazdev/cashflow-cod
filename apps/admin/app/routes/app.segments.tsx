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
  Text,
  TextField,
} from '@shopify/polaris';
import { authenticate } from '../shopify.server';
import { getShopByDomain } from '../lib/install.server';
import {
  buildSegment,
  deleteSegment,
  listSegments,
  upsertSegment,
} from '../lib/crm.server';

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = await getShopByDomain(session.shop);
  if (!shop) throw new Response('Shop not found', { status: 404 });
  const segments = await listSegments(shop.id);
  return json({ segments });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = await getShopByDomain(session.shop);
  if (!shop) throw new Response('Shop not found', { status: 404 });
  const body = await request.formData();
  const intent = String(body.get('intent') ?? '');

  if (intent === 'save') {
    const name = String(body.get('name') ?? '').trim();
    if (!name) return json({ error: 'Name required' }, { status: 400 });
    const description = String(body.get('description') ?? '') || null;
    const disposition = String(body.get('disposition') ?? '').trim();
    const minRisk = body.get('minRisk') ? Number(body.get('minRisk')) : undefined;
    const maxRisk = body.get('maxRisk') ? Number(body.get('maxRisk')) : undefined;
    const city = String(body.get('city') ?? '').trim() || undefined;
    const country = String(body.get('country') ?? '').trim() || undefined;
    await upsertSegment({
      shopId: shop.id,
      name,
      description,
      filter: {
        disposition: disposition ? disposition.split(',').map((s) => s.trim()) : undefined,
        minRisk,
        maxRisk,
        city,
        country,
      },
    });
  } else if (intent === 'build') {
    await buildSegment(String(body.get('id') ?? ''));
  } else if (intent === 'delete') {
    await deleteSegment(shop.id, String(body.get('id') ?? ''));
  }
  return redirect('/app/segments');
};

export default function SegmentsRoute() {
  const { segments } = useLoaderData<typeof loader>();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [disposition, setDisposition] = useState('');
  const [minRisk, setMinRisk] = useState('');
  const [maxRisk, setMaxRisk] = useState('');
  const [city, setCity] = useState('');
  const [country, setCountry] = useState('');

  const rows = segments.map((s) => [
    s.name,
    s.description ?? '—',
    String(s.memberCount),
    s.lastBuiltAt ? new Date(s.lastBuiltAt).toLocaleString() : 'never',
    <InlineStack key={`act-${s.id}`} gap="200">
      <RemixForm method="post">
        <input type="hidden" name="intent" value="build" />
        <input type="hidden" name="id" value={s.id} />
        <Button submit variant="plain">
          Rebuild
        </Button>
      </RemixForm>
      <RemixForm method="post">
        <input type="hidden" name="intent" value="delete" />
        <input type="hidden" name="id" value={s.id} />
        <Button submit tone="critical" variant="plain">
          Delete
        </Button>
      </RemixForm>
    </InlineStack>,
  ]);

  return (
    <Page
      title="Customer segments"
      subtitle="Saved filters over your orders — use them to target broadcasts or trigger automations."
    >
      <Layout>
        <Layout.Section>
          <Card>
            <BlockStack gap="300">
              <Text as="h2" variant="headingMd">
                Create segment
              </Text>
              <RemixForm method="post">
                <input type="hidden" name="intent" value="save" />
                <BlockStack gap="300">
                  <InlineStack gap="300">
                    <div style={{ flex: 1 }}>
                      <TextField
                        label="Name"
                        name="name"
                        value={name}
                        onChange={setName}
                        autoComplete="off"
                        placeholder="High-risk Karachi"
                      />
                    </div>
                    <div style={{ flex: 2 }}>
                      <TextField
                        label="Description"
                        name="description"
                        value={description}
                        onChange={setDescription}
                        autoComplete="off"
                      />
                    </div>
                  </InlineStack>
                  <InlineStack gap="300">
                    <div style={{ flex: 1 }}>
                      <TextField
                        label="Dispositions (comma-separated)"
                        name="disposition"
                        value={disposition}
                        onChange={setDisposition}
                        autoComplete="off"
                        placeholder="NEW,CONFIRMED"
                        helpText="Leave empty to match all dispositions"
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <TextField
                        label="Min risk (0-100)"
                        name="minRisk"
                        type="number"
                        value={minRisk}
                        onChange={setMinRisk}
                        autoComplete="off"
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <TextField
                        label="Max risk (0-100)"
                        name="maxRisk"
                        type="number"
                        value={maxRisk}
                        onChange={setMaxRisk}
                        autoComplete="off"
                      />
                    </div>
                  </InlineStack>
                  <InlineStack gap="300">
                    <div style={{ flex: 1 }}>
                      <TextField
                        label="City contains"
                        name="city"
                        value={city}
                        onChange={setCity}
                        autoComplete="off"
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <TextField
                        label="Country code"
                        name="country"
                        value={country}
                        onChange={setCountry}
                        autoComplete="off"
                        placeholder="PK, IN, AE"
                      />
                    </div>
                  </InlineStack>
                  <InlineStack align="end">
                    <Button submit variant="primary">
                      Save segment
                    </Button>
                  </InlineStack>
                </BlockStack>
              </RemixForm>
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section>
          <Card>
            {segments.length === 0 ? (
              <EmptyState
                heading="No segments yet"
                image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
              >
                <p>Create a segment above to target broadcasts and automations.</p>
              </EmptyState>
            ) : (
              <DataTable
                columnContentTypes={['text', 'text', 'numeric', 'text', 'text']}
                headings={['Name', 'Description', 'Members', 'Last built', 'Actions']}
                rows={rows}
              />
            )}
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
