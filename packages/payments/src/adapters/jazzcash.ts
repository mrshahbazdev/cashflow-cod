import type { PaymentAdapter } from '../index.js';
import { mockCreateAdvance, mockVerifyWebhook } from './_mock.js';

export const jazzcashAdapter: PaymentAdapter = {
  code: 'jazzcash',
  displayName: 'JazzCash',
  supportedCurrencies: ['PKR'],
  createAdvance(_credentials, req) {
    return mockCreateAdvance('jazzcash', req);
  },
  verifyWebhook(req) {
    return mockVerifyWebhook('jazzcash', req);
  },
};
