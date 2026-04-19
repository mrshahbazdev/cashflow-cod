import type { LoaderFunctionArgs, ActionFunctionArgs } from '@remix-run/node';
import { json, redirect } from '@remix-run/node';
import { Form as RemixForm, useLoaderData } from '@remix-run/react';
import { useState } from 'react';
import {
  Button,
  Card,
  DataTable,
  EmptyState,
  InlineStack,
  Layout,
  Page,
  Select,
  TextField,
} from '@shopify/polaris';
import type { AgentRole } from '@prisma/client';
import { authenticate } from '../shopify.server';
import { getShopByDomain } from '../lib/install.server';
import prisma from '../db.server';

const ROLES: AgentRole[] = ['OWNER', 'MANAGER', 'AGENT', 'VIEWER'];

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = await getShopByDomain(session.shop);
  if (!shop) throw new Response('Shop not found', { status: 404 });
  const agents = await prisma.agent.findMany({
    where: { shopId: shop.id },
    orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
  });
  return json({ agents });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = await getShopByDomain(session.shop);
  if (!shop) throw new Response('Shop not found', { status: 404 });
  const body = await request.formData();
  const intent = body.get('intent');

  if (intent === 'invite') {
    const email = String(body.get('email') ?? '')
      .trim()
      .toLowerCase();
    const name = String(body.get('name') ?? '').trim();
    const role = String(body.get('role') ?? 'AGENT') as AgentRole;
    if (!email) return json({ error: 'Email required' }, { status: 400 });
    const existing = await prisma.agent.findFirst({
      where: { shopId: shop.id, email },
    });
    if (existing) {
      await prisma.agent.update({
        where: { id: existing.id },
        data: { name: name || email, role, isActive: true },
      });
    } else {
      await prisma.agent.create({
        data: {
          shopId: shop.id,
          userId: email,
          email,
          name: name || email,
          role,
          isActive: true,
        },
      });
    }
  }
  if (intent === 'remove') {
    const id = String(body.get('id') ?? '');
    await prisma.agent.updateMany({
      where: { id, shopId: shop.id, role: { not: 'OWNER' } },
      data: { isActive: false },
    });
  }
  return redirect('/app/agents');
};

export default function AgentsRoute() {
  const { agents } = useLoaderData<typeof loader>();
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<AgentRole>('AGENT');

  return (
    <Page title="Team" subtitle="Invite agents to confirm orders and manage RTOs.">
      <Layout>
        <Layout.Section>
          <Card>
            <RemixForm method="post">
              <input type="hidden" name="intent" value="invite" />
              <InlineStack gap="300" align="start" blockAlign="end">
                <div style={{ flex: 1, minWidth: 220 }}>
                  <TextField
                    label="Email"
                    name="email"
                    type="email"
                    value={email}
                    onChange={setEmail}
                    autoComplete="off"
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <TextField
                    label="Name (optional)"
                    name="name"
                    value={name}
                    onChange={setName}
                    autoComplete="off"
                  />
                </div>
                <Select
                  label="Role"
                  name="role"
                  options={ROLES.map((r) => ({ label: r, value: r }))}
                  value={role}
                  onChange={(v) => setRole(v as AgentRole)}
                />
                <Button submit variant="primary">
                  Invite
                </Button>
              </InlineStack>
            </RemixForm>
          </Card>
        </Layout.Section>
        <Layout.Section>
          <Card>
            {agents.length === 0 ? (
              <EmptyState
                heading="No team members"
                image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
              >
                <p>Invite your first agent to start confirming COD orders.</p>
              </EmptyState>
            ) : (
              <DataTable
                columnContentTypes={['text', 'text', 'text', 'text', 'text']}
                headings={['Name', 'Email', 'Role', 'Status', '']}
                rows={agents.map((a) => [
                  a.name ?? '—',
                  a.email,
                  a.role,
                  a.isActive ? 'Active' : 'Disabled',
                  a.role === 'OWNER' ? (
                    '—'
                  ) : (
                    <RemixForm method="post" key={a.id}>
                      <input type="hidden" name="intent" value="remove" />
                      <input type="hidden" name="id" value={a.id} />
                      <Button size="slim" tone="critical" variant="tertiary" submit>
                        Disable
                      </Button>
                    </RemixForm>
                  ),
                ])}
              />
            )}
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
