// scripts/verify.js
import {
  INITIAL_CARD_APPEAR_DELAY_MS,
  MOCK_API_DELAY_MS,
  ANIMATION_DURATION_MS // Make sure this is imported if used for the initial card animation
} from './utils/config.js';
import { fetchTransferData } from './api/transferService.js';
import { updateUIWithData, setInitialResultState, animateResultIn } from './ui/resultDisplay.js';

document.addEventListener('DOMContentLoaded', () => {
  const resultCardEl = document.getElementById('resultCard');
  const detailsListEl = document.getElementById('detailsList'); // Keep for consistency, though not directly used in this file

  if (!resultCardEl) {
      console.error("Element with ID 'resultCard' not found. This is critical for displaying results.");
      // You might want to display an error message directly on the page here
      // if the main result card is missing.
      const bodyEl = document.querySelector('body');
      if (bodyEl) {
          bodyEl.innerHTML = '<p style="color: white; text-align: center; padding-top: 50px;">Critical error: UI components missing. Please try again later.</p>';
      }
      return;
  }
  if (!detailsListEl) {
      console.warn("Element with ID 'detailsList' not found. Details may not display correctly.");
  }

  const processVerification = async () => {
    // Phase 1: Set up the initial "Verifying..." state.
    // This makes the card's structure ready but keeps it transparent and slightly offset.
    setInitialResultState(); // Sets card opacity 0, "Verifying..." title, spinner, details hidden

    // Phase 2: Make the "Verifying..." card appear on screen.
    // This happens quickly so the user sees something is happening.
    setTimeout(() => {
      if (resultCardEl) {
        resultCardEl.style.transition = `opacity ${ANIMATION_DURATION_MS / 2}ms ease-out, transform ${ANIMATION_DURATION_MS / 2}ms ease-out`;
        resultCardEl.style.opacity = '1';
        resultCardEl.style.transform = 'translateY(0) scale(1)';
      }
    }, INITIAL_CARD_APPEAR_DELAY_MS); // e.g., 100ms - user sees "Verifying..." card with spinner

    const params = new URLSearchParams(window.location.search);
    const reference = params.get('ref')?.trim().toUpperCase() || '';
    let recordToDisplay;

    // Phase 3: Fetch data (or handle no reference).
    // The "Verifying..." card remains visible during this phase.
    if (!reference) {
      console.warn("No transfer reference was provided in the URL.");
      recordToDisplay = { status: 'failed', reason: 'No transfer reference was provided. Please use a valid verification link.' };
      // Simulate a brief moment for the "Verifying..." state to be seen even if no API call is made.
      await new Promise(resolve => setTimeout(resolve, Math.min(MOCK_API_DELAY_MS, 500))); // Show verifying state for a bit
    } else {
      try {
        // fetchTransferData includes the MOCK_API_DELAY_MS (e.g., 1800ms)
        recordToDisplay = await fetchTransferData(reference);
      } catch (error) {
        console.error("Verification process error:", error);
        recordToDisplay = { status: 'failed', reason: error.message || 'A technical error occurred during verification. Please try again later.' };
      }
    }

    // Phase 4: Update the card content with the fetched record (or error).
    // This changes the title, icon, details, etc.
    updateUIWithData(recordToDisplay, reference);

    // Phase 5: Animate the final result card content (e.g., the new status icon flipping in).
    // This happens very shortly after the content has been updated by updateUIWithData.
    setTimeout(() => {
      animateResultIn(); // This function is in resultDisplay.js
                         // It animates the icon and can ensure the card is properly presented.
    }, 50); // A small 50ms delay for the DOM to update before starting the final animation.
  };

  processVerification();
});