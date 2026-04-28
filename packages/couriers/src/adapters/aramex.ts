import type { CourierAdapter, CourierBookingRequest, CourierBookingResult, CourierTrackingEvent } from '../index.js';

/**
 * Aramex (MENA + global) adapter.
 * API docs: https://www.aramex.com/developers
 * Credentials: clientInfo (username, password, version, accountNumber, accountPin, accountEntity, accountCountryCode).
 * Falls back to deterministic mock when credentials missing or mode=mock.
 */
export const aramexAdapter: CourierAdapter = {
  code: 'aramex',
  displayName: 'Aramex',
  regions: ['AE', 'SA', 'EG', 'JO', 'KW', 'QA', 'BH', 'OM', 'GLOBAL'],

  async book(credentials, req): Promise<CourierBookingResult> {
    const missing =
      !credentials.userName ||
      !credentials.password ||
      !credentials.accountNumber ||
      !credentials.accountPin;
    if (credentials.mode === 'mock' || missing) {
      return mockResult(req, 'ARX');
    }
    try {
      const body = {
        ClientInfo: buildClientInfo(credentials),
        LabelInfo: { ReportID: 9201, ReportType: 'URL' },
        Shipments: [
          {
            Reference1: req.orderId,
            Shipper: {
              Reference1: credentials.accountNumber,
              AccountNumber: credentials.accountNumber,
              PartyAddress: {
                Line1: credentials.shipperAddress || 'Shipper Address',
                City: credentials.shipperCity || 'Dubai',
                CountryCode: credentials.accountCountryCode || 'AE',
              },
              Contact: {
                PersonName: credentials.shipperName || 'Cashflow COD',
                CompanyName: credentials.shipperCompany || 'Cashflow COD',
                PhoneNumber1: credentials.shipperPhone || '000',
                CellPhone: credentials.shipperPhone || '000',
                EmailAddress: credentials.shipperEmail || 'shipper@example.com',
              },
            },
            Consignee: {
              PartyAddress: {
                Line1: req.addressLine1,
                Line2: req.addressLine2 || '',
                City: req.city,
                PostCode: req.postalCode || '',
                CountryCode: credentials.destinationCountryCode || 'AE',
              },
              Contact: {
                PersonName: req.customerName,
                PhoneNumber1: req.phone,
                CellPhone: req.phone,
                EmailAddress: 'buyer@example.com',
              },
            },
            Details: {
              ActualWeight: { Unit: 'KG', Value: req.weightKg ?? 0.5 },
              ProductGroup: 'DOM',
              ProductType: 'CDS',
              PaymentType: 'P',
              NumberOfPieces: 1,
              DescriptionOfGoods: req.notes || 'COD order',
              GoodsOriginCountry: credentials.accountCountryCode || 'AE',
              CashOnDeliveryAmount: { CurrencyCode: req.currency, Value: req.amount },
            },
          },
        ],
        Transaction: { Reference1: req.orderId },
      };

      const resp = await fetch(
        'https://ws.aramex.net/ShippingAPI.V2/Shipping/Service_1_0.svc/json/CreateShipments',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        },
      );
      const json = (await resp.json()) as {
        HasErrors?: boolean;
        Shipments?: Array<{ ID?: string; HasErrors?: boolean; ShipmentLabel?: { LabelURL?: string } }>;
      };
      const shipment = json.Shipments?.[0];
      if (json.HasErrors || !shipment?.ID) {
        return { consignmentNumber: '', status: 'failed', raw: json };
      }
      return {
        consignmentNumber: shipment.ID,
        labelUrl: shipment.ShipmentLabel?.LabelURL,
        trackingUrl: `https://www.aramex.com/track/results?ShipmentNumber=${shipment.ID}`,
        status: 'booked',
        raw: json,
      };
    } catch (err) {
      return { consignmentNumber: '', status: 'failed', raw: { error: (err as Error).message } };
    }
  },

  async track(credentials, consignmentNumber): Promise<CourierTrackingEvent[]> {
    const missing = !credentials.userName || !credentials.password;
    if (credentials.mode === 'mock' || missing) {
      return [
        { status: 'Booked', occurredAt: new Date().toISOString() },
        { status: 'In Transit', occurredAt: new Date(Date.now() - 3600e3).toISOString() },
      ];
    }
    try {
      const body = {
        ClientInfo: buildClientInfo(credentials),
        Shipments: [consignmentNumber],
        GetLastTrackingUpdateOnly: false,
      };
      const resp = await fetch(
        'https://ws.aramex.net/ShippingAPI.V2/Tracking/Service_1_0.svc/json/TrackShipments',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        },
      );
      const json = (await resp.json()) as {
        TrackingResults?: Array<{
          Value?: Array<{ UpdateDateTime: string; UpdateDescription: string; UpdateLocation?: string }>;
        }>;
      };
      const events = json.TrackingResults?.[0]?.Value ?? [];
      return events.map((e) => ({
        status: e.UpdateDescription,
        occurredAt: e.UpdateDateTime,
        location: e.UpdateLocation,
      }));
    } catch {
      return [];
    }
  },
};

function buildClientInfo(credentials: Record<string, string>): Record<string, string> {
  return {
    UserName: credentials.userName!,
    Password: credentials.password!,
    Version: credentials.version || 'v1.0',
    AccountNumber: credentials.accountNumber!,
    AccountPin: credentials.accountPin!,
    AccountEntity: credentials.accountEntity || 'DXB',
    AccountCountryCode: credentials.accountCountryCode || 'AE',
    Source: credentials.source || '24',
  };
}

function mockResult(req: CourierBookingRequest, prefix: string): CourierBookingResult {
  const cn = `${prefix}-${req.orderId.slice(-6).toUpperCase()}`;
  return {
    consignmentNumber: cn,
    trackingUrl: `https://www.aramex.com/track/results?ShipmentNumber=${cn}`,
    status: 'booked',
    raw: { mock: true },
  };
}
