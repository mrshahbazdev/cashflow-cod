import type { LoaderFunctionArgs, ActionFunctionArgs } from '@remix-run/node';
import { json, redirect } from '@remix-run/node';
import { Form as RemixForm, useLoaderData } from '@remix-run/react';
import {
  BlockStack,
  Button,
  Card,
  DataTable,
  EmptyState,
  Layout,
  Page,
  Text,
} from '@shopify/polaris';
import { authenticate } from '../shopify.server';
import { getShopByDomain } from '../lib/install.server';
import prisma from '../db.server';
import { markRecoveryNotified } from '../lib/abandoned.server';

function buildRecoveryUrl(appUrl: string, formSlug: string, token: string): string {
  const clean = appUrl.replace(/\/$/, '');
  return `${clean}/r/${formSlug}?t=${encodeURIComponent(token)}`;
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = await getShopByDomain(session.shop);
  if (!shop) throw new Response('Shop not found', { status: 404 });
  const rows = await prisma.abandonedForm.findMany({
    where: { form: { shopId: shop.id }, convertedAt: null },
    orderBy: { createdAt: 'desc' },
    take: 100,
    include: { form: { select: { slug: true, name: true } } },
  });
  const appUrl = process.env.SHOPIFY_APP_URL ?? process.env.APP_URL ?? '';
  return json({ rows, appUrl });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const body = await request.formData();
  const intent = body.get('intent');
  if (intent === 'mark-notified') {
    const id = String(body.get('id') ?? '');
    await markRecoveryNotified(id);
  }
  return redirect('/app/abandoned');
};

function waLink(phone: string, url: string, name: string) {
  const text = encodeURIComponent(
    `Hi ${name || 'there'}! You left items in your cart — finish your COD order here: ${url}`,
  );
  const clean = phone.replace(/\D/g, '');
  return `https://wa.me/${clean}?text=${text}`;
}

export default function AbandonedRoute() {
  const { rows, appUrl } = useLoaderData<typeof loader>();

  const dataRows = rows.map((r) => {
    const recoveryUrl = appUrl
      ? buildRecoveryUrl(appUrl, r.form.slug, r.recoveryToken)
      : `/r/${r.form.slug}?t=${r.recoveryToken}`;
    const partial = (r.partialData as Record<string, string>) ?? {};
    const name =
      partial.full_name || partial.name || partial.first_name || (r.email ?? '').split('@')[0] || '';
    return [
      new Date(r.createdAt).toLocaleString(),
      r.form.name ?? r.form.slug,
      r.phone ?? '—',
      r.email ?? '—',
      r.notifiedAt ? new Date(r.notifiedAt).toLocaleString() : 'Not notified',
      r.phone ? (
        <a key={`wa-${r.id}`} href={waLink(r.phone, recoveryUrl, name)} target="_blank" rel="noreferrer">
          WhatsApp link
        </a>
      ) : (
        '—'
      ),
      <RemixForm key={`mark-${r.id}`} method="post">
        <input type="hidden" name="intent" value="mark-notified" />
        <input type="hidden" name="id" value={r.id} />
        <Button submit variant="plain">
          Mark notified
        </Button>
      </RemixForm>,
    ];
  });

  return (
    <Page
      title="Abandoned forms"
      subtitle="Visitors who entered contact info but didn't submit. Use the WhatsApp deep-link to recover them."
    >
      <Layout>
        <Layout.Section>
          <Card>
            {rows.length === 0 ? (
              <EmptyState heading="No abandoned submissions yet" image="">
                <Text as="p" tone="subdued">
                  We'll populate this list as visitors start partial-filling your form.
                </Text>
              </EmptyState>
            ) : (
              <BlockStack gap="300">
                <DataTable
                  columnContentTypes={['text', 'text', 'text', 'text', 'text', 'text', 'text']}
                  headings={['When', 'Form', 'Phone', 'Email', 'Last notified', 'Recover', '']}
                  rows={dataRows}
                />
              </BlockStack>
            )}
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
