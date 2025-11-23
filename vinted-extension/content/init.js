// ==================== INIT ====================
function isOnCatalogPage() {
  return window.location.pathname.startsWith('/catalog');
}

function isAlreadyInitialized() {
  return document.getElementById('vinted-monitor-container') !== null || 
         document.getElementById('toggle-monitor') !== null;
}

function init() {
  console.log("[Vinted Monitor] Extension chargée");

  // Charger le dark mode et l'état du bouton buy en premier
  // Note: loadDarkMode() gère déjà l'initialisation, pas besoin de dupliquer
  loadDarkMode();
  loadBuyButtonState();
  loadAlertFilterState();

  if (!isOnCatalogPage()) {
    console.log("[Vinted Monitor] Pas sur une page catalog, extension désactivée");
    return;
  }

  if (isAlreadyInitialized()) {
    console.log("[Vinted Monitor] Extension déjà initialisée");
    return;
  }

  const tryCreateUI = () => {
    try {
      createMonitorUI();
      observeUrlChanges();
      console.log("[Vinted Monitor] UI créée avec succès");
    } catch (error) {
      console.error("[Vinted Monitor] Erreur lors de la création de l'UI:", error);
      setTimeout(tryCreateUI, 1000);
    }
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      setTimeout(tryCreateUI, 1000);
    });
  } else if (document.readyState === "interactive") {
    setTimeout(tryCreateUI, 1500);
  } else if (document.readyState === "complete") {
    setTimeout(tryCreateUI, 1000);
  } else {
    setTimeout(tryCreateUI, 1000);
  }
}

init();