// scripts/utils/config.js

export const MOCK_API_DELAY_MS = 1800;
export const ANIMATION_DURATION_MS = 500;
export const INITIAL_CARD_APPEAR_DELAY_MS = 100;

// Professional Icon Placeholders (CSS classes)
// You'll need to define these CSS classes to display actual icons (SVG, Font Icon, etc.)
export const ICONS = {
  SUCCESS: 'icon-status-success', // e.g., a checkmark icon
  PENDING: 'icon-status-pending', // e.g., a clock or hourglass icon
  FAILED: 'icon-status-failed',   // e.g., an X or warning icon
  LOADING: 'spinner'              // Your existing spinner (defined in global.css)
};