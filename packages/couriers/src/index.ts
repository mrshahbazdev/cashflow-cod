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

export { postexAdapter } from './adapters/postex.js';
export { leopardsAdapter } from './adapters/leopards.js';
export { tcsAdapter } from './adapters/tcs.js';
export { traxAdapter } from './adapters/trax.js';
export { blueexAdapter } from './adapters/blueex.js';
export { aramexAdapter } from './adapters/aramex.js';
export { shiprocketAdapter } from './adapters/shiprocket.js';
export { delhiveryAdapter } from './adapters/delhivery.js';
export { bluedartAdapter } from './adapters/bluedart.js';
export { dhlAdapter } from './adapters/dhl.js';
export { fedexAdapter } from './adapters/fedex.js';
export { sendcloudAdapter } from './adapters/sendcloud.js';

import { postexAdapter } from './adapters/postex.js';
import { leopardsAdapter } from './adapters/leopards.js';
import { tcsAdapter } from './adapters/tcs.js';
import { traxAdapter } from './adapters/trax.js';
import { blueexAdapter } from './adapters/blueex.js';
import { aramexAdapter } from './adapters/aramex.js';
import { shiprocketAdapter } from './adapters/shiprocket.js';
import { delhiveryAdapter } from './adapters/delhivery.js';
import { bluedartAdapter } from './adapters/bluedart.js';
import { dhlAdapter } from './adapters/dhl.js';
import { fedexAdapter } from './adapters/fedex.js';
import { sendcloudAdapter } from './adapters/sendcloud.js';

courierRegistry.register(postexAdapter);
courierRegistry.register(leopardsAdapter);
courierRegistry.register(tcsAdapter);
courierRegistry.register(traxAdapter);
courierRegistry.register(blueexAdapter);
courierRegistry.register(aramexAdapter);
courierRegistry.register(shiprocketAdapter);
courierRegistry.register(delhiveryAdapter);
courierRegistry.register(bluedartAdapter);
courierRegistry.register(dhlAdapter);
courierRegistry.register(fedexAdapter);
courierRegistry.register(sendcloudAdapter);
