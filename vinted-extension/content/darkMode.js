// ==================== DARK MODE ====================
// Variable pour éviter les initialisations multiples
let darkModeInitialized = false;
let darkModeObserverStarted = false;

async function loadDarkMode() {
  // Éviter les initialisations multiples de l'observer
  if (darkModeObserverStarted) {
    return;
  }
  
  try {
    // Toujours charger depuis le storage pour avoir la valeur la plus récente
    // Même si l'IIFE a déjà fait le travail visuel, on veut s'assurer que state.darkMode est à jour
    const result = await chrome.storage.local.get(CONFIG.DARK_MODE_KEY);
    state.darkMode = result[CONFIG.DARK_MODE_KEY] || false;
    
    // Appliquer le mode nuit (au cas où l'IIFE ne l'aurait pas fait ou aurait échoué)
    applyDarkMode();
    ensureDarkModeApplied();
    
    // IMPORTANT: Toujours démarrer l'observer, même si darkModeInitialized est déjà true
    // L'IIFE ne démarre pas l'observer, donc on doit toujours le faire ici
    if (!darkModeObserverStarted) {
      startDarkModeObserver();
      darkModeObserverStarted = true;
    }
  } catch (error) {
    console.error("[Dark Mode] Erreur lors du chargement:", error);
    // Même en cas d'erreur, essayer de démarrer l'observer si le mode nuit était déjà activé
    if (!darkModeObserverStarted && state.darkMode) {
      startDarkModeObserver();
      darkModeObserverStarted = true;
    }
  }
}

async function toggleDarkMode() {
  state.darkMode = !state.darkMode;
  await chrome.storage.local.set({ [CONFIG.DARK_MODE_KEY]: state.darkMode });
  applyDarkMode();
  ensureDarkModeApplied();
  updateDarkModeButton();
}

function applyDarkMode() {
  if (state.darkMode) {
    document.documentElement.classList.add('vinted-dark-mode');
  } else {
    document.documentElement.classList.remove('vinted-dark-mode');
  }
}

// S'assurer que le mode nuit reste appliqué même après des changements DOM
function ensureDarkModeApplied() {
  if (state.darkMode) {
    // Forcer l'application immédiate
    if (!document.documentElement.classList.contains('vinted-dark-mode')) {
      document.documentElement.classList.add('vinted-dark-mode');
    }
  } else {
    document.documentElement.classList.remove('vinted-dark-mode');
  }
}

// Appliquer le mode nuit immédiatement au chargement (avant même que le DOM soit prêt)
// Cela garantit qu'il s'applique dès le début, même si le script se charge tard
// Note: Cette initialisation rapide applique seulement l'état visuel.
// L'initialisation complète avec l'observer est gérée par loadDarkMode()
// IMPORTANT: Cette IIFE ne doit PAS empêcher loadDarkMode() de démarrer l'observer
(async () => {
  // Utiliser un flag séparé pour éviter les conflits avec loadDarkMode()
  // darkModeInitialized indique seulement que l'état visuel initial a été appliqué
  if (darkModeInitialized) return;
  
  try {
    const result = await chrome.storage.local.get(CONFIG.DARK_MODE_KEY);
    const darkModeEnabled = result[CONFIG.DARK_MODE_KEY] || false;
    state.darkMode = darkModeEnabled;
    if (darkModeEnabled && document.documentElement) {
      document.documentElement.classList.add('vinted-dark-mode');
    }
    // Marquer seulement que l'état visuel initial a été appliqué
    // Cela n'empêche pas loadDarkMode() de démarrer l'observer
    darkModeInitialized = true;
    // Note: On ne démarre JAMAIS l'observer ici car loadDarkMode() doit toujours le faire
    // L'observer est critique pour maintenir le mode nuit, donc il doit être démarré par loadDarkMode()
  } catch (error) {
    console.error("[Dark Mode] Erreur lors du chargement initial:", error);
    // En cas d'erreur, ne pas définir darkModeInitialized pour que loadDarkMode() puisse réessayer
  }
})();

// Observer pour maintenir le mode nuit
let darkModeObserver = null;
let darkModeCheckInterval = null;

function startDarkModeObserver() {
  // Nettoyer l'interval existant s'il y en a un
  if (darkModeCheckInterval) {
    clearInterval(darkModeCheckInterval);
    darkModeCheckInterval = null;
  }
  
  if (darkModeObserver) return;
  
  // Observer les changements de classe sur documentElement
  darkModeObserver = new MutationObserver((mutations) => {
    // Si la classe vinted-dark-mode est retirée et que le mode nuit est activé, la remettre
    if (state.darkMode && !document.documentElement.classList.contains('vinted-dark-mode')) {
      document.documentElement.classList.add('vinted-dark-mode');
    }
  });
  
  darkModeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class']
  });
  
  // Vérification périodique pour s'assurer que le mode nuit reste appliqué
  // Utile si d'autres scripts modifient le DOM (vérification moins fréquente pour éviter le lag)
  darkModeCheckInterval = setInterval(() => {
    if (state.darkMode) {
      ensureDarkModeApplied();
    }
  }, 5000); // Vérifier toutes les 5 secondes (au lieu d'1 seconde)
}

function stopDarkModeObserver() {
  if (darkModeObserver) {
    darkModeObserver.disconnect();
    darkModeObserver = null;
  }
  if (darkModeCheckInterval) {
    clearInterval(darkModeCheckInterval);
    darkModeCheckInterval = null;
  }
}

function updateDarkModeButton() {
  const btn = document.getElementById('dark-mode-toggle');
  if (btn) {
    btn.textContent = state.darkMode ? '☀️' : '🌙';
    btn.title = state.darkMode ? 'Mode clair' : 'Mode sombre';
  }
}