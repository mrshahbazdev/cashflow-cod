import type { PaymentAdapter } from '../index.js';
import { mockCreateAdvance, mockVerifyWebhook } from './_mock.js';

export const razorpayAdapter: PaymentAdapter = {
  code: 'razorpay',
  displayName: 'Razorpay',
  supportedCurrencies: ['INR'],
  createAdvance(_credentials, req) {
    return mockCreateAdvance('razorpay', req);
  },
  verifyWebhook(req) {
    return mockVerifyWebhook('razorpay', req);
  },
};
