// Gestion du monitoring
import { fetchNewItems } from './api.js';
import { CONFIG, state } from './config.js';
import { prependNewItems, registerItems, renderItems } from './itemManager.js';

// Démarrer le monitoring
export function startMonitor() {
  if (state.isPolling) return;

  state.isPolling = true;
  const btn = document.getElementById("toggle-monitor");
  if (btn) {
    btn.textContent = "⏸ Pause";
    btn.style.background = "#dc2626";
  }

  // Première requête immédiate
  pollItems();

  // Puis polling régulier
  state.pollInterval = setInterval(pollItems, CONFIG.POLL_INTERVAL);
}

// Arrêter le monitoring
export function stopMonitor() {
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

// Toggle du monitor
export function toggleMonitor() {
  if (state.isPolling) {
    stopMonitor();
  } else {
    startMonitor();
  }
}

// Fonction de polling des items
async function pollItems() {
  const isFirstFetch = state.items.length === 0;

  try {
    const incomingItems = await fetchNewItems();

    if (incomingItems && incomingItems.length > 0) {
      const newItems = registerItems(incomingItems);

      // Premier chargement : render complet
      if (isFirstFetch) {
        renderItems();
        console.log(`[Vinted Monitor] ${state.items.length} articles chargés`);
      }
      // Chargements suivants : ajouter seulement les nouveaux en haut
      else if (newItems.length > 0) {
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

// Observer les changements d'URL
let lastUrl = window.location.href;
export function observeUrlChanges() {
  const observer = new MutationObserver(() => {
    if (lastUrl !== window.location.href) {
      console.log("[Vinted Monitor] URL changée, réinitialisation...");
      lastUrl = window.location.href;
      
      // Réinitialiser les données
      state.seenIds.clear();
      state.items = [];
      
      // Relancer la recherche si le monitor est actif
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

