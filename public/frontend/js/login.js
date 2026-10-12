/**
 * Rakshak v3.0 — Secure Officer Login Controller
 * Handles credentials submission, show/hide password, session checks,
 * safe redirection, and accessible error handling.
 */

import { loginOfficer, getCurrentOfficerSession } from './api.js';

const EYE_OPEN_SVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"></path>
  <circle cx="12" cy="12" r="3"></circle>
</svg>`;

const EYE_OFF_SVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"></path>
  <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"></path>
  <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"></path>
  <line x1="2" y1="2" x2="22" y2="22"></line>
</svg>`;

document.addEventListener('DOMContentLoaded', async () => {
  const form = document.getElementById('officer-login-form');
  const identifierInput = document.getElementById('officer-identifier');
  const passwordInput = document.getElementById('officer-password');
  const togglePasswordBtn = document.getElementById('toggle-password-btn');
  const submitBtn = document.getElementById('login-submit-btn');
  const spinner = document.getElementById('login-btn-spinner');
  const btnText = document.getElementById('login-btn-text');
  const btnArrow = document.getElementById('login-btn-arrow');
  const rememberCheckbox = document.getElementById('remember-me');
  const alertBox = document.getElementById('auth-alert');
  const alertIcon = document.getElementById('auth-alert-icon');
  const alertMsg = document.getElementById('auth-alert-msg');

  // ─── Restore Remembered Identifier (Safe Client Preference) ─────────────────
  try {
    const savedIdentifier = localStorage.getItem('rakshak_remembered_identifier');
    if (savedIdentifier && identifierInput) {
      identifierInput.value = savedIdentifier;
      if (rememberCheckbox) rememberCheckbox.checked = true;
      // Focus password input if identifier is already remembered
      if (passwordInput) passwordInput.focus();
    }
  } catch (_) {}

  // ─── Quick Fill Demo Credentials ─────────────────────────────────────────────
  const fillDemoBtn = document.getElementById('btn-fill-demo-creds');
  if (fillDemoBtn) {
    fillDemoBtn.addEventListener('click', () => {
      if (identifierInput) identifierInput.value = 'DL-CYBER-001';
      if (passwordInput) passwordInput.value = 'Rakshak@2026!';
      if (rememberCheckbox) rememberCheckbox.checked = true;
      if (submitBtn) submitBtn.focus();
    });
  }

  // ─── Check Query Parameters (e.g. Session Expired or Logged Out) ────────────
  const urlParams = new URLSearchParams(window.location.search);
  const rawReturnUrl = urlParams.get('returnUrl') || urlParams.get('redirect') || '';
  const isExpired = urlParams.get('expired') === '1' || urlParams.get('session_expired') === '1';
  const isLoggedOut = urlParams.get('loggedOut') === '1';

  if (isExpired) {
    showAlert('Your session has expired. Please authenticate with your credentials to resume.', 'warning');
  } else if (isLoggedOut) {
    showAlert('You have been securely signed out of the platform.', 'info');
  }

  // ─── Validate Safe Return URL (Prevent Open Redirects) ──────────────────────
  function getSafeDestination() {
    if (rawReturnUrl && rawReturnUrl.startsWith('/') && !rawReturnUrl.startsWith('//') && !rawReturnUrl.includes('login.html')) {
      return rawReturnUrl;
    }
    return '/frontend/pages/dashboard.html';
  }

  // ─── Check if Already Authenticated ─────────────────────────────────────────
  try {
    const active = await getCurrentOfficerSession();
    if (active && active.officer && active.officer.status === 'ACTIVE') {
      window.location.replace(getSafeDestination());
      return;
    }
  } catch (_) {
    // Unauthenticated, remain on login page
  }

  // ─── Show / Hide Password Toggle ────────────────────────────────────────────
  if (togglePasswordBtn && passwordInput) {
    togglePasswordBtn.addEventListener('click', () => {
      const isPassword = passwordInput.type === 'password';
      passwordInput.type = isPassword ? 'text' : 'password';
      togglePasswordBtn.innerHTML = isPassword ? EYE_OFF_SVG : EYE_OPEN_SVG;
      togglePasswordBtn.setAttribute('aria-label', isPassword ? 'Hide password' : 'Show password');
      togglePasswordBtn.setAttribute('title', isPassword ? 'Hide password' : 'Show password');
    });
  }

  // ─── Alert Helpers ──────────────────────────────────────────────────────────
  function showAlert(message, type = 'error') {
    if (!alertBox || !alertMsg) return;
    alertMsg.textContent = message;
    alertBox.className = `neu-alert ${type}`;
    if (alertIcon) {
      alertIcon.textContent = type === 'error' ? '⚠️' : type === 'warning' ? '⏳' : 'ℹ️';
    }
    alertBox.classList.remove('hidden');
  }

  function hideAlert() {
    if (alertBox) {
      alertBox.classList.add('hidden');
    }
  }

  // ─── Form Submission ────────────────────────────────────────────────────────
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      hideAlert();

      const identifier = identifierInput ? identifierInput.value.trim() : '';
      const password = passwordInput ? passwordInput.value : '';

      if (!identifier) {
        showAlert('Please enter your officer username, badge number, or email.', 'error');
        identifierInput?.focus();
        return;
      }

      if (!password) {
        showAlert('Please enter your password.', 'error');
        passwordInput?.focus();
        return;
      }

      // Handle Remember Me (Stores only identifier, never credentials or tokens)
      try {
        if (rememberCheckbox && rememberCheckbox.checked) {
          localStorage.setItem('rakshak_remembered_identifier', identifier);
        } else {
          localStorage.removeItem('rakshak_remembered_identifier');
        }
      } catch (_) {}

      // Enter loading state
      setLoading(true);

      try {
        const response = await loginOfficer(identifier, password);

        if (response && response.success && response.officer) {
          showAlert(`Authentication successful. Redirecting to workspace…`, 'info');
          
          setTimeout(() => {
            window.location.href = getSafeDestination();
          }, 350);
        } else {
          showAlert(response?.error || 'Invalid badge number, email, or password.', 'error');
          setLoading(false);
        }
      } catch (err) {
        const errorMessage = err?.status === 401
          ? 'Invalid badge number, email, or password.'
          : (err?.message || 'Authentication service error. Please try again or contact IT support.');
        
        showAlert(errorMessage, 'error');
        setLoading(false);
      }
    });
  }

  function setLoading(isLoading) {
    if (submitBtn) submitBtn.disabled = isLoading;
    if (identifierInput) identifierInput.disabled = isLoading;
    if (passwordInput) passwordInput.disabled = isLoading;
    if (spinner) spinner.classList.toggle('hidden', !isLoading);
    if (btnArrow) btnArrow.style.display = isLoading ? 'none' : 'inline-block';
    if (btnText) btnText.textContent = isLoading ? 'Verifying…' : 'Sign In';
  }
});
