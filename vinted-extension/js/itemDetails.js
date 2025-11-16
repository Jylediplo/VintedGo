// Gestion de l'affichage des détails de produit dans une fenêtre transparente
import { fetchItemDetails, sendOfferRequest, fetchConversation, sendMessage, fetchInbox } from './messagesApi.js';

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
  
  // Informations du produit
  const price = item.price ? `${item.price} ${item.currency || 'EUR'}` : 'Prix non disponible';
  const size = item.size || 'Taille non spécifiée';
  const brand = item.brand || 'Marque non spécifiée';
  const condition = item.condition || 'État non spécifié';
  const description = item.description || 'Aucune description';
  
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
          <button class="vinted-item-message-btn" data-user-id="${seller.id || ''}" data-item-id="${item.id}">Contacter le vendeur</button>
        </div>
        <div class="vinted-item-conversation" id="vinted-item-conversation-${item.id}">
          <div class="vinted-item-conversation-loading">Chargement de la conversation...</div>
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
  
  // Gestionnaire pour le bouton de message
  const messageBtn = body.querySelector('.vinted-item-message-btn');
  if (messageBtn && seller.id) {
    messageBtn.addEventListener('click', async () => {
      await showConversationForItem(item.id, seller.id, modal, item);
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
  
  // Charger automatiquement la conversation si elle existe
  if (seller.id) {
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
    
    // Pour l'instant, on ne peut pas faire d'offre directement sur un item
    // Il faut d'abord créer une transaction/conversation
    // On va afficher un message d'information
    alert('Pour faire une offre, veuillez d\'abord contacter le vendeur.');
    closeOfferModal();
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
      // Charger les détails de la conversation
      const conversationDetails = await fetchConversation(conversation.id);
      renderConversation(conversationContainer, conversationDetails, itemId, item);
    } else {
      // Aucune conversation trouvée, afficher un message vide avec la barre d'envoi
      renderEmptyConversation(conversationContainer, userId, itemId, item);
    }
  } catch (error) {
    console.error("[Vinted Item] Erreur lors du chargement de la conversation:", error);
    conversationContainer.innerHTML = '<div class="vinted-item-conversation-error">Erreur lors du chargement de la conversation.</div>';
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
      if (conversation.id) {
        await sendMessage(conversation.id, messageText);
        // Recharger la conversation
        const updatedConversation = await fetchConversation(conversation.id);
        renderConversation(container, updatedConversation, itemId, item);
      } else {
        // Créer une nouvelle conversation (nécessite l'API Vinted)
        alert('Pour envoyer un message, veuillez d\'abord contacter le vendeur depuis la page du produit.');
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
  
  // Pour l'instant, on ne peut pas créer de conversation directement
  // L'utilisateur devra utiliser le bouton "Contacter le vendeur" sur la page Vinted
  const input = container.querySelector('.vinted-item-messages-input');
  const sendBtn = container.querySelector('.vinted-item-messages-send');
  
  sendBtn.addEventListener('click', () => {
    alert('Pour envoyer un message, veuillez d\'abord contacter le vendeur depuis la page du produit.');
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
          <div class="vinted-pinned-item-info">
            <div class="vinted-pinned-item-title">${escapeHtml(item.title)}</div>
            <div class="vinted-pinned-item-price">${escapeHtml(item.price)} ${escapeHtml(item.currency)}</div>
          </div>
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

// Réafficher la barre après un scroll (pour s'assurer qu'elle reste visible)
let lastScrollTop = 0;
window.addEventListener('scroll', () => {
  const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
  if (Math.abs(scrollTop - lastScrollTop) > 50) {
    const bar = document.getElementById('vinted-pinned-items-bar');
    if (bar) {
      bar.style.display = 'block';
    }
    lastScrollTop = scrollTop;
  }
});

