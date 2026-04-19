import type { LoaderFunctionArgs } from '@remix-run/node';
import { Card, EmptyState, Page } from '@shopify/polaris';
import { authenticate } from '../shopify.server';

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  return null;
};

export default function AnalyticsRoute() {
  return (
    <Page title="Analytics">
      <Card>
        <EmptyState
          heading="Insights will appear once you have traffic"
          image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
        >
          <p>
            Funnel analytics (views → submits → verified → shipped → delivered), AOV, RTO breakdown
            by city/courier/product, and cohorts.
          </p>
        </EmptyState>
      </Card>
    </Page>
  );
}
