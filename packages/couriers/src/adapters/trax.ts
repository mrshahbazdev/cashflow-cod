import type { CourierAdapter, CourierBookingResult, CourierTrackingEvent } from '../index.js';

/** Trax Logistics (Pakistan). Mock-first adapter; real API uses bearer token. */
export const traxAdapter: CourierAdapter = {
  code: 'trax',
  displayName: 'Trax Logistics',
  regions: ['PK'],

  async book(credentials, req): Promise<CourierBookingResult> {
    if (!credentials.token || credentials.mode === 'mock') {
      const cn = `TRX-${req.orderId.slice(-6).toUpperCase()}`;
      return {
        consignmentNumber: cn,
        trackingUrl: `https://trax.pk/tracking/${cn}`,
        status: 'booked',
        raw: { mock: true },
      };
    }
    try {
      const resp = await fetch('https://api.trax.pk/api/shipment/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${credentials.token}` },
        body: JSON.stringify({
          customer_name: req.customerName,
          customer_phone: req.phone,
          customer_address: req.addressLine1,
          customer_city: req.city,
          order_no: req.orderId,
          cod_amount: req.amount,
          weight: req.weightKg ?? 0.5,
          remarks: req.notes ?? '',
        }),
      });
      const json = (await resp.json()) as { tracking_number?: string; status?: string };
      if (!json.tracking_number) {
        return { consignmentNumber: '', status: 'failed', raw: json };
      }
      return {
        consignmentNumber: json.tracking_number,
        trackingUrl: `https://trax.pk/tracking/${json.tracking_number}`,
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
