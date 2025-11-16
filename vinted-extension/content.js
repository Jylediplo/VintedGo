// Point d'entrée principal de l'extension
import { observeUrlChanges } from './js/monitor.js';
import { createMonitorUI } from './js/ui.js';

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
    document.addEventListener("DOMContentLoaded", () => {
      // Attendre 1 seconde après DOMContentLoaded pour que la sidebar soit chargée
      setTimeout(tryCreateUI, 1000);
    });
  } else if (document.readyState === "interactive") {
    // Si la page est en cours de chargement, attendre plus longtemps
    setTimeout(tryCreateUI, 1500);
  } else if (document.readyState === "complete") {
    // Si la page est complètement chargée, attendre un peu pour la stabilité
    setTimeout(tryCreateUI, 1000);
  } else {
    // Fallback
    setTimeout(tryCreateUI, 1000);
  }
}

// Démarrer l'extension
init();

