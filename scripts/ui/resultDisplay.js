// scripts/ui/resultDisplay.js
import { ICONS, ANIMATION_DURATION_MS } from '../utils/config.js';

// --- DOM Elements (scoped to this module) ---
// These are selected once when the module loads.
// Ensure your result.html has these IDs and classes.
const resultCardEl = document.getElementById('resultCard');
const resultIconEl = document.getElementById('resultIcon');
const resultTitleEl = document.getElementById('resultTitle');
const referenceTextEl = document.getElementById('referenceText');
const amountTextEl = document.getElementById('amountText');
const dateTextEl = document.getElementById('dateText');
const fromTextEl = document.getElementById('fromText');
const toTextEl = document.getElementById('toText');

// CRITICAL: Ensure your <ul class="detail-list"> in result.html has id="detailsList"
const detailsListEl = document.getElementById('detailsList');

// These selectors target the <li> elements directly, assuming they have these classes
// as per the updated result.html guidance.
const amountListItemEl = document.querySelector('.detail-item-amount');
const dateListItemEl = document.querySelector('.detail-item-date');
const fromListItemEl = document.querySelector('.detail-item-from');
const toListItemEl = document.querySelector('.detail-item-to');


// --- Helper Function (not exported, used internally) ---
function addDetailItem(label, value, itemClassName = '', valueClassName = '') {
  if (!detailsListEl) {
    console.error("detailsListEl not found in addDetailItem. Cannot add item.");
    return;
  }
  const listItem = document.createElement('li');
  listItem.classList.add('dynamic-info', 'detail-item'); // 'detail-item' for consistent styling
  if (itemClassName) listItem.classList.add(itemClassName);

  const strongEl = document.createElement('strong');
  strongEl.textContent = `${label}:`;

  const spanEl = document.createElement('span');
  spanEl.textContent = value;
  if (valueClassName) spanEl.classList.add(valueClassName);

  listItem.appendChild(strongEl);
  listItem.appendChild(spanEl);
  detailsListEl.appendChild(listItem);
}

// --- Exported Functions ---
export function setInitialResultState() {
  if (!resultIconEl || !resultTitleEl || !referenceTextEl || !amountTextEl || !dateTextEl || !fromTextEl || !toTextEl || !resultCardEl) {
    console.error("One or more critical UI elements for initial state not found.");
    return;
  }

  resultIconEl.innerHTML = `<div class="${ICONS.LOADING}"></div>`;
  resultTitleEl.textContent = 'Verifying Transfer Information...';
  resultTitleEl.style.color = 'var(--neutral-color, #555555)'; // Using CSS var for neutral color
  resultTitleEl.className = 'result-title status-neutral';

  if (detailsListEl) {
    detailsListEl.style.display = 'none'; // Hide list initially
    // Clear any previously added dynamic items
    const dynamicItems = detailsListEl.querySelectorAll('.dynamic-info');
    dynamicItems.forEach(item => item.remove());
  }

  // Reset static field text content
  referenceTextEl.textContent = '—';
  amountTextEl.textContent = '—';
  dateTextEl.textContent = '—';
  fromTextEl.textContent = '—';
  toTextEl.textContent = '—';

  // Initial card animation setup (opacity and transform for subtle entry)
  resultCardEl.style.opacity = '0';
  resultCardEl.style.transform = 'translateY(20px) scale(0.98)';
}

export function updateUIWithData(record, refInput) {
  if (!resultIconEl || !resultTitleEl || !referenceTextEl || !amountTextEl || !dateTextEl || !fromTextEl || !toTextEl || !detailsListEl) {
    console.error("One or more critical UI elements for updating data not found.");
    return;
  }

  referenceTextEl.textContent = refInput || 'N/A';

  // Clear previously added dynamic items (like failure reasons or pending info)
  if (detailsListEl) {
    const dynamicItems = detailsListEl.querySelectorAll('.dynamic-info');
    dynamicItems.forEach(item => item.remove());
  }

  // Reset icon
  resultIconEl.innerHTML = ''; // Clear previous icon/spinner
  const iconDiv = document.createElement('div');
  resultIconEl.appendChild(iconDiv);

  // Reset display of static list items (they might have been hidden in a 'failed' state)
  // This assumes amountListItemEl etc., refer to the <li> elements.
  [amountListItemEl, dateListItemEl, fromListItemEl, toListItemEl].forEach(el => {
    if (el) el.style.display = ''; // Reset to default (CSS will take over, e.g., display: list-item)
  });
  // Clear text for static fields before repopulating or leaving as '—' for failed state
  amountTextEl.textContent = '—';
  dateTextEl.textContent = '—';
  fromTextEl.textContent = '—';
  toTextEl.textContent = '—';


  switch (record.status) {
    case 'success':
      iconDiv.className = ICONS.SUCCESS;
      resultTitleEl.textContent = 'Transfer Verified Successfully';
      resultTitleEl.style.color = 'var(--success-color)'; // Use CSS variable
      resultTitleEl.className = 'result-title status-success';

      amountTextEl.innerHTML = `${record.amount} <span class="currency-code">(${record.currency || ''})</span>`;
      dateTextEl.textContent = record.date;
      fromTextEl.textContent = record.from;
      toTextEl.textContent = record.to;
      if (record.transactionID) {
        addDetailItem('Transaction ID', record.transactionID, 'detail-item-transaction-id');
      }
      break;

    case 'pending':
      iconDiv.className = ICONS.PENDING;
      resultTitleEl.textContent = 'Transfer Status: Pending';
      resultTitleEl.style.color = 'var(--pending-color)'; // Use CSS variable
      resultTitleEl.className = 'result-title status-pending';

      amountTextEl.innerHTML = `${record.amount} <span class="currency-code">(${record.currency || ''})</span>`;
      dateTextEl.textContent = record.date;
      fromTextEl.textContent = record.from;
      toTextEl.textContent = record.to;
      if (record.transactionID) {
        addDetailItem('Transaction ID', record.transactionID, 'detail-item-transaction-id');
      }
      if (record.estimatedCompletion) {
        addDetailItem('Est. Completion', record.estimatedCompletion, 'detail-item-pending-info', 'value-pending');
      }
      break;

    case 'failed':
    default:
      iconDiv.className = ICONS.FAILED;
      resultTitleEl.textContent = 'Transfer Verification Failed';
      resultTitleEl.style.color = 'var(--danger-color)'; // Use CSS variable
      resultTitleEl.className = 'result-title status-failed';

      // Hide all standard detail <li> items for a failed transaction
      [amountListItemEl, dateListItemEl, fromListItemEl, toListItemEl].forEach(el => {
        if (el) el.style.display = 'none';
      });
      // Static text fields are already '—' or will remain so.

      addDetailItem('Verification Status', record.reason || 'Unable to retrieve details. Please contact support.', 'detail-item-failure-reason', 'value-danger');
      break;
  }
  if (detailsListEl) detailsListEl.style.display = ''; // Show the list now that it's populated
}

export function animateResultIn() {
  if (!resultCardEl || !resultIconEl) {
    console.error("Cannot animate result in: resultCardEl or resultIconEl is missing.");
    return;
  }
  // Card animation (assuming it was made visible but perhaps off-screen or scaled down by setInitialResultState or verify.js initial animation step)
  resultCardEl.style.transition = `opacity ${ANIMATION_DURATION_MS}ms ease-out, transform ${ANIMATION_DURATION_MS}ms ease-out`;
  resultCardEl.style.opacity = '1';
  resultCardEl.style.transform = 'translateY(0) scale(1)';

  // Icon animation (flip in)
  const iconDiv = resultIconEl.querySelector('div:not(.spinner)'); // Target the actual status icon, not the spinner
  if (iconDiv) {
    iconDiv.style.transform = 'scale(0.7) rotateY(-90deg)'; // Initial state for animation
    iconDiv.style.transition = `transform ${ANIMATION_DURATION_MS}ms cubic-bezier(0.68, -0.55, 0.27, 1.55)`;

    // Use requestAnimationFrame for smoother animations
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        iconDiv.style.transform = 'scale(1) rotateY(0deg)'; // Final state
      });
    });
  }
}