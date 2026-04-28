import type { LoaderFunctionArgs } from '@remix-run/node';
import { Link, useLoaderData } from '@remix-run/react';
import {
  Badge,
  BlockStack,
  Box,
  Button,
  Card,
  EmptyState,
  InlineGrid,
  InlineStack,
  Layout,
  Page,
  ProgressBar,
  ResourceItem,
  ResourceList,
  Text,
} from '@shopify/polaris';
import { authenticate } from '../shopify.server';
import prisma from '../db.server';
import type { ShopSettings } from '../lib/install.server';

type OnboardingStep = {
  id: keyof ShopSettings['onboarding'];
  label: string;
  description: string;
  to?: string;
  done: boolean;
};

const ms24h = 24 * 60 * 60 * 1000;

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  const shop = await prisma.shop.findUnique({
    where: { domain: session.shop },
    include: {
      _count: { select: { forms: true, orders: true, agents: true } },
    },
  });

  const settings = (shop?.settings as Partial<ShopSettings> | null) ?? {};
  const onboarding = settings.onboarding ?? {
    completed: false,
    firstFormCreated: false,
    themeEmbedEnabled: false,
    paymentConfigured: false,
    testOrderPlaced: false,
  };

  const since7d = new Date(Date.now() - 7 * ms24h);
  const recentSubmissions = shop
    ? await prisma.submission.findMany({
        where: { form: { shopId: shop.id } },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          id: true,
          createdAt: true,
          phone: true,
          status: true,
          form: { select: { name: true, slug: true } },
        },
      })
    : [];

  const submissions7d = shop
    ? await prisma.submission.count({
        where: {
          form: { shopId: shop.id },
          createdAt: { gte: since7d },
        },
      })
    : 0;
  const orders7d = shop
    ? await prisma.order.count({
        where: { shopId: shop.id, createdAt: { gte: since7d } },
      })
    : 0;

  return {
    shop: session.shop,
    plan: shop?.plan ?? 'FREE',
    counts: shop?._count ?? { forms: 0, orders: 0, agents: 0 },
    last7d: { submissions: submissions7d, orders: orders7d },
    onboarding,
    recentSubmissions: recentSubmissions.map((s) => ({
      id: s.id,
      createdAt: s.createdAt.toISOString(),
      phone: s.phone ?? '',
      status: s.status,
      formName: s.form.name,
      formSlug: s.form.slug,
    })),
  };
};

export default function AppIndex() {
  const { shop, plan, counts, last7d, onboarding, recentSubmissions } =
    useLoaderData<typeof loader>();

  const steps: OnboardingStep[] = [
    {
      id: 'firstFormCreated',
      label: 'Create your first form',
      description: 'Design a COD form from a template or build from scratch.',
      to: '/app/templates',
      done: onboarding.firstFormCreated ?? false,
    },
    {
      id: 'themeEmbedEnabled',
      label: 'Enable the theme embed',
      description: 'Turn on the Cashflow COD app embed in your theme editor.',
      done: onboarding.themeEmbedEnabled ?? false,
    },
    {
      id: 'paymentConfigured',
      label: 'Configure OTP & fraud rules',
      description: 'Set up SMS/WhatsApp OTP, blocklists, and velocity limits.',
      to: '/app/settings',
      done: onboarding.paymentConfigured ?? false,
    },
    {
      id: 'testOrderPlaced',
      label: 'Place a test order',
      description: 'Submit a test order from your storefront to verify the full flow.',
      done: onboarding.testOrderPlaced ?? false,
    },
  ];

  const completedCount = steps.filter((s) => s.done).length;
  const progress = Math.round((completedCount / steps.length) * 100);
  const showOnboarding = !onboarding.completed && completedCount < steps.length;

  return (
    <Page
      title="Welcome to Cashflow COD"
      subtitle={`Installed on ${shop}`}
      titleMetadata={<Badge tone="info">{plan}</Badge>}
      primaryAction={{ content: 'Create form', url: '/app/templates' }}
      secondaryActions={[
        { content: 'View analytics', url: '/app/analytics' },
        { content: 'Embed snippets', url: '/app/forms' },
      ]}
    >
      <Layout>
        <Layout.Section>
          <InlineGrid columns={{ xs: 1, sm: 2, md: 4 }} gap="400">
            <StatCard
              emoji="🛒"
              label="Total orders"
              value={counts.orders}
              delta={`+${last7d.orders} last 7d`}
              tone="success"
            />
            <StatCard
              emoji="✅"
              label="Submissions (7d)"
              value={last7d.submissions}
              delta="Last week"
              tone="info"
            />
            <StatCard
              emoji="🌐"
              label="Active forms"
              value={counts.forms}
              delta={counts.forms === 0 ? 'Get started →' : 'Live now'}
              tone={counts.forms === 0 ? 'attention' : 'success'}
            />
            <StatCard
              emoji="👥"
              label="Team members"
              value={counts.agents}
              delta={counts.agents <= 1 ? 'Solo' : 'Members'}
              tone="info"
            />
          </InlineGrid>
        </Layout.Section>

        {showOnboarding ? (
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <InlineStack align="space-between" blockAlign="center">
                  <BlockStack gap="100">
                    <Text as="h2" variant="headingMd">
                      Get up and running
                    </Text>
                    <Text as="p" variant="bodySm" tone="subdued">
                      Finish these {steps.length} steps to start collecting COD orders.
                    </Text>
                  </BlockStack>
                  <Text as="span" variant="bodyMd" tone="subdued">
                    {completedCount} of {steps.length} complete
                  </Text>
                </InlineStack>
                <ProgressBar progress={progress} tone="primary" />
                <BlockStack gap="200">
                  {steps.map((step, idx) => (
                    <OnboardingRow key={step.id} index={idx + 1} step={step} />
                  ))}
                </BlockStack>
              </BlockStack>
            </Card>
          </Layout.Section>
        ) : null}

        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <InlineStack align="space-between" blockAlign="center">
                <Text as="h2" variant="headingMd">
                  Quick actions
                </Text>
                <Text as="span" variant="bodySm" tone="subdued">
                  Jump straight to what matters
                </Text>
              </InlineStack>
              <InlineGrid columns={{ xs: 1, sm: 2, md: 4 }} gap="300">
                <QuickAction
                  emoji="🧱"
                  title="Browse templates"
                  description="10 ready-made COD forms"
                  url="/app/templates"
                />
                <QuickAction
                  emoji="🚚"
                  title="Add a courier"
                  description="12 carriers supported"
                  url="/app/couriers"
                />
                <QuickAction
                  emoji="📈"
                  title="Track conversion"
                  description="Funnel + revenue analytics"
                  url="/app/analytics"
                />
                <QuickAction
                  emoji="🔗"
                  title="Connect integrations"
                  description="Klaviyo / Sheets / Pixels"
                  url="/app/integrations"
                />
              </InlineGrid>
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section>
          <Card padding="0">
            <Box padding="400">
              <InlineStack align="space-between" blockAlign="center">
                <Text as="h2" variant="headingMd">
                  Recent submissions
                </Text>
                <Button variant="plain" url="/app/submissions">
                  See all
                </Button>
              </InlineStack>
            </Box>
            {recentSubmissions.length === 0 ? (
              <Box padding="400">
                <EmptyState
                  heading="No submissions yet"
                  image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                  action={{ content: 'Browse templates', url: '/app/templates' }}
                >
                  <p>Once shoppers submit your COD form, the latest entries will appear here.</p>
                </EmptyState>
              </Box>
            ) : (
              <ResourceList
                resourceName={{ singular: 'submission', plural: 'submissions' }}
                items={recentSubmissions}
                renderItem={(s) => (
                  <ResourceItem
                    id={s.id}
                    onClick={() => undefined}
                    accessibilityLabel={`Submission ${s.id}`}
                  >
                    <InlineStack align="space-between" blockAlign="center">
                      <BlockStack gap="050">
                        <Text as="p" fontWeight="semibold">
                          {s.formName}
                        </Text>
                        <Text as="span" tone="subdued" variant="bodySm">
                          {s.phone || '—'} · {new Date(s.createdAt).toLocaleString()}
                        </Text>
                      </BlockStack>
                      <SubmissionStatus status={s.status} />
                    </InlineStack>
                  </ResourceItem>
                )}
              />
            )}
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}

function OnboardingRow({ index, step }: { index: number; step: OnboardingStep }) {
  const tone: 'success' | 'subdued' = step.done ? 'success' : 'subdued';
  const content = (
    <InlineStack align="start" blockAlign="start" gap="300" wrap={false}>
      <Box>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 28,
            height: 28,
            borderRadius: 999,
            background: step.done ? 'var(--p-color-bg-success-strong)' : 'var(--p-color-bg-fill)',
            color: step.done ? 'white' : 'var(--p-color-text)',
            fontWeight: 700,
            fontSize: 13,
          }}
        >
          {step.done ? '✓' : index}
        </span>
      </Box>
      <BlockStack gap="050">
        <Text as="h3" variant="bodyMd" fontWeight="semibold" tone={step.done ? 'subdued' : 'base'}>
          {step.label}
        </Text>
        <Text as="p" variant="bodySm" tone="subdued">
          {step.description}
        </Text>
      </BlockStack>
    </InlineStack>
  );
  if (step.to && !step.done) {
    return (
      <Link to={step.to} prefetch="intent" style={{ textDecoration: 'none', color: 'inherit' }}>
        {content}
      </Link>
    );
  }
  return content;
  void tone;
}

function StatCard({
  emoji,
  label,
  value,
  delta,
  tone,
}: {
  emoji: string;
  label: string;
  value: number;
  delta: string;
  tone: 'success' | 'info' | 'attention';
}) {
  return (
    <Card>
      <BlockStack gap="200">
        <InlineStack align="space-between" blockAlign="center">
          <Text as="span" variant="bodySm" tone="subdued">
            {label}
          </Text>
          <span aria-hidden="true" style={{ fontSize: 20 }}>
            {emoji}
          </span>
        </InlineStack>
        <Text as="p" variant="heading2xl">
          {value.toLocaleString()}
        </Text>
        <Badge tone={tone === 'attention' ? 'attention' : tone === 'success' ? 'success' : 'info'}>
          {delta}
        </Badge>
      </BlockStack>
    </Card>
  );
}

function QuickAction({
  emoji,
  title,
  description,
  url,
}: {
  emoji: string;
  title: string;
  description: string;
  url: string;
}) {
  return (
    <Link to={url} prefetch="intent" style={{ textDecoration: 'none', color: 'inherit' }}>
      <Card>
        <BlockStack gap="200">
          <span aria-hidden="true" style={{ fontSize: 22 }}>
            {emoji}
          </span>
          <Text as="h3" variant="bodyMd" fontWeight="semibold">
            {title}
          </Text>
          <Text as="p" variant="bodySm" tone="subdued">
            {description}
          </Text>
        </BlockStack>
      </Card>
    </Link>
  );
}

function SubmissionStatus({ status }: { status: string }) {
  const map: Record<string, { tone: 'success' | 'info' | 'attention' | 'warning'; label: string }> =
    {
      VERIFIED: { tone: 'success', label: 'Verified' },
      PENDING: { tone: 'attention', label: 'Pending' },
      OTP_SENT: { tone: 'info', label: 'OTP sent' },
      ABANDONED: { tone: 'warning', label: 'Abandoned' },
      FAILED: { tone: 'warning', label: 'Failed' },
    };
  const meta = map[status] ?? { tone: 'info' as const, label: status };
  return <Badge tone={meta.tone}>{meta.label}</Badge>;
}
