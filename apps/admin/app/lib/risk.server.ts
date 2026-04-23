/**
 * Phase 2.3 — Risk scoring client.
 * If ML_SERVICE_URL is configured, delegates to the FastAPI microservice.
 * Otherwise falls back to the in-Node heuristic (kept stable with ml-service/app/model.py).
 */
import prisma from '../db.server';

export type RiskFeatures = {
  phone: string | null;
  ip: string | null;
  address: string | null;
  city: string | null;
  postalCode: string | null;
  country: string | null;
  orderAmount: number | null;
  phoneVelocity24h: number;
  ipVelocity24h: number;
  hourOfDay: number;
  dayOfWeek: number;
  deviceType: string | null;
  isRepeatCustomer: boolean;
  prevRtoRate: number;
};

export type RiskResult = {
  score: number;
  label: 'low' | 'medium' | 'high';
  model: string;
  version: string;
  reasons: Array<{ code: string; message: string }>;
};

export async function scoreRisk(features: RiskFeatures): Promise<RiskResult> {
  const url = process.env.ML_SERVICE_URL;
  if (url) {
    try {
      const resp = await fetch(`${url.replace(/\/$/, '')}/score`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          features: {
            phone: features.phone,
            address: features.address,
            city: features.city,
            postal_code: features.postalCode,
            country: features.country,
            order_amount: features.orderAmount,
            hour_of_day: features.hourOfDay,
            day_of_week: features.dayOfWeek,
            device_type: features.deviceType,
            phone_velocity_24h: features.phoneVelocity24h,
            ip_velocity_24h: features.ipVelocity24h,
            is_repeat_customer: features.isRepeatCustomer,
            prev_rto_rate: features.prevRtoRate,
          },
        }),
        signal: AbortSignal.timeout(1500),
      });
      if (resp.ok) {
        const json = (await resp.json()) as RiskResult;
        return json;
      }
    } catch {
      // fall through to heuristic
    }
  }
  return heuristicScore(features);
}

export function heuristicScore(f: RiskFeatures): RiskResult {
  const digits = (f.phone ?? '').replace(/\D/g, '');
  const addr = (f.address ?? '').trim();
  const reasons: RiskResult['reasons'] = [];
  let score = 0;
  if (digits.length > 0 && digits.length < 10) {
    score += 30;
    reasons.push({ code: 'short_phone', message: 'Phone has fewer than 10 digits' });
  }
  if (f.phoneVelocity24h >= 3) {
    score += Math.min(35, f.phoneVelocity24h * 10);
    reasons.push({
      code: 'phone_velocity',
      message: `${f.phoneVelocity24h} submissions in 24h from this phone`,
    });
  }
  if (f.ipVelocity24h >= 5) {
    score += Math.min(25, f.ipVelocity24h * 3);
    reasons.push({
      code: 'ip_velocity',
      message: `${f.ipVelocity24h} submissions in 24h from IP`,
    });
  }
  if (addr.length > 0 && addr.length < 10) {
    score += 15;
    reasons.push({ code: 'short_address', message: 'Address looks too short' });
  }
  if (addr.length > 0 && !/\d/.test(addr)) {
    score += 10;
    reasons.push({ code: 'no_house_number', message: 'No house / flat number in address' });
  }
  if (!f.city || f.city.trim().length < 3) {
    score += 10;
    reasons.push({ code: 'missing_city', message: 'City missing or too short' });
  }
  if (f.hourOfDay <= 5 || f.hourOfDay >= 22) {
    score += 8;
    reasons.push({ code: 'late_night', message: 'Ordered late-night (22:00–05:59)' });
  }
  if ((f.orderAmount ?? 0) > 10000) {
    score += 12;
    reasons.push({ code: 'high_amount', message: 'Order amount above 10,000' });
  }
  if (f.prevRtoRate >= 0.5) {
    score += Math.round(f.prevRtoRate * 30);
    reasons.push({
      code: 'network_rto',
      message: `Network RTO rate ${Math.round(f.prevRtoRate * 100)}%`,
    });
  }
  score = Math.max(0, Math.min(100, score));
  const label: RiskResult['label'] = score >= 70 ? 'high' : score >= 30 ? 'medium' : 'low';
  return { score, label, model: 'heuristic-v1', version: '0.1.0', reasons };
}

export async function recordRiskEvaluation(args: {
  orderId?: string | null;
  submissionId?: string | null;
  features: RiskFeatures;
  result: RiskResult;
}): Promise<void> {
  await prisma.riskEvaluation.create({
    data: {
      orderId: args.orderId ?? undefined,
      submissionId: args.submissionId ?? undefined,
      features: args.features as unknown as object,
      score: args.result.score,
      label: args.result.label,
      model: args.result.model,
      version: args.result.version,
    },
  });
}
