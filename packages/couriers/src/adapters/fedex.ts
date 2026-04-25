import type { CourierAdapter, CourierBookingResult, CourierTrackingEvent } from '../index.js';
import { mockBookingResult, mockTrackingEvents } from './_mock.js';

/**
 * FedEx adapter using the OAuth2 + Ship REST APIs.
 * Required credentials:
 *   - apiKey, apiSecret (OAuth client credentials)
 *   - accountNumber
 * API docs: https://developer.fedex.com
 *
 * In production a real implementation should refresh the bearer token,
 * include shipper details, and parse responses fully. This adapter exposes
 * the booking shape and falls back to a deterministic mock when credentials
 * are missing or `mode=mock`.
 */
async function getToken(creds: Record<string, string>): Promise<string | null> {
  if (!creds.apiKey || !creds.apiSecret) return null;
  try {
    const body = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: creds.apiKey,
      client_secret: creds.apiSecret,
    });
    const resp = await fetch('https://apis.fedex.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
    const json = (await resp.json()) as { access_token?: string };
    return json.access_token ?? null;
  } catch {
    return null;
  }
}

export const fedexAdapter: CourierAdapter = {
  code: 'fedex',
  displayName: 'FedEx',
  regions: ['*'],

  async book(credentials, req): Promise<CourierBookingResult> {
    if (credentials.mode === 'mock' || !credentials.apiKey || !credentials.accountNumber) {
      return mockBookingResult(req, 'fedex');
    }
    const token = await getToken(credentials);
    if (!token) return { consignmentNumber: '', status: 'failed', raw: { error: 'auth_failed' } };

    try {
      const resp = await fetch('https://apis.fedex.com/ship/v1/shipments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          accountNumber: { value: credentials.accountNumber },
          requestedShipment: {
            shipper: {
              contact: { personName: 'Cashflow' },
              address: { countryCode: credentials.shipperCountryCode ?? 'PK' },
            },
            recipients: [
              {
                contact: { personName: req.customerName, phoneNumber: req.phone },
                address: {
                  streetLines: [req.addressLine1, req.addressLine2 ?? ''].filter(Boolean),
                  city: req.city,
                  postalCode: req.postalCode ?? '',
                  countryCode: credentials.destinationCountry ?? 'AE',
                },
              },
            ],
            pickupType: 'USE_SCHEDULED_PICKUP',
            serviceType: credentials.serviceType ?? 'INTERNATIONAL_PRIORITY',
            packagingType: 'YOUR_PACKAGING',
            shippingChargesPayment: { paymentType: 'SENDER' },
            requestedPackageLineItems: [
              {
                weight: { units: 'KG', value: req.weightKg ?? 0.5 },
                customerReferences: [
                  { customerReferenceType: 'CUSTOMER_REFERENCE', value: req.orderId },
                ],
              },
            ],
            labelSpecification: { imageType: 'PDF', labelStockType: 'PAPER_85X11_TOP_HALF_LABEL' },
          },
        }),
      });
      const json = (await resp.json()) as {
        output?: {
          transactionShipments?: Array<{
            masterTrackingNumber?: string;
            pieceResponses?: Array<{ packageDocuments?: Array<{ url?: string }> }>;
          }>;
        };
      };
      const cn = json.output?.transactionShipments?.[0]?.masterTrackingNumber;
      if (!cn) return { consignmentNumber: '', status: 'failed', raw: json };
      return {
        consignmentNumber: cn,
        labelUrl:
          json.output?.transactionShipments?.[0]?.pieceResponses?.[0]?.packageDocuments?.[0]?.url,
        trackingUrl: `https://www.fedex.com/fedextrack/?trknbr=${cn}`,
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
