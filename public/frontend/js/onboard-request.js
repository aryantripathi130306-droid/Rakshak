/**
 * Rakshak — Department Onboarding Request Controller
 * Handles public department access requests.
 * Explicitly establishes a pending application, never an active account.
 */

import { submitDepartmentOnboardingRequest } from './api.js';

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('dept-onboard-form');
  const submitBtn = document.getElementById('onboard-submit-btn');
  const spinner = document.getElementById('onboard-spinner');
  const btnText = document.getElementById('onboard-btn-text');
  const alertBox = document.getElementById('onboard-alert');
  const alertMsg = document.getElementById('onboard-alert-msg');
  const successCard = document.getElementById('onboard-success-card');
  const successReqId = document.getElementById('success-req-id');

  function showAlert(msg, type = 'error') {
    if (!alertBox || !alertMsg) return;
    alertMsg.textContent = msg;
    alertBox.className = `auth-alert ${type}`;
    alertBox.classList.remove('hidden');
  }

  function hideAlert() {
    if (alertBox) alertBox.classList.add('hidden');
  }

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      hideAlert();

      const departmentName = document.getElementById('dept-name')?.value?.trim();
      const jurisdiction = document.getElementById('dept-jurisdiction')?.value?.trim();
      const nodalOfficerName = document.getElementById('nodal-officer-name')?.value?.trim();
      const nodalOfficerBadge = document.getElementById('nodal-officer-badge')?.value?.trim();
      const nodalEmail = document.getElementById('nodal-email')?.value?.trim();
      const contactPhone = document.getElementById('contact-phone')?.value?.trim();
      const authorizationRef = document.getElementById('authorization-ref')?.value?.trim();

      if (!departmentName || !jurisdiction || !nodalOfficerName || !nodalOfficerBadge || !nodalEmail || !authorizationRef) {
        showAlert('Please fill in all mandatory institutional fields marked with *.', 'error');
        return;
      }

      if (!nodalEmail.includes('@') || !nodalEmail.includes('.')) {
        showAlert('Please enter a valid official institutional email address.', 'error');
        return;
      }

      // Enter loading state
      if (submitBtn) submitBtn.disabled = true;
      if (spinner) spinner.classList.remove('hidden');
      if (btnText) btnText.textContent = 'Transmitting Request…';

      try {
        const payload = {
          departmentName,
          jurisdiction,
          nodalOfficerName,
          nodalOfficerBadge,
          nodalEmail,
          contactPhone,
          authorizationRef,
        };

        const res = await submitDepartmentOnboardingRequest(payload);

        if (res && res.success) {
          form.classList.add('hidden');
          if (successReqId) {
            successReqId.textContent = res.requestId || `REQ-${Date.now().toString(36).toUpperCase()}`;
          }
          if (successCard) {
            successCard.classList.remove('hidden');
          }
        } else {
          showAlert(res?.error || 'Failed to submit onboarding request. Please verify details.', 'error');
          if (submitBtn) submitBtn.disabled = false;
          if (spinner) spinner.classList.add('hidden');
          if (btnText) btnText.textContent = 'Submit Request for Platform Verification';
        }
      } catch (err) {
        showAlert(err?.message || 'Network error while submitting onboarding request.', 'error');
        if (submitBtn) submitBtn.disabled = false;
        if (spinner) spinner.classList.add('hidden');
        if (btnText) btnText.textContent = 'Submit Request for Platform Verification';
      }
    });
  }
});
