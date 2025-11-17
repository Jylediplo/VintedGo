// Gestion de l'affichage des détails de produit dans une fenêtre transparente
import { createConversationForItem, fetchConversation, fetchInbox, fetchItemDetails, sendMessage, sendOfferRequest } from './messagesApi.js';
import { extractCondition, extractSize, formatPrice } from './utils.js';

/**
 * Extrait l'ID et le nom du produit depuis une URL Vinted
 * @param {string} url - URL du produit
 * @returns {Object|null} - {id: string, slug: string} ou null
 */
function extractItemInfoFromUrl(url) {
  // Format: /items/7573189306-giacca-carhartt
  const match = url.match(/\/items\/(\d+)(?:-(.+))?/);
  if (!match) return null;
  
  return {
    id: match[1],
    slug: match[2] || ''
  };
}

/**
 * Affiche les détails d'un produit dans une fenêtre modale transparente
 * @param {string|number} itemId - ID du produit
 * @param {string} itemSlug - Nom/slug du produit (optionnel)
 */
export async function showItemDetails(itemId, itemSlug = '') {
  try {
    const item = await fetchItemDetails(itemId, itemSlug);
    if (!item) {
      throw new Error('Produit non trouvé');
    }

    // Créer le modal
    const modal = document.createElement('div');
    modal.className = 'vinted-item-modal';
    modal.innerHTML = `
      <div class="vinted-item-modal-content">
        <button class="vinted-item-modal-close" aria-label="Fermer">&times;</button>
        <div class="vinted-item-modal-body">
          <div class="vinted-item-loading">Chargement...</div>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    // Rendre le contenu
    renderItemDetails(modal, item);
    
    // Gestionnaires d'événements
    const closeBtn = modal.querySelector('.vinted-item-modal-close');
    const closeModal = () => {
      document.body.removeChild(modal);
      isModalOpen = false;
    };
    
    closeBtn.addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });
    
    // Empêcher la fermeture lors du clic dans le contenu
    const content = modal.querySelector('.vinted-item-modal-content');
    content.addEventListener('click', (e) => {
      e.stopPropagation();
    });
    
  } catch (error) {
    console.error("[Vinted Item] Erreur lors de l'affichage des détails:", error);
    alert("Erreur lors du chargement des détails du produit.");
  }
}

/**
 * Rend les détails du produit dans le modal
 * @param {HTMLElement} modal - Élément modal
 * @param {Object} item - Données du produit
 */
function renderItemDetails(modal, item) {
  const body = modal.querySelector('.vinted-item-modal-body');
  
  // Photos - Filtrer pour éviter les doublons et exclure la photo de profil
  let photos = item.photos || [];
  
  // Fonction pour obtenir l'URL formatée (f800)
  const getImageUrl = (photo) => {
    const url = typeof photo === 'string' ? photo : (photo.url || '');
    if (!url) return '';
    // Utiliser le format f800 pour toutes les images
    if (url.includes('/f800/') || url.includes('/f1024/')) {
      return url;
    }
    // Remplacer le format existant par f800
    return url.replace(/\/\d+x\d+\//, '/f800/');
  };
  
  // Filtrer les photos : exclure les photos de profil
  photos = photos.filter(photo => {
    const url = typeof photo === 'string' ? photo : (photo.url || '');
    // Exclure les photos de profil (généralement dans des dossiers spécifiques ou de petite taille)
    if (url.includes('/50x50/') || url.includes('/avatar') || url.includes('/profile') || 
        url.includes('/user') || url.match(/\/\d+x\d+\//)?.[0]?.includes('50x50')) {
      return false;
    }
    return true;
  });
  
  // Dédupliquer par URL (garder seulement les URLs uniques)
  const uniquePhotos = [];
  const seenUrls = new Set();
  for (const photo of photos) {
    const url = getImageUrl(photo);
    if (url && !seenUrls.has(url)) {
      seenUrls.add(url);
      uniquePhotos.push({ url: url });
    }
  }
  photos = uniquePhotos;
  
  const photosHtml = photos.length > 0 ? `
    <div class="vinted-item-photos">
      <div class="vinted-item-photo-main">
        <img src="${getImageUrl(photos[0])}" alt="${item.title}" id="vinted-item-main-photo">
      </div>
      ${photos.length > 1 ? `
        <div class="vinted-item-photo-thumbnails">
          ${photos.map((photo, index) => `
            <img src="${getImageUrl(photo)}" alt="Photo ${index + 1}" 
                 class="vinted-item-photo-thumb ${index === 0 ? 'active' : ''}"
                 data-index="${index}">
          `).join('')}
        </div>
      ` : ''}
    </div>
  ` : '';
  
  // Informations du produit - utiliser les fonctions d'extraction appropriées
  const price = formatPrice(item) || 'Prix non disponible';
  const size = extractSize(item) || 'Taille non spécifiée';
  const brand = item.brand?.title || item.brand?.name || item.brand_title || (typeof item.brand === 'string' ? item.brand : 'Marque non spécifiée');
  const condition = extractCondition(item) || 'État non spécifié';
  const description = item.description || item.description_text || 'Aucune description';
  
  // Informations du vendeur
  const seller = item.user || {};
  const sellerName = seller.login || 'Vendeur inconnu';
  const sellerAvatar = seller.photo?.url || '';
  
  body.innerHTML = `
    <div class="vinted-item-details">
      ${photosHtml}
      <div class="vinted-item-info">
        <h2 class="vinted-item-title">${escapeHtml(item.title)}</h2>
        <div class="vinted-item-price">${escapeHtml(price)}</div>
        <div class="vinted-item-meta">
          <span class="vinted-item-meta-item">Taille: ${escapeHtml(size)}</span>
          <span class="vinted-item-meta-item">Marque: ${escapeHtml(brand)}</span>
          <span class="vinted-item-meta-item">État: ${escapeHtml(condition)}</span>
        </div>
        <div class="vinted-item-description">
          <h3>Description</h3>
          <p>${escapeHtml(description).replace(/\n/g, '<br>')}</p>
        </div>
        <div class="vinted-item-seller">
          <h3>Vendeur</h3>
          <div class="vinted-item-seller-info">
            ${sellerAvatar ? `<img src="${sellerAvatar}" alt="${sellerName}" class="vinted-item-seller-avatar">` : ''}
            <span class="vinted-item-seller-name">${escapeHtml(sellerName)}</span>
          </div>
        </div>
        <div class="vinted-item-actions">
          <button class="vinted-item-pin-btn" data-item-id="${item.id}" title="Épingler cet article">
            📌 Épingler
          </button>
          <button class="vinted-item-offer-btn" data-item-id="${item.id}">Faire une offre</button>
        </div>
        <div class="vinted-item-conversation" id="vinted-item-conversation-${item.id}">
        </div>
      </div>
    </div>
  `;
  
  // Gestionnaire pour les miniatures de photos
  if (photos.length > 1) {
    const thumbnails = body.querySelectorAll('.vinted-item-photo-thumb');
    const mainPhoto = body.querySelector('#vinted-item-main-photo');
    
    const getImageUrl = (photo) => {
      const url = typeof photo === 'string' ? photo : (photo.url || '');
      if (!url) return '';
      if (url.includes('/f800/') || url.includes('/f1024/')) {
        return url;
      }
      return url.replace(/\/\d+x\d+\//, '/f800/');
    };
    
    thumbnails.forEach(thumb => {
      thumb.addEventListener('click', () => {
        const index = parseInt(thumb.dataset.index);
        mainPhoto.src = getImageUrl(photos[index]);
        thumbnails.forEach(t => t.classList.remove('active'));
        thumb.classList.add('active');
      });
    });
  }
  
  // Gestionnaire pour le bouton d'offre
  const offerBtn = body.querySelector('.vinted-item-offer-btn');
  if (offerBtn) {
    offerBtn.addEventListener('click', () => {
      showOfferDialogForItem(item.id, modal);
    });
  }
  
  // Gestionnaire pour le bouton d'épinglage
  const pinBtn = body.querySelector('.vinted-item-pin-btn');
  if (pinBtn) {
    const isPinned = isItemPinned(item.id);
    if (isPinned) {
      pinBtn.textContent = '📌 Épinglé';
      pinBtn.classList.add('pinned');
    }
    pinBtn.addEventListener('click', () => {
      togglePinItem(item);
      const isNowPinned = isItemPinned(item.id);
      pinBtn.textContent = isNowPinned ? '📌 Épinglé' : '📌 Épingler';
      pinBtn.classList.toggle('pinned', isNowPinned);
    });
  }
  
  // Afficher directement la barre d'envoi, puis charger la conversation en arrière-plan
  const conversationContainer = modal.querySelector(`#vinted-item-conversation-${item.id}`);
  if (conversationContainer && seller.id) {
    // Afficher immédiatement la barre d'envoi vide
    renderEmptyConversation(conversationContainer, seller.id, item.id, item);
    // Charger la conversation en arrière-plan et remplacer si elle existe
    loadConversationForItem(item.id, seller.id, modal, item);
  }
}

/**
 * Affiche le dialogue d'offre pour un produit
 * @param {string|number} itemId - ID du produit
 * @param {HTMLElement} modal - Élément modal parent
 */
function showOfferDialogForItem(itemId, modal) {
  // Créer le modal d'offre
  const offerModal = document.createElement('div');
  offerModal.className = 'vinted-offer-modal';
  offerModal.innerHTML = `
    <div class="vinted-offer-modal-content">
      <div class="vinted-offer-modal-header">
        <h3>Faire une offre</h3>
        <button class="vinted-offer-modal-close" aria-label="Fermer">&times;</button>
      </div>
      <div class="vinted-offer-modal-body">
        <label for="vinted-offer-price">Prix (EUR)</label>
        <input type="number" 
               id="vinted-offer-price" 
               class="vinted-offer-price-input" 
               placeholder="0.00" 
               step="0.01" 
               min="0.01"
               required>
        <div class="vinted-offer-modal-actions">
          <button class="vinted-offer-modal-cancel">Annuler</button>
          <button class="vinted-offer-modal-submit">Envoyer l'offre</button>
        </div>
      </div>
    </div>
  `;
  
  document.body.appendChild(offerModal);
  
  const priceInput = offerModal.querySelector('.vinted-offer-price-input');
  const submitBtn = offerModal.querySelector('.vinted-offer-modal-submit');
  const cancelBtn = offerModal.querySelector('.vinted-offer-modal-cancel');
  const closeBtn = offerModal.querySelector('.vinted-offer-modal-close');
  
  const closeOfferModal = () => {
    document.body.removeChild(offerModal);
  };
  
  const handleSubmit = async () => {
    const price = priceInput.value.trim();
    if (!price || parseFloat(price) <= 0) {
      alert('Veuillez entrer un prix valide');
      return;
    }
    
    submitBtn.disabled = true;
    submitBtn.textContent = 'Envoi...';
    
    try {
      // Essayer de trouver une conversation existante pour cet item
      const inbox = await fetchInbox(1, 50);
      const conversations = inbox.conversations || [];
      let conversation = conversations.find(conv => {
        return conv.item?.id === parseInt(itemId) || 
               conv.item?.id === itemId;
      });
      
      if (conversation && conversation.transaction?.id) {
        // Si on a une transaction, envoyer l'offre directement
        await sendOfferRequest(conversation.transaction.id, price, 'EUR');
        alert('Offre envoyée avec succès !');
        closeOfferModal();
        
        // Recharger la conversation pour afficher la nouvelle offre
        const conversationContainer = modal?.querySelector(`#vinted-item-conversation-${itemId}`);
        if (conversationContainer) {
          const updatedConversation = await fetchConversation(conversation.id);
          const seller = updatedConversation.opposite_user;
          if (seller && seller.id) {
            renderConversation(conversationContainer, updatedConversation, itemId, { id: itemId });
          }
        }
      } else {
        // Pas de transaction, essayer de créer une conversation puis une transaction
        try {
          // Récupérer les détails de l'item pour obtenir l'ID du vendeur
          const itemDetails = await fetchItemDetails(itemId, '');
          let sellerId = null;
          if (itemDetails && itemDetails.user && itemDetails.user.id) {
            sellerId = itemDetails.user.id;
          }
          
          if (!sellerId) {
            throw new Error('Impossible de récupérer l\'ID du vendeur');
          }
          
          // Essayer de créer une conversation pour cet item
          const newConversation = await createConversationForItem(itemId, sellerId, `Je souhaite faire une offre de ${price} EUR`, itemDetails);
          
          if (newConversation && newConversation.transaction?.id) {
            // Si on a une transaction, envoyer l'offre directement
            await sendOfferRequest(newConversation.transaction.id, price, 'EUR');
            alert('Offre envoyée avec succès !');
            closeOfferModal();
            
            // Recharger la conversation pour afficher la nouvelle offre
            const conversationContainer = modal?.querySelector(`#vinted-item-conversation-${itemId}`);
            if (conversationContainer) {
              const updatedConversation = await fetchConversation(newConversation.id);
              const seller = updatedConversation.opposite_user;
              if (seller && seller.id) {
                renderConversation(conversationContainer, updatedConversation, itemId, { id: itemId });
              }
            }
          } else {
            // Si la création de conversation a échoué, rediriger vers la page
            alert('Pour faire une offre, veuillez d\'abord envoyer un message au vendeur depuis la conversation ci-dessous. Une fois la conversation créée, vous pourrez faire une offre.');
            closeOfferModal();
          }
        } catch (createError) {
          console.error("[Vinted Item] Erreur lors de la création de la conversation:", createError);
          alert('Pour faire une offre, veuillez d\'abord envoyer un message au vendeur depuis la conversation ci-dessous. Une fois la conversation créée, vous pourrez faire une offre.');
          closeOfferModal();
        }
      }
    } catch (error) {
      console.error("[Vinted Item] Erreur lors de l'envoi de l'offre:", error);
      alert("Erreur lors de l'envoi de l'offre. Veuillez réessayer.");
      submitBtn.disabled = false;
      submitBtn.textContent = 'Envoyer l\'offre';
    }
  };
  
  submitBtn.addEventListener('click', handleSubmit);
  cancelBtn.addEventListener('click', closeOfferModal);
  closeBtn.addEventListener('click', closeOfferModal);
  offerModal.addEventListener('click', (e) => {
    if (e.target === offerModal) closeOfferModal();
  });
  
  priceInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    }
  });
  
  setTimeout(() => priceInput.focus(), 100);
}

/**
 * Charge la conversation pour un produit
 * @param {string|number} itemId - ID du produit
 * @param {string|number} userId - ID du vendeur
 * @param {HTMLElement} modal - Élément modal parent
 * @param {Object} item - Données du produit
 */
async function loadConversationForItem(itemId, userId, modal, item) {
  const conversationContainer = modal.querySelector(`#vinted-item-conversation-${itemId}`);
  if (!conversationContainer) return;
  
  try {
    // Chercher une conversation existante dans l'inbox
    const inbox = await fetchInbox(1, 50);
    const conversations = inbox.conversations || [];
    
    // Trouver une conversation liée à cet item
    let conversation = conversations.find(conv => {
      return conv.item?.id === parseInt(itemId) || 
             conv.item?.id === itemId ||
             (conv.opposite_user?.id === parseInt(userId) && conv.item);
    });
    
    if (conversation) {
      // Charger les détails de la conversation et remplacer la barre d'envoi vide
      const conversationDetails = await fetchConversation(conversation.id);
      renderConversation(conversationContainer, conversationDetails, itemId, item);
    }
    // Si aucune conversation n'est trouvée, on garde la barre d'envoi vide déjà affichée
  } catch (error) {
    console.error("[Vinted Item] Erreur lors du chargement de la conversation:", error);
    // En cas d'erreur, on garde la barre d'envoi vide déjà affichée
  }
}

/**
 * Affiche la conversation pour un produit
 * @param {string|number} itemId - ID du produit
 * @param {string|number} userId - ID du vendeur
 * @param {HTMLElement} modal - Élément modal parent
 * @param {Object} item - Données du produit
 */
async function showConversationForItem(itemId, userId, modal, item) {
  const conversationContainer = modal.querySelector(`#vinted-item-conversation-${itemId}`);
  if (!conversationContainer) return;
  
  // Afficher le conteneur s'il était caché
  conversationContainer.style.display = 'block';
  
  await loadConversationForItem(itemId, userId, modal, item);
}

/**
 * Rend une conversation dans le conteneur
 * @param {HTMLElement} container - Conteneur de conversation
 * @param {Object} conversation - Données de la conversation
 * @param {string|number} itemId - ID du produit
 * @param {Object} item - Données du produit
 */
function renderConversation(container, conversation, itemId, item) {
  const oppositeUserId = conversation.opposite_user?.id;
  if (!oppositeUserId) {
    container.innerHTML = '<div class="vinted-item-conversation-error">Erreur: Impossible de charger la conversation.</div>';
    return;
  }
  
  let currentUserId = oppositeUserId;
  for (const msg of conversation.messages || []) {
    if (msg.entity_type === 'message' && msg.entity?.user_id && msg.entity.user_id !== oppositeUserId) {
      currentUserId = msg.entity.user_id;
      break;
    }
  }
  
  const conversationUrl = conversation.conversation_url || `https://www.vinted.fr/inbox/${conversation.id}`;
  const transaction = conversation.transaction || null;
  
  // Fonction pour formater les messages
  const formatMessage = (msg, userId, url, trans) => {
    const isCurrentUser = msg.entity?.user_id === userId;
    const messageClass = isCurrentUser ? 'vinted-msg-current-user' : 'vinted-msg-other-user';
    const timeAgo = msg.created_time_ago || (msg.created_at_ts ? new Date(msg.created_at_ts * 1000).toLocaleString('fr-FR') : '');
    
    if (msg.entity_type === 'message') {
      return `
        <div class="vinted-msg-item ${messageClass}">
          <div class="vinted-msg-body">${escapeHtml(msg.entity.body)}</div>
          <div class="vinted-msg-time">${escapeHtml(timeAgo)}</div>
        </div>
      `;
    }
    return '';
  };
  
  const messagesHtml = (conversation.messages || []).map(msg => 
    formatMessage(msg, currentUserId, conversationUrl, transaction)
  ).join('');
  
  container.innerHTML = `
    <div class="vinted-item-conversation-content">
      <div class="vinted-item-messages-list">
        ${messagesHtml}
      </div>
      <div class="vinted-item-messages-input-container">
        <input type="text" 
               class="vinted-item-messages-input" 
               placeholder="Tapez votre message..."
               maxlength="1000">
        <button class="vinted-item-messages-send" aria-label="Envoyer">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="22" y1="2" x2="11" y2="13"></line>
            <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
          </svg>
        </button>
      </div>
    </div>
  `;
  
  // Gestionnaire d'envoi de message
  const input = container.querySelector('.vinted-item-messages-input');
  const sendBtn = container.querySelector('.vinted-item-messages-send');
  
  const handleSend = async () => {
    const messageText = input.value.trim();
    if (!messageText) return;
    
    input.disabled = true;
    sendBtn.disabled = true;
    sendBtn.style.opacity = '0.5';
    
    try {
      // Si on a une conversation, envoyer le message
      if (conversation && conversation.id) {
        await sendMessage(conversation.id, messageText);
        // Recharger la conversation
        const updatedConversation = await fetchConversation(conversation.id);
        renderConversation(container, updatedConversation, itemId, item);
      } else {
        // Essayer de trouver une conversation existante
        const inbox = await fetchInbox(1, 50);
        const conversations = inbox.conversations || [];
        const foundConversation = conversations.find(conv => {
          return conv.item?.id === parseInt(itemId) || 
                 conv.item?.id === itemId;
        });
        
        if (foundConversation) {
          // Charger et utiliser cette conversation
          const conversationDetails = await fetchConversation(foundConversation.id);
          await sendMessage(foundConversation.id, messageText);
          const updatedConversation = await fetchConversation(foundConversation.id);
          renderConversation(container, updatedConversation, itemId, item);
        } else {
          // Pas de conversation, essayer de créer une conversation
          try {
            // Récupérer les détails de l'item pour obtenir l'ID du vendeur
            let sellerId = null;
            if (!item || !item.user || !item.user.id) {
              const itemDetails = await fetchItemDetails(itemId, item?.slug || '');
              if (itemDetails && itemDetails.user && itemDetails.user.id) {
                sellerId = itemDetails.user.id;
              }
            } else {
              sellerId = item.user.id;
            }
            
            if (!sellerId) {
              throw new Error('Impossible de récupérer l\'ID du vendeur');
            }
            
            const newConversation = await createConversationForItem(itemId, sellerId, messageText, item);
            if (newConversation && newConversation.id) {
              // Recharger la conversation
              const updatedConversation = await fetchConversation(newConversation.id);
              renderConversation(container, updatedConversation, itemId, item);
            } else {
              // Si la création a échoué, rediriger vers la page
              const itemUrl = `https://www.vinted.fr/items/${itemId}${item?.slug ? '-' + item.slug : ''}`;
              window.open(`${itemUrl}?action=message`, '_blank');
              alert('Pour envoyer un message, veuillez d\'abord ouvrir la page du produit et cliquer sur "Message". Une fois la conversation créée, vous pourrez envoyer des messages directement depuis ici.');
            }
          } catch (createError) {
            console.error("[Vinted Item] Erreur lors de la création de la conversation:", createError);
            const itemUrl = `https://www.vinted.fr/items/${itemId}${item?.slug ? '-' + item.slug : ''}`;
            window.open(`${itemUrl}?action=message`, '_blank');
            alert('Pour envoyer un message, veuillez d\'abord ouvrir la page du produit et cliquer sur "Message". Une fois la conversation créée, vous pourrez envoyer des messages directement depuis ici.');
          }
        }
      }
      
      input.value = '';
      setTimeout(() => {
        const messagesList = container.querySelector('.vinted-item-messages-list');
        if (messagesList) {
          messagesList.scrollTop = messagesList.scrollHeight;
        }
      }, 100);
    } catch (error) {
      console.error("[Vinted Item] Erreur lors de l'envoi:", error);
      alert("Erreur lors de l'envoi du message. Veuillez réessayer.");
    } finally {
      input.disabled = false;
      sendBtn.disabled = false;
      sendBtn.style.opacity = '1';
      input.focus();
    }
  };
  
  sendBtn.addEventListener('click', handleSend);
  input.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  });
  
  // Faire défiler vers le bas
  setTimeout(() => {
    const messagesList = container.querySelector('.vinted-item-messages-list');
    if (messagesList) {
      messagesList.scrollTop = messagesList.scrollHeight;
    }
  }, 100);
}

/**
 * Rend une conversation vide avec la barre d'envoi
 * @param {HTMLElement} container - Conteneur de conversation
 * @param {string|number} userId - ID du vendeur
 * @param {string|number} itemId - ID du produit
 * @param {Object} item - Données du produit
 */
function renderEmptyConversation(container, userId, itemId, item) {
  container.innerHTML = `
    <div class="vinted-item-conversation-content">
      <div class="vinted-item-messages-list">
        <div class="vinted-item-no-messages">Aucun message. Commencez la conversation !</div>
      </div>
      <div class="vinted-item-messages-input-container">
        <input type="text" 
               class="vinted-item-messages-input" 
               placeholder="Tapez votre message..."
               maxlength="1000">
        <button class="vinted-item-messages-send" aria-label="Envoyer">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="22" y1="2" x2="11" y2="13"></line>
            <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
          </svg>
        </button>
      </div>
    </div>
  `;
  
  const input = container.querySelector('.vinted-item-messages-input');
  const sendBtn = container.querySelector('.vinted-item-messages-send');
  
  const handleSend = async () => {
    const messageText = input.value.trim();
    if (!messageText) return;
    
    input.disabled = true;
    sendBtn.disabled = true;
    sendBtn.style.opacity = '0.5';
    
    try {
      // Créer une conversation en envoyant un message via l'API Vinted
      // On va utiliser l'URL de contact direct de Vinted
      const conversation = await createConversationForItem(itemId, userId, messageText, item);
      
      if (conversation && conversation.id) {
        // Recharger la conversation pour afficher le message
        const updatedConversation = await fetchConversation(conversation.id);
        renderConversation(container, updatedConversation, itemId, item);
      } else {
        throw new Error('Impossible de créer la conversation');
      }
    } catch (error) {
      console.error("[Vinted Item] Erreur lors de l'envoi:", error);
      alert("Erreur lors de l'envoi du message. Veuillez réessayer.");
    } finally {
      input.disabled = false;
      sendBtn.disabled = false;
      sendBtn.style.opacity = '1';
      input.focus();
    }
  };
  
  sendBtn.addEventListener('click', handleSend);
  input.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  });
}

/**
 * Échappe le HTML pour éviter les XSS
 * @param {string} text - Texte à échapper
 * @returns {string} - Texte échappé
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Variable pour éviter les doubles clics
let isModalOpen = false;

/**
 * Ajoute un bouton "Faire une offre" sur les pages d'items Vinted
 */
function addOfferButtonToItemPage() {
  // Vérifier si on est sur une page d'item
  if (!window.location.pathname.match(/\/items\/\d+/)) return;
  
  // Chercher le bouton "Acheter" ou "Buy"
  const buyButton = document.querySelector('button[class*="buy"], button[class*="purchase"], a[class*="buy"], button:has-text("Acheter"), button:has-text("Buy")');
  
  // Alternative: chercher par texte
  const buttons = document.querySelectorAll('button, a[role="button"]');
  let buyBtn = null;
  for (const btn of buttons) {
    const text = btn.textContent?.toLowerCase() || '';
    if (text.includes('acheter') || text.includes('buy') || text.includes('purchase')) {
      buyBtn = btn;
      break;
    }
  }
  
  if (buyBtn && !document.querySelector('.vinted-offer-button-injected')) {
    // Créer le bouton "Faire une offre"
    const offerBtn = document.createElement('button');
    offerBtn.className = 'vinted-offer-button-injected';
    offerBtn.textContent = 'Faire une offre';
    offerBtn.style.cssText = `
      padding: 0.75rem 1.5rem;
      background: #09B1BA;
      color: white;
      border: none;
      border-radius: 8px;
      font-size: 0.875rem;
      font-weight: 500;
      cursor: pointer;
      margin-right: 0.75rem;
      transition: all 0.2s;
    `;
    
    offerBtn.addEventListener('mouseenter', () => {
      offerBtn.style.background = '#078a91';
      offerBtn.style.transform = 'translateY(-1px)';
    });
    
    offerBtn.addEventListener('mouseleave', () => {
      offerBtn.style.background = '#09B1BA';
      offerBtn.style.transform = 'translateY(0)';
    });
    
    // Extraire l'ID de l'item depuis l'URL
    const itemInfo = extractItemInfoFromUrl(window.location.href);
    if (itemInfo && itemInfo.id) {
      offerBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        await showItemDetails(itemInfo.id, itemInfo.slug);
      });
    }
    
    // Insérer avant le bouton "Acheter"
    buyBtn.parentNode.insertBefore(offerBtn, buyBtn);
  }
}

/**
 * Initialise l'interception des clics sur les produits
 */
export function initItemClickInterceptor() {
  // Intercepter les clics sur les liens de produits
  document.addEventListener('click', async (e) => {
    // Éviter les doubles clics
    if (isModalOpen) return;
    
    const link = e.target.closest('a[href*="/items/"]');
    if (!link) return;
    
    const url = link.href || link.getAttribute('href');
    if (!url || !url.includes('/items/')) return;
    
    const itemInfo = extractItemInfoFromUrl(url);
    if (!itemInfo || !itemInfo.id) return;
    
    // Empêcher la redirection
    e.preventDefault();
    e.stopPropagation();
    
    // Marquer comme ouvert
    isModalOpen = true;
    
    // Afficher les détails dans le modal
    await showItemDetails(itemInfo.id, itemInfo.slug);
  }, true); // Utiliser capture pour intercepter avant que le lien ne soit suivi
  
  // Ajouter le bouton "Faire une offre" sur les pages d'items
  if (window.location.pathname.match(/\/items\/\d+/)) {
    // Attendre que la page soit chargée
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        setTimeout(addOfferButtonToItemPage, 1000);
      });
    } else {
      setTimeout(addOfferButtonToItemPage, 1000);
    }
    
    // Observer les changements de DOM pour réajouter le bouton si nécessaire
    const observer = new MutationObserver(() => {
      if (!document.querySelector('.vinted-offer-button-injected')) {
        addOfferButtonToItemPage();
      }
    });
    
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }
}

// ==========================================
// Gestion des items épinglés
// ==========================================

const PINNED_ITEMS_STORAGE_KEY = 'vinted_pinned_items';

/**
 * Récupère les items épinglés depuis le stockage
 * @returns {Array} - Liste des items épinglés
 */
function getPinnedItems() {
  try {
    const stored = localStorage.getItem(PINNED_ITEMS_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (e) {
    return [];
  }
}

/**
 * Sauvegarde les items épinglés
 * @param {Array} items - Liste des items épinglés
 */
function savePinnedItems(items) {
  try {
    localStorage.setItem(PINNED_ITEMS_STORAGE_KEY, JSON.stringify(items));
  } catch (e) {
    console.error("[Vinted Item] Erreur lors de la sauvegarde des items épinglés:", e);
  }
}

/**
 * Vérifie si un item est épinglé
 * @param {string|number} itemId - ID de l'item
 * @returns {boolean}
 */
function isItemPinned(itemId) {
  const pinned = getPinnedItems();
  return pinned.some(item => String(item.id) === String(itemId));
}

/**
 * Épingle ou désépingle un item
 * @param {Object} item - Données de l'item
 */
function togglePinItem(item) {
  const pinned = getPinnedItems();
  const itemId = String(item.id);
  const index = pinned.findIndex(p => String(p.id) === itemId);
  
  if (index >= 0) {
    // Désépingler
    pinned.splice(index, 1);
  } else {
    // Épingler - utiliser la première photo formatée
    const photos = item.photos || [];
    let photoUrl = '';
    if (photos.length > 0) {
      const firstPhoto = photos[0];
      const url = typeof firstPhoto === 'string' ? firstPhoto : (firstPhoto.url || '');
      photoUrl = url.replace(/\/\d+x\d+\//, '/f800/');
    }
    
    pinned.push({
      id: itemId,
      title: item.title,
      price: item.price,
      currency: item.currency || 'EUR',
      photo: photoUrl,
      url: `https://www.vinted.fr/items/${itemId}${item.slug ? '-' + item.slug : ''}`,
      slug: item.slug || ''
    });
  }
  
  savePinnedItems(pinned);
  renderPinnedItemsBar();
}

/**
 * Supprime un item épinglé
 * @param {string|number} itemId - ID de l'item
 */
function unpinItem(itemId) {
  const pinned = getPinnedItems();
  const filtered = pinned.filter(item => String(item.id) !== String(itemId));
  savePinnedItems(filtered);
  renderPinnedItemsBar();
}

/**
 * Rend la barre des items épinglés
 */
function renderPinnedItemsBar() {
  const pinned = getPinnedItems();
  
  // Supprimer l'ancienne barre si elle existe
  const existingBar = document.getElementById('vinted-pinned-items-bar');
  if (existingBar) {
    existingBar.remove();
  }
  
  if (pinned.length === 0) return;
  
  // Créer la barre
  const bar = document.createElement('div');
  bar.id = 'vinted-pinned-items-bar';
  bar.className = 'vinted-pinned-items-bar';
  bar.innerHTML = `
    <div class="vinted-pinned-items-container">
      ${pinned.map(item => `
        <div class="vinted-pinned-item" data-item-id="${item.id}">
          <img src="${item.photo || ''}" alt="${escapeHtml(item.title)}" class="vinted-pinned-item-photo">
          <button class="vinted-pinned-item-unpin" data-item-id="${item.id}" title="Désépingler">×</button>
        </div>
      `).join('')}
    </div>
  `;
  
  // Insérer après la navbar de Vinted
  const header = document.querySelector('header, .l-header, [class*="header"]');
  if (header) {
    header.insertAdjacentElement('afterend', bar);
  } else {
    document.body.insertBefore(bar, document.body.firstChild);
  }
  
  // Gestionnaires d'événements
  bar.querySelectorAll('.vinted-pinned-item').forEach(itemEl => {
    itemEl.addEventListener('click', async (e) => {
      if (e.target.classList.contains('vinted-pinned-item-unpin')) return;
      const itemId = itemEl.dataset.itemId;
      const item = pinned.find(p => String(p.id) === itemId);
      if (item) {
        await showItemDetails(itemId, item.slug);
      }
    });
  });
  
  bar.querySelectorAll('.vinted-pinned-item-unpin').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const itemId = btn.dataset.itemId;
      unpinItem(itemId);
    });
  });
}

// Initialiser quand le DOM est prêt
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    initItemClickInterceptor();
    renderPinnedItemsBar();
  });
} else {
  initItemClickInterceptor();
  renderPinnedItemsBar();
}

// Gérer le style de la barre lors du scroll (fond sombre et padding)
let lastScrollTop = 0;
window.addEventListener('scroll', () => {
  const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
  const bar = document.getElementById('vinted-pinned-items-bar');
  
  if (bar) {
    // Ajouter la classe 'scrolled' si on a scrollé plus de 50px
    if (scrollTop > 50) {
      bar.classList.add('scrolled');
      // Forcer le fond bleu marine avec style inline pour s'assurer qu'il s'applique
      bar.style.background = '#0f172a';
      bar.style.backgroundColor = '#0f172a';
    } else {
      bar.classList.remove('scrolled');
      // Remettre transparent quand on revient en haut
      bar.style.background = 'transparent';
      bar.style.backgroundColor = 'transparent';
    }
    
    // Réafficher la barre si nécessaire
    if (Math.abs(scrollTop - lastScrollTop) > 50) {
      bar.style.display = 'block';
    }
  }
  
  lastScrollTop = scrollTop;
});

