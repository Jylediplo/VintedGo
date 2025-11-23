// ==================== MESSAGES ====================
// Variable globale pour stocker le token CSRF intercepté
let cachedCsrfToken = null;
let csrfTokenCacheTime = 0;
const CSRF_TOKEN_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Intercepte les requêtes fetch pour récupérer le token CSRF
 */
function interceptFetchForCsrfToken() {
  if (window._vintedCsrfIntercepted) return;
  window._vintedCsrfIntercepted = true;
  
  const originalFetch = window.fetch;
  window.fetch = function(...args) {
    const [url, options = {}] = args;
    
    // Si c'est une requête vers l'API Vinted avec un header x-csrf-token
    if (typeof url === 'string' && url.includes('vinted.fr/api')) {
      let csrfToken = null;
      if (options.headers) {
        if (options.headers instanceof Headers) {
          csrfToken = options.headers.get('x-csrf-token') || options.headers.get('X-CSRF-Token');
        } else {
          csrfToken = options.headers['x-csrf-token'] || 
                     options.headers['X-CSRF-Token'] ||
                     options.headers['X-Csrf-Token'];
        }
      }
      
      if (csrfToken) {
        cachedCsrfToken = csrfToken;
        csrfTokenCacheTime = Date.now();
      }
    }
    
    return originalFetch.apply(this, args);
  };
  
  // Intercepter aussi XMLHttpRequest
  if (window.XMLHttpRequest) {
    const originalSetRequestHeader = XMLHttpRequest.prototype.setRequestHeader;
    XMLHttpRequest.prototype.setRequestHeader = function(header, value) {
      if (header.toLowerCase() === 'x-csrf-token' && value) {
        cachedCsrfToken = value;
        csrfTokenCacheTime = Date.now();
      }
      return originalSetRequestHeader.apply(this, arguments);
    };
  }
}

/**
 * Récupère le token CSRF depuis les cookies ou les meta tags
 * @returns {Promise<string|null>} - Token CSRF
 */
async function getCsrfToken() {
  // Méthode 1: Depuis le cache (intercepté depuis une requête) - avec expiration
  const now = Date.now();
  if (cachedCsrfToken && (now - csrfTokenCacheTime) < CSRF_TOKEN_CACHE_DURATION) {
    return cachedCsrfToken;
  }
  // Cache expiré, le vider
  if (cachedCsrfToken && (now - csrfTokenCacheTime) >= CSRF_TOKEN_CACHE_DURATION) {
    cachedCsrfToken = null;
    csrfTokenCacheTime = 0;
  }
  
  // Méthode 2: Extraire le token CSRF depuis les scripts inline de la page
  // Le token est dans un script avec pattern: "CSRF_TOKEN":"[token]" dans __next_f.push
  try {
    const scripts = document.querySelectorAll('script:not([src])');
    for (const script of scripts) {
      const scriptContent = script.textContent || script.innerHTML;
      if (scriptContent && scriptContent.includes('CSRF_TOKEN')) {
        // Pattern principal: "CSRF_TOKEN":"[token]" ou CSRF_TOKEN":"[token]" (avec/sans guillemets)
        const patterns = [
          /"CSRF_TOKEN"\s*:\s*"([a-f0-9-]{36,})"/i,
          /CSRF_TOKEN"\s*:\s*"([a-f0-9-]{36,})"/i,
          /CSRF_TOKEN[\\"]*:\s*[\\"]*([a-f0-9-]{36,})/i
        ];
        
        for (const pattern of patterns) {
          const match = scriptContent.match(pattern);
          if (match && match[1] && match[1].length > 20) {
            cachedCsrfToken = match[1];
            csrfTokenCacheTime = Date.now();
            return match[1];
          }
        }
      }
    }
    
    // Fallback: Chercher dans le HTML complet
    const htmlContent = document.documentElement.outerHTML || document.body.innerHTML;
    if (htmlContent.includes('CSRF_TOKEN')) {
      const htmlMatch = htmlContent.match(/"CSRF_TOKEN"\s*:\s*"([a-f0-9-]{36,})"/i);
      if (htmlMatch && htmlMatch[1] && htmlMatch[1].length > 20) {
        cachedCsrfToken = htmlMatch[1];
        csrfTokenCacheTime = Date.now();
        return htmlMatch[1];
      }
    }
  } catch (e) {
    // Ignorer les erreurs
  }
  
  // Méthode 3: Depuis window.__NEXT_DATA__?.env (fallback)
  if (window.__NEXT_DATA__?.env?.CSRF_TOKEN) {
    const token = window.__NEXT_DATA__.env.CSRF_TOKEN;
    if (token && typeof token === 'string' && token.length > 20) {
      cachedCsrfToken = token;
      csrfTokenCacheTime = Date.now();
      return token;
    }
  }
  
  return null;
}

/**
 * Essaie de récupérer le token CSRF depuis la page en faisant une requête
 */
async function tryGetCsrfTokenFromPage() {
  try {
    // Essayer de récupérer depuis la page inbox
    const inboxResponse = await fetch('https://www.vinted.fr/inbox', {
      credentials: "include",
      headers: {
        "accept": "text/html,application/xhtml+xml",
      },
    });
    
    if (inboxResponse.ok) {
      const html = await inboxResponse.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      
      // Chercher dans les meta tags (tous les variants)
      const metaSelectors = [
        'meta[name="csrf-token"]',
        'meta[name="csrf_token"]',
        'meta[name="CSRF-Token"]',
        'meta[property="csrf-token"]'
      ];
      
      for (const selector of metaSelectors) {
        const metaTag = doc.querySelector(selector);
        if (metaTag) {
          const token = metaTag.getAttribute('content');
          if (token && token.length > 20) {
            return token;
          }
        }
      }
      
      // Chercher dans les attributs data
      const dataTag = doc.querySelector('[data-csrf-token], body[data-csrf-token], html[data-csrf-token]');
      if (dataTag) {
        const token = dataTag.getAttribute('data-csrf-token') || 
                     dataTag.getAttribute('data-csrf_token') ||
                     dataTag.getAttribute('data-csrf');
        if (token && token.length > 20) {
          return token;
        }
      }
      
      // Chercher dans le HTML avec des patterns améliorés
      const patterns = [
        /csrf[_-]?token["\s:=]+["']?([a-f0-9-]{36,})["']?/i,
        /["']x-csrf-token["']\s*:\s*["']([a-f0-9-]{36,})["']/i,
        /x-csrf-token["\s:=]+["']?([a-f0-9-]{36,})["']?/i,
        /csrfToken["\s:=]+["']?([a-f0-9-]{36,})["']?/i,
        /csrf_token["\s:=]+["']?([a-f0-9-]{36,})["']?/i
      ];
      
      for (const pattern of patterns) {
        const match = html.match(pattern);
        if (match && match[1] && match[1].length > 20) {
          return match[1];
        }
      }
    }
  } catch (error) {
    console.error("[Vinted Messages] Erreur lors de la récupération du token:", error);
  }
  
  return null;
}

/**
 * Récupère l'anon_id depuis les cookies
 * @returns {string|null} - Anon ID
 */
function getAnonId() {
  const cookies = document.cookie.split(';');
  for (const cookie of cookies) {
    const [name, value] = cookie.trim().split('=');
    if (name === 'anon_id') {
      return decodeURIComponent(value);
    }
  }
  return null;
}

// Initialiser l'interception au chargement
if (typeof window !== 'undefined') {
  interceptFetchForCsrfToken();
}

// Fonctions pour gérer les conversations
async function fetchConversation(conversationId) {
  try {
    const url = `https://www.vinted.fr/api/v2/conversations/${conversationId}`;
    const response = await fetch(url, {
      credentials: "include",
      headers: {
        "accept": "application/json, text/plain, */*",
        "accept-language": "fr",
        "sec-fetch-dest": "empty",
        "sec-fetch-mode": "cors",
        "sec-fetch-site": "same-origin",
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    return data.conversation;
  } catch (error) {
    console.error("[Messages] Erreur lors de la récupération de la conversation:", error);
    throw error;
  }
}

async function sendMessage(conversationId, messageBody) {
  console.log("[Vinted Messages] sendMessage appelé avec conversationId:", conversationId, "messageBody:", messageBody?.substring(0, 50));
  
  const url = `https://www.vinted.fr/api/v2/conversations/${conversationId}/replies`;
  console.log("[Vinted Messages] URL de la requête:", url);
  
  // Récupérer le token CSRF et l'anon_id
  console.log("[Vinted Messages] Récupération du token CSRF...");
  let csrfToken = await getCsrfToken();
  console.log("[Vinted Messages] Token CSRF récupéré:", csrfToken ? csrfToken.substring(0, 8) + '...' : 'null');
  
  const anonId = getAnonId();
  console.log("[Vinted Messages] Anon ID:", anonId || 'non trouvé');
  
  // Si pas de token, essayer de le récupérer depuis la page inbox
  if (!csrfToken) {
    console.warn("[Vinted Messages] Token CSRF non trouvé, tentative de récupération depuis la page...");
    csrfToken = await tryGetCsrfTokenFromPage();
    if (csrfToken) {
      cachedCsrfToken = csrfToken;
      csrfTokenCacheTime = Date.now();
      console.log("[Vinted Messages] Token CSRF récupéré depuis la page");
    }
  }
  
  if (!csrfToken) {
    const error = "Impossible de récupérer le token CSRF. Veuillez recharger la page et réessayer.";
    console.error("[Vinted Messages]", error);
    throw new Error(error);
  }
  
  console.log("[Vinted Messages] Envoi du message avec token CSRF:", csrfToken.substring(0, 8) + '...');
  
  const payload = {
    reply: {
      body: messageBody,
      photo_temp_uuids: null,
      is_personal_data_sharing_check_skipped: false
    }
  };
  
  try {
    const headers = {
      "content-type": "application/json",
      "x-csrf-token": csrfToken,
      "accept": "application/json, text/plain, */*",
    };
    
    // Ajouter l'anon_id si disponible (optionnel mais peut aider)
    if (anonId) {
      headers["x-anon-id"] = anonId;
    }
    
    // S'assurer que les cookies (y compris DataDome) sont inclus
    const fetchOptions = {
      method: "POST",
      credentials: "include", // Inclut automatiquement les cookies (y compris DataDome)
      headers: headers,
      body: JSON.stringify(payload),
      mode: "cors",
      cache: "no-cache",
    };
    
    const response = await fetch(url, fetchOptions);

    if (!response.ok) {
      let errorData;
      try {
        errorData = await response.json();
      } catch {
        const errorText = await response.text();
        errorData = { message: errorText };
      }
      console.error("[Vinted Messages] Erreur API:", errorData);
      
      // Si c'est une erreur d'accès refusé, essayer de récupérer le token depuis la page
      if (errorData.code === 106 || response.status === 403) {
        console.warn("[Vinted Messages] Accès refusé, tentative de récupération du token CSRF depuis la page");
        
        // Recharger la page pour récupérer le token (ou essayer une autre méthode)
        const newCsrfToken = await tryGetCsrfTokenFromPage();
        if (newCsrfToken && newCsrfToken !== csrfToken) {
          headers["x-csrf-token"] = newCsrfToken;
          cachedCsrfToken = newCsrfToken;
          csrfTokenCacheTime = Date.now();
          // Réessayer avec le nouveau token
          const retryResponse = await fetch(url, {
            method: "POST",
            credentials: "include",
            headers: headers,
            body: JSON.stringify(payload),
          });
          
          if (!retryResponse.ok) {
            let retryError;
            try {
              retryError = await retryResponse.json();
            } catch {
              const retryErrorText = await retryResponse.text();
              retryError = { message: retryErrorText };
            }
            throw new Error(`HTTP ${retryResponse.status}: ${JSON.stringify(retryError)}`);
          }
          
          return await retryResponse.json();
        }
      }
      
      throw new Error(`HTTP ${response.status}: ${JSON.stringify(errorData)}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("[Vinted Messages] Erreur lors de l'envoi du message:", error);
    throw error;
  }
}

async function sendOfferRequest(transactionId, price, currency = "EUR") {
  const url = `https://www.vinted.fr/api/v2/transactions/${transactionId}/offer_requests`;
  
  let csrfToken = await getCsrfToken();
  const anonId = getAnonId();
  
  if (!csrfToken) {
    csrfToken = await tryGetCsrfTokenFromPage();
    if (csrfToken) {
      cachedCsrfToken = csrfToken;
      csrfTokenCacheTime = Date.now();
    }
  }
  
  if (!csrfToken) {
    throw new Error("Impossible de récupérer le token CSRF. Veuillez recharger la page et réessayer.");
  }
  
  const headers = {
    "content-type": "application/json",
    "x-csrf-token": csrfToken,
    "accept": "application/json, text/plain, */*",
  };
  
  // Ajouter l'anon_id si disponible
  if (anonId) {
    headers["x-anon-id"] = anonId;
  }
  
  try {
    const response = await fetch(url, {
      method: "POST",
      credentials: "include",
      headers: headers,
      body: JSON.stringify({
        offer_request: {
          price: price.toString(),
          currency: currency
        }
      })
    });

    if (!response.ok) {
      let errorData;
      try {
        errorData = await response.json();
      } catch {
        const errorText = await response.text();
        errorData = { message: errorText };
      }
      
      // Si c'est une erreur d'accès refusé, essayer de récupérer le token depuis la page
      if (errorData.code === 106 || response.status === 403) {
        cachedCsrfToken = null;
        csrfTokenCacheTime = 0;
        const newToken = await tryGetCsrfTokenFromPage();
        if (newToken) {
          cachedCsrfToken = newToken;
          csrfTokenCacheTime = Date.now();
          headers["x-csrf-token"] = newToken;
          // Réessayer avec le nouveau token
          const retryResponse = await fetch(url, {
            method: "POST",
            credentials: "include",
            headers: headers,
            body: JSON.stringify({
              offer_request: {
                price: price.toString(),
                currency: currency
              }
            })
          });
          
          if (!retryResponse.ok) {
            throw new Error(`HTTP ${retryResponse.status}`);
          }
          
          return await retryResponse.json();
        }
      }
      
      throw new Error(`HTTP ${response.status}: ${JSON.stringify(errorData)}`);
    }

    return await response.json();
  } catch (error) {
    console.error("[Vinted Messages] Erreur lors de l'envoi de l'offre:", error);
    throw error;
  }
}

function formatMessage(message, currentUserId, conversationUrl, transaction = null) {
  // Déterminer si le message est de l'utilisateur actuel
  // Pour les messages d'offre, utiliser user_id de l'entité
  const messageUserId = message.entity?.user_id;
  const isCurrentUser = messageUserId === currentUserId;
  const messageClass = isCurrentUser ? 'vinted-msg-current-user' : 'vinted-msg-other-user';
  
  // Formater la date - created_at_ts peut être une chaîne ISO 8601 ou un timestamp
  let timeAgo = message.created_time_ago || '';
  if (!timeAgo && message.created_at_ts) {
    try {
      // Si c'est une chaîne ISO 8601, la parser directement
      const date = new Date(message.created_at_ts);
      if (!isNaN(date.getTime())) {
        // Formater la date de manière relative
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);
        
        if (diffMins < 1) {
          timeAgo = 'À l\'instant';
        } else if (diffMins < 60) {
          timeAgo = `Il y a ${diffMins} min`;
        } else if (diffHours < 24) {
          timeAgo = `Il y a ${diffHours}h`;
        } else if (diffDays < 7) {
          timeAgo = `Il y a ${diffDays}j`;
        } else {
          timeAgo = new Intl.DateTimeFormat('fr-FR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          }).format(date);
        }
      }
    } catch (e) {
      console.error("[Vinted Messages] Erreur lors du formatage de la date:", e, message.created_at_ts);
      timeAgo = '';
    }
  }
  
  let content = '';
  
  if (message.entity_type === 'message') {
    content = `<div class="vinted-msg-body">${escapeHtml(message.entity.body)}</div>`;
  } else if (message.entity_type === 'status_message') {
    content = `
      <div class="vinted-msg-status">
        <div class="vinted-msg-status-title">${escapeHtml(message.entity.title)}</div>
        ${message.entity.subtitle ? `<div class="vinted-msg-status-subtitle">${escapeHtml(message.entity.subtitle)}</div>` : ''}
      </div>
    `;
  } else if (message.entity_type === 'action_message') {
    content = `
      <div class="vinted-msg-action">
        <div class="vinted-msg-action-title">${escapeHtml(message.entity.title)}</div>
        ${message.entity.subtitle ? `<div class="vinted-msg-action-subtitle">${escapeHtml(message.entity.subtitle)}</div>` : ''}
        ${message.entity.actions && message.entity.actions.length > 0 ? `
          <div class="vinted-msg-actions">
            ${message.entity.actions.map(action => {
              let actionUrl = conversationUrl;
              if (action.action === 'track_shipment' && transaction?.id) {
                actionUrl = `https://www.vinted.fr/transactions/${transaction.id}`;
              }
              return `<a href="${actionUrl}" target="_blank" class="vinted-msg-action-btn">${escapeHtml(action.title)}</a>`;
            }).join('')}
          </div>
        ` : ''}
      </div>
    `;
  } else if (message.entity_type === 'offer_request_message') {
    // Message d'offre demandée (par l'acheteur)
    const statusText = message.entity.status_title ? ` (${escapeHtml(message.entity.status_title)})` : '';
    content = `
      <div class="vinted-msg-offer">
        <div class="vinted-msg-offer-title">${escapeHtml(message.entity.title || 'Offre demandée')}${statusText}</div>
        <div class="vinted-msg-offer-price">${escapeHtml(message.entity.price_label || message.entity.body || '')}</div>
        ${message.entity.original_price_label ? `<div class="vinted-msg-offer-original">Prix original: ${escapeHtml(message.entity.original_price_label)}</div>` : ''}
      </div>
    `;
  } else if (message.entity_type === 'offer_message') {
    // Message d'offre acceptée (par le vendeur)
    content = `
      <div class="vinted-msg-offer accepted">
        <div class="vinted-msg-offer-title">Offre acceptée</div>
        <div class="vinted-msg-offer-price">${escapeHtml(message.entity.price_label || '')}</div>
        ${message.entity.original_price_label ? `<div class="vinted-msg-offer-original">Prix original: ${escapeHtml(message.entity.original_price_label)}</div>` : ''}
      </div>
    `;
  }
  
  // Ne pas afficher de message vide
  if (!content) {
    return '';
  }
  
  return `
    <div class="vinted-msg-item ${messageClass}">
      ${content}
      <div class="vinted-msg-time">${escapeHtml(timeAgo)}</div>
    </div>
  `;
}

async function fetchInbox(page = 1, perPage = 20) {
  // Limiter le nombre de conversations chargées pour réduire la mémoire
  const MAX_CONVERSATIONS = 30;
  if (perPage > MAX_CONVERSATIONS) perPage = MAX_CONVERSATIONS;
  try {
    const url = `https://www.vinted.fr/api/v2/inbox?page=${page}&per_page=${perPage}`;
    const response = await fetch(url, {
      credentials: "include",
      headers: {
        "accept": "application/json, text/plain, */*",
        "accept-language": "fr",
        "sec-fetch-dest": "empty",
        "sec-fetch-mode": "cors",
        "sec-fetch-site": "same-origin",
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("[Messages] Erreur lors de la récupération des messages:", error);
    return null;
  }
}

function formatMessageDate(dateString) {
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
  
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
}

function renderMessagesList(conversations, readFilter) {
  const messagesList = document.getElementById('vinted-messages-list');
  if (!messagesList) return;

  if (!conversations || conversations.length === 0) {
    messagesList.innerHTML = '<p class="messages-empty">Aucun message</p>';
    return;
  }

  const messagesHtml = conversations.map(conv => {
    const photoUrl = conv.opposite_user?.photo?.thumbnails?.find(t => t.type === "thumb100")?.url || 
                     conv.opposite_user?.photo?.url || 
                     'https://via.placeholder.com/50';
    const username = conv.opposite_user?.login || 'Utilisateur';
    const description = conv.description || '';
    const date = formatMessageDate(conv.updated_at);
    const isUnread = conv.unread === true;
    const unreadClass = isUnread ? 'unread' : '';
    const conversationUrl = `https://www.vinted.fr/inbox/${conv.id}`;
    const itemPhoto = conv.item_photos?.[0]?.thumbnails?.find(t => t.type === "thumb70x100")?.url || 
                      conv.item_photos?.[0]?.url || '';

    return `
      <div class="message-item ${unreadClass}" data-conversation-id="${conv.id}" style="cursor: pointer;">
        ${itemPhoto ? `<img src="${itemPhoto}" alt="Article" class="message-item-photo">` : `<img src="${photoUrl}" alt="${escapeHtml(username)}" class="message-avatar">`}
        <div class="message-info">
          <div class="message-header">
            <div class="message-username">${escapeHtml(username)}</div>
            ${isUnread ? '<span class="message-unread-badge">●</span>' : ''}
          </div>
          <div class="message-description">${escapeHtml(description)}</div>
          <div class="message-date">${date}</div>
        </div>
        <a href="${conversationUrl}" target="_blank" class="message-link" title="Ouvrir la conversation" onclick="event.stopPropagation();">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
            <polyline points="15 3 21 3 21 9"></polyline>
            <line x1="10" y1="14" x2="21" y2="3"></line>
          </svg>
        </a>
      </div>
    `;
  }).join('');
  
  messagesList.innerHTML = messagesHtml;
  
  // Utiliser la délégation d'événements pour éviter d'ajouter des listeners à chaque rendu
  // Le listener est déjà attaché dans createMessagesListManager
}

let currentMessagesFilter = 'all';
let currentMessagesPage = 1;
let messagesRefreshInterval = null;

async function loadMessages(readFilter = 'all', page = 1) {
  // Éviter les appels multiples simultanés
  if (isMessagesLoading) {
    console.log("[Vinted Messages] Chargement déjà en cours, skip");
    return;
  }
  
  isMessagesLoading = true;
  
  const messagesContainer = document.getElementById('vinted-messages-list');
  if (messagesContainer) {
    // Ne pas afficher "Chargement..." si c'est un rafraîchissement automatique
    const isLoading = !messagesContainer.querySelector('.message-item');
    if (isLoading) {
      messagesContainer.innerHTML = '<p class="messages-loading">Chargement...</p>';
    }
  }

  try {
    const data = await fetchInbox(page, 20);
    if (data && data.conversations) {
      // Filtrer les messages selon le statut lu/non lu
      let filteredConversations = data.conversations;
      if (readFilter === 'unread') {
        filteredConversations = data.conversations.filter(conv => conv.unread === true);
      } else if (readFilter === 'read') {
        filteredConversations = data.conversations.filter(conv => conv.unread !== true);
      }
      
      // Limiter le nombre de conversations affichées pour réduire la mémoire
      const MAX_DISPLAYED_CONVERSATIONS = 30;
      filteredConversations = filteredConversations.slice(0, MAX_DISPLAYED_CONVERSATIONS);
      
      renderMessagesList(filteredConversations, readFilter);
      currentMessagesFilter = readFilter;
      currentMessagesPage = page;
      
      // Mettre à jour les boutons de filtre avec les compteurs
      updateMessagesFilterButtons(readFilter, data.conversations);
      
      // Mettre à jour le compteur dans l'onglet avec les données déjà chargées
      updateMessagesCountInTab(data.conversations);
    } else {
      if (messagesContainer) {
        messagesContainer.innerHTML = '<p class="messages-empty">Erreur lors du chargement des messages</p>';
      }
      // Mettre à jour les boutons sans compteurs en cas d'erreur
      updateMessagesFilterButtons(readFilter);
    }
  } catch (error) {
    console.error("[Vinted Messages] Erreur lors du chargement des messages:", error);
    if (messagesContainer) {
      messagesContainer.innerHTML = '<p class="messages-empty">Erreur lors du chargement des messages</p>';
    }
  } finally {
    isMessagesLoading = false;
  }
}

/**
 * Démarre le rafraîchissement automatique des messages toutes les 5 secondes
 */
let isMessagesLoading = false;

let isMessagesAutoRefreshStarting = false;

async function startMessagesAutoRefresh() {
  // Éviter les appels multiples simultanés
  if (isMessagesAutoRefreshStarting) {
    console.log("[Vinted Messages] Démarrage déjà en cours, skip");
    return;
  }
  
  // Arrêter l'intervalle existant s'il y en a un
  stopMessagesAutoRefresh();
  
  isMessagesAutoRefreshStarting = true;
  
  // Rafraîchir immédiatement
  loadMessages(currentMessagesFilter, currentMessagesPage);
  
  // Obtenir l'intervalle depuis les settings ou la config
  const getMessagesInterval = async () => {
    if (typeof getInterval === 'function') {
      return await getInterval('messages');
    }
    return CONFIG.MESSAGES_REFRESH_INTERVAL || 10000;
  };
  
  const interval = await getMessagesInterval();
  
  // S'assurer qu'on ne crée pas plusieurs intervalles
  if (messagesRefreshInterval) {
    clearInterval(messagesRefreshInterval);
    messagesRefreshInterval = null;
  }
  
  // Puis rafraîchir selon l'intervalle configuré
  messagesRefreshInterval = setInterval(async () => {
    // Éviter les appels multiples si une requête est déjà en cours
    if (isMessagesLoading) {
      console.log("[Vinted Messages] Requête en cours, skip du rafraîchissement");
      return;
    }
    
    console.log("[Vinted Messages] Rafraîchissement automatique de la liste des messages");
    loadMessages(currentMessagesFilter, currentMessagesPage);
    // Le compteur sera mis à jour par loadMessages avec les données déjà chargées
  }, interval);
  
  console.log(`[Vinted Messages] ✅ Rafraîchissement automatique activé (toutes les ${interval / 1000} secondes)`);
  isMessagesAutoRefreshStarting = false;
}

/**
 * Arrête le rafraîchissement automatique des messages
 */
function stopMessagesAutoRefresh() {
  if (messagesRefreshInterval) {
    clearInterval(messagesRefreshInterval);
    messagesRefreshInterval = null;
    console.log("[Vinted Messages] Rafraîchissement automatique arrêté");
  }
}

function updateMessagesFilterButtons(activeFilter, conversations = null) {
  const buttons = document.querySelectorAll('.message-filter-btn');
  
  // Calculer les compteurs si les conversations sont fournies
  let counts = { all: 0, unread: 0, read: 0 };
  if (conversations) {
    counts.all = conversations.length;
    counts.unread = conversations.filter(conv => conv.unread === true).length;
    counts.read = conversations.filter(conv => conv.unread !== true).length;
  }
  
  // Mapping des textes de base
  const baseTexts = {
    'all': 'Tous',
    'unread': 'Non lus',
    'read': 'Lus'
  };
  
  buttons.forEach(btn => {
    const filter = btn.dataset.filter;
    if (filter === activeFilter) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
    
    // Mettre à jour le texte avec le compteur
    if (conversations) {
      const baseText = baseTexts[filter] || filter;
      btn.textContent = `${baseText} (${counts[filter] || 0})`;
    }
  });
}

let messagesListManagerRetries = 0;
const MAX_MESSAGES_RETRIES = 10;

let isCreatingMessagesManager = false;

function createMessagesListManager() {
  // Éviter les appels multiples simultanés
  if (isCreatingMessagesManager) {
    console.log("[Messages] Création déjà en cours, skip");
    return;
  }
  
  const sidebar = document.getElementById('sidebar');
  if (!sidebar) {
    messagesListManagerRetries++;
    if (messagesListManagerRetries < MAX_MESSAGES_RETRIES) {
      setTimeout(createMessagesListManager, 500);
    }
    return;
  }

  if (document.getElementById('vinted-messages-list-manager')) {
    console.log("[Messages] Manager déjà créé, skip");
    return; // Déjà créé
  }
  
  isCreatingMessagesManager = true;

  const messagesManager = document.createElement('div');
  messagesManager.id = 'vinted-messages-list-manager';
  messagesManager.className = 'vinted-messages-list-manager';
  messagesManager.style.display = 'none'; // Masqué par défaut
  messagesManager.innerHTML = `
    <div class="vinted-messages-list-manager-header">
      <h3 class="vinted-messages-list-manager-title">Mes Messages</h3>
    </div>
    <div class="vinted-messages-filters">
      <button class="message-filter-btn active" data-filter="all" title="Tous les messages">Tous</button>
      <button class="message-filter-btn" data-filter="unread" title="Messages non lus">Non lus</button>
      <button class="message-filter-btn" data-filter="read" title="Messages lus">Lus</button>
    </div>
    <div id="vinted-messages-list" class="vinted-messages-list">
      <p class="messages-loading">Chargement...</p>
    </div>
  `;

  // Insérer dans le sticky container après le manager de messages notifications
  const sidebarStickyContainer = document.getElementById('sidebar-sticky-container');
  const messagesStickyContainer = document.getElementById('messages-sticky-container');
  
  if (sidebarStickyContainer) {
    if (messagesStickyContainer) {
      // Insérer après le messages-sticky-container
      if (messagesStickyContainer.nextSibling) {
        sidebarStickyContainer.insertBefore(messagesManager, messagesStickyContainer.nextSibling);
      } else {
        sidebarStickyContainer.appendChild(messagesManager);
      }
    } else {
      // Si pas de messages sticky container, insérer avant le orders-manager
      const ordersManager = document.getElementById('vinted-orders-manager');
      if (ordersManager && ordersManager.parentNode) {
        ordersManager.parentNode.insertBefore(messagesManager, ordersManager);
      } else {
        sidebarStickyContainer.appendChild(messagesManager);
      }
    }
  } else {
    sidebar.insertBefore(messagesManager, sidebar.firstChild);
  }

  // Boutons de filtre - utiliser la délégation d'événements
  messagesManager.addEventListener('click', (e) => {
    const filterBtn = e.target.closest('.message-filter-btn');
    if (filterBtn) {
      const filter = filterBtn.dataset.filter;
      loadMessages(filter, 1);
    }
  });
  
  // Délégation d'événements pour les clics sur les conversations
  const messagesList = messagesManager.querySelector('#vinted-messages-list');
  if (messagesList) {
    messagesList.addEventListener('click', (e) => {
      const messageItem = e.target.closest('.message-item');
      if (!messageItem) return;
      
      // Ne pas ouvrir si on clique sur le lien externe
      if (e.target.closest('.message-link')) {
        return;
      }
      
      const conversationId = messageItem.dataset.conversationId;
      if (conversationId) {
        openConversationModal(conversationId);
      }
    });
  }

  // Charger les messages initiaux et démarrer le rafraîchissement automatique
  loadMessages('all', 1);
  
  // Démarrer le rafraîchissement automatique immédiatement (l'onglet messages est actif par défaut)
  setTimeout(async () => {
    if (typeof startMessagesAutoRefresh === 'function') {
      await startMessagesAutoRefresh();
    }
  }, 500);
  
  console.log("[Messages List Manager] Interface créée avec succès");
  messagesListManagerRetries = 0;
  isCreatingMessagesManager = false;
}

// Injecter les styles pour la modal de conversation si nécessaire
function ensureConversationModalStyles() {
  if (document.getElementById('vinted-conversation-modal-styles')) {
    return; // Styles déjà injectés
  }
  
  const style = document.createElement('style');
  style.id = 'vinted-conversation-modal-styles';
  style.textContent = `
    .vinted-conversation-modal {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      z-index: 100000;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(0, 0, 0, 0.5);
      backdrop-filter: blur(4px);
      animation: fadeIn 0.3s ease;
    }
    
    .vinted-conversation-container {
      width: 90%;
      max-width: 600px;
      max-height: 90vh;
      background: rgba(255, 255, 255, 0.95) !important;
      background-color: rgba(255, 255, 255, 0.95) !important;
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
      border-radius: 16px;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      animation: slideUp 0.3s ease;
    }
    
    .vinted-dark-mode .vinted-conversation-container {
      background: rgba(30, 30, 30, 0.95) !important;
      background-color: rgba(30, 30, 30, 0.95) !important;
    }
    
    .vinted-conversation-content {
      display: flex;
      flex-direction: column;
      height: 100%;
      max-height: 90vh;
    }
    
    .vinted-conversation-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 1rem 1.5rem;
      border-bottom: 1px solid rgba(0, 0, 0, 0.1);
    }
    
    .vinted-conversation-user {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }
    
    .vinted-conversation-avatar {
      width: 50px;
      height: 50px;
      border-radius: 50%;
      object-fit: cover;
    }
    
    .vinted-conversation-user-info {
      display: flex;
      flex-direction: column;
    }
    
    .vinted-conversation-username {
      font-weight: 600;
      font-size: 1rem;
      color: #1a1a1a;
    }
    
    .vinted-dark-mode .vinted-conversation-username {
      color: #ffffff;
    }
    
    .vinted-conversation-subtitle {
      font-size: 0.875rem;
      color: #666;
      margin-top: 0.25rem;
    }
    
    .vinted-dark-mode .vinted-conversation-subtitle {
      color: #aaa;
    }
    
    .vinted-conversation-close {
      background: transparent;
      border: none;
      font-size: 2rem;
      line-height: 1;
      color: #666;
      cursor: pointer;
      padding: 0;
      width: 32px;
      height: 32px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 50%;
      transition: all 0.2s;
    }
    
    .vinted-conversation-close:hover {
      background: rgba(0, 0, 0, 0.1);
      color: #333;
    }
    
    .vinted-dark-mode .vinted-conversation-close {
      color: #aaa;
    }
    
    .vinted-dark-mode .vinted-conversation-close:hover {
      background: rgba(255, 255, 255, 0.1);
      color: #fff;
    }
    
    .vinted-conversation-messages {
      flex: 1;
      overflow-y: auto;
      padding: 1rem 1.5rem;
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }
    
    .vinted-notif-messages-content {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }
    
    .vinted-notif-messages-input-container {
      margin-top: 12px;
      padding: 1rem 1.5rem;
      border-top: 1px solid rgba(0, 0, 0, 0.1);
      display: flex;
      gap: 8px;
      align-items: center;
    }
    
    .vinted-offer-form-container {
      padding: 1rem 1.5rem;
      border-top: 1px solid rgba(0, 0, 0, 0.1);
      background: rgba(249, 250, 251, 0.5);
    }
    
    .vinted-dark-mode .vinted-offer-form-container {
      background: rgba(30, 30, 30, 0.5);
      border-top-color: rgba(255, 255, 255, 0.1);
    }
    
    .vinted-offer-form-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1rem;
    }
    
    .vinted-offer-form-header h3 {
      margin: 0;
      font-size: 1.125rem;
      font-weight: 600;
      color: #1a1a1a;
    }
    
    .vinted-dark-mode .vinted-offer-form-header h3 {
      color: #ffffff;
    }
    
    .vinted-offer-form-close {
      background: transparent;
      border: none;
      font-size: 1.5rem;
      line-height: 1;
      color: #666;
      cursor: pointer;
      padding: 0;
      width: 28px;
      height: 28px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 50%;
      transition: all 0.2s;
    }
    
    .vinted-offer-form-close:hover {
      background: rgba(0, 0, 0, 0.1);
      color: #333;
    }
    
    .vinted-dark-mode .vinted-offer-form-close {
      color: #aaa;
    }
    
    .vinted-dark-mode .vinted-offer-form-close:hover {
      background: rgba(255, 255, 255, 0.1);
      color: #fff;
    }
    
    .vinted-offer-form-body {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }
    
    .vinted-offer-form-body label {
      font-weight: 500;
      font-size: 0.875rem;
      color: #1a1a1a;
    }
    
    .vinted-dark-mode .vinted-offer-form-body label {
      color: #ffffff;
    }
    
    .vinted-offer-price-input {
      width: 100%;
      padding: 0.75rem;
      border: 1px solid #ddd;
      border-radius: 8px;
      font-size: 1rem;
      box-sizing: border-box;
      background: white;
      color: #1a1a1a;
    }
    
    .vinted-offer-price-input:focus {
      outline: none;
      border-color: #09B1BA;
      box-shadow: 0 0 0 3px rgba(9, 177, 186, 0.1);
    }
    
    .vinted-dark-mode .vinted-offer-price-input {
      background: #2a2a2a;
      border-color: #444;
      color: white;
    }
    
    .vinted-offer-form-actions {
      display: flex;
      gap: 0.75rem;
      justify-content: flex-end;
    }
    
    .vinted-offer-form-cancel,
    .vinted-offer-form-submit {
      padding: 0.75rem 1.5rem;
      border: none;
      border-radius: 8px;
      font-size: 0.875rem;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s;
    }
    
    .vinted-offer-form-cancel {
      background: #f0f0f0;
      color: #333;
    }
    
    .vinted-offer-form-cancel:hover {
      background: #e0e0e0;
    }
    
    .vinted-dark-mode .vinted-offer-form-cancel {
      background: #333;
      color: white;
    }
    
    .vinted-dark-mode .vinted-offer-form-cancel:hover {
      background: #444;
    }
    
    .vinted-offer-form-submit {
      background: #09B1BA;
      color: white;
    }
    
    .vinted-offer-form-submit:hover {
      background: #078a91;
    }
    
    .vinted-offer-form-submit:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
    
    .vinted-notif-messages-input {
      flex: 1;
      padding: 8px 12px;
      border: 1px solid rgba(0, 0, 0, 0.2);
      border-radius: 20px;
      font-size: 0.875rem;
      background: rgba(255, 255, 255, 0.5);
      color: #1a1a1a;
      outline: none;
      transition: all 0.2s;
    }
    
    .vinted-notif-messages-input:focus {
      border-color: #09B1BA;
      background: rgba(255, 255, 255, 0.8);
      box-shadow: 0 0 0 2px rgba(9, 177, 186, 0.2);
    }
    
    .vinted-notif-messages-send {
      width: 36px;
      height: 36px;
      border-radius: 50%;
      background: #09B1BA;
      border: none;
      color: white;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s;
      flex-shrink: 0;
    }
    
    .vinted-notif-messages-send:hover:not(:disabled) {
      background: #078a91;
      transform: scale(1.05);
    }
    
    .vinted-notif-offer-btn {
      margin: 12px 1.5rem;
      padding: 8px 16px;
      background: #09B1BA;
      color: white;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      font-size: 0.875rem;
      font-weight: 500;
      display: flex;
      align-items: center;
      gap: 6px;
      transition: all 0.2s;
    }
    
    .vinted-notif-offer-btn:hover {
      background: #078a91;
      transform: translateY(-1px);
    }
    
    .vinted-conversation-footer {
      padding: 1rem 1.5rem;
      border-top: 1px solid rgba(0, 0, 0, 0.1);
      text-align: center;
    }
    
    .vinted-conversation-link {
      color: #09B1BA;
      text-decoration: none;
      font-weight: 500;
      transition: all 0.2s;
    }
    
    .vinted-conversation-link:hover {
      color: #078a91;
      text-decoration: underline;
    }
    
    .vinted-conversation-loading {
      padding: 2rem;
      text-align: center;
      color: #666;
    }
    
    .vinted-msg-item {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
      max-width: 70%;
    }
    
    .vinted-msg-current-user {
      align-self: flex-end;
      align-items: flex-end;
    }
    
    .vinted-msg-other-user {
      align-self: flex-start;
      align-items: flex-start;
    }
    
    .vinted-msg-body {
      padding: 0.75rem 1rem;
      border-radius: 12px;
      background: #f0f0f0;
      color: #1a1a1a;
      word-wrap: break-word;
    }
    
    .vinted-msg-current-user .vinted-msg-body {
      background: #09B1BA;
      color: white;
    }
    
    .vinted-dark-mode .vinted-msg-other-user .vinted-msg-body {
      background: #2a2a2a;
      color: #e0e0e0;
    }
    
    .vinted-msg-time {
      font-size: 0.75rem;
      color: #999;
      margin-top: 0.25rem;
    }
    
    .vinted-dark-mode .vinted-msg-time {
      color: #666;
    }
    
    .vinted-msg-offer {
      padding: 0.75rem 1rem;
      border-radius: 12px;
      background: #fff3cd;
      border: 1px solid #ffc107;
      color: #856404;
    }
    
    .vinted-msg-offer.accepted {
      background: #d4edda;
      border-color: #28a745;
      color: #155724;
    }
    
    .vinted-msg-current-user .vinted-msg-offer {
      background: #09B1BA;
      border-color: #078a91;
      color: white;
    }
    
    .vinted-msg-current-user .vinted-msg-offer.accepted {
      background: #28a745;
      border-color: #1e7e34;
      color: white;
    }
    
    .vinted-dark-mode .vinted-msg-offer {
      background: #3d2f00;
      border-color: #ffc107;
      color: #ffc107;
    }
    
    .vinted-dark-mode .vinted-msg-offer.accepted {
      background: #1e4620;
      border-color: #28a745;
      color: #28a745;
    }
    
    .vinted-msg-offer-title {
      font-weight: 600;
      margin-bottom: 0.5rem;
      font-size: 0.875rem;
    }
    
    .vinted-msg-offer-price {
      font-size: 1.125rem;
      font-weight: 700;
      margin-bottom: 0.25rem;
    }
    
    .vinted-msg-offer-original {
      font-size: 0.75rem;
      opacity: 0.8;
      text-decoration: line-through;
    }
    
    .vinted-msg-status,
    .vinted-msg-action {
      padding: 0.75rem 1rem;
      border-radius: 12px;
      background: #e9ecef;
      color: #495057;
      text-align: center;
    }
    
    .vinted-dark-mode .vinted-msg-status,
    .vinted-dark-mode .vinted-msg-action {
      background: #2a2a2a;
      color: #e0e0e0;
    }
    
    .vinted-msg-status-title,
    .vinted-msg-action-title {
      font-weight: 600;
      margin-bottom: 0.25rem;
    }
    
    .vinted-msg-status-subtitle,
    .vinted-msg-action-subtitle {
      font-size: 0.875rem;
      opacity: 0.8;
    }
    
    .vinted-msg-actions {
      display: flex;
      gap: 0.5rem;
      margin-top: 0.5rem;
      justify-content: center;
    }
    
    .vinted-msg-action-btn {
      padding: 0.5rem 1rem;
      background: #09B1BA;
      color: white;
      border-radius: 6px;
      text-decoration: none;
      font-size: 0.875rem;
      transition: all 0.2s;
    }
    
    .vinted-msg-action-btn:hover {
      background: #078a91;
    }
    
    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    
    @keyframes slideUp {
      from {
        transform: translateY(20px);
        opacity: 0;
      }
      to {
        transform: translateY(0);
        opacity: 1;
      }
    }
    
    .vinted-offer-modal {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 20000;
      animation: fadeIn 0.2s ease;
    }
    
    .vinted-offer-modal-content {
      background: rgba(255, 255, 255, 0.95) !important;
      background-color: rgba(255, 255, 255, 0.95) !important;
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
      border-radius: 12px;
      width: 90%;
      max-width: 400px;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
      animation: slideUp 0.3s ease;
    }
    
    .vinted-dark-mode .vinted-offer-modal-content {
      background: rgba(30, 30, 30, 0.95) !important;
      background-color: rgba(30, 30, 30, 0.95) !important;
      color: white;
    }
    
    .vinted-offer-modal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 1.5rem;
      border-bottom: 1px solid rgba(0, 0, 0, 0.1);
    }
    
    .vinted-dark-mode .vinted-offer-modal-header {
      border-bottom-color: rgba(255, 255, 255, 0.1);
    }
    
    .vinted-offer-modal-header h3 {
      margin: 0;
      font-size: 1.25rem;
      font-weight: 600;
    }
    
    .vinted-offer-modal-close {
      background: none;
      border: none;
      font-size: 1.5rem;
      cursor: pointer;
      color: #666;
      padding: 0;
      width: 32px;
      height: 32px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 4px;
      transition: all 0.2s;
    }
    
    .vinted-offer-modal-close:hover {
      background: rgba(0, 0, 0, 0.1);
      color: #000;
    }
    
    .vinted-dark-mode .vinted-offer-modal-close {
      color: #aaa;
    }
    
    .vinted-dark-mode .vinted-offer-modal-close:hover {
      background: rgba(255, 255, 255, 0.1);
      color: #fff;
    }
    
    .vinted-offer-modal-body {
      padding: 1.5rem;
    }
    
    .vinted-offer-modal-body label {
      display: block;
      margin-bottom: 0.5rem;
      font-weight: 500;
      font-size: 0.875rem;
    }
    
    .vinted-offer-price-input {
      width: 100%;
      padding: 0.75rem;
      border: 1px solid #ddd;
      border-radius: 8px;
      font-size: 1rem;
      margin-bottom: 1.5rem;
      box-sizing: border-box;
    }
    
    .vinted-offer-price-input:focus {
      outline: none;
      border-color: #09B1BA;
      box-shadow: 0 0 0 3px rgba(9, 177, 186, 0.1);
    }
    
    .vinted-dark-mode .vinted-offer-price-input {
      background: #2a2a2a;
      border-color: #444;
      color: white;
    }
    
    .vinted-offer-modal-actions {
      display: flex;
      gap: 0.75rem;
      justify-content: flex-end;
    }
    
    .vinted-offer-modal-cancel,
    .vinted-offer-modal-submit {
      padding: 0.75rem 1.5rem;
      border: none;
      border-radius: 8px;
      font-size: 0.875rem;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s;
    }
    
    .vinted-offer-modal-cancel {
      background: #f0f0f0;
      color: #333;
    }
    
    .vinted-offer-modal-cancel:hover {
      background: #e0e0e0;
    }
    
    .vinted-dark-mode .vinted-offer-modal-cancel {
      background: #333;
      color: white;
    }
    
    .vinted-dark-mode .vinted-offer-modal-cancel:hover {
      background: #444;
    }
    
    .vinted-offer-modal-submit {
      background: #09B1BA;
      color: white;
    }
    
    .vinted-offer-modal-submit:hover {
      background: #078a91;
    }
    
    .vinted-offer-modal-submit:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
  `;
  
  document.head.appendChild(style);
}

// Ouvrir une modal de conversation complète
async function openConversationModal(conversationId) {
  try {
    // S'assurer que les styles sont injectés
    ensureConversationModalStyles();
    
    // Créer la modal
    let modal = document.createElement('div');
    modal.className = 'vinted-conversation-modal';
    modal.innerHTML = `
      <div class="vinted-conversation-container">
        <div class="vinted-conversation-content">
          <div class="vinted-conversation-loading">Chargement...</div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    
    // Charger la conversation
    const conversation = await fetchConversation(conversationId);
    
    // Déterminer l'ID de l'utilisateur actuel
    const oppositeUserId = conversation.opposite_user.id;
    let currentUserId = oppositeUserId;
    for (const msg of conversation.messages) {
      if (msg.entity_type === 'message' && msg.entity?.user_id && msg.entity.user_id !== oppositeUserId) {
        currentUserId = msg.entity.user_id;
        break;
      }
    }
    
    // Construire le HTML de la conversation
    const conversationUrl = conversation.conversation_url || `https://www.vinted.fr/inbox/${conversationId}`;
    const transaction = conversation.transaction || null;
    // Trier les messages par date (du plus ancien au plus récent)
    const sortedMessages = [...(conversation.messages || [])].sort((a, b) => {
      const dateA = a.created_at_ts ? new Date(a.created_at_ts).getTime() : 0;
      const dateB = b.created_at_ts ? new Date(b.created_at_ts).getTime() : 0;
      return dateA - dateB;
    });
    
    const messagesHtml = sortedMessages.map(msg => formatMessage(msg, currentUserId, conversationUrl, transaction)).join('');
    
    // Vérifier si une transaction existe pour afficher le bouton d'offre
    const hasTransaction = transaction && transaction.id;
    const offerButtonHtml = hasTransaction ? `
      <button class="vinted-notif-offer-btn" aria-label="Faire une offre">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="12" y1="1" x2="12" y2="23"></line>
          <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
        </svg>
        Faire une offre
      </button>
    ` : '';
    
    const modalContent = modal.querySelector('.vinted-conversation-content');
    modalContent.innerHTML = `
      <div class="vinted-conversation-header">
        <div class="vinted-conversation-user">
          <img src="${conversation.opposite_user.photo?.thumbnails?.find(t => t.type === "thumb100")?.url || conversation.opposite_user.photo?.url || 'https://via.placeholder.com/50'}" 
               alt="${escapeHtml(conversation.opposite_user.login)}"
               class="vinted-conversation-avatar">
          <div class="vinted-conversation-user-info">
            <div class="vinted-conversation-username">${escapeHtml(conversation.opposite_user.login)}</div>
            ${conversation.subtitle ? `<div class="vinted-conversation-subtitle">${escapeHtml(conversation.subtitle)}</div>` : ''}
          </div>
        </div>
        <button class="vinted-conversation-close" aria-label="Fermer">×</button>
      </div>
      <div class="vinted-conversation-messages">
        <div class="vinted-notif-messages-content">
          ${messagesHtml}
        </div>
        ${offerButtonHtml}
      </div>
      <div class="vinted-offer-form-container" style="display: none;">
        <div class="vinted-offer-form-header">
          <h3>Faire une offre</h3>
          <button class="vinted-offer-form-close" aria-label="Fermer">×</button>
        </div>
        <div class="vinted-offer-form-body">
          <label for="vinted-offer-price">Prix (EUR)</label>
          <input type="number" 
                 id="vinted-offer-price" 
                 class="vinted-offer-price-input" 
                 placeholder="0.00" 
                 step="0.01" 
                 min="0.01"
                 required>
          <div class="vinted-offer-form-actions">
            <button class="vinted-offer-form-cancel">Annuler</button>
            <button class="vinted-offer-form-submit">Envoyer l'offre</button>
          </div>
        </div>
      </div>
      <div class="vinted-notif-messages-input-container">
        <input type="text" 
               class="vinted-notif-messages-input" 
               placeholder="Tapez votre message..."
               maxlength="1000">
        <button class="vinted-notif-messages-send" aria-label="Envoyer">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="22" y1="2" x2="11" y2="13"></line>
            <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
          </svg>
        </button>
      </div>
      <div class="vinted-conversation-footer">
        <a href="${conversation.conversation_url}" target="_blank" class="vinted-conversation-link">
          Ouvrir sur Vinted →
        </a>
      </div>
    `;
    
    let messagesContainer = modal.querySelector('.vinted-conversation-messages');
    let input = modal.querySelector('.vinted-notif-messages-input');
    let sendBtn = modal.querySelector('.vinted-notif-messages-send');
    
    // Gestionnaire d'envoi de message
    const handleSend = async () => {
      const messageText = input.value.trim();
      if (!messageText) return;
      
      input.disabled = true;
      sendBtn.disabled = true;
      sendBtn.style.opacity = '0.5';
      
      try {
        await sendMessage(conversationId, messageText);
        input.value = '';
        
        // Recharger la conversation
        const updatedConversation = await fetchConversation(conversationId);
        const oppositeUserId = updatedConversation.opposite_user.id;
        let currentUserId = oppositeUserId;
        for (const msg of updatedConversation.messages) {
          if (msg.entity_type === 'message' && msg.entity?.user_id && msg.entity.user_id !== oppositeUserId) {
            currentUserId = msg.entity.user_id;
            break;
          }
        }
        
        const updatedMessagesHtml = updatedConversation.messages.map(msg => 
          formatMessage(msg, currentUserId, conversationUrl, transaction)
        ).join('');
        
        const messagesContent = messagesContainer.querySelector('.vinted-notif-messages-content');
        messagesContent.innerHTML = updatedMessagesHtml;
        
        setTimeout(() => {
          messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }, 100);
      } catch (error) {
        console.error("[Messages] Erreur lors de l'envoi:", error);
        alert("Erreur lors de l'envoi du message. Veuillez réessayer.");
      } finally {
        input.disabled = false;
        sendBtn.disabled = false;
        sendBtn.style.opacity = '1';
        input.focus();
      }
    };
    
    sendBtn.addEventListener('click', handleSend);
    const inputKeyHandler = (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    };
    input.addEventListener('keypress', inputKeyHandler);
    
    // Gestionnaire pour le bouton d'offre
    if (hasTransaction) {
      const offerBtn = modal.querySelector('.vinted-notif-offer-btn');
      const offerFormContainer = modal.querySelector('.vinted-offer-form-container');
      const offerFormClose = modal.querySelector('.vinted-offer-form-close');
      const offerFormCancel = modal.querySelector('.vinted-offer-form-cancel');
      const messageInputContainer = modal.querySelector('.vinted-notif-messages-input-container');
      
      if (offerBtn) {
        offerBtn.addEventListener('click', () => {
          // Afficher le formulaire d'offre et masquer l'input de message
          offerFormContainer.style.display = 'block';
          messageInputContainer.style.display = 'none';
          const priceInput = modal.querySelector('#vinted-offer-price');
          setTimeout(() => priceInput?.focus(), 100);
        });
      }
      
      // Fermer le formulaire d'offre
      if (offerFormClose) {
        offerFormClose.addEventListener('click', () => {
          offerFormContainer.style.display = 'none';
          messageInputContainer.style.display = 'flex';
        });
      }
      
      if (offerFormCancel) {
        offerFormCancel.addEventListener('click', () => {
          offerFormContainer.style.display = 'none';
          messageInputContainer.style.display = 'flex';
        });
      }
      
      // Gestionnaire pour soumettre l'offre
      const offerFormSubmit = modal.querySelector('.vinted-offer-form-submit');
      if (offerFormSubmit) {
        offerFormSubmit.addEventListener('click', async () => {
          const priceInput = modal.querySelector('#vinted-offer-price');
          const price = priceInput.value.trim();
          
          if (!price || parseFloat(price) <= 0) {
            alert('Veuillez entrer un prix valide');
            return;
          }
          
          offerFormSubmit.disabled = true;
          offerFormSubmit.textContent = 'Envoi...';
          
          try {
            await sendOfferRequest(transaction.id, price, 'EUR');
            
            // Recharger la conversation
            const updatedConversation = await fetchConversation(conversationId);
            const oppositeUserId = updatedConversation.opposite_user.id;
            let currentUserId = oppositeUserId;
            for (const msg of updatedConversation.messages) {
              if (msg.entity_type === 'message' && msg.entity?.user_id && msg.entity.user_id !== oppositeUserId) {
                currentUserId = msg.entity.user_id;
                break;
              }
            }
            
            const conversationUrl = updatedConversation.conversation_url || `https://www.vinted.fr/inbox/${conversationId}`;
            const updatedTransaction = updatedConversation.transaction || transaction;
            const updatedMessagesHtml = updatedConversation.messages.map(msg => 
              formatMessage(msg, currentUserId, conversationUrl, updatedTransaction)
            ).join('');
            
            const messagesContent = messagesContainer.querySelector('.vinted-notif-messages-content');
            messagesContent.innerHTML = updatedMessagesHtml;
            
            // Masquer le formulaire et réafficher l'input de message
            offerFormContainer.style.display = 'none';
            messageInputContainer.style.display = 'flex';
            priceInput.value = '';
            
            setTimeout(() => {
              messagesContainer.scrollTop = messagesContainer.scrollHeight;
            }, 100);
          } catch (error) {
            console.error("[Messages] Erreur lors de l'envoi de l'offre:", error);
            alert("Erreur lors de l'envoi de l'offre. Veuillez réessayer.");
            offerFormSubmit.disabled = false;
            offerFormSubmit.textContent = 'Envoyer l\'offre';
          }
        });
      }
      
      // Permettre d'envoyer l'offre avec Enter
      const priceInput = modal.querySelector('#vinted-offer-price');
      if (priceInput) {
        priceInput.addEventListener('keypress', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            offerFormSubmit?.click();
          }
        });
      }
    }
    
    // Gestionnaire pour fermer la modal
    const closeBtn = modal.querySelector('.vinted-conversation-close');
    let isClosing = false;
    const closeModal = () => {
      if (isClosing) return;
      isClosing = true;
      
      // Nettoyer immédiatement les event listeners et références
      document.removeEventListener('keydown', escapeHandler);
      sendBtn.removeEventListener('click', handleSend);
      input.removeEventListener('keypress', inputKeyHandler);
      
      // Nettoyer le contenu pour libérer la mémoire
      const messagesContent = messagesContainer?.querySelector('.vinted-notif-messages-content');
      if (messagesContent) messagesContent.innerHTML = '';
      
      modal.style.opacity = '0';
      setTimeout(() => {
        modal.remove();
        // Forcer le garbage collection en vidant les références
        modal = null;
        messagesContainer = null;
        input = null;
        sendBtn = null;
      }, 100); // Réduire le délai pour libérer plus rapidement
    };
    
    closeBtn.addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeModal();
      }
    });
    
    // Fermer avec Escape
    const escapeHandler = (e) => {
      if (e.key === 'Escape') {
        closeModal();
      }
    };
    document.addEventListener('keydown', escapeHandler);
    
    // Faire défiler vers le bas et focus sur l'input
    setTimeout(() => {
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
      input.focus();
    }, 100);
    
  } catch (error) {
    console.error("[Messages] Erreur lors de l'affichage de la conversation:", error);
    alert("Erreur lors du chargement de la conversation. Veuillez réessayer.");
  }
}

// Fonction showOfferDialog supprimée - le formulaire d'offre est maintenant intégré dans la modal de conversation