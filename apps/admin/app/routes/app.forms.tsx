import type { ActionFunctionArgs, LoaderFunctionArgs } from '@remix-run/node';
import { json, redirect } from '@remix-run/node';
import { Form as RemixForm, Link, useLoaderData, useNavigation } from '@remix-run/react';
import {
  Badge,
  BlockStack,
  Button,
  ButtonGroup,
  Card,
  EmptyState,
  InlineStack,
  Layout,
  Page,
  ResourceItem,
  ResourceList,
  Text,
  TextField,
} from '@shopify/polaris';
import { useState } from 'react';
import { authenticate } from '../shopify.server';
import { getShopByDomain } from '../lib/install.server';
import { createForm, deleteForm, duplicateForm, listForms, updateForm } from '../lib/forms.server';

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = await getShopByDomain(session.shop);
  if (!shop) throw new Response('Shop not found', { status: 404 });

  const forms = await listForms(shop.id);
  return json({ shopDomain: shop.domain, forms });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = await getShopByDomain(session.shop);
  if (!shop) throw new Response('Shop not found', { status: 404 });

  const form = await request.formData();
  const intent = form.get('intent');

  if (intent === 'create') {
    const name = String(form.get('name') ?? '').trim() || 'Untitled form';
    const created = await createForm(shop.domain, shop.id, name);
    return redirect(`/app/forms/${created.id}`);
  }

  if (intent === 'delete') {
    const id = String(form.get('id') ?? '');
    if (id) await deleteForm(shop.id, id);
    return json({ ok: true });
  }

  if (intent === 'duplicate') {
    const id = String(form.get('id') ?? '');
    const dup = await duplicateForm(shop.id, id);
    return redirect(`/app/forms/${dup.id}`);
  }

  if (intent === 'toggle-active') {
    const id = String(form.get('id') ?? '');
    const nextActive = form.get('active') === '1';
    await updateForm(shop.id, id, { isActive: nextActive });
    return json({ ok: true });
  }

  return json({ ok: false, error: 'Unknown intent' }, { status: 400 });
};

export default function FormsRoute() {
  const { forms } = useLoaderData<typeof loader>();
  const nav = useNavigation();
  const [name, setName] = useState('');
  const creating = nav.state !== 'idle' && nav.formData?.get('intent') === 'create';

  return (
    <Page
      title="Forms"
      subtitle="Build COD order forms and publish them to your storefront."
      primaryAction={{
        content: 'Browse templates',
        url: '/app/templates',
      }}
    >
      <Layout>
        <Layout.Section>
          <Card>
            <BlockStack gap="300">
              <Text as="h2" variant="headingMd">
                Create a new form
              </Text>
              <RemixForm method="post">
                <input type="hidden" name="intent" value="create" />
                <InlineStack gap="300" align="start" blockAlign="end">
                  <div style={{ flex: 1, minWidth: 260 }}>
                    <TextField
                      label="Form name"
                      name="name"
                      value={name}
                      onChange={setName}
                      autoComplete="off"
                      placeholder="e.g. Product page COD"
                    />
                  </div>
                  <Button submit variant="primary" loading={creating}>
                    Create blank form
                  </Button>
                  <Button url="/app/templates">Start from template</Button>
                </InlineStack>
              </RemixForm>
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section>
          <Card padding="0">
            {forms.length === 0 ? (
              <div style={{ padding: 24 }}>
                <EmptyState
                  heading="No forms yet"
                  image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                  action={{ content: 'Browse templates', url: '/app/templates' }}
                  secondaryAction={{ content: 'Build from scratch', url: '/app/forms' }}
                >
                  <p>
                    Pick a ready-made template to launch in 30 seconds, or build from scratch above.
                  </p>
                </EmptyState>
              </div>
            ) : (
              <ResourceList
                resourceName={{ singular: 'form', plural: 'forms' }}
                items={forms}
                renderItem={(f) => {
                  const shortcutActions = [{ content: 'Edit', url: `/app/forms/${f.id}` }];
                  return (
                    <ResourceItem
                      id={f.id}
                      url={`/app/forms/${f.id}`}
                      accessibilityLabel={`Edit form ${f.name}`}
                      shortcutActions={shortcutActions}
                      persistActions
                    >
                      <InlineStack gap="400" align="space-between" blockAlign="center">
                        <BlockStack gap="100">
                          <InlineStack gap="200" blockAlign="center">
                            <Text as="h3" variant="headingSm" fontWeight="semibold">
                              {f.name}
                            </Text>
                            {f.isActive ? (
                              <Badge tone="success">Active</Badge>
                            ) : (
                              <Badge tone="attention">Draft</Badge>
                            )}
                            <Badge>{f.layout}</Badge>
                          </InlineStack>
                          <Text as="p" tone="subdued" variant="bodySm">
                            /{f.slug} · {f._count.submissions} submissions · {f._count.views} views
                          </Text>
                        </BlockStack>

                        <InlineStack gap="200" blockAlign="center">
                          <ButtonGroup>
                            <RemixForm method="post">
                              <input type="hidden" name="intent" value="toggle-active" />
                              <input type="hidden" name="id" value={f.id} />
                              <input type="hidden" name="active" value={f.isActive ? '0' : '1'} />
                              <Button submit size="slim">
                                {f.isActive ? 'Deactivate' : 'Activate'}
                              </Button>
                            </RemixForm>
                            <RemixForm method="post">
                              <input type="hidden" name="intent" value="duplicate" />
                              <input type="hidden" name="id" value={f.id} />
                              <Button submit size="slim">
                                Duplicate
                              </Button>
                            </RemixForm>
                            <RemixForm
                              method="post"
                              onSubmit={(e) => {
                                if (!window.confirm(`Delete "${f.name}"?`)) e.preventDefault();
                              }}
                            >
                              <input type="hidden" name="intent" value="delete" />
                              <input type="hidden" name="id" value={f.id} />
                              <Button submit size="slim" tone="critical">
                                Delete
                              </Button>
                            </RemixForm>
                          </ButtonGroup>
                          <Link to={`/app/forms/${f.id}`}>Edit</Link>
                        </InlineStack>
                      </InlineStack>
                    </ResourceItem>
                  );
                }}
              />
            )}
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
