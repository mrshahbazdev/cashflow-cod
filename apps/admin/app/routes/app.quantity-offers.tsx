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
  Text,
  TextField,
} from '@shopify/polaris';
import { authenticate } from '../shopify.server';
import { getShopByDomain } from '../lib/install.server';
import prisma from '../db.server';

interface LadderRung {
  minQuantity: number;
  discountType: 'percent' | 'flat';
  discountValue: number;
}

const DEFAULT_LADDER = JSON.stringify(
  [
    { minQuantity: 2, discountType: 'percent', discountValue: 5 },
    { minQuantity: 3, discountType: 'percent', discountValue: 10 },
    { minQuantity: 5, discountType: 'percent', discountValue: 15 },
  ],
  null,
  2,
);

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = await getShopByDomain(session.shop);
  if (!shop) throw new Response('Shop not found', { status: 404 });
  const offers = await prisma.quantityOffer.findMany({
    where: { shopId: shop.id },
    orderBy: [{ isActive: 'desc' }, { createdAt: 'desc' }],
  });
  return json({ offers });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = await getShopByDomain(session.shop);
  if (!shop) throw new Response('Shop not found', { status: 404 });
  const body = await request.formData();
  const intent = String(body.get('intent') ?? '');

  if (intent === 'save') {
    const id = String(body.get('id') ?? '').trim();
    const name = String(body.get('name') ?? '').trim();
    const productId = String(body.get('productId') ?? '').trim() || null;
    const variantId = String(body.get('variantId') ?? '').trim() || null;
    const ladderRaw = String(body.get('ladder') ?? '[]');
    let ladder: LadderRung[];
    try {
      const parsed = JSON.parse(ladderRaw);
      if (!Array.isArray(parsed)) throw new Error('ladder must be array');
      ladder = parsed.map((r) => ({
        minQuantity: Number(r.minQuantity),
        discountType: r.discountType === 'flat' ? 'flat' : 'percent',
        discountValue: Number(r.discountValue),
      }));
    } catch (err) {
      return json(
        { error: `Invalid ladder JSON: ${err instanceof Error ? err.message : String(err)}` },
        { status: 400 },
      );
    }
    const ladderJson = ladder as unknown as object;
    if (id) {
      await prisma.quantityOffer.updateMany({
        where: { id, shopId: shop.id },
        data: { name, productId, variantId, ladder: ladderJson },
      });
    } else {
      await prisma.quantityOffer.create({
        data: { shopId: shop.id, name, productId, variantId, ladder: ladderJson },
      });
    }
  } else if (intent === 'delete') {
    const id = String(body.get('id') ?? '');
    await prisma.quantityOffer.deleteMany({ where: { id, shopId: shop.id } });
  } else if (intent === 'toggle') {
    const id = String(body.get('id') ?? '');
    const target = await prisma.quantityOffer.findFirst({ where: { id, shopId: shop.id } });
    if (target) {
      await prisma.quantityOffer.update({ where: { id }, data: { isActive: !target.isActive } });
    }
  }
  return redirect('/app/quantity-offers');
};

export default function QuantityOffersRoute() {
  const { offers } = useLoaderData<typeof loader>();
  const [name, setName] = useState('Buy more, save more');
  const [productId, setProductId] = useState('');
  const [variantId, setVariantId] = useState('');
  const [ladder, setLadder] = useState(DEFAULT_LADDER);

  const rows = offers.map((o) => {
    const rungs = (o.ladder as unknown as LadderRung[]) ?? [];
    const summary = rungs
      .map(
        (r) => `${r.minQuantity}+ → ${r.discountValue}${r.discountType === 'percent' ? '%' : ''}`,
      )
      .join(', ');
    return [
      o.name,
      o.productId || o.variantId || 'shop-wide',
      summary || '—',
      o.isActive ? (
        <Badge key={`a-${o.id}`} tone="success">
          Active
        </Badge>
      ) : (
        <Badge key={`a-${o.id}`}>Paused</Badge>
      ),
      <InlineStack key={`act-${o.id}`} gap="200">
        <RemixForm method="post">
          <input type="hidden" name="intent" value="toggle" />
          <input type="hidden" name="id" value={o.id} />
          <Button submit variant="plain">
            {o.isActive ? 'Pause' : 'Activate'}
          </Button>
        </RemixForm>
        <RemixForm method="post">
          <input type="hidden" name="intent" value="delete" />
          <input type="hidden" name="id" value={o.id} />
          <Button submit tone="critical" variant="plain">
            Delete
          </Button>
        </RemixForm>
      </InlineStack>,
    ];
  });

  return (
    <Page
      title="Quantity offers"
      subtitle="Volume / tiered discount ladders that auto-apply at the COD form."
      backAction={{ content: 'Discounts', url: '/app/discounts' }}
    >
      <Layout>
        <Layout.Section>
          <Card>
            <BlockStack gap="300">
              <Text as="h2" variant="headingMd">
                Add ladder
              </Text>
              <RemixForm method="post">
                <input type="hidden" name="intent" value="save" />
                <BlockStack gap="300">
                  <TextField
                    label="Name"
                    name="name"
                    value={name}
                    onChange={setName}
                    autoComplete="off"
                  />
                  <InlineStack gap="300" align="start" blockAlign="end">
                    <div style={{ flex: 1 }}>
                      <TextField
                        label="Product ID (optional)"
                        name="productId"
                        value={productId}
                        onChange={setProductId}
                        autoComplete="off"
                        placeholder="gid://shopify/Product/..."
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <TextField
                        label="Variant ID (optional)"
                        name="variantId"
                        value={variantId}
                        onChange={setVariantId}
                        autoComplete="off"
                        placeholder="gid://shopify/ProductVariant/..."
                      />
                    </div>
                  </InlineStack>
                  <TextField
                    label="Ladder (JSON)"
                    name="ladder"
                    value={ladder}
                    onChange={setLadder}
                    autoComplete="off"
                    multiline={8}
                    helpText='Array of {"minQuantity":N,"discountType":"percent|flat","discountValue":N}'
                  />
                  <InlineStack align="end">
                    <Button submit variant="primary">
                      Save offer
                    </Button>
                  </InlineStack>
                </BlockStack>
              </RemixForm>
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section>
          <Card>
            {offers.length === 0 ? (
              <EmptyState
                heading="No quantity offers yet"
                image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
              >
                <p>Add a ladder above to reward customers for buying more.</p>
              </EmptyState>
            ) : (
              <DataTable
                columnContentTypes={['text', 'text', 'text', 'text', 'text']}
                headings={['Name', 'Scope', 'Ladder', 'Status', 'Actions']}
                rows={rows}
              />
            )}
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
