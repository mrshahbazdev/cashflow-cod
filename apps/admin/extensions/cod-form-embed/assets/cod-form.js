/* Cashflow COD — storefront form widget (scaffold).
 * Phase 1 PR will replace this with a Preact bundle that renders the
 * form schema fetched from the Cashflow COD API.
 */
(function () {
  'use strict';

  var API_ORIGIN = 'https://api.cashflowcod.app';

  function onReady(fn) {
    if (document.readyState !== 'loading') {
      fn();
    } else {
      document.addEventListener('DOMContentLoaded', fn);
    }
  }

  function boot() {
    var root = document.getElementById('cashflow-cod-root');
    if (!root) return;

    var cfg = {
      shop: root.dataset.shop,
      formSlug: root.dataset.formSlug || 'default',
      placement: root.dataset.placement,
      trigger: root.dataset.trigger,
      accent: root.dataset.accent,
      language: root.dataset.language || 'auto',
      productId: root.dataset.productId || null,
      variantId: root.dataset.variantId || null,
    };

    if (window.__CASHFLOW_COD_CONFIG__) return;
    window.__CASHFLOW_COD_CONFIG__ = cfg;
    window.__CASHFLOW_COD_API__ = API_ORIGIN;

    var trigger = root.querySelector('[data-cashflow-cod-trigger]');
    if (trigger) {
      trigger.addEventListener('click', function () {
        // Phase 1 PR: dynamically import the form bundle and render a popup.
        console.info('[Cashflow COD] widget click', cfg);
        alert('Cashflow COD form will render here — scaffold stub.');
      });
    }
  }

  onReady(boot);
})();
