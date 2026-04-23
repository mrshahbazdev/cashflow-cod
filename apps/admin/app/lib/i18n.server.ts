/**
 * Phase 4.5 — Minimal i18n / language-pack layer.
 *
 * Language packs are static JSON maps keyed by language code. The widget picks
 * a pack based on (a) explicit ?lang=xx override, (b) the form's
 * `translations` map, (c) the shop's `defaultLanguage`, or (d) `en`.
 */

type LanguagePack = Record<string, string>;

const EN: LanguagePack = {
  'label.name': 'Full name',
  'label.phone': 'Phone number',
  'label.email': 'Email',
  'label.address': 'Address',
  'label.city': 'City',
  'label.postal': 'Postal code',
  'label.notes': 'Notes',
  'label.otp': 'OTP code',
  'button.submit': 'Place order',
  'button.verify': 'Verify',
  'button.resend': 'Resend OTP',
  'error.required': 'This field is required',
  'error.phone': 'Please enter a valid phone number',
  'success.submitted': 'Thank you — your order has been received.',
  'otp.sent': 'We sent you a verification code.',
};

const UR: LanguagePack = {
  'label.name': 'پورا نام',
  'label.phone': 'فون نمبر',
  'label.email': 'ای میل',
  'label.address': 'پتہ',
  'label.city': 'شہر',
  'label.postal': 'پوسٹل کوڈ',
  'label.notes': 'نوٹس',
  'label.otp': 'OTP کوڈ',
  'button.submit': 'آرڈر دیں',
  'button.verify': 'تصدیق کریں',
  'button.resend': 'OTP دوبارہ بھیجیں',
  'error.required': 'یہ فیلڈ ضروری ہے',
  'error.phone': 'براہ کرم درست فون نمبر درج کریں',
  'success.submitted': 'شکریہ — آپ کا آرڈر موصول ہو گیا ہے۔',
  'otp.sent': 'ہم نے آپ کو تصدیقی کوڈ بھیج دیا ہے۔',
};

const AR: LanguagePack = {
  'label.name': 'الاسم الكامل',
  'label.phone': 'رقم الهاتف',
  'label.email': 'البريد الإلكتروني',
  'label.address': 'العنوان',
  'label.city': 'المدينة',
  'label.postal': 'الرمز البريدي',
  'label.notes': 'ملاحظات',
  'label.otp': 'رمز التحقق',
  'button.submit': 'تأكيد الطلب',
  'button.verify': 'تحقق',
  'button.resend': 'إعادة الإرسال',
  'error.required': 'هذا الحقل مطلوب',
  'error.phone': 'يرجى إدخال رقم هاتف صحيح',
  'success.submitted': 'شكراً — تم استلام طلبك.',
  'otp.sent': 'لقد أرسلنا إليك رمز التحقق.',
};

const HI: LanguagePack = {
  'label.name': 'पूरा नाम',
  'label.phone': 'फ़ोन नंबर',
  'label.email': 'ईमेल',
  'label.address': 'पता',
  'label.city': 'शहर',
  'label.postal': 'पिन कोड',
  'label.notes': 'टिप्पणियाँ',
  'label.otp': 'OTP कोड',
  'button.submit': 'ऑर्डर करें',
  'button.verify': 'सत्यापित करें',
  'button.resend': 'OTP दोबारा भेजें',
  'error.required': 'यह फ़ील्ड ज़रूरी है',
  'error.phone': 'कृपया सही फ़ोन नंबर दर्ज करें',
  'success.submitted': 'धन्यवाद — आपका ऑर्डर प्राप्त हो गया है।',
  'otp.sent': 'हमने आपको सत्यापन कोड भेजा है।',
};

const FR: LanguagePack = {
  'label.name': 'Nom complet',
  'label.phone': 'Numéro de téléphone',
  'label.email': 'E-mail',
  'label.address': 'Adresse',
  'label.city': 'Ville',
  'label.postal': 'Code postal',
  'label.notes': 'Notes',
  'label.otp': 'Code OTP',
  'button.submit': 'Commander',
  'button.verify': 'Vérifier',
  'button.resend': 'Renvoyer le code',
  'error.required': 'Ce champ est obligatoire',
  'error.phone': 'Veuillez saisir un numéro valide',
  'success.submitted': 'Merci — votre commande a été reçue.',
  'otp.sent': 'Nous vous avons envoyé un code de vérification.',
};

const ES: LanguagePack = {
  'label.name': 'Nombre completo',
  'label.phone': 'Número de teléfono',
  'label.email': 'Correo electrónico',
  'label.address': 'Dirección',
  'label.city': 'Ciudad',
  'label.postal': 'Código postal',
  'label.notes': 'Notas',
  'label.otp': 'Código OTP',
  'button.submit': 'Realizar pedido',
  'button.verify': 'Verificar',
  'button.resend': 'Reenviar código',
  'error.required': 'Este campo es obligatorio',
  'error.phone': 'Introduce un número válido',
  'success.submitted': 'Gracias — hemos recibido tu pedido.',
  'otp.sent': 'Te hemos enviado un código de verificación.',
};

export const PACKS: Record<string, LanguagePack> = {
  en: EN,
  ur: UR,
  ar: AR,
  hi: HI,
  fr: FR,
  es: ES,
};

export const SUPPORTED_LANGUAGES = Object.keys(PACKS);

export const RTL_LANGUAGES = new Set(['ar', 'ur', 'he', 'fa']);

export function isRtl(lang: string): boolean {
  return RTL_LANGUAGES.has(lang.toLowerCase());
}

export function resolvePack(lang?: string | null): LanguagePack {
  const key = (lang ?? 'en').toLowerCase();
  return PACKS[key] ?? EN;
}

/**
 * Merge a form's per-shop translation overrides on top of the base pack.
 */
export function mergePack(
  lang: string,
  overrides: Record<string, Record<string, string>> | null | undefined,
): LanguagePack {
  const base = resolvePack(lang);
  const lower = lang.toLowerCase();
  const override = overrides?.[lower] ?? overrides?.[lang] ?? {};
  return { ...base, ...override };
}
