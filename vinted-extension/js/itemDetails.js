// Gestion de l'affichage des détails de produit dans une fenêtre transparente
import { createConversationForItem, createTransactionForItem, fetchConversation, fetchInbox, fetchItemDetails, sendMessage, sendOfferRequest } from './messagesApi.js';
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
 * Affiche un skeleton de chargement dans le modal
 * @param {HTMLElement} modalBody - Corps du modal
 */
function renderItemDetailsSkeleton(modalBody) {
  modalBody.innerHTML = `
    <div class="vinted-item-details-skeleton">
      <div class="vinted-item-skeleton-photos">
        <div class="vinted-item-skeleton-photo-main"></div>
        <div class="vinted-item-skeleton-thumbnails">
          <div class="vinted-item-skeleton-thumb"></div>
          <div class="vinted-item-skeleton-thumb"></div>
          <div class="vinted-item-skeleton-thumb"></div>
        </div>
      </div>
      <div class="vinted-item-skeleton-info">
        <div class="vinted-item-skeleton-title"></div>
        <div class="vinted-item-skeleton-price"></div>
        <div class="vinted-item-skeleton-meta">
          <div class="vinted-item-skeleton-meta-row">
            <div class="vinted-item-skeleton-label"></div>
            <div class="vinted-item-skeleton-value"></div>
          </div>
          <div class="vinted-item-skeleton-meta-row">
            <div class="vinted-item-skeleton-label"></div>
            <div class="vinted-item-skeleton-value"></div>
          </div>
          <div class="vinted-item-skeleton-meta-row">
            <div class="vinted-item-skeleton-label"></div>
            <div class="vinted-item-skeleton-value"></div>
          </div>
        </div>
        <div class="vinted-item-skeleton-description">
          <div class="vinted-item-skeleton-line"></div>
          <div class="vinted-item-skeleton-line"></div>
          <div class="vinted-item-skeleton-line short"></div>
        </div>
        <div class="vinted-item-skeleton-seller">
          <div class="vinted-item-skeleton-avatar"></div>
          <div class="vinted-item-skeleton-seller-name"></div>
        </div>
        <div class="vinted-item-skeleton-actions">
          <div class="vinted-item-skeleton-button"></div>
          <div class="vinted-item-skeleton-button"></div>
        </div>
      </div>
    </div>
  `;
}

/**
 * Affiche les détails d'un produit dans une fenêtre modale transparente
 * @param {string|number} itemId - ID du produit
 * @param {string} itemSlug - Nom/slug du produit (optionnel)
 */
/**
 * Injecte les styles CSS pour le modal de détails d'article si nécessaire
 */
function ensureItemModalStyles() {
  if (document.getElementById('vinted-item-modal-styles')) {
    return; // Styles déjà injectés
  }
  
  const style = document.createElement('style');
  style.id = 'vinted-item-modal-styles';
  style.textContent = `
    .vinted-item-modal {
      position: fixed !important;
      top: 0 !important;
      left: 0 !important;
      right: 0 !important;
      bottom: 0 !important;
      background: rgba(0, 0, 0, 0.5) !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      z-index: 999999 !important;
      animation: fadeIn 0.2s ease;
      overflow-y: auto !important;
      padding: 20px !important;
    }
    
    .vinted-item-modal-content {
      background: rgba(255, 255, 255, 0.95) !important;
      background-color: rgba(255, 255, 255, 0.95) !important;
      backdrop-filter: blur(10px) !important;
      -webkit-backdrop-filter: blur(10px) !important;
      border-radius: 12px !important;
      width: 90% !important;
      max-width: 900px !important;
      max-height: 90vh !important;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2) !important;
      animation: slideUp 0.3s ease;
      position: relative !important;
      overflow-y: auto !important;
      scrollbar-width: none !important;
      -ms-overflow-style: none !important;
    }
    
    .vinted-item-modal-content::-webkit-scrollbar {
      display: none !important;
    }
    
    .vinted-dark-mode .vinted-item-modal-content {
      background: rgba(30, 30, 30, 0.95) !important;
      background-color: rgba(30, 30, 30, 0.95) !important;
      color: white !important;
    }
    
    .vinted-item-modal-close {
      position: absolute !important;
      top: 1rem !important;
      right: 1rem !important;
      background: rgba(0, 0, 0, 0.3) !important;
      border: none !important;
      font-size: 1.5rem !important;
      cursor: pointer !important;
      color: white !important;
      padding: 0.5rem !important;
      width: 40px !important;
      height: 40px !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      border-radius: 50% !important;
      transition: all 0.2s !important;
      z-index: 10 !important;
    }
    
    .vinted-item-modal-close:hover {
      background: rgba(0, 0, 0, 0.5) !important;
      transform: scale(1.1) !important;
    }
    
    .vinted-item-modal-body {
      padding: 2rem !important;
    }
    
    .vinted-item-loading {
      padding: 2rem !important;
      text-align: center !important;
      color: #666 !important;
      font-size: 1rem !important;
    }
    
    .vinted-dark-mode .vinted-item-loading {
      color: rgba(255, 255, 255, 0.7) !important;
    }
    
    .vinted-item-details {
      display: grid !important;
      grid-template-columns: 300px 1fr !important;
      gap: 2rem !important;
      align-items: start !important;
    }
    
    @media (max-width: 768px) {
      .vinted-item-details {
        grid-template-columns: 1fr !important;
      }
    }
    
    .vinted-item-photos {
      display: flex !important;
      flex-direction: column !important;
      gap: 0.75rem !important;
      position: sticky !important;
      top: 2rem !important;
    }
    
    .vinted-item-photo-main {
      width: 100% !important;
      max-width: 300px !important;
      aspect-ratio: 1 !important;
      overflow: hidden !important;
      border-radius: 8px !important;
      background: rgba(255, 255, 255, 0.1) !important;
    }
    
    .vinted-item-photo-main img {
      width: 100% !important;
      height: 100% !important;
      object-fit: contain !important;
    }
    
    .vinted-item-photo-thumbnails {
      display: flex !important;
      flex-wrap: wrap !important;
      gap: 0.5rem !important;
      overflow-x: auto !important;
      overflow-y: visible !important;
      scrollbar-width: none !important;
      -ms-overflow-style: none !important;
      max-width: 100% !important;
      padding: 0.25rem 0 !important;
    }
    
    .vinted-item-photo-thumbnails::-webkit-scrollbar {
      display: none !important;
    }
    
    .vinted-item-photo-thumb {
      width: 60px !important;
      height: 60px !important;
      min-width: 60px !important;
      min-height: 60px !important;
      max-width: 60px !important;
      max-height: 60px !important;
      object-fit: cover !important;
      border-radius: 6px !important;
      cursor: pointer !important;
      opacity: 0.7 !important;
      transition: all 0.2s !important;
      border: 2px solid transparent !important;
      flex-shrink: 0 !important;
      display: block !important;
      visibility: visible !important;
      background: #f0f0f0 !important;
    }
    
    .vinted-item-photo-thumb:hover {
      opacity: 1 !important;
      border-color: #09B1BA !important;
      transform: scale(1.05) !important;
    }
    
    .vinted-item-photo-thumb.active {
      opacity: 1 !important;
      border-color: #09B1BA !important;
      border-width: 2px !important;
      box-shadow: 0 0 0 2px rgba(9, 177, 186, 0.3) !important;
    }
    
    .vinted-item-info {
      display: flex !important;
      flex-direction: column !important;
      gap: 1rem !important;
    }
    
    .vinted-item-title {
      font-size: 1.5rem !important;
      font-weight: 600 !important;
      margin: 0 !important;
      color: #1a1a1a !important;
    }
    
    .vinted-dark-mode .vinted-item-title {
      color: #ffffff !important;
    }
    
    .vinted-item-price-container {
      display: flex !important;
      flex-direction: column !important;
      gap: 0.25rem !important;
      margin-bottom: 0.5rem !important;
    }
    
    .vinted-item-price {
      font-size: 1.75rem !important;
      font-weight: 700 !important;
      color: #09B1BA !important;
    }
    
    .vinted-item-price-with-fees {
      font-size: 1rem !important;
      font-weight: 500 !important;
      color: #64748b !important;
      display: flex !important;
      align-items: center !important;
      gap: 0.25rem !important;
    }
    
    .vinted-item-price-fees-label {
      font-size: 0.875rem !important;
      color: #94a3b8 !important;
      font-weight: 400 !important;
    }
    
    .vinted-dark-mode .vinted-item-price-with-fees {
      color: #94a3b8 !important;
    }
    
    .vinted-dark-mode .vinted-item-price-fees-label {
      color: #64748b !important;
    }
    
    .vinted-item-status {
      display: flex !important;
      align-items: center !important;
      gap: 0.5rem !important;
      padding: 0.5rem 0 !important;
      font-size: 0.875rem !important;
    }
    
    .vinted-item-status-label {
      font-weight: 600 !important;
      color: #666 !important;
    }
    
    .vinted-dark-mode .vinted-item-status-label {
      color: rgba(255, 255, 255, 0.8) !important;
    }
    
    .vinted-item-status-value {
      font-weight: 500 !important;
      color: #333 !important;
    }
    
    .vinted-dark-mode .vinted-item-status-value {
      color: rgba(255, 255, 255, 0.9) !important;
    }
    
    .vinted-item-status-sold .vinted-item-status-value {
      color: #ef4444 !important;
      font-weight: 600 !important;
    }
    
    .vinted-item-meta {
      display: flex !important;
      flex-direction: column !important;
      gap: 0.75rem !important;
      padding: 1rem !important;
      background: rgba(0, 0, 0, 0.05) !important;
      border-radius: 8px !important;
    }
    
    .vinted-dark-mode .vinted-item-meta {
      background: rgba(255, 255, 255, 0.05) !important;
    }
    
    .vinted-item-meta-row {
      display: flex !important;
      align-items: center !important;
      gap: 0.5rem !important;
    }
    
    .vinted-item-meta-label {
      font-weight: 600 !important;
      color: #666 !important;
      min-width: 80px !important;
    }
    
    .vinted-dark-mode .vinted-item-meta-label {
      color: rgba(255, 255, 255, 0.7) !important;
    }
    
    .vinted-item-meta-value {
      color: #333 !important;
    }
    
    .vinted-dark-mode .vinted-item-meta-value {
      color: rgba(255, 255, 255, 0.9) !important;
    }
    
    .vinted-item-description {
      padding: 1rem !important;
      background: rgba(0, 0, 0, 0.05) !important;
      border-radius: 8px !important;
    }
    
    .vinted-dark-mode .vinted-item-description {
      background: rgba(255, 255, 255, 0.05) !important;
    }
    
    .vinted-item-description h3 {
      margin: 0 0 0.5rem 0 !important;
      font-size: 1rem !important;
      font-weight: 600 !important;
    }
    
    .vinted-item-description p {
      margin: 0 !important;
      line-height: 1.6 !important;
      color: #333 !important;
      white-space: pre-wrap !important;
    }
    
    .vinted-dark-mode .vinted-item-description p {
      color: rgba(255, 255, 255, 0.9) !important;
    }
    
    .vinted-item-seller {
      padding: 1rem !important;
      background: rgba(0, 0, 0, 0.05) !important;
      border-radius: 8px !important;
    }
    
    .vinted-dark-mode .vinted-item-seller {
      background: rgba(255, 255, 255, 0.05) !important;
    }
    
    .vinted-item-seller h3 {
      margin: 0 0 0.5rem 0 !important;
      font-size: 1rem !important;
      font-weight: 600 !important;
    }
    
    .vinted-item-seller-info {
      display: flex !important;
      align-items: flex-start !important;
      gap: 0.75rem !important;
    }
    
    .vinted-item-seller-avatar {
      width: 40px !important;
      height: 40px !important;
      border-radius: 50% !important;
      object-fit: cover !important;
      flex-shrink: 0 !important;
    }
    
    .vinted-item-seller-details {
      display: flex !important;
      flex-direction: column !important;
      gap: 0.5rem !important;
      flex: 1 !important;
    }
    
    .vinted-item-seller-name-row {
      display: flex !important;
      align-items: center !important;
      gap: 0.5rem !important;
      flex-wrap: wrap !important;
    }
    
    .vinted-item-seller-name {
      font-weight: 500 !important;
      color: #333 !important;
    }
    
    .vinted-dark-mode .vinted-item-seller-name {
      color: rgba(255, 255, 255, 0.9) !important;
    }
    
    .vinted-item-seller-id {
      font-size: 0.75rem !important;
      color: #999 !important;
    }
    
    .vinted-dark-mode .vinted-item-seller-id {
      color: rgba(255, 255, 255, 0.6) !important;
    }
    
    .vinted-item-seller-rating {
      display: flex !important;
      align-items: center !important;
      gap: 0.5rem !important;
      flex-wrap: wrap !important;
    }
    
    .vinted-item-seller-rating-stars {
      color: #fbbf24 !important;
      font-size: 0.875rem !important;
      letter-spacing: 0.05em !important;
    }
    
    .vinted-item-seller-rating-value {
      font-size: 0.875rem !important;
      font-weight: 500 !important;
      color: #666 !important;
    }
    
    .vinted-dark-mode .vinted-item-seller-rating-value {
      color: rgba(255, 255, 255, 0.7) !important;
    }
    
    .vinted-item-seller-review-count {
      font-size: 0.75rem !important;
      color: #999 !important;
    }
    
    .vinted-dark-mode .vinted-item-seller-review-count {
      color: rgba(255, 255, 255, 0.6) !important;
    }
    
    .vinted-item-actions {
      display: flex !important;
      gap: 1rem !important;
      flex-wrap: wrap !important;
    }
    
    .vinted-item-pin-btn,
    .vinted-item-offer-btn,
    .vinted-item-buy-btn {
      flex: 1 !important;
      min-width: 150px !important;
      padding: 0.75rem 1.5rem !important;
      border: none !important;
      border-radius: 8px !important;
      font-size: 0.875rem !important;
      font-weight: 500 !important;
      cursor: pointer !important;
      transition: all 0.2s !important;
      color: white !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      gap: 0.5rem !important;
    }
    
    .vinted-item-pin-btn,
    .vinted-item-offer-btn {
      background: #09B1BA !important;
    }
    
    .vinted-item-buy-btn {
      background: #3b82f6 !important;
    }
    
    .vinted-item-pin-btn:hover:not(:disabled),
    .vinted-item-offer-btn:hover:not(:disabled) {
      background: #078a91 !important;
      transform: translateY(-1px) !important;
    }
    
    .vinted-item-buy-btn:hover:not(:disabled) {
      background: #2563eb !important;
      transform: translateY(-1px) !important;
    }
    
    .vinted-item-pin-btn:disabled,
    .vinted-item-offer-btn:disabled,
    .vinted-item-buy-btn:disabled {
      opacity: 0.7 !important;
      cursor: wait !important;
      background: #6b7280 !important;
    }
    
    .vinted-item-buy-btn .buy-icon {
      font-size: 1rem !important;
    }
    
    .vinted-item-buy-btn .buy-text {
      font-weight: 600 !important;
    }
    
    .vinted-item-error {
      padding: 2rem !important;
      text-align: center !important;
      color: #333 !important;
    }
    
    .vinted-dark-mode .vinted-item-error {
      color: rgba(255, 255, 255, 0.9) !important;
    }
    
    .vinted-item-error h3 {
      margin: 0 0 1rem 0 !important;
      font-size: 1.25rem !important;
      color: #ef4444 !important;
    }
    
    .vinted-item-error p {
      margin: 0 0 1.5rem 0 !important;
      color: #666 !important;
    }
    
    .vinted-dark-mode .vinted-item-error p {
      color: rgba(255, 255, 255, 0.7) !important;
    }
    
    .vinted-item-error-close {
      padding: 0.75rem 1.5rem !important;
      background: #09B1BA !important;
      color: white !important;
      border: none !important;
      border-radius: 8px !important;
      font-size: 0.875rem !important;
      font-weight: 500 !important;
      cursor: pointer !important;
      transition: all 0.2s !important;
    }
    
    .vinted-item-error-close:hover {
      background: #078a91 !important;
      transform: translateY(-1px) !important;
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
    
    /* Skeleton Loading Styles */
    .vinted-item-details-skeleton {
      display: grid !important;
      grid-template-columns: 300px 1fr !important;
      gap: 2rem !important;
      align-items: start !important;
    }
    
    @media (max-width: 768px) {
      .vinted-item-details-skeleton {
        grid-template-columns: 1fr !important;
      }
    }
    
    .vinted-item-skeleton-photos {
      display: flex !important;
      flex-direction: column !important;
      gap: 0.75rem !important;
    }
    
    .vinted-item-skeleton-photo-main {
      width: 100% !important;
      max-width: 300px !important;
      aspect-ratio: 1 !important;
      border-radius: 8px !important;
      background: linear-gradient(90deg, rgba(0, 0, 0, 0.1) 25%, rgba(0, 0, 0, 0.15) 50%, rgba(0, 0, 0, 0.1) 75%) !important;
      background-size: 200% 100% !important;
      animation: shimmer 1.5s infinite !important;
    }
    
    .vinted-dark-mode .vinted-item-skeleton-photo-main {
      background: linear-gradient(90deg, rgba(255, 255, 255, 0.1) 25%, rgba(255, 255, 255, 0.15) 50%, rgba(255, 255, 255, 0.1) 75%) !important;
      background-size: 200% 100% !important;
    }
    
    .vinted-item-skeleton-thumbnails {
      display: flex !important;
      gap: 0.5rem !important;
    }
    
    .vinted-item-skeleton-thumb {
      width: 60px !important;
      height: 60px !important;
      border-radius: 6px !important;
      background: linear-gradient(90deg, rgba(0, 0, 0, 0.1) 25%, rgba(0, 0, 0, 0.15) 50%, rgba(0, 0, 0, 0.1) 75%) !important;
      background-size: 200% 100% !important;
      animation: shimmer 1.5s infinite !important;
    }
    
    .vinted-dark-mode .vinted-item-skeleton-thumb {
      background: linear-gradient(90deg, rgba(255, 255, 255, 0.1) 25%, rgba(255, 255, 255, 0.15) 50%, rgba(255, 255, 255, 0.1) 75%) !important;
      background-size: 200% 100% !important;
    }
    
    .vinted-item-skeleton-info {
      display: flex !important;
      flex-direction: column !important;
      gap: 1rem !important;
    }
    
    .vinted-item-skeleton-title {
      width: 80% !important;
      height: 2rem !important;
      border-radius: 4px !important;
      background: linear-gradient(90deg, rgba(0, 0, 0, 0.1) 25%, rgba(0, 0, 0, 0.15) 50%, rgba(0, 0, 0, 0.1) 75%) !important;
      background-size: 200% 100% !important;
      animation: shimmer 1.5s infinite !important;
    }
    
    .vinted-dark-mode .vinted-item-skeleton-title {
      background: linear-gradient(90deg, rgba(255, 255, 255, 0.1) 25%, rgba(255, 255, 255, 0.15) 50%, rgba(255, 255, 255, 0.1) 75%) !important;
      background-size: 200% 100% !important;
    }
    
    .vinted-item-skeleton-price {
      width: 30% !important;
      height: 2.5rem !important;
      border-radius: 4px !important;
      background: linear-gradient(90deg, rgba(9, 177, 186, 0.3) 25%, rgba(9, 177, 186, 0.5) 50%, rgba(9, 177, 186, 0.3) 75%) !important;
      background-size: 200% 100% !important;
      animation: shimmer 1.5s infinite !important;
    }
    
    .vinted-item-skeleton-meta {
      display: flex !important;
      flex-direction: column !important;
      gap: 0.75rem !important;
      padding: 1rem !important;
      background: rgba(0, 0, 0, 0.05) !important;
      border-radius: 8px !important;
    }
    
    .vinted-dark-mode .vinted-item-skeleton-meta {
      background: rgba(255, 255, 255, 0.05) !important;
    }
    
    .vinted-item-skeleton-meta-row {
      display: flex !important;
      align-items: center !important;
      gap: 0.5rem !important;
    }
    
    .vinted-item-skeleton-label {
      width: 80px !important;
      height: 1.25rem !important;
      border-radius: 4px !important;
      background: linear-gradient(90deg, rgba(0, 0, 0, 0.1) 25%, rgba(0, 0, 0, 0.15) 50%, rgba(0, 0, 0, 0.1) 75%) !important;
      background-size: 200% 100% !important;
      animation: shimmer 1.5s infinite !important;
    }
    
    .vinted-dark-mode .vinted-item-skeleton-label {
      background: linear-gradient(90deg, rgba(255, 255, 255, 0.1) 25%, rgba(255, 255, 255, 0.15) 50%, rgba(255, 255, 255, 0.1) 75%) !important;
      background-size: 200% 100% !important;
    }
    
    .vinted-item-skeleton-value {
      width: 120px !important;
      height: 1.25rem !important;
      border-radius: 4px !important;
      background: linear-gradient(90deg, rgba(0, 0, 0, 0.1) 25%, rgba(0, 0, 0, 0.15) 50%, rgba(0, 0, 0, 0.1) 75%) !important;
      background-size: 200% 100% !important;
      animation: shimmer 1.5s infinite !important;
    }
    
    .vinted-dark-mode .vinted-item-skeleton-value {
      background: linear-gradient(90deg, rgba(255, 255, 255, 0.1) 25%, rgba(255, 255, 255, 0.15) 50%, rgba(255, 255, 255, 0.1) 75%) !important;
      background-size: 200% 100% !important;
    }
    
    .vinted-item-skeleton-description {
      padding: 1rem !important;
      background: rgba(0, 0, 0, 0.05) !important;
      border-radius: 8px !important;
      display: flex !important;
      flex-direction: column !important;
      gap: 0.5rem !important;
    }
    
    .vinted-dark-mode .vinted-item-skeleton-description {
      background: rgba(255, 255, 255, 0.05) !important;
    }
    
    .vinted-item-skeleton-line {
      width: 100% !important;
      height: 1rem !important;
      border-radius: 4px !important;
      background: linear-gradient(90deg, rgba(0, 0, 0, 0.1) 25%, rgba(0, 0, 0, 0.15) 50%, rgba(0, 0, 0, 0.1) 75%) !important;
      background-size: 200% 100% !important;
      animation: shimmer 1.5s infinite !important;
    }
    
    .vinted-item-skeleton-line.short {
      width: 70% !important;
    }
    
    .vinted-dark-mode .vinted-item-skeleton-line {
      background: linear-gradient(90deg, rgba(255, 255, 255, 0.1) 25%, rgba(255, 255, 255, 0.15) 50%, rgba(255, 255, 255, 0.1) 75%) !important;
      background-size: 200% 100% !important;
    }
    
    .vinted-item-skeleton-seller {
      padding: 1rem !important;
      background: rgba(0, 0, 0, 0.05) !important;
      border-radius: 8px !important;
      display: flex !important;
      align-items: center !important;
      gap: 0.75rem !important;
    }
    
    .vinted-dark-mode .vinted-item-skeleton-seller {
      background: rgba(255, 255, 255, 0.05) !important;
    }
    
    .vinted-item-skeleton-avatar {
      width: 40px !important;
      height: 40px !important;
      border-radius: 50% !important;
      background: linear-gradient(90deg, rgba(0, 0, 0, 0.1) 25%, rgba(0, 0, 0, 0.15) 50%, rgba(0, 0, 0, 0.1) 75%) !important;
      background-size: 200% 100% !important;
      animation: shimmer 1.5s infinite !important;
    }
    
    .vinted-dark-mode .vinted-item-skeleton-avatar {
      background: linear-gradient(90deg, rgba(255, 255, 255, 0.1) 25%, rgba(255, 255, 255, 0.15) 50%, rgba(255, 255, 255, 0.1) 75%) !important;
      background-size: 200% 100% !important;
    }
    
    .vinted-item-skeleton-seller-name {
      width: 120px !important;
      height: 1.25rem !important;
      border-radius: 4px !important;
      background: linear-gradient(90deg, rgba(0, 0, 0, 0.1) 25%, rgba(0, 0, 0, 0.15) 50%, rgba(0, 0, 0, 0.1) 75%) !important;
      background-size: 200% 100% !important;
      animation: shimmer 1.5s infinite !important;
    }
    
    .vinted-dark-mode .vinted-item-skeleton-seller-name {
      background: linear-gradient(90deg, rgba(255, 255, 255, 0.1) 25%, rgba(255, 255, 255, 0.15) 50%, rgba(255, 255, 255, 0.1) 75%) !important;
      background-size: 200% 100% !important;
    }
    
    .vinted-item-skeleton-actions {
      display: flex !important;
      gap: 1rem !important;
      flex-wrap: wrap !important;
    }
    
    .vinted-item-skeleton-button {
      flex: 1 !important;
      min-width: 150px !important;
      height: 2.5rem !important;
      border-radius: 8px !important;
      background: linear-gradient(90deg, rgba(9, 177, 186, 0.3) 25%, rgba(9, 177, 186, 0.5) 50%, rgba(9, 177, 186, 0.3) 75%) !important;
      background-size: 200% 100% !important;
      animation: shimmer 1.5s infinite !important;
    }
    
    @keyframes shimmer {
      0% {
        background-position: -200% 0;
      }
      100% {
        background-position: 200% 0;
      }
    }
    
    /* Styles pour le formulaire d'offre intégré */
    .vinted-item-offer-form-container {
      margin-top: 1rem !important;
      padding: 1rem !important;
      background: rgba(0, 0, 0, 0.05) !important;
      backdrop-filter: blur(2px) !important;
      -webkit-backdrop-filter: blur(2px) !important;
      border-radius: 8px !important;
      border: 1px solid rgba(255, 255, 255, 0.1) !important;
    }
    
    .vinted-dark-mode .vinted-item-offer-form-container {
      background: rgba(255, 255, 255, 0.05) !important;
    }
    
    .vinted-item-offer-form-header {
      display: flex !important;
      align-items: center !important;
      justify-content: space-between !important;
      margin-bottom: 1rem !important;
    }
    
    .vinted-item-offer-form-header h3 {
      margin: 0 !important;
      font-size: 1.125rem !important;
      font-weight: 600 !important;
      color: #333 !important;
    }
    
    .vinted-dark-mode .vinted-item-offer-form-header h3 {
      color: rgba(255, 255, 255, 0.9) !important;
    }
    
    .vinted-item-offer-form-close {
      background: none !important;
      border: none !important;
      font-size: 1.5rem !important;
      cursor: pointer !important;
      color: #666 !important;
      padding: 0 !important;
      width: 24px !important;
      height: 24px !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      transition: color 0.2s !important;
    }
    
    .vinted-item-offer-form-close:hover {
      color: #333 !important;
    }
    
    .vinted-dark-mode .vinted-item-offer-form-close {
      color: rgba(255, 255, 255, 0.7) !important;
    }
    
    .vinted-dark-mode .vinted-item-offer-form-close:hover {
      color: rgba(255, 255, 255, 0.9) !important;
    }
    
    .vinted-item-offer-form-body {
      display: flex !important;
      flex-direction: column !important;
      gap: 1rem !important;
    }
    
    .vinted-item-offer-form-body label {
      font-weight: 500 !important;
      color: #333 !important;
      font-size: 0.875rem !important;
    }
    
    .vinted-dark-mode .vinted-item-offer-form-body label {
      color: rgba(255, 255, 255, 0.8) !important;
    }
    
    .vinted-item-offer-price-input {
      padding: 0.75rem !important;
      border: 1px solid rgba(0, 0, 0, 0.2) !important;
      border-radius: 6px !important;
      font-size: 1rem !important;
      background: rgba(255, 255, 255, 0.9) !important;
      color: #333 !important;
      transition: all 0.2s !important;
    }
    
    .vinted-item-offer-price-input:focus {
      outline: none !important;
      border-color: #09B1BA !important;
      box-shadow: 0 0 0 3px rgba(9, 177, 186, 0.1) !important;
    }
    
    .vinted-dark-mode .vinted-item-offer-price-input {
      background: rgba(255, 255, 255, 0.1) !important;
      border-color: rgba(255, 255, 255, 0.2) !important;
      color: rgba(255, 255, 255, 0.9) !important;
    }
    
    .vinted-dark-mode .vinted-item-offer-price-input:focus {
      border-color: #09B1BA !important;
      box-shadow: 0 0 0 3px rgba(9, 177, 186, 0.2) !important;
    }
    
    .vinted-item-offer-form-actions {
      display: flex !important;
      gap: 0.75rem !important;
      margin-top: 0.5rem !important;
    }
    
    .vinted-item-offer-form-cancel,
    .vinted-item-offer-form-submit {
      flex: 1 !important;
      padding: 0.75rem 1rem !important;
      border: none !important;
      border-radius: 6px !important;
      font-size: 0.875rem !important;
      font-weight: 500 !important;
      cursor: pointer !important;
      transition: all 0.2s !important;
    }
    
    .vinted-item-offer-form-cancel {
      background: rgba(0, 0, 0, 0.1) !important;
      color: #333 !important;
    }
    
    .vinted-item-offer-form-cancel:hover {
      background: rgba(0, 0, 0, 0.15) !important;
    }
    
    .vinted-dark-mode .vinted-item-offer-form-cancel {
      background: rgba(255, 255, 255, 0.1) !important;
      color: rgba(255, 255, 255, 0.9) !important;
    }
    
    .vinted-dark-mode .vinted-item-offer-form-cancel:hover {
      background: rgba(255, 255, 255, 0.15) !important;
    }
    
    .vinted-item-offer-form-submit {
      background: #09B1BA !important;
      color: white !important;
    }
    
    .vinted-item-offer-form-submit:hover:not(:disabled) {
      background: #078a91 !important;
      transform: translateY(-1px) !important;
    }
    
    .vinted-item-offer-form-submit:disabled {
      opacity: 0.6 !important;
      cursor: not-allowed !important;
    }
  `;
  
  document.head.appendChild(style);
}

export async function showItemDetails(itemId, itemSlug = '') {
  console.log(`[Vinted Item Details] showItemDetails appelé pour itemId: ${itemId}, slug: ${itemSlug || 'aucun'}`);
  
  // S'assurer que les styles sont injectés
  ensureItemModalStyles();
  console.log('[Vinted Item Details] Styles CSS vérifiés/injectés');
  
  // Créer le modal immédiatement pour afficher le skeleton
    const modal = document.createElement('div');
    modal.className = 'vinted-item-modal';
    modal.innerHTML = `
      <div class="vinted-item-modal-content">
      <button class="vinted-item-modal-close" aria-label="Fermer">×</button>
        <div class="vinted-item-modal-body">
          <div class="vinted-item-loading">Chargement...</div>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
  console.log('[Vinted Item Details] Modal créée et ajoutée au DOM');
  
  // Vérifier que la modal est visible
  const computedStyle = window.getComputedStyle(modal);
  console.log('[Vinted Item Details] Modal display:', computedStyle.display);
  console.log('[Vinted Item Details] Modal z-index:', computedStyle.zIndex);
  console.log('[Vinted Item Details] Modal position:', computedStyle.position);
  
  // Afficher le skeleton immédiatement
  const modalBody = modal.querySelector('.vinted-item-modal-body');
  renderItemDetailsSkeleton(modalBody);
  
  // Gestionnaires d'événements pour la fermeture
    const closeBtn = modal.querySelector('.vinted-item-modal-close');
  let closeModal = () => {
    modal.style.opacity = '0';
    setTimeout(() => {
      if (modal.parentNode) {
      document.body.removeChild(modal);
      }
      isModalOpen = false;
    }, 300);
  };
  
  let isClosing = false;
  const originalCloseModal = closeModal;
  closeModal = () => {
    if (isClosing) return;
    isClosing = true;
    
    // Nettoyer immédiatement le contenu pour libérer la mémoire
    const modalBody = modal.querySelector('.vinted-item-modal-body');
    if (modalBody) {
      // Vider les images pour libérer la mémoire
      const images = modalBody.querySelectorAll('img');
      images.forEach(img => {
        img.src = '';
        img.srcset = '';
      });
      // Vider le contenu après un court délai
      setTimeout(() => {
        modalBody.innerHTML = '';
      }, 100);
    }
    
    originalCloseModal();
    
    // Forcer le garbage collection en vidant les références
    setTimeout(() => {
      modal = null;
      content = null;
      closeBtn = null;
    }, 300);
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
  
  try {
    console.log(`[Vinted Item Details] Appel de fetchItemDetails...`);
    const item = await fetchItemDetails(itemId, itemSlug);
    console.log(`[Vinted Item Details] fetchItemDetails terminé, item reçu:`, item ? { id: item.id, title: item.title?.substring(0, 50) } : null);
    if (!item) {
      throw new Error('Produit non trouvé');
    }

    // Remplacer le skeleton par les vraies données
    console.log('[Vinted Item Details] Appel de renderItemDetails avec item:', item);
    renderItemDetails(modal, item);
    console.log('[Vinted Item Details] renderItemDetails terminé');
    
  } catch (error) {
    console.error("[Vinted Item] Erreur lors de l'affichage des détails:", error);
    // Afficher un message d'erreur dans le modal au lieu d'une alerte
    const modalBody = modal.querySelector('.vinted-item-modal-body');
    if (modalBody) {
      modalBody.innerHTML = `
        <div class="vinted-item-error">
          <h3>Erreur lors du chargement</h3>
          <p>Impossible de charger les détails du produit. Veuillez réessayer.</p>
          <button class="vinted-item-error-close" onclick="this.closest('.vinted-item-modal').remove(); isModalOpen = false;">Fermer</button>
        </div>
      `;
    } else {
    alert("Erreur lors du chargement des détails du produit.");
      if (modal.parentNode) {
        document.body.removeChild(modal);
      }
      isModalOpen = false;
    }
  }
}

/**
 * Rend les détails du produit dans le modal
 * @param {HTMLElement} modal - Élément modal
 * @param {Object} item - Données du produit
 */
function renderItemDetails(modal, item) {
  const body = modal.querySelector('.vinted-item-modal-body');
  
  // Construire l'URL de l'article (comme dans la liste des articles)
  let itemUrl = item.url;
  if (!itemUrl || itemUrl === 'undefined') {
    // Construire l'URL à partir de l'ID et du slug/title
    const slug = item.slug || item.title?.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || '';
    itemUrl = `https://www.vinted.fr/items/${item.id}${slug ? '-' + slug : ''}`;
  } else if (!itemUrl.startsWith('http')) {
    itemUrl = `https://www.vinted.fr${itemUrl}`;
  }
  
  // Photos - Filtrer pour éviter les doublons et exclure la photo de profil
  let photos = item.photos || [];
  console.log(`[Vinted Item Details] Photos initiales: ${photos.length}`);
  
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
  
  // Fonction pour obtenir l'URL de miniature
  const getThumbnailUrl = (photo) => {
    const url = getImageUrl(photo);
    if (!url) return '';
    // Essayer différents formats de miniatures
    // Format f70x100 pour les miniatures
    if (url.includes('/f800/')) {
      return url.replace('/f800/', '/f70x100/');
    }
    if (url.includes('/f1024/')) {
      return url.replace('/f1024/', '/f70x100/');
    }
    // Si le format n'est pas reconnu, utiliser l'URL complète
    return url;
  };
  
  // Filtrer les photos : exclure les photos de profil
  const beforeFilter = photos.length;
  photos = photos.filter(photo => {
    const url = typeof photo === 'string' ? photo : (photo.url || '');
    // Exclure les photos de profil (généralement dans des dossiers spécifiques ou de petite taille)
    if (url.includes('/50x50/') || url.includes('/avatar') || url.includes('/profile') || 
        url.includes('/user') || url.match(/\/\d+x\d+\//)?.[0]?.includes('50x50')) {
      return false;
    }
    return true;
  });
  console.log(`[Vinted Item Details] Photos après filtrage: ${photos.length} (${beforeFilter - photos.length} exclues)`);
  
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
  console.log(`[Vinted Item Details] Photos finales (uniques): ${photos.length}`);
  
  // Générer le HTML des photos avec toutes les miniatures visibles
  const photosHtml = photos.length > 0 ? `
    <div class="vinted-item-photos">
      <div class="vinted-item-photo-main">
        <img src="${getImageUrl(photos[0])}" alt="${item.title}" id="vinted-item-main-photo">
      </div>
      ${photos.length > 1 ? `
        <div class="vinted-item-photo-thumbnails">
          ${photos.map((photo, index) => {
            // Utiliser l'URL complète pour les miniatures (le navigateur optimisera l'affichage)
            // Si le format f70x100 ne fonctionne pas, on utilisera l'URL complète
            const fullUrl = getImageUrl(photo);
            const thumbUrl = getThumbnailUrl(photo);
            return `
            <img src="${fullUrl}" alt="Photo ${index + 1}" 
                 class="vinted-item-photo-thumb ${index === 0 ? 'active' : ''}"
                 data-index="${index}"
                 data-full-url="${fullUrl}">
          `;
          }).join('')}
        </div>
      ` : ''}
    </div>
  ` : '';
  
  // Prix - extraire et formater avec plusieurs fallbacks
  let price = 'Prix non disponible';
  if (item.price) {
    price = formatPrice(item);
  } else if (item.price_amount) {
    // Format alternatif
    const amount = typeof item.price_amount === 'string' 
      ? parseFloat(item.price_amount.replace(',', '.')) 
      : item.price_amount;
    const currency = item.price_currency || item.currency || 'EUR';
    price = new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: currency,
    }).format(amount);
  }
  
  // Prix avec frais
  let priceWithFees = '';
  if (item.price_with_fees) {
    if (item.price_with_fees.formatted) {
      priceWithFees = item.price_with_fees.formatted;
    } else if (item.price_with_fees.amount) {
      const amount = typeof item.price_with_fees.amount === 'string' 
        ? parseFloat(item.price_with_fees.amount.replace(',', '.')) 
        : item.price_with_fees.amount;
      const currency = item.price_with_fees.currency_code || item.currency || 'EUR';
      priceWithFees = new Intl.NumberFormat("fr-FR", {
        style: "currency",
        currency: currency,
      }).format(amount);
    }
  } else if (item.price_with_protection) {
    // Fallback sur price_with_protection si price_with_fees n'est pas disponible
    if (item.price_with_protection.amount) {
      const amount = typeof item.price_with_protection.amount === 'string' 
        ? parseFloat(item.price_with_protection.amount.replace(',', '.')) 
        : item.price_with_protection.amount;
      const currency = item.price_with_protection.currency_code || item.currency || 'EUR';
      priceWithFees = new Intl.NumberFormat("fr-FR", {
        style: "currency",
        currency: currency,
      }).format(amount);
    }
  }
  
  // Taille - extraire avec plusieurs fallbacks
  let size = extractSize(item);
  if (!size) {
    size = item.size_title || item.size?.title || item.size?.localized_title || item.size?.brand_size || 'Taille non spécifiée';
  }
  
  // Marque - extraire avec plusieurs fallbacks
  let brand = item.brand?.title || item.brand?.name || item.brand_title;
  if (!brand && typeof item.brand === 'string') {
    brand = item.brand;
  }
  if (!brand) {
    brand = 'Marque non spécifiée';
  }
  
  // État/Condition - extraire avec plusieurs fallbacks
  let condition = extractCondition(item);
  if (!condition) {
    condition = item.condition_title || item.condition?.title || item.condition?.translated_title || item.status || 'État non spécifié';
  }
  
  // Couleur - extraire avec fallback
  let color = item.color || '';
  
  // Description - utiliser celle extraite, avec fallback
  let description = item.description || item.description_text || '';
  // Si la description est vide ou trop courte, essayer de la récupérer depuis og:description
  if (!description || description.length < 10) {
    const ogDesc = document.querySelector('meta[property="og:description"]')?.getAttribute('content');
    if (ogDesc && ogDesc.length > 10) {
      description = ogDesc;
    }
  }
  // Si toujours vide, utiliser le message par défaut
  if (!description || description.length < 10) {
    description = 'Aucune description';
  }
  
  // Informations du vendeur - extraire avec plusieurs fallbacks
  const seller = item.user || item.seller || {};
  const sellerName = seller.login || seller.username || seller.name || 'Vendeur inconnu';
  let sellerAvatar = seller.photo?.url || seller.avatar || '';
  // Si l'avatar est un objet avec thumbnails
  if (!sellerAvatar && seller.photo?.thumbnails) {
    const thumb100 = seller.photo.thumbnails.find(t => t.type === 'thumb100');
    if (thumb100) sellerAvatar = thumb100.url;
  }
  
  // Calculer les étoiles pour la note du vendeur de manière sécurisée
  // Normaliser la note sur une échelle de 5
  let ratingStarsHtml = '';
  let normalizedRating = null;
  if (seller.rating !== undefined && seller.rating !== null) {
    const maxRating = seller.max_rating || 5;
    // Normaliser la note sur une échelle de 5
    normalizedRating = (seller.rating / maxRating) * 5;
    // Limiter entre 0 et 5
    normalizedRating = Math.max(0, Math.min(5, normalizedRating));
    const rating = Math.round(normalizedRating);
    const filledStars = Math.max(0, rating);
    const emptyStars = Math.max(0, 5 - filledStars);
    ratingStarsHtml = `${'★'.repeat(filledStars)}${'☆'.repeat(emptyStars)}`;
  }
  
  console.log('[Vinted Item Details] Génération du HTML des détails...');
  const htmlContent = `
    <div class="vinted-item-details">
      ${photosHtml}
      <div class="vinted-item-info">
        <h2 class="vinted-item-title">${escapeHtml(item.title || 'Titre non disponible')}</h2>
        <div class="vinted-item-price-container">
        <div class="vinted-item-price">${escapeHtml(price)}</div>
          ${priceWithFees ? `<div class="vinted-item-price-with-fees">${escapeHtml(priceWithFees)} <span class="vinted-item-price-fees-label">(frais inclus)</span></div>` : ''}
        </div>
        ${item.status || item.is_sold ? `
        <div class="vinted-item-status ${item.is_sold ? 'vinted-item-status-sold' : ''}">
          <span class="vinted-item-status-label">Statut:</span>
          <span class="vinted-item-status-value">${escapeHtml(item.status || (item.is_sold ? 'Vendu' : 'Disponible'))}</span>
        </div>
        ` : ''}
        <div class="vinted-item-meta">
          <div class="vinted-item-meta-row">
            <span class="vinted-item-meta-label">Taille:</span>
            <span class="vinted-item-meta-value">${escapeHtml(size)}</span>
          </div>
          <div class="vinted-item-meta-row">
            <span class="vinted-item-meta-label">Marque:</span>
            <span class="vinted-item-meta-value">${escapeHtml(brand)}</span>
          </div>
          <div class="vinted-item-meta-row">
            <span class="vinted-item-meta-label">État:</span>
            <span class="vinted-item-meta-value">${escapeHtml(condition)}</span>
          </div>
          ${color ? `
          <div class="vinted-item-meta-row">
            <span class="vinted-item-meta-label">Couleur:</span>
            <span class="vinted-item-meta-value">${escapeHtml(color)}</span>
          </div>
          ` : ''}
        </div>
        <div class="vinted-item-description">
          <h3>Description</h3>
          <p>${escapeHtml(description).replace(/\n/g, '<br>')}</p>
        </div>
        <div class="vinted-item-seller">
          <h3>Vendeur</h3>
          <div class="vinted-item-seller-info">
            ${sellerAvatar ? `<img src="${escapeHtml(sellerAvatar)}" alt="${escapeHtml(sellerName)}" class="vinted-item-seller-avatar">` : ''}
            <div class="vinted-item-seller-details">
              <div class="vinted-item-seller-name-row">
            <span class="vinted-item-seller-name">${escapeHtml(sellerName)}</span>
                ${seller.id ? `<span class="vinted-item-seller-id">(ID: ${seller.id})</span>` : ''}
              </div>
              ${seller.rating !== undefined && seller.rating !== null ? `
                <div class="vinted-item-seller-rating">
                  <span class="vinted-item-seller-rating-stars">${ratingStarsHtml}</span>
                  <span class="vinted-item-seller-rating-value">${normalizedRating !== null ? normalizedRating.toFixed(1) : (seller.rating || 0).toFixed(1)}/5</span>
                  ${seller.review_count !== undefined && seller.review_count !== null ? `<span class="vinted-item-seller-review-count">(${seller.review_count} avis)</span>` : ''}
                </div>
              ` : ''}
            </div>
          </div>
        </div>
        <div class="vinted-item-actions">
          <button class="vinted-item-pin-btn" data-item-id="${item.id}" title="Ajouter aux favoris">
            ❤️ Ajouter aux favoris
          </button>
          <button class="vinted-item-offer-btn" data-item-id="${item.id}">Faire une offre</button>
          <button class="vinted-item-buy-btn" data-item-url="${itemUrl}" title="Acheter rapidement">
            <span class="buy-icon">🛒</span>
            <span class="buy-text">Buy</span>
          </button>
        </div>
        <div class="vinted-item-offer-form-container" id="vinted-item-offer-form-${item.id}" style="display: none;">
          <div class="vinted-item-offer-form-header">
            <h3>Faire une offre</h3>
            <button class="vinted-item-offer-form-close" data-item-id="${item.id}" aria-label="Fermer">&times;</button>
          </div>
          <div class="vinted-item-offer-form-body">
            <label for="vinted-offer-price-${item.id}">Prix (EUR)</label>
            <input type="number" 
                   id="vinted-offer-price-${item.id}" 
                   class="vinted-item-offer-price-input" 
                   placeholder="0.00" 
                   step="0.01" 
                   min="0.01"
                   required>
            <div class="vinted-item-offer-form-actions">
              <button class="vinted-item-offer-form-cancel" data-item-id="${item.id}">Annuler</button>
              <button class="vinted-item-offer-form-submit" data-item-id="${item.id}">Envoyer l'offre</button>
            </div>
          </div>
        </div>
        <div class="vinted-item-conversation" id="vinted-item-conversation-${item.id}">
        </div>
      </div>
    </div>
  `;
  
  console.log('[Vinted Item Details] HTML généré, longueur:', htmlContent.length);
  body.innerHTML = htmlContent;
  console.log('[Vinted Item Details] innerHTML défini, body.children.length:', body.children.length);
  
  // Vérifier que le contenu est bien affiché
  setTimeout(() => {
    const details = body.querySelector('.vinted-item-details');
    if (details) {
      console.log('[Vinted Item Details] ✓ Contenu rendu avec succès');
      const computedStyle = window.getComputedStyle(modal);
      console.log('[Vinted Item Details] Modal visible:', computedStyle.display !== 'none', 'opacity:', computedStyle.opacity, 'z-index:', computedStyle.zIndex);
    } else {
      console.error('[Vinted Item Details] ✗ ERREUR: .vinted-item-details non trouvé après rendu');
    }
  }, 100);
  
  // Gestionnaire pour les miniatures de photos
  if (photos.length > 1) {
    const thumbnails = body.querySelectorAll('.vinted-item-photo-thumb');
    const mainPhoto = body.querySelector('#vinted-item-main-photo');
    
    if (thumbnails.length > 0 && mainPhoto) {
      thumbnails.forEach((thumb, index) => {
        // Gestionnaire d'erreur pour les images qui ne se chargent pas
        thumb.addEventListener('error', () => {
          console.warn(`[Vinted Item Details] Erreur de chargement de la miniature ${index}, utilisation de l'URL complète`);
          const fullUrl = thumb.dataset.fullUrl;
          if (fullUrl) {
            thumb.src = fullUrl;
          }
        });
        
        thumb.addEventListener('click', () => {
          const index = parseInt(thumb.dataset.index);
          // Utiliser l'URL complète stockée dans data-full-url ou reconstruire
          const fullUrl = thumb.dataset.fullUrl || getImageUrl(photos[index]);
          mainPhoto.src = fullUrl;
          
          // Mettre à jour l'état actif
          thumbnails.forEach(t => t.classList.remove('active'));
          thumb.classList.add('active');
        });
      });
      
      console.log(`[Vinted Item Details] ${thumbnails.length} miniatures configurées pour la navigation`);
    } else {
      console.warn('[Vinted Item Details] Miniatures ou photo principale non trouvées');
    }
  } else {
    console.log('[Vinted Item Details] Une seule photo, pas de miniatures nécessaires');
  }
  
  // Gestionnaire pour le bouton d'offre
  const offerBtn = body.querySelector('.vinted-item-offer-btn');
  const offerFormContainer = body.querySelector(`#vinted-item-offer-form-${item.id}`);
  if (offerBtn && offerFormContainer) {
    offerBtn.addEventListener('click', () => {
      // Afficher/masquer le formulaire d'offre
      const isVisible = offerFormContainer.style.display !== 'none';
      if (isVisible) {
        offerFormContainer.style.display = 'none';
        offerBtn.textContent = 'Faire une offre';
      } else {
        offerFormContainer.style.display = 'block';
        offerBtn.textContent = 'Masquer l\'offre';
        // Focus sur l'input de prix
        const priceInput = offerFormContainer.querySelector(`#vinted-offer-price-${item.id}`);
        if (priceInput) {
          setTimeout(() => priceInput.focus(), 100);
        }
      }
    });
    
    // Gestionnaire pour le bouton de fermeture du formulaire
    const closeFormBtn = offerFormContainer.querySelector('.vinted-item-offer-form-close');
    if (closeFormBtn) {
      closeFormBtn.addEventListener('click', () => {
        offerFormContainer.style.display = 'none';
        offerBtn.textContent = 'Faire une offre';
      });
    }
    
    // Gestionnaire pour le bouton Annuler
    const cancelBtn = offerFormContainer.querySelector('.vinted-item-offer-form-cancel');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => {
        offerFormContainer.style.display = 'none';
        offerBtn.textContent = 'Faire une offre';
        const priceInput = offerFormContainer.querySelector(`#vinted-offer-price-${item.id}`);
        if (priceInput) {
          priceInput.value = '';
        }
      });
    }
    
    // Gestionnaire pour le bouton Envoyer
    const submitBtn = offerFormContainer.querySelector('.vinted-item-offer-form-submit');
    if (submitBtn) {
      submitBtn.addEventListener('click', async () => {
        await handleOfferSubmit(item.id, offerFormContainer, modal, item);
      });
    }
    
    // Permettre d'envoyer avec Enter
    const priceInput = offerFormContainer.querySelector(`#vinted-offer-price-${item.id}`);
    if (priceInput) {
      priceInput.addEventListener('keypress', async (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          await handleOfferSubmit(item.id, offerFormContainer, modal, item);
        }
      });
    }
  }
  
  // Gestionnaire pour le bouton d'épinglage (favoris)
  const pinBtn = body.querySelector('.vinted-item-pin-btn');
  if (pinBtn) {
    // Vérifier l'état initial de manière asynchrone
    isItemPinned(item.id).then(isPinned => {
      if (isPinned) {
        pinBtn.textContent = '❤️ Retirer des favoris';
        pinBtn.title = 'Retirer des favoris';
        pinBtn.classList.add('pinned');
      }
    });
    
    pinBtn.addEventListener('click', async () => {
      // Sauvegarder l'état initial pour le texte
      const originalText = pinBtn.textContent;
      const originalTitle = pinBtn.title;
      
      // Afficher le chargement
      pinBtn.disabled = true;
      pinBtn.textContent = '⏳ Chargement...';
      pinBtn.title = 'Chargement en cours...';
      pinBtn.style.opacity = '0.7';
      pinBtn.style.cursor = 'wait';
      
      try {
      await togglePinItem(item);
        
        // Attendre un peu pour que l'API se synchronise
        await new Promise(resolve => setTimeout(resolve, 300));
        
        // Vérifier le nouvel état
      const isNowPinned = await isItemPinned(item.id);
      if (isNowPinned) {
        pinBtn.textContent = '❤️ Retirer des favoris';
        pinBtn.title = 'Retirer des favoris';
      } else {
        pinBtn.textContent = '❤️ Ajouter aux favoris';
        pinBtn.title = 'Ajouter aux favoris';
      }
      pinBtn.classList.toggle('pinned', isNowPinned);
      } catch (error) {
        console.error("[Vinted Item Details] Erreur lors du toggle favori:", error);
        // En cas d'erreur, restaurer l'état initial
        pinBtn.textContent = originalText;
        pinBtn.title = originalTitle;
      } finally {
        // Réactiver le bouton
        pinBtn.disabled = false;
        pinBtn.style.opacity = '1';
        pinBtn.style.cursor = 'pointer';
      }
    });
  }
  
  // Gestionnaire pour le bouton Buy
  const buyBtn = body.querySelector('.vinted-item-buy-btn');
  if (buyBtn) {
    buyBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const itemUrl = buyBtn.dataset.itemUrl;
      if (itemUrl) {
        quickBuyItem(itemUrl);
      }
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
 * Gère la soumission du formulaire d'offre intégré
 * @param {string|number} itemId - ID du produit
 * @param {HTMLElement} offerFormContainer - Conteneur du formulaire d'offre
 * @param {HTMLElement} modal - Élément modal parent
 * @param {Object} item - Objet item
 */
async function handleOfferSubmit(itemId, offerFormContainer, modal, item) {
  const priceInput = offerFormContainer.querySelector(`#vinted-offer-price-${itemId}`);
  const submitBtn = offerFormContainer.querySelector('.vinted-item-offer-form-submit');
  const offerBtn = modal.querySelector('.vinted-item-offer-btn');
  
  if (!priceInput || !submitBtn) return;
  
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
      
      // Masquer le formulaire et réinitialiser
      offerFormContainer.style.display = 'none';
      if (offerBtn) offerBtn.textContent = 'Faire une offre';
      priceInput.value = '';
        
        // Recharger la conversation pour afficher la nouvelle offre
        const conversationContainer = modal?.querySelector(`#vinted-item-conversation-${itemId}`);
        if (conversationContainer) {
          const updatedConversation = await fetchConversation(conversation.id);
          const seller = updatedConversation.opposite_user;
          if (seller && seller.id) {
          renderConversation(conversationContainer, updatedConversation, itemId, item);
          }
        }
      } else {
      // Pas de conversation/transaction existante, créer une conversation puis une transaction
        try {
        // Utiliser les données de l'item déjà chargé
          let sellerId = null;
        if (item && item.user && item.user.id) {
          sellerId = item.user.id;
          console.log(`[Vinted Item] ID vendeur depuis item: ${sellerId}`);
        }
        
        if (!sellerId) {
          // Fallback 1: récupérer les détails de l'item
          console.log(`[Vinted Item] Tentative de récupération des détails de l'item pour obtenir l'ID du vendeur...`);
          const itemDetails = await fetchItemDetails(itemId, item?.slug || '');
          if (itemDetails && itemDetails.user && itemDetails.user.id) {
            sellerId = itemDetails.user.id;
            console.log(`[Vinted Item] ID vendeur depuis fetchItemDetails: ${sellerId}`);
          }
        }
        
        // Fallback 2: essayer d'extraire depuis l'API directement
        if (!sellerId) {
          try {
            console.log(`[Vinted Item] Tentative d'extraction depuis l'API de l'item...`);
            const apiUrl = `https://www.vinted.fr/api/v2/items/${itemId}`;
            const apiResponse = await fetch(apiUrl, {
              credentials: "include",
              headers: {
                "accept": "application/json, text/plain, */*",
              },
            });
            if (apiResponse.ok) {
              const apiData = await apiResponse.json();
              if (apiData.item && apiData.item.user && apiData.item.user.id) {
                sellerId = apiData.item.user.id;
                console.log(`[Vinted Item] ID vendeur depuis API: ${sellerId}`);
              }
            }
          } catch (apiError) {
            console.warn(`[Vinted Item] Erreur lors de la récupération depuis l'API:`, apiError);
          }
        }
          
          if (!sellerId) {
            console.error(`[Vinted Item] Impossible de récupérer l'ID du vendeur. Item:`, item);
            throw new Error('Impossible de récupérer l\'ID du vendeur. Veuillez réessayer ou envoyer un message depuis la conversation ci-dessous.');
          }
          
        console.log(`[Vinted Item] Création de conversation pour item ${itemId} avec vendeur ${sellerId}...`);
        
        // Créer une conversation pour cet item avec la nouvelle API
        const itemData = item || await fetchItemDetails(itemId, '');
        const newConversation = await createConversationForItem(itemId, sellerId, `Je souhaite faire une offre de ${price} EUR`, itemData);
        
        if (!newConversation || !newConversation.id) {
          throw new Error('La création de conversation n\'a pas retourné d\'ID');
        }
        
        console.log(`[Vinted Item] Conversation créée avec succès: ${newConversation.id}`);
        
        // La conversation est créée, maintenant créer une transaction pour l'offre
        try {
          console.log(`[Vinted Item] Création de transaction pour l'offre de ${price} EUR...`);
          const transaction = await createTransactionForItem(itemId, price);
          
          if (transaction && transaction.id) {
            console.log(`[Vinted Item] Transaction créée: ${transaction.id}, envoi de l'offre...`);
            // Envoyer l'offre via la transaction
            await sendOfferRequest(transaction.id, price, 'EUR');
            console.log(`[Vinted Item] Offre envoyée avec succès !`);
            alert('Offre envoyée avec succès !');
            
            // Masquer le formulaire et réinitialiser
            offerFormContainer.style.display = 'none';
            if (offerBtn) offerBtn.textContent = 'Faire une offre';
            priceInput.value = '';
            
            // Recharger la conversation pour afficher la nouvelle offre
            const conversationContainer = modal?.querySelector(`#vinted-item-conversation-${itemId}`);
            if (conversationContainer) {
              const updatedConversation = await fetchConversation(newConversation.id);
              const seller = updatedConversation.opposite_user;
              if (seller && seller.id) {
                renderConversation(conversationContainer, updatedConversation, itemId, itemData);
              }
            }
          } else {
            console.warn("[Vinted Item] Transaction non créée, mais conversation créée");
            // Transaction non créée, mais conversation créée - ouvrir la conversation
            window.open(`https://www.vinted.fr/inbox/${newConversation.id}`, '_blank');
            alert('Conversation créée ! Vous pouvez maintenant faire une offre depuis la page de conversation.');
            offerFormContainer.style.display = 'none';
            if (offerBtn) offerBtn.textContent = 'Faire une offre';
          }
        } catch (transactionError) {
          console.error("[Vinted Item] Erreur lors de la création de la transaction:", transactionError);
          // Conversation créée mais transaction échouée - ouvrir la conversation
          window.open(`https://www.vinted.fr/inbox/${newConversation.id}`, '_blank');
          alert('Conversation créée ! Vous pouvez maintenant faire une offre depuis la page de conversation.');
          offerFormContainer.style.display = 'none';
          if (offerBtn) offerBtn.textContent = 'Faire une offre';
          }
        } catch (createError) {
          console.error("[Vinted Item] Erreur lors de la création de la conversation:", createError);
        console.error("[Vinted Item] Détails de l'erreur:", {
          message: createError.message,
          stack: createError.stack,
          itemId: itemId,
          sellerId: item?.user?.id
        });
        alert(`Erreur lors de la création de la conversation: ${createError.message}. Veuillez réessayer ou envoyer un message depuis la conversation ci-dessous.`);
        offerFormContainer.style.display = 'none';
        if (offerBtn) offerBtn.textContent = 'Faire une offre';
        }
      }
    } catch (error) {
      console.error("[Vinted Item] Erreur lors de l'envoi de l'offre:", error);
      alert("Erreur lors de l'envoi de l'offre. Veuillez réessayer.");
  } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Envoyer l\'offre';
    }
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
    
    // Formater la date - created_at_ts peut être une chaîne ISO 8601 ou un timestamp
    let timeAgo = msg.created_time_ago || '';
    if (!timeAgo && msg.created_at_ts) {
      try {
        // Si c'est une chaîne ISO 8601, la parser directement
        const date = new Date(msg.created_at_ts);
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
        console.error("[Vinted Item] Erreur lors du formatage de la date:", e, msg.created_at_ts);
        timeAgo = '';
      }
    }
    
    if (msg.entity_type === 'message') {
      return `
        <div class="vinted-msg-item ${messageClass}">
          <div class="vinted-msg-body">${escapeHtml(msg.entity.body)}</div>
          <div class="vinted-msg-time">${escapeHtml(timeAgo)}</div>
        </div>
      `;
    } else if (msg.entity_type === 'offer_request_message' || msg.entity_type === 'offer_message') {
      // Afficher aussi les messages d'offre
      const priceLabel = msg.entity?.price_label || msg.entity?.body || '';
      const originalPrice = msg.entity?.original_price_label ? ` (Prix original: ${msg.entity.original_price_label})` : '';
      const title = msg.entity_type === 'offer_message' ? 'Offre acceptée' : (msg.entity?.title || 'Offre demandée');
      return `
        <div class="vinted-msg-item ${messageClass}">
          <div class="vinted-msg-offer ${msg.entity_type === 'offer_message' ? 'accepted' : ''}">
            <div class="vinted-msg-offer-title">${escapeHtml(title)}</div>
            <div class="vinted-msg-offer-price">${escapeHtml(priceLabel)}</div>
            ${originalPrice ? `<div class="vinted-msg-offer-original">${escapeHtml(originalPrice)}</div>` : ''}
          </div>
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
              
              // Optionnel: ouvrir la conversation dans un nouvel onglet
              // window.open(`https://www.vinted.fr/inbox/${newConversation.id}`, '_blank');
            } else {
              // Si la création a échoué
              alert('Impossible de créer la conversation. Veuillez réessayer.');
            }
          } catch (createError) {
            console.error("[Vinted Item] Erreur lors de la création de la conversation:", createError);
            alert('Erreur lors de la création de la conversation. Veuillez réessayer.');
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
 * Achat rapide d'un article (même comportement que dans la liste des articles)
 * @param {string} itemUrl - URL de l'article
 */
function quickBuyItem(itemUrl) {
  // Ajouter le paramètre auto_buy=true à l'URL pour déclencher le script auto-buy
  const url = new URL(itemUrl);
  url.searchParams.set('auto_buy', 'true');
  
  // Ouvrir l'article dans un nouvel onglet
  const newTab = window.open(url.toString(), '_blank');
  
  if (newTab) {
    console.log('[Vinted Item Details] Ouverture de l\'article pour achat rapide:', url.toString());
  } else {
    console.error('[Vinted Item Details] Impossible d\'ouvrir l\'onglet. Popup bloquée ?');
  }
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
  console.log('[Vinted Item Details] 🎯 Intercepteur de clics initialisé');
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
    
    console.log('[Vinted Item Details] 🖱️ Clic détecté sur un article:', itemInfo);
    
    // Empêcher la redirection
    e.preventDefault();
    e.stopPropagation();
    
    // Marquer comme ouvert
    isModalOpen = true;
    
    // Afficher les détails dans le modal
    console.log('[Vinted Item Details] 📋 Ouverture de la modal pour l\'article:', itemInfo.id);
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
// Gestion des items épinglés (utilise les favoris Vinted)
// ==========================================

// Cache pour les favoris
let cachedFavourites = null;
let favouritesCacheTime = 0;
const FAVOURITES_CACHE_DURATION = 60000; // 1 minute
let favouritesRefreshInterval = null;
const FAVOURITES_REFRESH_INTERVAL = 5000; // 5 secondes

/**
 * Récupère l'user_id depuis plusieurs sources
 * @returns {Promise<string|null>} - User ID
 */
async function getUserId() {
  // Méthode 1: Depuis les cookies
  const cookies = document.cookie.split(';');
  for (const cookie of cookies) {
    const [name, value] = cookie.trim().split('=');
    if (name === 'v_uid') {
      const userId = decodeURIComponent(value);
      if (userId) return userId;
    }
  }
  
  // Méthode 2: Depuis l'API inbox (comme dans content-bundled.js)
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
                    return String(msg.entity.user_id);
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
    // Ignorer silencieusement les erreurs
  }
  
  return null;
}

/**
 * Récupère le token CSRF depuis les cookies ou les meta tags
 * @returns {Promise<string|null>} - Token CSRF
 */
async function getCsrfToken() {
  // Chercher dans les scripts inline
  try {
    const scripts = document.querySelectorAll('script:not([src])');
    for (const script of scripts) {
      const scriptContent = script.textContent || script.innerHTML;
      if (scriptContent && scriptContent.includes('CSRF_TOKEN')) {
        const patterns = [
          /"CSRF_TOKEN"\s*:\s*"([a-f0-9-]{36,})"/i,
          /CSRF_TOKEN"\s*:\s*"([a-f0-9-]{36,})"/i,
          /CSRF_TOKEN[\\"]*:\s*[\\"]*([a-f0-9-]{36,})/i
        ];
        
        for (const pattern of patterns) {
          const match = scriptContent.match(pattern);
          if (match && match[1] && match[1].length > 20) {
            return match[1];
          }
        }
      }
    }
  } catch (e) {
    // Ignorer les erreurs
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

/**
 * Récupère les favoris depuis l'API Vinted
 * @returns {Promise<Array>} - Liste des favoris
 */
async function getFavouritesFromAPI() {
  const userId = await getUserId();
  if (!userId) {
    // Ne pas logger d'erreur si l'utilisateur n'est simplement pas connecté
    // C'est un cas normal, pas une erreur
    return [];
  }

  // Utiliser le cache si disponible et récent
  const now = Date.now();
  if (cachedFavourites && (now - favouritesCacheTime) < FAVOURITES_CACHE_DURATION) {
    return cachedFavourites;
  }

  try {
    const url = `https://www.vinted.fr/api/v2/users/${userId}/items/favourites`;
    const response = await fetch(url, {
      method: 'GET',
      credentials: 'include',
      headers: {
        'accept': 'application/json, text/plain, */*',
        'x-anon-id': getAnonId() || '',
      }
    });

    if (!response.ok) {
      throw new Error(`Erreur API: ${response.status}`);
    }

    const data = await response.json();
    const favourites = data.items || [];
    
    // Mettre en cache
    cachedFavourites = favourites;
    favouritesCacheTime = now;
    
    return favourites;
  } catch (error) {
    console.error("[Vinted Favourites] Erreur lors de la récupération des favoris:", error);
    // Retourner le cache si disponible en cas d'erreur
    return cachedFavourites || [];
  }
}

/**
 * Récupère les items épinglés (favoris) depuis l'API
 * @returns {Promise<Array>} - Liste des items épinglés
 */
async function getPinnedItems() {
  const favourites = await getFavouritesFromAPI();
  return favourites.map(item => ({
    id: String(item.id),
    title: item.title,
    price: item.price?.amount || '',
    currency: item.price?.currency_code || 'EUR',
    photo: item.photo?.url || '',
    url: item.url || `https://www.vinted.fr/items/${item.id}`,
    slug: item.url ? item.url.split('/').pop().replace(/^\d+-/, '') : '',
    is_closed: item.is_closed || false,
    is_reserved: item.is_reserved || false
  }));
}

/**
 * Vérifie si un item est épinglé (dans les favoris)
 * @param {string|number} itemId - ID de l'item
 * @returns {Promise<boolean>}
 */
async function isItemPinned(itemId) {
  const favourites = await getFavouritesFromAPI();
  return favourites.some(item => String(item.id) === String(itemId));
}

/**
 * Ajoute un item aux favoris Vinted
 * @param {string|number} itemId - ID de l'item
 * @param {string} itemPath - Chemin de l'item (ex: /items/7580796632-camiseta-nino-carhartt)
 * @returns {Promise<boolean>} - Succès
 */
async function addToFavourites(itemId, itemPath) {
  try {
    let csrfToken = await getCsrfToken();
    
    // Si le token n'est pas trouvé, essayer d'importer la fonction depuis messagesApi.js
    if (!csrfToken) {
      try {
        const { getCsrfToken: getCsrfTokenFromApi, tryGetCsrfTokenFromPage } = await import('./messagesApi.js');
        csrfToken = await getCsrfTokenFromApi();
        if (!csrfToken) {
          csrfToken = await tryGetCsrfTokenFromPage();
        }
        if (csrfToken) {
          console.log("[Vinted Favourites] Token CSRF récupéré depuis messagesApi");
        }
      } catch (importError) {
        console.warn("[Vinted Favourites] Impossible d'importer depuis messagesApi:", importError);
      }
    }

    if (!csrfToken) {
      console.error("[Vinted Favourites] Token CSRF non trouvé");
      return false;
    }

    const anonId = getAnonId();
    const itemIdNum = parseInt(itemId);

    // Utiliser l'API toggle de Vinted
    const url = 'https://www.vinted.fr/api/v2/user_favourites/toggle';
    const payload = {
      type: "item",
      user_favourites: [itemIdNum]
    };

    console.log(`[Vinted Favourites] Envoi de la requête toggle pour l'item ${itemIdNum}`, payload);

    const headers = {
      'content-type': 'application/json',
      'x-csrf-token': csrfToken,
    };
    
    if (anonId) {
      headers['x-anon-id'] = anonId;
    }

    const response = await fetch(url, {
      method: 'POST',
      credentials: 'include',
      headers: headers,
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Vinted Favourites] Erreur API ${response.status}:`, errorText);
      throw new Error(`Erreur API: ${response.status} - ${errorText}`);
    }

    const responseData = await response.json();
    console.log(`[Vinted Favourites] Réponse de l'API:`, responseData);

    // Invalider le cache
    cachedFavourites = null;
    favouritesCacheTime = 0;

    return true;
  } catch (error) {
    console.error("[Vinted Favourites] Erreur lors de l'ajout aux favoris:", error);
    return false;
  }
}

/**
 * Retire un item des favoris Vinted (en cliquant à nouveau sur le bouton favori)
 * @param {string|number} itemId - ID de l'item
 * @param {string} itemPath - Chemin de l'item
 * @returns {Promise<boolean>} - Succès
 */
async function removeFromFavourites(itemId, itemPath) {
  // Pour retirer, on fait la même requête (toggle)
  return await addToFavourites(itemId, itemPath);
}

/**
 * Épingle ou désépingle un item (toggle favori)
 * @param {Object} item - Données de l'item
 */
async function togglePinItem(item) {
  const itemId = String(item.id);
  // Construire le path correctement : /items/{id}-{slug}
  let itemPath = `/items/${itemId}`;
  if (item.slug) {
    itemPath += `-${item.slug}`;
  } else if (item.url) {
    try {
      const url = new URL(item.url);
      itemPath = url.pathname;
    } catch (e) {
      // Si l'URL est invalide, utiliser le format par défaut
    }
  }
  
  const isCurrentlyPinned = await isItemPinned(itemId);
  
  // L'API Vinted utilise un toggle, donc on envoie toujours la même requête
  // qui va basculer l'état actuel
  await addToFavourites(itemId, itemPath);
  
  // Attendre un peu pour que l'API se synchronise
  await new Promise(resolve => setTimeout(resolve, 300));
  
  // Invalider le cache et recharger
  cachedFavourites = null;
  favouritesCacheTime = 0;
  await checkAndRenderPinnedItemsBar();
  
  // Mettre à jour tous les boutons favoris sur la page pour cet item
  updateFavoriteButtonsOnPage(itemId);
}

/**
 * Met à jour tous les boutons favoris sur la page pour un item donné
 * @param {string} itemId - ID de l'item
 */
async function updateFavoriteButtonsOnPage(itemId) {
  if (!itemId) return;
  
  // Vérifier l'état réel depuis l'API
  const isPinned = await isItemPinned(itemId);
  
  // Trouver tous les boutons favoris pour cet item
  const favoriteButtons = document.querySelectorAll(`.btn-favorite-item[data-item-id="${itemId}"]`);
  
  favoriteButtons.forEach(btn => {
    if (isPinned) {
      btn.classList.add('favorited');
      btn.title = 'Retirer des favoris';
      const icon = btn.querySelector('.favorite-icon');
      if (icon) icon.textContent = '❤️';
    } else {
      btn.classList.remove('favorited');
      btn.title = 'Ajouter aux favoris';
      const icon = btn.querySelector('.favorite-icon');
      if (icon) icon.textContent = '🤍';
    }
  });
}

/**
 * Supprime un item épinglé (retire des favoris)
 * @param {string|number} itemId - ID de l'item
 */
async function unpinItem(itemId) {
  console.log(`[Vinted Favourites] Suppression de l'item ${itemId} des favoris...`);
  
  const favourites = await getFavouritesFromAPI();
  const item = favourites.find(f => String(f.id) === String(itemId));
  
  if (!item) {
    console.warn(`[Vinted Favourites] Item ${itemId} non trouvé dans les favoris`);
    // Essayer quand même de le retirer (peut-être que le cache est obsolète)
  }
  
    let itemPath = `/items/${itemId}`;
  if (item && item.url) {
      try {
        const url = new URL(item.url);
        itemPath = url.pathname;
      } catch (e) {
        // Si l'URL est invalide, utiliser le format par défaut
      }
    }
    
  // Utiliser l'API toggle pour retirer l'item
  const success = await removeFromFavourites(itemId, itemPath);
  
  if (!success) {
    console.error(`[Vinted Favourites] Échec de la suppression de l'item ${itemId}`);
    throw new Error('Échec de la suppression des favoris');
  }
    
    // Attendre un peu pour que l'API se synchronise
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // Invalider le cache et recharger
    cachedFavourites = null;
    favouritesCacheTime = 0;
  await checkAndRenderPinnedItemsBar();
  
  console.log(`[Vinted Favourites] Item ${itemId} retiré des favoris avec succès`);
}

/**
 * Rend la barre des items épinglés (favoris)
 * Uniquement sur la page /catalog
 */
async function renderPinnedItemsBar() {
  // Vérifier si on est sur la page catalog
  const isCatalogPage = window.location.pathname === '/catalog' || window.location.pathname.startsWith('/catalog');
  if (!isCatalogPage) {
    // Supprimer la barre si elle existe sur d'autres pages
    const existingBar = document.getElementById('vinted-pinned-items-bar');
    if (existingBar) {
      existingBar.remove();
    }
    return;
  }
  
  const pinned = await getPinnedItems();
  
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
      ${pinned.map(item => {
        // Déterminer le statut : vendu (rouge) ou disponible (vert)
        const isAvailable = !item.is_closed && !item.is_reserved;
        const statusClass = isAvailable ? 'status-available' : 'status-sold';
        const statusTitle = isAvailable ? 'Disponible' : 'Vendu';
        
        return `
        <div class="vinted-pinned-item" data-item-id="${item.id}">
          <img src="${item.photo || ''}" alt="${escapeHtml(item.title)}" class="vinted-pinned-item-photo">
          <div class="vinted-pinned-item-status ${statusClass}" title="${statusTitle}"></div>
          <button class="vinted-pinned-item-unpin" data-item-id="${item.id}" title="Retirer des favoris">×</button>
        </div>
      `;
      }).join('')}
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
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      e.preventDefault();
      
      const itemId = btn.dataset.itemId;
      const itemElement = btn.closest('.vinted-pinned-item');
      
      if (!itemElement) return;
      
      // Afficher un indicateur de chargement
      const originalContent = btn.textContent;
      btn.textContent = '⏳';
      btn.disabled = true;
      btn.style.opacity = '0.6';
      btn.style.cursor = 'wait';
      itemElement.style.opacity = '0.6';
      
      try {
      await unpinItem(itemId);
        // L'élément sera supprimé automatiquement par renderPinnedItemsBar
      } catch (error) {
        console.error("[Vinted Favourites] Erreur lors de la suppression:", error);
        // En cas d'erreur, restaurer l'état
        btn.textContent = originalContent;
        btn.disabled = false;
        btn.style.opacity = '1';
        btn.style.cursor = 'pointer';
        itemElement.style.opacity = '1';
      }
    });
  });
}

// Initialiser quand le DOM est prêt
// Exposer showItemDetails globalement pour qu'elle soit accessible depuis content-bundled.js
if (typeof window !== 'undefined') {
  window.showItemDetails = showItemDetails;
  window.initItemClickInterceptor = initItemClickInterceptor;
  window.addToFavourites = addToFavourites;
  window.isItemPinned = isItemPinned;
  window.togglePinItem = togglePinItem;
  window.updateFavoriteButtonsOnPage = updateFavoriteButtonsOnPage;
}

// Fonction pour vérifier et afficher/masquer la barre selon l'URL
async function checkAndRenderPinnedItemsBar() {
  const isCatalogPage = window.location.pathname === '/catalog' || window.location.pathname.startsWith('/catalog');
  if (isCatalogPage) {
    await renderPinnedItemsBar();
  } else {
    // Supprimer la barre si on n'est pas sur catalog
    const existingBar = document.getElementById('vinted-pinned-items-bar');
    if (existingBar) {
      existingBar.remove();
    }
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', async () => {
    initItemClickInterceptor();
    await checkAndRenderPinnedItemsBar();
  });
} else {
  initItemClickInterceptor();
  (async () => {
    await checkAndRenderPinnedItemsBar();
  })();
}

// Écouter les changements d'URL (pour les SPA comme Vinted)
let lastUrl = window.location.href;
new MutationObserver(() => {
  const currentUrl = window.location.href;
  if (currentUrl !== lastUrl) {
    lastUrl = currentUrl;
    checkAndRenderPinnedItemsBar();
  }
}).observe(document.body, { childList: true, subtree: true });

// Écouter aussi les événements popstate (navigation navigateur)
window.addEventListener('popstate', () => {
  checkAndRenderPinnedItemsBar();
});

/**
 * Démarre le rafraîchissement automatique des favoris toutes les 5 secondes
 */
function startFavouritesAutoRefresh() {
  // Arrêter l'intervalle existant s'il y en a un
  stopFavouritesAutoRefresh();
  
  // Rafraîchir immédiatement
  checkAndRenderPinnedItemsBar();
  
  // Puis rafraîchir toutes les 5 secondes
  favouritesRefreshInterval = setInterval(() => {
    // Invalider le cache pour forcer une nouvelle requête
    cachedFavourites = null;
    favouritesCacheTime = 0;
    checkAndRenderPinnedItemsBar();
  }, FAVOURITES_REFRESH_INTERVAL);
  
  console.log("[Vinted Favourites] ✅ Rafraîchissement automatique activé (toutes les 5 secondes)");
}

/**
 * Arrête le rafraîchissement automatique des favoris
 */
function stopFavouritesAutoRefresh() {
  if (favouritesRefreshInterval) {
    clearInterval(favouritesRefreshInterval);
    favouritesRefreshInterval = null;
  }
}

// Démarrer le rafraîchissement automatique au chargement
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    startFavouritesAutoRefresh();
  });
} else {
  startFavouritesAutoRefresh();
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

