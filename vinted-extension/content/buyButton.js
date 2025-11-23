// ==================== BUY BUTTON TOGGLE ====================
async function loadBuyButtonState() {
  try {
    const result = await chrome.storage.local.get(CONFIG.BUY_BUTTON_KEY);
    state.buyButtonEnabled = result[CONFIG.BUY_BUTTON_KEY] !== false;
    applyBuyButtonState();
  } catch (error) {
    console.error("[Buy Button] Erreur lors du chargement:", error);
  }
}

async function toggleBuyButton() {
  state.buyButtonEnabled = !state.buyButtonEnabled;
  await chrome.storage.local.set({ [CONFIG.BUY_BUTTON_KEY]: state.buyButtonEnabled });
  applyBuyButtonState();
  updateBuyButtonToggle();
}

function applyBuyButtonState() {
  if (state.buyButtonEnabled) {
    document.documentElement.classList.remove('vinted-buy-button-disabled');
  } else {
    document.documentElement.classList.add('vinted-buy-button-disabled');
  }
}

function updateBuyButtonToggle() {
  const btn = document.getElementById('buy-button-toggle');
  if (btn) {
    btn.innerHTML = state.buyButtonEnabled 
      ? '<svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>'
      : '<svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>';
    btn.title = state.buyButtonEnabled ? 'Désactiver le bouton Buy' : 'Activer le bouton Buy';
  }
}