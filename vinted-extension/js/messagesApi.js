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
export async function fetchConversation(conversationId) {
  const url = `https://www.vinted.fr/api/v2/conversations/${conversationId}`;
  
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
    return data.conversation;
  } catch (error) {
    console.error("[Vinted Messages] Erreur lors de la récupération de la conversation:", error);
    throw error;
  }
}

// Variable globale pour stocker le token CSRF intercepté
let cachedCsrfToken = null;

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
  // Méthode 1: Depuis le cache (intercepté depuis une requête)
  if (cachedCsrfToken) {
    return cachedCsrfToken;
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
        const newToken = await tryGetCsrfTokenFromPage();
        if (newToken) {
          cachedCsrfToken = newToken;
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
export async function fetchItemDetails(itemId, itemSlug = '') {
  // Construire l'URL de la page avec l'ID et le slug si disponible
  const url = itemSlug 
    ? `https://www.vinted.fr/items/${itemId}-${itemSlug}`
    : `https://www.vinted.fr/items/${itemId}`;
  
  try {
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

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const html = await response.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    
    // Extraire les données depuis __NEXT_DATA__ ou depuis le HTML
    let itemData = null;
    
    // Méthode 1: Chercher dans __NEXT_DATA__
    const scripts = doc.querySelectorAll('script');
    for (const script of scripts) {
      const content = script.textContent || script.innerHTML;
      if (content.includes('__NEXT_DATA__') || content.includes('"item"')) {
        try {
          // Essayer d'extraire les données JSON
          const match = content.match(/__NEXT_DATA__\s*=\s*({.+?});/s);
          if (match) {
            const nextData = JSON.parse(match[1]);
            if (nextData?.props?.pageProps?.item) {
              itemData = nextData.props.pageProps.item;
              break;
            }
          }
          
          // Alternative: chercher directement "item" dans le JSON
          const itemMatch = content.match(/"item"\s*:\s*({.+?})(?=,"|$)/s);
          if (itemMatch) {
            itemData = JSON.parse(itemMatch[1]);
            break;
          }
        } catch (e) {
          // Continuer avec la méthode suivante
        }
      }
    }
    
    // Méthode 2: Si pas trouvé, essayer de parser le HTML directement
    if (!itemData) {
      // Extraire les informations de base depuis le HTML
      const title = doc.querySelector('h1')?.textContent?.trim() || '';
      const priceText = doc.querySelector('[class*="price"]')?.textContent?.trim() || '';
      const description = doc.querySelector('[class*="description"]')?.textContent?.trim() || '';
      
      // Créer un objet item basique
      itemData = {
        id: itemId,
        title: title,
        description: description,
        price: parseFloat(priceText.replace(/[^\d,.]/g, '').replace(',', '.')) || 0,
        currency: 'EUR',
        photos: Array.from(doc.querySelectorAll('img[src*="vinted.net"]')).map(img => ({
          url: img.src
        })).slice(0, 10)
      };
    }
    
    return itemData;
  } catch (error) {
    console.error("[Vinted Item] Erreur lors de la récupération des détails:", error);
    throw error;
  }
}

