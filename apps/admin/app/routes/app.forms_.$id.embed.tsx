import type { LoaderFunctionArgs } from '@remix-run/node';
import { json } from '@remix-run/node';
import { useLoaderData } from '@remix-run/react';
import { BlockStack, Card, Layout, Page, Text } from '@shopify/polaris';
import { authenticate } from '../shopify.server';
import { getShopByDomain } from '../lib/install.server';
import { getForm } from '../lib/forms.server';

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = await getShopByDomain(session.shop);
  if (!shop) throw new Response('Shop not found', { status: 404 });
  const id = params.id;
  if (!id) throw new Response('Not found', { status: 404 });
  const form = await getForm(shop.id, id);
  if (!form) throw new Response('Form not found', { status: 404 });
  const apiOrigin = process.env.SHOPIFY_APP_URL ?? '';
  return json({ slug: form.slug, name: form.name, shop: shop.domain, apiOrigin });
};

function CodeBlock({ code }: { code: string }) {
  return (
    <pre
      style={{
        background: '#0b1021',
        color: '#e1e7ff',
        padding: 16,
        borderRadius: 8,
        overflow: 'auto',
        fontSize: 13,
        fontFamily:
          'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
        whiteSpace: 'pre',
      }}
    >
      {code}
    </pre>
  );
}

export default function FormEmbedRoute() {
  const data = useLoaderData<typeof loader>();
  const apiOrigin = data.apiOrigin || 'https://cashflow-cod-production-2aff.up.railway.app';

  const inlineSnippet = `<div
  class="cashflow-cod-root"
  data-cashflow-cod-root
  data-shop="${data.shop}"
  data-form-slug="${data.slug}"
  data-trigger="inline"
  data-api="${apiOrigin}"
  data-accent="#008060"
></div>
<link rel="stylesheet" href="${apiOrigin}/assets/cod-form.css" />
<script src="${apiOrigin}/assets/cod-form.js" defer></script>`;

  const buttonSnippet = `<button data-cashflow-cod-open="${data.slug}">Buy with Cash on Delivery</button>
<script src="${apiOrigin}/assets/cod-form.js" defer></script>`;

  const programmaticSnippet = `// Open the popup from any custom code:
window.cashflowCod.open('${data.slug}', {
  productId: '<product-id>',  // optional
  variantId: '<variant-id>',  // optional
  apiOrigin: '${apiOrigin}',
  shop: '${data.shop}',
});

// Or mount inline into a container you control:
window.cashflowCod.mountInline('${data.slug}', '#my-cod-form', {
  apiOrigin: '${apiOrigin}',
  shop: '${data.shop}',
});`;

  const themeBlocks = `1. Open Online Store → Themes → Customize.
2. In the App embeds panel, enable one of:
   • Cashflow COD Form        — body-level embed (popup / inline / floating).
   • Cashflow COD Floating    — sticky floating button on every page.
3. Or, add the "Cashflow COD Button" block inside any section (product page,
   custom landing, blog, FAQ, …) by clicking + Add block in the section
   you want and picking it from the Apps category.
4. Set Form slug to: ${data.slug}`;

  return (
    <Page
      title={`Embed “${data.name}”`}
      subtitle="Use this form anywhere in your storefront."
      backAction={{ content: 'Form', url: `/app/forms/${data.slug ? '' : ''}` }}
    >
      <Layout>
        <Layout.Section>
          <Card>
            <BlockStack gap="300">
              <Text as="h2" variant="headingMd">
                1. Theme app blocks (recommended)
              </Text>
              <Text as="p" tone="subdued">
                The fastest way — no code required. Theme editor will let you drag a button anywhere
                or enable a sticky floating CTA.
              </Text>
              <CodeBlock code={themeBlocks} />
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section>
          <Card>
            <BlockStack gap="300">
              <Text as="h2" variant="headingMd">
                2. CTA button — drop into any liquid template
              </Text>
              <Text as="p" tone="subdued">
                Any element with <code>data-cashflow-cod-open=&quot;{data.slug}&quot;</code> opens
                the popup on click. Useful for product pages, blog posts, custom sections.
              </Text>
              <CodeBlock code={buttonSnippet} />
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section>
          <Card>
            <BlockStack gap="300">
              <Text as="h2" variant="headingMd">
                3. Inline embed — render the full form in place
              </Text>
              <Text as="p" tone="subdued">
                Drop this anywhere you want the form rendered directly (no popup), e.g. a dedicated
                &quot;Order&quot; page.
              </Text>
              <CodeBlock code={inlineSnippet} />
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section>
          <Card>
            <BlockStack gap="300">
              <Text as="h2" variant="headingMd">
                4. Programmatic — open from JavaScript
              </Text>
              <Text as="p" tone="subdued">
                For custom integrations, your own React/Vue components, or post-purchase upsell
                triggers.
              </Text>
              <CodeBlock code={programmaticSnippet} />
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
