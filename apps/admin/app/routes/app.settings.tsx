import type { LoaderFunctionArgs } from '@remix-run/node';
import { Card, EmptyState, Page } from '@shopify/polaris';
import { authenticate } from '../shopify.server';

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  return null;
};

export default function SettingsRoute() {
  return (
    <Page title="Settings">
      <Card>
        <EmptyState
          heading="App settings"
          image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
        >
          <p>
            Branding, languages &amp; RTL, team &amp; agents, billing plan, API keys, and GDPR data
            controls.
          </p>
        </EmptyState>
      </Card>
    </Page>
  );
}
