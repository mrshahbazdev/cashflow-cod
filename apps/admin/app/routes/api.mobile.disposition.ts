import type { ActionFunctionArgs } from '@remix-run/node';
import { json } from '@remix-run/node';
import prisma from '../db.server';

/**
 * Mobile-PWA dispatch endpoint. Accepts disposition updates from the agent
 * mobile app. The service worker auto-queues this on offline and replays via
 * background sync.
 */
export const action = async ({ request }: ActionFunctionArgs) => {
  if (request.method !== 'POST') return json({ ok: false }, { status: 405 });
  const body = (await request.json().catch(() => ({}))) as {
    orderId?: string;
    disposition?: string;
    note?: string;
    token?: string;
  };
  if (!body.orderId || !body.disposition) {
    return json({ ok: false, error: 'orderId + disposition required' }, { status: 400 });
  }
  const allowed = ['CONFIRMED', 'FAKE', 'NO_ANSWER', 'PENDING', 'CANCELLED', 'RESCHEDULED'];
  if (!allowed.includes(body.disposition)) {
    return json({ ok: false, error: 'invalid disposition' }, { status: 400 });
  }

  const order = await prisma.order.findUnique({ where: { id: body.orderId } });
  if (!order) return json({ ok: false, error: 'not found' }, { status: 404 });

  let agentId: string | null = null;
  if (body.token) {
    const agent = await prisma.agent.findFirst({
      where: { userId: body.token, shopId: order.shopId, isActive: true },
    });
    agentId = agent?.id ?? null;
  }

  await prisma.$transaction([
    prisma.order.update({
      where: { id: order.id },
      data: { disposition: body.disposition as never, agentId: agentId ?? order.agentId },
    }),
    ...(agentId
      ? [
          prisma.agentAction.create({
            data: {
              orderId: order.id,
              agentId,
              actionType: `disposition:${body.disposition}`,
              note: body.note ?? null,
            },
          }),
        ]
      : []),
  ]);
  return json({ ok: true });
};
