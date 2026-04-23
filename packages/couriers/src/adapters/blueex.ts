import type { CourierAdapter, CourierBookingResult, CourierTrackingEvent } from '../index.js';

/** BlueEx (Pakistan). Mock-first adapter; real integration over SOAP/REST. */
export const blueexAdapter: CourierAdapter = {
  code: 'blueex',
  displayName: 'BlueEx',
  regions: ['PK'],

  async book(credentials, req): Promise<CourierBookingResult> {
    if (!credentials.accountNumber || credentials.mode === 'mock') {
      const cn = `BLX-${req.orderId.slice(-6).toUpperCase()}`;
      return {
        consignmentNumber: cn,
        trackingUrl: `https://track.blue-ex.com/track/${cn}`,
        status: 'booked',
        raw: { mock: true },
      };
    }
    try {
      const resp = await fetch('https://bigazure.com/api/v2/index.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          account: credentials.accountNumber,
          password: credentials.password,
          consignee: {
            name: req.customerName,
            phone: req.phone,
            address: req.addressLine1,
            city: req.city,
          },
          order_id: req.orderId,
          pieces: 1,
          weight: req.weightKg ?? 0.5,
          cod_amount: req.amount,
          remarks: req.notes ?? '',
        }),
      });
      const json = (await resp.json()) as { cn_number?: string; message?: string };
      if (!json.cn_number) {
        return { consignmentNumber: '', status: 'failed', raw: json };
      }
      return {
        consignmentNumber: json.cn_number,
        trackingUrl: `https://track.blue-ex.com/track/${json.cn_number}`,
        status: 'booked',
        raw: json,
      };
    } catch (err) {
      return { consignmentNumber: '', status: 'failed', raw: { error: (err as Error).message } };
    }
  },

  async track(): Promise<CourierTrackingEvent[]> {
    return [{ status: 'Booked', occurredAt: new Date().toISOString() }];
  },
};
