// ==================== MONITOR ====================
function startMonitor() {
  if (state.isPolling) return;

  state.isPolling = true;
  const btn = document.getElementById("toggle-monitor");
  if (btn) {
    btn.textContent = "⏸";
    btn.style.background = "#dc2626";
  }

  pollItems();
  state.pollInterval = setInterval(pollItems, CONFIG.POLL_INTERVAL);
}

function stopMonitor() {
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

function toggleMonitor() {
  if (state.isPolling) {
    stopMonitor();
  } else {
    startMonitor();
  }
}

async function pollItems() {
  const isFirstFetch = state.items.length === 0;

  try {
    const incomingItems = await fetchNewItems();

    if (incomingItems && incomingItems.length > 0) {
      const newItems = registerItems(incomingItems);

      if (isFirstFetch) {
        renderItems();
        console.log(`[Vinted Monitor] ${state.items.length} articles chargés`);
      } else if (newItems.length > 0) {
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

let lastUrl = window.location.href;
function observeUrlChanges() {
  const observer = new MutationObserver(() => {
    if (lastUrl !== window.location.href) {
      console.log("[Vinted Monitor] URL changée, réinitialisation...");
      lastUrl = window.location.href;
      state.seenIds.clear();
      state.items = [];
      // Réappliquer le mode nuit après changement d'URL
      ensureDarkModeApplied();
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
  
  // Intercepter les navigations via pushState/replaceState
  const originalPushState = history.pushState;
  const originalReplaceState = history.replaceState;
  
  history.pushState = function(...args) {
    originalPushState.apply(history, args);
    setTimeout(() => ensureDarkModeApplied(), 100);
  };
  
  history.replaceState = function(...args) {
    originalReplaceState.apply(history, args);
    setTimeout(() => ensureDarkModeApplied(), 100);
  };
  
  // Intercepter les événements popstate (retour/avance dans l'historique)
  window.addEventListener('popstate', () => {
    setTimeout(() => ensureDarkModeApplied(), 100);
  });
}