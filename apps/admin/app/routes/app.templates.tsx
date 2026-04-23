import type { LoaderFunctionArgs, ActionFunctionArgs } from '@remix-run/node';
import { json, redirect } from '@remix-run/node';
import { Form as RemixForm, useLoaderData } from '@remix-run/react';
import {
  Badge,
  BlockStack,
  Button,
  Card,
  InlineGrid,
  InlineStack,
  Layout,
  Page,
  Text,
} from '@shopify/polaris';
import { authenticate } from '../shopify.server';
import { getShopByDomain } from '../lib/install.server';
import { installTemplate, listTemplates } from '../lib/form-templates.server';

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  const templates = await listTemplates();
  return json({ templates });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = await getShopByDomain(session.shop);
  if (!shop) throw new Response('Shop not found', { status: 404 });
  const body = await request.formData();
  if (String(body.get('intent')) === 'install') {
    const slug = String(body.get('slug') ?? '');
    if (!slug) return json({ error: 'slug required' }, { status: 400 });
    const res = await installTemplate({ shopId: shop.id, templateSlug: slug });
    return redirect(`/app/forms/${res.formId}`);
  }
  return redirect('/app/templates');
};

export default function TemplatesRoute() {
  const { templates } = useLoaderData<typeof loader>();

  return (
    <Page
      title="Template marketplace"
      subtitle="Industry- and region-specific COD form templates. One click clones into your store."
    >
      <Layout>
        <Layout.Section>
          {templates.length === 0 ? (
            <Card>
              <Text as="p" tone="subdued">
                No templates seeded yet.
              </Text>
            </Card>
          ) : (
            <InlineGrid columns={{ xs: 1, sm: 2, md: 3 }} gap="400">
              {templates.map((t) => (
                <Card key={t.id}>
                  <BlockStack gap="300">
                    <InlineStack align="space-between" blockAlign="start">
                      <Text as="h3" variant="headingMd">
                        {t.name}
                      </Text>
                      {t.isFeatured ? <Badge tone="success">Featured</Badge> : null}
                    </InlineStack>
                    <InlineStack gap="200">
                      <Badge>{t.category}</Badge>
                      {t.region ? <Badge tone="info">{t.region}</Badge> : null}
                      <Badge>{t.language.toUpperCase()}</Badge>
                    </InlineStack>
                    <Text as="p" tone="subdued">
                      {t.description ?? ''}
                    </Text>
                    <Text as="p" tone="subdued" variant="bodySm">
                      {t.installCount} installs
                    </Text>
                    <RemixForm method="post">
                      <input type="hidden" name="intent" value="install" />
                      <input type="hidden" name="slug" value={t.slug} />
                      <Button submit variant="primary">
                        Install template
                      </Button>
                    </RemixForm>
                  </BlockStack>
                </Card>
              ))}
            </InlineGrid>
          )}
        </Layout.Section>
      </Layout>
    </Page>
  );
}
