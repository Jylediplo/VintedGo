// ==================== UI ====================
let toggleButtonRetries = 0;
const MAX_TOGGLE_RETRIES = 10;

function createToggleButton() {
  if (document.getElementById('toggle-monitor')) {
    console.log("[Vinted Monitor] Bouton toggle déjà créé");
    return;
  }

  const navbarRight = document.querySelector('nav .u-position-relative') || document.querySelector('.u-position-relative');
  
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

  const btnWrapper = document.createElement("div");
  btnWrapper.style.cssText = `display: inline-flex; align-items: center; gap: 8px; margin-left: auto; flex-wrap: nowrap;`;
  
  // Affichage du solde du portefeuille
  const walletDisplay = document.createElement("div");
  walletDisplay.id = "vinted-wallet-balance";
  walletDisplay.className = "vinted-wallet-balance";
  walletDisplay.textContent = "Chargement...";
  walletDisplay.title = "Solde du portefeuille Vinted";
  // Les styles sont maintenant dans styles.css
  
  // Bouton Buy Toggle
  const buyButtonToggle = document.createElement("button");
  buyButtonToggle.id = "buy-button-toggle";
  buyButtonToggle.className = "btn-buy-toggle";
  buyButtonToggle.innerHTML = state.buyButtonEnabled 
    ? '<svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>'
    : '<svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>';
  buyButtonToggle.title = state.buyButtonEnabled ? "Désactiver le bouton Buy" : "Activer le bouton Buy";
  buyButtonToggle.style.cssText = `padding: 8px 12px; background: #6b7280; color: white; border: none; border-radius: 8px; font-size: 16px; cursor: pointer; transition: all 0.2s ease; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);`;
  buyButtonToggle.addEventListener("click", toggleBuyButton);
  buyButtonToggle.addEventListener("mouseenter", () => {
    buyButtonToggle.style.background = "#4b5563";
    buyButtonToggle.style.transform = "translateY(-1px)";
    buyButtonToggle.style.boxShadow = "0 4px 8px rgba(0, 0, 0, 0.15)";
  });
  buyButtonToggle.addEventListener("mouseleave", () => {
    buyButtonToggle.style.background = "#6b7280";
    buyButtonToggle.style.transform = "translateY(0)";
    buyButtonToggle.style.boxShadow = "0 2px 4px rgba(0, 0, 0, 0.1)";
  });
  
  // Bouton Dark Mode
  const darkModeBtn = document.createElement("button");
  darkModeBtn.id = "dark-mode-toggle";
  darkModeBtn.className = "btn-dark-mode";
  darkModeBtn.textContent = state.darkMode ? "☀️" : "🌙";
  darkModeBtn.title = state.darkMode ? "Mode clair" : "Mode sombre";
  darkModeBtn.style.cssText = `padding: 8px 12px; background: #6b7280; color: white; border: none; border-radius: 8px; font-size: 16px; cursor: pointer; transition: all 0.2s ease; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);`;
  darkModeBtn.addEventListener("click", toggleDarkMode);
  darkModeBtn.addEventListener("mouseenter", () => {
    darkModeBtn.style.background = "#4b5563";
    darkModeBtn.style.transform = "translateY(-1px)";
    darkModeBtn.style.boxShadow = "0 4px 8px rgba(0, 0, 0, 0.15)";
  });
  darkModeBtn.addEventListener("mouseleave", () => {
    darkModeBtn.style.background = "#6b7280";
    darkModeBtn.style.transform = "translateY(0)";
    darkModeBtn.style.boxShadow = "0 2px 4px rgba(0, 0, 0, 0.1)";
  });
  
  // Bouton Monitor
  const toggleBtn = document.createElement("button");
  toggleBtn.id = "toggle-monitor";
  toggleBtn.className = "btn-monitor-toggle";
  toggleBtn.textContent = "▶";
  toggleBtn.style.cssText = `padding: 8px 16px; background: #3b82f6; color: white; border: none; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; transition: all 0.2s ease; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);`;
  
  btnWrapper.appendChild(walletDisplay);
  btnWrapper.appendChild(buyButtonToggle);
  btnWrapper.appendChild(darkModeBtn);
  btnWrapper.appendChild(toggleBtn);
  
  // Insérer le btnWrapper à droite de la navbar (dans navbarRight ou après)
  if (navbarRight) {
    // Essayer d'insérer dans navbarRight s'il a un conteneur flex
    const navbarParent = navbarRight.parentElement;
    if (navbarParent && (navbarParent.classList.contains('u-flexbox') || getComputedStyle(navbarParent).display === 'flex')) {
      navbarParent.appendChild(btnWrapper);
    } else {
      // Sinon insérer après navbarRight
      navbarRight.parentNode.insertBefore(btnWrapper, navbarRight.nextSibling);
    }
  }
  
  // Charger le solde du portefeuille
  loadWalletBalance();
  
  // Initialiser l'affichage du nombre d'offres restantes immédiatement
  if (typeof initOfferCount === 'function') {
    initOfferCount();
  }
  
  // Créer le widget de notifications à côté du wallet
  setTimeout(() => {
    createNotificationsWidget();
  }, 1500);
  
  console.log("[Vinted Monitor] Bouton toggle créé avec succès");
  toggleButtonRetries = 0;
  
  toggleBtn.addEventListener("click", toggleMonitor);
  
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

function createMonitorUI() {
  const container = document.createElement("div");
  container.id = "vinted-monitor-container";
  container.innerHTML = `<div id="items-container" class="items-grid"></div>`;

  const navCategories = document.querySelector('ul.nav.nav-detailed.nav-page-categories[data-testid="sub-catalog-navigation-links"]');
  
  if (navCategories && navCategories.parentNode) {
    navCategories.parentNode.insertBefore(container, navCategories.nextSibling);
  } else {
    const body = document.body;
    if (body.firstChild) {
      body.insertBefore(container, body.firstChild);
    } else {
      body.appendChild(container);
    }
  }

  createToggleButton();
  createFilterManager();
  createAlertSystem();
  createPickupPointsSystem();
  // Créer le manager de commandes et de messages après un délai pour s'assurer que le manager de messages est créé
  setTimeout(() => {
    createOrdersManager();
    createWardrobeManager();
    createMessagesListManager();
    // Créer les tabs après que tous les managers soient créés
    setTimeout(() => {
      createSidebarTabs();
      // Charger les compteurs même si on n'est pas sur les onglets
      setTimeout(() => {
        updateMessagesCountInTab();
        updateOrdersCount();
        refreshWardrobeCount(); // Mettre à jour le compteur du wardrobe
      }, 1000);
    }, 500);
  }, 1500);
  // Démarrer le monitor immédiatement pour charger les articles dès le lancement
  setTimeout(() => startMonitor(), 100);
  
  // Arrêter le rafraîchissement automatique des messages quand on quitte la page
  window.addEventListener('beforeunload', () => {
    stopMessagesAutoRefresh();
  });
}