import type { LoaderFunctionArgs, ActionFunctionArgs } from '@remix-run/node';
import { json, redirect } from '@remix-run/node';
import { Form as RemixForm, Link, useLoaderData } from '@remix-run/react';
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
  Text,
  TextField,
} from '@shopify/polaris';
import type { UpsellOffer, UpsellTrigger } from '@prisma/client';
import { authenticate } from '../shopify.server';
import { getShopByDomain } from '../lib/install.server';
import prisma from '../db.server';
import { deleteUpsell, listUpsells, upsertUpsell } from '../lib/upsells.server';

const TRIGGERS: UpsellTrigger[] = ['PRE_PURCHASE', 'POST_PURCHASE', 'ONE_TICK'];
const OFFERS: UpsellOffer[] = ['DISCOUNT_PERCENT', 'DISCOUNT_FLAT', 'FREE_GIFT', 'BUNDLE'];

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = await getShopByDomain(session.shop);
  if (!shop) throw new Response('Shop not found', { status: 404 });
  const form = await prisma.form.findFirst({
    where: { id: params.id!, shopId: shop.id },
    select: { id: true, name: true },
  });
  if (!form) throw new Response('Form not found', { status: 404 });
  const upsells = await listUpsells(form.id);
  return json({ form, upsells });
};

export const action = async ({ request, params }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = await getShopByDomain(session.shop);
  if (!shop) throw new Response('Shop not found', { status: 404 });
  const form = await prisma.form.findFirst({
    where: { id: params.id!, shopId: shop.id },
    select: { id: true },
  });
  if (!form) throw new Response('Form not found', { status: 404 });

  const body = await request.formData();
  const intent = body.get('intent');

  if (intent === 'save') {
    const id = body.get('id') ? String(body.get('id')) : undefined;
    const name = String(body.get('name') ?? '').trim();
    const title = String(body.get('title') ?? '').trim();
    if (!name || !title) return json({ error: 'Name and title required' }, { status: 400 });
    await upsertUpsell({
      id,
      formId: form.id,
      name,
      title,
      description: (body.get('description') as string) || null,
      productId: (body.get('productId') as string) || null,
      variantId: (body.get('variantId') as string) || null,
      triggerType: (String(body.get('triggerType') ?? 'PRE_PURCHASE') as UpsellTrigger),
      offerType: (String(body.get('offerType') ?? 'DISCOUNT_PERCENT') as UpsellOffer),
      discountType:
        (String(body.get('discountType') ?? '') as 'percent' | 'flat' | '') || null,
      discountValue: body.get('discountValue')
        ? Number(body.get('discountValue'))
        : null,
      position: body.get('position') ? Number(body.get('position')) : 0,
      isActive: body.get('isActive') === 'on',
    });
  }
  if (intent === 'delete') {
    const id = String(body.get('id') ?? '');
    await deleteUpsell(id);
  }
  return redirect(`/app/forms/${form.id}/upsells`);
};

export default function UpsellsRoute() {
  const { form, upsells } = useLoaderData<typeof loader>();
  const [name, setName] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [productId, setProductId] = useState('');
  const [variantId, setVariantId] = useState('');
  const [triggerType, setTriggerType] = useState<UpsellTrigger>('PRE_PURCHASE');
  const [offerType, setOfferType] = useState<UpsellOffer>('DISCOUNT_PERCENT');
  const [discountValue, setDiscountValue] = useState('');

  const rows = upsells.map((u) => [
    u.name,
    u.title,
    u.triggerType,
    u.offerType,
    u.discountValue != null ? `${u.discountValue} ${u.discountType ?? ''}` : '—',
    u.isActive ? 'Active' : 'Inactive',
    <RemixForm key={u.id} method="post">
      <input type="hidden" name="intent" value="delete" />
      <input type="hidden" name="id" value={u.id} />
      <Button submit tone="critical" variant="plain">
        Delete
      </Button>
    </RemixForm>,
  ]);

  return (
    <Page
      title={`Upsells — ${form.name}`}
      backAction={{ content: 'Form', url: `/app/forms/${form.id}` }}
    >
      <Layout>
        <Layout.Section>
          <Card>
            <BlockStack gap="300">
              <Text as="h2" variant="headingMd">
                Add upsell
              </Text>
              <RemixForm method="post">
                <input type="hidden" name="intent" value="save" />
                <BlockStack gap="300">
                  <InlineStack gap="300">
                    <div style={{ flex: 1 }}>
                      <TextField
                        label="Internal name"
                        name="name"
                        value={name}
                        onChange={setName}
                        autoComplete="off"
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <TextField
                        label="Offer title (shown to customer)"
                        name="title"
                        value={title}
                        onChange={setTitle}
                        autoComplete="off"
                      />
                    </div>
                  </InlineStack>
                  <TextField
                    label="Description"
                    name="description"
                    value={description}
                    onChange={setDescription}
                    multiline={2}
                    autoComplete="off"
                  />
                  <InlineStack gap="300">
                    <Select
                      label="Trigger"
                      name="triggerType"
                      options={TRIGGERS.map((t) => ({ label: t, value: t }))}
                      value={triggerType}
                      onChange={(v) => setTriggerType(v as UpsellTrigger)}
                    />
                    <Select
                      label="Offer"
                      name="offerType"
                      options={OFFERS.map((o) => ({ label: o, value: o }))}
                      value={offerType}
                      onChange={(v) => setOfferType(v as UpsellOffer)}
                    />
                    <Select
                      label="Discount type"
                      name="discountType"
                      options={[
                        { label: 'None', value: '' },
                        { label: 'Percent', value: 'percent' },
                        { label: 'Flat', value: 'flat' },
                      ]}
                      value=""
                      onChange={() => {}}
                    />
                    <div style={{ width: 120 }}>
                      <TextField
                        label="Discount value"
                        name="discountValue"
                        value={discountValue}
                        onChange={setDiscountValue}
                        type="number"
                        autoComplete="off"
                      />
                    </div>
                  </InlineStack>
                  <InlineStack gap="300">
                    <div style={{ flex: 1 }}>
                      <TextField
                        label="Shopify product ID"
                        name="productId"
                        value={productId}
                        onChange={setProductId}
                        autoComplete="off"
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <TextField
                        label="Variant ID"
                        name="variantId"
                        value={variantId}
                        onChange={setVariantId}
                        autoComplete="off"
                      />
                    </div>
                  </InlineStack>
                  <InlineStack align="end">
                    <Button submit variant="primary">
                      Save upsell
                    </Button>
                  </InlineStack>
                </BlockStack>
              </RemixForm>
            </BlockStack>
          </Card>
        </Layout.Section>
        <Layout.Section>
          <Card>
            {upsells.length === 0 ? (
              <EmptyState heading="No upsells yet" image="">
                <Text as="p" tone="subdued">
                  Add your first upsell to boost AOV. Pre-purchase upsells appear inside the form;
                  post-purchase appear after submission.
                </Text>
              </EmptyState>
            ) : (
              <DataTable
                columnContentTypes={['text', 'text', 'text', 'text', 'text', 'text', 'text']}
                headings={['Name', 'Title', 'Trigger', 'Offer', 'Discount', 'Status', '']}
                rows={rows}
              />
            )}
          </Card>
        </Layout.Section>
        <Layout.Section>
          <Card>
            <Text as="p" tone="subdued">
              <Link to={`/app/forms/${form.id}`}>Back to form builder</Link>
            </Text>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
