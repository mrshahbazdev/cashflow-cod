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
  createLandingPage,
  deleteLandingPage,
  listLandingPages,
  updateLandingPage,
} from '../lib/landing-pages.server';
import prisma from '../db.server';

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = await getShopByDomain(session.shop);
  if (!shop) throw new Response('Shop not found', { status: 404 });
  const pages = await listLandingPages(shop.id);
  const forms = await prisma.form.findMany({
    where: { shopId: shop.id },
    select: { id: true, name: true, slug: true },
    orderBy: { createdAt: 'desc' },
  });
  return json({ pages, forms });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = await getShopByDomain(session.shop);
  if (!shop) throw new Response('Shop not found', { status: 404 });
  const body = await request.formData();
  const intent = String(body.get('intent') ?? '');

  if (intent === 'create') {
    const formId = String(body.get('formId') ?? '');
    const slug = String(body.get('slug') ?? '').trim();
    const title = String(body.get('title') ?? 'Untitled page');
    const headline = String(body.get('headline') ?? '');
    if (!formId || !slug) {
      return json({ error: 'Form and slug required' }, { status: 400 });
    }
    await createLandingPage({
      shopId: shop.id,
      formId,
      slug,
      title,
      headline: headline || undefined,
      isPublished: true,
    });
  } else if (intent === 'publish') {
    const id = String(body.get('id') ?? '');
    await updateLandingPage({ id, shopId: shop.id, isPublished: true });
  } else if (intent === 'unpublish') {
    const id = String(body.get('id') ?? '');
    await updateLandingPage({ id, shopId: shop.id, isPublished: false });
  } else if (intent === 'delete') {
    const id = String(body.get('id') ?? '');
    await deleteLandingPage(shop.id, id);
  }
  return redirect('/app/landing');
};

export default function LandingRoute() {
  const { pages, forms } = useLoaderData<typeof loader>();
  const [formId, setFormId] = useState(forms[0]?.id ?? '');
  const [slug, setSlug] = useState('');
  const [title, setTitle] = useState('');
  const [headline, setHeadline] = useState('');

  const rows = pages.map((p) => {
    const rate = p.views === 0 ? 0 : p.conversions / p.views;
    return [
      <a key={p.id} href={`/f/${p.slug}`} target="_blank" rel="noreferrer">
        {p.slug}
      </a>,
      p.title,
      p.form?.name ?? '—',
      <Badge key={`s-${p.id}`} tone={p.isPublished ? 'success' : undefined}>
        {p.isPublished ? 'Published' : 'Draft'}
      </Badge>,
      String(p.views),
      String(p.conversions),
      `${(rate * 100).toFixed(1)}%`,
      <InlineStack key={`a-${p.id}`} gap="200">
        <RemixForm method="post">
          <input
            type="hidden"
            name="intent"
            value={p.isPublished ? 'unpublish' : 'publish'}
          />
          <input type="hidden" name="id" value={p.id} />
          <Button submit variant="plain">
            {p.isPublished ? 'Unpublish' : 'Publish'}
          </Button>
        </RemixForm>
        <RemixForm method="post">
          <input type="hidden" name="intent" value="delete" />
          <input type="hidden" name="id" value={p.id} />
          <Button submit tone="critical" variant="plain">
            Delete
          </Button>
        </RemixForm>
      </InlineStack>,
    ];
  });

  return (
    <Page
      title="Landing pages"
      subtitle="Custom hero pages for paid-ad campaigns that bypass the Shopify storefront entirely."
    >
      <Layout>
        <Layout.Section>
          <Card>
            <BlockStack gap="300">
              <Text as="h2" variant="headingMd">
                Create a landing page
              </Text>
              <RemixForm method="post">
                <input type="hidden" name="intent" value="create" />
                <BlockStack gap="300">
                  <InlineStack gap="300" align="start" blockAlign="end">
                    <Select
                      label="Form"
                      name="formId"
                      options={forms.map((f) => ({ label: f.name, value: f.id }))}
                      value={formId}
                      onChange={setFormId}
                    />
                    <div style={{ flex: 1 }}>
                      <TextField
                        label="Slug"
                        name="slug"
                        value={slug}
                        onChange={setSlug}
                        autoComplete="off"
                        placeholder="summer-sale-2026"
                      />
                    </div>
                  </InlineStack>
                  <TextField
                    label="Title"
                    name="title"
                    value={title}
                    onChange={setTitle}
                    autoComplete="off"
                  />
                  <TextField
                    label="Headline"
                    name="headline"
                    value={headline}
                    onChange={setHeadline}
                    autoComplete="off"
                    placeholder="50% off — today only"
                  />
                  <InlineStack align="end">
                    <Button submit variant="primary" disabled={!formId || !slug}>
                      Create page
                    </Button>
                  </InlineStack>
                </BlockStack>
              </RemixForm>
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section>
          <Card>
            {pages.length === 0 ? (
              <EmptyState
                heading="No landing pages yet"
                image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
              >
                <p>Create a landing page and point your Facebook/TikTok ads at /f/:slug.</p>
              </EmptyState>
            ) : (
              <DataTable
                columnContentTypes={[
                  'text',
                  'text',
                  'text',
                  'text',
                  'numeric',
                  'numeric',
                  'numeric',
                  'text',
                ]}
                headings={[
                  'Slug',
                  'Title',
                  'Form',
                  'Status',
                  'Views',
                  'Conversions',
                  'Rate',
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
