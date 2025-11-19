// Système de notification pour les nouveaux messages
import { fetchConversation, fetchInbox, formatConversationInfo, getUnreadConversations, sendMessage, sendOfferRequest } from './messagesApi.js';

// Configuration
const CONFIG = {
  SHOW_EXISTING_UNREAD: true, // Afficher les notifications pour les messages déjà non lus au démarrage
};

// État du système de notifications
const notificationState = {
  knownConversationIds: new Set(),
  knownUnreadIds: new Set(), // IDs des conversations connues comme non lues
  isInitialized: false,
  pollInterval: null,
  activeNotifications: new Map(), // Map<conversationId, notificationElement>
};

/**
 * Crée ou récupère le conteneur de notifications
 * @returns {HTMLElement} - Conteneur de notifications
 */
function getNotificationContainer() {
  let container = document.getElementById('vinted-notif-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'vinted-notif-container';
    container.className = 'vinted-notif-container';
    document.body.appendChild(container);
  }
  return container;
}

/**
 * Crée une notification popup pour une conversation
 * @param {Object} conversationInfo - Informations de la conversation
 * @returns {HTMLElement} - Élément de notification
 */
function createNotificationElement(conversationInfo) {
  const notification = document.createElement('div');
  notification.className = 'vinted-message-notification';
  notification.dataset.conversationId = conversationInfo.id;
  notification.dataset.expanded = 'false';
  
  notification.innerHTML = `
    <button class="vinted-notif-close" aria-label="Fermer">×</button>
    <div class="vinted-notif-header">
      <img src="${conversationInfo.opposite_user.photo_url || 'https://via.placeholder.com/50'}" 
           alt="${conversationInfo.opposite_user.login}"
           class="vinted-notif-avatar">
    <div class="vinted-notif-content">
      <div class="vinted-notif-username">${conversationInfo.opposite_user.login}</div>
      <div class="vinted-notif-description">${conversationInfo.description}</div>
      </div>
      ${conversationInfo.item_photo ? `
        <img src="${conversationInfo.item_photo}" alt="Article" class="vinted-notif-item-photo">
      ` : ''}
    </div>
    <div class="vinted-notif-messages" style="display: none;">
      <div class="vinted-notif-messages-loading">Chargement...</div>
    </div>
  `;
  
  // Gestionnaire de clic pour déplier/replier la conversation
  const header = notification.querySelector('.vinted-notif-header');
  header.addEventListener('click', async (e) => {
    if (!e.target.classList.contains('vinted-notif-close')) {
      e.preventDefault();
      e.stopPropagation();
      await toggleNotificationExpansion(notification, conversationInfo.id);
    }
  });
  
  // Gestionnaire pour fermer la notification
  const closeBtn = notification.querySelector('.vinted-notif-close');
  closeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    removeNotification(conversationInfo.id);
  });
  
  return notification;
}

/**
 * Ajoute les styles CSS pour les notifications
 */
function injectNotificationStyles() {
  if (document.getElementById('vinted-notif-styles')) {
    return; // Styles déjà injectés
  }
  
  const style = document.createElement('style');
  style.id = 'vinted-notif-styles';
  style.textContent = `
    .vinted-notif-container {
      position: fixed;
      bottom: 20px;
      left: 20px;
      right: 20px;
      z-index: 10000;
      padding: 0;
      display: flex;
      flex-direction: row;
      align-items: flex-start;
      justify-content: flex-start;
      gap: 12px;
      overflow-x: auto;
      overflow-y: hidden;
      pointer-events: none;
    }
    
    /* Forcer la transparence du conteneur même en mode sombre */
    .vinted-dark-mode .vinted-notif-container,
    html.vinted-dark-mode .vinted-notif-container,
    body.vinted-dark-mode .vinted-notif-container {
      background: transparent !important;
      background-color: transparent !important;
    }
    
    .vinted-notif-container::-webkit-scrollbar {
      height: 6px;
    }
    
    .vinted-notif-container::-webkit-scrollbar-track {
      background: rgba(255, 255, 255, 0.1);
    }
    
    .vinted-notif-container::-webkit-scrollbar-thumb {
      background: rgba(255, 255, 255, 0.3);
      border-radius: 3px;
    }
    
    .vinted-notif-container::-webkit-scrollbar-thumb:hover {
      background: rgba(255, 255, 255, 0.5);
    }
    
    @keyframes slideUp {
      from {
        transform: translateY(100%);
        opacity: 0;
      }
      to {
        transform: translateY(0);
        opacity: 1;
      }
    }
    
    .vinted-message-notification {
      flex-shrink: 0;
      width: 250px;
      max-width: 250px;
      min-width: 250px;
      height: auto;
      max-height: none;
      min-height: auto;
      background: transparent !important;
      background-color: transparent !important;
      backdrop-filter: none;
      -webkit-backdrop-filter: none;
      border-radius: 12px;
      padding: 12px;
      cursor: pointer;
      transition: width 0.3s ease, max-width 0.3s ease, min-width 0.3s ease;
      position: relative;
      animation: popIn 0.3s ease;
      display: flex;
      flex-direction: column;
      align-self: flex-end;
      pointer-events: auto;
    }
    
    .vinted-message-notification.vinted-notif-expanded {
      width: 400px !important;
      max-width: 400px !important;
      min-width: 400px !important;
      max-height: 80vh !important;
      height: auto;
      align-self: flex-end;
    }
    
    .vinted-message-notification:not(.vinted-notif-expanded) {
      height: auto;
      max-height: none;
      align-self: flex-end;
    }
    
    .vinted-notif-header {
      display: flex;
      flex-direction: row;
      align-items: center;
      gap: 12px;
      background: rgba(30, 41, 59, 0.15) !important;
      background-color: rgba(30, 41, 59, 0.15) !important;
      backdrop-filter: blur(5px);
      -webkit-backdrop-filter: blur(5px);
      border-radius: 12px;
      padding: 12px;
    }
    
    .vinted-notif-avatar {
      width: 50px;
      height: 50px;
      border-radius: 50%;
      object-fit: cover;
      border: 2px solid #09B1BA;
      flex-shrink: 0;
    }
    
    .vinted-notif-content {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    
    .vinted-notif-username {
      font-weight: 700;
      font-size: 13px;
      color: #1a1a1a;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    
    .vinted-dark-mode .vinted-notif-username {
      color: #ffffff;
    }
    
    .vinted-notif-description {
      font-size: 11px;
      color: #666;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    
    .vinted-dark-mode .vinted-notif-description {
      color: #aaa;
    }
    
    .vinted-notif-item-photo {
      width: 50px;
      height: 50px;
      object-fit: cover;
      border-radius: 8px;
      border: 2px solid #f0f0f0;
      flex-shrink: 0;
    }
    
    .vinted-dark-mode .vinted-notif-item-photo {
      border-color: #333;
    }
    
    /* Forcer la transparence même en mode sombre */
    .vinted-dark-mode .vinted-message-notification,
    html.vinted-dark-mode .vinted-message-notification,
    body.vinted-dark-mode .vinted-message-notification {
      background: transparent !important;
      background-color: transparent !important;
    }
    
    .vinted-notif-messages {
      margin-top: 12px;
      padding-top: 12px;
      border-top: 1px solid rgba(0, 0, 0, 0.1);
      max-height: 400px;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      background: rgba(255, 255, 255, 0.15) !important;
      background-color: rgba(255, 255, 255, 0.15) !important;
      backdrop-filter: blur(5px);
      -webkit-backdrop-filter: blur(5px);
      border-radius: 12px;
      padding: 12px;
      scrollbar-width: none;
      -ms-overflow-style: none;
    }
    
    .vinted-notif-messages::-webkit-scrollbar {
      display: none;
    }
    
    .vinted-dark-mode .vinted-notif-messages {
      border-top-color: rgba(255, 255, 255, 0.1);
    }
    
    .vinted-dark-mode .vinted-notif-header,
    html.vinted-dark-mode .vinted-notif-header,
    body.vinted-dark-mode .vinted-notif-header {
      background: rgba(255, 255, 255, 0.25) !important;
      background-color: rgba(255, 255, 255, 0.25) !important;
    }
    
    .vinted-dark-mode .vinted-notif-messages,
    html.vinted-dark-mode .vinted-notif-messages,
    body.vinted-dark-mode .vinted-notif-messages {
      background: rgba(255, 255, 255, 0.25) !important;
      background-color: rgba(255, 255, 255, 0.25) !important;
    }
    
    
    .vinted-notif-messages-content {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }
    
    .vinted-notif-messages-loading,
    .vinted-notif-messages-error {
      text-align: center;
      padding: 1rem;
      color: #666;
      font-size: 0.875rem;
    }
    
    .vinted-dark-mode .vinted-notif-messages-loading,
    .vinted-dark-mode .vinted-notif-messages-error {
      color: #aaa;
    }
    
    .vinted-notif-messages-input-container {
      margin-top: 12px;
      padding-top: 12px;
      border-top: 1px solid rgba(0, 0, 0, 0.1);
      display: flex;
      gap: 8px;
      align-items: center;
    }
    
    .vinted-dark-mode .vinted-notif-messages-input-container {
      border-top-color: rgba(255, 255, 255, 0.1);
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
    
    .vinted-notif-messages-input:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
    
    .vinted-dark-mode .vinted-notif-messages-input {
      background: rgba(255, 255, 255, 0.1);
      border-color: rgba(255, 255, 255, 0.2);
      color: #ffffff;
    }
    
    .vinted-dark-mode .vinted-notif-messages-input:focus {
      background: rgba(255, 255, 255, 0.15);
      border-color: #09B1BA;
    }
    
    .vinted-notif-messages-input::placeholder {
      color: #999;
    }
    
    .vinted-dark-mode .vinted-notif-messages-input::placeholder {
      color: #666;
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
      padding: 0;
    }
    
    .vinted-notif-messages-send:hover:not(:disabled) {
      background: #078a91;
      transform: scale(1.05);
    }
    
    .vinted-notif-messages-send:active:not(:disabled) {
      transform: scale(0.95);
    }
    
    .vinted-notif-messages-send:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    
    .vinted-notif-messages-send svg {
      width: 18px;
      height: 18px;
    }
    
    /* Styles pour les messages dans la notification */
    .vinted-notif-messages .vinted-msg-item {
      max-width: 100%;
      font-size: 0.8125rem;
    }
    
    .vinted-notif-messages .vinted-msg-body {
      padding: 0.5rem 0.75rem;
      font-size: 0.8125rem;
    }
    
    .vinted-notif-messages .vinted-msg-time {
      font-size: 0.6875rem;
    }
    
    .vinted-notif-messages .vinted-msg-status,
    .vinted-notif-messages .vinted-msg-action,
    .vinted-notif-messages .vinted-msg-offer {
      padding: 0.5rem 0.75rem;
      font-size: 0.8125rem;
    }
    
    @keyframes popIn {
      from {
        transform: scale(0.8);
        opacity: 0;
      }
      to {
        transform: scale(1);
        opacity: 1;
      }
    }
    
    .vinted-message-notification:hover {
      transform: translateY(-4px);
      box-shadow: 0 6px 20px rgba(0, 0, 0, 0.25);
    }
    
    .vinted-notif-close {
      position: absolute;
      top: 4px;
      right: 4px;
      background: rgba(0, 0, 0, 0.1);
      border: none;
      border-radius: 50%;
      width: 24px;
      height: 24px;
      cursor: pointer;
      font-size: 16px;
      line-height: 1;
      color: #666;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s ease;
      font-weight: bold;
      z-index: 10;
    }
    
    .vinted-notif-close:hover {
      background: rgba(0, 0, 0, 0.2);
      color: #333;
      transform: scale(1.1);
    }
    
    
    /* Responsive */
    @media (max-width: 768px) {
      .vinted-message-notification {
        width: 160px;
      }
      
      .vinted-notif-avatar {
        width: 40px;
        height: 40px;
      }
      
      .vinted-notif-username {
        font-size: 12px;
      }
      
      .vinted-notif-description {
        font-size: 10px;
      }
      
      .vinted-notif-item-photo {
        height: 80px;
      }
    }
    
    /* Modal de conversation */
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
    
    .vinted-conversation-messages::-webkit-scrollbar {
      width: 6px;
    }
    
    .vinted-conversation-messages::-webkit-scrollbar-track {
      background: rgba(0, 0, 0, 0.05);
    }
    
    .vinted-conversation-messages::-webkit-scrollbar-thumb {
      background: rgba(0, 0, 0, 0.2);
      border-radius: 3px;
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
    
    .vinted-msg-status,
    .vinted-msg-action,
    .vinted-msg-offer {
      padding: 0.75rem 1rem;
      border-radius: 12px;
      background: #f8f8f8;
      border: 1px solid #e0e0e0;
    }
    
    .vinted-dark-mode .vinted-msg-status,
    .vinted-dark-mode .vinted-msg-action,
    .vinted-dark-mode .vinted-msg-offer {
      background: #2a2a2a;
      border-color: #404040;
    }
    
    .vinted-msg-status-title,
    .vinted-msg-action-title,
    .vinted-msg-offer-title {
      font-weight: 600;
      font-size: 1rem;
      margin-bottom: 0.25rem;
    }
    
    .vinted-msg-status-subtitle,
    .vinted-msg-action-subtitle {
      font-size: 1.25rem;
      color: #black;
      font-weight: 600;
    }
    
    .vinted-dark-mode .vinted-msg-status-subtitle,
    .vinted-dark-mode .vinted-msg-action-subtitle {
      color: #black;
    }
    
    .vinted-msg-offer-price {
      font-weight: 700;
      font-size: 1.125rem;
      color: #09B1BA;
      margin-top: 0.5rem;
    }
    
    .vinted-msg-offer-original {
      font-size: 0.8125rem;
      color: #999;
      text-decoration: line-through;
      margin-top: 0.25rem;
    }
    
    .vinted-msg-actions {
      display: flex;
      gap: 0.5rem;
      margin-top: 0.75rem;
    }
    
    .vinted-msg-action-btn {
      padding: 0.5rem 1rem;
      background: #09B1BA;
      color: white;
      border-radius: 8px;
      text-decoration: none;
      font-size: 0.875rem;
      font-weight: 500;
      transition: all 0.2s;
    }
    
    .vinted-msg-action-btn:hover {
      background: #078a91;
      transform: translateY(-1px);
    }
    
    .vinted-msg-time {
      font-size: 0.75rem;
      color: #999;
      margin-top: 0.25rem;
    }
    
    .vinted-dark-mode .vinted-msg-time {
      color: #666;
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
    
    @keyframes fadeIn {
      from {
        opacity: 0;
      }
      to {
        opacity: 1;
      }
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
    
    .vinted-notif-offer-btn {
      margin: 12px;
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
      background: rgba(255, 255, 255, 0.15) !important;
      background-color: rgba(255, 255, 255, 0.15) !important;
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
      border-radius: 12px;
      width: 90%;
      max-width: 400px;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
      animation: slideUp 0.3s ease;
    }
    
    .vinted-dark-mode .vinted-offer-modal-content {
      background: rgba(255, 255, 255, 0.15) !important;
      background-color: rgba(255, 255, 255, 0.15) !important;
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
    
    /* Styles pour le modal de détails de produit */
    .vinted-item-modal {
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
      overflow-y: auto;
      padding: 20px;
    }
    
    .vinted-item-modal-content {
      background: rgba(255, 255, 255, 0.05) !important;
      background-color: rgba(255, 255, 255, 0.05) !important;
      backdrop-filter: blur(3px);
      -webkit-backdrop-filter: blur(3px);
      border-radius: 12px;
      width: 90%;
      max-width: 900px;
      max-height: 90vh;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
      animation: slideUp 0.3s ease;
      position: relative;
      overflow-y: auto;
      scrollbar-width: none;
      -ms-overflow-style: none;
    }
    
    .vinted-item-modal-content::-webkit-scrollbar {
      display: none;
    }
    
    .vinted-dark-mode .vinted-item-modal-content {
      background: rgba(255, 255, 255, 0.05) !important;
      background-color: rgba(255, 255, 255, 0.05) !important;
      color: white;
    }
    
    .vinted-item-modal-close {
      position: absolute;
      top: 1rem;
      right: 1rem;
      background: rgba(0, 0, 0, 0.3);
      border: none;
      font-size: 1.5rem;
      cursor: pointer;
      color: white;
      padding: 0.5rem;
      width: 40px;
      height: 40px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 50%;
      transition: all 0.2s;
      z-index: 10;
    }
    
    .vinted-item-modal-close:hover {
      background: rgba(0, 0, 0, 0.5);
      transform: scale(1.1);
    }
    
    .vinted-item-modal-body {
      padding: 2rem;
    }
    
    .vinted-item-details {
      display: grid;
      grid-template-columns: 300px 1fr;
      gap: 2rem;
      align-items: start;
    }
    
    @media (max-width: 768px) {
      .vinted-item-details {
        grid-template-columns: 1fr;
      }
    }
    
    .vinted-item-photos {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      position: sticky;
      top: 2rem;
    }
    
    .vinted-item-photo-main {
      width: 100%;
      max-width: 300px;
      aspect-ratio: 1;
      overflow: hidden;
      border-radius: 8px;
      background: rgba(255, 255, 255, 0.1);
    }
    
    .vinted-item-photo-main img {
      width: 100%;
      height: 100%;
      object-fit: contain;
    }
    
    .vinted-item-photo-thumbnails {
      display: flex;
      gap: 0.5rem;
      overflow-x: auto;
      scrollbar-width: none;
      -ms-overflow-style: none;
    }
    
    .vinted-item-photo-thumbnails::-webkit-scrollbar {
      display: none;
    }
    
    .vinted-item-photo-thumb {
      width: 60px;
      height: 60px;
      object-fit: cover;
      border-radius: 6px;
      cursor: pointer;
      opacity: 0.6;
      transition: all 0.2s;
      border: 2px solid transparent;
    }
    
    .vinted-item-photo-thumb:hover,
    .vinted-item-photo-thumb.active {
      opacity: 1;
      border-color: #09B1BA;
    }
    
    .vinted-item-info {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }
    
    .vinted-item-title {
      font-size: 1.5rem;
      font-weight: 600;
      margin: 0;
    }
    
    .vinted-item-price {
      font-size: 1.75rem;
      font-weight: 700;
      color: #09B1BA;
    }
    
    .vinted-item-meta {
      display: flex;
      flex-wrap: wrap;
      gap: 1rem;
    }
    
    .vinted-item-meta-item {
      padding: 0.5rem 1rem;
      background: rgba(255, 255, 255, 0.1);
      border-radius: 8px;
      font-size: 0.875rem;
    }
    
    .vinted-item-description {
      padding: 1rem;
      background: rgba(255, 255, 255, 0.05);
      backdrop-filter: blur(2px);
      -webkit-backdrop-filter: blur(2px);
      border-radius: 8px;
    }
    
    .vinted-item-description h3 {
      margin: 0 0 0.5rem 0;
      font-size: 1rem;
      font-weight: 600;
    }
    
    .vinted-item-description p {
      margin: 0;
      line-height: 1.6;
      white-space: pre-wrap;
    }
    
    .vinted-item-seller {
      padding: 1rem;
      background: rgba(255, 255, 255, 0.05);
      backdrop-filter: blur(2px);
      -webkit-backdrop-filter: blur(2px);
      border-radius: 8px;
    }
    
    .vinted-item-seller h3 {
      margin: 0 0 0.5rem 0;
      font-size: 1rem;
      font-weight: 600;
    }
    
    .vinted-item-seller-info {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }
    
    .vinted-item-seller-avatar {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      object-fit: cover;
    }
    
    .vinted-item-seller-name {
      font-weight: 500;
    }
    
    .vinted-item-actions {
      display: flex;
      gap: 1rem;
      flex-wrap: wrap;
    }
    
    .vinted-item-offer-btn,
    .vinted-item-message-btn {
      flex: 1;
      min-width: 150px;
      padding: 0.75rem 1.5rem;
      border: none;
      border-radius: 8px;
      font-size: 0.875rem;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s;
    }
    
    .vinted-item-offer-btn {
      background: #09B1BA;
      color: white;
    }
    
    .vinted-item-offer-btn:hover {
      background: #078a91;
      transform: translateY(-1px);
    }
    
    .vinted-item-message-btn {
      background: rgba(255, 255, 255, 0.2);
      color: white;
      border: 1px solid rgba(255, 255, 255, 0.3);
    }
    
    .vinted-item-message-btn:hover {
      background: rgba(255, 255, 255, 0.3);
    }
    
    .vinted-item-conversation {
      margin-top: 1rem;
      padding: 1rem;
      background: rgba(255, 255, 255, 0.05);
      backdrop-filter: blur(2px);
      -webkit-backdrop-filter: blur(2px);
      border-radius: 8px;
      max-height: 400px;
      display: flex;
      flex-direction: column;
    }
    
    .vinted-item-conversation-content {
      display: flex;
      flex-direction: column;
      height: 100%;
      max-height: 400px;
    }
    
    .vinted-item-messages-list {
      flex: 1;
      overflow-y: auto;
      scrollbar-width: none;
      -ms-overflow-style: none;
      padding: 0.5rem 0;
      max-height: 300px;
    }
    
    .vinted-item-messages-list::-webkit-scrollbar {
      display: none;
    }
    
    .vinted-item-messages-input-container {
      display: flex;
      gap: 0.5rem;
      align-items: center;
      margin-top: 0.75rem;
      padding-top: 0.75rem;
      border-top: 1px solid rgba(255, 255, 255, 0.1);
    }
    
    .vinted-item-messages-input {
      flex: 1;
      padding: 0.5rem 0.75rem;
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 20px;
      background: rgba(255, 255, 255, 0.05);
      backdrop-filter: blur(2px);
      -webkit-backdrop-filter: blur(2px);
      color: white;
      font-size: 0.875rem;
      outline: none;
    }
    
    .vinted-item-messages-input:focus {
      border-color: #09B1BA;
      background: rgba(255, 255, 255, 0.1);
    }
    
    .vinted-item-messages-send {
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
    }
    
    .vinted-item-messages-send:hover:not(:disabled) {
      background: #078a91;
      transform: scale(1.05);
    }
    
    .vinted-item-messages-send:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    
    .vinted-item-no-messages {
      text-align: center;
      padding: 2rem;
      color: rgba(255, 255, 255, 0.6);
      font-size: 0.875rem;
    }
    
    .vinted-item-conversation-loading,
    .vinted-item-conversation-error {
      text-align: center;
      padding: 1rem;
      color: rgba(255, 255, 255, 0.7);
    }
    
    /* Styles pour les messages dans la conversation de l'item */
    .vinted-item-messages-list .vinted-msg-item {
      margin-bottom: 0.75rem;
      padding: 0.5rem 0.75rem;
      border-radius: 8px;
      max-width: 80%;
      word-wrap: break-word;
    }
    
    .vinted-item-messages-list .vinted-msg-current-user {
      background: rgba(9, 177, 186, 0.2);
      backdrop-filter: blur(2px);
      -webkit-backdrop-filter: blur(2px);
      margin-left: auto;
      text-align: right;
    }
    
    .vinted-item-messages-list .vinted-msg-other-user {
      background: rgba(255, 255, 255, 0.05);
      backdrop-filter: blur(2px);
      -webkit-backdrop-filter: blur(2px);
      margin-right: auto;
    }
    
    .vinted-item-messages-list .vinted-msg-body {
      color: white;
      font-size: 0.875rem;
      line-height: 1.4;
      margin-bottom: 0.25rem;
    }
    
    .vinted-item-messages-list .vinted-msg-time {
      font-size: 0.6875rem;
      color: rgba(255, 255, 255, 0.6);
      margin-top: 0.25rem;
    }
    
    .vinted-item-pin-btn {
      padding: 0.5rem 1rem;
      background: rgba(255, 255, 255, 0.1);
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 8px;
      color: white;
      font-size: 0.875rem;
      cursor: pointer;
      transition: all 0.2s;
    }
    
    .vinted-item-pin-btn:hover {
      background: rgba(255, 255, 255, 0.2);
    }
    
    .vinted-item-pin-btn.pinned {
      background: rgba(9, 177, 186, 0.3);
      border-color: #09B1BA;
    }
    
    /* Barre des items épinglés */
    .vinted-pinned-items-bar {
      position: sticky;
      top: 0;
      z-index: 10001;
      background: transparent !important;
      background-color: transparent !important;
      backdrop-filter: none;
      -webkit-backdrop-filter: none;
      border-bottom: none;
      padding: 0.75rem 1rem;
      width: 100%;
      box-sizing: border-box;
      transition: all 0.3s ease;
    }
    
    .vinted-pinned-items-bar.scrolled {
      background: #0f172a !important;
      background-color: #0f172a !important;
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      padding: 1rem 1.5rem;
      margin-top: 60px; /* Espace pour la navbar de Vinted lors du scroll */
    }
    
    /* S'assurer que le fond est bien appliqué même avec d'autres styles */
    .vinted-pinned-items-bar.scrolled,
    html .vinted-pinned-items-bar.scrolled,
    body .vinted-pinned-items-bar.scrolled {
      background: #0f172a !important;
      background-color: #0f172a !important;
    }
    
    .vinted-pinned-items-container {
      display: flex;
      gap: 0.75rem;
      overflow-x: auto;
      scrollbar-width: none;
      -ms-overflow-style: none;
      max-width: 100%;
    }
    
    .vinted-pinned-items-container::-webkit-scrollbar {
      display: none;
    }
    
    .vinted-pinned-item {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0;
      background: transparent;
      backdrop-filter: none;
      -webkit-backdrop-filter: none;
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.2s;
      width: 60px;
      height: 60px;
      flex-shrink: 0;
      position: relative;
    }
    
    .vinted-pinned-item:hover {
      background: transparent;
      transform: translateY(-2px);
    }
    
    .vinted-pinned-item-photo {
      width: 100%;
      height: 100%;
      object-fit: cover;
      border-radius: 8px;
    }
    
    .vinted-pinned-item-unpin {
      position: absolute;
      top: -8px;
      right: -8px;
      width: 24px;
      height: 24px;
      border-radius: 50%;
      background: rgba(220, 38, 38, 0.8);
      border: none;
      color: white;
      font-size: 1.25rem;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      line-height: 1;
      transition: all 0.2s;
    }
    
    .vinted-pinned-item-unpin:hover {
      background: rgba(220, 38, 38, 1);
      transform: scale(1.1);
    }
  `;
  
  document.head.appendChild(style);
}

/**
 * Affiche un dialogue pour faire une offre
 * @param {string|number} transactionId - ID de la transaction
 * @param {string|number} conversationId - ID de la conversation
 * @param {HTMLElement} messagesContainer - Conteneur des messages
 * @param {Object} transaction - Objet transaction
 */
function showOfferDialog(transactionId, conversationId, messagesContainer, transaction) {
  // Créer le modal
  const modal = document.createElement('div');
  modal.className = 'vinted-offer-modal';
  modal.innerHTML = `
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
  
  document.body.appendChild(modal);
  
  const priceInput = modal.querySelector('.vinted-offer-price-input');
  const submitBtn = modal.querySelector('.vinted-offer-modal-submit');
  const cancelBtn = modal.querySelector('.vinted-offer-modal-cancel');
  const closeBtn = modal.querySelector('.vinted-offer-modal-close');
  
  const closeModal = () => {
    document.body.removeChild(modal);
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
      await sendOfferRequest(transactionId, price, 'EUR');
      
      // Recharger la conversation pour afficher la nouvelle offre
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
      
      // Faire défiler vers le bas
      setTimeout(() => {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
      }, 100);
      
      closeModal();
    } catch (error) {
      console.error("[Vinted Messages] Erreur lors de l'envoi de l'offre:", error);
      alert("Erreur lors de l'envoi de l'offre. Veuillez réessayer.");
      submitBtn.disabled = false;
      submitBtn.textContent = 'Envoyer l\'offre';
    }
  };
  
  submitBtn.addEventListener('click', handleSubmit);
  cancelBtn.addEventListener('click', closeModal);
  closeBtn.addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
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
 * Affiche une notification pour une nouvelle conversation non lue
 * @param {Object} conversationInfo - Informations de la conversation
 */
function showNotification(conversationInfo) {
  // Ne pas afficher si déjà affichée
  if (notificationState.activeNotifications.has(conversationInfo.id)) {
    return;
  }
  
  const container = getNotificationContainer();
  const notification = createNotificationElement(conversationInfo);
  container.appendChild(notification);
  
  notificationState.activeNotifications.set(conversationInfo.id, notification);
  
  console.log(`[Vinted Messages] Notification affichée pour la conversation ${conversationInfo.id}`);
}

/**
 * Supprime une notification
 * @param {string} conversationId - ID de la conversation
 */
function removeNotification(conversationId) {
  const notification = notificationState.activeNotifications.get(conversationId);
  
  if (notification) {
    notification.style.animation = 'popIn 0.3s ease reverse';
    setTimeout(() => {
      notification.remove();
      notificationState.activeNotifications.delete(conversationId);
      
      // Supprimer le conteneur s'il est vide
      const container = document.getElementById('vinted-notif-container');
      if (container && container.children.length === 0) {
        container.remove();
      }
    }, 300);
  }
}

/**
 * Formate un message pour l'affichage
 * @param {Object} message - Message de la conversation
 * @param {number} currentUserId - ID de l'utilisateur actuel
 * @param {string} conversationUrl - URL de la conversation
 * @param {Object} transaction - Transaction de la conversation (optionnel)
 * @returns {string} - HTML formaté du message
 */
function formatMessage(message, currentUserId, conversationUrl, transaction = null) {
  const isCurrentUser = message.entity?.user_id === currentUserId;
  const messageClass = isCurrentUser ? 'vinted-msg-current-user' : 'vinted-msg-other-user';
  const timeAgo = message.created_time_ago || new Date(message.created_at_ts).toLocaleString('fr-FR');
  
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
              // Construire l'URL de l'action si nécessaire
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
    content = `
      <div class="vinted-msg-offer">
        <div class="vinted-msg-offer-title">${escapeHtml(message.entity.title)}</div>
        <div class="vinted-msg-offer-price">${escapeHtml(message.entity.price_label)}</div>
        ${message.entity.original_price_label ? `<div class="vinted-msg-offer-original">${escapeHtml(message.entity.original_price_label)}</div>` : ''}
      </div>
    `;
  }
  
  return `
    <div class="vinted-msg-item ${messageClass}">
      ${content}
      <div class="vinted-msg-time">${timeAgo}</div>
    </div>
  `;
}

/**
 * Échappe le HTML pour éviter les injections XSS
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Déplie ou replie une notification pour afficher les messages
 * @param {HTMLElement} notification - Élément de notification
 * @param {string|number} conversationId - ID de la conversation
 */
async function toggleNotificationExpansion(notification, conversationId) {
  const isExpanded = notification.dataset.expanded === 'true';
  const messagesContainer = notification.querySelector('.vinted-notif-messages');
  
  if (isExpanded) {
    // Replier
    notification.dataset.expanded = 'false';
    messagesContainer.style.display = 'none';
    notification.classList.remove('vinted-notif-expanded');
  } else {
    // Déplier
    notification.dataset.expanded = 'true';
    notification.classList.add('vinted-notif-expanded');
    messagesContainer.style.display = 'block';
    
    // Charger les messages si pas déjà chargés
    if (messagesContainer.querySelector('.vinted-notif-messages-loading')) {
      try {
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
        
        // Construire le HTML des messages
        const conversationUrl = conversation.conversation_url || `https://www.vinted.fr/inbox/${conversationId}`;
        const transaction = conversation.transaction || null;
        const messagesHtml = conversation.messages.map(msg => formatMessage(msg, currentUserId, conversationUrl, transaction)).join('');
        
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
        
        messagesContainer.innerHTML = `
          <div class="vinted-notif-messages-content">
            ${messagesHtml}
          </div>
          ${offerButtonHtml}
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
        `;
        
        // Ajouter le gestionnaire d'envoi de message
        const input = messagesContainer.querySelector('.vinted-notif-messages-input');
        const sendBtn = messagesContainer.querySelector('.vinted-notif-messages-send');
        
        const handleSend = async () => {
          const messageText = input.value.trim();
          if (!messageText) return;
          
          // Désactiver l'input et le bouton pendant l'envoi
          input.disabled = true;
          sendBtn.disabled = true;
          sendBtn.style.opacity = '0.5';
          
          try {
            await sendMessage(conversationId, messageText);
            
            // Vider l'input
            input.value = '';
            
            // Recharger la conversation pour afficher le nouveau message
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
            
            // Faire défiler vers le bas
            setTimeout(() => {
              messagesContainer.scrollTop = messagesContainer.scrollHeight;
            }, 100);
            
          } catch (error) {
            console.error("[Vinted Messages] Erreur lors de l'envoi:", error);
            alert("Erreur lors de l'envoi du message. Veuillez réessayer.");
          } finally {
            // Réactiver l'input et le bouton
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
        
        // Gestionnaire pour le bouton d'offre
        if (hasTransaction) {
          const offerBtn = messagesContainer.querySelector('.vinted-notif-offer-btn');
          if (offerBtn) {
            offerBtn.addEventListener('click', () => {
              showOfferDialog(transaction.id, conversationId, messagesContainer, transaction);
            });
          }
        }
        
        // Faire défiler vers le bas et focus sur l'input
        setTimeout(() => {
          messagesContainer.scrollTop = messagesContainer.scrollHeight;
          input.focus();
        }, 100);
        
      } catch (error) {
        console.error("[Vinted Messages] Erreur lors du chargement de la conversation:", error);
        messagesContainer.innerHTML = '<div class="vinted-notif-messages-error">Erreur lors du chargement</div>';
      }
    }
  }
}

/**
 * Affiche une modal avec la conversation (ancienne fonction, conservée pour compatibilité)
 * @param {string|number} conversationId - ID de la conversation
 */
async function showConversationModal(conversationId) {
  try {
    // Afficher un loader
    const modal = createModalElement();
    document.body.appendChild(modal);
    
    const conversation = await fetchConversation(conversationId);
    
    // Déterminer l'ID de l'utilisateur actuel en analysant les messages
    // L'utilisateur actuel est celui qui n'est pas l'opposite_user
    const oppositeUserId = conversation.opposite_user.id;
    let currentUserId = oppositeUserId; // Par défaut
    
    // Chercher un message de l'utilisateur actuel
    for (const msg of conversation.messages) {
      if (msg.entity_type === 'message' && msg.entity?.user_id && msg.entity.user_id !== oppositeUserId) {
        currentUserId = msg.entity.user_id;
        break;
      }
    }
    
    // Construire le HTML de la conversation
    const conversationUrl = conversation.conversation_url || `https://www.vinted.fr/inbox/${conversationId}`;
    const transaction = conversation.transaction || null;
    const messagesHtml = conversation.messages.map(msg => formatMessage(msg, currentUserId, conversationUrl, transaction)).join('');
    
    const modalContent = modal.querySelector('.vinted-conversation-content');
    modalContent.innerHTML = `
      <div class="vinted-conversation-header">
        <div class="vinted-conversation-user">
          <img src="${conversation.opposite_user.photo?.thumbnails?.find(t => t.type === "thumb100")?.url || conversation.opposite_user.photo?.url || 'https://via.placeholder.com/50'}" 
               alt="${conversation.opposite_user.login}"
               class="vinted-conversation-avatar">
          <div class="vinted-conversation-user-info">
            <div class="vinted-conversation-username">${escapeHtml(conversation.opposite_user.login)}</div>
            ${conversation.subtitle ? `<div class="vinted-conversation-subtitle">${escapeHtml(conversation.subtitle)}</div>` : ''}
          </div>
        </div>
        <button class="vinted-conversation-close" aria-label="Fermer">×</button>
      </div>
      <div class="vinted-conversation-messages">
        ${messagesHtml}
      </div>
      <div class="vinted-conversation-footer">
        <a href="${conversation.conversation_url}" target="_blank" class="vinted-conversation-link">
          Ouvrir sur Vinted →
        </a>
      </div>
    `;
    
    // Gestionnaire pour fermer la modal
    const closeBtn = modal.querySelector('.vinted-conversation-close');
    closeBtn.addEventListener('click', () => closeModal(modal));
    
    // Fermer en cliquant sur l'overlay
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeModal(modal);
      }
    });
    
    // Fermer avec Escape
    const escapeHandler = (e) => {
      if (e.key === 'Escape') {
        closeModal(modal);
        document.removeEventListener('keydown', escapeHandler);
      }
    };
    document.addEventListener('keydown', escapeHandler);
    
    // Faire défiler vers le bas pour voir les derniers messages
    const messagesContainer = modal.querySelector('.vinted-conversation-messages');
    setTimeout(() => {
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }, 100);
    
  } catch (error) {
    console.error("[Vinted Messages] Erreur lors de l'affichage de la conversation:", error);
    alert("Erreur lors du chargement de la conversation. Veuillez réessayer.");
  }
}

/**
 * Crée l'élément modal
 */
function createModalElement() {
  const modal = document.createElement('div');
  modal.className = 'vinted-conversation-modal';
  modal.innerHTML = `
    <div class="vinted-conversation-container">
      <div class="vinted-conversation-content">
        <div class="vinted-conversation-loading">Chargement...</div>
      </div>
    </div>
  `;
  return modal;
}

/**
 * Ferme la modal
 */
function closeModal(modal) {
  modal.style.opacity = '0';
  setTimeout(() => {
    modal.remove();
  }, 300);
}

/**
 * Vérifie les nouveaux messages et affiche les notifications
 */
async function checkNewMessages() {
  try {
    const data = await fetchInbox();
    const unreadConversations = getUnreadConversations(data.conversations);
    
    // Première initialisation
    if (!notificationState.isInitialized) {
      // Mémoriser toutes les conversations
      data.conversations.forEach(conv => {
        notificationState.knownConversationIds.add(conv.id);
        if (conv.unread) {
          notificationState.knownUnreadIds.add(conv.id);
        }
      });
      
      notificationState.isInitialized = true;
      console.log(`[Vinted Messages] Initialisé avec ${notificationState.knownConversationIds.size} conversations connues`);
      
      // Si la config est activée, afficher les notifications pour les messages déjà non lus
      if (CONFIG.SHOW_EXISTING_UNREAD && unreadConversations.length > 0) {
        console.log(`[Vinted Messages] ${unreadConversations.length} message(s) non lu(s) trouvé(s) au démarrage`);
        for (const conv of unreadConversations) {
          const convInfo = formatConversationInfo(conv);
          showNotification(convInfo);
        }
      }
      
      return;
    }
    
    // Créer un Set des IDs des conversations non lues actuelles
    const currentUnreadIds = new Set(unreadConversations.map(c => c.id));
    
    // Détecter les conversations qui sont devenues non lues (nouvelles ou qui redeviennent non lues)
    const newlyUnreadConversations = unreadConversations.filter(conv => {
      // Soit c'est une nouvelle conversation, soit elle était lue avant et est maintenant non lue
      const isNew = !notificationState.knownConversationIds.has(conv.id);
      const becameUnread = !notificationState.knownUnreadIds.has(conv.id) && currentUnreadIds.has(conv.id);
      return isNew || becameUnread;
    });
    
    // Afficher les notifications pour les conversations nouvellement non lues
    for (const conv of newlyUnreadConversations) {
      // Ne pas afficher si déjà affichée
      if (!notificationState.activeNotifications.has(conv.id)) {
      const convInfo = formatConversationInfo(conv);
      showNotification(convInfo);
        console.log(`[Vinted Messages] Nouvelle notification pour la conversation ${conv.id}`);
      }
    }
    
    // Mettre à jour la liste des conversations connues
    data.conversations.forEach(conv => {
      notificationState.knownConversationIds.add(conv.id);
      if (conv.unread) {
        notificationState.knownUnreadIds.add(conv.id);
      } else {
        notificationState.knownUnreadIds.delete(conv.id);
      }
    });
    
    // Fermer les notifications pour les conversations qui ne sont plus non lues
    for (const [convId, notification] of notificationState.activeNotifications) {
      if (!currentUnreadIds.has(convId)) {
        removeNotification(convId);
        notificationState.knownUnreadIds.delete(convId);
      }
    }
    
    if (newlyUnreadConversations.length > 0) {
      console.log(`[Vinted Messages] ${newlyUnreadConversations.length} conversation(s) nouvellement non lue(s)`);
    }
    
  } catch (error) {
    console.error("[Vinted Messages] Erreur lors de la vérification des messages:", error);
  }
}

/**
 * Démarre le système de notifications
 * @param {number} intervalMs - Intervalle de vérification en millisecondes (par défaut 10000 = 10s)
 */
export function startMessageNotifications(intervalMs = 10000) {
  // Injecter les styles
  injectNotificationStyles();
  
  // Ne pas démarrer si déjà en cours
  if (notificationState.pollInterval) {
    console.log("[Vinted Messages] Notifications déjà actives");
    return;
  }
  
  console.log(`[Vinted Messages] Démarrage des notifications (intervalle: ${intervalMs}ms)`);
  
  // Première vérification immédiate
  checkNewMessages();
  
  // Vérifications périodiques
  notificationState.pollInterval = setInterval(checkNewMessages, intervalMs);
}

/**
 * Arrête le système de notifications
 */
export function stopMessageNotifications() {
  if (notificationState.pollInterval) {
    clearInterval(notificationState.pollInterval);
    notificationState.pollInterval = null;
    console.log("[Vinted Messages] Notifications arrêtées");
  }
  
  // Supprimer toutes les notifications actives
  for (const convId of notificationState.activeNotifications.keys()) {
    removeNotification(convId);
  }
}

/**
 * Réinitialise l'état des notifications
 */
export function resetNotificationState() {
  stopMessageNotifications();
  notificationState.knownConversationIds.clear();
  notificationState.isInitialized = false;
}

