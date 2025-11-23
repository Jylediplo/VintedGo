// ==================== NOTIFICATIONS WIDGET ====================
// Widget de notifications affiché à côté du wallet avec rafraîchissement automatique

let notificationsWidgetInterval = null;
let cachedNotificationsData = null;

async function fetchNotificationsWidget(page = 1, perPage = 20) {
  try {
    const url = `https://www.vinted.fr/web/api/notifications/notifications?page=${page}&per_page=${perPage}`;
    const response = await fetch(url, {
      credentials: 'include',
      headers: {
        'accept': 'application/json, text/plain, */*',
        'accept-language': 'fr',
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("[Notifications Widget] Erreur lors de la récupération des notifications:", error);
    return null;
  }
}

async function loadAllNotificationsWidget() {
  let allNotifications = [];
  let currentPage = 1;
  let hasMore = true;

  while (hasMore) {
    const data = await fetchNotificationsWidget(currentPage, 20);
    if (data && data.notifications) {
      allNotifications = [...allNotifications, ...data.notifications];
      const totalPages = data.pagination?.total_pages || 1;
      hasMore = currentPage < totalPages;
      currentPage++;
    } else {
      hasMore = false;
    }
  }

  return allNotifications;
}

function getNotificationTypeLabel(entryType) {
  const typeLabels = {
    20: 'Favori',
    40: 'Nouveaux articles',
    10: 'Message',
    30: 'Transaction',
  };
  return typeLabels[entryType] || `Type ${entryType}`;
}

function formatNotificationDate(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'À l\'instant';
  if (diffMins < 60) return `Il y a ${diffMins} min`;
  if (diffHours < 24) return `Il y a ${diffHours}h`;
  if (diffDays < 7) return `Il y a ${diffDays}j`;
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

function createNotificationItemWidget(notif) {
  const photoUrl = notif.photo?.url || notif.small_photo_url || notif.photo?.thumbnails?.[0]?.url || '';
  const body = notif.body || 'Notification';
  const link = notif.link ? `https://www.vinted.fr${notif.link}` : '#';
  const isRead = notif.is_read || false;
  const typeLabel = getNotificationTypeLabel(notif.entry_type);
  const date = formatNotificationDate(notif.updated_at);

  return `
    <div class="notification-widget-item ${isRead ? 'read' : 'unread'}" data-notification-id="${notif.id}">
      ${photoUrl ? `<img src="${photoUrl}" alt="Notification" class="notification-widget-photo" loading="lazy">` : '<div class="notification-widget-photo-placeholder">📢</div>'}
      <div class="notification-widget-info">
        <div class="notification-widget-body">${escapeHtml(body)}</div>
        <div class="notification-widget-meta">
          <span class="notification-widget-type">${escapeHtml(typeLabel)}</span>
          ${date ? `<span class="notification-widget-date">${escapeHtml(date)}</span>` : ''}
        </div>
      </div>
      <a href="${link}" target="_blank" class="notification-widget-link" title="Voir">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
          <polyline points="15 3 21 3 21 9"></polyline>
          <line x1="10" y1="14" x2="21" y2="3"></line>
        </svg>
      </a>
    </div>
  `;
}

function renderNotificationsWidget(notifications) {
  const panelContainer = document.getElementById('vinted-notifications-panel');
  if (!panelContainer) return;

  const listContainer = panelContainer.querySelector('.notifications-panel-list');
  if (!listContainer) return;

  if (!notifications || notifications.length === 0) {
    listContainer.innerHTML = '<p class="notifications-panel-empty">Aucune notification</p>';
    return;
  }

  // Afficher toutes les notifications (ou limiter à 20)
  const displayNotifications = notifications.slice(0, 20);

  listContainer.innerHTML = displayNotifications.map(notif => createNotificationItemWidget(notif)).join('');

  // Mettre à jour le compteur sur l'icône
  const unreadCount = notifications.filter(n => !n.is_read).length;
  const iconButton = document.getElementById('vinted-notifications-icon');
  if (iconButton) {
    const countBadge = iconButton.querySelector('.notifications-icon-count');
    if (countBadge) {
      if (unreadCount > 0) {
        countBadge.textContent = unreadCount > 99 ? '99+' : unreadCount;
        countBadge.style.display = 'flex';
      } else {
        countBadge.style.display = 'none';
      }
    }
  }
}

async function refreshNotificationsWidget() {
  try {
    const notifications = await loadAllNotificationsWidget();
    if (notifications) {
      cachedNotificationsData = notifications;
      renderNotificationsWidget(notifications);
    }
  } catch (error) {
    console.error("[Notifications Widget] Erreur lors du rafraîchissement:", error);
  }
}

function createNotificationsWidget() {
  // Vérifier si le widget existe déjà
  if (document.getElementById('vinted-notifications-icon')) {
    return;
  }

  // Trouver le wallet pour placer l'icône à gauche
  const walletDisplay = document.getElementById('vinted-wallet-balance');
  if (!walletDisplay) {
    console.warn("[Notifications Widget] Wallet non trouvé, réessai dans 1 seconde...");
    setTimeout(createNotificationsWidget, 1000);
    return;
  }

  // Trouver le conteneur parent du wallet (btnWrapper)
  const walletParent = walletDisplay.parentElement;
  if (!walletParent) {
    console.warn("[Notifications Widget] Parent du wallet non trouvé");
    return;
  }

  // Créer l'icône de cloche (bouton)
  const iconButton = document.createElement('button');
  iconButton.id = 'vinted-notifications-icon';
  iconButton.className = 'vinted-notifications-icon';
  iconButton.innerHTML = '<svg class="notifications-icon-svg" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"></path></svg><span class="notifications-icon-count" style="display: none;">0</span>';
  iconButton.title = 'Notifications';
  iconButton.style.cssText = `
    position: relative;
    padding: 8px 12px;
    background: #6b7280;
    color: white;
    border: none;
    border-radius: 8px;
    font-size: 18px;
    cursor: pointer;
    transition: all 0.2s ease;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 40px;
  `;

  // Créer le panneau de notifications (masqué par défaut)
  const notificationsPanel = document.createElement('div');
  notificationsPanel.id = 'vinted-notifications-panel';
  notificationsPanel.className = 'vinted-notifications-panel';
  notificationsPanel.style.display = 'none';
  notificationsPanel.innerHTML = `
    <div class="notifications-panel-header">
      <span class="notifications-panel-title">Notifications</span>
      <button class="notifications-panel-close" title="Fermer">×</button>
    </div>
    <div class="notifications-panel-list">
      <p class="notifications-panel-loading">Chargement...</p>
    </div>
  `;

  // Trouver le bouton toggle (démarrer) pour placer l'icône après
  const toggleBtn = document.getElementById('toggle-monitor');
  if (toggleBtn && toggleBtn.parentElement === walletParent) {
    // Insérer l'icône APRÈS le bouton toggle (tout à droite)
    walletParent.insertBefore(iconButton, toggleBtn.nextSibling);
  } else {
    // Fallback : insérer à la fin du btnWrapper
    walletParent.appendChild(iconButton);
  }

  // Insérer le panneau après le btnWrapper (en position absolue)
  const btnWrapperParent = walletParent.parentElement;
  if (btnWrapperParent) {
    btnWrapperParent.appendChild(notificationsPanel);
  } else {
    document.body.appendChild(notificationsPanel);
  }

  let isPanelOpen = false;

  // Toggle du panneau au clic sur l'icône
  iconButton.addEventListener('click', (e) => {
    e.stopPropagation();
    isPanelOpen = !isPanelOpen;
    if (isPanelOpen) {
      notificationsPanel.style.display = 'block';
      // Charger les notifications si pas encore chargées
      if (!cachedNotificationsData) {
        refreshNotificationsWidget();
      } else {
        renderNotificationsWidget(cachedNotificationsData);
      }
    } else {
      notificationsPanel.style.display = 'none';
    }
  });

  // Fermer le panneau au clic sur le bouton fermer
  const closeBtn = notificationsPanel.querySelector('.notifications-panel-close');
  if (closeBtn) {
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      isPanelOpen = false;
      notificationsPanel.style.display = 'none';
    });
  }

  // Fermer le panneau si on clique en dehors
  document.addEventListener('click', (e) => {
    if (isPanelOpen && 
        !notificationsPanel.contains(e.target) && 
        !iconButton.contains(e.target)) {
      isPanelOpen = false;
      notificationsPanel.style.display = 'none';
    }
  });

  // Charger les notifications initiales en arrière-plan
  refreshNotificationsWidget();

  // Démarrer le rafraîchissement automatique toutes les 10 secondes
  if (notificationsWidgetInterval) {
    clearInterval(notificationsWidgetInterval);
  }
  notificationsWidgetInterval = setInterval(() => {
    refreshNotificationsWidget();
  }, 10000); // 10 secondes

  console.log("[Notifications Widget] Widget créé avec succès");
}

function stopNotificationsWidgetRefresh() {
  if (notificationsWidgetInterval) {
    clearInterval(notificationsWidgetInterval);
    notificationsWidgetInterval = null;
  }
}