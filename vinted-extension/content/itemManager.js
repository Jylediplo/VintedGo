// ==================== ITEM MANAGER ====================
/**
 * Met à jour l'icône SVG de favori (rempli ou vide)
 */
function updateFavoriteIcon(iconElement, isFavorited) {
  if (!iconElement) return;
  
  const heartFilled = `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"></path>`;
  const heartOutline = `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" fill="none"></path>`;
  
  if (isFavorited) {
    iconElement.innerHTML = heartFilled;
    iconElement.style.fill = 'currentColor';
  } else {
    iconElement.innerHTML = heartOutline;
    iconElement.style.fill = 'none';
  }
}

/**
 * Crée une icône SVG de chargement
 */
function createLoadingIcon() {
  return `<svg class="favorite-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
  </svg>`;
}

function registerItems(incomingItems) {
  const newItems = incomingItems.filter((item) => !state.seenIds.has(item.id));
  if (newItems.length === 0) return newItems;
  
  state.items = [...newItems, ...state.items].slice(0, CONFIG.MAX_ITEMS);
  newItems.forEach((item) => state.seenIds.add(item.id));
  
  // Limiter la taille de seenIds pour éviter les fuites mémoire
  // Garder seulement les IDs des items actuellement dans state.items
  if (state.seenIds.size > CONFIG.MAX_ITEMS * 2) {
    const currentIds = new Set(state.items.map(item => item.id));
    state.seenIds = new Set([...currentIds, ...Array.from(state.seenIds).slice(0, CONFIG.MAX_ITEMS)]);
  }
  
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
      <a href="${permalink}" class="item-link" data-item-id="${item.id}">
        ${photo ? `<img src="${photo}" alt="${item.title}" class="item-image" />` : '<div class="item-no-image">Pas d\'image</div>'}
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
      <button class="btn-favorite-item" data-item-id="${item.id}" data-item-url="${permalink}" title="Ajouter aux favoris">
        <svg class="favorite-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"></path>
        </svg>
      </button>
      <button class="btn-buy-item" data-item-url="${permalink}" title="Acheter rapidement">
        <svg class="buy-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"></path>
        </svg>
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
  
  // Attacher les event listeners aux boutons Favoris
  attachFavoriteButtonListeners();
  
  // Attacher les event listeners aux liens des articles pour ouvrir la modal
  attachItemLinkListeners();
  
  // Réappliquer le filtre par alertes si actif
  if (isAlertFilterActive) {
    applyAlertFilter();
  }
}

/**
 * Extrait l'ID et le slug d'un item depuis son URL
 * @param {string} url - URL de l'item
 * @returns {Object|null} - {id, slug} ou null
 */
function extractItemInfoFromUrl(url) {
  if (!url) return null;
  
  // Pattern: /items/123456-slug-ou-nom
  const match = url.match(/\/items\/(\d+)(?:-([^/?]+))?/);
  if (match) {
    return {
      id: match[1],
      slug: match[2] || ''
    };
  }
  
  return null;
}

/**
 * Attache les event listeners aux liens des articles pour ouvrir la modal au lieu de rediriger
 */
function attachItemLinkListeners() {
  const itemLinks = document.querySelectorAll('.item-link');
  itemLinks.forEach(link => {
    // Retirer les anciens listeners pour éviter les duplications
    const newLink = link.cloneNode(true);
    link.parentNode.replaceChild(newLink, link);
    
    newLink.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      const url = newLink.href || newLink.getAttribute('href');
      if (!url) return;
      
      const itemInfo = extractItemInfoFromUrl(url);
      if (!itemInfo || !itemInfo.id) {
        // Si on ne peut pas extraire l'info, ouvrir le lien normalement
        window.open(url, '_blank');
        return;
      }
      
      console.log('[Vinted Item Details] 🖱️ Clic sur article depuis la sidebar:', itemInfo);
      
      // Vérifier si showItemDetails est disponible (depuis messages-notifier-bundled.js)
      if (typeof showItemDetails === 'function') {
        await showItemDetails(itemInfo.id, itemInfo.slug);
      } else {
        // Fallback: ouvrir le lien si la fonction n'est pas disponible
        console.warn('[Vinted Item Details] showItemDetails non disponible, ouverture du lien');
        window.open(url, '_blank');
      }
    });
  });
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

async function attachFavoriteButtonListeners() {
  const favoriteButtons = document.querySelectorAll('.btn-favorite-item');
  favoriteButtons.forEach(btn => {
    // Retirer les anciens listeners pour éviter les duplications
    const newBtn = btn.cloneNode(true);
    btn.parentNode.replaceChild(newBtn, btn);
    
    // Vérifier l'état initial (est-ce que l'item est déjà en favoris)
    const itemId = newBtn.dataset.itemId;
    if (itemId && typeof window.isItemPinned === 'function') {
      window.isItemPinned(itemId).then(isPinned => {
        if (isPinned) {
          newBtn.classList.add('favorited');
          newBtn.title = 'Retirer des favoris';
        }
      });
    }
    
    newBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      const itemId = newBtn.dataset.itemId;
      const itemUrl = newBtn.dataset.itemUrl;
      
      if (!itemId || !itemUrl) return;
      
      // Extraire le path depuis l'URL
      let itemPath = '';
      try {
        const url = new URL(itemUrl);
        itemPath = url.pathname;
      } catch (e) {
        // Si l'URL est invalide, utiliser le format par défaut
      }
      
      // Afficher le chargement
      const favoriteIcon = newBtn.querySelector('.favorite-icon');
      const originalIconHTML = favoriteIcon ? favoriteIcon.outerHTML : '';
      if (favoriteIcon) {
        favoriteIcon.outerHTML = createLoadingIcon();
      }
      newBtn.disabled = true;
      newBtn.style.opacity = '0.7';
      
      try {
        // Vérifier l'état actuel avant l'action
        const wasPinned = newBtn.classList.contains('favorited');
        
        // Utiliser la fonction addToFavourites depuis itemDetails.js si disponible
        if (typeof window.addToFavourites === 'function') {
          await window.addToFavourites(itemId, itemPath);
        } else if (typeof window.togglePinItem === 'function') {
          // Fallback: utiliser togglePinItem si disponible
          const itemInfo = extractItemInfoFromUrl(itemUrl);
          if (itemInfo) {
            await window.togglePinItem({ id: itemId, url: itemUrl });
          }
        } else {
          console.warn('[Vinted Favourites] Fonction addToFavourites non disponible');
        }
        
        // Mettre à jour immédiatement l'état visuel (toggle)
        const isNowPinned = !wasPinned;
        const newBtnIcon = newBtn.querySelector('.favorite-icon');
        if (isNowPinned) {
          newBtn.classList.add('favorited');
          newBtn.title = 'Retirer des favoris';
          updateFavoriteIcon(newBtnIcon, true);
        } else {
          newBtn.classList.remove('favorited');
          newBtn.title = 'Ajouter aux favoris';
          updateFavoriteIcon(newBtnIcon, false);
        }
        
        // Mettre à jour tous les autres boutons favoris pour le même item sur la page
        const allFavoriteButtons = document.querySelectorAll(`.btn-favorite-item[data-item-id="${itemId}"]`);
        allFavoriteButtons.forEach(btn => {
          if (btn !== newBtn) {
            const icon = btn.querySelector('.favorite-icon');
            if (isNowPinned) {
              btn.classList.add('favorited');
              btn.title = 'Retirer des favoris';
              updateFavoriteIcon(icon, true);
            } else {
              btn.classList.remove('favorited');
              btn.title = 'Ajouter aux favoris';
              updateFavoriteIcon(icon, false);
            }
          }
        });
        
        // Attendre un peu pour que l'API se synchronise, puis vérifier l'état réel
        await new Promise(resolve => setTimeout(resolve, 300));
        
        // Utiliser la fonction globale pour mettre à jour tous les boutons
        if (typeof window.updateFavoriteButtonsOnPage === 'function') {
          await window.updateFavoriteButtonsOnPage(itemId);
        } else if (typeof window.isItemPinned === 'function') {
          // Fallback: vérifier manuellement
          const actualIsPinned = await window.isItemPinned(itemId);
          allFavoriteButtons.forEach(btn => {
            const icon = btn.querySelector('.favorite-icon');
            if (actualIsPinned) {
              btn.classList.add('favorited');
              btn.title = 'Retirer des favoris';
              updateFavoriteIcon(icon, true);
            } else {
              btn.classList.remove('favorited');
              btn.title = 'Ajouter aux favoris';
              updateFavoriteIcon(icon, false);
            }
          });
        }
      } catch (error) {
        console.error('[Vinted Favourites] Erreur lors de l\'ajout aux favoris:', error);
        const favoriteIcon = newBtn.querySelector('.favorite-icon');
        if (favoriteIcon && originalIconHTML) {
          favoriteIcon.outerHTML = originalIconHTML;
        }
      } finally {
        newBtn.disabled = false;
        newBtn.style.opacity = '1';
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
  
  // Attacher les event listeners aux nouveaux liens d'articles
  setTimeout(() => {
    attachItemLinkListeners();
  }, 100);

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
  attachFavoriteButtonListeners();
  
  // Réappliquer le filtre par alertes si actif
  if (isAlertFilterActive) {
    applyAlertFilter();
  }
}