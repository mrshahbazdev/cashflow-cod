import type { Shop, Submission } from '@prisma/client';
import type { OtpChannel } from '@cashflow-cod/shared-types';
import {
  consoleAdapter,
  dialog360Adapter,
  generateOtp,
  messagingRegistry,
  twilioAdapter,
  type MessagingAdapter,
} from '@cashflow-cod/messaging';
import prisma from '../db.server';

let adaptersRegistered = false;
function registerAdapters() {
  if (adaptersRegistered) return;
  messagingRegistry.register(consoleAdapter);
  messagingRegistry.register(twilioAdapter);
  messagingRegistry.register(dialog360Adapter);
  adaptersRegistered = true;
}

function pickAdapter(
  shop: Shop,
  channel: OtpChannel,
): {
  adapter: MessagingAdapter;
  credentials: Record<string, string>;
} {
  registerAdapters();
  const settings = (shop.settings as Record<string, unknown>) ?? {};
  const otp = (settings.otp as Record<string, unknown>) ?? {};
  const provider = (otp.provider as string) || 'custom';
  const twilioCreds = {
    accountSid: process.env.TWILIO_ACCOUNT_SID ?? '',
    authToken: process.env.TWILIO_AUTH_TOKEN ?? '',
    fromSms: process.env.TWILIO_SMS_FROM ?? process.env.TWILIO_PHONE_NUMBER ?? '',
    fromWhatsapp: process.env.TWILIO_WA_FROM ?? '',
  };
  const dialog360Creds = {
    apiKey: process.env.DIALOG360_API_KEY ?? '',
    phoneNumberId: process.env.DIALOG360_PHONE_NUMBER_ID ?? '',
    templateNamespace: process.env.DIALOG360_TEMPLATE_NAMESPACE ?? '',
    templateLang: process.env.DIALOG360_TEMPLATE_LANG ?? 'en',
  };
  if (
    channel === 'WHATSAPP' &&
    (provider === '360dialog' || (!provider && dialog360Creds.apiKey))
  ) {
    const adapter = messagingRegistry.get('360dialog');
    if (adapter && dialog360Creds.apiKey) {
      return { adapter, credentials: dialog360Creds };
    }
  }
  if (provider === 'twilio' && twilioCreds.accountSid && twilioCreds.authToken) {
    const adapter = messagingRegistry.get('twilio');
    if (adapter) return { adapter, credentials: twilioCreds };
  }
  const fallback = messagingRegistry.get('custom');
  if (!fallback) throw new Error('No messaging adapter registered');
  return { adapter: fallback, credentials: {} };
}

type RequestOtpArgs = {
  shop: Shop;
  submission: Submission;
  channel?: OtpChannel;
};

export async function requestOtpForSubmission({
  shop,
  submission,
  channel: channelOverride,
}: RequestOtpArgs) {
  const settings = (shop.settings as Record<string, unknown>) ?? {};
  const otpSettings = (settings.otp as Record<string, unknown>) ?? {};
  const channel = (channelOverride ?? (otpSettings.channel as OtpChannel) ?? 'SMS') as OtpChannel;
  const timeoutMinutes =
    typeof otpSettings.timeoutMinutes === 'number' ? otpSettings.timeoutMinutes : 10;

  const destination = channel === 'EMAIL' ? submission.email : submission.phone;
  if (!destination) {
    throw new Error(`No ${channel === 'EMAIL' ? 'email' : 'phone'} to send OTP to`);
  }

  const code = generateOtp(6);
  const expiresAt = new Date(Date.now() + timeoutMinutes * 60 * 1000);

  await prisma.otpToken.create({
    data: {
      submissionId: submission.id,
      channel,
      destination,
      code,
      expiresAt,
    },
  });

  const { adapter, credentials } = pickAdapter(shop, channel);
  const storeName = (shop.domain.split('.')[0] ?? 'store').replace(/-/g, ' ');
  const body = `Your ${storeName} verification code is ${code}. It expires in ${timeoutMinutes} minutes.`;
  try {
    await adapter.send(credentials, channel, { to: destination, body });
  } catch (err) {
    throw new Error(
      `Failed to send OTP via ${adapter.provider}: ${
        err instanceof Error ? err.message : 'Unknown error'
      }`,
    );
  }

  return { channel, destination: maskDestination(destination), expiresAt };
}

function maskDestination(value: string): string {
  if (value.includes('@')) {
    const [user, domain] = value.split('@');
    if (!user || !domain) return value;
    return user.slice(0, 2) + '***@' + domain;
  }
  if (value.length > 4) {
    return value.slice(0, 2) + '•••' + value.slice(-2);
  }
  return value;
}

export async function verifyOtpForSubmission(submissionId: string, code: string) {
  const token = await prisma.otpToken.findFirst({
    where: { submissionId, verifiedAt: null },
    orderBy: { createdAt: 'desc' },
  });
  if (!token) return { ok: false as const, reason: 'No active verification code' };
  if (token.expiresAt.getTime() < Date.now()) {
    return { ok: false as const, reason: 'Verification code expired' };
  }
  await prisma.otpToken.update({
    where: { id: token.id },
    data: { attempts: { increment: 1 } },
  });
  if (token.attempts >= 5) {
    return { ok: false as const, reason: 'Too many attempts. Please request a new code.' };
  }
  if (token.code !== code.trim()) {
    return { ok: false as const, reason: 'Incorrect code' };
  }
  await prisma.otpToken.update({
    where: { id: token.id },
    data: { verifiedAt: new Date() },
  });
  return { ok: true as const };
}
