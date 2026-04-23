import type { CourierAdapter, CourierBookingResult, CourierTrackingEvent } from '../index.js';

/**
 * Leopards Courier (Pakistan). API: https://merchantapi.leopardscourier.com
 * Credentials: apiKey, apiPassword. Mock mode when missing or credentials.mode === 'mock'.
 */
export const leopardsAdapter: CourierAdapter = {
  code: 'leopards',
  displayName: 'Leopards Courier',
  regions: ['PK'],

  async book(credentials, req): Promise<CourierBookingResult> {
    const { apiKey, apiPassword } = credentials;
    if (!apiKey || !apiPassword || credentials.mode === 'mock') {
      const cn = `LEO-${req.orderId.slice(-6).toUpperCase()}`;
      return {
        consignmentNumber: cn,
        trackingUrl: `https://www.leopardscourier.com/leopards-tracking?code=${cn}`,
        status: 'booked',
        raw: { mock: true },
      };
    }

    const body = new URLSearchParams({
      api_key: apiKey,
      api_password: apiPassword,
      booked_packet_weight: String(Math.round((req.weightKg ?? 0.5) * 1000)),
      booked_packet_no_piece: '1',
      booked_packet_collect_amount: String(req.amount),
      booked_packet_order_id: req.orderId,
      origin_city: credentials.originCity || '202',
      destination_city: credentials.destinationCity || '202',
      shipment_name_eng: req.customerName,
      shipment_email: '',
      shipment_phone: req.phone,
      shipment_address: [req.addressLine1, req.addressLine2, req.city].filter(Boolean).join(', '),
      consignment_name_eng: req.customerName,
      consignment_email: '',
      consignment_phone: req.phone,
      consignment_phone_two: '',
      consignment_phone_three: '',
      consignment_address: [req.addressLine1, req.addressLine2, req.city].filter(Boolean).join(', '),
      special_instructions: req.notes || '',
    });

    try {
      const resp = await fetch('https://merchantapi.leopardscourier.com/api/bookPacket/format/json/', {
        method: 'POST',
        body,
      });
      const json = (await resp.json()) as { status?: number; track_number?: string; error?: string };
      if (json.status !== 1 || !json.track_number) {
        return { consignmentNumber: '', status: 'failed', raw: json };
      }
      return {
        consignmentNumber: json.track_number,
        trackingUrl: `https://www.leopardscourier.com/leopards-tracking?code=${json.track_number}`,
        status: 'booked',
        raw: json,
      };
    } catch (err) {
      return { consignmentNumber: '', status: 'failed', raw: { error: (err as Error).message } };
    }
  },

  async track(credentials, consignmentNumber): Promise<CourierTrackingEvent[]> {
    const { apiKey, apiPassword } = credentials;
    if (!apiKey || !apiPassword || credentials.mode === 'mock') {
      return [{ status: 'Booked', occurredAt: new Date().toISOString() }];
    }
    try {
      const body = new URLSearchParams({
        api_key: apiKey,
        api_password: apiPassword,
        track_numbers: consignmentNumber,
      });
      const resp = await fetch(
        'https://merchantapi.leopardscourier.com/api/trackBookedPacket/format/json/',
        { method: 'POST', body },
      );
      const json = (await resp.json()) as {
        packet_list?: Array<{ booked_packet_status: string; booking_date: string }>;
      };
      return (json.packet_list ?? []).map((p) => ({
        status: p.booked_packet_status,
        occurredAt: p.booking_date,
      }));
    } catch {
      return [];
    }
  },
};
