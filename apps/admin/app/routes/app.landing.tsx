import type { LoaderFunctionArgs, ActionFunctionArgs } from '@remix-run/node';
import { json, redirect } from '@remix-run/node';
import { Form as RemixForm, useLoaderData } from '@remix-run/react';
import { useCallback, useState } from 'react';
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
  Thumbnail,
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

interface SelectedProduct {
  id: string;
  title: string;
  image?: string;
  variantId?: string;
  variantTitle?: string;
  price?: string;
}

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
    const productJson = String(body.get('product') ?? '');
    let product: SelectedProduct | null = null;
    try {
      if (productJson) product = JSON.parse(productJson);
    } catch {
      /* ignore invalid json */
    }
    if (!formId || !slug) {
      return json({ error: 'Form and slug required' }, { status: 400 });
    }
    const theme: Record<string, unknown> = {};
    if (product) {
      theme.productId = product.id;
      theme.productTitle = product.title;
      theme.productImage = product.image;
      theme.productVariantId = product.variantId;
      theme.productVariantTitle = product.variantTitle;
      theme.productPrice = product.price;
    }
    await createLandingPage({
      shopId: shop.id,
      formId,
      slug,
      title,
      headline: headline || undefined,
      isPublished: true,
      theme: Object.keys(theme).length > 0 ? theme : undefined,
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
  const [product, setProduct] = useState<SelectedProduct | null>(null);

  const openProductPicker = useCallback(async () => {
    try {
      const selected = await (window as any).shopify.resourcePicker({
        type: 'product',
        multiple: false,
        action: 'select',
        filter: { variants: true },
      });
      if (selected && selected.length > 0) {
        const p = selected[0];
        const variant = p.variants?.[0];
        setProduct({
          id: String(p.id),
          title: p.title,
          image: p.images?.[0]?.originalSrc ?? p.images?.[0]?.src ?? undefined,
          variantId: variant ? String(variant.id) : undefined,
          variantTitle: variant?.title !== 'Default Title' ? variant?.title : undefined,
          price: variant?.price ?? undefined,
        });
      }
    } catch {
      /* user cancelled picker */
    }
  }, []);

  const clearProduct = useCallback(() => {
    setProduct(null);
  }, []);

  const productTheme = (p: any): SelectedProduct | null => {
    const t = (p.theme ?? {}) as Record<string, any>;
    if (!t.productId) return null;
    return {
      id: t.productId,
      title: t.productTitle ?? '',
      image: t.productImage,
      variantId: t.productVariantId,
      variantTitle: t.productVariantTitle,
      price: t.productPrice,
    };
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows = pages.map((p: any) => {
    const rate = p.views === 0 ? 0 : p.conversions / p.views;
    const prod = productTheme(p);
    return [
      <a key={p.id} href={`/f/${p.slug}`} target="_blank" rel="noreferrer">
        {p.slug}
      </a>,
      p.title,
      p.form?.name ?? '—',
      prod ? prod.title : '—',
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
                <input type="hidden" name="product" value={product ? JSON.stringify(product) : ''} />
                <BlockStack gap="300">
                  <InlineStack gap="300" align="start" blockAlign="end">
                    <Select
                      label="Form"
                      name="formId"
                      options={forms.map((f: any) => ({ label: f.name, value: f.id }))}
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
                  <BlockStack gap="200">
                    <Text as="span" variant="bodyMd" fontWeight="semibold">
                      Product
                    </Text>
                    {product ? (
                      <InlineStack gap="300" blockAlign="center">
                        {product.image ? (
                          <Thumbnail source={product.image} alt={product.title} size="small" />
                        ) : null}
                        <BlockStack gap="100">
                          <Text as="span" variant="bodyMd" fontWeight="semibold">
                            {product.title}
                          </Text>
                          {product.variantTitle ? (
                            <Text as="span" variant="bodySm" tone="subdued">
                              {product.variantTitle}
                            </Text>
                          ) : null}
                          {product.price ? (
                            <Text as="span" variant="bodySm" tone="subdued">
                              {product.price}
                            </Text>
                          ) : null}
                        </BlockStack>
                        <Button onClick={clearProduct} variant="plain" tone="critical">
                          Remove
                        </Button>
                      </InlineStack>
                    ) : (
                      <Button onClick={openProductPicker} variant="secondary">
                        Select product
                      </Button>
                    )}
                  </BlockStack>
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
                  'Product',
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
