import type { ActionFunctionArgs } from '@remix-run/node';
import { authenticate } from '../shopify.server';
import prisma from '../db.server';

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, session, topic } = await authenticate.webhook(request);
  // eslint-disable-next-line no-console
  console.log(`Received ${topic} webhook for ${shop}`);

  if (session) {
    await prisma.session.deleteMany({ where: { shop } });
  }
  await prisma.shop
    .update({
      where: { domain: shop },
      data: { uninstalledAt: new Date() },
    })
    .catch(() => {
      // Shop may not exist yet if install failed before DB write.
    });

  return new Response();
};
