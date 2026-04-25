/* Cashflow COD — storefront form widget.
 * Fetches the form schema from the Cashflow COD API, renders the form
 * (popup / inline / floating), handles multi-step navigation, conditional
 * logic, client-side validation, and submits the order.
 */
(function () {
  'use strict';

  function onReady(fn) {
    if (document.readyState !== 'loading') fn();
    else document.addEventListener('DOMContentLoaded', fn);
  }

  function el(tag, attrs, children) {
    var e = document.createElement(tag);
    if (attrs) {
      for (var k in attrs) {
        if (k === 'class') e.className = attrs[k];
        else if (k === 'style') e.setAttribute('style', attrs[k]);
        else if (k.slice(0, 2) === 'on') e.addEventListener(k.slice(2).toLowerCase(), attrs[k]);
        else if (attrs[k] != null) e.setAttribute(k, attrs[k]);
      }
    }
    (children || []).forEach(function (c) {
      if (c == null) return;
      e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return e;
  }

  function visitorId() {
    try {
      var k = 'cashflow_visitor_id';
      var id = localStorage.getItem(k);
      if (!id) {
        id = 'v_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 10);
        localStorage.setItem(k, id);
      }
      return id;
    } catch (e) {
      return 'v_' + Date.now();
    }
  }

  // Production URL of the Cashflow COD admin app. Used as the canonical
  // fallback when a theme block was installed before the schema default
  // was filled in (so root.dataset.api is empty or still the old
  // placeholder string). This lets every block self-heal on next page
  // load instead of asking the merchant to re-edit the theme settings.
  var CASHFLOW_PROD_API_ORIGIN = 'https://cashflow-cod-production-2aff.up.railway.app';

  function sanitizeApiOrigin(raw) {
    var v = (raw || '').trim();
    if (!v) return CASHFLOW_PROD_API_ORIGIN;
    // Reject obvious placeholders that older versions of the schema
    // shipped as the default value before PR #19 / #20.
    if (/your-cashflow-cod-app\.example/i.test(v)) return CASHFLOW_PROD_API_ORIGIN;
    if (/^https?:\/\/example\./i.test(v)) return CASHFLOW_PROD_API_ORIGIN;
    if (/your-shop\.myshopify\.com/i.test(v)) return CASHFLOW_PROD_API_ORIGIN;
    // Reject anything that isn't a valid absolute http(s) URL.
    try {
      var u = new URL(v);
      if (u.protocol !== 'http:' && u.protocol !== 'https:') return CASHFLOW_PROD_API_ORIGIN;
      return v.replace(/\/+$/, '');
    } catch (_e) {
      return CASHFLOW_PROD_API_ORIGIN;
    }
  }

  function readConfigFromRoot(root) {
    if (!root) return null;
    return {
      root: root,
      shop: root.dataset.shop,
      formSlug: root.dataset.formSlug || 'default',
      placement: root.dataset.placement,
      trigger: root.dataset.trigger || 'button',
      accent: root.dataset.accent || '#008060',
      language: root.dataset.language || 'auto',
      productId: root.dataset.productId || null,
      variantId: root.dataset.variantId || null,
      productHandle: root.dataset.productHandle || null,
      productTitle: root.dataset.productTitle || null,
      productImage: root.dataset.productImage || null,
      productPrice: root.dataset.productPrice || null,
      productVariantTitle: root.dataset.productVariantTitle || null,
      btnAnimation: root.dataset.btnAnimation || 'none',
      apiOrigin: sanitizeApiOrigin(root.dataset.api),
    };
  }

  function listRoots() {
    var nodes = document.querySelectorAll(
      '#cashflow-cod-root, [data-cashflow-cod-root], .cashflow-cod-root',
    );
    var out = [];
    for (var i = 0; i < nodes.length; i++) out.push(nodes[i]);
    return out;
  }

  function defaultApiOrigin() {
    var anyRoot = listRoots()[0];
    if (anyRoot && anyRoot.dataset.api) return sanitizeApiOrigin(anyRoot.dataset.api);
    return CASHFLOW_PROD_API_ORIGIN;
  }

  function defaultShop() {
    var anyRoot = listRoots()[0];
    if (anyRoot && anyRoot.dataset.shop) return anyRoot.dataset.shop;
    return '';
  }

  var RTL_LANGS = { ar: 1, ur: 1, he: 1, fa: 1 };

  var WIDGET_STRINGS = {
    en: { apply: 'Apply', applied: 'Applied', discount: 'Discount code', invalid: 'Invalid code' },
    ur: { apply: 'لاگو کریں', applied: 'لاگو', discount: 'ڈسکاؤنٹ کوڈ', invalid: 'غلط کوڈ' },
    ar: { apply: 'تطبيق', applied: 'مطبق', discount: 'كود الخصم', invalid: 'كود غير صحيح' },
    fr: {
      apply: 'Appliquer',
      applied: 'Appliqué',
      discount: 'Code promo',
      invalid: 'Code invalide',
    },
    es: {
      apply: 'Aplicar',
      applied: 'Aplicado',
      discount: 'Código de descuento',
      invalid: 'Código no válido',
    },
    it: {
      apply: 'Applica',
      applied: 'Applicato',
      discount: 'Codice sconto',
      invalid: 'Codice non valido',
    },
    de: {
      apply: 'Anwenden',
      applied: 'Angewendet',
      discount: 'Rabattcode',
      invalid: 'Ungültiger Code',
    },
    pt: {
      apply: 'Aplicar',
      applied: 'Aplicado',
      discount: 'Código de desconto',
      invalid: 'Código inválido',
    },
    pl: {
      apply: 'Zastosuj',
      applied: 'Zastosowano',
      discount: 'Kod rabatowy',
      invalid: 'Nieprawidłowy kod',
    },
    tr: {
      apply: 'Uygula',
      applied: 'Uygulandı',
      discount: 'İndirim kodu',
      invalid: 'Geçersiz kod',
    },
    nl: {
      apply: 'Toepassen',
      applied: 'Toegepast',
      discount: 'Kortingscode',
      invalid: 'Ongeldige code',
    },
    sv: { apply: 'Använd', applied: 'Tillämpad', discount: 'Rabattkod', invalid: 'Ogiltig kod' },
    da: { apply: 'Anvend', applied: 'Anvendt', discount: 'Rabatkode', invalid: 'Ugyldig kode' },
    nb: { apply: 'Bruk', applied: 'Brukt', discount: 'Rabattkode', invalid: 'Ugyldig kode' },
    fi: {
      apply: 'Käytä',
      applied: 'Käytössä',
      discount: 'Alennuskoodi',
      invalid: 'Virheellinen koodi',
    },
    cs: { apply: 'Použít', applied: 'Použito', discount: 'Slevový kód', invalid: 'Neplatný kód' },
    th: { apply: 'ใช้', applied: 'ใช้แล้ว', discount: 'รหัสส่วนลด', invalid: 'รหัสไม่ถูกต้อง' },
    ja: { apply: '適用', applied: '適用済み', discount: '割引コード', invalid: '無効なコード' },
    ko: { apply: '적용', applied: '적용됨', discount: '할인 코드', invalid: '잘못된 코드' },
    zh: { apply: '应用', applied: '已应用', discount: '折扣码', invalid: '无效代码' },
    'zh-tw': { apply: '套用', applied: '已套用', discount: '折扣碼', invalid: '無效代碼' },
    hi: { apply: 'लागू करें', applied: 'लागू', discount: 'छूट कोड', invalid: 'अमान्य कोड' },
  };

  function resolveLanguage(cfg) {
    var enabled = (cfg.i18n && cfg.i18n.enabledLanguages && cfg.i18n.enabledLanguages.slice()) || [
      'en',
    ];
    var def = (cfg.i18n && cfg.i18n.defaultLanguage) || 'en';
    var query = readQuery('lang');
    var dataLang = cfg.language && cfg.language !== 'auto' ? cfg.language : null;
    var browser = (navigator.language || 'en').toLowerCase();
    var browserShort = browser.split('-')[0];
    var candidates = [query, dataLang, browser, browserShort, def, 'en'];
    for (var i = 0; i < candidates.length; i++) {
      var c = (candidates[i] || '').toLowerCase();
      if (c && enabled.indexOf(c) !== -1) return c;
    }
    return def;
  }

  function tr(cfg, key) {
    var lang = (cfg && cfg.activeLanguage) || 'en';
    return (WIDGET_STRINGS[lang] || WIDGET_STRINGS.en)[key] || WIDGET_STRINGS.en[key] || key;
  }

  function formatMoney(cfg, amount) {
    var currency = (cfg && cfg.currency && cfg.currency.base) || 'USD';
    var locale = (cfg && cfg.currency && cfg.currency.locale) || cfg.activeLanguage || 'en';
    try {
      return new Intl.NumberFormat(locale, { style: 'currency', currency: currency }).format(
        Number(amount) || 0,
      );
    } catch (e) {
      return currency + ' ' + (Number(amount) || 0).toFixed(2);
    }
  }

  function sanitizeHtml(html) {
    if (!html) return '';
    return String(html)
      .replace(/<\s*script\b[^>]*>[\s\S]*?<\s*\/\s*script\s*>/gi, '')
      .replace(/<\s*script\b[^>]*>/gi, '')
      .replace(/\son[a-z]+\s*=\s*"[^"]*"/gi, '')
      .replace(/\son[a-z]+\s*=\s*'[^']*'/gi, '')
      .replace(/javascript:/gi, '');
  }

  function scopeCss(css, scopeSelector) {
    if (!css) return '';
    // Strip @import + url(javascript:..) and prefix every selector with the
    // widget root so merchant CSS can not leak to the rest of the page.
    var clean = String(css)
      .replace(/@import[^;]+;?/gi, '')
      .replace(/url\(\s*javascript:[^)]*\)/gi, 'url(about:blank)');
    // Tokenise on `}` so we can rewrite selectors block by block.
    var blocks = clean.split('}');
    var out = '';
    for (var i = 0; i < blocks.length; i++) {
      var block = blocks[i];
      var braceIdx = block.indexOf('{');
      if (braceIdx === -1) {
        out += block;
        continue;
      }
      var selector = block.slice(0, braceIdx).trim();
      var body = block.slice(braceIdx);
      if (!selector || selector.charAt(0) === '@') {
        out += selector + body + '}';
        continue;
      }
      var scoped = selector
        .split(',')
        .map(function (s) {
          var t = s.trim();
          if (!t) return '';
          if (t.indexOf(scopeSelector) === 0) return t;
          return scopeSelector + ' ' + t;
        })
        .filter(Boolean)
        .join(', ');
      out += scoped + body + '}';
    }
    return out;
  }

  function injectCustomCss(schema, widgetRoot) {
    if (!schema.customCss) return;
    var styleId = 'cashflow-cod-style-form-' + Math.random().toString(36).slice(2, 8);
    var style = document.createElement('style');
    style.id = styleId;
    widgetRoot.classList.add('cashflow-cod-scoped-' + styleId.slice(-6));
    style.textContent = scopeCss(
      schema.customCss,
      '.cashflow-cod-widget.cashflow-cod-scoped-' + styleId.slice(-6),
    );
    document.head.appendChild(style);
  }

  function loadGooglePlaces(cfg) {
    if (window.__cashflowGooglePlacesLoading || window.google) return;
    window.__cashflowGooglePlacesLoading = true;
    var s = document.createElement('script');
    var key = encodeURIComponent(cfg.places.publishableKey);
    s.src = 'https://maps.googleapis.com/maps/api/js?key=' + key + '&libraries=places';
    s.async = true;
    s.defer = true;
    document.head.appendChild(s);
  }

  function attachPlacesAutocomplete(input, cfg, onPlace) {
    if (!cfg.places || !cfg.places.enabled || !input) return;
    function attach() {
      try {
        if (
          !window.google ||
          !window.google.maps ||
          !window.google.maps.places ||
          input.dataset.cashflowPlacesAttached === '1'
        )
          return false;
        var opts = { fields: ['address_components', 'formatted_address', 'geometry'] };
        if (cfg.places.countries) {
          var arr = String(cfg.places.countries)
            .split(',')
            .map(function (c) {
              return c.trim().toLowerCase();
            })
            .filter(Boolean)
            .slice(0, 5);
          if (arr.length) opts.componentRestrictions = { country: arr };
        }
        var ac = new window.google.maps.places.Autocomplete(input, opts);
        ac.addListener('place_changed', function () {
          var p = ac.getPlace();
          if (p && typeof onPlace === 'function') onPlace(p);
        });
        input.dataset.cashflowPlacesAttached = '1';
        return true;
      } catch (e) {
        return false;
      }
    }
    if (!attach()) {
      var tries = 0;
      var iv = setInterval(function () {
        tries++;
        if (attach() || tries > 60) clearInterval(iv);
      }, 250);
    }
  }

  function placeToFields(place) {
    var out = { address: place.formatted_address || '', city: '', postal: '', country: '' };
    var components = place.address_components || [];
    for (var i = 0; i < components.length; i++) {
      var c = components[i];
      var types = c.types || [];
      if (types.indexOf('locality') !== -1) out.city = c.long_name;
      else if (!out.city && types.indexOf('postal_town') !== -1) out.city = c.long_name;
      else if (!out.city && types.indexOf('administrative_area_level_2') !== -1)
        out.city = c.long_name;
      if (types.indexOf('postal_code') !== -1) out.postal = c.long_name;
      if (types.indexOf('country') !== -1) out.country = c.long_name;
    }
    return out;
  }

  function fetchSchema(cfg) {
    var base = cfg.apiOrigin.replace(/\/+$/, '');
    var url =
      base +
      '/api/public/forms/' +
      encodeURIComponent(cfg.formSlug) +
      '?shop=' +
      encodeURIComponent(cfg.shop) +
      '&visitor=' +
      encodeURIComponent(visitorId());
    return fetch(url, { method: 'GET', credentials: 'omit' }).then(function (r) {
      if (!r.ok) throw new Error('Form not available');
      return r.json();
    });
  }

  function postJson(cfg, path, payload) {
    var base = cfg.apiOrigin.replace(/\/+$/, '');
    return fetch(base + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'omit',
      body: JSON.stringify(payload),
    }).then(function (r) {
      return r.json().then(function (j) {
        return { status: r.status, body: j };
      });
    });
  }

  function readCookie(name) {
    try {
      var pairs = (document.cookie || '').split(';');
      for (var i = 0; i < pairs.length; i++) {
        var p = pairs[i].split('=');
        if ((p[0] || '').trim() === name) {
          return decodeURIComponent((p[1] || '').trim());
        }
      }
    } catch (e) {
      /* noop */
    }
    return undefined;
  }

  function readQuery(name) {
    try {
      var u = new URL(window.location.href);
      return u.searchParams.get(name) || undefined;
    } catch (e) {
      return undefined;
    }
  }

  function trackingContext() {
    var fbc = readCookie('_fbc');
    var fbclid = readQuery('fbclid');
    if (!fbc && fbclid) {
      // Synthesize an _fbc value per Meta's spec when only the click id is in the URL.
      fbc = 'fb.1.' + Date.now() + '.' + fbclid;
    }
    return {
      fbp: readCookie('_fbp'),
      fbc: fbc,
      ttclid: readQuery('ttclid') || readCookie('_ttclid'),
      ttp: readCookie('_ttp'),
      scClickId: readQuery('ScCid') || readCookie('_scid'),
      epik: readCookie('_epik'),
      sourceUrl: window.location.href,
    };
  }

  function postSubmission(cfg, payload) {
    payload.tracking = trackingContext();
    return postJson(cfg, '/api/public/submissions', payload);
  }

  function validateAddress(cfg, address) {
    return postJson(cfg, '/api/public/address/validate', {
      shop: cfg.shop,
      address: address,
    });
  }

  function validateDiscountCode(cfg, code, subtotal, productIds) {
    return postJson(cfg, '/api/public/discounts/validate', {
      shop: cfg.shop,
      code: code,
      subtotal: subtotal,
      productIds: productIds || [],
    });
  }
  function requestOtp(cfg, submissionId) {
    return postJson(cfg, '/api/public/otp/request', { submissionId: submissionId });
  }
  function verifyOtp(cfg, submissionId, code, productId, variantId) {
    return postJson(cfg, '/api/public/otp/verify', {
      submissionId: submissionId,
      code: code,
      productId: productId,
      variantId: variantId,
      tracking: trackingContext(),
    });
  }

  function isVisible(field, data) {
    if (!field.conditions || !field.conditions.length) return true;
    return field.conditions.every(function (c) {
      var v = data[c.fieldKey];
      switch (c.operator) {
        case 'eq':
          return String(v == null ? '' : v) === String(c.value == null ? '' : c.value);
        case 'neq':
          return String(v == null ? '' : v) !== String(c.value == null ? '' : c.value);
        case 'contains':
          return String(v == null ? '' : v).indexOf(String(c.value == null ? '' : c.value)) !== -1;
        case 'exists':
          return v != null && String(v).length > 0;
        default:
          return true;
      }
    });
  }

  function validateField(field, value) {
    var str = value == null ? '' : String(value);
    if (field.validation && field.validation.required && str.trim().length === 0) {
      return (field.label || field.key) + ' is required';
    }
    if (field.type === 'email' && str && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str)) {
      return 'Invalid email address';
    }
    if (field.type === 'phone' && str && !/^[+0-9()\-\s]{6,20}$/.test(str)) {
      return 'Invalid phone number';
    }
    if (field.validation && field.validation.minLength && str.length < field.validation.minLength) {
      return (
        (field.label || field.key) +
        ' must be at least ' +
        field.validation.minLength +
        ' characters'
      );
    }
    return null;
  }

  function renderField(field, data, onChange, error, cfg) {
    var widthClass = 'cashflow-cod-col-' + (field.width || 'full');
    var input;
    var common = {
      name: field.key,
      id: 'cod_' + field.key,
      placeholder: field.placeholder || '',
      value: data[field.key] == null ? '' : String(data[field.key]),
      oninput: function (e) {
        onChange(field.key, e.target.value);
      },
    };
    if (field.type === 'textarea') {
      input = el('textarea', Object.assign({}, common, { rows: '3' }), []);
      input.value = common.value;
    } else if (field.type === 'select' || field.type === 'country') {
      var options = (field.options || []).slice();
      if (field.type === 'country' && options.length === 0) {
        options = [
          { value: 'PK', label: 'Pakistan' },
          { value: 'IN', label: 'India' },
          { value: 'BD', label: 'Bangladesh' },
          { value: 'AE', label: 'UAE' },
          { value: 'SA', label: 'Saudi Arabia' },
          { value: 'US', label: 'United States' },
          { value: 'GB', label: 'United Kingdom' },
        ];
      }
      input = el(
        'select',
        {
          name: field.key,
          id: 'cod_' + field.key,
          onchange: function (e) {
            onChange(field.key, e.target.value);
          },
        },
        [el('option', { value: '' }, [field.placeholder || 'Select…'])].concat(
          options.map(function (o) {
            return el(
              'option',
              { value: o.value, selected: data[field.key] === o.value ? 'selected' : null },
              [o.label],
            );
          }),
        ),
      );
    } else if (field.type === 'radio') {
      input = el(
        'div',
        { class: 'cashflow-cod-radio-group' },
        (field.options || []).map(function (o) {
          return el('label', { class: 'cashflow-cod-radio' }, [
            el('input', {
              type: 'radio',
              name: field.key,
              value: o.value,
              checked: data[field.key] === o.value ? 'checked' : null,
              onchange: function (e) {
                onChange(field.key, e.target.value);
              },
            }),
            el('span', null, [o.label]),
          ]);
        }),
      );
    } else if (field.type === 'checkbox') {
      input = el('label', { class: 'cashflow-cod-checkbox' }, [
        el('input', {
          type: 'checkbox',
          name: field.key,
          checked: data[field.key] ? 'checked' : null,
          onchange: function (e) {
            onChange(field.key, e.target.checked);
          },
        }),
        el('span', null, [field.label || field.key]),
      ]);
    } else if (field.type === 'hidden') {
      return el('input', { type: 'hidden', name: field.key, value: common.value });
    } else if (field.type === 'divider') {
      return el('hr', { class: 'cashflow-cod-divider' });
    } else if (field.type === 'html') {
      var w = el('div', { class: 'cashflow-cod-html' });
      w.innerHTML = field.label || '';
      return w;
    } else {
      var type = 'text';
      if (field.type === 'email') type = 'email';
      else if (field.type === 'phone') type = 'tel';
      else if (field.type === 'postal_code') type = 'text';
      input = el('input', Object.assign({}, common, { type: type }));
      if (field.type === 'address' && cfg && cfg.places && cfg.places.enabled) {
        input.setAttribute('autocomplete', 'off');
        setTimeout(function () {
          attachPlacesAutocomplete(input, cfg, function (place) {
            var f = placeToFields(place);
            if (f.address) onChange(field.key, f.address);
            // Auto-fill sibling city/postal/country fields when present.
            try {
              var rootEl = input.closest ? input.closest('.cashflow-cod-widget') : null;
              if (rootEl) {
                var fill = function (selector, value) {
                  if (!value) return;
                  var el2 = rootEl.querySelector(selector);
                  if (el2 && !el2.value) {
                    el2.value = value;
                    var ev = new Event('input', { bubbles: true });
                    el2.dispatchEvent(ev);
                  }
                };
                fill('input[name="city"], input[id$="_city"]', f.city);
                fill('input[name="postal_code"], input[id$="_postal_code"]', f.postal);
                fill('input[name="country"], select[name="country"]', f.country);
              }
            } catch (e) {
              /* noop */
            }
          });
        }, 0);
      }
    }

    var wrapper = el('div', { class: 'cashflow-cod-field ' + widthClass }, []);
    if (field.type !== 'checkbox') {
      wrapper.appendChild(
        el('label', { for: 'cod_' + field.key, class: 'cashflow-cod-label' }, [
          field.label || field.key,
          field.validation && field.validation.required
            ? el('span', { class: 'cashflow-cod-required' }, [' *'])
            : null,
        ]),
      );
    }
    wrapper.appendChild(input);
    if (field.helpText) {
      wrapper.appendChild(el('p', { class: 'cashflow-cod-help' }, [field.helpText]));
    }
    if (error) {
      wrapper.appendChild(el('p', { class: 'cashflow-cod-error' }, [error]));
    }
    return wrapper;
  }

  function styleAccent(accent) {
    // Drive the entire widget palette from a single CSS custom property so
    // hover / focus / active surfaces stay in sync with the merchant accent.
    var style = document.getElementById('cashflow-cod-style-accent');
    if (!style) {
      style = document.createElement('style');
      style.id = 'cashflow-cod-style-accent';
      document.head.appendChild(style);
    }
    style.textContent =
      ':root,.cashflow-cod-widget,.cashflow-cod-backdrop,.cashflow-cod-trigger{--cf-accent:' +
      accent +
      ';}';
  }

  function renderProductCard(cfg) {
    if (!cfg.productTitle) return null;
    var card = el('div', { class: 'cashflow-cod-product-card' });
    if (cfg.productImage) {
      card.appendChild(el('img', { src: cfg.productImage, alt: cfg.productTitle, loading: 'lazy' }));
    }
    var info = el('div', { class: 'cashflow-cod-product-card-info' });
    info.appendChild(el('p', { class: 'cashflow-cod-product-card-title' }, [cfg.productTitle]));
    if (cfg.productVariantTitle) {
      info.appendChild(el('p', { class: 'cashflow-cod-product-card-variant' }, [cfg.productVariantTitle]));
    }
    if (cfg.productPrice) {
      info.appendChild(el('p', { class: 'cashflow-cod-product-card-price' }, [formatMoney(cfg, cfg.productPrice)]));
    }
    card.appendChild(info);
    return card;
  }

  function renderQuantitySelector(cfg, state, render, schema) {
    if (schema && schema.hideQuantity) return null;
    var qty = el('div', { class: 'cashflow-cod-qty' });
    qty.appendChild(el('span', { class: 'cashflow-cod-qty-label' }, [tr(cfg, 'quantity') || 'Quantity']));
    var controls = el('div', { class: 'cashflow-cod-qty-controls' });
    controls.appendChild(el('button', {
      type: 'button', class: 'cashflow-cod-qty-btn',
      disabled: (state.quantity || 1) <= 1 ? 'disabled' : null,
      onclick: function () { state.quantity = Math.max(1, (state.quantity || 1) - 1); cfg.quantity = state.quantity; render(); },
    }, ['\u2212']));
    controls.appendChild(el('span', { class: 'cashflow-cod-qty-value' }, [String(state.quantity || 1)]));
    controls.appendChild(el('button', {
      type: 'button', class: 'cashflow-cod-qty-btn',
      onclick: function () { state.quantity = (state.quantity || 1) + 1; cfg.quantity = state.quantity; render(); },
    }, ['+']));
    qty.appendChild(controls);
    return qty;
  }

  function renderSuccessScreen(cfg, state, schema) {
    var wrap = el('div', { class: 'cashflow-cod-success' });
    var icon = el('div', { class: 'cashflow-cod-success-icon' });
    icon.appendChild(el('svg', { viewBox: '0 0 24 24' }, [
      (function () { var p = document.createElementNS('http://www.w3.org/2000/svg', 'polyline'); p.setAttribute('points', '20 6 9 17 4 12'); return p; })(),
    ]));
    icon.innerHTML = '<svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12" stroke="currentColor" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    wrap.appendChild(icon);
    wrap.appendChild(el('h3', null, [schema.successTitle || 'Thank you!']));
    wrap.appendChild(el('p', null, [state.message || schema.successMessage || 'Your order has been placed.']));
    if (schema.successCustomHtml) {
      var custom = el('div', { class: 'cashflow-cod-success-custom' });
      custom.innerHTML = sanitizeHtml(schema.successCustomHtml);
      wrap.appendChild(custom);
    }
    var share = el('div', { class: 'cashflow-cod-share' });
    var shareUrl = encodeURIComponent(window.location.href);
    var shareText = encodeURIComponent(schema.successTitle || 'I just ordered via COD!');
    share.appendChild(el('button', {
      type: 'button', class: 'cashflow-cod-share-btn', title: 'WhatsApp',
      onclick: function () { window.open('https://wa.me/?text=' + shareText + '%20' + shareUrl, '_blank'); },
    }, [(function () { var d = document.createElement('span'); d.innerHTML = '<svg viewBox="0 0 24 24" fill="#25d366"><path d="M19.05 4.91A10.43 10.43 0 0 0 12 2a10.5 10.5 0 0 0-9.06 15.7L2 22l4.5-1.18A10.5 10.5 0 1 0 19.05 4.91z"/></svg>'; return d.firstChild; })()]));
    share.appendChild(el('button', {
      type: 'button', class: 'cashflow-cod-share-btn', title: 'Facebook',
      onclick: function () { window.open('https://www.facebook.com/sharer/sharer.php?u=' + shareUrl, '_blank'); },
    }, [(function () { var d = document.createElement('span'); d.innerHTML = '<svg viewBox="0 0 24 24" fill="#1877F2"><path d="M24 12c0-6.627-5.373-12-12-12S0 5.373 0 12c0 5.99 4.388 10.954 10.125 11.854V15.47H7.078V12h3.047V9.356c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874V12h3.328l-.532 3.47h-2.796v8.385C19.612 22.954 24 17.99 24 12z"/></svg>'; return d.firstChild; })()]));
    share.appendChild(el('button', {
      type: 'button', class: 'cashflow-cod-share-btn', title: 'Copy link',
      onclick: function () { try { navigator.clipboard.writeText(window.location.href); } catch (e) {} },
    }, [(function () { var d = document.createElement('span'); d.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>'; return d.firstChild; })()]));
    wrap.appendChild(share);
    return wrap;
  }

  function renderForm(cfg, schema, mountInto) {
    var state = {
      stepIdx: 0,
      data: {},
      errors: {},
      status: 'idle',
      message: '',
      submissionId: null,
      otpCode: '',
      otpDestination: '',
      discountCode: '',
      discountApplied: false,
      discountAmount: 0,
      discountError: '',
      quantity: cfg.quantity || 1,
    };

    // Preselect defaults
    (schema.steps || []).forEach(function (s) {
      (s.fields || []).forEach(function (f) {
        if (f.defaultValue != null) state.data[f.key] = f.defaultValue;
      });
    });

    var abandonTimer = null;
    function trackAbandonment() {
      if (state.status === 'submitting' || state.status === 'success') return;
      var hasContact = false;
      var phone = null;
      var email = null;
      Object.keys(state.data).forEach(function (k) {
        var v = state.data[k];
        if (typeof v !== 'string') return;
        if (/phone|mobile|cell/i.test(k) && v.replace(/\D/g, '').length >= 7) {
          phone = v;
          hasContact = true;
        }
        if (/email/i.test(k) && /@/.test(v)) {
          email = v;
          hasContact = true;
        }
      });
      if (!hasContact) return;
      var base = cfg.apiOrigin.replace(/\/+$/, '');
      try {
        fetch(base + '/api/public/abandoned', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            shop: cfg.shop,
            formSlug: cfg.formSlug,
            visitorId: visitorId(),
            phone: phone,
            email: email,
            partialData: state.data,
            lastStep: String(state.stepIdx),
          }),
          keepalive: true,
        }).catch(function () {});
      } catch (e) {
        /* ignore */
      }
    }

    function onChange(key, value) {
      state.data[key] = value;
      if (state.errors[key]) {
        delete state.errors[key];
      }
      if (abandonTimer) clearTimeout(abandonTimer);
      abandonTimer = setTimeout(trackAbandonment, 2000);
      render();
    }

    function validateCurrentStep() {
      var step = schema.steps[state.stepIdx];
      var errors = {};
      step.fields.forEach(function (f) {
        if (!isVisible(f, state.data)) return;
        var err = validateField(f, state.data[f.key]);
        if (err) errors[f.key] = err;
      });
      state.errors = errors;
      return Object.keys(errors).length === 0;
    }

    function goNext() {
      if (!validateCurrentStep()) {
        render();
        return;
      }
      if (state.stepIdx < schema.steps.length - 1) {
        state.stepIdx++;
        render();
      } else {
        submit();
      }
    }

    function goPrev() {
      if (state.stepIdx > 0) {
        state.stepIdx--;
        render();
      }
    }

    function submit() {
      state.status = 'submitting';
      state.message = '';
      render();
      postSubmission(cfg, {
        shop: cfg.shop,
        formSlug: cfg.formSlug,
        visitorId: visitorId(),
        productId: cfg.productId,
        variantId: cfg.variantId,
        productHandle: cfg.productHandle,
        abVariant: cfg.abVariant || null,
        data: state.data,
        discountCode: state.discountApplied ? state.discountCode : null,
        cartSubtotal: cfg.unitPrice && cfg.quantity ? cfg.unitPrice * cfg.quantity : undefined,
        quantity: state.quantity || 1,
        unitPrice: cfg.unitPrice,
      })
        .then(function (res) {
          if (res.status >= 200 && res.status < 300 && res.body && res.body.ok) {
            state.submissionId = res.body.submissionId || null;
            if (res.body.requiresOtp && state.submissionId) {
              requestOtp(cfg, state.submissionId).then(function (r) {
                state.status = 'otp';
                state.otpDestination = (r.body && r.body.destination) || 'your phone';
                state.message = 'Enter the code we sent to ' + state.otpDestination + '.';
                render();
              });
            } else {
              state.status = 'success';
              state.message = res.body.message || 'Order placed';
              render();
            }
          } else {
            state.status = 'idle';
            if (res.body && res.body.fieldErrors) {
              state.errors = res.body.fieldErrors;
            }
            state.message = (res.body && res.body.error) || 'Something went wrong';
            render();
          }
        })
        .catch(function () {
          state.status = 'idle';
          state.message = 'Network error. Please try again.';
          render();
        });
    }

    function submitOtp() {
      if (!state.submissionId || !state.otpCode) return;
      state.status = 'verifying';
      state.message = '';
      render();
      verifyOtp(cfg, state.submissionId, state.otpCode, cfg.productId, cfg.variantId).then(
        function (res) {
          if (res.status >= 200 && res.status < 300 && res.body && res.body.ok) {
            state.status = 'success';
            state.message = res.body.message || 'Order placed';
          } else {
            state.status = 'otp';
            state.message = (res.body && res.body.error) || 'Verification failed';
          }
          render();
        },
        function () {
          state.status = 'otp';
          state.message = 'Network error. Please try again.';
          render();
        },
      );
    }

    function resendOtp() {
      if (!state.submissionId) return;
      state.message = 'Sending a new code…';
      render();
      requestOtp(cfg, state.submissionId).then(function (r) {
        if (r.body && r.body.ok) {
          state.message = 'New code sent to ' + (r.body.destination || state.otpDestination);
        } else {
          state.message = (r.body && r.body.error) || 'Could not resend code';
        }
        render();
      });
    }

    function applyDiscount() {
      var code = (state.discountCode || '').trim();
      if (!code) {
        state.discountError = 'Enter a code';
        render();
        return;
      }
      var subtotal =
        cfg.unitPrice && cfg.quantity ? cfg.unitPrice * cfg.quantity : cfg.unitPrice || 0;
      state.discountError = '';
      validateDiscountCode(cfg, code, subtotal, cfg.productId ? [cfg.productId] : []).then(
        function (res) {
          if (res.body && res.body.ok) {
            state.discountApplied = true;
            state.discountAmount = (res.body.discount && res.body.discount.amount) || 0;
            state.discountError = '';
          } else {
            state.discountApplied = false;
            state.discountAmount = 0;
            state.discountError = (res.body && res.body.error) || tr(cfg, 'invalid');
          }
          render();
        },
      );
    }

    function renderDiscountBlock() {
      var box = el('div', { class: 'cashflow-cod-discount' });
      var row = el('div', { class: 'cashflow-cod-discount-row' });
      row.appendChild(
        el('input', {
          type: 'text',
          class: 'cashflow-cod-discount-input',
          placeholder: tr(cfg, 'discount'),
          value: state.discountCode,
          oninput: function (e) {
            state.discountCode = e.target.value.toUpperCase();
          },
        }),
      );
      row.appendChild(
        el(
          'button',
          {
            type: 'button',
            class: 'cashflow-cod-discount-apply',
            onclick: applyDiscount,
          },
          [state.discountApplied ? tr(cfg, 'applied') : tr(cfg, 'apply')],
        ),
      );
      box.appendChild(row);
      if (state.discountApplied) {
        box.appendChild(
          el('p', { class: 'cashflow-cod-discount-ok' }, [
            tr(cfg, 'applied') + ': -' + formatMoney(cfg, state.discountAmount),
          ]),
        );
      } else if (state.discountError) {
        box.appendChild(el('p', { class: 'cashflow-cod-discount-err' }, [state.discountError]));
      }
      return box;
    }

    function render() {
      mountInto.innerHTML = '';
      var widgetClass =
        'cashflow-cod-widget' +
        (cfg.isRtl ? ' cashflow-cod-rtl' : '') +
        (cfg.activeLanguage ? ' cashflow-cod-lang-' + cfg.activeLanguage.replace('-', '_') : '');
      var w = el('div', { class: widgetClass, dir: cfg.isRtl ? 'rtl' : 'ltr' });
      injectCustomCss(schema, w);
      if (schema.customHtmlHeader) {
        var hdr = el('div', { class: 'cashflow-cod-custom-header' });
        hdr.innerHTML = sanitizeHtml(schema.customHtmlHeader);
        w.appendChild(hdr);
      }
      w.appendChild(
        el('h2', { class: 'cashflow-cod-title' }, [schema.title || 'Cash on Delivery']),
      );
      if (schema.subtitle) {
        w.appendChild(el('p', { class: 'cashflow-cod-subtitle' }, [schema.subtitle]));
      }
      if (schema.trustBadges && schema.trustBadges.length) {
        var trust = el('div', { class: 'cashflow-cod-trust' });
        schema.trustBadges.forEach(function (b) {
          trust.appendChild(el('span', { class: 'cashflow-cod-trust-badge' }, [String(b)]));
        });
        w.appendChild(trust);
      }
      if (schema.steps.length > 1) {
        var stepper = el('div', { class: 'cashflow-cod-stepper' });
        schema.steps.forEach(function (s, i) {
          stepper.appendChild(
            el(
              'div',
              {
                class:
                  'cashflow-cod-step' +
                  (i === state.stepIdx ? ' active' : i < state.stepIdx ? ' done' : ''),
              },
              [
                el('span', { class: 'cashflow-cod-step-num' }, [String(i + 1)]),
                el('span', { class: 'cashflow-cod-step-title' }, [s.title || 'Step ' + (i + 1)]),
              ],
            ),
          );
        });
        w.appendChild(stepper);
      }

      var productCard = renderProductCard(cfg);
      if (productCard) w.appendChild(productCard);

      if (state.status === 'success') {
        w.appendChild(renderSuccessScreen(cfg, state, schema));
      } else if (state.status === 'otp' || state.status === 'verifying') {
        var otpWrap = el('div', { class: 'cashflow-cod-otp' }, [
          el('h3', null, ['Verify your phone']),
          el('p', { class: 'cashflow-cod-help' }, [state.message || '']),
          el('input', {
            type: 'text',
            inputmode: 'numeric',
            autocomplete: 'one-time-code',
            maxlength: '6',
            placeholder: '123456',
            value: state.otpCode,
            oninput: function (e) {
              state.otpCode = e.target.value;
            },
          }),
          el('div', { class: 'cashflow-cod-nav' }, [
            el(
              'button',
              {
                type: 'button',
                class: 'cashflow-cod-prev',
                onclick: resendOtp,
                disabled: state.status === 'verifying' ? 'disabled' : null,
              },
              ['Resend code'],
            ),
            el(
              'button',
              {
                type: 'button',
                class: 'cashflow-cod-submit',
                onclick: submitOtp,
                disabled: state.status === 'verifying' ? 'disabled' : null,
              },
              [state.status === 'verifying' ? 'Verifying…' : 'Verify & place order'],
            ),
          ]),
        ]);
        w.appendChild(otpWrap);
      } else {
        var qtyEl = renderQuantitySelector(cfg, state, render, schema);
        if (qtyEl && state.stepIdx === 0) w.appendChild(qtyEl);

        var step = schema.steps[state.stepIdx];
        var grid = el('div', { class: 'cashflow-cod-grid' });
        (step.fields || []).forEach(function (f) {
          if (!isVisible(f, state.data)) return;
          grid.appendChild(renderField(f, state.data, onChange, state.errors[f.key] || null, cfg));
        });
        w.appendChild(grid);

        if (state.message && state.status === 'idle') {
          w.appendChild(
            el('p', { class: 'cashflow-cod-error cashflow-cod-banner' }, [state.message]),
          );
        }

        var isLast = state.stepIdx === schema.steps.length - 1;
        if (isLast && schema.allowDiscountCode !== false) {
          w.appendChild(renderDiscountBlock());
        }

        var nav = el('div', { class: 'cashflow-cod-nav' });
        if (state.stepIdx > 0) {
          nav.appendChild(
            el('button', { type: 'button', class: 'cashflow-cod-prev', onclick: goPrev }, ['Back']),
          );
        }
        var btnLabel =
          state.status === 'submitting'
            ? 'Placing order…'
            : isLast
              ? schema.submitLabel || 'Place order'
              : 'Next';
        nav.appendChild(
          el(
            'button',
            {
              type: 'button',
              class: isLast ? 'cashflow-cod-submit' : 'cashflow-cod-next',
              disabled: state.status === 'submitting' ? 'disabled' : null,
              onclick: goNext,
            },
            [btnLabel],
          ),
        );
        w.appendChild(nav);
      }

      if (schema.legalText) {
        w.appendChild(el('p', { class: 'cashflow-cod-legal' }, [schema.legalText]));
      }

      if (schema.customHtmlFooter) {
        var ftr = el('div', { class: 'cashflow-cod-custom-footer' });
        ftr.innerHTML = sanitizeHtml(schema.customHtmlFooter);
        w.appendChild(ftr);
      }

      mountInto.appendChild(w);
    }

    render();
  }

  function mountPopup(cfg, schema) {
    var backdrop = el('div', { class: 'cashflow-cod-backdrop' });
    var modal = el('div', { class: 'cashflow-cod-modal' });
    var close = el(
      'button',
      {
        class: 'cashflow-cod-close',
        type: 'button',
        'aria-label': 'Close',
        onclick: function () {
          document.body.removeChild(backdrop);
        },
      },
      ['×'],
    );
    var container = el('div', { class: 'cashflow-cod-container' });
    modal.appendChild(close);
    modal.appendChild(container);
    backdrop.appendChild(modal);
    backdrop.addEventListener('click', function (e) {
      if (e.target === backdrop) document.body.removeChild(backdrop);
    });
    document.body.appendChild(backdrop);
    renderForm(cfg, schema, container);
  }

  function mountInline(cfg, schema, root) {
    var container = el('div', { class: 'cashflow-cod-container cashflow-cod-inline' });
    root.appendChild(container);
    renderForm(cfg, schema, container);
  }

  function mountFloating(cfg, schema, root) {
    var btn = el(
      'button',
      {
        type: 'button',
        class: 'cashflow-cod-trigger cashflow-cod-floating',
        onclick: function () {
          mountPopup(cfg, schema);
        },
      },
      ['Order with COD'],
    );
    document.body.appendChild(btn);
  }

  // Service-worker registration is intentionally disabled. The offline
  // submission queue would need cod-form-sw.js to be served from the
  // merchant's storefront origin (service workers are same-origin only),
  // but theme app extensions ship their assets from
  // extensions.shopifycdn.com — so the SW URL resolves to a 404 on the
  // storefront. We keep the SW source file in the bundle so a future
  // build step can publish it via the App Proxy if/when offline support
  // is re-enabled, but we never call register() from the storefront.
  function registerSw(_cfg) {
    /* no-op */
  }

  function currentPageType() {
    var path = window.location.pathname;
    if (/\/products\//.test(path)) return 'product';
    if (/\/cart\b/.test(path)) return 'cart';
    return 'other';
  }

  function placementMatchesPage(placement) {
    if (!placement || placement === 'custom' || placement === 'landing') return true;
    return currentPageType() === placement;
  }

  function bootRoot(root) {
    if (root.__cashflowBooted) return;
    root.__cashflowBooted = true;
    var cfg = readConfigFromRoot(root);
    if (!cfg) return;
    if (!cfg.apiOrigin) {
      if (window.console && console.warn)
        console.warn(
          '[Cashflow COD] Missing API origin on embed block. Set it in the theme editor.',
        );
      return;
    }
    if (!placementMatchesPage(cfg.placement)) return;
    registerSw(cfg);
    styleAccent(cfg.accent);

    return fetchSchema(cfg).then(
      function (res) {
        var formData = res && res.form;
        var schema = formData && formData.schema;
        if (!schema) {
          console.warn('[Cashflow COD] No form schema returned');
          return;
        }
        if (formData.i18n) cfg.i18n = formData.i18n;
        if (formData.currency) cfg.currency = formData.currency;
        if (formData.places) cfg.places = formData.places;
        cfg.activeLanguage = resolveLanguage(cfg);
        cfg.isRtl = !!RTL_LANGS[cfg.activeLanguage];
        if (res.abVariant) cfg.abVariant = res.abVariant;
        if (res.abSchemaOverride) {
          for (var k in res.abSchemaOverride) schema[k] = res.abSchemaOverride[k];
        }
        if (cfg.places && cfg.places.enabled) loadGooglePlaces(cfg);

        root.__cashflowCfg = cfg;
        root.__cashflowSchema = schema;

        if (cfg.trigger === 'inline') {
          mountInline(cfg, schema, cfg.root);
        } else if (cfg.trigger === 'floating') {
          mountFloating(cfg, schema, cfg.root);
        } else {
          var triggerBtn = cfg.root.querySelector('[data-cashflow-cod-trigger]');
          if (triggerBtn) {
            if (cfg.btnAnimation && cfg.btnAnimation !== 'none') {
              triggerBtn.classList.add('cashflow-cod-anim-' + cfg.btnAnimation);
            }
            triggerBtn.addEventListener('click', function () {
              mountPopup(cfg, schema);
            });
          }
        }
      },
      function (err) {
        if (window.console && console.warn) console.warn('[Cashflow COD]', err);
      },
    );
  }

  function boot() {
    var roots = listRoots();
    for (var i = 0; i < roots.length; i++) bootRoot(roots[i]);
    if (!window.cashflowCod) {
      window.cashflowCod = buildPublicApi();
    }
  }

  function buildPublicApi() {
    function ephemeralCfg(opts) {
      opts = opts || {};
      var apiOrigin = opts.apiOrigin || defaultApiOrigin();
      var shop = opts.shop || defaultShop();
      if (!apiOrigin || !shop) {
        if (window.console && console.warn)
          console.warn('[Cashflow COD] cashflowCod.open(): missing apiOrigin or shop.');
        return null;
      }
      return {
        root: document.body,
        shop: shop,
        formSlug: opts.slug || 'default',
        placement: opts.placement || 'custom',
        trigger: 'button',
        accent: opts.accent || '#008060',
        language: opts.language || 'auto',
        productId: opts.productId || null,
        variantId: opts.variantId || null,
        productHandle: opts.productHandle || null,
        apiOrigin: apiOrigin,
      };
    }

    function open(slug, opts) {
      var cfg = ephemeralCfg(
        Object.assign({}, opts || {}, { slug: slug || (opts && opts.slug) || 'default' }),
      );
      if (!cfg) return Promise.reject(new Error('Missing apiOrigin/shop'));
      styleAccent(cfg.accent);
      return fetchSchema(cfg).then(function (res) {
        var formData = res && res.form;
        var schema = formData && formData.schema;
        if (!schema) throw new Error('No form schema returned');
        if (formData.i18n) cfg.i18n = formData.i18n;
        if (formData.currency) cfg.currency = formData.currency;
        if (formData.places) cfg.places = formData.places;
        cfg.activeLanguage = resolveLanguage(cfg);
        cfg.isRtl = !!RTL_LANGS[cfg.activeLanguage];
        if (cfg.places && cfg.places.enabled) loadGooglePlaces(cfg);
        mountPopup(cfg, schema);
      });
    }

    function mountInlineApi(slug, target, opts) {
      var el = typeof target === 'string' ? document.querySelector(target) : target;
      if (!el) return Promise.reject(new Error('Target element not found'));
      var cfg = ephemeralCfg(Object.assign({}, opts || {}, { slug: slug || 'default' }));
      if (!cfg) return Promise.reject(new Error('Missing apiOrigin/shop'));
      cfg.root = el;
      styleAccent(cfg.accent);
      return fetchSchema(cfg).then(function (res) {
        var formData = res && res.form;
        var schema = formData && formData.schema;
        if (!schema) throw new Error('No form schema returned');
        if (formData.i18n) cfg.i18n = formData.i18n;
        if (formData.currency) cfg.currency = formData.currency;
        if (formData.places) cfg.places = formData.places;
        cfg.activeLanguage = resolveLanguage(cfg);
        cfg.isRtl = !!RTL_LANGS[cfg.activeLanguage];
        if (cfg.places && cfg.places.enabled) loadGooglePlaces(cfg);
        mountInline(cfg, schema, el);
      });
    }

    return {
      open: open,
      mountInline: mountInlineApi,
      version: '1.0',
    };
  }

  // Auto-bind: any element with [data-cashflow-cod-open="<slug>"] opens the
  // form on click. Lets merchants drop a CTA anywhere (theme block, custom
  // section, blog post) without writing JS.
  function bindOpenAttributes() {
    document.addEventListener('click', function (ev) {
      var target = ev.target;
      while (target && target !== document.body) {
        if (target.getAttribute && target.hasAttribute('data-cashflow-cod-open')) {
          var slug = target.getAttribute('data-cashflow-cod-open') || 'default';
          if (window.cashflowCod && window.cashflowCod.open) {
            ev.preventDefault();
            window.cashflowCod.open(slug, {
              productId: target.getAttribute('data-product-id') || null,
              variantId: target.getAttribute('data-variant-id') || null,
              productHandle: target.getAttribute('data-product-handle') || null,
            });
            return;
          }
        }
        target = target.parentNode;
      }
    });
  }

  onReady(function () {
    boot();
    bindOpenAttributes();
  });
})();
