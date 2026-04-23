import type { HeadersFunction, LoaderFunctionArgs } from '@remix-run/node';
import { Link, Outlet, useLoaderData, useRouteError } from '@remix-run/react';
import { boundary } from '@shopify/shopify-app-remix/server';
import { AppProvider } from '@shopify/shopify-app-remix/react';
import { NavMenu } from '@shopify/app-bridge-react';
import polarisStyles from '@shopify/polaris/build/esm/styles.css?url';
import { authenticate } from '../shopify.server';

export const links = () => [{ rel: 'stylesheet', href: polarisStyles }];

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  return { apiKey: process.env.SHOPIFY_API_KEY || '' };
};

export default function AppLayout() {
  const { apiKey } = useLoaderData<typeof loader>();

  return (
    <AppProvider isEmbeddedApp apiKey={apiKey}>
      <NavMenu>
        <Link to="/app" rel="home">
          Home
        </Link>
        <Link to="/app/forms">Forms</Link>
        <Link to="/app/orders">Orders</Link>
        <Link to="/app/abandoned">Abandoned</Link>
        <Link to="/app/calls">AI calls</Link>
        <Link to="/app/couriers">Couriers</Link>
        <Link to="/app/blocklist">Blocklist</Link>
        <Link to="/app/agents">Team</Link>
        <Link to="/app/analytics">Analytics</Link>
        <Link to="/app/rto-analytics">RTO insights</Link>
        <Link to="/app/fraud-graph">Fraud graph</Link>
        <Link to="/app/groups">Merchant groups</Link>
        <Link to="/app/templates">Templates</Link>
        <Link to="/app/inbox">Inbox</Link>
        <Link to="/app/ab-tests">A/B tests</Link>
        <Link to="/app/landing">Landing pages</Link>
        <Link to="/app/payments">Payments</Link>
        <Link to="/app/i18n">Languages</Link>
        <Link to="/app/shipping">Shipping</Link>
        <Link to="/app/integrations">Integrations</Link>
        <Link to="/app/settings">Settings</Link>
      </NavMenu>
      <Outlet />
    </AppProvider>
  );
}

export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers: HeadersFunction = (args) => {
  return boundary.headers(args);
};
