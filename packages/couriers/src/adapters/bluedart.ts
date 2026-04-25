import type { CourierAdapter, CourierBookingResult, CourierTrackingEvent } from '../index.js';
import { mockBookingResult, mockTrackingEvents } from './_mock.js';

/**
 * BlueDart (India) adapter. BlueDart's Waybill API still uses SOAP with
 * customer-specific endpoints, so the adapter primarily exposes the booking
 * shape and falls back to a deterministic mock for tests / sandbox use.
 * Required credentials when wired against BlueDart in production:
 *   - apiKey, customerCode, areaCode
 */
export const bluedartAdapter: CourierAdapter = {
  code: 'bluedart',
  displayName: 'BlueDart',
  regions: ['IN'],

  async book(credentials, req): Promise<CourierBookingResult> {
    if (credentials.mode === 'mock' || !credentials.apiKey || !credentials.customerCode) {
      return mockBookingResult(req, 'bluedart');
    }
    try {
      const resp = await fetch(
        'https://apigateway.bluedart.com/in/transportation/waybill/v1/GenerateWayBill',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${credentials.apiKey}`,
          },
          body: JSON.stringify({
            Request: {
              Consignee: {
                ConsigneeName: req.customerName,
                ConsigneeAddress1: req.addressLine1,
                ConsigneeAddress2: req.addressLine2 ?? '',
                ConsigneePincode: req.postalCode ?? '',
                ConsigneeMobile: req.phone,
              },
              Services: {
                ProductCode: 'A',
                ProductFor: 'P',
                CollectableAmount: req.amount,
                DeclaredValue: req.amount,
                PieceCount: 1,
                ActualWeight: req.weightKg ?? 0.5,
                CreditReferenceNo: req.orderId,
                CustomerCode: credentials.customerCode,
                AreaCode: credentials.areaCode ?? '',
              },
            },
          }),
        },
      );
      const json = (await resp.json()) as {
        AWBNo?: string;
        AWBPrintContent?: string;
      };
      const cn = json.AWBNo;
      if (!cn) return { consignmentNumber: '', status: 'failed', raw: json };
      return {
        consignmentNumber: cn,
        labelUrl: json.AWBPrintContent,
        trackingUrl: `https://www.bluedart.com/tracking?awb=${cn}`,
        status: 'booked',
        raw: json,
      };
    } catch (err) {
      return { consignmentNumber: '', status: 'failed', raw: { error: (err as Error).message } };
    }
  },

  async track(_credentials, _consignmentNumber): Promise<CourierTrackingEvent[]> {
    return mockTrackingEvents();
  },
};
