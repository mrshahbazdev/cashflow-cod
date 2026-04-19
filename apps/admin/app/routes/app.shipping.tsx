import type { LoaderFunctionArgs } from '@remix-run/node';
import { Card, EmptyState, Page } from '@shopify/polaris';
import { authenticate } from '../shopify.server';

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  return null;
};

export default function ShippingRoute() {
  return (
    <Page title="Shipping & couriers">
      <Card>
        <EmptyState
          heading="Connect your couriers"
          image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
        >
          <p>
            One-click booking for Postex, Leopards, TCS, Trax, M&amp;P, BlueEx, Swyft, Call Courier,
            Daewoo, Aramex, ShipRocket, DHL, and more.
          </p>
        </EmptyState>
      </Card>
    </Page>
  );
}
