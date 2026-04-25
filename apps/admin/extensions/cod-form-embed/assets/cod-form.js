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

  function readConfig() {
    var root = document.getElementById('cashflow-cod-root');
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
      apiOrigin: root.dataset.api || '',
    };
  }

  function fetchSchema(cfg) {
    var base = cfg.apiOrigin.replace(/\/+$/, '');
    var url =
      base +
      '/api/public/forms/' +
      encodeURIComponent(cfg.formSlug) +
      '?shop=' +
      encodeURIComponent(cfg.shop);
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

  function renderField(field, data, onChange, error) {
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
    var style = document.getElementById('cashflow-cod-style-accent');
    if (!style) {
      style = document.createElement('style');
      style.id = 'cashflow-cod-style-accent';
      document.head.appendChild(style);
    }
    style.textContent =
      '.cashflow-cod-widget .cashflow-cod-submit,' +
      '.cashflow-cod-widget .cashflow-cod-next {' +
      'background:' +
      accent +
      ';border-color:' +
      accent +
      ';}' +
      '.cashflow-cod-trigger{background:' +
      accent +
      ';}' +
      '.cashflow-cod-widget input:focus,.cashflow-cod-widget select:focus,.cashflow-cod-widget textarea:focus{border-color:' +
      accent +
      ';}' +
      '.cashflow-cod-step.active .cashflow-cod-step-num{background:' +
      accent +
      ';}';
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
        data: state.data,
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

    function render() {
      mountInto.innerHTML = '';
      var w = el('div', { class: 'cashflow-cod-widget' });
      w.appendChild(
        el('h2', { class: 'cashflow-cod-title' }, [schema.title || 'Cash on Delivery']),
      );
      if (schema.subtitle) {
        w.appendChild(el('p', { class: 'cashflow-cod-subtitle' }, [schema.subtitle]));
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

      if (state.status === 'success') {
        w.appendChild(
          el('div', { class: 'cashflow-cod-success' }, [
            el('h3', null, ['Thank you!']),
            el('p', null, [state.message || 'Your order has been placed.']),
          ]),
        );
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
        var step = schema.steps[state.stepIdx];
        var grid = el('div', { class: 'cashflow-cod-grid' });
        (step.fields || []).forEach(function (f) {
          if (!isVisible(f, state.data)) return;
          grid.appendChild(renderField(f, state.data, onChange, state.errors[f.key] || null));
        });
        w.appendChild(grid);

        if (state.message && state.status === 'idle') {
          w.appendChild(
            el('p', { class: 'cashflow-cod-error cashflow-cod-banner' }, [state.message]),
          );
        }

        var nav = el('div', { class: 'cashflow-cod-nav' });
        if (state.stepIdx > 0) {
          nav.appendChild(
            el('button', { type: 'button', class: 'cashflow-cod-prev', onclick: goPrev }, ['Back']),
          );
        }
        var isLast = state.stepIdx === schema.steps.length - 1;
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

  function registerSw(cfg) {
    if (!('serviceWorker' in navigator)) return;
    try {
      var swUrl = (cfg.assetBase || '') + '/cod-form-sw.js';
      navigator.serviceWorker
        .register(swUrl, { scope: '/' })
        .then(function (reg) {
          if (reg && reg.active) {
            reg.active.postMessage({ type: 'drain-queue' });
          }
        })
        .catch(function () {});
      window.addEventListener('online', function () {
        navigator.serviceWorker.getRegistration().then(function (reg) {
          if (reg && reg.active) reg.active.postMessage({ type: 'drain-queue' });
        });
      });
    } catch (_e) {
      /* ignore */
    }
  }

  function boot() {
    var cfg = readConfig();
    if (!cfg) return;
    if (window.__CASHFLOW_COD_BOOTED__) return;
    window.__CASHFLOW_COD_BOOTED__ = true;

    if (!cfg.apiOrigin) {
      if (window.console && console.warn)
        console.warn(
          '[Cashflow COD] Missing API origin on embed block. Set it in the theme editor.',
        );
      return;
    }

    registerSw(cfg);
    styleAccent(cfg.accent);

    fetchSchema(cfg).then(
      function (res) {
        var schema = res && res.form && res.form.schema;
        if (!schema) {
          console.warn('[Cashflow COD] No form schema returned');
          return;
        }
        if (cfg.trigger === 'inline') {
          mountInline(cfg, schema, cfg.root);
        } else if (cfg.trigger === 'floating') {
          mountFloating(cfg, schema, cfg.root);
        } else {
          var triggerBtn = cfg.root.querySelector('[data-cashflow-cod-trigger]');
          if (triggerBtn) {
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

  onReady(boot);
})();
