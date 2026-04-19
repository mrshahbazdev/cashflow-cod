import type { ActionFunctionArgs } from '@remix-run/node';
import { authenticate } from '../shopify.server';

export const action = async ({ request }: ActionFunctionArgs) => {
  const { topic, shop, payload } = await authenticate.webhook(request);
  // eslint-disable-next-line no-console
  console.log(`[GDPR] ${topic} for ${shop}`, payload);
  // TODO: implement customer data export / redaction / shop redaction pipelines.
  return new Response();
};
