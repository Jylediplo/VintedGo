// Gestion de l'API des messages Vinted

/**
 * Récupère les messages depuis l'API Vinted
 * @param {number} page - Numéro de page
 * @param {number} perPage - Nombre de messages par page
 * @returns {Promise<Object>} - Données des conversations
 */
export async function fetchInbox(page = 1, perPage = 20) {
  const url = `https://www.vinted.fr/api/v2/inbox?page=${page}&per_page=${perPage}`;
  
  try {
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
    console.error("[Vinted Messages] Erreur lors de la récupération des messages:", error);
    throw error;
  }
}

/**
 * Filtre les conversations non lues
 * @param {Array} conversations - Liste des conversations
 * @returns {Array} - Conversations non lues
 */
export function getUnreadConversations(conversations) {
  return conversations.filter(conv => conv.unread === true);
}

/**
 * Extrait les informations essentielles d'une conversation
 * @param {Object} conversation - Objet conversation
 * @returns {Object} - Informations formatées
 */
export function formatConversationInfo(conversation) {
  return {
    id: conversation.id,
    description: conversation.description,
    unread: conversation.unread,
    updated_at: conversation.updated_at,
    opposite_user: {
      id: conversation.opposite_user.id,
      login: conversation.opposite_user.login,
      photo_url: conversation.opposite_user.photo?.thumbnails?.find(t => t.type === "thumb100")?.url || 
                 conversation.opposite_user.photo?.url
    },
    item_photo: conversation.item_photos?.[0]?.thumbnails?.find(t => t.type === "thumb70x100")?.url || 
                conversation.item_photos?.[0]?.url,
    conversation_url: `https://www.vinted.fr/inbox/${conversation.id}`
  };
}

/**
 * Récupère une conversation spécifique depuis l'API Vinted
 * @param {string|number} conversationId - ID de la conversation
 * @returns {Promise<Object>} - Données de la conversation
 */
export async function fetchConversation(conversationId, page = 1, perPage = 50) {
  // Essayer d'abord avec la pagination pour récupérer plus de messages
  const url = `https://www.vinted.fr/api/v2/conversations/${conversationId}?page=${page}&per_page=${perPage}`;
  
  try {
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
    const conversation = data.conversation || data;
    
    // Si on a récupéré des messages et qu'il y en a plus, essayer de récupérer la page suivante
    if (conversation.messages && conversation.messages.length === perPage) {
      console.log(`[Vinted Messages] ${conversation.messages.length} messages récupérés, tentative de récupérer plus...`);
      try {
        const nextPageResponse = await fetch(`${url}&page=${page + 1}`, {
          credentials: "include",
          headers: {
            "accept": "application/json, text/plain, */*",
            "accept-language": "fr",
            "sec-fetch-dest": "empty",
            "sec-fetch-mode": "cors",
            "sec-fetch-site": "same-origin",
          },
        });
        
        if (nextPageResponse.ok) {
          const nextPageData = await nextPageResponse.json();
          const nextPageConversation = nextPageData.conversation || nextPageData;
          if (nextPageConversation.messages && nextPageConversation.messages.length > 0) {
            // Fusionner les messages (les plus récents en premier dans l'API)
            conversation.messages = [...(nextPageConversation.messages || []), ...conversation.messages];
            console.log(`[Vinted Messages] Total de ${conversation.messages.length} messages récupérés`);
          }
        }
      } catch (e) {
        // Ignorer les erreurs de pagination
        console.log(`[Vinted Messages] Pas de messages supplémentaires disponibles`);
      }
    }
    
    return conversation;
  } catch (error) {
    console.error("[Vinted Messages] Erreur lors de la récupération de la conversation:", error);
    throw error;
  }
}

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
    if (typeof url === 'string' && url.includes('vinted.fr/api') && options.headers) {
      // Vérifier différents formats de headers
      let csrfToken = null;
      
      if (options.headers instanceof Headers) {
        csrfToken = options.headers.get('x-csrf-token') || options.headers.get('X-CSRF-Token');
      } else if (typeof options.headers === 'object') {
        csrfToken = options.headers['x-csrf-token'] || 
                   options.headers['X-CSRF-Token'] ||
                   options.headers['X-Csrf-Token'];
      }
      
      if (csrfToken) {
        cachedCsrfToken = csrfToken;
        csrfTokenCacheTime = Date.now();
      }
    }
    
    // Intercepter aussi les réponses de scripts JavaScript pour chercher CSRF_TOKEN
    if (typeof url === 'string' && (url.includes('.js') || url.includes('chunks'))) {
      const promise = originalFetch.apply(this, args);
      promise.then(async response => {
        if (response.ok) {
          try {
            const text = await response.clone().text();
            // Chercher CSRF_TOKEN dans le contenu du script
            const patterns = [
              /CSRF_TOKEN["\s:=]+["']([a-f0-9-]{36,})["']/i,
              /csrf[_-]?token["\s:=]+["']([a-f0-9-]{36,})["']/i
            ];
            
            for (const pattern of patterns) {
              const match = text.match(pattern);
              if (match && match[1] && match[1].length > 20 && !cachedCsrfToken) {
                cachedCsrfToken = match[1];
                csrfTokenCacheTime = Date.now();
                break;
              }
            }
          } catch (e) {
            // Ignorer les erreurs de lecture
          }
        }
      }).catch(() => {});
      return promise;
    }
    
    return originalFetch.apply(this, args);
  };
  
  // Intercepter aussi XMLHttpRequest
  if (window.XMLHttpRequest) {
    const originalOpen = XMLHttpRequest.prototype.open;
    const originalSetRequestHeader = XMLHttpRequest.prototype.setRequestHeader;
    
    XMLHttpRequest.prototype.setRequestHeader = function(header, value) {
      if (header.toLowerCase() === 'x-csrf-token' && value) {
        cachedCsrfToken = value;
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

// Initialiser l'interception au chargement
if (typeof window !== 'undefined') {
  interceptFetchForCsrfToken();
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

/**
 * Envoie un message dans une conversation
 * @param {string|number} conversationId - ID de la conversation
 * @param {string} messageBody - Corps du message
 * @returns {Promise<Object>} - Réponse de l'API
 */
export async function sendMessage(conversationId, messageBody) {
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
    // Récupérer le cookie DataDome si disponible
    const getCookie = (name) => {
      const cookies = document.cookie.split(';');
      for (const cookie of cookies) {
        const [cookieName, value] = cookie.trim().split('=');
        if (cookieName === name) {
          return decodeURIComponent(value);
        }
      }
      return null;
    };
    
    const headers = {
      "content-type": "application/json",
      "x-csrf-token": csrfToken,
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
 * Envoie une demande d'offre pour une transaction
 * @param {string|number} transactionId - ID de la transaction
 * @param {string} price - Prix de l'offre
 * @param {string} currency - Devise (par défaut: EUR)
 * @returns {Promise<Object>} - Réponse de l'API
 */
export async function sendOfferRequest(transactionId, price, currency = "EUR") {
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
  
  const payload = {
    offer_request: {
      price: price.toString(),
      currency: currency
    }
  };
  
  const headers = {
    "content-type": "application/json",
    "x-csrf-token": csrfToken,
  };
  
  if (anonId) {
    headers["x-anon-id"] = anonId;
  }
  
  const fetchOptions = {
    method: "POST",
    credentials: "include",
    headers: headers,
    body: JSON.stringify(payload),
    mode: "cors",
    cache: "no-cache",
  };
  
  try {
    const response = await fetch(url, fetchOptions);
    
    if (!response.ok) {
      let errorData;
      try {
        errorData = await response.json();
      } catch (e) {
        errorData = { message: await response.text() };
      }
      
      if (response.status === 403 || (errorData.code === 106)) {
        cachedCsrfToken = null;
        csrfTokenCacheTime = 0;
        const newToken = await tryGetCsrfTokenFromPage();
        if (newToken) {
          cachedCsrfToken = newToken;
          csrfTokenCacheTime = Date.now();
          headers["x-csrf-token"] = newToken;
          const retryResponse = await fetch(url, fetchOptions);
          if (!retryResponse.ok) {
            throw new Error(`HTTP ${retryResponse.status}: ${JSON.stringify(await retryResponse.json())}`);
          }
          return await retryResponse.json();
        }
      }
      
      throw new Error(`HTTP ${response.status}: ${JSON.stringify(errorData)}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error("[Vinted Messages] Erreur lors de l'envoi de l'offre:", error);
    throw error;
  }
}

/**
 * Récupère les détails d'un produit depuis la page Vinted
 * @param {string|number} itemId - ID du produit
 * @param {string} itemSlug - Nom/slug du produit (optionnel)
 * @returns {Promise<Object>} - Données du produit
 */
/**
 * Crée une conversation pour un item
 * @param {string|number} itemId - ID du produit
 * @param {string|number} userId - ID du vendeur (opposite_user_id)
 * @param {string} messageBody - Corps du message (optionnel, pour envoyer un message après création)
 * @param {Object} item - Données du produit (optionnel)
 * @returns {Promise<Object>} - Données de la conversation créée avec l'ID
 */
export async function createConversationForItem(itemId, userId, messageBody, item) {
  // Utiliser la nouvelle API pour créer une conversation
  const url = `https://www.vinted.fr/api/v2/conversations`;
  
  let csrfToken = await getCsrfToken();
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
  
  // Payload selon la nouvelle API
  const payload = {
    initiator: "ask_seller",
    item_id: String(itemId),
    opposite_user_id: String(userId)
  };
  
  const headers = {
    "content-type": "application/json",
    "x-csrf-token": csrfToken,
    "accept": "application/json, text/plain, */*",
  };
  
  const anonId = getAnonId();
  if (anonId) {
    headers["x-anon-id"] = anonId;
  }
  
  try {
    const response = await fetch(url, {
      method: "POST",
      credentials: "include",
      headers: headers,
      body: JSON.stringify(payload),
      mode: "cors",
      cache: "no-cache",
    });
    
    if (!response.ok) {
      let errorData;
      try {
        errorData = await response.json();
      } catch (e) {
        errorData = { message: await response.text() };
      }
      
      if (response.status === 403 || (errorData.code === 106)) {
        cachedCsrfToken = null;
        csrfTokenCacheTime = 0;
        const newToken = await tryGetCsrfTokenFromPage();
        if (newToken) {
          cachedCsrfToken = newToken;
          csrfTokenCacheTime = Date.now();
          headers["x-csrf-token"] = newToken;
          const retryResponse = await fetch(url, {
            method: "POST",
            credentials: "include",
            headers: headers,
            body: JSON.stringify(payload),
          });
          if (!retryResponse.ok) {
            throw new Error(`HTTP ${retryResponse.status}: ${JSON.stringify(await retryResponse.json())}`);
          }
          const retryData = await retryResponse.json();
          const conversation = retryData.conversation || retryData;
          
          // Si un message est fourni, l'envoyer après la création de la conversation
          if (messageBody && conversation.id) {
            try {
              await sendMessage(conversation.id, messageBody);
            } catch (msgError) {
              console.warn("[Vinted Messages] Conversation créée mais échec de l'envoi du message initial:", msgError);
            }
          }
          
          return conversation;
        }
      }
      
      throw new Error(`HTTP ${response.status}: ${JSON.stringify(errorData)}`);
    }
    
    const data = await response.json();
    console.log("[Vinted Messages] Réponse de création de conversation:", data);
    const conversation = data.conversation || data;
    console.log("[Vinted Messages] Conversation extraite:", conversation);
    
    if (!conversation || !conversation.id) {
      console.error("[Vinted Messages] La conversation créée n'a pas d'ID:", conversation);
      throw new Error("La conversation créée n'a pas d'ID valide");
    }
    
    // Si un message est fourni, l'envoyer après la création de la conversation
    if (messageBody && conversation.id) {
      try {
        await sendMessage(conversation.id, messageBody);
        console.log("[Vinted Messages] Message initial envoyé avec succès");
      } catch (msgError) {
        console.warn("[Vinted Messages] Conversation créée mais échec de l'envoi du message initial:", msgError);
      }
    }
    
    return conversation;
  } catch (error) {
    console.error("[Vinted Messages] Erreur lors de la création de la conversation:", error);
    throw error;
  }
}

/**
 * Crée une transaction pour un item afin de pouvoir faire une offre
 * @param {string|number} itemId - ID du produit
 * @param {number} price - Prix proposé
 * @returns {Promise<Object>} - Données de la transaction créée
 */
export async function createTransactionForItem(itemId, price) {
  // Utiliser l'API de transaction de Vinted
  const url = `https://www.vinted.fr/api/v2/items/${itemId}/transactions`;
  
  let csrfToken = await getCsrfToken();
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
  
  const payload = {
    transaction: {
      price: price.toString(),
      currency: "EUR"
    }
  };
  
  const headers = {
    "content-type": "application/json",
    "x-csrf-token": csrfToken,
    "accept": "application/json, text/plain, */*",
  };
  
  const anonId = getAnonId();
  if (anonId) {
    headers["x-anon-id"] = anonId;
  }
  
  try {
    const response = await fetch(url, {
      method: "POST",
      credentials: "include",
      headers: headers,
      body: JSON.stringify(payload),
      mode: "cors",
      cache: "no-cache",
    });
    
    if (!response.ok) {
      let errorData;
      try {
        errorData = await response.json();
      } catch (e) {
        errorData = { message: await response.text() };
      }
      
      if (response.status === 403 || (errorData.code === 106)) {
        cachedCsrfToken = null;
        csrfTokenCacheTime = 0;
        const newToken = await tryGetCsrfTokenFromPage();
        if (newToken) {
          cachedCsrfToken = newToken;
          csrfTokenCacheTime = Date.now();
          headers["x-csrf-token"] = newToken;
          const retryResponse = await fetch(url, {
            method: "POST",
            credentials: "include",
            headers: headers,
            body: JSON.stringify(payload),
          });
          if (!retryResponse.ok) {
            throw new Error(`HTTP ${retryResponse.status}: ${JSON.stringify(await retryResponse.json())}`);
          }
          return await retryResponse.json();
        }
      }
      
      throw new Error(`HTTP ${response.status}: ${JSON.stringify(errorData)}`);
    }
    
    const data = await response.json();
    return data.transaction || data;
  } catch (error) {
    console.error("[Vinted Messages] Erreur lors de la création de la transaction:", error);
    throw error;
  }
}

export async function fetchItemDetails(itemId, itemSlug = '') {
  console.log(`[Vinted Item] Début de la récupération des détails pour l'item ${itemId}${itemSlug ? ` (slug: ${itemSlug})` : ''}`);
  
  // Construire l'URL de la page avec l'ID et le slug si disponible
  const url = itemSlug 
    ? `https://www.vinted.fr/items/${itemId}-${itemSlug}`
    : `https://www.vinted.fr/items/${itemId}`;
  
  console.log(`[Vinted Item] URL de la requête: ${url}`);
  
  try {
    console.log(`[Vinted Item] Envoi de la requête HTTP...`);
    const response = await fetch(url, {
      credentials: "include",
      headers: {
        "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "accept-language": "fr",
        "sec-fetch-dest": "document",
        "sec-fetch-mode": "navigate",
        "sec-fetch-site": "same-origin",
      },
    });

    console.log(`[Vinted Item] Réponse reçue - Status: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    console.log(`[Vinted Item] Récupération du HTML...`);
    const html = await response.text();
    console.log(`[Vinted Item] HTML récupéré - Taille: ${(html.length / 1024).toFixed(2)} KB`);
    
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    console.log(`[Vinted Item] HTML parsé en DOM`);
    
    // Initialiser l'objet item
    const itemData = {
      id: parseInt(itemId),
      title: '',
      description: '',
      price: null,
      currency: 'EUR',
      size: null,
      size_title: null,
      condition: null,
      condition_title: null,
      brand: null,
      brand_title: null,
      color: null,
      photos: [],
      user: null,
      status: null,
      is_sold: false
    };
    
    // Extraire les informations depuis le DOM de la page
    console.log(`[Vinted Item] Extraction depuis le DOM de la page...`);
    
    // Titre depuis data-testid="item-page-summary-plugin"
    const summaryPlugin = doc.querySelector('[data-testid="item-page-summary-plugin"]');
    if (summaryPlugin) {
      const titleElement = summaryPlugin.querySelector('h1.web_ui__Text__title');
      if (titleElement && !itemData.title) {
        itemData.title = titleElement.textContent?.trim() || '';
        console.log(`[Vinted Item] ✓ Titre extrait depuis DOM: "${itemData.title}"`);
      }
      
      // Taille, État, Marque depuis les spans dans summaryPlugin
      // La structure est : [Taille] · [État] · [Marque (lien)]
      const summarySpans = summaryPlugin.querySelectorAll('span.web_ui__Text__body');
      const summaryTexts = [];
      
      // Parcourir les spans et extraire les textes (en excluant les séparateurs "·")
      for (const span of summarySpans) {
        const text = span.textContent?.trim();
        // Ignorer les séparateurs "·" et les espaces vides
        if (text && text !== '·' && text.length > 0) {
          summaryTexts.push({ text, element: span });
        }
      }
      
      // La taille est généralement le premier élément qui n'est pas dans un lien et qui n'est pas l'état
      // Format possible : "W31 | FR 40", "XL", "42", etc.
      for (const { text, element } of summaryTexts) {
        // Ignorer si c'est dans un lien (c'est la marque)
        if (element.closest('a')) {
          continue;
        }
        
        // Ignorer si c'est l'état (contient "état", "neuf", "bon", etc.)
        if (/état|neuf|bon|moyen|satisfaisant/i.test(text)) {
          continue;
        }
        
        // Si ce n'est ni un lien ni l'état, c'est probablement la taille
        if (!itemData.size_title) {
          itemData.size_title = text;
          itemData.size = { title: text, localized_title: text };
          console.log(`[Vinted Item] ✓ Taille extraite depuis DOM: "${text}"`);
          break;
        }
      }
      
      // Chercher l'état (généralement contient "état" ou des valeurs comme "Neuf", "Très bon état", etc.)
      for (const { text, element } of summaryTexts) {
        // Ignorer si c'est dans un lien
        if (element.closest('a')) {
          continue;
        }
        
        if (/état|neuf|bon|moyen|satisfaisant/i.test(text) && !itemData.condition_title) {
          itemData.condition_title = text;
          itemData.condition = { title: text, translated_title: text };
          console.log(`[Vinted Item] ✓ État extrait depuis DOM: "${text}"`);
          break;
        }
      }
      
      // Marque depuis le lien <a>
      const brandLink = summaryPlugin.querySelector('a[href*="/brand/"]');
      if (brandLink) {
        const brandText = brandLink.textContent?.trim();
        if (brandText && !itemData.brand_title) {
          itemData.brand_title = brandText;
          // Extraire l'ID de la marque depuis l'URL
          const brandHref = brandLink.getAttribute('href');
          const brandIdMatch = brandHref?.match(/\/brand\/(\d+)-/);
          if (brandIdMatch) {
            itemData.brand = {
              id: parseInt(brandIdMatch[1]),
              title: brandText,
              name: brandText
            };
          } else {
            itemData.brand = {
              title: brandText,
              name: brandText
            };
          }
          console.log(`[Vinted Item] ✓ Marque extraite depuis DOM: "${brandText}"`);
        }
      }
    }
    
    // Prix depuis data-testid="item-price"
    const priceContainer = doc.querySelector('[data-testid="item-price"]');
    if (priceContainer) {
      const priceElement = priceContainer.querySelector('p.web_ui__Text__subtitle');
      if (priceElement) {
        const priceText = priceElement.textContent?.trim();
        // Extraire le montant (ex: "18,00 €")
        const priceMatch = priceText?.match(/([\d\s,]+)\s*([€$£]|EUR|USD|GBP)/);
        if (priceMatch) {
          const amount = priceMatch[1].replace(/\s/g, '').replace(',', '.');
          const currency = priceMatch[2] === '€' ? 'EUR' : (priceMatch[2] || 'EUR');
          if (!itemData.price) {
            itemData.price = {
              amount: amount,
              currency_code: currency
            };
            itemData.currency = currency;
            console.log(`[Vinted Item] ✓ Prix extrait depuis DOM: ${amount} ${currency}`);
          }
        }
      }
    }
    
    // Prix avec protection depuis le button avec aria-label
    const priceWithProtectionButton = doc.querySelector('button[aria-label*="Protection acheteurs incluse"]');
    if (priceWithProtectionButton) {
      const priceWithProtectionText = priceWithProtectionButton.querySelector('.web_ui__Text__title')?.textContent?.trim();
      if (priceWithProtectionText) {
        const priceMatch = priceWithProtectionText.match(/([\d\s,]+)\s*([€$£]|EUR|USD|GBP)/);
        if (priceMatch) {
          const amount = priceMatch[1].replace(/\s/g, '').replace(',', '.');
          itemData.price_with_protection = {
            amount: amount,
            currency_code: itemData.currency || 'EUR'
          };
          console.log(`[Vinted Item] ✓ Prix avec protection extrait depuis DOM: ${amount} ${itemData.currency || 'EUR'}`);
        }
      }
    }
    
    // Prix avec frais depuis le sélecteur spécifique
    const priceWithFeesElement = doc.querySelector('.web_ui__Text__text.web_ui__Text__title.web_ui__Text__left.web_ui__Text__clickable.web_ui__Text__underline-none');
    if (priceWithFeesElement) {
      const priceWithFeesText = priceWithFeesElement.textContent?.trim();
      if (priceWithFeesText) {
        const priceMatch = priceWithFeesText.match(/([\d\s,]+)\s*([€$£]|EUR|USD|GBP)/);
        if (priceMatch) {
          const amount = priceMatch[1].replace(/\s/g, '').replace(',', '.');
          itemData.price_with_fees = {
            amount: amount,
            currency_code: itemData.currency || 'EUR',
            formatted: priceWithFeesText
          };
          console.log(`[Vinted Item] ✓ Prix avec frais extrait depuis DOM: ${priceWithFeesText}`);
        }
      }
    }
    
    // Récupérer les scripts une seule fois pour toutes les extractions
    const scripts = doc.querySelectorAll('script');
    
    // Informations du vendeur depuis le DOM
    const profileUsername = doc.querySelector('[data-testid="profile-username"]');
    if (profileUsername) {
      const username = profileUsername.textContent?.trim();
      if (username) {
        if (!itemData.user) {
          itemData.user = {};
        }
        itemData.user.login = username;
        itemData.user.username = username;
        console.log(`[Vinted Item] ✓ Nom d'utilisateur vendeur extrait depuis DOM: "${username}"`);
      }
    }
    
    // Essayer d'extraire l'ID du vendeur depuis le lien du profil
    if (!itemData.user?.id) {
      const profileLink = doc.querySelector('a[href*="/members/"]');
      if (profileLink) {
        const href = profileLink.getAttribute('href');
        const memberMatch = href.match(/\/members\/(\d+)/);
        if (memberMatch) {
          if (!itemData.user) {
            itemData.user = {};
          }
          itemData.user.id = parseInt(memberMatch[1]);
          console.log(`[Vinted Item] ✓ ID vendeur extrait depuis lien profil: ${itemData.user.id}`);
        }
      }
    }
    
    // Essayer d'extraire depuis les scripts avec d'autres patterns
    if (!itemData.user?.id) {
      for (const script of scripts) {
        const content = script.textContent || script.innerHTML;
        // Chercher "user_id" ou "seller_id" dans les scripts
        const userIdMatch = content.match(/(?:user_id|seller_id)["\s:]+(\d+)/);
        if (userIdMatch) {
          if (!itemData.user) {
            itemData.user = {};
          }
          itemData.user.id = parseInt(userIdMatch[1]);
          console.log(`[Vinted Item] ✓ ID vendeur extrait depuis scripts: ${itemData.user.id}`);
          break;
        }
      }
    }
    
    // Note du vendeur depuis aria-label du rating
    const ratingElement = doc.querySelector('.web_ui__Rating__rating[aria-label]');
    if (ratingElement) {
      const ariaLabel = ratingElement.getAttribute('aria-label');
      if (ariaLabel) {
        // Extraire la note depuis "Le membre est noté 5 sur 5"
        const ratingMatch = ariaLabel.match(/(\d+)\s+sur\s+(\d+)/i);
        if (ratingMatch) {
          const rating = parseFloat(ratingMatch[1]);
          const maxRating = parseFloat(ratingMatch[2]);
          if (!itemData.user) {
            itemData.user = {};
          }
          itemData.user.rating = rating;
          itemData.user.max_rating = maxRating;
          console.log(`[Vinted Item] ✓ Note vendeur extraite depuis DOM: ${rating}/${maxRating}`);
        }
      }
      
      // Nombre d'avis depuis .web_ui__Rating__label
      const ratingLabel = ratingElement.querySelector('.web_ui__Rating__label span');
      if (ratingLabel) {
        const reviewCountText = ratingLabel.textContent?.trim();
        if (reviewCountText) {
          const reviewCount = parseInt(reviewCountText);
          if (!isNaN(reviewCount)) {
            if (!itemData.user) {
              itemData.user = {};
            }
            itemData.user.review_count = reviewCount;
            console.log(`[Vinted Item] ✓ Nombre d'avis vendeur extrait depuis DOM: ${reviewCount}`);
          }
        }
      }
    }
    
    // 1. Extraire depuis __next_f.push avec la clé "15:"
    // Cette clé contient les plugins et l'objet item complet
    console.log(`[Vinted Item] Recherche de la section "15:[" dans les scripts...`);
    console.log(`[Vinted Item] Nombre de scripts trouvés: ${scripts.length}`);
    
    let section15Found = false;
    for (const script of scripts) {
      const content = script.textContent || script.innerHTML;
      
      // Chercher la ligne avec "15:[" qui contient les plugins et l'item
      if (content.includes('__next_f.push') && content.includes('"15:[')) {
        console.log(`[Vinted Item] Script avec __next_f.push et "15:[" trouvé`);
        try {
          // Extraire toute la section "15:[" jusqu'à la fin
          const match15 = content.match(/"15:\[([^\]]+)\]/);
          if (!match15) {
            console.log(`[Vinted Item] Pattern "15:[" non trouvé dans ce script`);
            continue;
          }
          
          console.log(`[Vinted Item] Section "15:[" trouvée - Taille: ${match15[0].length} caractères`);
          section15Found = true;
          const section15 = match15[0];
          
          // Extraire depuis plugins - chercher dans toute la section
          console.log(`[Vinted Item] Extraction des données depuis la section "15:["...`);
          
          // Titre depuis summary plugin
          const summaryTitleMatch = section15.match(/\{"name":"summary"[^}]*"value":"([^"]+)"[^}]*"style":"title"/);
          if (summaryTitleMatch && !itemData.title) {
            itemData.title = summaryTitleMatch[1];
            console.log(`[Vinted Item] ✓ Titre extrait depuis summary plugin: "${itemData.title.substring(0, 50)}..."`);
          }
          
          // Taille depuis attributes plugin
          const sizeAttrMatch = section15.match(/\{"type":"faq","code":"size"[^}]*"value":"([^"]+)"/);
          if (sizeAttrMatch) {
            itemData.size_title = sizeAttrMatch[1];
            itemData.size = { title: sizeAttrMatch[1], localized_title: sizeAttrMatch[1] };
            console.log(`[Vinted Item] ✓ Taille extraite: ${itemData.size_title}`);
          }
          
          // État depuis attributes plugin
          const statusAttrMatch = section15.match(/\{"type":"faq","code":"status"[^}]*"value":"([^"]+)"/);
          if (statusAttrMatch) {
            itemData.condition_title = statusAttrMatch[1];
            itemData.condition = { title: statusAttrMatch[1], translated_title: statusAttrMatch[1] };
            console.log(`[Vinted Item] ✓ État extrait: ${itemData.condition_title}`);
          }
          
          // Couleur depuis attributes plugin
          const colorAttrMatch = section15.match(/\{"type":"text","code":"color"[^}]*"value":"([^"]+)"/);
          if (colorAttrMatch) {
            itemData.color = colorAttrMatch[1];
            console.log(`[Vinted Item] ✓ Couleur extraite: ${itemData.color}`);
          }
          
          // Marque depuis attributes plugin
          const brandAttrMatch = section15.match(/\{"type":"favouritable","code":"brand"[^}]*"value":"([^"]+)"[^}]*"id":(\d+)/);
          if (brandAttrMatch) {
            itemData.brand = {
              id: parseInt(brandAttrMatch[2]),
              title: brandAttrMatch[1],
              name: brandAttrMatch[1]
            };
            itemData.brand_title = brandAttrMatch[1];
            console.log(`[Vinted Item] ✓ Marque extraite: ${itemData.brand_title} (ID: ${itemData.brand.id})`);
          }
          
          // Description depuis description plugin
          const descPluginMatch = section15.match(/\{"name":"description"[^}]*"description":"((?:[^"\\]|\\.)*)"/);
          if (descPluginMatch) {
            let desc = descPluginMatch[1];
            desc = desc.replace(/\\n/g, '\n');
            desc = desc.replace(/\\"/g, '"');
            desc = desc.replace(/\\\\/g, '\\');
            itemData.description = desc;
            console.log(`[Vinted Item] ✓ Description extraite - Longueur: ${itemData.description.length} caractères`);
          }
          
          // Extraire l'objet item complet - chercher "item":{...} dans toute la section
          console.log(`[Vinted Item] Extraction de l'objet item complet...`);
          
          // ID
          const idMatch = section15.match(/"item"\s*:\s*\{[^}]*"id"\s*:\s*(\d+)/);
          if (idMatch) {
            itemData.id = parseInt(idMatch[1]);
            console.log(`[Vinted Item] ✓ ID extrait: ${itemData.id}`);
          }
          
          // Titre depuis item
          const titleMatch = section15.match(/"item"\s*:\s*\{[^}]*"title"\s*:\s*"([^"]+)"/);
          if (titleMatch && !itemData.title) {
            itemData.title = titleMatch[1];
            console.log(`[Vinted Item] ✓ Titre extrait depuis item: "${itemData.title.substring(0, 50)}..."`);
          }
          
          // Prix depuis item
          const priceMatch = section15.match(/"price"\s*:\s*\{[^}]*"amount"\s*:\s*"([^"]+)"[^}]*"currency_code"\s*:\s*"([^"]+)"/);
          if (priceMatch) {
            itemData.price = {
              amount: priceMatch[1],
              currency_code: priceMatch[2] || 'EUR'
            };
            console.log(`[Vinted Item] ✓ Prix extrait: ${itemData.price.amount} ${itemData.price.currency_code}`);
          }
          
          // Photos depuis item - chercher toutes les occurrences
          // Utiliser un seul pattern qui capture à la fois l'URL et is_main dans le même objet JSON
          const photoMatches = section15.matchAll(/\{"url"\s*:\s*"([^"]+)"[^}]*"is_main"\s*:\s*(true|false)[^}]*\}/g);
          
          const photoArray = Array.from(photoMatches);
          console.log(`[Vinted Item] Photos trouvées dans la section: ${photoArray.length}`);
          
          if (photoArray.length > 0) {
            itemData.photos = photoArray.map(match => ({
              url: match[1],
              is_main: match[2] === 'true'
            }));
            console.log(`[Vinted Item] ✓ ${itemData.photos.length} photo(s) extraite(s)`);
          }
          
          // Marque (brand_dto) depuis item
          const brandDtoMatch = section15.match(/"brand_dto"\s*:\s*\{[^}]*"id"\s*:\s*(\d+)[^}]*"title"\s*:\s*"([^"]+)"/);
          if (brandDtoMatch && !itemData.brand) {
            itemData.brand = {
              id: parseInt(brandDtoMatch[1]),
              title: brandDtoMatch[2],
              name: brandDtoMatch[2]
            };
            itemData.brand_title = brandDtoMatch[2];
            console.log(`[Vinted Item] ✓ Marque (brand_dto) extraite: ${itemData.brand_title} (ID: ${itemData.brand.id})`);
          }
          
          // Vendeur depuis item - chercher plusieurs patterns
          let sellerIdMatch = section15.match(/"seller_id"\s*:\s*(\d+)/);
          // Si pas trouvé, chercher dans "user_id" ou "user":{..."id":...}
          if (!sellerIdMatch) {
            sellerIdMatch = section15.match(/"user_id"\s*:\s*(\d+)/);
          }
          if (!sellerIdMatch) {
            // Chercher dans "user":{..."id":123...}
            sellerIdMatch = section15.match(/"user"\s*:\s*\{[^}]*"id"\s*:\s*(\d+)/);
          }
          if (!sellerIdMatch) {
            // Chercher dans l'objet item complet avec user
            sellerIdMatch = section15.match(/"item"\s*:\s*\{[^}]*"user"\s*:\s*\{[^}]*"id"\s*:\s*(\d+)/);
          }
          
          const sellerLoginMatch = section15.match(/"login"\s*:\s*"([^"]+)"/);
          const sellerPhotoMatch = section15.match(/"seller_photo"\s*:\s*\{[^}]*"url"\s*:\s*"([^"]+)"/);
          
          if (sellerIdMatch || sellerLoginMatch) {
            if (!itemData.user) {
              itemData.user = {};
            }
            if (sellerIdMatch) {
              itemData.user.id = parseInt(sellerIdMatch[1]);
            }
            if (sellerLoginMatch) {
              itemData.user.login = sellerLoginMatch[1];
              itemData.user.username = sellerLoginMatch[1];
            }
            if (sellerPhotoMatch) {
              itemData.user.photo = { url: sellerPhotoMatch[1] };
            }
            console.log(`[Vinted Item] ✓ Vendeur extrait: ${itemData.user.login || 'N/A'} (ID: ${itemData.user.id || 'N/A'})`);
          }
          
          console.log(`[Vinted Item] Extraction depuis la section "15:[" terminée avec succès`);
          break; // On a trouvé les données, on peut arrêter
        } catch (e) {
          console.error("[Vinted Item] Erreur extraction __next_f.push (15:):", e);
        }
      }
    }
    
    if (!section15Found) {
      console.log(`[Vinted Item] ⚠ Section "15:[" non trouvée, utilisation des fallbacks`);
    }
    
    // 2. Fallback: Extraire depuis les meta tags og:*
    console.log(`[Vinted Item] Vérification des fallbacks (meta tags og:*)...`);
    if (!itemData.title) {
      const ogTitle = doc.querySelector('meta[property="og:title"]')?.getAttribute('content');
      if (ogTitle) {
        itemData.title = ogTitle.split('|')[0].trim();
        console.log(`[Vinted Item] ✓ Titre extrait depuis og:title: "${itemData.title.substring(0, 50)}..."`);
      } else {
        console.log(`[Vinted Item] ✗ og:title non trouvé`);
      }
    }
    
    if (!itemData.description) {
      const ogDescription = doc.querySelector('meta[property="og:description"]')?.getAttribute('content');
      if (ogDescription) {
        itemData.description = ogDescription;
        console.log(`[Vinted Item] ✓ Description extraite depuis og:description - Longueur: ${itemData.description.length} caractères`);
      } else {
        console.log(`[Vinted Item] ✗ og:description non trouvé`);
      }
    }
    
    // Extraire toutes les photos depuis le DOM (item-photos__container)
    console.log(`[Vinted Item] Extraction des photos depuis le DOM...`);
    const photosContainer = doc.querySelector('.item-photos__container');
    if (photosContainer) {
      // Récupérer toutes les images depuis les thumbnails (y compris celles cachées)
      const photoThumbnails = photosContainer.querySelectorAll('.item-thumbnail img[data-testid^="item-photo"]');
      const photoUrlsFromDom = new Set();
      
      photoThumbnails.forEach((img) => {
        const src = img.getAttribute('src');
        if (src) {
          // Convertir en format f800 si nécessaire
          let photoUrl = src;
          if (!photoUrl.includes('/f800/') && !photoUrl.includes('/f1024/')) {
            photoUrl = photoUrl.replace(/\/\d+x\d+\//, '/f800/');
          }
          photoUrlsFromDom.add(photoUrl);
        }
      });
      
      // Extraire aussi depuis les data-photoid pour récupérer toutes les photos
      const photoButtons = photosContainer.querySelectorAll('.item-thumbnail[data-photoid]');
      photoButtons.forEach(button => {
        const img = button.querySelector('img');
        if (img) {
          const src = img.getAttribute('src');
          if (src) {
            let photoUrl = src;
            if (!photoUrl.includes('/f800/') && !photoUrl.includes('/f1024/')) {
              photoUrl = photoUrl.replace(/\/\d+x\d+\//, '/f800/');
            }
            photoUrlsFromDom.add(photoUrl);
          }
        }
      });
      
      // Extraire depuis toutes les images dans item-photo
      const itemPhotos = photosContainer.querySelectorAll('.item-photo img');
      itemPhotos.forEach(img => {
        const src = img.getAttribute('src');
        if (src) {
          let photoUrl = src;
          if (!photoUrl.includes('/f800/') && !photoUrl.includes('/f1024/')) {
            photoUrl = photoUrl.replace(/\/\d+x\d+\//, '/f800/');
          }
          photoUrlsFromDom.add(photoUrl);
        }
      });
      
      // Ajouter les photos du DOM qui ne sont pas déjà dans itemData.photos
      const existingUrls = new Set(itemData.photos.map(p => p.url));
      let addedCount = 0;
      photoUrlsFromDom.forEach(url => {
        if (!existingUrls.has(url)) {
          itemData.photos.push({ url: url, is_main: false });
          addedCount++;
        }
      });
      
      if (addedCount > 0) {
        console.log(`[Vinted Item] ✓ ${addedCount} photo(s) supplémentaire(s) extraite(s) depuis le DOM`);
      }
      
      // Si aucune photo n'a été trouvée dans les scripts, utiliser celles du DOM
      if (itemData.photos.length === 0 && photoUrlsFromDom.size > 0) {
        itemData.photos = Array.from(photoUrlsFromDom).map((url, index) => ({
          url: url,
          is_main: index === 0
        }));
        console.log(`[Vinted Item] ✓ ${itemData.photos.length} photo(s) extraite(s) depuis le DOM (fallback)`);
      }
    } else {
      console.log(`[Vinted Item] ✗ Container item-photos__container non trouvé`);
    }
    
    if (itemData.photos.length === 0) {
      const ogImage = doc.querySelector('meta[property="og:image"]')?.getAttribute('content');
      if (ogImage) {
        itemData.photos.push({ url: ogImage, is_main: true });
        console.log(`[Vinted Item] ✓ Photo extraite depuis og:image`);
      } else {
        console.log(`[Vinted Item] ✗ og:image non trouvé`);
      }
    }
    
    // 3. Extraire le statut de vente (Vendu/Non vendu) depuis le HTML
    console.log(`[Vinted Item] Extraction du statut de vente...`);
    const statusElement = doc.querySelector('div[data-testid="item-status--content"]');
    if (statusElement) {
      const statusText = statusElement.textContent?.trim() || '';
      itemData.status = statusText;
      itemData.is_sold = statusText.toLowerCase().includes('vendu') || statusText.toLowerCase().includes('sold');
      console.log(`[Vinted Item] ✓ Statut extrait: "${statusText}" (Vendu: ${itemData.is_sold})`);
    } else {
      console.log(`[Vinted Item] ✗ Élément de statut non trouvé`);
      itemData.status = null;
      itemData.is_sold = false;
    }
    
    // 4. Fallback: Extraire le prix depuis le HTML (bouton avec le prix total)
    if (!itemData.price) {
      console.log(`[Vinted Item] Tentative d'extraction du prix depuis le HTML...`);
      const priceButton = doc.querySelector('button[aria-label*="Protection acheteurs incluse"]');
      if (priceButton) {
        const priceText = priceButton.querySelector('.web_ui__Text__title')?.textContent?.trim();
        if (priceText) {
          const priceMatch = priceText.match(/([\d,]+)\s*€/);
          if (priceMatch) {
            itemData.price = {
              amount: priceMatch[1].replace(',', '.'),
              currency_code: 'EUR'
            };
            console.log(`[Vinted Item] ✓ Prix extrait depuis le HTML: ${itemData.price.amount} ${itemData.price.currency_code}`);
          } else {
            console.log(`[Vinted Item] ✗ Pattern de prix non trouvé dans le texte: "${priceText}"`);
          }
        } else {
          console.log(`[Vinted Item] ✗ Texte de prix non trouvé dans le bouton`);
        }
      } else {
        console.log(`[Vinted Item] ✗ Bouton de prix non trouvé`);
      }
    }
    
    // Résumé final des données extraites
    console.log(`[Vinted Item] ========== RÉSUMÉ DES DONNÉES EXTRAITES ==========`);
    console.log(`[Vinted Item] ID: ${itemData.id}`);
    console.log(`[Vinted Item] Titre: ${itemData.title || 'NON TROUVÉ'}`);
    console.log(`[Vinted Item] Prix: ${itemData.price ? `${itemData.price.amount} ${itemData.price.currency_code}` : 'NON TROUVÉ'}`);
    console.log(`[Vinted Item] Description: ${itemData.description ? `${itemData.description.length} caractères` : 'NON TROUVÉE'}`);
    console.log(`[Vinted Item] Taille: ${itemData.size_title || 'NON TROUVÉE'}`);
    console.log(`[Vinted Item] État: ${itemData.condition_title || 'NON TROUVÉ'}`);
    console.log(`[Vinted Item] Marque: ${itemData.brand_title || 'NON TROUVÉE'}`);
    console.log(`[Vinted Item] Couleur: ${itemData.color || 'NON TROUVÉE'}`);
    console.log(`[Vinted Item] Photos: ${itemData.photos.length} photo(s)`);
    console.log(`[Vinted Item] Vendeur: ${itemData.user?.login || 'NON TROUVÉ'} (ID: ${itemData.user?.id || 'N/A'})`);
    console.log(`[Vinted Item] Statut: ${itemData.status || 'NON TROUVÉ'} (Vendu: ${itemData.is_sold})`);
    console.log(`[Vinted Item] ==================================================`);
    
    return itemData;
  } catch (error) {
    console.error("[Vinted Item] Erreur lors de la récupération des détails:", error);
    throw error;
  }
}

