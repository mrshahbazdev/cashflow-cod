export type Plan = 'FREE' | 'STARTER' | 'PRO' | 'SCALE' | 'ENTERPRISE';

export type FormLayout = 'POPUP' | 'EMBEDDED' | 'SLIDEOVER' | 'LANDING';

export type Disposition =
  | 'UNASSIGNED'
  | 'NEW'
  | 'CONFIRMED'
  | 'RESCHEDULED'
  | 'NO_ANSWER'
  | 'WRONG_NUMBER'
  | 'FAKE'
  | 'CANCELLED'
  | 'SHIPPED'
  | 'DELIVERED'
  | 'RETURNED';

export type OtpChannel = 'SMS' | 'WHATSAPP' | 'EMAIL' | 'VOICE';

export type BlocklistType = 'PHONE' | 'IP' | 'EMAIL' | 'POSTAL_CODE' | 'DEVICE';

export type AgentRole = 'OWNER' | 'MANAGER' | 'AGENT' | 'VIEWER';

export type PixelProvider = 'meta' | 'tiktok' | 'google' | 'snapchat' | 'pinterest';

export type CourierCode =
  | 'postex'
  | 'leopards'
  | 'tcs'
  | 'trax'
  | 'mp'
  | 'blueex'
  | 'swyft'
  | 'call'
  | 'daewoo'
  | 'aramex'
  | 'shiprocket'
  | 'delhivery'
  | 'bluedart'
  | 'dhl'
  | 'fedex'
  | 'ups'
  | 'sendcloud'
  | 'custom';

export type MessagingProvider =
  | 'twilio'
  | 'messagebird'
  | 'vonage'
  | 'gupshup'
  | '360dialog'
  | 'jazz'
  | 'ufone'
  | 'custom';

export interface ShopSettings {
  currency?: string;
  timezone?: string;
  defaultLanguage?: string;
  otp?: {
    enabled: boolean;
    channel: OtpChannel;
    timeoutMinutes: number;
  };
  fraud?: {
    maxOrdersPerPhonePerDay?: number;
    maxOrdersPerIpPerDay?: number;
    allowedCountries?: string[];
    blockedCountries?: string[];
  };
}

export interface RiskScoreResult {
  score: number;
  reasons: string[];
  model: string;
  version: string;
}
