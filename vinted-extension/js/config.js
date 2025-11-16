// Configuration globale
export const CONFIG = {
  DEFAULT_BRAND_ID: "362",
  POLL_INTERVAL: 1000, // 2 secondes
  MAX_ITEMS: 200,
  STORAGE_KEY: "vinted_saved_filters",
};

// État global
export const state = {
  seenIds: new Set(),
  items: [],
  isPolling: false,
  pollInterval: null,
  savedFilters: [],
};

