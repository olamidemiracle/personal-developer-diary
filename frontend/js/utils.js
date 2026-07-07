/**
 * Shared, framework-free utility helpers used across pages.
 * Attached to window.DiaryUtils to avoid polluting the global namespace.
 */
(function () {
  function qs(selector, scope) {
    return (scope || document).querySelector(selector);
  }

  function qsa(selector, scope) {
    return Array.from((scope || document).querySelectorAll(selector));
  }

  function showError(el, message) {
    if (!el) return;
    el.textContent = message;
    el.hidden = false;
  }

  function hideError(el) {
    if (!el) return;
    el.textContent = '';
    el.hidden = true;
  }

  function redirectTo(path) {
    window.location.href = path;
  }

  /**
   * Wires up the shared site header (mobile nav toggle + active link
   * highlighting) and footer (current year). Safe to call on every page;
   * it no-ops if the elements aren't present.
   */
  function initChrome() {
    const toggle = qs('#navToggle');
    const nav = qs('#siteNav');

    if (toggle && nav) {
      toggle.addEventListener('click', () => {
        const isOpen = nav.classList.toggle('is-open');
        toggle.classList.toggle('is-open', isOpen);
        toggle.setAttribute('aria-expanded', String(isOpen));
      });

      qsa('.nav-link', nav).forEach((link) => {
        link.addEventListener('click', () => {
          nav.classList.remove('is-open');
          toggle.classList.remove('is-open');
          toggle.setAttribute('aria-expanded', 'false');
        });
      });
    }

    // Highlight the current page in the nav
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';
    qsa('.nav-link').forEach((link) => {
      const linkPage = link.getAttribute('href');
      if (linkPage === currentPage) {
        link.classList.add('is-active');
      }
    });

    const yearEl = qs('#year');
    if (yearEl) {
      yearEl.textContent = new Date().getFullYear();
    }
  }

  /**
   * Fades/slides elements with the `.reveal` class into view as they enter
   * the viewport. Falls back to instantly visible if IntersectionObserver
   * isn't available.
   */
  function initScrollReveal() {
    const targets = qsa('.reveal');
    if (!targets.length) return;

    if (!('IntersectionObserver' in window)) {
      targets.forEach((el) => el.classList.add('is-visible'));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12 }
    );

    targets.forEach((el) => observer.observe(el));
  }

  /**
   * Shows a brief, dismissible toast notification (e.g. "Entry deleted
   * successfully"). Reuses a single toast element across calls.
   */
  function showToast(message, variant = 'success') {
    let toast = qs('#appToast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'appToast';
      toast.className = 'toast';
      document.body.appendChild(toast);
    }

    toast.textContent = message;
    toast.className = `toast toast--${variant} is-visible`;

    clearTimeout(toast._hideTimer);
    toast._hideTimer = setTimeout(() => {
      toast.classList.remove('is-visible');
    }, 3200);
  }

  window.DiaryUtils = {
    qs,
    qsa,
    showError,
    hideError,
    redirectTo,
    initChrome,
    initScrollReveal,
    showToast,
  };
})();
