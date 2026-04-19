import type { CourierCode } from '@cashflow-cod/shared-types';

export interface CourierBookingRequest {
  orderId: string;
  customerName: string;
  phone: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  postalCode?: string;
  amount: number;
  currency: string;
  weightKg?: number;
  notes?: string;
}

export interface CourierBookingResult {
  consignmentNumber: string;
  labelUrl?: string;
  trackingUrl?: string;
  status: 'booked' | 'pending' | 'failed';
  raw?: unknown;
}

export interface CourierTrackingEvent {
  status: string;
  description?: string;
  location?: string;
  occurredAt: string;
}

export interface CourierAdapter {
  readonly code: CourierCode;
  readonly displayName: string;
  readonly regions: string[];

  book(
    credentials: Record<string, string>,
    req: CourierBookingRequest,
  ): Promise<CourierBookingResult>;

  track(
    credentials: Record<string, string>,
    consignmentNumber: string,
  ): Promise<CourierTrackingEvent[]>;
}

export class CourierRegistry {
  private adapters = new Map<CourierCode, CourierAdapter>();

  register(adapter: CourierAdapter): void {
    this.adapters.set(adapter.code, adapter);
  }

  get(code: CourierCode): CourierAdapter | undefined {
    return this.adapters.get(code);
  }

  list(): CourierAdapter[] {
    return Array.from(this.adapters.values());
  }
}

export const courierRegistry = new CourierRegistry();
