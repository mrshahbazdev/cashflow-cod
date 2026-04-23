import type { PaymentAdapter } from '../index.js';
import { mockCreateAdvance, mockVerifyWebhook } from './_mock.js';

export const stripeAdapter: PaymentAdapter = {
  code: 'stripe',
  displayName: 'Stripe',
  supportedCurrencies: ['USD', 'EUR', 'GBP', 'AED', 'PKR', 'INR'],
  createAdvance(_credentials, req) {
    return mockCreateAdvance('stripe', req);
  },
  verifyWebhook(req) {
    return mockVerifyWebhook('stripe', req);
  },
};
