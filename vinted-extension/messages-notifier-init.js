// Point d'entrée pour le système de notifications de messages
// Ce fichier est chargé sur toutes les pages Vinted

import { startMessageNotifications } from './js/messagesNotifier.js';

// Fonction pour vérifier si on est sur une vraie page Vinted (pas une iframe ou autre)
function isMainVintedPage() {
  return window.top === window.self && window.location.hostname === 'www.vinted.fr';
}

// Fonction d'initialisation
function initMessageNotifications() {
  // Vérifier qu'on est sur la page principale
  if (!isMainVintedPage()) {
    console.log("[Vinted Messages] Pas sur la page principale, notifications désactivées");
    return;
  }

  // Vérifier que le système n'est pas déjà initialisé
  if (window.__VINTED_MESSAGE_NOTIFIER_INITIALIZED__) {
    console.log("[Vinted Messages] Système déjà initialisé");
    return;
  }

  // Marquer comme initialisé
  window.__VINTED_MESSAGE_NOTIFIER_INITIALIZED__ = true;

  // Attendre que la page soit prête
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      startSystem();
    });
  } else {
    startSystem();
  }
}

function startSystem() {
  try {
    console.log("[Vinted Messages] 🔔 Démarrage du système de notifications");
    console.log("[Vinted Messages] Intervalle: 10 secondes");
    
    // Démarrer les notifications (toutes les 10 secondes)
    startMessageNotifications(10000);
    
    // Initialiser l'interception des clics sur les produits
    if (typeof initItemClickInterceptor === 'function') {
      initItemClickInterceptor();
      console.log("[Vinted Item] ✅ Interception des clics sur les produits activée");
    }
    
    console.log("[Vinted Messages] ✅ Système démarré avec succès");
  } catch (error) {
    console.error("[Vinted Messages] ❌ Erreur lors du démarrage:", error);
  }
}

// Démarrer l'initialisation
initMessageNotifications();

