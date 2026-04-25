import type {
  CourierBookingRequest,
  CourierBookingResult,
  CourierTrackingEvent,
} from '../index.js';

export function mockBookingResult(
  req: CourierBookingRequest,
  prefix: string,
): CourierBookingResult {
  const cn = `${prefix.toUpperCase()}-${req.orderId.slice(-6).toUpperCase()}`;
  return {
    consignmentNumber: cn,
    trackingUrl: `https://example.com/track/${cn}`,
    status: 'booked',
    raw: { mock: true },
  };
}

export function mockTrackingEvents(): CourierTrackingEvent[] {
  return [
    { status: 'Booked', occurredAt: new Date().toISOString() },
    { status: 'In Transit', occurredAt: new Date(Date.now() - 3600e3).toISOString() },
  ];
}
