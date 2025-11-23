// ==================== SETTINGS MANAGER ====================
const SETTINGS_STORAGE_KEY = "vinted_refresh_intervals";

// Valeurs par défaut
const DEFAULT_INTERVALS = {
  messages: 10000,      // 10 secondes
  notifications: 10000,  // 10 secondes
  items: 3000           // 3 secondes
};

// Charger les intervalles depuis le storage
async function loadIntervals() {
  return new Promise((resolve) => {
    chrome.storage.local.get([SETTINGS_STORAGE_KEY], (result) => {
      const saved = result[SETTINGS_STORAGE_KEY];
      resolve(saved || DEFAULT_INTERVALS);
    });
  });
}

// Sauvegarder les intervalles
async function saveIntervals(intervals) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [SETTINGS_STORAGE_KEY]: intervals }, () => {
      resolve();
    });
  });
}

// Obtenir l'intervalle actuel pour un type
async function getInterval(type) {
  const intervals = await loadIntervals();
  return intervals[type] || DEFAULT_INTERVALS[type];
}

// Créer le bouton de paramètres
function createSettingsButton() {
  const walletDisplay = document.getElementById('vinted-wallet-balance');
  if (!walletDisplay) {
    setTimeout(createSettingsButton, 500);
    return;
  }

  // Vérifier si le bouton existe déjà
  if (document.getElementById('vinted-settings-button')) {
    return;
  }

  const settingsButton = document.createElement('button');
  settingsButton.id = 'vinted-settings-button';
  settingsButton.className = 'vinted-settings-button';
  settingsButton.innerHTML = `
    <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path>
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
    </svg>
  `;
  settingsButton.title = 'Paramètres de rafraîchissement';
  settingsButton.addEventListener('click', () => {
    openSettingsModal();
  });

  // Insérer après le wallet
  const walletParent = walletDisplay.parentElement;
  if (walletParent) {
    walletParent.insertBefore(settingsButton, walletDisplay.nextSibling);
  }
}

// Ouvrir la modal de paramètres
async function openSettingsModal() {
  // Vérifier si la modal existe déjà
  const existingModal = document.getElementById('vinted-settings-modal');
  if (existingModal) {
    existingModal.style.display = 'flex';
    return;
  }

  const intervals = await loadIntervals();

  const modal = document.createElement('div');
  modal.id = 'vinted-settings-modal';
  modal.className = 'vinted-settings-modal';
  modal.innerHTML = `
    <div class="vinted-settings-container">
      <div class="vinted-settings-header">
        <h2>Paramètres de rafraîchissement</h2>
        <button class="vinted-settings-close" aria-label="Fermer">×</button>
      </div>
      <div class="vinted-settings-content">
        <div class="vinted-settings-section">
          <label for="messages-interval">
            <span class="settings-label">Messages</span>
            <span class="settings-description">Intervalle de rafraîchissement des messages</span>
          </label>
          <div class="settings-input-group">
            <input type="number" 
                   id="messages-interval" 
                   class="settings-interval-input" 
                   min="1000" 
                   step="1000" 
                   value="${intervals.messages}">
            <span class="settings-unit">ms</span>
            <span class="settings-display">(${intervals.messages / 1000}s)</span>
          </div>
        </div>

        <div class="vinted-settings-section">
          <label for="notifications-interval">
            <span class="settings-label">Notifications</span>
            <span class="settings-description">Intervalle de rafraîchissement des notifications</span>
          </label>
          <div class="settings-input-group">
            <input type="number" 
                   id="notifications-interval" 
                   class="settings-interval-input" 
                   min="1000" 
                   step="1000" 
                   value="${intervals.notifications}">
            <span class="settings-unit">ms</span>
            <span class="settings-display">(${intervals.notifications / 1000}s)</span>
          </div>
        </div>

        <div class="vinted-settings-section">
          <label for="items-interval">
            <span class="settings-label">Articles</span>
            <span class="settings-description">Intervalle de rafraîchissement des articles</span>
          </label>
          <div class="settings-input-group">
            <input type="number" 
                   id="items-interval" 
                   class="settings-interval-input" 
                   min="1000" 
                   step="1000" 
                   value="${intervals.items}">
            <span class="settings-unit">ms</span>
            <span class="settings-display">(${intervals.items / 1000}s)</span>
          </div>
        </div>

        <div class="vinted-settings-actions">
          <button class="settings-btn settings-btn-reset" id="settings-reset-btn">Réinitialiser</button>
          <button class="settings-btn settings-btn-save" id="settings-save-btn">Enregistrer</button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // Mettre à jour l'affichage en temps réel
  const inputs = modal.querySelectorAll('.settings-interval-input');
  inputs.forEach(input => {
    input.addEventListener('input', (e) => {
      const value = parseInt(e.target.value);
      const display = e.target.parentElement.querySelector('.settings-display');
      if (display) {
        display.textContent = `(${value / 1000}s)`;
      }
    });
  });

  // Bouton de réinitialisation
  const resetBtn = modal.querySelector('#settings-reset-btn');
  resetBtn.addEventListener('click', () => {
    document.getElementById('messages-interval').value = DEFAULT_INTERVALS.messages;
    document.getElementById('notifications-interval').value = DEFAULT_INTERVALS.notifications;
    document.getElementById('items-interval').value = DEFAULT_INTERVALS.items;
    
    // Mettre à jour les affichages
    inputs.forEach(input => {
      const value = parseInt(input.value);
      const display = input.parentElement.querySelector('.settings-display');
      if (display) {
        display.textContent = `(${value / 1000}s)`;
      }
    });
  });

  // Bouton de sauvegarde
  const saveBtn = modal.querySelector('#settings-save-btn');
  saveBtn.addEventListener('click', async () => {
    const newIntervals = {
      messages: parseInt(document.getElementById('messages-interval').value),
      notifications: parseInt(document.getElementById('notifications-interval').value),
      items: parseInt(document.getElementById('items-interval').value)
    };

    // Validation
    if (newIntervals.messages < 1000 || newIntervals.notifications < 1000 || newIntervals.items < 1000) {
      alert('Les intervalles doivent être d\'au moins 1000ms (1 seconde)');
      return;
    }

    await saveIntervals(newIntervals);
    
    // Mettre à jour la config
    if (typeof CONFIG !== 'undefined') {
      CONFIG.MESSAGES_REFRESH_INTERVAL = newIntervals.messages;
      CONFIG.NOTIFICATIONS_REFRESH_INTERVAL = newIntervals.notifications;
      CONFIG.POLL_INTERVAL = newIntervals.items;
    }

    // Redémarrer les intervalles avec les nouveaux timings
    if (typeof startMessagesAutoRefresh === 'function' && typeof stopMessagesAutoRefresh === 'function') {
      stopMessagesAutoRefresh();
      setTimeout(async () => {
        await startMessagesAutoRefresh();
      }, 100);
    }

    if (typeof refreshNotificationsWidget === 'function') {
      if (typeof stopNotificationsWidgetRefresh === 'function') {
        stopNotificationsWidgetRefresh();
      }
      setTimeout(() => {
        if (typeof createNotificationsWidget === 'function') {
          // Le widget redémarrera automatiquement son intervalle
        }
      }, 100);
    }

    if (typeof stopMonitor === 'function' && typeof startMonitor === 'function' && state.isPolling) {
      stopMonitor();
      setTimeout(() => {
        startMonitor();
      }, 100);
    }

    // Fermer la modal
    closeSettingsModal();
    
    console.log('[Settings] Intervalles mis à jour:', newIntervals);
  });

  // Fermer la modal
  const closeBtn = modal.querySelector('.vinted-settings-close');
  closeBtn.addEventListener('click', closeSettingsModal);
  
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      closeSettingsModal();
    }
  });

  // Fermer avec Escape
  const escapeHandler = (e) => {
    if (e.key === 'Escape') {
      closeSettingsModal();
      document.removeEventListener('keydown', escapeHandler);
    }
  };
  document.addEventListener('keydown', escapeHandler);
}

function closeSettingsModal() {
  const modal = document.getElementById('vinted-settings-modal');
  if (modal) {
    modal.style.display = 'none';
  }
}

// Initialiser les intervalles au chargement
async function initIntervals() {
  const intervals = await loadIntervals();
  
  // Mettre à jour la config
  if (typeof CONFIG !== 'undefined') {
    CONFIG.MESSAGES_REFRESH_INTERVAL = intervals.messages;
    CONFIG.NOTIFICATIONS_REFRESH_INTERVAL = intervals.notifications;
    CONFIG.POLL_INTERVAL = intervals.items;
  }
}

// Exporter pour utilisation globale
if (typeof window !== 'undefined') {
  window.getInterval = getInterval;
  window.loadIntervals = loadIntervals;
  window.saveIntervals = saveIntervals;
}

