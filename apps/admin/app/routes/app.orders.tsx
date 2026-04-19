import type { LoaderFunctionArgs } from '@remix-run/node';
import { Card, EmptyState, Page } from '@shopify/polaris';
import { authenticate } from '../shopify.server';

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  return null;
};

export default function OrdersRoute() {
  return (
    <Page title="Orders">
      <Card>
        <EmptyState
          heading="No COD orders yet"
          image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
        >
          <p>
            Once your form starts collecting orders, they will appear here with AI RTO-risk scoring
            and agent workflow actions.
          </p>
        </EmptyState>
      </Card>
    </Page>
  );
}
