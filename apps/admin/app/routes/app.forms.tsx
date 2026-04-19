import type { LoaderFunctionArgs } from '@remix-run/node';
import { Card, EmptyState, Page } from '@shopify/polaris';
import { authenticate } from '../shopify.server';

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  return null;
};

export default function FormsRoute() {
  return (
    <Page title="Forms">
      <Card>
        <EmptyState
          heading="Create your first COD form"
          action={{ content: 'Create form', disabled: true }}
          image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
        >
          <p>
            Drag-and-drop builder with conditional logic, multi-step forms, and A/B testing. (Coming
            in Phase 1 implementation PR.)
          </p>
        </EmptyState>
      </Card>
    </Page>
  );
}
