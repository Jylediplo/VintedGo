// ==================== SIDEBAR TABS SYSTEM ====================
let activeTab = 'messages'; // Par défaut sur les messages

function createSidebarTabs() {
  const sidebarStickyContainer = document.getElementById('sidebar-sticky-container');
  if (!sidebarStickyContainer) return;

  if (document.getElementById('vinted-sidebar-tabs')) {
    return; // Déjà créé
  }

  const tabsContainer = document.createElement('div');
  tabsContainer.id = 'vinted-sidebar-tabs';
  tabsContainer.className = 'vinted-sidebar-tabs';
  tabsContainer.innerHTML = `
    <button class="sidebar-tab active" data-tab="messages" title="Messages">
      <svg class="tab-icon tab-icon-messages" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"></path>
      </svg>
      <span class="tab-label">Messages</span>
      <span class="tab-count" id="messages-count">0</span>
    </button>
    <button class="sidebar-tab" data-tab="orders" title="Mes Commandes">
      <svg class="tab-icon tab-icon-orders" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"></path>
      </svg>
      <span class="tab-label">Commandes</span>
      <span class="tab-count" id="orders-count">0</span>
    </button>
    <button class="sidebar-tab" data-tab="pickup" title="Points Relais">
      <svg class="tab-icon tab-icon-pickup" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path>
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path>
      </svg>
      <span class="tab-label">Relais</span>
      <span class="tab-count" id="pickup-count">0</span>
    </button>
    <button class="sidebar-tab" data-tab="filters" title="Filtres Sauvegardés">
      <svg class="tab-icon tab-icon-filters" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"></path>
      </svg>
      <span class="tab-label">Filtres</span>
      <span class="tab-count" id="filters-count">0</span>
    </button>
    <button class="sidebar-tab" data-tab="alerts" title="Alertes Prix">
      <svg class="tab-icon tab-icon-alerts" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"></path>
      </svg>
      <span class="tab-label">Alertes</span>
      <span class="tab-count" id="alerts-count">0</span>
    </button>
    <button class="sidebar-tab" data-tab="wardrobe" title="Mes Articles">
      <svg class="tab-icon tab-icon-wardrobe" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"></path>
      </svg>
      <span class="tab-label">Articles</span>
      <span class="tab-count" id="wardrobe-count">0</span>
    </button>
  `;

  // Insérer en premier dans le sticky container
  sidebarStickyContainer.insertBefore(tabsContainer, sidebarStickyContainer.firstChild);

  // Event listeners pour les tabs
  tabsContainer.querySelectorAll('.sidebar-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const tabName = tab.dataset.tab;
      switchTab(tabName);
    });
  });

  // Observer le compteur de messages
  observeMessagesCount();
  
  // Mettre à jour tous les compteurs
  updatePickupCount();
  updateFiltersCount();
  updateAlertsCount();
  refreshWardrobeCount(); // Mettre à jour le compteur du wardrobe
  
  // Observer les changements dans les listes pour mettre à jour les compteurs
  const observer = new MutationObserver(() => {
    updatePickupCount();
    updateFiltersCount();
    updateAlertsCount();
  });
  
  // Observer les listes de filtres, alertes et points relais
  setTimeout(() => {
    const filterList = document.getElementById('filter-list');
    const alertList = document.getElementById('alert-list');
    const pickupList = document.getElementById('pickup-points-list');
    
    if (filterList) {
      observer.observe(filterList, { childList: true, subtree: true });
    }
    if (alertList) {
      observer.observe(alertList, { childList: true, subtree: true });
    }
    if (pickupList) {
      observer.observe(pickupList, { childList: true, subtree: true });
    }
  }, 2000);
  
  // Initialiser l'affichage par défaut (messages) après un petit délai
  setTimeout(() => {
    switchTab('messages');
  }, 100);
}

function switchTab(tabName) {
  activeTab = tabName;

  // Mettre à jour les tabs
  document.querySelectorAll('.sidebar-tab').forEach(tab => {
    if (tab.dataset.tab === tabName) {
      tab.classList.add('active');
    } else {
      tab.classList.remove('active');
    }
  });

  // Afficher/masquer les sections
  const messagesContainer = document.getElementById('messages-sticky-container');
  const messagesListManager = document.getElementById('vinted-messages-list-manager');
  const ordersManager = document.getElementById('vinted-orders-manager');
  const pickupSystem = document.getElementById('pickup-points-system');
  const filterManager = document.getElementById('filter-manager');
  const alertSystem = document.getElementById('alert-system');
  const wardrobeManager = document.getElementById('vinted-wardrobe-manager');

  // Masquer toutes les sections
  if (messagesContainer) messagesContainer.style.display = 'none';
  if (messagesListManager) messagesListManager.style.display = 'none';
  if (ordersManager) ordersManager.style.display = 'none';
  if (pickupSystem) pickupSystem.style.display = 'none';
  if (filterManager) filterManager.style.display = 'none';
  if (alertSystem) alertSystem.style.display = 'none';
  if (wardrobeManager) wardrobeManager.style.display = 'none';

  // Afficher la section active
  switch(tabName) {
    case 'messages':
      if (messagesContainer) messagesContainer.style.display = 'block';
      if (messagesListManager) messagesListManager.style.display = 'block';
      // Démarrer le rafraîchissement automatique des messages toutes les 5 secondes
      // (startMessagesAutoRefresh gère déjà l'arrêt d'un intervalle existant)
      startMessagesAutoRefresh();
      break;
    case 'orders':
      // Arrêter le rafraîchissement automatique si on change d'onglet
      stopMessagesAutoRefresh();
      if (ordersManager) ordersManager.style.display = 'block';
      break;
    case 'pickup':
      stopMessagesAutoRefresh();
      if (pickupSystem) pickupSystem.style.display = 'block';
      break;
    case 'filters':
      stopMessagesAutoRefresh();
      if (filterManager) filterManager.style.display = 'block';
      break;
    case 'alerts':
      stopMessagesAutoRefresh();
      if (alertSystem) alertSystem.style.display = 'block';
      break;
    case 'wardrobe':
      stopMessagesAutoRefresh();
      if (wardrobeManager) wardrobeManager.style.display = 'block';
      break;
    default:
      // Arrêter le rafraîchissement automatique si on change d'onglet
      stopMessagesAutoRefresh();
      break;
  }
}

async function updateMessagesCountInTab() {
  const messagesCountEl = document.getElementById('messages-count');
  if (!messagesCountEl) return;

  try {
    // Charger les messages pour compter les non lus
    const data = await fetchInbox(1, 50);
    if (data && data.conversations) {
      const unreadCount = data.conversations.filter(conv => conv.unread === true).length;
      if (unreadCount > 0) {
        messagesCountEl.textContent = unreadCount;
        messagesCountEl.style.display = 'inline-block';
      } else {
        messagesCountEl.textContent = '';
        messagesCountEl.style.display = 'none';
      }
    } else {
      // Fallback sur le compteur du manager si disponible
      const vintedMessagesCount = document.getElementById('vinted-messages-count');
      if (vintedMessagesCount) {
        const text = vintedMessagesCount.textContent.trim();
        const match = text.match(/\((\d+)\)/);
        if (match) {
          messagesCountEl.textContent = match[1];
          messagesCountEl.style.display = 'inline-block';
        } else {
          messagesCountEl.style.display = 'none';
        }
      }
    }
  } catch (error) {
    console.error("[Messages Count] Erreur lors de la mise à jour du compteur:", error);
  }
}

function updateOrdersCount() {
  const ordersCountEl = document.getElementById('orders-count');
  if (!ordersCountEl) return;

  // Utiliser le cache si disponible, sinon charger
  if (cachedOrders !== null) {
    const inProgressCount = cachedOrders.filter(order => 
      order.transaction_user_status === 'needs_action'
    ).length;
    
    if (inProgressCount > 0) {
      ordersCountEl.textContent = inProgressCount;
      ordersCountEl.style.display = 'inline-block';
    } else {
      ordersCountEl.textContent = '';
      ordersCountEl.style.display = 'none';
    }
  } else {
    // Si pas encore chargé, charger puis mettre à jour
    loadAllOrders().then(() => {
      updateOrdersCount();
    }).catch(() => {
      ordersCountEl.textContent = '';
      ordersCountEl.style.display = 'none';
    });
  }
}

// Observer pour mettre à jour le compteur de messages quand il change
function observeMessagesCount() {
  const observer = new MutationObserver(() => {
    updateMessagesCountInTab();
  });
  
  const messagesCountEl = document.getElementById('vinted-messages-count');
  if (messagesCountEl) {
    observer.observe(messagesCountEl, {
      childList: true,
      characterData: true,
      subtree: true
    });
  }
  
  // Mettre à jour immédiatement
  setTimeout(updateMessagesCountInTab, 1000);
}

function updatePickupCount() {
  const pickupCountEl = document.getElementById('pickup-count');
  if (!pickupCountEl) return;

  loadPickupPoints().then(points => {
    const count = points.length;
    if (count > 0) {
      pickupCountEl.textContent = count;
      pickupCountEl.style.display = 'inline-block';
    } else {
      pickupCountEl.textContent = '';
      pickupCountEl.style.display = 'none';
    }
  }).catch(() => {
    pickupCountEl.textContent = '';
    pickupCountEl.style.display = 'none';
  });
}

function updateFiltersCount() {
  const filtersCountEl = document.getElementById('filters-count');
  if (!filtersCountEl) return;

  // state.savedFilters devrait être disponible
  if (typeof state !== 'undefined' && state.savedFilters) {
    const count = state.savedFilters.length;
    if (count > 0) {
      filtersCountEl.textContent = count;
      filtersCountEl.style.display = 'inline-block';
    } else {
      filtersCountEl.textContent = '';
      filtersCountEl.style.display = 'none';
    }
  } else {
    // Fallback: charger depuis le storage
    chrome.storage.local.get([CONFIG.STORAGE_KEY], (result) => {
      const filters = result[CONFIG.STORAGE_KEY] || [];
      const count = filters.length;
      if (count > 0) {
        filtersCountEl.textContent = count;
        filtersCountEl.style.display = 'inline-block';
      } else {
        filtersCountEl.textContent = '';
        filtersCountEl.style.display = 'none';
      }
    });
  }
}

function updateAlertsCount() {
  const alertsCountEl = document.getElementById('alerts-count');
  if (!alertsCountEl) return;

  // state.alerts devrait être disponible
  if (typeof state !== 'undefined' && state.alerts) {
    const count = state.alerts.length;
    if (count > 0) {
      alertsCountEl.textContent = count;
      alertsCountEl.style.display = 'inline-block';
    } else {
      alertsCountEl.textContent = '';
      alertsCountEl.style.display = 'none';
    }
  } else {
    // Fallback: charger depuis le storage
    chrome.storage.local.get([CONFIG.ALERTS_STORAGE_KEY], (result) => {
      const alerts = result[CONFIG.ALERTS_STORAGE_KEY] || [];
      const count = alerts.length;
      if (count > 0) {
        alertsCountEl.textContent = count;
        alertsCountEl.style.display = 'inline-block';
      } else {
        alertsCountEl.textContent = '';
        alertsCountEl.style.display = 'none';
      }
    });
  }
}