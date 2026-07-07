/**
 * Handles the login form on login.html.
 * There is no register form anywhere in this app — only one administrator
 * account exists, created via the backend seed script.
 */
(function () {
  const { qs, showError, hideError, redirectTo } = window.DiaryUtils;

  const loginForm = qs('#login-form');
  if (!loginForm) return;

  const submitBtn = qs('button[type="submit"]', loginForm);
  const errorEl = qs('#form-error', loginForm);

  // If already logged in, skip the form and go straight to the dashboard.
  (async function redirectIfAuthenticated() {
    try {
      await window.DiaryAPI.auth.me();
      redirectTo('dashboard.html');
    } catch (_err) {
      // Not logged in — stay on the login page. This is the expected path.
    }
  })();

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideError(errorEl);

    const email = qs('#email', loginForm).value.trim();
    const password = qs('#password', loginForm).value;

    submitBtn.disabled = true;
    submitBtn.textContent = 'Logging in...';

    try {
      await window.DiaryAPI.auth.login({ email, password });
      redirectTo('dashboard.html');
    } catch (err) {
      showError(errorEl, err.message || 'Login failed. Please try again.');
      submitBtn.disabled = false;
      submitBtn.textContent = 'Log In';
    }
  });
})();
