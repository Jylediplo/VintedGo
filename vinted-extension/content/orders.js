// ==================== ORDERS ====================
function getAnonId() {
  const cookies = document.cookie.split(';');
  for (const cookie of cookies) {
    const [name, value] = cookie.trim().split('=');
    if (name === 'anon_id') {
      return decodeURIComponent(value);
    }
  }
  return null;
}

/**
 * Récupère les commandes depuis l'API Vinted
 * @param {string} type - 'purchased' pour les achats, 'sold' pour les ventes
 * @param {string} status - Statut de filtrage ('all', 'completed', 'waiting', 'needs_action', 'failed')
 * @param {number} page - Numéro de page
 * @param {number} perPage - Nombre d'éléments par page
 * @returns {Promise<Object|null>} - Données des commandes
 */
async function fetchMyOrders(type = 'purchased', status = 'all', page = 1, perPage = 20) {
  try {
    const url = `https://www.vinted.fr/api/v2/my_orders?type=${type}&status=${status}&per_page=${perPage}&page=${page}`;
    const headers = {
      'accept': 'application/json, text/plain, */*',
      'accept-language': 'fr',
    };
    
    const anonId = getAnonId();
    if (anonId) {
      headers['x-anon-id'] = anonId;
    }
    
    const response = await fetch(url, {
      method: 'GET',
      credentials: 'include',
      headers: headers
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error(`[Orders] Erreur lors de la récupération des commandes (${type}):`, error);
    return null;
  }
}

/**
 * Charge toutes les pages de commandes
 * @param {string} type - 'purchased' ou 'sold'
 * @param {string} status - Statut de filtrage
 * @returns {Promise<Array>} - Liste de toutes les commandes
 */
async function loadAllOrders(type, status = 'all') {
  let allOrders = [];
  let currentPage = 1;
  let hasMore = true;

  while (hasMore) {
    const data = await fetchMyOrders(type, status, currentPage, 20);
    if (data && data.my_orders && data.my_orders.length > 0) {
      allOrders = [...allOrders, ...data.my_orders];
      const totalPages = data.pagination?.total_pages || 0;
      hasMore = currentPage < totalPages;
      currentPage++;
    } else {
      hasMore = false;
    }
  }

  return allOrders;
}

function formatOrderDate(dateString) {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
}

function formatOrderPrice(price) {
  const amount = parseFloat(price.amount) || 0;
  const currency = price.currency_code || 'EUR';
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
}

function getOrderStatusClass(status) {
  const statusLower = status.toLowerCase();
  if (statusLower.includes('finalisée') || statusLower.includes('validé') || statusLower.includes('livrée')) {
    return 'completed';
  } else if (statusLower.includes('remboursement') || statusLower.includes('annul')) {
    return 'failed';
  } else if (statusLower.includes('en cours') || statusLower.includes('attente') || statusLower.includes('bordereau')) {
    return 'waiting';
  } else if (statusLower.includes('action')) {
    return 'needs_action';
  } else {
    return 'in-progress';
  }
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function renderOrdersList(orders, type, statusFilter) {
  const listId = type === 'purchased' ? 'vinted-orders-purchased-list' : 'vinted-orders-sold-list';
  const ordersList = document.getElementById(listId);
  if (!ordersList) return;

  if (!orders || orders.length === 0) {
    ordersList.innerHTML = '<p class="orders-empty">Aucune commande</p>';
    return;
  }

  ordersList.innerHTML = orders.map(order => {
    const photoUrl = order.photo?.url || order.photo?.thumbnails?.[0]?.url || '';
    const price = formatOrderPrice(order.price);
    const date = formatOrderDate(order.date);
    const statusClass = getOrderStatusClass(order.status);
    const conversationUrl = `https://www.vinted.fr/inbox/${order.conversation_id}`;

    return `
      <div class="order-item" data-order-id="${order.transaction_id}">
        ${photoUrl ? `<img src="${photoUrl}" alt="${escapeHtml(order.title)}" class="order-photo" loading="lazy">` : '<div class="order-photo-placeholder">Pas de photo</div>'}
        <div class="order-info">
          <div class="order-title" title="${escapeHtml(order.title)}">${escapeHtml(order.title)}</div>
          <div class="order-price">${price}</div>
          <div class="order-date">${escapeHtml(date)}</div>
          <div class="order-status ${statusClass}">${escapeHtml(order.status)}</div>
        </div>
        <a href="${conversationUrl}" target="_blank" class="order-link" title="Voir la conversation">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
            <polyline points="15 3 21 3 21 9"></polyline>
            <line x1="10" y1="14" x2="21" y2="3"></line>
          </svg>
        </a>
      </div>
    `;
  }).join('');
}

// Cache pour les commandes
let cachedPurchasedOrders = null;
let cachedSoldOrders = null;
let isLoadingPurchased = false;
let isLoadingSold = false;

// État actuel
let currentOrderType = 'purchased'; // 'purchased' ou 'sold'
let currentPurchasedStatus = 'waiting'; // Par défaut "En attente" pour les achats
let currentSoldStatus = 'needs_action'; // Par défaut "Action requise" pour les ventes

/**
 * Charge toutes les commandes d'achat
 */
async function loadAllPurchasedOrders() {
  if (isLoadingPurchased || cachedPurchasedOrders !== null) {
    return cachedPurchasedOrders;
  }

  isLoadingPurchased = true;
  const listContainer = document.getElementById('vinted-orders-purchased-list');
  if (listContainer) {
    listContainer.innerHTML = '<p class="orders-loading">Chargement des achats...</p>';
  }

  const orders = await loadAllOrders('purchased', 'all');
  cachedPurchasedOrders = orders;
  isLoadingPurchased = false;

  return orders;
}

/**
 * Charge toutes les commandes de vente
 */
async function loadAllSoldOrders() {
  if (isLoadingSold || cachedSoldOrders !== null) {
    return cachedSoldOrders;
  }

  isLoadingSold = true;
  const listContainer = document.getElementById('vinted-orders-sold-list');
  if (listContainer) {
    listContainer.innerHTML = '<p class="orders-loading">Chargement des ventes...</p>';
  }

  const orders = await loadAllOrders('sold', 'all');
  cachedSoldOrders = orders;
  isLoadingSold = false;

  return orders;
}

/**
 * Filtre les commandes selon le statut
 */
function filterOrders(type, status) {
  let orders = [];
  let filteredOrders = [];

  if (type === 'purchased') {
    if (cachedPurchasedOrders === null) {
      const listContainer = document.getElementById('vinted-orders-purchased-list');
      if (listContainer) {
        listContainer.innerHTML = '<p class="orders-loading">Chargement...</p>';
      }
      loadAllPurchasedOrders().then(() => filterOrders(type, status));
      return;
    }
    orders = cachedPurchasedOrders;
    currentPurchasedStatus = status;
  } else {
    if (cachedSoldOrders === null) {
      const listContainer = document.getElementById('vinted-orders-sold-list');
      if (listContainer) {
        listContainer.innerHTML = '<p class="orders-loading">Chargement...</p>';
      }
      loadAllSoldOrders().then(() => filterOrders(type, status));
    return;
    }
    orders = cachedSoldOrders;
    currentSoldStatus = status;
  }

  if (status === 'all') {
    filteredOrders = orders;
  } else {
    filteredOrders = orders.filter(order => {
      return order.transaction_user_status === status;
    });
  }

  renderOrdersList(filteredOrders, type, status);
  updateOrdersFilterButtons(type, status, orders);
}

/**
 * Change le type de commandes affichées (achats/ventes)
 */
function switchOrderType(type) {
  currentOrderType = type;
  
  // Mettre à jour les onglets
  const purchasedTab = document.getElementById('orders-tab-purchased');
  const soldTab = document.getElementById('orders-tab-sold');
  const purchasedSection = document.getElementById('vinted-orders-purchased-section');
  const soldSection = document.getElementById('vinted-orders-sold-section');

  if (purchasedTab && soldTab) {
    if (type === 'purchased') {
      purchasedTab.classList.add('active');
      soldTab.classList.remove('active');
      if (purchasedSection) purchasedSection.style.display = 'block';
      if (soldSection) soldSection.style.display = 'none';
    } else {
      soldTab.classList.add('active');
      purchasedTab.classList.remove('active');
      if (purchasedSection) purchasedSection.style.display = 'none';
      if (soldSection) soldSection.style.display = 'block';
    }
  }

  // Charger les commandes si nécessaire avec le filtre par défaut
  if (type === 'purchased') {
    const status = currentPurchasedStatus || 'waiting';
    filterOrders('purchased', status);
  } else {
    const status = currentSoldStatus || 'needs_action';
    filterOrders('sold', status);
  }
}

/**
 * Met à jour les boutons de filtre avec les compteurs et le label de catégorie
 */
function updateOrdersFilterButtons(type, activeStatus, orders = null) {
  const containerId = type === 'purchased' ? 'vinted-orders-purchased-filters' : 'vinted-orders-sold-filters';
  const categoryLabelId = type === 'purchased' ? 'vinted-orders-purchased-category' : 'vinted-orders-sold-category';
  const buttons = document.querySelectorAll(`#${containerId} .order-filter-btn`);
  const categoryLabel = document.getElementById(categoryLabelId);
  
  // Calculer les compteurs
  let counts = { all: 0, waiting: 0, needs_action: 0, completed: 0, failed: 0 };
  if (orders) {
    counts.all = orders.length;
    counts.waiting = orders.filter(order => order.transaction_user_status === 'waiting').length;
    counts.needs_action = orders.filter(order => order.transaction_user_status === 'needs_action').length;
    counts.completed = orders.filter(order => order.transaction_user_status === 'completed').length;
    counts.failed = orders.filter(order => order.transaction_user_status === 'failed').length;
  }
  
  const categoryTexts = {
    'all': 'Toutes',
    'waiting': 'En attente',
    'needs_action': 'Action requise',
    'completed': 'Finalisées',
    'failed': 'Annulées'
  };
  
  // Mettre à jour le label de catégorie
  if (categoryLabel) {
    const categoryText = categoryTexts[activeStatus] || activeStatus;
    const count = counts[activeStatus] || 0;
    categoryLabel.textContent = `${categoryText} (${count})`;
  }
  
  // Mettre à jour les boutons (actif/inactif)
  buttons.forEach(btn => {
    const status = btn.dataset.status;
    if (status === activeStatus) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
}

/**
 * Met à jour le compteur de commandes dans l'onglet
 */
function updateOrdersCount() {
  const ordersTab = document.getElementById('sidebar-tab-orders');
  if (!ordersTab) return;

  let purchasedWaitingCount = 0;
  let soldNeedsActionCount = 0;
  
  if (cachedPurchasedOrders) {
    purchasedWaitingCount = cachedPurchasedOrders.filter(order => 
      order.transaction_user_status === 'waiting'
    ).length;
  }
  if (cachedSoldOrders) {
    soldNeedsActionCount = cachedSoldOrders.filter(order => 
      order.transaction_user_status === 'needs_action'
    ).length;
  }

  const countBadge = ordersTab.querySelector('.tab-count-badge');
  if (countBadge) {
    const totalCount = purchasedWaitingCount + soldNeedsActionCount;
    if (totalCount > 0) {
      // Afficher les deux compteurs séparés : "Achats en attente / Ventes action requise"
      let countText = '';
      if (purchasedWaitingCount > 0 && soldNeedsActionCount > 0) {
        countText = `${purchasedWaitingCount}/${soldNeedsActionCount}`;
      } else if (purchasedWaitingCount > 0) {
        countText = purchasedWaitingCount.toString();
      } else if (soldNeedsActionCount > 0) {
        countText = soldNeedsActionCount.toString();
      }
      
      if (countText) {
        countBadge.textContent = countText;
        countBadge.style.display = 'flex';
        countBadge.title = `Achats en attente: ${purchasedWaitingCount} | Ventes action requise: ${soldNeedsActionCount}`;
      } else {
        countBadge.style.display = 'none';
      }
    } else {
      countBadge.style.display = 'none';
    }
  }
}

let ordersManagerRetries = 0;
const MAX_ORDERS_RETRIES = 10;

function createOrdersManager() {
  const sidebar = document.getElementById('sidebar');
  if (!sidebar) {
    ordersManagerRetries++;
    if (ordersManagerRetries < MAX_ORDERS_RETRIES) {
      setTimeout(createOrdersManager, 500);
    }
    return;
  }

  if (document.getElementById('vinted-orders-manager')) {
    return; // Déjà créé
  }

  const ordersManager = document.createElement('div');
  ordersManager.id = 'vinted-orders-manager';
  ordersManager.className = 'vinted-orders-manager';
  ordersManager.style.display = 'none'; // Masqué par défaut
  ordersManager.innerHTML = `
    <div class="vinted-orders-manager-header">
      <h3 class="vinted-orders-manager-title">Mes Commandes</h3>
    </div>
    
    <!-- Onglets pour basculer entre Achats et Ventes -->
    <div class="vinted-orders-tabs">
      <button id="orders-tab-purchased" class="order-type-tab active" data-type="purchased">
        <svg class="tab-icon tab-icon-purchased" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"></path>
        </svg>
        <span class="tab-label">Achats</span>
      </button>
      <button id="orders-tab-sold" class="order-type-tab" data-type="sold">
        <svg class="tab-icon tab-icon-sold" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
        </svg>
        <span class="tab-label">Ventes</span>
      </button>
    </div>

    <!-- Section Achats -->
    <div id="vinted-orders-purchased-section" class="vinted-orders-section">
      <div id="vinted-orders-purchased-filters" class="vinted-orders-filters">
        <button class="order-filter-btn active" data-status="all" data-type="purchased" title="Toutes">
          <svg class="filter-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 10h16M4 14h16M4 18h16"></path>
          </svg>
        </button>
        <button class="order-filter-btn" data-status="waiting" data-type="purchased" title="En attente">
          <svg class="filter-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
        </button>
        <button class="order-filter-btn" data-status="needs_action" data-type="purchased" title="Action requise">
          <svg class="filter-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
          </svg>
        </button>
        <button class="order-filter-btn" data-status="completed" data-type="purchased" title="Finalisées">
          <svg class="filter-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
          </svg>
        </button>
        <button class="order-filter-btn" data-status="failed" data-type="purchased" title="Annulées">
          <svg class="filter-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
          </svg>
        </button>
      </div>
      <div class="vinted-orders-category-label" id="vinted-orders-purchased-category">En attente</div>
      <div id="vinted-orders-purchased-list" class="vinted-orders-list">
        <p class="orders-loading">Chargement...</p>
      </div>
    </div>

    <!-- Section Ventes -->
    <div id="vinted-orders-sold-section" class="vinted-orders-section" style="display: none;">
      <div id="vinted-orders-sold-filters" class="vinted-orders-filters">
        <button class="order-filter-btn" data-status="all" data-type="sold" title="Toutes">
          <svg class="filter-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 10h16M4 14h16M4 18h16"></path>
          </svg>
        </button>
        <button class="order-filter-btn active" data-status="needs_action" data-type="sold" title="Action requise">
          <svg class="filter-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
          </svg>
        </button>
        <button class="order-filter-btn" data-status="completed" data-type="sold" title="Finalisées">
          <svg class="filter-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
          </svg>
        </button>
        <button class="order-filter-btn" data-status="failed" data-type="sold" title="Annulées">
          <svg class="filter-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
          </svg>
        </button>
      </div>
      <div class="vinted-orders-category-label" id="vinted-orders-sold-category">Action requise</div>
      <div id="vinted-orders-sold-list" class="vinted-orders-list">
      <p class="orders-loading">Chargement...</p>
      </div>
    </div>
  `;

  // Insérer dans le sticky container
  const sidebarStickyContainer = document.getElementById('sidebar-sticky-container');
  const messagesStickyContainer = document.getElementById('messages-sticky-container');
  
  if (sidebarStickyContainer) {
    if (messagesStickyContainer) {
      if (messagesStickyContainer.nextSibling) {
        sidebarStickyContainer.insertBefore(ordersManager, messagesStickyContainer.nextSibling);
      } else {
        sidebarStickyContainer.appendChild(ordersManager);
      }
    } else {
      const filterManager = document.getElementById('filter-manager');
      if (filterManager && filterManager.parentNode) {
        filterManager.parentNode.insertBefore(ordersManager, filterManager);
      } else {
        sidebarStickyContainer.appendChild(ordersManager);
      }
    }
  } else {
    sidebar.insertBefore(ordersManager, sidebar.firstChild);
  }

  // Gestion des onglets Achats/Ventes
  const purchasedTab = document.getElementById('orders-tab-purchased');
  const soldTab = document.getElementById('orders-tab-sold');
  
  if (purchasedTab) {
    purchasedTab.addEventListener('click', () => switchOrderType('purchased'));
  }
  if (soldTab) {
    soldTab.addEventListener('click', () => switchOrderType('sold'));
  }

  // Gestion des filtres pour les achats
  const purchasedFilters = ordersManager.querySelectorAll('#vinted-orders-purchased-filters .order-filter-btn');
  purchasedFilters.forEach(btn => {
    btn.addEventListener('click', () => {
      const status = btn.dataset.status;
      filterOrders('purchased', status);
    });
  });

  // Gestion des filtres pour les ventes
  const soldFilters = ordersManager.querySelectorAll('#vinted-orders-sold-filters .order-filter-btn');
  soldFilters.forEach(btn => {
    btn.addEventListener('click', () => {
      const status = btn.dataset.status;
      filterOrders('sold', status);
    });
  });

  // Charger les commandes initiales avec les filtres par défaut
  loadAllPurchasedOrders().then(() => {
    filterOrders('purchased', 'waiting'); // Par défaut "En attente" pour les achats
    updateOrdersCount();
  });
  
  loadAllSoldOrders().then(() => {
    filterOrders('sold', 'needs_action'); // Par défaut "Action requise" pour les ventes
    updateOrdersCount();
  });
  
  console.log("[Orders Manager] Interface créée avec succès");
  ordersManagerRetries = 0;
}

