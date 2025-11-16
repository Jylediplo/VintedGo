// Point d'entrée principal de l'extension
import { createMonitorUI } from './js/ui.js';
import { observeUrlChanges } from './js/monitor.js';
import { startMessageNotifications } from './js/messagesNotifier.js';

// Vérifier si on est sur une page catalog
function isOnCatalogPage() {
  return window.location.pathname.startsWith('/catalog');
}

// Vérifier si l'extension est déjà initialisée
function isAlreadyInitialized() {
  return document.getElementById('vinted-monitor-container') !== null || 
         document.getElementById('toggle-monitor') !== null;
}

// Initialisation avec retry
function init() {
  console.log("[Vinted Monitor] Extension chargée");

  // Vérifier si on est sur une page catalog
  if (!isOnCatalogPage()) {
    console.log("[Vinted Monitor] Pas sur une page catalog, extension désactivée");
    return;
  }

  // Vérifier si déjà initialisé
  if (isAlreadyInitialized()) {
    console.log("[Vinted Monitor] Extension déjà initialisée");
    return;
  }

  // Fonction pour tenter de créer l'UI
  const tryCreateUI = () => {
    try {
      createMonitorUI();
      observeUrlChanges();
      console.log("[Vinted Monitor] UI créée avec succès");
    } catch (error) {
      console.error("[Vinted Monitor] Erreur lors de la création de l'UI:", error);
      // Réessayer après un délai
      setTimeout(tryCreateUI, 1000);
    }
  };

  // Attendre que la page soit complètement chargée
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", tryCreateUI);
  } else if (document.readyState === "interactive" || document.readyState === "complete") {
    // Si la page est déjà chargée, attendre un peu pour s'assurer que le DOM est stable
    setTimeout(tryCreateUI, 500);
  } else {
    tryCreateUI();
  }
}

// Démarrer l'extension
init();

// Démarrer le système de notifications de messages (toutes les 10 secondes)
// Fonctionne sur toutes les pages Vinted, pas seulement catalog
console.log("[Vinted Messages] Initialisation du système de notifications");
startMessageNotifications(10000);

