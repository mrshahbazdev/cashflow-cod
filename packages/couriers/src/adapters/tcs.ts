import type { CourierAdapter, CourierBookingResult, CourierTrackingEvent } from '../index.js';

/**
 * TCS (Pakistan). API: https://api.tcscourier.com
 * Credentials: clientId, clientSecret (basic auth). Mock mode when missing.
 */
export const tcsAdapter: CourierAdapter = {
  code: 'tcs',
  displayName: 'TCS',
  regions: ['PK'],

  async book(credentials, req): Promise<CourierBookingResult> {
    const { clientId, clientSecret } = credentials;
    if (!clientId || !clientSecret || credentials.mode === 'mock') {
      const cn = `TCS-${req.orderId.slice(-6).toUpperCase()}`;
      return {
        consignmentNumber: cn,
        trackingUrl: `https://www.tcsexpress.com/track/${cn}`,
        status: 'booked',
        raw: { mock: true },
      };
    }
    try {
      const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
      const resp = await fetch('https://api.tcscourier.com/v2/bookings/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Basic ${auth}` },
        body: JSON.stringify({
          userName: credentials.userName,
          password: credentials.password,
          costCenterCode: credentials.costCenterCode,
          consigneeName: req.customerName,
          consigneeAddress: [req.addressLine1, req.addressLine2].filter(Boolean).join(' '),
          consigneeMobNo: req.phone,
          consigneeEmail: '',
          destinationCityName: req.city,
          weight: req.weightKg ?? 0.5,
          pieces: 1,
          codAmount: req.amount,
          customerReferenceNo: req.orderId,
          services: 'O',
          productDetails: req.notes || 'Cashflow COD order',
        }),
      });
      const json = (await resp.json()) as { returnStatus?: string; cnNumber?: string };
      if (json.returnStatus !== 'Success' || !json.cnNumber) {
        return { consignmentNumber: '', status: 'failed', raw: json };
      }
      return {
        consignmentNumber: json.cnNumber,
        trackingUrl: `https://www.tcsexpress.com/track/${json.cnNumber}`,
        status: 'booked',
        raw: json,
      };
    } catch (err) {
      return { consignmentNumber: '', status: 'failed', raw: { error: (err as Error).message } };
    }
  },

  async track(_credentials, consignmentNumber): Promise<CourierTrackingEvent[]> {
    return [
      { status: 'Booked', occurredAt: new Date().toISOString(), description: `CN ${consignmentNumber}` },
    ];
  },
};
