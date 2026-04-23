import type { PaymentAdapter } from '../index.js';
import { mockCreateAdvance, mockVerifyWebhook } from './_mock.js';

export const easypaisaAdapter: PaymentAdapter = {
  code: 'easypaisa',
  displayName: 'EasyPaisa',
  supportedCurrencies: ['PKR'],
  createAdvance(_credentials, req) {
    return mockCreateAdvance('easypaisa', req);
  },
  verifyWebhook(req) {
    return mockVerifyWebhook('easypaisa', req);
  },
};
