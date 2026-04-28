import type { CourierAdapter, CourierBookingRequest, CourierBookingResult, CourierTrackingEvent } from '../index.js';

/**
 * ShipRocket (India) adapter.
 * API docs: https://apidocs.shiprocket.in
 * Credentials: email, password (used to fetch a bearer token), pickupLocation (nickname), optional token.
 * Falls back to deterministic mock when credentials missing or mode=mock.
 */
export const shiprocketAdapter: CourierAdapter = {
  code: 'shiprocket',
  displayName: 'ShipRocket (India)',
  regions: ['IN'],

  async book(credentials, req): Promise<CourierBookingResult> {
    if (credentials.mode === 'mock' || (!credentials.token && (!credentials.email || !credentials.password))) {
      return mockResult(req, 'SR');
    }
    try {
      const token = credentials.token || (await authenticate(credentials.email!, credentials.password!));
      if (!token) return { consignmentNumber: '', status: 'failed', raw: { error: 'auth_failed' } };

      const body = {
        order_id: req.orderId,
        order_date: new Date().toISOString().slice(0, 10),
        pickup_location: credentials.pickupLocation || 'Primary',
        billing_customer_name: req.customerName,
        billing_last_name: '',
        billing_address: req.addressLine1,
        billing_address_2: req.addressLine2 || '',
        billing_city: req.city,
        billing_pincode: req.postalCode || '000000',
        billing_state: credentials.state || '',
        billing_country: 'India',
        billing_email: 'buyer@example.com',
        billing_phone: req.phone,
        shipping_is_billing: true,
        order_items: [
          { name: req.notes || 'COD Order', sku: req.orderId, units: 1, selling_price: req.amount },
        ],
        payment_method: 'COD',
        sub_total: req.amount,
        length: 10,
        breadth: 10,
        height: 10,
        weight: req.weightKg ?? 0.5,
      };

      const resp = await fetch('https://apiv2.shiprocket.in/v1/external/orders/create/adhoc', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });
      const json = (await resp.json()) as {
        order_id?: string;
        shipment_id?: string;
        awb_code?: string;
        status?: string;
      };
      const awb = json.awb_code || json.shipment_id || '';
      if (!awb) return { consignmentNumber: '', status: 'failed', raw: json };
      return {
        consignmentNumber: awb,
        trackingUrl: `https://shiprocket.co/tracking/${awb}`,
        status: 'booked',
        raw: json,
      };
    } catch (err) {
      return { consignmentNumber: '', status: 'failed', raw: { error: (err as Error).message } };
    }
  },

  async track(credentials, consignmentNumber): Promise<CourierTrackingEvent[]> {
    if (credentials.mode === 'mock' || (!credentials.token && (!credentials.email || !credentials.password))) {
      return mockTrack();
    }
    try {
      const token = credentials.token || (await authenticate(credentials.email!, credentials.password!));
      if (!token) return [];
      const resp = await fetch(
        `https://apiv2.shiprocket.in/v1/external/courier/track/awb/${consignmentNumber}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      const json = (await resp.json()) as {
        tracking_data?: {
          shipment_track_activities?: Array<{ date: string; activity: string; location?: string }>;
        };
      };
      return (json.tracking_data?.shipment_track_activities ?? []).map((e) => ({
        status: e.activity,
        occurredAt: e.date,
        location: e.location,
      }));
    } catch {
      return [];
    }
  },
};

async function authenticate(email: string, password: string): Promise<string | null> {
  try {
    const resp = await fetch('https://apiv2.shiprocket.in/v1/external/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const json = (await resp.json()) as { token?: string };
    return json.token ?? null;
  } catch {
    return null;
  }
}

function mockResult(req: CourierBookingRequest, prefix: string): CourierBookingResult {
  const cn = `${prefix}-${req.orderId.slice(-6).toUpperCase()}`;
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
    { status: 'Picked Up', occurredAt: new Date(Date.now() - 3600e3).toISOString() },
  ];
}
