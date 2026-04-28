import type { CourierAdapter, CourierBookingRequest, CourierBookingResult, CourierTrackingEvent } from '../index.js';

/**
 * DHL Express adapter.
 * API docs: https://developer.dhl.com/api-reference/dhl-express-mydhl-api
 * Credentials: apiKey, apiSecret, accountNumber, shipperName, shipperCity, shipperCountryCode, shipperPostal.
 * Falls back to deterministic mock when credentials missing or mode=mock.
 */
export const dhlAdapter: CourierAdapter = {
  code: 'dhl',
  displayName: 'DHL Express',
  regions: ['GLOBAL'],

  async book(credentials, req): Promise<CourierBookingResult> {
    const missing = !credentials.apiKey || !credentials.apiSecret || !credentials.accountNumber;
    if (credentials.mode === 'mock' || missing) {
      return mockResult(req, 'DHL');
    }
    try {
      const auth = Buffer.from(`${credentials.apiKey}:${credentials.apiSecret}`).toString('base64');
      const body = {
        plannedShippingDateAndTime: new Date().toISOString().slice(0, 19) + ' GMT+00:00',
        pickup: { isRequested: false },
        productCode: 'N',
        accounts: [{ typeCode: 'shipper', number: credentials.accountNumber }],
        customerDetails: {
          shipperDetails: {
            postalAddress: {
              postalCode: credentials.shipperPostal || '00000',
              cityName: credentials.shipperCity || 'Origin',
              countryCode: credentials.shipperCountryCode || 'US',
              addressLine1: credentials.shipperAddress || 'Origin Address',
            },
            contactInformation: {
              phone: credentials.shipperPhone || '000',
              companyName: credentials.shipperCompany || 'Cashflow COD',
              fullName: credentials.shipperName || 'Cashflow COD',
            },
          },
          receiverDetails: {
            postalAddress: {
              postalCode: req.postalCode || '00000',
              cityName: req.city,
              countryCode: credentials.destinationCountryCode || 'US',
              addressLine1: req.addressLine1,
              addressLine2: req.addressLine2 || '',
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
          declaredValue: req.amount,
          declaredValueCurrency: req.currency,
          description: req.notes || 'COD order',
          incoterm: 'DAP',
          unitOfMeasurement: 'metric',
        },
      };
      const resp = await fetch('https://express.api.dhl.com/mydhlapi/shipments', {
        method: 'POST',
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });
      const json = (await resp.json()) as {
        shipmentTrackingNumber?: string;
        documents?: Array<{ content?: string; typeCode?: string }>;
      };
      if (!json.shipmentTrackingNumber) {
        return { consignmentNumber: '', status: 'failed', raw: json };
      }
      return {
        consignmentNumber: json.shipmentTrackingNumber,
        trackingUrl: `https://www.dhl.com/en/express/tracking.html?AWB=${json.shipmentTrackingNumber}`,
        status: 'booked',
        raw: json,
      };
    } catch (err) {
      return { consignmentNumber: '', status: 'failed', raw: { error: (err as Error).message } };
    }
  },

  async track(credentials, consignmentNumber): Promise<CourierTrackingEvent[]> {
    if (credentials.mode === 'mock' || !credentials.apiKey) {
      return [
        { status: 'Booked', occurredAt: new Date().toISOString() },
        { status: 'In Transit', occurredAt: new Date(Date.now() - 3600e3).toISOString() },
      ];
    }
    try {
      const resp = await fetch(
        `https://api-eu.dhl.com/track/shipments?trackingNumber=${consignmentNumber}`,
        {
          headers: { 'DHL-API-Key': credentials.apiKey },
        },
      );
      const json = (await resp.json()) as {
        shipments?: Array<{ events?: Array<{ timestamp: string; description: string; location?: { address?: { addressLocality?: string } } }> }>;
      };
      const events = json.shipments?.[0]?.events ?? [];
      return events.map((e) => ({
        status: e.description,
        occurredAt: e.timestamp,
        location: e.location?.address?.addressLocality,
      }));
    } catch {
      return [];
    }
  },
};

function mockResult(req: CourierBookingRequest, prefix: string): CourierBookingResult {
  const cn = `${prefix}-${req.orderId.slice(-6).toUpperCase()}`;
  return {
    consignmentNumber: cn,
    trackingUrl: `https://www.dhl.com/en/express/tracking.html?AWB=${cn}`,
    status: 'booked',
    raw: { mock: true },
  };
}
