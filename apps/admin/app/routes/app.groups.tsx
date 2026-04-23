import type { LoaderFunctionArgs, ActionFunctionArgs } from '@remix-run/node';
import { json, redirect } from '@remix-run/node';
import { Form as RemixForm, useLoaderData } from '@remix-run/react';
import { useState } from 'react';
import {
  BlockStack,
  Button,
  Card,
  DataTable,
  InlineStack,
  Layout,
  Page,
  Select,
  Text,
  TextField,
} from '@shopify/polaris';
import { authenticate } from '../shopify.server';
import { getShopByDomain } from '../lib/install.server';
import prisma from '../db.server';
import {
  attachShopToGroup,
  createMerchantGroup,
  detachShopFromGroup,
  listGroups,
} from '../lib/merchant-group.server';

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const currentShop = await getShopByDomain(session.shop);
  if (!currentShop) throw new Response('Shop not found', { status: 404 });
  const groups = await listGroups();
  const allShops = await prisma.shop.findMany({
    orderBy: { domain: 'asc' },
    select: { id: true, domain: true, merchantGroupId: true },
  });
  return json({
    currentShopId: currentShop.id,
    currentGroupId: currentShop.merchantGroupId,
    groups,
    allShops,
  });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = await getShopByDomain(session.shop);
  if (!shop) throw new Response('Shop not found', { status: 404 });
  const body = await request.formData();
  const intent = String(body.get('intent') ?? '');

  if (intent === 'create') {
    const name = String(body.get('name') ?? '').trim();
    const ownerEmail = String(body.get('ownerEmail') ?? '').trim() || undefined;
    if (!name) return json({ error: 'Name required' }, { status: 400 });
    await createMerchantGroup({ name, ownerEmail });
  } else if (intent === 'attach') {
    const groupId = String(body.get('groupId') ?? '');
    const shopId = String(body.get('shopId') ?? shop.id);
    if (groupId) await attachShopToGroup(shopId, groupId);
  } else if (intent === 'detach') {
    const shopId = String(body.get('shopId') ?? shop.id);
    await detachShopFromGroup(shopId);
  }
  return redirect('/app/groups');
};

export default function GroupsRoute() {
  const { groups, allShops, currentShopId, currentGroupId } = useLoaderData<typeof loader>();
  const [name, setName] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [selectedGroup, setSelectedGroup] = useState(groups[0]?.id ?? '');

  return (
    <Page
      title="Merchant groups"
      subtitle="Manage multiple stores from one dashboard. Useful for agencies and multi-brand owners."
    >
      <Layout>
        <Layout.Section>
          <Card>
            <BlockStack gap="300">
              <Text as="h2" variant="headingMd">
                Create a group
              </Text>
              <RemixForm method="post">
                <input type="hidden" name="intent" value="create" />
                <BlockStack gap="300">
                  <TextField
                    label="Group name"
                    name="name"
                    value={name}
                    onChange={setName}
                    autoComplete="off"
                    placeholder="Acme Group"
                  />
                  <TextField
                    label="Owner email (optional)"
                    name="ownerEmail"
                    value={ownerEmail}
                    onChange={setOwnerEmail}
                    autoComplete="email"
                    placeholder="owner@acme.com"
                  />
                  <InlineStack>
                    <Button submit variant="primary">
                      Create group
                    </Button>
                  </InlineStack>
                </BlockStack>
              </RemixForm>
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section>
          <Card>
            <BlockStack gap="300">
              <Text as="h2" variant="headingMd">
                Current store membership
              </Text>
              <Text as="p" tone="subdued">
                {currentGroupId
                  ? `This shop is in: ${groups.find((g) => g.id === currentGroupId)?.name ?? 'Unknown'}`
                  : 'This shop is not in a group yet.'}
              </Text>
              <InlineStack gap="300" blockAlign="end">
                <Select
                  label="Group"
                  options={groups.map((g) => ({ label: g.name, value: g.id }))}
                  value={selectedGroup}
                  onChange={setSelectedGroup}
                  disabled={groups.length === 0}
                />
                <RemixForm method="post">
                  <input type="hidden" name="intent" value="attach" />
                  <input type="hidden" name="shopId" value={currentShopId} />
                  <input type="hidden" name="groupId" value={selectedGroup} />
                  <Button submit disabled={!selectedGroup}>
                    Attach this shop
                  </Button>
                </RemixForm>
                {currentGroupId ? (
                  <RemixForm method="post">
                    <input type="hidden" name="intent" value="detach" />
                    <input type="hidden" name="shopId" value={currentShopId} />
                    <Button submit tone="critical">
                      Detach
                    </Button>
                  </RemixForm>
                ) : null}
              </InlineStack>
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section>
          <Card>
            <BlockStack gap="300">
              <Text as="h2" variant="headingMd">
                All groups ({groups.length})
              </Text>
              {groups.length === 0 ? (
                <Text as="p" tone="subdued">
                  No groups yet. Create one above.
                </Text>
              ) : (
                <DataTable
                  columnContentTypes={['text', 'text', 'numeric', 'text']}
                  headings={['Name', 'Owner', 'Shops', 'Created']}
                  rows={groups.map((g) => [
                    g.name,
                    g.ownerEmail ?? '—',
                    String(g.shops.length),
                    new Date(g.createdAt).toLocaleDateString(),
                  ])}
                />
              )}
              <Text as="p" tone="subdued">
                Shops on platform: {allShops.length}
              </Text>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
