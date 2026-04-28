import prisma from '../db.server';
import { messagingRegistry } from '@cashflow-cod/messaging';

interface OrderConfirmationInput {
  shopId: string;
  phone: string;
  customerName?: string;
  orderId?: string;
  orderTotal?: string;
  currency?: string;
}

export async function sendWhatsAppOrderConfirmation(
  input: OrderConfirmationInput,
): Promise<void> {
  const { shopId, phone, customerName, orderId, orderTotal, currency } = input;

  const shop = await prisma.shop.findUnique({
    where: { id: shopId },
    select: { domain: true, settings: true },
  });
  if (!shop) return;

  const settings = (shop.settings ?? {}) as Record<string, unknown>;
  const waSettings = (settings.whatsappConfirmation ?? {}) as Record<string, unknown>;
  if (!waSettings.enabled) return;

  const credentials = (settings.messagingCredentials ?? {}) as Record<string, string>;
  if (!credentials.apiKey && !credentials.mode) return;

  const adapter = messagingRegistry.get('360dialog');
  if (!adapter) return;

  const name = customerName || 'Customer';
  const total = orderTotal ? `${currency ?? ''} ${orderTotal}`.trim() : '';
  const template = String(
    waSettings.messageTemplate ??
      'Hi {{name}}, your Cash on Delivery order{{orderId}} has been confirmed!{{total}} We will deliver it soon. Thank you for shopping with us!',
  );

  const body = template
    .replace('{{name}}', name)
    .replace('{{orderId}}', orderId ? ` #${orderId}` : '')
    .replace('{{total}}', total ? ` Total: ${total}.` : '');

  try {
    await adapter.send(credentials, 'WHATSAPP', { to: phone, body });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(
      `[Cashflow COD] WhatsApp confirmation failed for ${phone}:`,
      err instanceof Error ? err.message : err,
    );
  }
}
