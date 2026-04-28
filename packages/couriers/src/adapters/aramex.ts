import type { CourierAdapter, CourierBookingResult, CourierTrackingEvent } from '../index.js';
import { mockBookingResult, mockTrackingEvents } from './_mock.js';

/**
 * Aramex (regional) adapter using the Shipping Services SOAP/JSON gateway.
 * Required credentials:
 *   - username, password, accountNumber, accountPin, accountEntity, accountCountryCode
 *   - mode (optional): 'mock' to bypass network calls
 * API docs: https://www.aramex.com/developers/aramex-apis
 */
export const aramexAdapter: CourierAdapter = {
  code: 'aramex',
  displayName: 'Aramex',
  regions: ['AE', 'SA', 'EG', 'JO', 'LB', 'QA', 'BH', 'OM', 'KW'],

  async book(credentials, req): Promise<CourierBookingResult> {
    const required = [
      'username',
      'password',
      'accountNumber',
      'accountPin',
      'accountEntity',
      'accountCountryCode',
    ];
    if (credentials.mode === 'mock' || required.some((k) => !credentials[k])) {
      return mockBookingResult(req, 'aramex');
    }

    const body = {
      ClientInfo: {
        UserName: credentials.username,
        Password: credentials.password,
        Version: 'v1.0',
        AccountNumber: credentials.accountNumber,
        AccountPin: credentials.accountPin,
        AccountEntity: credentials.accountEntity,
        AccountCountryCode: credentials.accountCountryCode,
        Source: 24,
      },
      Shipments: [
        {
          Reference1: req.orderId,
          Shipper: { Reference1: req.orderId },
          Consignee: {
            Reference1: req.orderId,
            PartyAddress: {
              Line1: req.addressLine1,
              Line2: req.addressLine2 ?? '',
              City: req.city,
              PostCode: req.postalCode ?? '',
              CountryCode: credentials.destinationCountry ?? 'AE',
            },
            Contact: { PersonName: req.customerName, PhoneNumber1: req.phone },
          },
          ShippingDateTime: new Date().toISOString(),
          DueDate: new Date(Date.now() + 7 * 86400e3).toISOString(),
          Details: {
            Dimensions: { Length: 10, Width: 10, Height: 10, Unit: 'CM' },
            ActualWeight: { Value: req.weightKg ?? 0.5, Unit: 'KG' },
            ProductGroup: 'DOM',
            ProductType: 'CDA',
            PaymentType: 'P',
            CashOnDeliveryAmount: { Value: req.amount, CurrencyCode: req.currency },
            DescriptionOfGoods: req.notes ?? 'COD order',
            CountryOfOrigin: credentials.destinationCountry ?? 'AE',
            NumberOfPieces: 1,
          },
        },
      ],
      LabelInfo: { ReportID: 9201, ReportType: 'URL' },
    };

    try {
      const resp = await fetch(
        'https://ws.aramex.net/ShippingAPI.V2/Shipping/Service_1_0.svc/json/CreateShipments',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        },
      );
      const json = (await resp.json()) as {
        Shipments?: Array<{ ID?: string; ShipmentLabel?: { LabelURL?: string } }>;
        HasErrors?: boolean;
      };
      const cn = json.Shipments?.[0]?.ID;
      if (!cn || json.HasErrors) {
        return { consignmentNumber: '', status: 'failed', raw: json };
      }
      return {
        consignmentNumber: cn,
        labelUrl: json.Shipments?.[0]?.ShipmentLabel?.LabelURL,
        trackingUrl: `https://www.aramex.com/track/results?ShipmentNumber=${cn}`,
        status: 'booked',
        raw: json,
      };
    } catch (err) {
      return {
        consignmentNumber: '',
        status: 'failed',
        raw: { error: (err as Error).message },
      };
    }
  },

  async track(credentials, consignmentNumber): Promise<CourierTrackingEvent[]> {
    if (credentials.mode === 'mock' || !credentials.username) return mockTrackingEvents();
    try {
      const resp = await fetch(
        'https://ws.aramex.net/ShippingAPI.V2/Tracking/Service_1_0.svc/json/TrackShipments',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ClientInfo: {
              UserName: credentials.username,
              Password: credentials.password,
              Version: 'v1.0',
              AccountNumber: credentials.accountNumber,
              AccountPin: credentials.accountPin,
              AccountEntity: credentials.accountEntity,
              AccountCountryCode: credentials.accountCountryCode,
              Source: 24,
            },
            Shipments: [consignmentNumber],
          }),
        },
      );
      const json = (await resp.json()) as {
        TrackingResults?: Array<{
          Key?: string;
          Value?: Array<{
            UpdateDescription?: string;
            UpdateLocation?: string;
            UpdateDateTime?: string;
          }>;
        }>;
      };
      const entries = json.TrackingResults?.[0]?.Value ?? [];
      return entries.map((e) => ({
        status: e.UpdateDescription ?? 'Update',
        location: e.UpdateLocation,
        occurredAt: e.UpdateDateTime ?? new Date().toISOString(),
      }));
    } catch {
      return [];
    }
  },
};
