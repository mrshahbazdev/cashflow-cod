import type { LoaderFunctionArgs } from '@remix-run/node';
import { Link, useLoaderData } from '@remix-run/react';
import {
  Badge,
  BlockStack,
  Box,
  Card,
  InlineStack,
  Layout,
  Page,
  ProgressBar,
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

  return {
    shop: session.shop,
    plan: shop?.plan ?? 'FREE',
    counts: shop?._count ?? { forms: 0, orders: 0, agents: 0 },
    onboarding,
  };
};

export default function AppIndex() {
  const { shop, plan, counts, onboarding } = useLoaderData<typeof loader>();

  const steps: OnboardingStep[] = [
    {
      id: 'firstFormCreated',
      label: 'Create your first form',
      description: 'Design a COD order form with the drag-and-drop builder.',
      to: '/app/forms',
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

  return (
    <Page
      title="Welcome to Cashflow COD"
      subtitle={`Installed on ${shop}`}
      titleMetadata={<Badge tone="info">{plan}</Badge>}
    >
      <Layout>
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <InlineStack align="space-between" blockAlign="center">
                <Text as="h2" variant="headingMd">
                  Setup checklist
                </Text>
                <Text as="span" variant="bodyMd" tone="subdued">
                  {completedCount} of {steps.length} complete
                </Text>
              </InlineStack>
              <ProgressBar progress={progress} tone="primary" />
              <BlockStack gap="300">
                {steps.map((step, idx) => (
                  <OnboardingRow key={step.id} index={idx + 1} step={step} />
                ))}
              </BlockStack>
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section variant="oneThird">
          <BlockStack gap="400">
            <StatCard label="Forms" value={counts.forms} />
            <StatCard label="Orders" value={counts.orders} />
            <StatCard label="Team members" value={counts.agents} />
          </BlockStack>
        </Layout.Section>
      </Layout>
    </Page>
  );
}

function OnboardingRow({ index, step }: { index: number; step: OnboardingStep }) {
  const content = (
    <InlineStack align="start" blockAlign="start" gap="300" wrap={false}>
      <Box>
        <Text as="span" variant="bodyMd" tone={step.done ? 'success' : 'subdued'}>
          {step.done ? '✓' : index}
        </Text>
      </Box>
      <BlockStack gap="100">
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
      <Link to={step.to} prefetch="intent" style={{ textDecoration: 'none' }}>
        {content}
      </Link>
    );
  }
  return content;
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <BlockStack gap="100">
        <Text as="span" variant="bodySm" tone="subdued">
          {label}
        </Text>
        <Text as="p" variant="headingLg">
          {value.toLocaleString()}
        </Text>
      </BlockStack>
    </Card>
  );
}
