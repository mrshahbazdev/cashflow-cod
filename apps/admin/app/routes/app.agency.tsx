import type { LoaderFunctionArgs, ActionFunctionArgs } from '@remix-run/node';
import { json, redirect } from '@remix-run/node';
import { Form as RemixForm, useLoaderData } from '@remix-run/react';
import { useState } from 'react';
import {
  Badge,
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
import {
  attachGroupToTenant,
  createTenant,
  deleteTenant,
  listTenants,
  updateTenant,
} from '../lib/agency.server';
import prisma from '../db.server';

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  const tenants = await listTenants();
  const groups = await prisma.merchantGroup.findMany({
    select: { id: true, name: true, agencyTenantId: true },
    orderBy: { name: 'asc' },
  });
  return json({
    tenants: tenants.map((t) => ({
      id: t.id,
      slug: t.slug,
      name: t.name,
      contactEmail: t.contactEmail,
      customDomain: t.customDomain,
      logoUrl: t.logoUrl,
      primaryColor: t.primaryColor,
      accentColor: t.accentColor,
      supportUrl: t.supportUrl,
      hidePoweredBy: t.hidePoweredBy,
      isActive: t.isActive,
      groupCount: t.groups.length,
      shopCount: t.groups.reduce((sum, g) => sum + g.shops.length, 0),
    })),
    groups,
  });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  await authenticate.admin(request);
  const body = await request.formData();
  const intent = String(body.get('intent') ?? '');
  if (intent === 'create') {
    await createTenant({
      slug: String(body.get('slug') ?? '').trim(),
      name: String(body.get('name') ?? '').trim(),
      contactEmail: String(body.get('contactEmail') ?? '').trim() || undefined,
      customDomain: String(body.get('customDomain') ?? '').trim() || undefined,
      logoUrl: String(body.get('logoUrl') ?? '').trim() || undefined,
      primaryColor: String(body.get('primaryColor') ?? '').trim() || undefined,
      accentColor: String(body.get('accentColor') ?? '').trim() || undefined,
      supportUrl: String(body.get('supportUrl') ?? '').trim() || undefined,
      hidePoweredBy: body.get('hidePoweredBy') === 'on',
    });
  } else if (intent === 'attach') {
    const groupId = String(body.get('groupId') ?? '');
    const tenantId = String(body.get('tenantId') ?? '') || null;
    await attachGroupToTenant(groupId, tenantId);
  } else if (intent === 'toggle') {
    await updateTenant(String(body.get('id') ?? ''), {});
  } else if (intent === 'delete') {
    await deleteTenant(String(body.get('id') ?? ''));
  }
  return redirect('/app/agency');
};

export default function AgencyRoute() {
  const { tenants, groups } = useLoaderData<typeof loader>();
  const [slug, setSlug] = useState('');
  const [name, setName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [customDomain, setCustomDomain] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [primaryColor, setPrimaryColor] = useState('#10b981');
  const [accentColor, setAccentColor] = useState('#0f172a');
  const [supportUrl, setSupportUrl] = useState('');
  const [hidePoweredBy, setHidePoweredBy] = useState(false);

  const rows = tenants.map((t) => [
    t.slug,
    t.name,
    t.customDomain ?? '—',
    String(t.groupCount),
    String(t.shopCount),
    <Badge key={`b-${t.id}`} tone={t.isActive ? 'success' : undefined}>
      {t.isActive ? 'Active' : 'Inactive'}
    </Badge>,
    <RemixForm key={`d-${t.id}`} method="post">
      <input type="hidden" name="intent" value="delete" />
      <input type="hidden" name="id" value={t.id} />
      <Button submit tone="critical" variant="plain" size="slim">
        Delete
      </Button>
    </RemixForm>,
  ]);

  return (
    <Page title="Agency / white-label" subtitle="Manage agency tenants, branding overrides, and merchant assignment.">
      <Layout>
        <Layout.Section>
          <Card>
            <BlockStack gap="300">
              <Text as="h2" variant="headingMd">
                Create tenant
              </Text>
              <RemixForm method="post">
                <input type="hidden" name="intent" value="create" />
                <BlockStack gap="200">
                  <InlineStack gap="200">
                    <TextField label="Slug" name="slug" value={slug} onChange={setSlug} autoComplete="off" />
                    <div style={{ flex: 1 }}>
                      <TextField label="Name" name="name" value={name} onChange={setName} autoComplete="off" />
                    </div>
                  </InlineStack>
                  <InlineStack gap="200">
                    <div style={{ flex: 1 }}>
                      <TextField
                        label="Contact email"
                        name="contactEmail"
                        value={contactEmail}
                        onChange={setContactEmail}
                        autoComplete="off"
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <TextField
                        label="Custom domain"
                        name="customDomain"
                        value={customDomain}
                        onChange={setCustomDomain}
                        autoComplete="off"
                        placeholder="track.acme.com"
                      />
                    </div>
                  </InlineStack>
                  <InlineStack gap="200">
                    <div style={{ flex: 1 }}>
                      <TextField
                        label="Logo URL"
                        name="logoUrl"
                        value={logoUrl}
                        onChange={setLogoUrl}
                        autoComplete="off"
                      />
                    </div>
                    <TextField
                      label="Primary color"
                      name="primaryColor"
                      value={primaryColor}
                      onChange={setPrimaryColor}
                      autoComplete="off"
                    />
                    <TextField
                      label="Accent color"
                      name="accentColor"
                      value={accentColor}
                      onChange={setAccentColor}
                      autoComplete="off"
                    />
                  </InlineStack>
                  <TextField
                    label="Support URL"
                    name="supportUrl"
                    value={supportUrl}
                    onChange={setSupportUrl}
                    autoComplete="off"
                  />
                  <Checkbox
                    label="Hide ‘Powered by Cashflow COD’"
                    name="hidePoweredBy"
                    checked={hidePoweredBy}
                    onChange={setHidePoweredBy}
                  />
                  <div>
                    <Button submit variant="primary">
                      Create tenant
                    </Button>
                  </div>
                </BlockStack>
              </RemixForm>
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section>
          <Card>
            <DataTable
              columnContentTypes={['text', 'text', 'text', 'numeric', 'numeric', 'text', 'text']}
              headings={['Slug', 'Name', 'Custom domain', 'Groups', 'Shops', 'State', '']}
              rows={rows}
            />
          </Card>
        </Layout.Section>

        <Layout.Section>
          <Card>
            <BlockStack gap="300">
              <Text as="h2" variant="headingMd">
                Assign merchant group to tenant
              </Text>
              <RemixForm method="post">
                <input type="hidden" name="intent" value="attach" />
                <InlineStack gap="200">
                  <select name="groupId" style={selectStyle}>
                    {groups.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name} {g.agencyTenantId ? '(currently linked)' : ''}
                      </option>
                    ))}
                  </select>
                  <select name="tenantId" style={selectStyle}>
                    <option value="">— detach —</option>
                    {tenants.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({t.slug})
                      </option>
                    ))}
                  </select>
                  <Button submit>Save</Button>
                </InlineStack>
              </RemixForm>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}

const selectStyle: React.CSSProperties = { padding: 8, borderRadius: 6, border: '1px solid #c4cdd5' };
