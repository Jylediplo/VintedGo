// ==================== CONFIG ====================
const CONFIG = {
  DEFAULT_BRAND_ID: "362",
  POLL_INTERVAL: 2000,
  MAX_ITEMS: 200,
  STORAGE_KEY: "vinted_saved_filters",
  ALERTS_STORAGE_KEY: "vinted_alerts",
  DARK_MODE_KEY: "vinted_dark_mode",
  BUY_BUTTON_KEY: "vinted_buy_button_enabled",
};

const state = {
  seenIds: new Set(),
  items: [],
  isPolling: false,
  pollInterval: null,
  savedFilters: [],
  alerts: [],
  darkMode: false,
  buyButtonEnabled: true,
};