import type { LoaderFunctionArgs } from '@remix-run/node';
import { Card, EmptyState, Page } from '@shopify/polaris';
import { authenticate } from '../shopify.server';

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  return null;
};

export default function IntegrationsRoute() {
  return (
    <Page title="Integrations">
      <Card>
        <EmptyState
          heading="Connect your stack"
          image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
        >
          <p>
            Meta, TikTok, Google, Snapchat and Pinterest pixels + CAPI, Google Sheets, Klaviyo,
            Omnisend, WhatsApp Business API, and generic webhooks.
          </p>
        </EmptyState>
      </Card>
    </Page>
  );
}
