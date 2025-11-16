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

// ==================== UTILS ====================
function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function formatPrice(item) {
  const amount = item.price?.amount || item.price?.value || item.price || 0;
  const currency = item.price?.currency || item.price?.currency_code || "EUR";
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: currency,
  }).format(amount);
}

function formatTime(date) {
  return new Intl.DateTimeFormat("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(date);
}

function extractSize(item) {
  const sizeLabel =
    item.size_title ||
    item.size?.localized_title ||
    item.size?.title ||
    item.size?.brand_size;

  if (!sizeLabel) return null;

  return sizeLabel
    .replace(/^(taille|size)\s+/i, "")
    .replace(/\b(taille unique|unique size)\b/i, "TU")
    .split(/[\s,/|-]+/)[0]
    ?.toUpperCase();
}

function extractCondition(item) {
  if (typeof item.condition === "string") return item.condition;
  return (
    item.condition?.translated_title ||
    item.condition?.title ||
    item.condition_title ||
    item.status ||
    null
  );
}

// ==================== DARK MODE ====================
async function loadDarkMode() {
  try {
    const result = await chrome.storage.local.get(CONFIG.DARK_MODE_KEY);
    state.darkMode = result[CONFIG.DARK_MODE_KEY] || false;
    applyDarkMode();
  } catch (error) {
    console.error("[Dark Mode] Erreur lors du chargement:", error);
  }
}

async function toggleDarkMode() {
  state.darkMode = !state.darkMode;
  await chrome.storage.local.set({ [CONFIG.DARK_MODE_KEY]: state.darkMode });
  applyDarkMode();
  updateDarkModeButton();
}

function applyDarkMode() {
  if (state.darkMode) {
    document.documentElement.classList.add('vinted-dark-mode');
  } else {
    document.documentElement.classList.remove('vinted-dark-mode');
  }
}

function updateDarkModeButton() {
  const btn = document.getElementById('dark-mode-toggle');
  if (btn) {
    btn.textContent = state.darkMode ? '☀️' : '🌙';
    btn.title = state.darkMode ? 'Mode clair' : 'Mode sombre';
  }
}

// ==================== BUY BUTTON TOGGLE ====================
async function loadBuyButtonState() {
  try {
    const result = await chrome.storage.local.get(CONFIG.BUY_BUTTON_KEY);
    state.buyButtonEnabled = result[CONFIG.BUY_BUTTON_KEY] !== false;
    applyBuyButtonState();
  } catch (error) {
    console.error("[Buy Button] Erreur lors du chargement:", error);
  }
}

async function toggleBuyButton() {
  state.buyButtonEnabled = !state.buyButtonEnabled;
  await chrome.storage.local.set({ [CONFIG.BUY_BUTTON_KEY]: state.buyButtonEnabled });
  applyBuyButtonState();
  updateBuyButtonToggle();
}

function applyBuyButtonState() {
  if (state.buyButtonEnabled) {
    document.documentElement.classList.remove('vinted-buy-button-disabled');
  } else {
    document.documentElement.classList.add('vinted-buy-button-disabled');
  }
}

function updateBuyButtonToggle() {
  const btn = document.getElementById('buy-button-toggle');
  if (btn) {
    btn.textContent = state.buyButtonEnabled ? '🛒' : '🚫';
    btn.title = state.buyButtonEnabled ? 'Désactiver le bouton Buy' : 'Activer le bouton Buy';
  }
}

// ==================== API ====================
function extractVintedUrlParams() {
  const currentUrl = new URL(window.location.href);
  const params = {};
  
  const relevantParams = [
    'brand_ids[]',
    'size_ids[]',
    'color_ids[]',
    'material_ids[]',
    'status_ids[]',
    'catalog_ids[]',
    'price_from',
    'price_to',
    'currency',
    'order',
    'search_text'
  ];
  
  for (const [key, value] of currentUrl.searchParams.entries()) {
    if (key.endsWith('[]')) {
      if (!params[key]) {
        params[key] = [];
      }
      params[key].push(value);
    } else if (relevantParams.includes(key)) {
      params[key] = value;
    }
  }
  
  return params;
}

function extractItems(data) {
  if (data.items) return data.items;
  if (data.catalog_items) return data.catalog_items;
  if (data.catalog?.items) return data.catalog.items;
  if (data.data?.items) return data.data.items;
  return [];
}

async function fetchNewItems() {
  const url = new URL("https://www.vinted.fr/api/v2/catalog/items");
  const vintedParams = extractVintedUrlParams();
  
  if (!vintedParams['brand_ids[]'] || vintedParams['brand_ids[]'].length === 0) {
    url.searchParams.set("brand_ids[]", CONFIG.DEFAULT_BRAND_ID);
  } else {
    vintedParams['brand_ids[]'].forEach(brandId => {
      url.searchParams.append("brand_ids[]", brandId);
    });
  }
  
  for (const [key, value] of Object.entries(vintedParams)) {
    if (key === 'brand_ids[]') continue;
    if (Array.isArray(value)) {
      value.forEach(v => url.searchParams.append(key, v));
    } else {
      url.searchParams.set(key, value);
    }
  }
  
  if (!url.searchParams.has("order")) {
    url.searchParams.set("order", "newest_first");
  }
  url.searchParams.set("page", "1");
  const futureTime = Math.floor(Date.now() / 1000) + 30;
  url.searchParams.set("time", futureTime.toString());

  const response = await fetch(url.toString(), {
    credentials: "include",
    headers: {
      "accept": "application/json, text/plain, */*",
      "accept-language": "fr-FR,fr;q=0.9",
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const data = await response.json();
  return extractItems(data);
}

// ==================== ITEM MANAGER ====================
function registerItems(incomingItems) {
  const newItems = incomingItems.filter((item) => !state.seenIds.has(item.id));
  if (newItems.length === 0) return newItems;
  
  state.items = [...newItems, ...state.items].slice(0, CONFIG.MAX_ITEMS);
  newItems.forEach((item) => state.seenIds.add(item.id));
  return newItems;
}

function createItemCard(item) {
  const photo = item.photos?.[0]?.url || item.photo?.url || "";
  const price = formatPrice(item);
  const size = extractSize(item);
  const condition = extractCondition(item);
  const permalink = item.url?.startsWith("http") ? item.url : `https://www.vinted.fr${item.url}`;
  
  // Vérifier les alertes
  const matchingAlerts = checkItemAgainstAlerts(item);
  const hasAlert = matchingAlerts.length > 0;
  const alertClass = hasAlert ? ' alert-match' : '';
  const alertDataAttr = hasAlert ? ` data-alert-id="${matchingAlerts[0].id}"` : '';
  const alertColor = hasAlert ? matchingAlerts[0].color : '';
  const alertStyle = hasAlert ? ` style="--alert-color: ${alertColor};"` : '';

  return `
    <div class="item-card${alertClass}"${alertDataAttr}${alertStyle} data-item-url="${permalink}">
      ${hasAlert ? '<div class="alert-indicator" style="background: var(--alert-color, #10b981);"></div>' : ''}
      <a href="${permalink}" target="_blank" class="item-link">
        ${photo ? `<img src="${photo}" alt="${item.title}" class="item-image" loading="lazy" />` : '<div class="item-no-image">Pas d\'image</div>'}
        <div class="item-header">
          <h3 class="item-title">${escapeHtml(item.title)}</h3>
        </div>
        <div class="item-footer">
          <div class="item-badges">
            ${size ? `<span class="badge">${size}</span>` : ""}
            ${condition ? `<span class="badge">${condition}</span>` : ""}
          </div>
          <span class="item-price">${price}</span>
        </div>
      </a>
      <button class="btn-buy-item" data-item-url="${permalink}" title="Acheter rapidement">
        <span class="buy-icon">🛒</span>
        <span class="buy-text">Buy</span>
      </button>
    </div>
  `;
}

function renderItems() {
  const container = document.getElementById("items-container");
  if (!container) return;
  container.innerHTML = state.items.map((item) => createItemCard(item)).join("");
  
  // Attacher les event listeners aux boutons Buy
  attachBuyButtonListeners();
}

function attachBuyButtonListeners() {
  const buyButtons = document.querySelectorAll('.btn-buy-item');
  buyButtons.forEach(btn => {
    // Retirer les anciens listeners pour éviter les duplications
    const newBtn = btn.cloneNode(true);
    btn.parentNode.replaceChild(newBtn, btn);
    
    newBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const itemUrl = newBtn.dataset.itemUrl;
      if (itemUrl) {
        quickBuyItem(itemUrl);
      }
    });
  });
}

function quickBuyItem(itemUrl) {
  // Ajouter le paramètre auto_buy=true à l'URL pour déclencher le script auto-buy
  const url = new URL(itemUrl);
  url.searchParams.set('auto_buy', 'true');
  
  // Ouvrir l'article dans un nouvel onglet
  const newTab = window.open(url.toString(), '_blank');
  
  if (newTab) {
    console.log('Ouverture de l\'article pour achat rapide:', url.toString());
  } else {
    console.error('Impossible d\'ouvrir l\'onglet. Popup bloquée ?');
  }
}

function prependNewItems(newItems) {
  const container = document.getElementById("items-container");
  if (!container || newItems.length === 0) return;

  const oldNewItems = container.querySelectorAll(".new-item");
  oldNewItems.forEach((el) => el.classList.remove("new-item"));

  const fragment = document.createDocumentFragment();
  const tempDiv = document.createElement("div");

  newItems.forEach((item) => {
    tempDiv.innerHTML = createItemCard(item);
    const cardElement = tempDiv.firstElementChild;
    if (cardElement) {
      cardElement.classList.add("new-item");
      fragment.appendChild(cardElement);
    }
  });

  if (container.firstChild) {
    container.insertBefore(fragment, container.firstChild);
  } else {
    container.appendChild(fragment);
  }

  while (container.children.length > CONFIG.MAX_ITEMS) {
    container.removeChild(container.lastChild);
  }
  
  // Attacher les event listeners aux nouveaux boutons Buy
  attachBuyButtonListeners();
}

// ==================== MONITOR ====================
function startMonitor() {
  if (state.isPolling) return;

  state.isPolling = true;
  const btn = document.getElementById("toggle-monitor");
  if (btn) {
    btn.textContent = "⏸";
    btn.style.background = "#dc2626";
  }

  pollItems();
  state.pollInterval = setInterval(pollItems, CONFIG.POLL_INTERVAL);
}

function stopMonitor() {
  state.isPolling = false;
  const btn = document.getElementById("toggle-monitor");
  if (btn) {
    btn.textContent = "▶";
    btn.style.background = "#3b82f6";
  }

  if (state.pollInterval) {
    clearInterval(state.pollInterval);
    state.pollInterval = null;
  }
}

function toggleMonitor() {
  if (state.isPolling) {
    stopMonitor();
  } else {
    startMonitor();
  }
}

async function pollItems() {
  const isFirstFetch = state.items.length === 0;

  try {
    const incomingItems = await fetchNewItems();

    if (incomingItems && incomingItems.length > 0) {
      const newItems = registerItems(incomingItems);

      if (isFirstFetch) {
        renderItems();
        console.log(`[Vinted Monitor] ${state.items.length} articles chargés`);
      } else if (newItems.length > 0) {
        prependNewItems(newItems);
        console.log(`[Vinted Monitor] ${newItems.length} nouveau${newItems.length > 1 ? "x" : ""} article${newItems.length > 1 ? "s" : ""}`);
      }
    } else {
      console.log("[Vinted Monitor] Aucun article trouvé");
    }
  } catch (error) {
    console.error("[Vinted Monitor] Erreur:", error);
  }
}

let lastUrl = window.location.href;
function observeUrlChanges() {
  const observer = new MutationObserver(() => {
    if (lastUrl !== window.location.href) {
      console.log("[Vinted Monitor] URL changée, réinitialisation...");
      lastUrl = window.location.href;
      state.seenIds.clear();
      state.items = [];
      if (state.isPolling) {
        stopMonitor();
        setTimeout(() => startMonitor(), 500);
      }
    }
  });
  
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
}

// ==================== FILTER MANAGER ====================
async function loadSavedFilters() {
  try {
    const result = await chrome.storage.local.get(CONFIG.STORAGE_KEY);
    state.savedFilters = result[CONFIG.STORAGE_KEY] || [];
    console.log("[Filter Manager] Filtres chargés:", state.savedFilters);
  } catch (error) {
    console.error("[Filter Manager] Erreur lors du chargement:", error);
    state.savedFilters = [];
  }
}

async function saveFiltersToStorage() {
  try {
    await chrome.storage.local.set({ [CONFIG.STORAGE_KEY]: state.savedFilters });
    console.log("[Filter Manager] Filtres sauvegardés:", state.savedFilters);
  } catch (error) {
    console.error("[Filter Manager] Erreur lors de la sauvegarde:", error);
  }
}

function getCurrentFilters() {
  const url = new URL(window.location.href);
  const filters = {};
  
  for (const [key, value] of url.searchParams.entries()) {
    if (key.endsWith('[]')) {
      if (!filters[key]) filters[key] = [];
      filters[key].push(value);
    } else if (['price_from', 'price_to', 'order'].includes(key)) {
      filters[key] = value;
    }
  }
  
  return filters;
}

function applyFilter(filter) {
  const url = new URL(window.location.href);
  const catalogPath = url.pathname;
  url.search = '';
  url.pathname = catalogPath;
  
  for (const [key, value] of Object.entries(filter.params)) {
    if (Array.isArray(value)) {
      value.forEach(v => url.searchParams.append(key, v));
    } else {
      url.searchParams.set(key, value);
    }
  }
  
  if (!url.searchParams.has('order')) {
    url.searchParams.set('order', 'newest_first');
  }
  
  // Décoder l'URL pour avoir [] au lieu de %5B%5D
  const cleanUrl = decodeURIComponent(url.toString());
  window.location.href = cleanUrl;
}

async function saveCurrentFilter() {
  const name = prompt("Nom du filtre:");
  if (!name) return;
  
  const filters = getCurrentFilters();
  const newFilter = {
    id: Date.now().toString(),
    name: name,
    params: filters,
    createdAt: new Date().toISOString()
  };
  
  state.savedFilters.push(newFilter);
  await saveFiltersToStorage();
  renderFilterList();
}

async function deleteFilter(filterId) {
  if (!confirm("Supprimer ce filtre ?")) return;
  
  state.savedFilters = state.savedFilters.filter(f => f.id !== filterId);
  await saveFiltersToStorage();
  renderFilterList();
}

function isFilterActive(filter) {
  const currentFilters = getCurrentFilters();
  
  // Comparer les paramètres
  const filterKeys = Object.keys(filter.params).sort();
  const currentKeys = Object.keys(currentFilters).sort();
  
  if (filterKeys.length !== currentKeys.length) return false;
  if (filterKeys.join(',') !== currentKeys.join(',')) return false;
  
  // Comparer les valeurs
  for (const key of filterKeys) {
    const filterValue = filter.params[key];
    const currentValue = currentFilters[key];
    
    if (Array.isArray(filterValue)) {
      if (!Array.isArray(currentValue)) return false;
      if (filterValue.length !== currentValue.length) return false;
      
      const sortedFilter = [...filterValue].sort();
      const sortedCurrent = [...currentValue].sort();
      if (sortedFilter.join(',') !== sortedCurrent.join(',')) return false;
    } else {
      if (filterValue !== currentValue) return false;
    }
  }
  
  return true;
}

function renderFilterList() {
  const filterList = document.getElementById('filter-list');
  if (!filterList) return;
  
  if (state.savedFilters.length === 0) {
    filterList.innerHTML = '<p class="filter-empty">Aucun filtre sauvegardé</p>';
    return;
  }
  
  filterList.innerHTML = state.savedFilters.map(filter => {
    const paramCount = Object.keys(filter.params).reduce((acc, key) => {
      return acc + (Array.isArray(filter.params[key]) ? filter.params[key].length : 1);
    }, 0);
    
    const isActive = isFilterActive(filter);
    const activeClass = isActive ? ' filter-item-active' : '';
    
    // Afficher le search_text s'il existe
    const searchText = filter.params.search_text ? `🔍 "${decodeURIComponent(filter.params.search_text)}"` : '';
    
    return `
      <div class="filter-item${activeClass}" data-filter-id="${filter.id}">
        <div class="filter-item-content" data-filter-id="${filter.id}">
          <span class="filter-item-name">${escapeHtml(filter.name)}</span>
          ${searchText ? `<span class="filter-item-search">${escapeHtml(searchText)}</span>` : ''}
          <span class="filter-item-count">${paramCount} filtre${paramCount > 1 ? 's' : ''}</span>
          ${isActive ? '<span class="filter-active-badge"></span>' : ''}
        </div>
        <button class="btn-delete-filter" data-filter-id="${filter.id}" title="Supprimer ce filtre">🗑️</button>
      </div>
    `;
  }).join('');
  
  // Rendre tout le filtre cliquable (sauf si actif)
  filterList.querySelectorAll('.filter-item:not(.filter-item-active)').forEach(item => {
    item.addEventListener('click', (e) => {
      // Ne pas déclencher si on clique sur le bouton supprimer
      if (e.target.closest('.btn-delete-filter')) return;
      
      const filterId = item.dataset.filterId;
      const filter = state.savedFilters.find(f => f.id === filterId);
      if (filter) applyFilter(filter);
    });
    
    // Ajouter un style pointer sur hover
    item.style.cursor = 'pointer';
  });
  
  filterList.querySelectorAll('.btn-delete-filter').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation(); // Empêcher la propagation au parent
      const filterId = e.target.dataset.filterId;
      deleteFilter(filterId);
    });
  });
}

// ==================== ALERT SYSTEM ====================

// Couleurs prédéfinies pour les alertes
const ALERT_COLORS = [
  { name: 'Vert', value: '#10b981' },
  { name: 'Vert clair', value: '#34d399' },
  { name: 'Emeraude', value: '#059669' },
  { name: 'Lime', value: '#84cc16' },
  { name: 'Vert foncé', value: '#047857' },
  { name: 'Menthe', value: '#6ee7b7' },
  { name: 'Bleu', value: '#3b82f6' },
  { name: 'Bleu clair', value: '#60a5fa' },
  { name: 'Cyan', value: '#06b6d4' },
  { name: 'Indigo', value: '#6366f1' },
  { name: 'Bleu foncé', value: '#1e40af' },
  { name: 'Sky', value: '#0ea5e9' },
  { name: 'Rouge', value: '#ef4444' },
  { name: 'Rouge clair', value: '#f87171' },
  { name: 'Rose', value: '#ec4899' },
  { name: 'Rose clair', value: '#f472b6' },
  { name: 'Rouge foncé', value: '#b91c1c' },
  { name: 'Fuchsia', value: '#d946ef' },
  { name: 'Orange', value: '#f97316' },
  { name: 'Orange clair', value: '#fb923c' },
  { name: 'Amber', value: '#f59e0b' },
  { name: 'Jaune', value: '#eab308' },
  { name: 'Orange foncé', value: '#c2410c' },
  { name: 'Pêche', value: '#fdba74' },
  { name: 'Violet', value: '#a855f7' },
  { name: 'Violet clair', value: '#c084fc' },
  { name: 'Pourpre', value: '#9333ea' },
  { name: 'Mauve', value: '#e879f9' },
  { name: 'Violet foncé', value: '#7c3aed' },
  { name: 'Lavande', value: '#c4b5fd' },
];

// Créer un sélecteur de couleur modal
function showColorPicker(currentColor = '#10b981') {
  return new Promise((resolve) => {
    // Créer le modal
    const modal = document.createElement('div');
    modal.className = 'color-picker-modal';
    modal.innerHTML = `
      <div class="color-picker-overlay"></div>
      <div class="color-picker-content">
        <h3 class="color-picker-title">Choisir une couleur</h3>
        <div class="color-picker-grid">
          ${ALERT_COLORS.map(color => `
            <button class="color-picker-option ${color.value === currentColor ? 'selected' : ''}" 
                    data-color="${color.value}"
                    style="background: ${color.value};"
                    title="${color.name}">
              ${color.value === currentColor ? '✓' : ''}
            </button>
          `).join('')}
        </div>
        <div class="color-picker-actions">
          <button class="btn-color-cancel">Annuler</button>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    // Event listeners
    const overlay = modal.querySelector('.color-picker-overlay');
    const cancelBtn = modal.querySelector('.btn-color-cancel');
    const colorOptions = modal.querySelectorAll('.color-picker-option');
    
    // Fermer sur overlay
    overlay.addEventListener('click', () => {
      modal.remove();
      resolve(null);
    });
    
    // Fermer sur annuler
    cancelBtn.addEventListener('click', () => {
      modal.remove();
      resolve(null);
    });
    
    // Sélectionner une couleur
    colorOptions.forEach(option => {
      option.addEventListener('click', () => {
        const color = option.dataset.color;
        modal.remove();
        resolve(color);
      });
    });
  });
}

// Charger les alertes depuis le storage
async function loadAlerts() {
  try {
    const result = await chrome.storage.local.get(CONFIG.ALERTS_STORAGE_KEY);
    state.alerts = result[CONFIG.ALERTS_STORAGE_KEY] || [];
    console.log("[Alert System] Alertes chargées:", state.alerts);
  } catch (error) {
    console.error("[Alert System] Erreur lors du chargement:", error);
    state.alerts = [];
  }
}

// Sauvegarder les alertes
async function saveAlerts() {
  try {
    await chrome.storage.local.set({ [CONFIG.ALERTS_STORAGE_KEY]: state.alerts });
    console.log("[Alert System] Alertes sauvegardées:", state.alerts);
  } catch (error) {
    console.error("[Alert System] Erreur lors de la sauvegarde:", error);
  }
}

// Vérifier si un item correspond à une alerte
function checkItemAgainstAlerts(item) {
  const matchingAlerts = [];
  const itemTitle = item.title.toLowerCase();
  const itemPrice = item.price?.amount || 0;
  
  for (const alert of state.alerts) {
    if (!alert.enabled) continue;
    
    const keywordsMatch = alert.keywords.length === 0 || 
      alert.keywords.some(keyword => itemTitle.includes(keyword.toLowerCase()));
    
    const priceMatch = !alert.maxPrice || itemPrice <= alert.maxPrice;
    
    if (keywordsMatch && priceMatch) {
      matchingAlerts.push(alert);
    }
  }
  
  return matchingAlerts;
}

// Créer une nouvelle alerte
async function createAlert() {
  const name = prompt("Nom de l'alerte:");
  if (!name) return;
  
  const keywordsInput = prompt("Mots-clés (séparés par des virgules):");
  const keywords = keywordsInput ? keywordsInput.split(',').map(k => k.trim()).filter(k => k) : [];
  
  const maxPriceInput = prompt("Prix maximum (laisser vide pour ignorer):");
  const maxPrice = maxPriceInput ? parseFloat(maxPriceInput) : null;
  
  const color = await showColorPicker('#10b981');
  if (!color) return; // Annulé
  
  const newAlert = {
    id: Date.now().toString(),
    name: name,
    keywords: keywords,
    maxPrice: maxPrice,
    enabled: true,
    color: color,
    createdAt: new Date().toISOString()
  };
  
  state.alerts.push(newAlert);
  await saveAlerts();
  renderAlertList();
}

// Supprimer une alerte
async function deleteAlert(alertId) {
  if (!confirm("Supprimer cette alerte ?")) return;
  
  state.alerts = state.alerts.filter(a => a.id !== alertId);
  await saveAlerts();
  renderAlertList();
  
  // Retirer les highlights des items
  document.querySelectorAll(`.item-card[data-alert-id="${alertId}"]`).forEach(card => {
    card.classList.remove('alert-match');
    card.removeAttribute('data-alert-id');
    card.style.border = '';
  });
}

// Toggle enable/disable alerte
async function toggleAlert(alertId) {
  const alert = state.alerts.find(a => a.id === alertId);
  if (alert) {
    alert.enabled = !alert.enabled;
    await saveAlerts();
    renderAlertList();
    
    // Mettre à jour les items existants
    if (!alert.enabled) {
      // Si désactivée, retirer les bordures des items qui matchent cette alerte
      document.querySelectorAll(`.item-card[data-alert-id="${alertId}"]`).forEach(card => {
        card.classList.remove('alert-match');
        card.removeAttribute('data-alert-id');
        card.removeAttribute('style');
        // Retirer le voyant
        const indicator = card.querySelector('.alert-indicator');
        if (indicator) indicator.remove();
      });
    } else {
      // Si réactivée, re-vérifier tous les items
      reapplyAllAlerts();
    }
  }
}

// Re-appliquer toutes les alertes sur les items existants
function reapplyAllAlerts() {
  const itemCards = document.querySelectorAll('.item-card');
  itemCards.forEach(card => {
    // Retirer les anciennes classes/attributs d'alerte
    card.classList.remove('alert-match');
    card.removeAttribute('data-alert-id');
    card.removeAttribute('style');
    
    // Retirer l'ancien indicateur
    const oldIndicator = card.querySelector('.alert-indicator');
    if (oldIndicator) oldIndicator.remove();
    
    // Récupérer le titre de l'item depuis la carte
    const titleElement = card.querySelector('.item-title');
    const priceElement = card.querySelector('.item-price');
    
    if (titleElement && priceElement) {
      const title = titleElement.textContent;
      const priceText = priceElement.textContent.replace('€', '').trim();
      const price = parseFloat(priceText) || 0;
      
      const item = {
        title: title,
        price: { amount: price }
      };
      
      // Vérifier si l'item matche une alerte
      const matchingAlerts = checkItemAgainstAlerts(item);
      if (matchingAlerts.length > 0) {
        const alert = matchingAlerts[0];
        card.classList.add('alert-match');
        card.setAttribute('data-alert-id', alert.id);
        card.style.setProperty('--alert-color', alert.color);
        
        // Ajouter le voyant d'alerte
        const indicator = document.createElement('div');
        indicator.className = 'alert-indicator';
        indicator.style.background = alert.color;
        card.insertBefore(indicator, card.firstChild);
      }
    }
  });
}

// Editer une alerte
async function editAlert(alertId) {
  const alert = state.alerts.find(a => a.id === alertId);
  if (!alert) return;
  
  const name = prompt("Nom de l'alerte:", alert.name);
  if (name === null) return;
  
  const keywordsInput = prompt("Mots-clés (séparés par des virgules):", alert.keywords.join(', '));
  if (keywordsInput === null) return;
  
  const keywords = keywordsInput.split(',').map(k => k.trim()).filter(k => k);
  
  const maxPriceInput = prompt("Prix maximum (laisser vide pour ignorer):", alert.maxPrice || '');
  if (maxPriceInput === null) return;
  
  const maxPrice = maxPriceInput ? parseFloat(maxPriceInput) : null;
  
  const color = await showColorPicker(alert.color || '#10b981');
  if (!color) return; // Annulé
  
  alert.name = name;
  alert.keywords = keywords;
  alert.maxPrice = maxPrice;
  alert.color = color;
  
  await saveAlerts();
  renderAlertList();
  
  // Re-appliquer les couleurs aux items existants
  reapplyAlertColors();
}

// Re-appliquer les couleurs des alertes aux items existants
function reapplyAlertColors() {
  const itemCards = document.querySelectorAll('.item-card');
  itemCards.forEach(card => {
    const alertId = card.dataset.alertId;
    if (alertId) {
      const alert = state.alerts.find(a => a.id === alertId);
      if (alert && alert.color) {
        card.style.setProperty('--alert-color', alert.color);
      }
    }
  });
}

// Afficher la liste des alertes
function renderAlertList() {
  const alertList = document.getElementById('alert-list');
  if (!alertList) return;
  
  if (state.alerts.length === 0) {
    alertList.innerHTML = '<p class="alert-empty">Aucune alerte créée</p>';
    return;
  }
  
  alertList.innerHTML = state.alerts.map(alert => {
    const keywordsText = alert.keywords.length > 0 ? alert.keywords.join(', ') : 'Tous';
    const priceText = alert.maxPrice ? `≤ ${alert.maxPrice}€` : 'Aucune limite';
    const enabledClass = alert.enabled ? '' : ' alert-disabled';
    const alertColor = alert.color || '#10b981';
    
    return `
      <div class="alert-item${enabledClass}" data-alert-id="${alert.id}" style="border-left: 4px solid ${alertColor};">
        <label class="alert-toggle">
          <input type="checkbox" ${alert.enabled ? 'checked' : ''} data-alert-id="${alert.id}" class="alert-toggle-input">
          <span class="alert-toggle-slider"></span>
        </label>
        <div class="alert-item-content" data-alert-id="${alert.id}">
          <div class="alert-item-name">${escapeHtml(alert.name)}</div>
          <div class="alert-item-info">
            <span class="alert-info-item">
              <span class="alert-color-preview" style="background: ${alertColor};"></span>
            </span>
            <span class="alert-info-item">${escapeHtml(keywordsText)}</span>
            <span class="alert-info-separator">•</span>
            <span class="alert-info-item">${priceText}</span>
          </div>
        </div>
        <button class="btn-delete-alert" data-alert-id="${alert.id}" title="Supprimer">✖</button>
      </div>
    `;
  }).join('');
  
  // Event listeners
  alertList.querySelectorAll('.alert-toggle-input').forEach(toggle => {
    toggle.addEventListener('change', (e) => {
      e.stopPropagation();
      const alertId = e.target.dataset.alertId;
      toggleAlert(alertId);
    });
  });
  
  // Clic sur le contenu pour éditer
  alertList.querySelectorAll('.alert-item-content').forEach(content => {
    content.addEventListener('click', (e) => {
      e.stopPropagation();
      const alertId = content.dataset.alertId;
      editAlert(alertId);
    });
    content.style.cursor = 'pointer';
  });
  
  alertList.querySelectorAll('.btn-delete-alert').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const alertId = e.target.dataset.alertId;
      deleteAlert(alertId);
    });
  });
}

// Créer l'interface du système d'alertes
let alertSystemRetries = 0;
const MAX_ALERT_RETRIES = 10;

function createAlertSystem() {
  const sidebar = document.getElementById('sidebar');
  
  if (!sidebar) {
    alertSystemRetries++;
    if (alertSystemRetries < MAX_ALERT_RETRIES) {
      console.warn(`[Alert System] Sidebar non trouvée (tentative ${alertSystemRetries}/${MAX_ALERT_RETRIES}), réessai dans 500ms`);
      setTimeout(createAlertSystem, 500);
    } else {
      console.error("[Alert System] Sidebar introuvable après plusieurs tentatives, abandon");
    }
    return;
  }
  
  if (document.getElementById('alert-system')) {
    console.log("[Alert System] Interface déjà créée");
    return;
  }
  
  try {
    const alertSystem = document.createElement('div');
    alertSystem.id = 'alert-system';
    alertSystem.className = 'alert-system';
    alertSystem.innerHTML = `
      <div class="alert-system-header">
        <h3 class="alert-system-title" id="alert-system-title-toggle">Alertes Prix</h3>
        <button id="create-alert" class="btn-create-alert" title="Créer une alerte">Créer</button>
      </div>
      <div id="alert-list" class="alert-list">
        <p class="alert-empty">Aucune alerte créée</p>
      </div>
    `;
    
    // Insérer dans le conteneur sticky après le filter-manager
    const stickyContainer = document.getElementById('sidebar-sticky-container');
    if (stickyContainer) {
      stickyContainer.appendChild(alertSystem);
    } else {
      // Fallback si le sticky container n'existe pas
      const filterManager = document.getElementById('filter-manager');
      if (filterManager && filterManager.parentNode) {
        filterManager.parentNode.appendChild(alertSystem);
      } else {
        sidebar.insertBefore(alertSystem, sidebar.firstChild);
      }
    }
    
    document.getElementById('create-alert').addEventListener('click', createAlert);
    document.getElementById('alert-system-title-toggle').addEventListener('click', () => {
      const alertList = document.getElementById('alert-list');
      const alertSystemEl = document.getElementById('alert-system');
      if (alertList.style.display === 'none') {
        alertList.style.display = 'flex';
        alertSystemEl.classList.remove('collapsed');
      } else {
        alertList.style.display = 'none';
        alertSystemEl.classList.add('collapsed');
      }
    });
    loadAlerts().then(() => renderAlertList());
    
    console.log("[Alert System] Interface créée avec succès");
    alertSystemRetries = 0;
  } catch (error) {
    console.error("[Alert System] Erreur lors de la création:", error);
    alertSystemRetries++;
    if (alertSystemRetries < MAX_ALERT_RETRIES) {
      setTimeout(createAlertSystem, 500);
    }
  }
}

// ==================== FIN ALERT SYSTEM ====================

// ==================== PICKUP POINTS SYSTEM ====================

const PICKUP_POINTS_STORAGE_KEY = 'pickupPoints';
let pickupPointsRetries = 0;
const MAX_PICKUP_RETRIES = 10;

async function loadPickupPoints() {
  return new Promise((resolve) => {
    chrome.storage.local.get([PICKUP_POINTS_STORAGE_KEY], (result) => {
      const points = result[PICKUP_POINTS_STORAGE_KEY] || [];
      resolve(points);
    });
  });
}

function savePickupPoints(points) {
  chrome.storage.local.set({ [PICKUP_POINTS_STORAGE_KEY]: points }, () => {
    console.log('[Pickup Points] Points relais sauvegardés:', points);
  });
}

function createPickupPoint() {
  const name = prompt('Nom du point relais (ex: LOCKER 24/7 HYPER U ROMANS SUR):');
  if (!name || name.trim() === '') return;
  
  loadPickupPoints().then(points => {
    if (points.length >= 3) {
      alert('Vous ne pouvez enregistrer que 3 points relais maximum');
      return;
    }
    
    const newPoint = {
      id: Date.now().toString(),
      name: name.trim()
    };
    
    points.push(newPoint);
    savePickupPoints(points);
    renderPickupPointsList();
  });
}

function deletePickupPoint(pointId) {
  if (!confirm('Supprimer ce point relais ?')) return;
  
  loadPickupPoints().then(points => {
    const filtered = points.filter(p => p.id !== pointId);
    savePickupPoints(filtered);
    renderPickupPointsList();
  });
}

function movePickupPointUp(pointId) {
  loadPickupPoints().then(points => {
    const index = points.findIndex(p => p.id === pointId);
    if (index > 0) {
      [points[index - 1], points[index]] = [points[index], points[index - 1]];
      savePickupPoints(points);
      renderPickupPointsList();
    }
  });
}

function movePickupPointDown(pointId) {
  loadPickupPoints().then(points => {
    const index = points.findIndex(p => p.id === pointId);
    if (index < points.length - 1) {
      [points[index], points[index + 1]] = [points[index + 1], points[index]];
      savePickupPoints(points);
      renderPickupPointsList();
    }
  });
}

function renderPickupPointsList() {
  const list = document.getElementById('pickup-points-list');
  if (!list) return;
  
  loadPickupPoints().then(points => {
    if (points.length === 0) {
      list.innerHTML = '<p class="pickup-empty">Aucun point relais configuré</p>';
      return;
    }
    
    list.innerHTML = points.map((point, index) => `
      <div class="pickup-point-item" data-point-id="${point.id}">
        <div class="pickup-point-priority">${index + 1}</div>
        <div class="pickup-point-content">
          <div class="pickup-point-name">${escapeHtml(point.name)}</div>
        </div>
        <div class="pickup-point-actions">
          ${index > 0 ? `<button class="btn-move-up" data-point-id="${point.id}" title="Monter">↑</button>` : '<span class="btn-placeholder"></span>'}
          ${index < points.length - 1 ? `<button class="btn-move-down" data-point-id="${point.id}" title="Descendre">↓</button>` : '<span class="btn-placeholder"></span>'}
          <button class="btn-delete-pickup" data-point-id="${point.id}" title="Supprimer">✖</button>
        </div>
      </div>
    `).join('');
    
    // Event listeners
    list.querySelectorAll('.btn-move-up').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        movePickupPointUp(btn.dataset.pointId);
      });
    });
    
    list.querySelectorAll('.btn-move-down').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        movePickupPointDown(btn.dataset.pointId);
      });
    });
    
    list.querySelectorAll('.btn-delete-pickup').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        deletePickupPoint(btn.dataset.pointId);
      });
    });
  });
}

function createPickupPointsSystem() {
  const sidebar = document.getElementById('sidebar');
  
  if (!sidebar) {
    pickupPointsRetries++;
    if (pickupPointsRetries < MAX_PICKUP_RETRIES) {
      console.warn(`[Pickup Points] Sidebar non trouvée (tentative ${pickupPointsRetries}/${MAX_PICKUP_RETRIES}), réessai dans 500ms`);
      setTimeout(createPickupPointsSystem, 500);
    } else {
      console.error("[Pickup Points] Sidebar introuvable après plusieurs tentatives, abandon");
    }
    return;
  }
  
  if (document.getElementById('pickup-points-system')) {
    console.log("[Pickup Points] Interface déjà créée");
    return;
  }
  
  try {
    const pickupSystem = document.createElement('div');
    pickupSystem.id = 'pickup-points-system';
    pickupSystem.className = 'pickup-points-system';
    pickupSystem.innerHTML = `
      <div class="pickup-system-header">
        <h3 class="pickup-system-title" id="pickup-system-title-toggle">Points Relais</h3>
        <button id="create-pickup-point" class="btn-create-pickup" title="Ajouter un point relais">Ajouter</button>
      </div>
      <div id="pickup-points-list" class="pickup-points-list">
        <p class="pickup-empty">Aucun point relais configuré</p>
      </div>
      <div class="pickup-system-info">
        <p class="pickup-info-text">⚡ Priorité: 1 > 2 > 3</p>
      </div>
    `;
    
    // Insérer dans le conteneur sticky après le système d'alertes
    const stickyContainer = document.getElementById('sidebar-sticky-container');
    if (stickyContainer) {
      stickyContainer.appendChild(pickupSystem);
    } else {
      const alertSystem = document.getElementById('alert-system');
      if (alertSystem && alertSystem.parentNode) {
        alertSystem.parentNode.insertBefore(pickupSystem, alertSystem.nextSibling);
      } else {
        sidebar.insertBefore(pickupSystem, sidebar.firstChild);
      }
    }
    
    document.getElementById('create-pickup-point').addEventListener('click', createPickupPoint);
    document.getElementById('pickup-system-title-toggle').addEventListener('click', () => {
      const pickupList = document.getElementById('pickup-points-list');
      const pickupInfo = document.querySelector('.pickup-system-info');
      const pickupSystemEl = document.getElementById('pickup-points-system');
      if (pickupList.style.display === 'none') {
        pickupList.style.display = 'flex';
        pickupInfo.style.display = 'block';
        pickupSystemEl.classList.remove('collapsed');
      } else {
        pickupList.style.display = 'none';
        pickupInfo.style.display = 'none';
        pickupSystemEl.classList.add('collapsed');
      }
    });
    renderPickupPointsList();
    
    console.log("[Pickup Points] Interface créée avec succès");
  } catch (error) {
    console.error("[Pickup Points] Erreur lors de la création:", error);
    pickupPointsRetries++;
    if (pickupPointsRetries < MAX_PICKUP_RETRIES) {
      setTimeout(createPickupPointsSystem, 500);
    }
  }
}

// ==================== FIN PICKUP POINTS SYSTEM ====================

let filterManagerRetries = 0;
const MAX_FILTER_RETRIES = 10;

function createFilterManager() {
  const sidebar = document.getElementById('sidebar');
  
  if (!sidebar) {
    filterManagerRetries++;
    if (filterManagerRetries < MAX_FILTER_RETRIES) {
      console.warn(`[Filter Manager] Sidebar non trouvée (tentative ${filterManagerRetries}/${MAX_FILTER_RETRIES}), réessai dans 500ms`);
      setTimeout(createFilterManager, 500);
    } else {
      console.error("[Filter Manager] Sidebar introuvable après plusieurs tentatives, abandon");
    }
    return;
  }
  
  if (document.getElementById('filter-manager')) {
    console.log("[Filter Manager] Interface déjà créée");
    return;
  }
  
  try {
    // Créer le conteneur sticky qui englobera filtres + alertes
    const stickyContainer = document.createElement('div');
    stickyContainer.id = 'sidebar-sticky-container';
    stickyContainer.className = 'sidebar-sticky-container';
    
    const filterManager = document.createElement('div');
    filterManager.id = 'filter-manager';
    filterManager.className = 'filter-manager';
    filterManager.innerHTML = `
      <div class="filter-manager-header">
        <h3 class="filter-manager-title" id="filter-manager-title-toggle">Filtres Sauvegardés</h3>
        <button id="save-current-filter" class="btn-save-filter" title="Sauvegarder le filtre actuel">Sauvegarder</button>
      </div>
      <div id="filter-list" class="filter-list">
        <p class="filter-empty">Aucun filtre sauvegardé</p>
      </div>
    `;
    
    stickyContainer.appendChild(filterManager);
    sidebar.insertBefore(stickyContainer, sidebar.firstChild);
    document.getElementById('save-current-filter').addEventListener('click', saveCurrentFilter);
    document.getElementById('filter-manager-title-toggle').addEventListener('click', () => {
      const filterList = document.getElementById('filter-list');
      const filterManagerEl = document.getElementById('filter-manager');
      if (filterList.style.display === 'none') {
        filterList.style.display = 'flex';
        filterManagerEl.classList.remove('collapsed');
      } else {
        filterList.style.display = 'none';
        filterManagerEl.classList.add('collapsed');
      }
    });
    loadSavedFilters().then(() => renderFilterList());
    
    console.log("[Filter Manager] Interface créée avec succès");
    filterManagerRetries = 0;
  } catch (error) {
    console.error("[Filter Manager] Erreur lors de la création:", error);
    filterManagerRetries++;
    if (filterManagerRetries < MAX_FILTER_RETRIES) {
      setTimeout(createFilterManager, 500);
    }
  }
}

// ==================== UI ====================
let toggleButtonRetries = 0;
const MAX_TOGGLE_RETRIES = 10;

function createToggleButton() {
  if (document.getElementById('toggle-monitor')) {
    console.log("[Vinted Monitor] Bouton toggle déjà créé");
    return;
  }

  const navbarRight = document.querySelector('nav .u-position-relative') || document.querySelector('.u-position-relative');
  
  if (!navbarRight) {
    toggleButtonRetries++;
    if (toggleButtonRetries < MAX_TOGGLE_RETRIES) {
      console.warn(`[Vinted Monitor] Élément de langue non trouvé (tentative ${toggleButtonRetries}/${MAX_TOGGLE_RETRIES}), réessai dans 500ms`);
      setTimeout(createToggleButton, 500);
    } else {
      console.error("[Vinted Monitor] Élément de langue introuvable après plusieurs tentatives, abandon");
    }
    return;
  }

  const btnWrapper = document.createElement("div");
  btnWrapper.style.cssText = `display: inline-flex; align-items: center; gap: 8px; margin-left: 12px;`;
  
  // Bouton Buy Toggle
  const buyButtonToggle = document.createElement("button");
  buyButtonToggle.id = "buy-button-toggle";
  buyButtonToggle.className = "btn-buy-toggle";
  buyButtonToggle.textContent = state.buyButtonEnabled ? "🛒" : "🚫";
  buyButtonToggle.title = state.buyButtonEnabled ? "Désactiver le bouton Buy" : "Activer le bouton Buy";
  buyButtonToggle.style.cssText = `padding: 8px 12px; background: #6b7280; color: white; border: none; border-radius: 8px; font-size: 16px; cursor: pointer; transition: all 0.2s ease; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);`;
  buyButtonToggle.addEventListener("click", toggleBuyButton);
  buyButtonToggle.addEventListener("mouseenter", () => {
    buyButtonToggle.style.background = "#4b5563";
    buyButtonToggle.style.transform = "translateY(-1px)";
    buyButtonToggle.style.boxShadow = "0 4px 8px rgba(0, 0, 0, 0.15)";
  });
  buyButtonToggle.addEventListener("mouseleave", () => {
    buyButtonToggle.style.background = "#6b7280";
    buyButtonToggle.style.transform = "translateY(0)";
    buyButtonToggle.style.boxShadow = "0 2px 4px rgba(0, 0, 0, 0.1)";
  });
  
  // Bouton Dark Mode
  const darkModeBtn = document.createElement("button");
  darkModeBtn.id = "dark-mode-toggle";
  darkModeBtn.className = "btn-dark-mode";
  darkModeBtn.textContent = state.darkMode ? "☀️" : "🌙";
  darkModeBtn.title = state.darkMode ? "Mode clair" : "Mode sombre";
  darkModeBtn.style.cssText = `padding: 8px 12px; background: #6b7280; color: white; border: none; border-radius: 8px; font-size: 16px; cursor: pointer; transition: all 0.2s ease; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);`;
  darkModeBtn.addEventListener("click", toggleDarkMode);
  darkModeBtn.addEventListener("mouseenter", () => {
    darkModeBtn.style.background = "#4b5563";
    darkModeBtn.style.transform = "translateY(-1px)";
    darkModeBtn.style.boxShadow = "0 4px 8px rgba(0, 0, 0, 0.15)";
  });
  darkModeBtn.addEventListener("mouseleave", () => {
    darkModeBtn.style.background = "#6b7280";
    darkModeBtn.style.transform = "translateY(0)";
    darkModeBtn.style.boxShadow = "0 2px 4px rgba(0, 0, 0, 0.1)";
  });
  
  // Bouton Monitor
  const toggleBtn = document.createElement("button");
  toggleBtn.id = "toggle-monitor";
  toggleBtn.className = "btn-monitor-toggle";
  toggleBtn.textContent = "▶";
  toggleBtn.style.cssText = `padding: 8px 16px; background: #3b82f6; color: white; border: none; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; transition: all 0.2s ease; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);`;
  
  btnWrapper.appendChild(buyButtonToggle);
  btnWrapper.appendChild(darkModeBtn);
  btnWrapper.appendChild(toggleBtn);
  navbarRight.parentNode.insertBefore(btnWrapper, navbarRight.nextSibling);
  
  console.log("[Vinted Monitor] Bouton toggle créé avec succès");
  toggleButtonRetries = 0;
  
  toggleBtn.addEventListener("click", toggleMonitor);
  
  toggleBtn.addEventListener("mouseenter", () => {
    toggleBtn.style.background = "#2563eb";
    toggleBtn.style.transform = "translateY(-1px)";
    toggleBtn.style.boxShadow = "0 4px 8px rgba(0, 0, 0, 0.15)";
  });
  toggleBtn.addEventListener("mouseleave", () => {
    toggleBtn.style.transform = "translateY(0)";
    toggleBtn.style.boxShadow = "0 2px 4px rgba(0, 0, 0, 0.1)";
    if (!state.isPolling) {
      toggleBtn.style.background = "#3b82f6";
    } else {
      toggleBtn.style.background = "#dc2626";
    }
  });
}

function createMonitorUI() {
  const container = document.createElement("div");
  container.id = "vinted-monitor-container";
  container.innerHTML = `<div id="items-container" class="items-grid"></div>`;

  const navCategories = document.querySelector('ul.nav.nav-detailed.nav-page-categories[data-testid="sub-catalog-navigation-links"]');
  
  if (navCategories && navCategories.parentNode) {
    navCategories.parentNode.insertBefore(container, navCategories.nextSibling);
  } else {
    const body = document.body;
    if (body.firstChild) {
      body.insertBefore(container, body.firstChild);
    } else {
      body.appendChild(container);
    }
  }

  createToggleButton();
  createFilterManager();
  createAlertSystem();
  createPickupPointsSystem();
  setTimeout(() => startMonitor(), 500);
}

// ==================== INIT ====================
function isOnCatalogPage() {
  return window.location.pathname.startsWith('/catalog');
}

function isAlreadyInitialized() {
  return document.getElementById('vinted-monitor-container') !== null || 
         document.getElementById('toggle-monitor') !== null;
}

function init() {
  console.log("[Vinted Monitor] Extension chargée");

  // Charger le dark mode et l'état du bouton buy en premier
  loadDarkMode();
  loadBuyButtonState();

  if (!isOnCatalogPage()) {
    console.log("[Vinted Monitor] Pas sur une page catalog, extension désactivée");
    return;
  }

  if (isAlreadyInitialized()) {
    console.log("[Vinted Monitor] Extension déjà initialisée");
    return;
  }

  const tryCreateUI = () => {
    try {
      createMonitorUI();
      observeUrlChanges();
      console.log("[Vinted Monitor] UI créée avec succès");
    } catch (error) {
      console.error("[Vinted Monitor] Erreur lors de la création de l'UI:", error);
      setTimeout(tryCreateUI, 1000);
    }
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      setTimeout(tryCreateUI, 1000);
    });
  } else if (document.readyState === "interactive") {
    setTimeout(tryCreateUI, 1500);
  } else if (document.readyState === "complete") {
    setTimeout(tryCreateUI, 1000);
  } else {
    setTimeout(tryCreateUI, 1000);
  }
}

init();

