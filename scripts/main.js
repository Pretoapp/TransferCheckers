// scripts/main.js

// Ensure this path is correct and Vite is serving your compiled API files.
import { fetchTransferData } from './api/index.js'; // Make sure this path is correct

document.addEventListener('DOMContentLoaded', () => {
  console.log('0. DOMContentLoaded event fired. Initializing main.js...');

  /* -------------------------------------------------- *
 * Loading overlay helper — polished UX
 * - Min-visible duration
 * - Auto-re-entrancy guard
 * - Scroll-lock
 * -------------------------------------------------- */
  const overlay      = document.getElementById('loadingOverlay');
  const loaderTextEl = document.getElementById('loaderText');
  let overlayShown = false;
  let visibleSince = 0;
  const MIN_SPINNER_MS = 600;   // feel free to tweak

  // This is the consolidated showLoading function (formerly "pro-grade")
  function showLoading(msg = 'SWIFT Connecting…') { 
    console.log('DEBUG: showLoading() called.'); // Combined console log
    if (!overlay || overlayShown) return;
    overlayShown = true;
    visibleSince = Date.now();
    if (loaderTextEl) loaderTextEl.textContent = msg;

    overlay.style.display = 'flex';
    overlay.removeAttribute('aria-hidden');
    document.body.style.overflow = 'hidden'; // Prevent background scroll
    // Using requestAnimationFrame for smoother class addition
    requestAnimationFrame(() => {
        // A tiny delay can sometimes help ensure the transition is picked up after display:flex is applied
        requestAnimationFrame(() => {
            overlay.classList.add('is-active'); // Use .is-active
        });
    });

    if (submitButton) submitButton.disabled = true;
    if (referenceInput) referenceInput.disabled = true;
  }

  // This is the consolidated hideLoading function (formerly "pro-grade")
  function hideLoading() {
    console.log('DEBUG: hideLoading() called.'); // Combined console log
    if (!overlay || !overlayShown) return;
    const elapsed = Date.now() - visibleSince;
    const wait = Math.max(0, MIN_SPINNER_MS - elapsed);

    setTimeout(() => {
      overlay.classList.remove('is-active'); // Use .is-active
      overlay.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = ''; // Restore scroll
      // Wait for the CSS fade-out transition (e.g., 400ms) before setting display to 'none'
      setTimeout(() => {
        overlay.style.display = 'none';
      }, 400); // Match CSS fade duration
      overlayShown = false;

      if (submitButton) submitButton.disabled = false;
      if (referenceInput) referenceInput.disabled = false;
    }, wait);
  }


  // --- Elements for Verification Form ---
  const verifyForm = document.getElementById('verifyForm');
  const referenceInput = document.getElementById('referenceInput');
  const submitButton = verifyForm ? verifyForm.querySelector('button[type="submit"]') : null;
  // loadingOverlay already defined above
  const errorMessageContainer = document.getElementById('errorMessageContainer');

  // --- Elements for Modal ---
  const modal = document.getElementById('infoModal');
  const closeModalButton = modal ? modal.querySelector('.close-button') : null;
  const modalTitleElement = document.getElementById('modalTitle');
  const modalBodyElement = document.getElementById('modalBody');
  const privacyLink = document.querySelector('a[href="#privacy"]');
  const termsLink = document.querySelector('a[href="#terms"]');
  const contactLink = document.querySelector('a[href="#contact"]');

  // --- Check for essential form elements ---
  let formElementsPresent = true;
  if (!verifyForm) {
    console.error('MAIN.JS ERROR: verifyForm element not found!');
    formElementsPresent = false;
  }
  if (!referenceInput) {
    console.error('MAIN.JS ERROR: referenceInput element not found!');
    formElementsPresent = false;
  }
  if (!submitButton && verifyForm) {
    console.error('MAIN.JS ERROR: Submit button within verifyForm not found!');
    formElementsPresent = false;
  }
  if (!overlay) { // Check for the consolidated overlay variable
    console.warn('MAIN.JS WARN: loadingOverlay element not found! Loading state will be less obvious.');
  }
  if (!errorMessageContainer) {
    console.warn('MAIN.JS WARN: errorMessageContainer element not found! Form validation errors might not display as intended.');
  }

  // --- Check for essential modal elements ---
  if (!modal || !closeModalButton || !modalTitleElement || !modalBodyElement) {
    console.error('MAIN.JS ERROR: Essential modal elements (modal container, close button, title, or body) are missing.');
  }

  // --- Verification Form Functions ---
  // The showLoading and hideLoading functions previously here have been removed
  // as they are now consolidated at the top of the DOMContentLoaded scope.

  const displayFormError = (message) => {
    console.log('DEBUG: displayFormError() called with message:', message);
    if (!errorMessageContainer || !referenceInput) {
      console.warn("MAIN.JS WARN: Cannot display form error: errorMessageContainer or referenceInput missing.");
      alert(message); // Fallback
      return;
    }
    errorMessageContainer.textContent = message;
    errorMessageContainer.style.display = 'block';
    referenceInput.classList.add('input-error');
    referenceInput.focus();
  };

  const clearFormError = () => {
    console.log('DEBUG: clearFormError() called.');
    if (!errorMessageContainer || !referenceInput) return;
    errorMessageContainer.textContent = '';
    errorMessageContainer.style.display = 'none';
    referenceInput.classList.remove('input-error');
  };

  if (referenceInput) {
    referenceInput.addEventListener('input', () => {
      if (referenceInput.classList.contains('input-error')) {
        clearFormError();
      }
    });
  } else if (formElementsPresent) {
    console.warn("MAIN.JS WARN: referenceInput not found for attaching 'input' event listener.");
  }

  // --- Modal Functions ---
  const openModal = (title, contentHTML) => {
    console.log('DEBUG: openModal() called. Title:', title);
    if (!modal || !modalTitleElement || !modalBodyElement) {
      console.error("MAIN.JS ERROR: Cannot open modal: one or more modal elements are missing.");
      return;
    }
    modalTitleElement.textContent = title;
    modalBodyElement.innerHTML = contentHTML; // SECURITY NOTE: Ensure contentHTML is safe if it contains user-generated content. Our displayApiResultInModal uses escapeHTML for dynamic parts.
    modal.style.display = 'flex';
    modal.style.opacity = '0'; // Start transparent for fade-in
    requestAnimationFrame(() => {
      requestAnimationFrame(() => { // Double requestAnimationFrame for smoother transitions
        modal.style.opacity = '1';
        modal.classList.add('is-visible'); // Assuming .is-visible is for modal visibility
      });
    });
  };

  const closeModal = () => {
    console.log('DEBUG: closeModal() called.');
    if (!modal) return;
    modal.style.opacity = '0';
    modal.classList.remove('is-visible'); // Assuming .is-visible is for modal visibility
    setTimeout(() => {
      modal.style.display = 'none';
      modalTitleElement.textContent = '';
      modalBodyElement.innerHTML = '';
    }, 400); // Match CSS transition duration
  };

  if (closeModalButton) {
    closeModalButton.onclick = closeModal;
  } else if (modal) {
    console.warn("MAIN.JS WARN: Modal close button not found.");
  }

  window.addEventListener('click', (event) => {
    if (modal && event.target === modal && modal.style.display === 'flex') {
      closeModal();
    }
  });

  document.addEventListener('keydown', (event) => {
    if (modal && event.key === "Escape" && modal.style.display === 'flex') {
      closeModal();
    }
  });


  // --- Helper function to escape HTML special characters ---
  const escapeHTML = (str) => {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  };

  // --- Helper function to get status CSS class ---
  const getStatusClass = (status) => {
    if (!status) return 'status-info';
    const lowerStatus = String(status).toLowerCase();
    if (lowerStatus.includes('success') || lowerStatus.includes('completed') || lowerStatus.includes('verified') || lowerStatus.includes('paid')) {
      return 'status-success';
    }
    if (lowerStatus.includes('pending') || lowerStatus.includes('processing') || lowerStatus.includes('in_progress')) {
      return 'status-pending';
    }
    if (lowerStatus.includes('fail') || lowerStatus.includes('error') || lowerStatus.includes('rejected') || lowerStatus.includes('cancelled')) {
      return 'status-failed';
    }
    return 'status-info';
  };

  // --- Function to display API results in Modal (PROFESSIONAL VERSION) ---
  const displayApiResultInModal = (data) => {
    console.log('DEBUG: displayApiResultInModal() called with data:', data);

    // 1) Bail if invalid core data, or handle pre-set error objects
    if (!data || !data.status) {
      const reasonMessage = data && data.reason ? escapeHTML(data.reason) : 'Invalid or incomplete data received by display function.';
      const errorTxIdHTML = data && data.transactionID ? `<dt>Reference:</dt><dd><span class="tx-id">${escapeHTML(data.transactionID)}</span></dd>` : '';
      const errorTitle = (data && data.status) ? `Transfer Status: ${data.status.charAt(0).toUpperCase() + data.status.slice(1)}` : 'Transfer Status Error';

      openModal(errorTitle, `
        <div class="modal-text-content">
          <dl class="result-details">
            <dt>Status:</dt>
            <dd class="${data && data.status ? getStatusClass(data.status) : 'status-failed'}"><strong>${data && data.status ? escapeHTML(data.status.toUpperCase()) : 'ERROR'}</strong></dd>
            <dt>Details:</dt>
            <dd>${reasonMessage}</dd>
            ${errorTxIdHTML}
          </dl>
        </div>`);
      return;
    }

    // 2) Prepare the modal title
    const statusString = escapeHTML(data.status);
    const title = `Transfer Status: ${statusString.charAt(0).toUpperCase() + statusString.slice(1)}`;
    const statusClass = getStatusClass(data.status);

    // 3) Start building contentHTML
    let contentHTML = `<div class="modal-text-content">`;
    contentHTML += `<dl class="result-details">`;

    // ─── General Transfer Information ───
    contentHTML += `
      <dt>Status:</dt>
      <dd class="${statusClass}"><strong>${statusString.toUpperCase()}</strong></dd>`;

    if (data.transactionID) {
      contentHTML += `
      <dt>Transaction ID:</dt>
      <dd><span class="tx-id">${escapeHTML(data.transactionID)}</span></dd>`;
    }

    if (data.valueDate) {
      contentHTML += `
      <dt>Date:</dt>
      <dd>${escapeHTML(data.valueDate)}</dd>`;
    }

    if (data.amount) {
      const amountStr = escapeHTML(data.amount);
      const currencyStr = data.currency ? ` ${escapeHTML(data.currency)}` : '';
      contentHTML += `
      <dt>Amount:</dt>
      <dd><span class="amount">${amountStr}${currencyStr}</span></dd>`;
    }

    if (data.remittanceInfo) {
      contentHTML += `
      <dt>Remittance Info:</dt>
      <dd>${escapeHTML(data.remittanceInfo)}</dd>`;
    }

    // Display reason if status is failed/info and reason is provided
    if (data.reason && (statusClass === 'status-failed' || statusClass === 'status-info')) {
      contentHTML += `
      <dt>Details:</dt>
      <dd>${escapeHTML(data.reason)}</dd>`;
    }

    contentHTML += `</dl>`; // End of general transfer information dl

    // ─── Separator ───
    contentHTML += `<hr class="modal-section-separator">`;

    // ─── Parties Information ───
    if (data.rawValue && data.rawValue.orderingCustomer) {
      const oc = data.rawValue.orderingCustomer;
      contentHTML += `
        <h4 class="details-subtitle">Sender Details</h4>
        <div class="detail-group">
          ${oc.name ? `<p><strong>Name:</strong> ${escapeHTML(oc.name)}</p>` : ''}
          ${oc.account ? `<p><strong>Account:</strong> <span class="account-id">${escapeHTML(oc.account)}</span></p>` : ''}
          ${oc.bic ? `<p><strong>BIC/SWIFT:</strong> <span class="identifier-code">${escapeHTML(oc.bic)}</span></p>` : ''}
          ${oc.bankName ? `<p><strong>Bank Name:</strong> ${escapeHTML(oc.bankName)}</p>` : ''}
          ${oc.bankAddress ? `<p><strong>Bank Address:</strong> <span class="address">${escapeHTML(oc.bankAddress)}</span></p>` : ''}
        </div>`;
    }

    if (data.rawValue && data.rawValue.beneficiaryCustomer) {
      const bc = data.rawValue.beneficiaryCustomer;
      contentHTML += `
        <h4 class="details-subtitle">Recipient Details</h4>
        <div class="detail-group">
          ${bc.name ? `<p><strong>Name:</strong> ${escapeHTML(bc.name)}</p>` : ''}
          ${bc.account ? `<p><strong>Account:</strong> <span class="account-id">${escapeHTML(bc.account)}</span></p>` : ''}
          ${bc.bic ? `<p><strong>BIC/SWIFT:</strong> <span class="identifier-code">${escapeHTML(bc.bic)}</span></p>` : ''}
          ${bc.bankName ? `<p><strong>Bank Name:</strong> ${escapeHTML(bc.bankName)}</p>` : ''}
          ${bc.bankAddress ? `<p><strong>Bank Address:</strong> <span class="address">${escapeHTML(bc.bankAddress)}</span></p>` : ''}
        </div>`;
    }

    contentHTML += `</div>`; // close .modal-text-content

    // 4) Render into the modal
    openModal(title, contentHTML);
  };


  // --- Handle verification form submission ---
  if (verifyForm && formElementsPresent) {
    verifyForm.addEventListener('submit', async (event) => {
      console.log('1. Verify Now button clicked. Form elements present:', formElementsPresent);
      event.preventDefault();
      clearFormError();

      const referenceValue = referenceInput.value.trim();
      console.log('2. Reference value entered:', referenceValue);

      if (!referenceValue) {
        console.log('2a. Reference value is empty. Displaying form error.');
        displayFormError('Transfer Reference ID cannot be empty.');
        return;
      }

      console.log('3. Calling showLoading().');
      showLoading(); // Call the consolidated showLoading function

      try {
        console.log('4. Attempting to call fetchTransferData with value:', referenceValue);
        if (typeof fetchTransferData !== 'function') {
          console.error("MAIN.JS CRITICAL ERROR: fetchTransferData is not a function! Check import from './api/index.js'.");
          displayApiResultInModal({
            status: 'ERROR',
            reason: 'Client-side setup error: Core API function not loaded.',
            transactionID: referenceValue
          });
          return;
        }
        const result = await fetchTransferData(referenceValue);
        console.log('5. fetchTransferData API call returned:', result);
        displayApiResultInModal(result);
      } catch (error) {
        console.error("6. ERROR occurred directly after calling fetchTransferData or in displayApiResultInModal:", error);
        displayApiResultInModal({
          status: 'ERROR',
          reason: `Client-side error processing request: ${error.message || 'Unknown error occurred.'}`,
          transactionID: referenceValue
        });
      } finally {
        console.log('7. Calling hideLoading().');
        hideLoading(); // Call the consolidated hideLoading function
      }
    });
  } else {
    if (!verifyForm) {
      console.error("MAIN.JS ERROR: Verification form (verifyForm) not found. Form submission handling not attached.");
    } else if (!formElementsPresent) {
      console.error("MAIN.JS ERROR: Critical form elements missing for verifyForm. Form submission handling not attached.");
    }
  }

  // --- Footer Links for Modals (Privacy, Terms, Contact) ---
  const privacyContent = `
    <div class="modal-text-content">
      <h3>Privacy Policy</h3>
      <p>Your privacy is important to us. This policy explains how we collect, use, and protect your information.</p>
      <h4>Information Collection</h4>
      <p>We collect minimal data necessary for verification. This includes the reference ID you provide and aggregated, anonymized usage data.</p>
      <h4>Information Use</h4>
      <p>Data is used solely for processing your verification requests and improving our service.</p>
      <h4>Data Security</h4>
      <p>We employ industry-standard security measures to protect your data from unauthorized access, alteration, disclosure, or destruction.</p>
      <p class="last-updated">Last Updated: ${new Date().toLocaleDateString()}</p>
    </div>
  `;

  const termsContent = `
    <div class="modal-text-content">
      <h3>Terms of Service</h3>
      <p>Welcome to TransferCheckers. By using our service, you agree to these terms:</p>
      <h4>Acceptance of Terms</h4>
      <p>By accessing or using our service, you agree to be bound by these Terms. If you disagree with any part of the terms, then you may not access the service.</p>
      <h4>Service Description</h4>
      <p>TransferCheckers provides a platform for verifying the status of financial transfers. We do not facilitate transfers ourselves.</p>
      <h4>Limitation of Liability</h4>
      <p>TransferCheckers is not liable for any direct, indirect, incidental, special, consequential or punitive damages, including without limitation, loss of profits, data, use, goodwill, or other intangible losses, resulting from (i) your access to or use of or inability to access or use the Service; (ii) any conduct or content of any third party on the Service; (iii) any content obtained from the Service; and (iv) unauthorized access, use or alteration of your transmissions or content, whether based on warranty, contract, tort (including negligence) or any other legal theory, whether or not we have been informed of the possibility of such damage, and even if a remedy set forth herein is found to have failed of its essential purpose.</p>
      <p class="last-updated">Last Updated: ${new Date().toLocaleDateString()}</p>
    </div>
  `;

  const contactContent = `
    <div class="modal-text-content">
      <h3>Contact Us</h3>
      <div class="contact-details">
        <p>If you have any questions about this Privacy Policy, the practices of this site, or your dealings with this site, please contact us at:</p>
        <p><strong>Email:</strong> <a href="mailto:support@transfercheckers.com">support@transfercheckers.com</a></p>
        <p><strong>Support Hours:</strong> Monday - Friday, 9:00 AM - 5:00 PM (GMT+8)</p>
      </div>
      <p class="last-updated">Last Updated: ${new Date().toLocaleDateString()}</p>
    </div>
  `;

  if (privacyLink) {
    privacyLink.addEventListener('click', (event) => {
      event.preventDefault();
      openModal('Privacy Policy', privacyContent);
    });
  } else { console.warn("MAIN.JS WARN: Privacy policy link not found."); }

  if (termsLink) {
    termsLink.addEventListener('click', (event) => {
      event.preventDefault();
      openModal('Terms of Service', termsContent);
    });
  } else { console.warn("MAIN.JS WARN: Terms link not found."); }

  if (contactLink) {
    contactLink.addEventListener('click', (event) => {
      event.preventDefault();
      openModal('Contact Us', contactContent);
    });
  } else { console.warn("MAIN.JS WARN: Contact link not found."); }

  // --- Service Worker Registration ---
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js')
        .then(registration => {
          console.log('Service Worker registered with scope:', registration.scope);
        })
        .catch(error => {
          console.error('Service Worker registration failed:', error);
        });
    });
  } else { console.warn('MAIN.JS WARN: Service workers are not supported.'); }

  // --- Update current year in footer ---
  const currentYearSpan = document.getElementById('currentYear');
  if (currentYearSpan) { currentYearSpan.textContent = new Date().getFullYear(); } else { console.warn("MAIN.JS WARN: currentYear span in footer not found."); }

  console.log('Finished initializing main.js event listeners.');
});

