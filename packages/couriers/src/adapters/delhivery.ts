import type { CourierAdapter, CourierBookingResult, CourierTrackingEvent } from '../index.js';
import { mockBookingResult, mockTrackingEvents } from './_mock.js';

/**
 * Delhivery (India) adapter using the public B2C v1 API.
 * Required credentials:
 *   - apiToken (Delhivery dashboard → API)
 *   - clientName, pickupName
 * API docs: https://www.delhivery.com/api-docs
 */
export const delhiveryAdapter: CourierAdapter = {
  code: 'delhivery',
  displayName: 'Delhivery',
  regions: ['IN'],

  async book(credentials, req): Promise<CourierBookingResult> {
    if (credentials.mode === 'mock' || !credentials.apiToken || !credentials.pickupName) {
      return mockBookingResult(req, 'delhivery');
    }

    const shipment = {
      name: req.customerName,
      add: req.addressLine1,
      add2: req.addressLine2 ?? '',
      city: req.city,
      pin: req.postalCode ?? '',
      state: credentials.billingState ?? '',
      country: 'India',
      phone: req.phone,
      order: req.orderId,
      payment_mode: 'COD',
      cod_amount: req.amount,
      total_amount: req.amount,
      products_desc: req.notes ?? 'COD order',
      hsn_code: '',
      quantity: 1,
      seller_add: '',
      seller_name: credentials.clientName ?? '',
    };

    const formBody =
      'format=json&data=' +
      encodeURIComponent(
        JSON.stringify({
          shipments: [shipment],
          pickup_location: { name: credentials.pickupName },
        }),
      );

    try {
      const resp = await fetch('https://track.delhivery.com/api/cmu/create.json', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Token ${credentials.apiToken}`,
        },
        body: formBody,
      });
      const json = (await resp.json()) as {
        success?: boolean;
        packages?: Array<{ waybill?: string; refnum?: string; status?: string }>;
      };
      const cn = json.packages?.[0]?.waybill;
      if (!cn) return { consignmentNumber: '', status: 'failed', raw: json };
      return {
        consignmentNumber: cn,
        trackingUrl: `https://www.delhivery.com/track-v2/package/${cn}`,
        status: 'booked',
        raw: json,
      };
    } catch (err) {
      return { consignmentNumber: '', status: 'failed', raw: { error: (err as Error).message } };
    }
  },

  async track(credentials, consignmentNumber): Promise<CourierTrackingEvent[]> {
    if (credentials.mode === 'mock' || !credentials.apiToken) return mockTrackingEvents();
    try {
      const resp = await fetch(
        `https://track.delhivery.com/api/v1/packages/json/?waybill=${encodeURIComponent(consignmentNumber)}`,
        { headers: { Authorization: `Token ${credentials.apiToken}` } },
      );
      const json = (await resp.json()) as {
        ShipmentData?: Array<{
          Shipment?: {
            Scans?: Array<{
              ScanDetail?: { Scan?: string; ScanDateTime?: string; ScannedLocation?: string };
            }>;
          };
        }>;
      };
      const scans = json.ShipmentData?.[0]?.Shipment?.Scans ?? [];
      return scans.map((s) => ({
        status: s.ScanDetail?.Scan ?? 'Update',
        location: s.ScanDetail?.ScannedLocation,
        occurredAt: s.ScanDetail?.ScanDateTime ?? new Date().toISOString(),
      }));
    } catch {
      return [];
    }
  },
};
