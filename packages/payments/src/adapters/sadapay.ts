import type { PaymentAdapter } from '../index.js';
import { mockCreateAdvance, mockVerifyWebhook } from './_mock.js';

export const sadapayAdapter: PaymentAdapter = {
  code: 'sadapay',
  displayName: 'SadaPay',
  supportedCurrencies: ['PKR'],
  createAdvance(_credentials, req) {
    return mockCreateAdvance('sadapay', req);
  },
  verifyWebhook(req) {
    return mockVerifyWebhook('sadapay', req);
  },
};
