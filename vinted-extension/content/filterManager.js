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
  
  // Mettre à jour le compteur
  updateFiltersCount();
  
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
    filterManager.style.display = 'none'; // Masqué par défaut
    filterManager.innerHTML = `
      <div class="filter-manager-header">
        <h3 class="filter-manager-title">Filtres Sauvegardés</h3>
        <button id="save-current-filter" class="btn-save-filter" title="Sauvegarder le filtre actuel">Sauvegarder</button>
      </div>
      <div id="filter-list" class="filter-list">
        <p class="filter-empty">Aucun filtre sauvegardé</p>
      </div>
    `;
    
    stickyContainer.appendChild(filterManager);
    sidebar.insertBefore(stickyContainer, sidebar.firstChild);
    document.getElementById('save-current-filter').addEventListener('click', saveCurrentFilter);
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