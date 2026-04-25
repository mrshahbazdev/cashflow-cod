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

const IT: LanguagePack = {
  'label.name': 'Nome completo',
  'label.phone': 'Numero di telefono',
  'label.email': 'Email',
  'label.address': 'Indirizzo',
  'label.city': 'Città',
  'label.postal': 'CAP',
  'label.notes': 'Note',
  'label.otp': 'Codice OTP',
  'button.submit': 'Effettua ordine',
  'button.verify': 'Verifica',
  'button.resend': 'Invia di nuovo',
  'error.required': 'Questo campo è obbligatorio',
  'error.phone': 'Inserisci un numero valido',
  'success.submitted': 'Grazie — abbiamo ricevuto il tuo ordine.',
  'otp.sent': 'Ti abbiamo inviato un codice di verifica.',
};

const DE: LanguagePack = {
  'label.name': 'Vollständiger Name',
  'label.phone': 'Telefonnummer',
  'label.email': 'E-Mail',
  'label.address': 'Adresse',
  'label.city': 'Stadt',
  'label.postal': 'Postleitzahl',
  'label.notes': 'Notizen',
  'label.otp': 'OTP-Code',
  'button.submit': 'Bestellung aufgeben',
  'button.verify': 'Bestätigen',
  'button.resend': 'Code erneut senden',
  'error.required': 'Pflichtfeld',
  'error.phone': 'Bitte gültige Telefonnummer eingeben',
  'success.submitted': 'Danke — wir haben Ihre Bestellung erhalten.',
  'otp.sent': 'Wir haben Ihnen einen Bestätigungscode gesendet.',
};

const NL: LanguagePack = {
  'label.name': 'Volledige naam',
  'label.phone': 'Telefoonnummer',
  'label.email': 'E-mail',
  'label.address': 'Adres',
  'label.city': 'Stad',
  'label.postal': 'Postcode',
  'label.notes': 'Opmerkingen',
  'label.otp': 'OTP-code',
  'button.submit': 'Bestelling plaatsen',
  'button.verify': 'Verifiëren',
  'button.resend': 'Code opnieuw versturen',
  'error.required': 'Dit veld is verplicht',
  'error.phone': 'Voer een geldig telefoonnummer in',
  'success.submitted': 'Bedankt — we hebben je bestelling ontvangen.',
  'otp.sent': 'We hebben je een verificatiecode gestuurd.',
};

const PT_BR: LanguagePack = {
  'label.name': 'Nome completo',
  'label.phone': 'Número de telefone',
  'label.email': 'E-mail',
  'label.address': 'Endereço',
  'label.city': 'Cidade',
  'label.postal': 'CEP',
  'label.notes': 'Observações',
  'label.otp': 'Código OTP',
  'button.submit': 'Fazer pedido',
  'button.verify': 'Verificar',
  'button.resend': 'Reenviar código',
  'error.required': 'Este campo é obrigatório',
  'error.phone': 'Digite um telefone válido',
  'success.submitted': 'Obrigado — recebemos seu pedido.',
  'otp.sent': 'Enviamos um código de verificação.',
};

const PT_PT: LanguagePack = {
  'label.name': 'Nome completo',
  'label.phone': 'Número de telemóvel',
  'label.email': 'E-mail',
  'label.address': 'Morada',
  'label.city': 'Cidade',
  'label.postal': 'Código postal',
  'label.notes': 'Notas',
  'label.otp': 'Código OTP',
  'button.submit': 'Encomendar',
  'button.verify': 'Verificar',
  'button.resend': 'Reenviar código',
  'error.required': 'Este campo é obrigatório',
  'error.phone': 'Introduza um número válido',
  'success.submitted': 'Obrigado — recebemos a sua encomenda.',
  'otp.sent': 'Enviámos-lhe um código de verificação.',
};

const PL: LanguagePack = {
  'label.name': 'Imię i nazwisko',
  'label.phone': 'Numer telefonu',
  'label.email': 'E-mail',
  'label.address': 'Adres',
  'label.city': 'Miasto',
  'label.postal': 'Kod pocztowy',
  'label.notes': 'Uwagi',
  'label.otp': 'Kod OTP',
  'button.submit': 'Złóż zamówienie',
  'button.verify': 'Zweryfikuj',
  'button.resend': 'Wyślij kod ponownie',
  'error.required': 'To pole jest wymagane',
  'error.phone': 'Podaj prawidłowy numer telefonu',
  'success.submitted': 'Dziękujemy — otrzymaliśmy Twoje zamówienie.',
  'otp.sent': 'Wysłaliśmy kod weryfikacyjny.',
};

const SV: LanguagePack = {
  'label.name': 'Fullständigt namn',
  'label.phone': 'Telefonnummer',
  'label.email': 'E-post',
  'label.address': 'Adress',
  'label.city': 'Stad',
  'label.postal': 'Postnummer',
  'label.notes': 'Anteckningar',
  'label.otp': 'OTP-kod',
  'button.submit': 'Beställ',
  'button.verify': 'Verifiera',
  'button.resend': 'Skicka kod igen',
  'error.required': 'Det här fältet är obligatoriskt',
  'error.phone': 'Ange ett giltigt telefonnummer',
  'success.submitted': 'Tack — vi har tagit emot din beställning.',
  'otp.sent': 'Vi har skickat en verifieringskod.',
};

const NB: LanguagePack = {
  'label.name': 'Fullt navn',
  'label.phone': 'Telefonnummer',
  'label.email': 'E-post',
  'label.address': 'Adresse',
  'label.city': 'By',
  'label.postal': 'Postnummer',
  'label.notes': 'Merknader',
  'label.otp': 'OTP-kode',
  'button.submit': 'Bestill',
  'button.verify': 'Bekreft',
  'button.resend': 'Send kode på nytt',
  'error.required': 'Dette feltet er påkrevd',
  'error.phone': 'Skriv inn et gyldig telefonnummer',
  'success.submitted': 'Takk — vi har mottatt bestillingen din.',
  'otp.sent': 'Vi har sendt deg en bekreftelseskode.',
};

const DA: LanguagePack = {
  'label.name': 'Fulde navn',
  'label.phone': 'Telefonnummer',
  'label.email': 'E-mail',
  'label.address': 'Adresse',
  'label.city': 'By',
  'label.postal': 'Postnummer',
  'label.notes': 'Bemærkninger',
  'label.otp': 'OTP-kode',
  'button.submit': 'Afgiv ordre',
  'button.verify': 'Bekræft',
  'button.resend': 'Send kode igen',
  'error.required': 'Dette felt er påkrævet',
  'error.phone': 'Indtast et gyldigt telefonnummer',
  'success.submitted': 'Tak — vi har modtaget din ordre.',
  'otp.sent': 'Vi har sendt dig en bekræftelseskode.',
};

const FI: LanguagePack = {
  'label.name': 'Koko nimi',
  'label.phone': 'Puhelinnumero',
  'label.email': 'Sähköposti',
  'label.address': 'Osoite',
  'label.city': 'Kaupunki',
  'label.postal': 'Postinumero',
  'label.notes': 'Lisätietoja',
  'label.otp': 'OTP-koodi',
  'button.submit': 'Tee tilaus',
  'button.verify': 'Vahvista',
  'button.resend': 'Lähetä koodi uudelleen',
  'error.required': 'Pakollinen kenttä',
  'error.phone': 'Anna kelvollinen puhelinnumero',
  'success.submitted': 'Kiitos — tilaus vastaanotettu.',
  'otp.sent': 'Lähetimme vahvistuskoodin.',
};

const CS: LanguagePack = {
  'label.name': 'Celé jméno',
  'label.phone': 'Telefonní číslo',
  'label.email': 'E-mail',
  'label.address': 'Adresa',
  'label.city': 'Město',
  'label.postal': 'PSČ',
  'label.notes': 'Poznámky',
  'label.otp': 'OTP kód',
  'button.submit': 'Objednat',
  'button.verify': 'Ověřit',
  'button.resend': 'Odeslat kód znovu',
  'error.required': 'Toto pole je povinné',
  'error.phone': 'Zadejte platné telefonní číslo',
  'success.submitted': 'Děkujeme — vaše objednávka byla přijata.',
  'otp.sent': 'Poslali jsme vám ověřovací kód.',
};

const TR: LanguagePack = {
  'label.name': 'Ad Soyad',
  'label.phone': 'Telefon numarası',
  'label.email': 'E-posta',
  'label.address': 'Adres',
  'label.city': 'Şehir',
  'label.postal': 'Posta kodu',
  'label.notes': 'Notlar',
  'label.otp': 'OTP kodu',
  'button.submit': 'Sipariş ver',
  'button.verify': 'Doğrula',
  'button.resend': 'Kodu yeniden gönder',
  'error.required': 'Bu alan zorunludur',
  'error.phone': 'Geçerli bir telefon numarası girin',
  'success.submitted': 'Teşekkürler — siparişiniz alındı.',
  'otp.sent': 'Size bir doğrulama kodu gönderdik.',
};

const TH: LanguagePack = {
  'label.name': 'ชื่อ-นามสกุล',
  'label.phone': 'เบอร์โทรศัพท์',
  'label.email': 'อีเมล',
  'label.address': 'ที่อยู่',
  'label.city': 'เมือง',
  'label.postal': 'รหัสไปรษณีย์',
  'label.notes': 'หมายเหตุ',
  'label.otp': 'รหัส OTP',
  'button.submit': 'สั่งซื้อ',
  'button.verify': 'ยืนยัน',
  'button.resend': 'ส่งรหัสอีกครั้ง',
  'error.required': 'จำเป็นต้องกรอกข้อมูล',
  'error.phone': 'กรุณากรอกเบอร์โทรที่ถูกต้อง',
  'success.submitted': 'ขอบคุณ — เราได้รับคำสั่งซื้อของคุณแล้ว',
  'otp.sent': 'เราได้ส่งรหัสยืนยันให้คุณแล้ว',
};

const JA: LanguagePack = {
  'label.name': '氏名',
  'label.phone': '電話番号',
  'label.email': 'メールアドレス',
  'label.address': '住所',
  'label.city': '市区町村',
  'label.postal': '郵便番号',
  'label.notes': '備考',
  'label.otp': '認証コード',
  'button.submit': '注文する',
  'button.verify': '認証',
  'button.resend': 'コードを再送',
  'error.required': '必須項目です',
  'error.phone': '正しい電話番号を入力してください',
  'success.submitted': 'ありがとうございます — ご注文を受け付けました。',
  'otp.sent': '認証コードを送信しました。',
};

const KO: LanguagePack = {
  'label.name': '이름',
  'label.phone': '전화번호',
  'label.email': '이메일',
  'label.address': '주소',
  'label.city': '도시',
  'label.postal': '우편번호',
  'label.notes': '메모',
  'label.otp': 'OTP 코드',
  'button.submit': '주문하기',
  'button.verify': '인증',
  'button.resend': '코드 다시 보내기',
  'error.required': '필수 항목입니다',
  'error.phone': '올바른 전화번호를 입력하세요',
  'success.submitted': '감사합니다 — 주문이 접수되었습니다.',
  'otp.sent': '인증 코드를 보냈습니다.',
};

const ZH_CN: LanguagePack = {
  'label.name': '姓名',
  'label.phone': '电话号码',
  'label.email': '电子邮件',
  'label.address': '地址',
  'label.city': '城市',
  'label.postal': '邮政编码',
  'label.notes': '备注',
  'label.otp': '验证码',
  'button.submit': '提交订单',
  'button.verify': '验证',
  'button.resend': '重新发送验证码',
  'error.required': '此项为必填',
  'error.phone': '请输入有效的电话号码',
  'success.submitted': '感谢您 — 我们已收到您的订单。',
  'otp.sent': '我们已向您发送验证码。',
};

const ZH_TW: LanguagePack = {
  'label.name': '姓名',
  'label.phone': '電話號碼',
  'label.email': '電子郵件',
  'label.address': '地址',
  'label.city': '城市',
  'label.postal': '郵遞區號',
  'label.notes': '備註',
  'label.otp': '驗證碼',
  'button.submit': '送出訂單',
  'button.verify': '驗證',
  'button.resend': '重新發送驗證碼',
  'error.required': '此欄為必填',
  'error.phone': '請輸入有效的電話號碼',
  'success.submitted': '感謝您 — 我們已收到您的訂單。',
  'otp.sent': '我們已寄出驗證碼。',
};

export const PACKS: Record<string, LanguagePack> = {
  en: EN,
  ur: UR,
  ar: AR,
  hi: HI,
  fr: FR,
  es: ES,
  it: IT,
  de: DE,
  nl: NL,
  'pt-br': PT_BR,
  'pt-pt': PT_PT,
  pt: PT_PT,
  pl: PL,
  sv: SV,
  nb: NB,
  no: NB,
  da: DA,
  fi: FI,
  cs: CS,
  tr: TR,
  th: TH,
  ja: JA,
  ko: KO,
  'zh-cn': ZH_CN,
  zh: ZH_CN,
  'zh-tw': ZH_TW,
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
