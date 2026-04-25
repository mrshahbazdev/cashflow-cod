import type { CourierAdapter, CourierBookingResult, CourierTrackingEvent } from '../index.js';
import { mockBookingResult, mockTrackingEvents } from './_mock.js';

/**
 * Shiprocket (India) adapter using the v1 OAuth API.
 * Required credentials:
 *   - email + password (we exchange for a bearer token at booking time)
 *   - pickupLocation (must already exist on the merchant's Shiprocket account)
 * API docs: https://apidocs.shiprocket.in
 */
async function getToken(creds: Record<string, string>): Promise<string | null> {
  if (!creds.email || !creds.password) return null;
  try {
    const resp = await fetch('https://apiv2.shiprocket.in/v1/external/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: creds.email, password: creds.password }),
    });
    const json = (await resp.json()) as { token?: string };
    return json.token ?? null;
  } catch {
    return null;
  }
}

export const shiprocketAdapter: CourierAdapter = {
  code: 'shiprocket',
  displayName: 'Shiprocket',
  regions: ['IN'],

  async book(credentials, req): Promise<CourierBookingResult> {
    if (credentials.mode === 'mock' || !credentials.email) {
      return mockBookingResult(req, 'shiprocket');
    }
    const token = await getToken(credentials);
    if (!token) return { consignmentNumber: '', status: 'failed', raw: { error: 'auth_failed' } };

    const body = {
      order_id: req.orderId,
      order_date: new Date().toISOString().slice(0, 10),
      pickup_location: credentials.pickupLocation || 'Primary',
      billing_customer_name: req.customerName,
      billing_address: req.addressLine1,
      billing_address_2: req.addressLine2 ?? '',
      billing_city: req.city,
      billing_pincode: req.postalCode ?? '',
      billing_country: 'India',
      billing_state: credentials.billingState ?? '',
      billing_email: '',
      billing_phone: req.phone,
      shipping_is_billing: true,
      order_items: [
        {
          name: req.notes ?? 'COD order',
          sku: req.orderId,
          units: 1,
          selling_price: req.amount,
        },
      ],
      payment_method: 'COD',
      sub_total: req.amount,
      length: 10,
      breadth: 10,
      height: 10,
      weight: req.weightKg ?? 0.5,
    };

    try {
      const resp = await fetch('https://apiv2.shiprocket.in/v1/external/orders/create/adhoc', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });
      const json = (await resp.json()) as {
        order_id?: number;
        shipment_id?: number;
        awb_code?: string;
      };
      const cn = json.awb_code || (json.shipment_id ? String(json.shipment_id) : '');
      if (!cn) return { consignmentNumber: '', status: 'pending', raw: json };
      return {
        consignmentNumber: cn,
        trackingUrl: `https://shiprocket.co/tracking/${cn}`,
        status: 'booked',
        raw: json,
      };
    } catch (err) {
      return { consignmentNumber: '', status: 'failed', raw: { error: (err as Error).message } };
    }
  },

  async track(credentials, consignmentNumber): Promise<CourierTrackingEvent[]> {
    if (credentials.mode === 'mock' || !credentials.email) return mockTrackingEvents();
    const token = await getToken(credentials);
    if (!token) return [];
    try {
      const resp = await fetch(
        `https://apiv2.shiprocket.in/v1/external/courier/track/awb/${encodeURIComponent(consignmentNumber)}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      const json = (await resp.json()) as {
        tracking_data?: {
          shipment_track_activities?: Array<{
            date?: string;
            activity?: string;
            location?: string;
          }>;
        };
      };
      const events = json.tracking_data?.shipment_track_activities ?? [];
      return events.map((e) => ({
        status: e.activity ?? 'Update',
        location: e.location,
        occurredAt: e.date ?? new Date().toISOString(),
      }));
    } catch {
      return [];
    }
  },
};
