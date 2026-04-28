import type { LoaderFunctionArgs, ActionFunctionArgs } from '@remix-run/node';
import { json, redirect } from '@remix-run/node';
import { Form as RemixForm, useLoaderData, useSearchParams } from '@remix-run/react';
import {
  Badge,
  BlockStack,
  Box,
  Button,
  Card,
  ChoiceList,
  EmptyState,
  InlineGrid,
  InlineStack,
  Layout,
  Page,
  Text,
} from '@shopify/polaris';
import { useMemo } from 'react';
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

const CATEGORY_ACCENT: Record<string, { bg: string; ink: string }> = {
  general: { bg: '#0ea5e9', ink: '#082f49' },
  apparel: { bg: '#ec4899', ink: '#831843' },
  electronics: { bg: '#8b5cf6', ink: '#3b0764' },
  food: { bg: '#f59e0b', ink: '#78350f' },
  services: { bg: '#10b981', ink: '#064e3b' },
  pharmacy: { bg: '#06b6d4', ink: '#164e63' },
  beauty: { bg: '#f43f5e', ink: '#881337' },
};

const FALLBACK_ACCENT = { bg: '#0ea5e9', ink: '#082f49' };
function getAccent(category: string) {
  return CATEGORY_ACCENT[category.toLowerCase()] ?? FALLBACK_ACCENT;
}

export default function TemplatesRoute() {
  const { templates } = useLoaderData<typeof loader>();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeCategory = searchParams.get('category') ?? 'all';
  const activeRegion = searchParams.get('region') ?? 'all';

  const categories = useMemo(() => {
    const set = new Set<string>();
    templates.forEach((t) => set.add(t.category));
    return Array.from(set).sort();
  }, [templates]);

  const regions = useMemo(() => {
    const set = new Set<string>();
    templates.forEach((t) => {
      if (t.region) set.add(t.region);
    });
    return Array.from(set).sort();
  }, [templates]);

  const filtered = useMemo(() => {
    return templates.filter((t) => {
      if (activeCategory !== 'all' && t.category !== activeCategory) return false;
      if (activeRegion !== 'all' && (t.region ?? 'GLOBAL') !== activeRegion) return false;
      return true;
    });
  }, [templates, activeCategory, activeRegion]);

  const featured = filtered.filter((t) => t.isFeatured);
  const others = filtered.filter((t) => !t.isFeatured);

  function setFilter(key: string, value: string) {
    const next = new URLSearchParams(searchParams);
    if (value === 'all') next.delete(key);
    else next.set(key, value);
    setSearchParams(next, { replace: true });
  }

  return (
    <Page
      title="Template marketplace"
      subtitle={`${templates.length} ready-made COD form templates. One-click install into your store.`}
      primaryAction={{ content: 'Build from scratch', url: '/app/forms' }}
    >
      <Layout>
        <Layout.Section variant="oneThird">
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingSm">
                Filter
              </Text>
              <ChoiceList
                title="Category"
                titleHidden
                choices={[
                  { label: 'All categories', value: 'all' },
                  ...categories.map((c) => ({
                    label: c.charAt(0).toUpperCase() + c.slice(1),
                    value: c,
                  })),
                ]}
                selected={[activeCategory]}
                onChange={(v) => setFilter('category', v[0] ?? 'all')}
              />
              <ChoiceList
                title="Region"
                titleHidden
                choices={[
                  { label: 'All regions', value: 'all' },
                  ...regions.map((r) => ({ label: r, value: r })),
                ]}
                selected={[activeRegion]}
                onChange={(v) => setFilter('region', v[0] ?? 'all')}
              />
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section>
          <BlockStack gap="500">
            {filtered.length === 0 ? (
              <Card>
                <EmptyState
                  heading="No templates match"
                  image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                  action={{
                    content: 'Reset filters',
                    onAction: () => setSearchParams(new URLSearchParams(), { replace: true }),
                  }}
                >
                  <p>Try a different category or region.</p>
                </EmptyState>
              </Card>
            ) : null}

            {featured.length > 0 ? (
              <BlockStack gap="300">
                <Text as="h2" variant="headingMd">
                  Featured
                </Text>
                <InlineGrid columns={{ xs: 1, sm: 2 }} gap="400">
                  {featured.map((t) => (
                    <TemplateCard key={t.id} t={t} featured />
                  ))}
                </InlineGrid>
              </BlockStack>
            ) : null}

            {others.length > 0 ? (
              <BlockStack gap="300">
                <Text as="h2" variant="headingMd">
                  All templates
                </Text>
                <InlineGrid columns={{ xs: 1, sm: 2, md: 3 }} gap="400">
                  {others.map((t) => (
                    <TemplateCard key={t.id} t={t} />
                  ))}
                </InlineGrid>
              </BlockStack>
            ) : null}
          </BlockStack>
        </Layout.Section>
      </Layout>
    </Page>
  );
}

type Template = ReturnType<typeof useLoaderData<typeof loader>>['templates'][number];

function TemplateCard({ t, featured = false }: { t: Template; featured?: boolean }) {
  const accent = getAccent(t.category);
  return (
    <Card padding="0">
      <Box
        paddingBlock="500"
        paddingInline="500"
        background="bg-surface-secondary"
        borderColor="border"
      >
        <div
          style={{
            background: `linear-gradient(135deg, ${accent.bg}26 0%, ${accent.bg}10 100%)`,
            borderRadius: 12,
            padding: 24,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: 96,
          }}
        >
          <span
            style={{
              fontSize: 36,
              filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.06))',
            }}
            aria-hidden="true"
          >
            {categoryEmoji(t.category)}
          </span>
        </div>
      </Box>
      <Box padding="400">
        <BlockStack gap="300">
          <InlineStack align="space-between" blockAlign="start" gap="200" wrap={false}>
            <Text as="h3" variant="headingMd">
              {t.name}
            </Text>
            {featured ? <Badge tone="success">Featured</Badge> : null}
          </InlineStack>
          <InlineStack gap="100" wrap>
            <Badge>{t.category}</Badge>
            {t.region ? <Badge tone="info">{t.region}</Badge> : null}
            <Badge>{t.language.toUpperCase()}</Badge>
          </InlineStack>
          <Text as="p" tone="subdued" variant="bodySm">
            {t.description ?? ''}
          </Text>
          <InlineStack align="space-between" blockAlign="center">
            <Text as="p" tone="subdued" variant="bodySm">
              {t.installCount.toLocaleString()} installs
            </Text>
            <RemixForm method="post">
              <input type="hidden" name="intent" value="install" />
              <input type="hidden" name="slug" value={t.slug} />
              <Button submit variant="primary">
                Use this template
              </Button>
            </RemixForm>
          </InlineStack>
        </BlockStack>
      </Box>
    </Card>
  );
}

function categoryEmoji(category: string): string {
  const map: Record<string, string> = {
    general: '🧩',
    apparel: '👕',
    electronics: '📱',
    food: '🍔',
    services: '📞',
    pharmacy: '💊',
    beauty: '💄',
  };
  return map[category.toLowerCase()] ?? '📋';
}
