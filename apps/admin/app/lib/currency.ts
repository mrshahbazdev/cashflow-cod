/**
 * Multi-currency helpers.
 *
 * Cashflow stores prices in the shop's base currency (`Shop.settings.currency`).
 * This module surfaces a curated list of currencies plus an `Intl.NumberFormat`
 * powered formatter so the storefront widget and admin UI render amounts in
 * the merchant's preferred locale without a network round-trip.
 */

export interface CurrencyDefinition {
  code: string;
  label: string;
  symbol: string;
  /** Default Intl locale used for formatting if none is specified. */
  locale: string;
  /** Minor-unit fraction digits (most are 2; JPY/KRW are 0). */
  fractionDigits: number;
}

export const CURRENCIES: ReadonlyArray<CurrencyDefinition> = [
  { code: 'USD', label: 'US Dollar', symbol: '$', locale: 'en-US', fractionDigits: 2 },
  { code: 'EUR', label: 'Euro', symbol: '€', locale: 'de-DE', fractionDigits: 2 },
  { code: 'GBP', label: 'Pound Sterling', symbol: '£', locale: 'en-GB', fractionDigits: 2 },
  { code: 'PKR', label: 'Pakistani Rupee', symbol: 'Rs', locale: 'ur-PK', fractionDigits: 0 },
  { code: 'INR', label: 'Indian Rupee', symbol: '₹', locale: 'en-IN', fractionDigits: 2 },
  { code: 'BDT', label: 'Bangladeshi Taka', symbol: '৳', locale: 'bn-BD', fractionDigits: 2 },
  { code: 'AED', label: 'UAE Dirham', symbol: 'د.إ', locale: 'ar-AE', fractionDigits: 2 },
  { code: 'SAR', label: 'Saudi Riyal', symbol: 'ر.س', locale: 'ar-SA', fractionDigits: 2 },
  { code: 'EGP', label: 'Egyptian Pound', symbol: '£', locale: 'ar-EG', fractionDigits: 2 },
  { code: 'TRY', label: 'Turkish Lira', symbol: '₺', locale: 'tr-TR', fractionDigits: 2 },
  { code: 'CAD', label: 'Canadian Dollar', symbol: '$', locale: 'en-CA', fractionDigits: 2 },
  { code: 'AUD', label: 'Australian Dollar', symbol: '$', locale: 'en-AU', fractionDigits: 2 },
  { code: 'BRL', label: 'Brazilian Real', symbol: 'R$', locale: 'pt-BR', fractionDigits: 2 },
  { code: 'MXN', label: 'Mexican Peso', symbol: '$', locale: 'es-MX', fractionDigits: 2 },
  { code: 'JPY', label: 'Japanese Yen', symbol: '¥', locale: 'ja-JP', fractionDigits: 0 },
  { code: 'KRW', label: 'South Korean Won', symbol: '₩', locale: 'ko-KR', fractionDigits: 0 },
  { code: 'CNY', label: 'Chinese Yuan', symbol: '¥', locale: 'zh-CN', fractionDigits: 2 },
  { code: 'IDR', label: 'Indonesian Rupiah', symbol: 'Rp', locale: 'id-ID', fractionDigits: 0 },
  { code: 'MYR', label: 'Malaysian Ringgit', symbol: 'RM', locale: 'ms-MY', fractionDigits: 2 },
  { code: 'THB', label: 'Thai Baht', symbol: '฿', locale: 'th-TH', fractionDigits: 2 },
  { code: 'PHP', label: 'Philippine Peso', symbol: '₱', locale: 'en-PH', fractionDigits: 2 },
  { code: 'NGN', label: 'Nigerian Naira', symbol: '₦', locale: 'en-NG', fractionDigits: 2 },
  { code: 'KES', label: 'Kenyan Shilling', symbol: 'KSh', locale: 'en-KE', fractionDigits: 2 },
  { code: 'ZAR', label: 'South African Rand', symbol: 'R', locale: 'en-ZA', fractionDigits: 2 },
  { code: 'PLN', label: 'Polish Zloty', symbol: 'zł', locale: 'pl-PL', fractionDigits: 2 },
  { code: 'SEK', label: 'Swedish Krona', symbol: 'kr', locale: 'sv-SE', fractionDigits: 2 },
  { code: 'NOK', label: 'Norwegian Krone', symbol: 'kr', locale: 'nb-NO', fractionDigits: 2 },
  { code: 'DKK', label: 'Danish Krone', symbol: 'kr', locale: 'da-DK', fractionDigits: 2 },
  { code: 'CHF', label: 'Swiss Franc', symbol: 'Fr', locale: 'de-CH', fractionDigits: 2 },
];

const BY_CODE = new Map(CURRENCIES.map((c) => [c.code, c]));

export function getCurrency(code: string | null | undefined): CurrencyDefinition | undefined {
  if (!code) return undefined;
  return BY_CODE.get(code.toUpperCase());
}

export function formatMoney(
  amount: number,
  currencyCode: string | null | undefined,
  locale?: string,
): string {
  const currency = getCurrency(currencyCode) ?? BY_CODE.get('USD')!;
  const useLocale = locale ?? currency.locale;
  try {
    return new Intl.NumberFormat(useLocale, {
      style: 'currency',
      currency: currency.code,
      minimumFractionDigits: currency.fractionDigits,
      maximumFractionDigits: currency.fractionDigits,
    }).format(amount);
  } catch {
    return `${currency.symbol}${amount.toFixed(currency.fractionDigits)}`;
  }
}

export function isZeroDecimalCurrency(code: string | null | undefined): boolean {
  return (getCurrency(code)?.fractionDigits ?? 2) === 0;
}
