// Gestion des filtres sauvegardés
import { state, CONFIG } from './config.js';
import { escapeHtml } from './utils.js';

// Charger les filtres sauvegardés depuis le storage
export async function loadSavedFilters() {
  try {
    const result = await chrome.storage.local.get(CONFIG.STORAGE_KEY);
    state.savedFilters = result[CONFIG.STORAGE_KEY] || [];
    console.log("[Filter Manager] Filtres chargés:", state.savedFilters);
  } catch (error) {
    console.error("[Filter Manager] Erreur lors du chargement:", error);
    state.savedFilters = [];
  }
}

// Sauvegarder les filtres dans le storage
export async function saveFiltersToStorage() {
  try {
    await chrome.storage.local.set({ [CONFIG.STORAGE_KEY]: state.savedFilters });
    console.log("[Filter Manager] Filtres sauvegardés:", state.savedFilters);
  } catch (error) {
    console.error("[Filter Manager] Erreur lors de la sauvegarde:", error);
  }
}

// Obtenir les filtres actuels de l'URL
export function getCurrentFilters() {
  const url = new URL(window.location.href);
  const filters = {};
  
  for (const [key, value] of url.searchParams.entries()) {
    if (key.endsWith('[]')) {
      if (!filters[key]) {
        filters[key] = [];
      }
      filters[key].push(value);
    } else if (['price_from', 'price_to', 'order'].includes(key)) {
      filters[key] = value;
    }
  }
  
  return filters;
}

// Appliquer un filtre (changer l'URL)
export function applyFilter(filter) {
  const url = new URL(window.location.href);
  
  // Nettoyer les paramètres existants (sauf catalog path)
  const catalogPath = url.pathname;
  url.search = '';
  url.pathname = catalogPath;
  
  // Ajouter les nouveaux filtres
  for (const [key, value] of Object.entries(filter.params)) {
    if (Array.isArray(value)) {
      value.forEach(v => url.searchParams.append(key, v));
    } else {
      url.searchParams.set(key, value);
    }
  }
  
  // Ajouter l'ordre par défaut
  if (!url.searchParams.has('order')) {
    url.searchParams.set('order', 'newest_first');
  }
  
  // Rediriger vers la nouvelle URL
  window.location.href = url.toString();
}

// Sauvegarder le filtre actuel
export async function saveCurrentFilter() {
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

// Supprimer un filtre
export async function deleteFilter(filterId) {
  if (!confirm("Supprimer ce filtre ?")) return;
  
  state.savedFilters = state.savedFilters.filter(f => f.id !== filterId);
  await saveFiltersToStorage();
  renderFilterList();
}

// Afficher la liste des filtres
export function renderFilterList() {
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
    
    return `
      <div class="filter-item" data-filter-id="${filter.id}">
        <div class="filter-item-info">
          <span class="filter-item-name">${escapeHtml(filter.name)}</span>
          <span class="filter-item-count">${paramCount} filtre${paramCount > 1 ? 's' : ''}</span>
        </div>
        <div class="filter-item-actions">
          <button class="btn-apply-filter" data-filter-id="${filter.id}" title="Appliquer ce filtre">
            ✓
          </button>
          <button class="btn-delete-filter" data-filter-id="${filter.id}" title="Supprimer ce filtre">
            ✕
          </button>
        </div>
      </div>
    `;
  }).join('');
  
  // Event listeners pour les boutons
  filterList.querySelectorAll('.btn-apply-filter').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const filterId = e.target.dataset.filterId;
      const filter = state.savedFilters.find(f => f.id === filterId);
      if (filter) applyFilter(filter);
    });
  });
  
  filterList.querySelectorAll('.btn-delete-filter').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const filterId = e.target.dataset.filterId;
      deleteFilter(filterId);
    });
  });
}

// Créer l'interface de gestion des filtres avec retry amélioré
let filterManagerRetries = 0;
const MAX_FILTER_RETRIES = 10;

export function createFilterManager() {
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
  
  // Vérifier si déjà créé
  if (document.getElementById('filter-manager')) {
    console.log("[Filter Manager] Interface déjà créée");
    return;
  }
  
  try {
    const filterManager = document.createElement('div');
    filterManager.id = 'filter-manager';
    filterManager.className = 'filter-manager';
    filterManager.innerHTML = `
      <div class="filter-manager-header">
        <h3 class="filter-manager-title">💾 Filtres Sauvegardés</h3>
        <button id="save-current-filter" class="btn-save-filter" title="Sauvegarder le filtre actuel">
          ➕ Sauvegarder
        </button>
      </div>
      <div id="filter-list" class="filter-list">
        <p class="filter-empty">Aucun filtre sauvegardé</p>
      </div>
    `;
    
    // Insérer en haut de la sidebar
    sidebar.insertBefore(filterManager, sidebar.firstChild);
    
    // Event listeners
    document.getElementById('save-current-filter').addEventListener('click', saveCurrentFilter);
    
    // Charger et afficher les filtres
    loadSavedFilters().then(() => renderFilterList());
    
    console.log("[Filter Manager] Interface créée avec succès");
    filterManagerRetries = 0; // Reset pour la prochaine fois
  } catch (error) {
    console.error("[Filter Manager] Erreur lors de la création:", error);
    filterManagerRetries++;
    if (filterManagerRetries < MAX_FILTER_RETRIES) {
      setTimeout(createFilterManager, 500);
    }
  }
}

