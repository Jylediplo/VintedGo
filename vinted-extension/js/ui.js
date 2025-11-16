// Gestion de l'interface utilisateur
import { state } from './config.js';
import { createFilterManager } from './filterManager.js';
import { startMonitor, toggleMonitor } from './monitor.js';

// Créer le bouton toggle à côté de l'élément langue avec retry amélioré
let toggleButtonRetries = 0;
const MAX_TOGGLE_RETRIES = 10;

export function createToggleButton() {
  // Vérifier si le bouton existe déjà
  if (document.getElementById('toggle-monitor')) {
    console.log("[Vinted Monitor] Bouton toggle déjà créé");
    return;
  }

  // Chercher le conteneur de la langue dans la navbar
  const navbarRight = document.querySelector('nav .u-position-relative') || 
                      document.querySelector('.u-position-relative');
  
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

  // Créer un wrapper pour le bouton
  const btnWrapper = document.createElement("div");
  btnWrapper.style.cssText = `
    display: inline-flex;
    align-items: center;
    margin-left: 12px;
  `;
  
  const toggleBtn = document.createElement("button");
  toggleBtn.id = "toggle-monitor";
  toggleBtn.className = "btn-monitor-toggle";
  toggleBtn.textContent = "▶";
  toggleBtn.style.cssText = `
    padding: 8px 16px;
    background: #3b82f6;
    color: white;
    border: none;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  `;
  
  btnWrapper.appendChild(toggleBtn);
  
  // Insérer à côté de l'élément langue
  navbarRight.parentNode.insertBefore(btnWrapper, navbarRight.nextSibling);
  
  console.log("[Vinted Monitor] Bouton toggle créé avec succès");
  toggleButtonRetries = 0; // Reset pour la prochaine fois
  
  // Event listener
  toggleBtn.addEventListener("click", toggleMonitor);
  
  // Hover effect
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

// Créer l'interface du monitor
export function createMonitorUI() {
  // Créer le container principal pour les articles
  const container = document.createElement("div");
  container.id = "vinted-monitor-container";
  container.innerHTML = `
    <div id="items-container" class="items-grid"></div>
  `;

  // Trouver la balise de navigation et insérer juste après
  const navCategories = document.querySelector('ul.nav.nav-detailed.nav-page-categories[data-testid="sub-catalog-navigation-links"]');
  
  if (navCategories && navCategories.parentNode) {
    // Insérer après la balise de navigation
    navCategories.parentNode.insertBefore(container, navCategories.nextSibling);
  } else {
    // Fallback : insérer en haut de la page si la navigation n'est pas trouvée
    const body = document.body;
    if (body.firstChild) {
      body.insertBefore(container, body.firstChild);
    } else {
      body.appendChild(container);
    }
  }

  // Créer et insérer le bouton toggle à côté de l'élément langue
  createToggleButton();

  // Créer l'interface de gestion des filtres dans la sidebar
  createFilterManager();

  // Démarrer automatiquement
  setTimeout(() => startMonitor(), 500);
}

