// ==================== WARDROBE ITEMS ====================
async function fetchWardrobeItems(userId, page = 1, perPage = 100, order = 'relevance') {
  try {
    const url = `https://www.vinted.fr/api/v2/wardrobe/${userId}/items?page=${page}&per_page=${perPage}&order=${order}`;
    const response = await fetch(url, {
      credentials: 'include',
      headers: {
        'accept': 'application/json, text/plain, */*',
        'accept-language': 'fr',
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("[Wardrobe] Erreur lors de la récupération des items:", error);
    return null;
  }
}

function renderWardrobeItemsList(items, statusFilter) {
  const itemsList = document.getElementById('vinted-wardrobe-items-list');
  if (!itemsList) return;

  if (!items || items.length === 0) {
    itemsList.innerHTML = '<p class="wardrobe-items-empty">Aucun article</p>';
    return;
  }

  itemsList.innerHTML = items.map(item => {
    const photoUrl = item.photos?.[0]?.url || item.photos?.[0]?.thumbnails?.[0]?.url || '';
    const price = formatPrice(item);
    const status = item.status || 'N/A';
    const size = item.size || 'N/A';
    const brand = item.brand || '';
    const viewCount = item.view_count || 0;
    const favouriteCount = item.favourite_count || 0;
    const isClosed = item.is_closed || false;
    const isReserved = item.is_reserved || false;
    const itemUrl = item.url || `https://www.vinted.fr${item.path || ''}`;

    let statusBadge = '';
    if (isClosed) {
      statusBadge = '<span class="wardrobe-item-status-badge closed">Vendu</span>';
    } else if (isReserved) {
      statusBadge = '<span class="wardrobe-item-status-badge reserved">Réservé</span>';
    } else {
      statusBadge = '<span class="wardrobe-item-status-badge active">Actif</span>';
    }

    return `
      <div class="wardrobe-item" data-item-id="${item.id}">
        ${photoUrl ? `<img src="${photoUrl}" alt="${escapeHtml(item.title)}" class="wardrobe-item-photo" loading="lazy">` : '<div class="wardrobe-item-photo-placeholder">Pas de photo</div>'}
        <div class="wardrobe-item-info">
          <div class="wardrobe-item-title">${escapeHtml(item.title)}</div>
          ${brand ? `<div class="wardrobe-item-brand">${escapeHtml(brand)}</div>` : ''}
          <div class="wardrobe-item-details">
            <span>${escapeHtml(size)}</span>
            <span>•</span>
            <span>${escapeHtml(status)}</span>
          </div>
          <div class="wardrobe-item-price">${price}</div>
          <div class="wardrobe-item-stats">
            <span>
              <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style="display: inline-block; vertical-align: middle; margin-right: 4px;">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>
              </svg>
              ${viewCount}
            </span>
            <span>
              <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style="display: inline-block; vertical-align: middle; margin-right: 4px;">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"></path>
              </svg>
              ${favouriteCount}
            </span>
          </div>
          ${statusBadge}
        </div>
        <a href="${itemUrl}" target="_blank" class="wardrobe-item-link" title="Voir l'article">
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

let currentWardrobeStatus = 'all';
let cachedWardrobeItems = null;
let isLoadingWardrobeItems = false;

async function loadAllWardrobeItems() {
  // Si déjà en cours de chargement ou déjà chargé, ne pas recharger
  if (isLoadingWardrobeItems || cachedWardrobeItems !== null) {
    return cachedWardrobeItems;
  }

  isLoadingWardrobeItems = true;
  const itemsContainer = document.getElementById('vinted-wardrobe-items-list');
  if (itemsContainer) {
    itemsContainer.innerHTML = '<p class="wardrobe-items-loading">Chargement...</p>';
  }

  const userId = await getUserId();
  if (!userId) {
    isLoadingWardrobeItems = false;
    if (itemsContainer) {
      itemsContainer.innerHTML = '<p class="wardrobe-items-empty">User ID non trouvé</p>';
    }
    return null;
  }

  // Charger toutes les pages pour avoir tous les items
  let allItems = [];
  let currentPage = 1;
  let hasMore = true;

  while (hasMore) {
    const data = await fetchWardrobeItems(userId, currentPage, 20, 'relevance');
    if (data && data.items) {
      allItems = [...allItems, ...data.items];
      hasMore = currentPage < (data.pagination?.total_pages || 1);
      currentPage++;
    } else {
      hasMore = false;
    }
  }

  cachedWardrobeItems = allItems;
  isLoadingWardrobeItems = false;

  // Mettre à jour le compteur dans l'onglet
  updateWardrobeCount(allItems.length);

  return allItems;
}

function filterWardrobeItems(status = 'all') {
  if (!cachedWardrobeItems || cachedWardrobeItems.length === 0) {
    const itemsContainer = document.getElementById('vinted-wardrobe-items-list');
    if (itemsContainer) {
      itemsContainer.innerHTML = '<p class="wardrobe-items-empty">Aucun article</p>';
    }
    return;
  }

  // Filtrer les items selon le statut (sans refaire de requête)
  let filteredItems = cachedWardrobeItems;
  if (status !== 'all') {
    filteredItems = cachedWardrobeItems.filter(item => {
      if (status === 'active') {
        return !item.is_closed && !item.is_reserved && !item.is_hidden;
      } else if (status === 'closed') {
        return item.is_closed;
      } else if (status === 'reserved') {
        return item.is_reserved;
      }
      return true;
    });
  }

  renderWardrobeItemsList(filteredItems, status);
  currentWardrobeStatus = status;

  // Mettre à jour les boutons de filtre avec les compteurs
  updateWardrobeFilterButtons(status, cachedWardrobeItems);
}

async function loadWardrobeItems(status = 'all') {
  // Charger toutes les données si pas encore chargées
  if (cachedWardrobeItems === null) {
    await loadAllWardrobeItems();
  }

  // Filtrer les données déjà chargées
  filterWardrobeItems(status);
}

function updateWardrobeFilterButtons(activeStatus, items = null) {
  const buttons = document.querySelectorAll('.wardrobe-filter-btn');
  
  // Calculer les compteurs si les items sont fournis
  let counts = { all: 0, active: 0, closed: 0, reserved: 0 };
  if (items) {
    counts.all = items.length;
    counts.active = items.filter(item => !item.is_closed && !item.is_reserved && !item.is_hidden).length;
    counts.closed = items.filter(item => item.is_closed).length;
    counts.reserved = items.filter(item => item.is_reserved).length;
  }
  
  // Mapping des textes de base
  const baseTexts = {
    'all': 'Tous',
    'active': 'Actifs',
    'closed': 'Vendus',
    'reserved': 'Réservés'
  };
  
  buttons.forEach(btn => {
    const status = btn.dataset.status;
    if (status === activeStatus) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
    
    // Mettre à jour le texte avec le compteur
    if (items) {
      const baseText = baseTexts[status] || status;
      btn.textContent = `${baseText} (${counts[status] || 0})`;
    }
  });
}

let wardrobeManagerRetries = 0;
const MAX_WARDROBE_RETRIES = 10;

function createWardrobeManager() {
  const sidebar = document.getElementById('sidebar');
  if (!sidebar) {
    wardrobeManagerRetries++;
    if (wardrobeManagerRetries < MAX_WARDROBE_RETRIES) {
      setTimeout(createWardrobeManager, 500);
    }
    return;
  }

  if (document.getElementById('vinted-wardrobe-manager')) {
    return; // Déjà créé
  }

  const wardrobeManager = document.createElement('div');
  wardrobeManager.id = 'vinted-wardrobe-manager';
  wardrobeManager.className = 'vinted-wardrobe-manager';
  wardrobeManager.style.display = 'none'; // Masqué par défaut
  wardrobeManager.innerHTML = `
    <div class="vinted-wardrobe-manager-header">
      <h3 class="vinted-wardrobe-manager-title">Mes Articles</h3>
    </div>
    <div class="vinted-wardrobe-filters">
      <button class="wardrobe-filter-btn active" data-status="all" title="Tous les articles">Tous</button>
      <button class="wardrobe-filter-btn" data-status="active" title="Articles actifs">Actifs</button>
      <button class="wardrobe-filter-btn" data-status="closed" title="Articles vendus">Vendus</button>
      <button class="wardrobe-filter-btn" data-status="reserved" title="Articles réservés">Réservés</button>
    </div>
    <div id="vinted-wardrobe-items-list" class="vinted-wardrobe-items-list">
      <p class="wardrobe-items-loading">Chargement...</p>
    </div>
  `;

  // Insérer dans le sticky container après le orders manager
  const sidebarStickyContainer = document.getElementById('sidebar-sticky-container');
  const ordersManager = document.getElementById('vinted-orders-manager');
  
  if (sidebarStickyContainer) {
    if (ordersManager) {
      // Insérer après le orders-manager
      if (ordersManager.nextSibling) {
        sidebarStickyContainer.insertBefore(wardrobeManager, ordersManager.nextSibling);
      } else {
        sidebarStickyContainer.appendChild(wardrobeManager);
      }
    } else {
      // Si pas de orders manager, insérer après messages ou avant filter-manager
      const messagesStickyContainer = document.getElementById('messages-sticky-container');
      if (messagesStickyContainer) {
        if (messagesStickyContainer.nextSibling) {
          sidebarStickyContainer.insertBefore(wardrobeManager, messagesStickyContainer.nextSibling);
        } else {
          sidebarStickyContainer.appendChild(wardrobeManager);
        }
      } else {
        const filterManager = document.getElementById('filter-manager');
        if (filterManager && filterManager.parentNode) {
          filterManager.parentNode.insertBefore(wardrobeManager, filterManager);
        } else {
          sidebarStickyContainer.appendChild(wardrobeManager);
        }
      }
    }
  } else {
    sidebar.insertBefore(wardrobeManager, sidebar.firstChild);
  }

  // Boutons de filtre
  const filterButtons = wardrobeManager.querySelectorAll('.wardrobe-filter-btn');
  filterButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const status = btn.dataset.status;
      // Filtrer uniquement côté front-end, sans refaire de requête
      filterWardrobeItems(status);
    });
  });

  // Charger les items initiaux (une seule fois)
  loadWardrobeItems('all');
  
  console.log("[Wardrobe Manager] Interface créée avec succès");
  wardrobeManagerRetries = 0;
}

function updateWardrobeCount(count) {
  const wardrobeCountEl = document.getElementById('wardrobe-count');
  if (wardrobeCountEl) {
    wardrobeCountEl.textContent = count > 0 ? count : '';
    wardrobeCountEl.style.display = count > 0 ? 'inline-block' : 'none';
  }
}

// Fonction pour mettre à jour le compteur depuis le cache
function refreshWardrobeCount() {
  if (cachedWardrobeItems !== null) {
    updateWardrobeCount(cachedWardrobeItems.length);
  } else {
    // Si pas encore chargé, charger en arrière-plan pour avoir le compteur
    loadAllWardrobeItems().catch(err => {
      console.error("[Wardrobe] Erreur lors du chargement pour le compteur:", err);
    });
  }
}