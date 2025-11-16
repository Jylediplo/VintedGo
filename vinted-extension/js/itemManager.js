// Gestion des items (articles)
import { state, CONFIG } from './config.js';
import { escapeHtml, formatPrice, extractSize, extractCondition } from './utils.js';

// Enregistrer les nouveaux items
export function registerItems(incomingItems) {
  const newItems = incomingItems.filter((item) => !state.seenIds.has(item.id));

  if (newItems.length === 0) {
    return newItems; // Aucun nouveau
  }

  // Ajouter les nouveaux en haut
  state.items = [...newItems, ...state.items].slice(0, CONFIG.MAX_ITEMS);

  // Marquer comme vus
  newItems.forEach((item) => state.seenIds.add(item.id));

  return newItems;
}

// Créer une card pour un item
export function createItemCard(item) {
  const photo = item.photos?.[0]?.url || item.photo?.url || "";
  const price = formatPrice(item);
  const size = extractSize(item);
  const condition = extractCondition(item);
  const permalink = item.url?.startsWith("http")
    ? item.url
    : `https://www.vinted.fr${item.url}`;

  return `
    <div class="item-card">
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
    </div>
  `;
}

// Afficher les items (render complet - utilisé au démarrage)
export function renderItems() {
  const container = document.getElementById("items-container");
  if (!container) return;

  container.innerHTML = state.items.map((item) => createItemCard(item)).join("");
}

// Ajouter uniquement les nouveaux items en haut (optimisé)
export function prependNewItems(newItems) {
  const container = document.getElementById("items-container");
  if (!container || newItems.length === 0) return;

  // Retirer la classe "new-item" de tous les anciens éléments
  const oldNewItems = container.querySelectorAll(".new-item");
  oldNewItems.forEach((el) => el.classList.remove("new-item"));

  // Créer un fragment pour insérer tous les nouveaux en une seule fois
  const fragment = document.createDocumentFragment();
  const tempDiv = document.createElement("div");

  newItems.forEach((item) => {
    tempDiv.innerHTML = createItemCard(item);
    const cardElement = tempDiv.firstElementChild;
    if (cardElement) {
      // Ajouter la classe "new-item" pour l'animation highlight
      cardElement.classList.add("new-item");
      fragment.appendChild(cardElement);
    }
  });

  // Insérer en haut
  if (container.firstChild) {
    container.insertBefore(fragment, container.firstChild);
  } else {
    container.appendChild(fragment);
  }

  // Limiter le nombre total d'éléments affichés
  while (container.children.length > CONFIG.MAX_ITEMS) {
    container.removeChild(container.lastChild);
  }
}

