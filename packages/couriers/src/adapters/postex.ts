import type { CourierAdapter, CourierBookingRequest, CourierBookingResult, CourierTrackingEvent } from '../index.js';

/**
 * PostEx (Pakistan) adapter.
 * API docs: https://api.postex.pk/services/integration/api/order/v3/create-order
 * Required credentials: apiKey (x-api-key header), pickupAddressCode.
 * If credentials are missing or API_MODE=mock, falls back to a deterministic stub.
 */
export const postexAdapter: CourierAdapter = {
  code: 'postex',
  displayName: 'PostEx',
  regions: ['PK'],

  async book(credentials, req): Promise<CourierBookingResult> {
    const apiKey = credentials.apiKey;
    const pickup = credentials.pickupAddressCode || 'HOME';
    if (!apiKey || credentials.mode === 'mock') {
      return mockResult(req, 'postex');
    }

    const body = {
      cityName: req.city,
      customerName: req.customerName,
      customerPhone: req.phone,
      deliveryAddress: [req.addressLine1, req.addressLine2].filter(Boolean).join(' '),
      invoiceDivision: 0,
      invoicePayment: req.amount,
      items: 1,
      orderDetail: req.notes || 'Cashflow COD order',
      orderRefNumber: req.orderId,
      orderType: 'Normal',
      transactionNotes: req.notes || '',
      pickupAddressCode: pickup,
    };

    try {
      const resp = await fetch('https://api.postex.pk/services/integration/api/order/v3/create-order', {
        method: 'POST',
        headers: {
          'token': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });
      const json = (await resp.json()) as {
        statusCode?: string;
        dist?: { trackingNumber?: string; orderStatus?: string };
      };
      const track = json?.dist?.trackingNumber;
      if (!track) {
        return { consignmentNumber: '', status: 'failed', raw: json };
      }
      return {
        consignmentNumber: track,
        trackingUrl: `https://postex.pk/tracking?cn=${track}`,
        status: 'booked',
        raw: json,
      };
    } catch (err) {
      return {
        consignmentNumber: '',
        status: 'failed',
        raw: { error: (err as Error).message },
      };
    }
  },

  async track(credentials, consignmentNumber): Promise<CourierTrackingEvent[]> {
    const apiKey = credentials.apiKey;
    if (!apiKey || credentials.mode === 'mock') {
      return mockTrack();
    }
    try {
      const resp = await fetch(
        `https://api.postex.pk/services/integration/api/order/v1/track-order/${consignmentNumber}`,
        { headers: { token: apiKey } },
      );
      const json = (await resp.json()) as {
        dist?: { transactionStatusHistory?: Array<{ transactionStatusMessage: string; modifiedDatetime: string }> };
      };
      return (json.dist?.transactionStatusHistory ?? []).map((e) => ({
        status: e.transactionStatusMessage,
        occurredAt: e.modifiedDatetime,
      }));
    } catch {
      return [];
    }
  },
};

function mockResult(req: CourierBookingRequest, prefix: string): CourierBookingResult {
  const cn = `${prefix.toUpperCase()}-${req.orderId.slice(-6).toUpperCase()}`;
  return {
    consignmentNumber: cn,
    trackingUrl: `https://example.com/track/${cn}`,
    status: 'booked',
    raw: { mock: true },
  };
}

function mockTrack(): CourierTrackingEvent[] {
  return [
    { status: 'Booked', occurredAt: new Date().toISOString() },
    { status: 'In Transit', occurredAt: new Date(Date.now() - 3600e3).toISOString() },
  ];
}
