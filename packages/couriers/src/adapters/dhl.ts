import type { CourierAdapter, CourierBookingResult, CourierTrackingEvent } from '../index.js';
import { mockBookingResult, mockTrackingEvents } from './_mock.js';

/**
 * DHL Express adapter using the MyDHL API (v2.0).
 * Required credentials:
 *   - apiKey, apiSecret (Basic auth)
 *   - accountNumber
 *   - shipperCountryCode, shipperPostalCode, shipperCityName, shipperAddressLine1
 * API docs: https://developer.dhl.com/api-reference/dhl-express-mydhl-api
 */
function basicAuthHeader(creds: Record<string, string>): string {
  const raw = `${creds.apiKey}:${creds.apiSecret}`;
  if (typeof Buffer !== 'undefined') return `Basic ${Buffer.from(raw).toString('base64')}`;
  return `Basic ${btoa(raw)}`;
}

export const dhlAdapter: CourierAdapter = {
  code: 'dhl',
  displayName: 'DHL Express',
  regions: ['*'],

  async book(credentials, req): Promise<CourierBookingResult> {
    const required = ['apiKey', 'apiSecret', 'accountNumber'];
    if (credentials.mode === 'mock' || required.some((k) => !credentials[k])) {
      return mockBookingResult(req, 'dhl');
    }

    const today = new Date(Date.now() + 86400e3).toISOString().slice(0, 10);
    const body = {
      plannedShippingDateAndTime: `${today}T10:00:00 GMT+00:00`,
      pickup: { isRequested: false },
      productCode: credentials.productCode || 'P',
      accounts: [{ typeCode: 'shipper', number: credentials.accountNumber }],
      customerDetails: {
        shipperDetails: {
          postalAddress: {
            cityName: credentials.shipperCityName ?? 'Karachi',
            countryCode: credentials.shipperCountryCode ?? 'PK',
            postalCode: credentials.shipperPostalCode ?? '74000',
            addressLine1: credentials.shipperAddressLine1 ?? 'Pickup',
          },
          contactInformation: {
            phone: credentials.shipperPhone ?? '0000000000',
            companyName: credentials.shipperCompany ?? 'Cashflow Merchant',
            fullName: credentials.shipperContact ?? 'Cashflow',
          },
        },
        receiverDetails: {
          postalAddress: {
            cityName: req.city,
            countryCode: credentials.destinationCountry ?? 'AE',
            postalCode: req.postalCode ?? '00000',
            addressLine1: req.addressLine1,
            addressLine2: req.addressLine2 ?? '',
          },
          contactInformation: {
            phone: req.phone,
            companyName: req.customerName,
            fullName: req.customerName,
          },
        },
      },
      content: {
        packages: [
          {
            weight: req.weightKg ?? 0.5,
            dimensions: { length: 10, width: 10, height: 10 },
          },
        ],
        isCustomsDeclarable: false,
        description: req.notes ?? 'COD order',
        incoterm: 'DAP',
        unitOfMeasurement: 'metric',
      },
    };

    try {
      const resp = await fetch('https://express.api.dhl.com/mydhlapi/shipments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: basicAuthHeader(credentials),
          'Message-Reference': req.orderId.padStart(28, '0').slice(0, 36),
        },
        body: JSON.stringify(body),
      });
      const json = (await resp.json()) as {
        shipmentTrackingNumber?: string;
        documents?: Array<{ content?: string; typeCode?: string }>;
      };
      const cn = json.shipmentTrackingNumber;
      if (!cn) return { consignmentNumber: '', status: 'failed', raw: json };
      const label = json.documents?.find((d) => d.typeCode === 'label')?.content;
      return {
        consignmentNumber: cn,
        labelUrl: label,
        trackingUrl: `https://www.dhl.com/global-en/home/tracking/tracking-express.html?submit=1&tracking-id=${cn}`,
        status: 'booked',
        raw: json,
      };
    } catch (err) {
      return { consignmentNumber: '', status: 'failed', raw: { error: (err as Error).message } };
    }
  },

  async track(credentials, consignmentNumber): Promise<CourierTrackingEvent[]> {
    if (credentials.mode === 'mock' || !credentials.apiKey) return mockTrackingEvents();
    try {
      const resp = await fetch(
        `https://api-eu.dhl.com/track/shipments?trackingNumber=${encodeURIComponent(consignmentNumber)}`,
        { headers: { 'DHL-API-Key': credentials.apiKey } },
      );
      const json = (await resp.json()) as {
        shipments?: Array<{
          events?: Array<{
            description?: string;
            location?: { address?: { addressLocality?: string } };
            timestamp?: string;
          }>;
        }>;
      };
      const events = json.shipments?.[0]?.events ?? [];
      return events.map((e) => ({
        status: e.description ?? 'Update',
        location: e.location?.address?.addressLocality,
        occurredAt: e.timestamp ?? new Date().toISOString(),
      }));
    } catch {
      return [];
    }
  },
};
