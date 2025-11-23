// ==================== OFFER OPTIONS ====================

/**
 * Récupère l'ID de l'utilisateur connecté
 * @returns {Promise<string|null>} - User ID ou null
 */
async function getUserId() {
  try {
    const response = await fetch('https://www.vinted.fr/api/v2/inbox?page=1&per_page=20', {
      credentials: 'include',
      headers: {
        'accept': 'application/json, text/plain, */*',
        'accept-language': 'fr',
      }
    });

    if (response.ok) {
      const data = await response.json();
      if (data.conversations && data.conversations.length > 0) {
        // Essayer toutes les conversations jusqu'à trouver une avec des messages
        for (const conversation of data.conversations) {
          // Si pas de messages dans la conversation, charger la conversation complète
          try {
            const convResponse = await fetch(`https://www.vinted.fr/api/v2/conversations/${conversation.id}`, {
              credentials: 'include',
              headers: {
                'accept': 'application/json, text/plain, */*',
                'accept-language': 'fr',
              }
            });
            
            if (convResponse.ok) {
              const convData = await convResponse.json();
              const fullConversation = convData.conversation || convData;
              if (fullConversation.messages && fullConversation.messages.length > 0) {
                const oppositeUserId = fullConversation.opposite_user?.id;
                for (const msg of fullConversation.messages) {
                  if (msg.entity_type === 'message' && msg.entity?.user_id && msg.entity.user_id !== oppositeUserId) {
                    const userId = String(msg.entity.user_id);
                    console.log("[Offer] User ID trouvé via API inbox (conversation complète):", userId);
                    return userId;
                  }
                }
              }
            }
          } catch (convError) {
            // Continuer avec la conversation suivante
            continue;
          }
        }
      }
    }
  } catch (error) {
    console.error("[Offer] Erreur lors de la récupération via API inbox:", error);
  }
  
  console.warn("[Offer] User ID non trouvé");
  return null;
}

// Cache pour le seller_id et le userId pour éviter les requêtes répétées
let cachedSellerId = null;
let cachedUserId = null;

/**
 * Récupère un seller_id depuis la page actuelle ou depuis les conversations
 * @returns {Promise<number|null>} - Seller ID ou null
 */
async function getSellerIdForOfferOptions() {
  // Utiliser le cache si disponible
  if (cachedSellerId) {
    return cachedSellerId;
  }
  
  // Récupérer le userId une seule fois (avec cache)
  if (!cachedUserId) {
    cachedUserId = await getUserId();
  }
  
  // Méthode 1: Essayer de récupérer depuis la page actuelle (si on est sur une page d'item)
  try {
    const scripts = document.querySelectorAll('script:not([src])');
    for (const script of scripts) {
      const content = script.textContent || '';
      const patterns = [
        /"seller_id"\s*:\s*(\d+)/,
        /"user_id"\s*:\s*(\d+)/,
        /"user"\s*:\s*\{[^}]*"id"\s*:\s*(\d+)/,
      ];
      
      for (const pattern of patterns) {
        const match = content.match(pattern);
        if (match && match[1]) {
          const sellerId = parseInt(match[1]);
          // Vérifier que ce n'est pas notre propre ID
          if (cachedUserId && sellerId !== parseInt(cachedUserId)) {
            cachedSellerId = sellerId;
            return sellerId;
          }
        }
      }
    }
  } catch (error) {
    console.warn("[Offer] Erreur lors de l'extraction du seller_id depuis la page:", error);
  }

  // Méthode 2: Récupérer depuis les conversations (opposite_user) - plus rapide, une seule requête
  try {
    const response = await fetch('https://www.vinted.fr/api/v2/inbox?page=1&per_page=20', {
      credentials: 'include',
      headers: {
        'accept': 'application/json, text/plain, */*',
        'accept-language': 'fr',
      }
    });

    if (response.ok) {
      const data = await response.json();
      if (data.conversations && data.conversations.length > 0) {
        // Prendre le premier opposite_user qui n'est pas nous
        for (const conversation of data.conversations) {
          if (conversation.opposite_user && conversation.opposite_user.id) {
            const oppositeUserId = parseInt(conversation.opposite_user.id);
            if (cachedUserId && oppositeUserId !== parseInt(cachedUserId)) {
              cachedSellerId = oppositeUserId;
              return oppositeUserId;
            }
          }
        }
      }
    }
  } catch (error) {
    console.warn("[Offer] Erreur lors de la récupération du seller_id depuis les conversations:", error);
  }

  return null;
}

/**
 * Récupère les options d'offres depuis l'API Vinted
 * @param {Object} options - Options pour la requête
 * @param {Object} options.price - Prix avec amount et currency_code
 * @param {number} options.seller_id - ID du vendeur
 * @returns {Promise<Object|null>} - Options d'offres ou null
 */
async function fetchOfferOptions({ price, seller_id }) {
  try {
    // Récupérer le token CSRF (fonction disponible dans messages.js du même bundle)
    let csrfToken = null;
    if (typeof getCsrfToken === 'function') {
      csrfToken = await getCsrfToken();
    }
    
    // Si pas de token, essayer de le récupérer depuis la page
    if (!csrfToken && typeof tryGetCsrfTokenFromPage === 'function') {
      csrfToken = await tryGetCsrfTokenFromPage();
    }
    
    if (!csrfToken) {
      console.warn("[Offer] Token CSRF non trouvé, la requête peut échouer");
    }
    
    // Récupérer l'anon_id si disponible
    let anonId = null;
    if (typeof getAnonId === 'function') {
      anonId = getAnonId();
    }
    
    const headers = {
      'accept': 'application/json, text/plain, */*',
      'content-type': 'application/json',
    };
    
    // Ajouter le CSRF token si disponible
    if (csrfToken) {
      headers['x-csrf-token'] = csrfToken;
    }
    
    // Ajouter l'anon_id si disponible
    if (anonId) {
      headers['x-anon-id'] = anonId;
    }
    
    const response = await fetch('https://www.vinted.fr/api/v2/offers/request_options', {
      method: 'POST',
      credentials: 'include',
      headers: headers,
      body: JSON.stringify({
        price: price,
        seller_id: seller_id
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error("[Offer] Erreur API:", errorData);
      throw new Error(`HTTP ${response.status}: ${errorData.message || 'Erreur inconnue'}`);
    }

    const data = await response.json();
    if (data.request_options) {
      return {
        remaining: data.request_options.remaining || data.request_options.remaining_offer_count || 0,
        max_offer_count: data.request_options.max_offer_count || 0
      };
    }
    return null;
  } catch (error) {
    console.error("[Offer] Erreur lors de la récupération des options d'offres:", error);
    return null;
  }
}

/**
 * Charge les options d'offres et retourne le nombre d'offres restantes
 * @returns {Promise<number|null>} - Nombre d'offres restantes ou null
 */
async function loadRemainingOffers() {
  const sellerId = await getSellerIdForOfferOptions();
  if (!sellerId) {
    console.warn("[Offer] Impossible de récupérer un seller_id pour les options d'offres");
    return null;
  }

  const offerOptions = await fetchOfferOptions({
    price: { amount: "30.0", currency_code: "EUR" },
    seller_id: sellerId
  });

  return offerOptions ? offerOptions.remaining : null;
}

/**
 * Affiche le nombre d'offres restantes à gauche du wallet
 * @param {number|null} remainingOffers - Nombre d'offres restantes
 */
function displayRemainingOffers(remainingOffers) {
  // Chercher ou créer l'élément d'affichage des offres
  let offersDisplay = document.getElementById('vinted-offers-count');
  const walletDisplay = document.getElementById('vinted-wallet-balance');
  
  if (!walletDisplay) return;

  if (!offersDisplay) {
    // Créer l'élément d'affichage des offres
    offersDisplay = document.createElement("div");
    offersDisplay.id = "vinted-offers-count";
    offersDisplay.className = "vinted-offers-count";
    // Les styles sont maintenant dans styles.css
    
    // Insérer avant le wallet
    if (walletDisplay.parentNode) {
      walletDisplay.parentNode.insertBefore(offersDisplay, walletDisplay);
    }
  }

  if (remainingOffers !== null) {
    offersDisplay.textContent = `${remainingOffers} offres restantes`;
    offersDisplay.title = `Offres restantes: ${remainingOffers}`;
    offersDisplay.style.display = '';
  } else {
    // Afficher "Chargement..." si null pour donner un feedback immédiat
    offersDisplay.textContent = 'Chargement...';
    offersDisplay.title = 'Chargement des offres restantes';
    offersDisplay.style.display = '';
  }
}

/**
 * Initialise l'affichage du nombre d'offres restantes
 */
async function initOfferCount() {
  // Afficher immédiatement l'élément avec "Chargement..." pour un meilleur feedback
  displayRemainingOffers(null);
  
  // Charger les offres restantes en arrière-plan
  const remainingOffers = await loadRemainingOffers();
  displayRemainingOffers(remainingOffers);
  return remainingOffers;
}

