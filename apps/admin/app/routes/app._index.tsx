import type { LoaderFunctionArgs } from '@remix-run/node';
import { useLoaderData } from '@remix-run/react';
import { BlockStack, Box, Card, InlineGrid, Layout, Page, Text } from '@shopify/polaris';
import { authenticate } from '../shopify.server';

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  return { shop: session.shop };
};

export default function Index() {
  const { shop } = useLoaderData<typeof loader>();

  return (
    <Page title="Welcome to Cashflow COD">
      <Layout>
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">
                Installed on {shop}
              </Text>
              <Text as="p" variant="bodyMd">
                Cashflow COD replaces Shopify&apos;s default checkout for cash-on-delivery orders
                with a fast, customizable form — and runs your entire COD ops pipeline (verify →
                ship → track → recover).
              </Text>
              <Text as="p" variant="bodyMd">
                Start by creating your first form, then enable the Cashflow COD app embed block in
                your theme editor.
              </Text>
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section>
          <InlineGrid columns={{ xs: 1, sm: 2, md: 3 }} gap="400">
            <SetupStep
              number={1}
              title="Create a form"
              description="Design your COD form with our drag-and-drop builder."
            />
            <SetupStep
              number={2}
              title="Enable theme embed"
              description="Turn on the Cashflow COD App Embed block in your theme editor."
            />
            <SetupStep
              number={3}
              title="Configure OTP & fraud rules"
              description="Set up SMS/WhatsApp OTP, blocklists, and velocity limits."
            />
          </InlineGrid>
        </Layout.Section>
      </Layout>
    </Page>
  );
}

function SetupStep({
  number,
  title,
  description,
}: {
  number: number;
  title: string;
  description: string;
}) {
  return (
    <Card>
      <BlockStack gap="200">
        <Box>
          <Text as="span" variant="bodySm" tone="subdued">
            Step {number}
          </Text>
        </Box>
        <Text as="h3" variant="headingSm">
          {title}
        </Text>
        <Text as="p" variant="bodyMd" tone="subdued">
          {description}
        </Text>
      </BlockStack>
    </Card>
  );
}
