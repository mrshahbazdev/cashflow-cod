import type { CourierAdapter, CourierBookingResult, CourierTrackingEvent } from '../index.js';
import { mockBookingResult, mockTrackingEvents } from './_mock.js';

/**
 * Sendcloud adapter using the v2 Public API.
 * Sendcloud is a courier aggregator covering 80+ carriers across EU + UK.
 * Required credentials:
 *   - publicKey, secretKey (HTTP Basic auth)
 *   - shippingMethodId (numeric, choose from /shipping_methods endpoint)
 * API docs: https://api.sendcloud.dev
 */
function basicAuth(creds: Record<string, string>): string {
  const raw = `${creds.publicKey}:${creds.secretKey}`;
  if (typeof Buffer !== 'undefined') return `Basic ${Buffer.from(raw).toString('base64')}`;
  return `Basic ${btoa(raw)}`;
}

export const sendcloudAdapter: CourierAdapter = {
  code: 'sendcloud',
  displayName: 'Sendcloud',
  regions: ['EU', 'UK'],

  async book(credentials, req): Promise<CourierBookingResult> {
    if (credentials.mode === 'mock' || !credentials.publicKey || !credentials.secretKey) {
      return mockBookingResult(req, 'sendcloud');
    }
    try {
      const resp = await fetch('https://panel.sendcloud.sc/api/v2/parcels', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: basicAuth(credentials),
        },
        body: JSON.stringify({
          parcel: {
            name: req.customerName,
            address: req.addressLine1,
            address_2: req.addressLine2 ?? '',
            city: req.city,
            postal_code: req.postalCode ?? '',
            country: credentials.destinationCountry ?? 'NL',
            telephone: req.phone,
            request_label: true,
            order_number: req.orderId,
            shipment: {
              id: credentials.shippingMethodId ? Number(credentials.shippingMethodId) : 8,
            },
            weight: req.weightKg ?? 0.5,
            total_order_value: String(req.amount),
            total_order_value_currency: req.currency,
            sender_address: credentials.senderAddressId
              ? Number(credentials.senderAddressId)
              : undefined,
          },
        }),
      });
      const json = (await resp.json()) as {
        parcel?: {
          tracking_number?: string;
          tracking_url?: string;
          label?: { label_printer?: string };
        };
      };
      const cn = json.parcel?.tracking_number;
      if (!cn) return { consignmentNumber: '', status: 'failed', raw: json };
      return {
        consignmentNumber: cn,
        labelUrl: json.parcel?.label?.label_printer,
        trackingUrl: json.parcel?.tracking_url,
        status: 'booked',
        raw: json,
      };
    } catch (err) {
      return { consignmentNumber: '', status: 'failed', raw: { error: (err as Error).message } };
    }
  },

  async track(_credentials, consignmentNumber): Promise<CourierTrackingEvent[]> {
    if (!consignmentNumber) return [];
    return mockTrackingEvents();
  },
};
