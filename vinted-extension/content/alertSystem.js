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
  
  // Mettre à jour le compteur
  updateAlertsCount();
  
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
        <div class="alert-item-actions">
          <label class="alert-toggle">
            <input type="checkbox" ${alert.enabled ? 'checked' : ''} data-alert-id="${alert.id}" class="alert-toggle-input">
            <span class="alert-toggle-slider"></span>
          </label>
          <button class="btn-delete-alert" data-alert-id="${alert.id}" title="Supprimer">✖</button>
        </div>
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

// État du filtre par alertes
let isAlertFilterActive = false;
const ALERT_FILTER_STORAGE_KEY = 'vinted_alert_filter_active';

// Charger l'état du filtre par alertes depuis le storage
async function loadAlertFilterState() {
  try {
    const result = await chrome.storage.local.get(ALERT_FILTER_STORAGE_KEY);
    isAlertFilterActive = result[ALERT_FILTER_STORAGE_KEY] || false;
    // Mettre à jour le bouton si disponible
    updateAlertFilterButton();
    // Réappliquer le filtre si actif
    if (isAlertFilterActive) {
      applyAlertFilter();
    }
  } catch (error) {
    console.error("[Alert Filter] Erreur lors du chargement:", error);
    isAlertFilterActive = false;
  }
}

// Mettre à jour l'état visuel du bouton de filtre
function updateAlertFilterButton() {
  const filterBtn = document.getElementById('filter-by-alerts');
  if (!filterBtn) return;
  
  if (isAlertFilterActive) {
    filterBtn.textContent = 'Tout';
    filterBtn.classList.add('active');
    filterBtn.title = 'Afficher tous les items';
  } else {
    filterBtn.textContent = 'Filtrer';
    filterBtn.classList.remove('active');
    filterBtn.title = 'Afficher uniquement les items avec mots-clés des alertes';
  }
}

// Sauvegarder l'état du filtre par alertes
async function saveAlertFilterState() {
  try {
    await chrome.storage.local.set({ [ALERT_FILTER_STORAGE_KEY]: isAlertFilterActive });
  } catch (error) {
    console.error("[Alert Filter] Erreur lors de la sauvegarde:", error);
  }
}

// Toggle du filtre par alertes
async function toggleAlertFilter() {
  const filterBtn = document.getElementById('filter-by-alerts');
  if (!filterBtn) return;
  
  isAlertFilterActive = !isAlertFilterActive;
  await saveAlertFilterState();
  
  if (isAlertFilterActive) {
    applyAlertFilter();
  } else {
    removeAlertFilter();
  }
  
  // Mettre à jour l'état du bouton
  updateAlertFilterButton();
}

// Appliquer le filtre par alertes
function applyAlertFilter() {
  // Récupérer tous les mots-clés de toutes les alertes
  const allKeywords = [];
  state.alerts.forEach(alert => {
    if (alert.enabled && alert.keywords) {
      allKeywords.push(...alert.keywords);
    }
  });
  
  if (allKeywords.length === 0) {
    alert('Aucun mot-clé défini dans les alertes actives.');
    toggleAlertFilter(); // Désactiver le filtre
    return;
  }
  
  // Filtrer les items affichés
  const itemCards = document.querySelectorAll('.item-card');
  itemCards.forEach(card => {
    const titleElement = card.querySelector('.item-title');
    if (titleElement) {
      const title = titleElement.textContent.toLowerCase();
      const matchesKeyword = allKeywords.some(keyword => 
        title.includes(keyword.toLowerCase())
      );
      
      if (matchesKeyword) {
        card.style.display = '';
      } else {
        card.style.display = 'none';
      }
    }
  });
}

// Retirer le filtre par alertes
function removeAlertFilter() {
  const itemCards = document.querySelectorAll('.item-card');
  itemCards.forEach(card => {
    card.style.display = '';
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
    alertSystem.style.display = 'none'; // Masqué par défaut
    alertSystem.innerHTML = `
      <div class="alert-system-header">
        <h3 class="alert-system-title">Alertes Prix</h3>
        <div class="alert-buttons">
          <button id="filter-by-alerts" class="btn-filter-alerts" title="Afficher uniquement les items avec mots-clés des alertes">Filtrer</button>
          <button id="create-alert" class="btn-create-alert" title="Créer une alerte">Créer</button>
        </div>
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
    document.getElementById('filter-by-alerts').addEventListener('click', toggleAlertFilter);
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