// ==================== CONFIG ====================
const CONFIG = {
  DEFAULT_BRAND_ID: "362",
  POLL_INTERVAL: 3000, // 3 secondes pour les items
  MAX_ITEMS: 200,
  STORAGE_KEY: "vinted_saved_filters",
  ALERTS_STORAGE_KEY: "vinted_alerts",
  DARK_MODE_KEY: "vinted_dark_mode",
  BUY_BUTTON_KEY: "vinted_buy_button_enabled",
  MESSAGES_REFRESH_INTERVAL: 10000, // 10 secondes pour les messages
  NOTIFICATIONS_REFRESH_INTERVAL: 10000, // 10 secondes pour les notifications
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