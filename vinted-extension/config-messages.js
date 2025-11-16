/**
 * Configuration avancée du système de notifications de messages
 * 
 * Ce fichier peut être utilisé pour personnaliser le comportement
 * du système de notifications sans modifier le code source.
 * 
 * Pour l'utiliser :
 * 1. Éditer les valeurs ci-dessous
 * 2. Importer ce fichier dans messages-notifier-init.js
 * 3. Rebuilder : node build-messages-notifier.js
 */

export const MessagesConfig = {
  
  // ============================================
  // TIMING
  // ============================================
  
  /**
   * Intervalle de vérification en millisecondes
   * @type {number}
   * @default 10000 (10 secondes)
   * 
   * Exemples :
   * - 5000  : 5 secondes (très réactif, plus de requêtes)
   * - 10000 : 10 secondes (équilibré, recommandé)
   * - 30000 : 30 secondes (moins de requêtes, moins réactif)
   * - 60000 : 1 minute
   */
  POLL_INTERVAL: 10000,
  
  /**
   * Délai avant le premier check (ms)
   * @type {number}
   * @default 1000
   */
  INITIAL_DELAY: 1000,
  
  /**
   * Durée d'affichage automatique d'une notification (0 = permanent)
   * @type {number}
   * @default 0
   */
  AUTO_CLOSE_DELAY: 0,  // 0 = ne se ferme pas automatiquement
  
  
  // ============================================
  // NOTIFICATIONS
  // ============================================
  
  /**
   * Nombre maximum de notifications affichées simultanément
   * @type {number}
   * @default 4
   */
  MAX_NOTIFICATIONS: 4,
  
  /**
   * Afficher les notifications au démarrage pour les messages déjà non lus
   * @type {boolean}
   * @default false
   */
  SHOW_EXISTING_ON_INIT: false,
  
  /**
   * Position des notifications
   * @type {object}
   */
  POSITION: {
    bottom: 20,  // pixels depuis le bas
    right: 20,   // pixels depuis la droite
    // Pour changer de côté, utilisez 'left' au lieu de 'right'
    // left: 20,
  },
  
  /**
   * Dimensions de la notification
   * @type {object}
   */
  SIZE: {
    width: 350,  // pixels
    // height calculée automatiquement
  },
  
  
  // ============================================
  // STYLE
  // ============================================
  
  /**
   * Couleurs personnalisées
   * @type {object}
   */
  COLORS: {
    primary: '#09B1BA',      // Bleu Vinted (bordure, avatar)
    background: '#ffffff',   // Fond de la notification
    text: '#1a1a1a',        // Texte principal
    textSecondary: '#666',  // Texte secondaire
    closeButton: '#f5f5f5', // Fond du bouton fermer
  },
  
  /**
   * Durée des animations (ms)
   * @type {number}
   */
  ANIMATION_DURATION: 300,
  
  
  // ============================================
  // COMPORTEMENT
  // ============================================
  
  /**
   * Ouvrir la conversation dans un nouvel onglet ou dans l'onglet actuel
   * @type {boolean}
   * @default true
   */
  OPEN_IN_NEW_TAB: true,
  
  /**
   * Jouer un son lors d'une nouvelle notification
   * @type {boolean}
   * @default false
   */
  PLAY_SOUND: false,
  
  /**
   * URL du son à jouer (si PLAY_SOUND = true)
   * @type {string}
   */
  SOUND_URL: 'data:audio/wav;base64,...',  // Son personnalisé
  
  /**
   * Utiliser les notifications desktop du navigateur
   * @type {boolean}
   * @default false
   */
  USE_DESKTOP_NOTIFICATIONS: false,
  
  
  // ============================================
  // FILTRES
  // ============================================
  
  /**
   * Filtrer les notifications par type d'expéditeur
   * @type {object}
   */
  FILTERS: {
    enabled: false,
    
    // Liste d'IDs d'utilisateurs à ignorer
    blacklist: [],
    
    // Liste d'IDs d'utilisateurs à surveiller uniquement (si vide, tous)
    whitelist: [],
  },
  
  
  // ============================================
  // DEBUG
  // ============================================
  
  /**
   * Activer les logs détaillés dans la console
   * @type {boolean}
   * @default true
   */
  DEBUG: true,
  
  /**
   * Afficher les données complètes des conversations dans la console
   * @type {boolean}
   * @default false
   */
  DEBUG_VERBOSE: false,
  
  
  // ============================================
  // API
  // ============================================
  
  /**
   * Configuration de l'API Vinted
   * @type {object}
   */
  API: {
    endpoint: 'https://www.vinted.fr/api/v2/inbox',
    perPage: 20,
    timeout: 10000,  // ms
  },
  
  
  // ============================================
  // AVANCÉ
  // ============================================
  
  /**
   * Stocker l'état dans localStorage pour persistance
   * @type {boolean}
   * @default false
   */
  PERSIST_STATE: false,
  
  /**
   * Clé localStorage pour la persistance
   * @type {string}
   */
  STORAGE_KEY: 'vinted_messages_state',
  
  /**
   * Retry en cas d'erreur API
   * @type {object}
   */
  RETRY: {
    enabled: true,
    maxAttempts: 3,
    delay: 5000,  // ms entre chaque retry
  },
};


// ============================================
// PRESETS
// ============================================

/**
 * Configurations pré-définies
 */
export const MessagesPresets = {
  
  // Preset par défaut (équilibré)
  default: {
    POLL_INTERVAL: 10000,
    MAX_NOTIFICATIONS: 4,
    DEBUG: true,
  },
  
  // Très réactif (pour ne jamais manquer un message)
  realtime: {
    POLL_INTERVAL: 5000,
    MAX_NOTIFICATIONS: 6,
    PLAY_SOUND: true,
    USE_DESKTOP_NOTIFICATIONS: true,
  },
  
  // Mode économique (moins de requêtes)
  eco: {
    POLL_INTERVAL: 30000,
    MAX_NOTIFICATIONS: 3,
    DEBUG: false,
  },
  
  // Mode silencieux (minimal)
  silent: {
    POLL_INTERVAL: 60000,
    MAX_NOTIFICATIONS: 2,
    DEBUG: false,
    AUTO_CLOSE_DELAY: 10000,
  },
  
  // Mode professionnel (discret)
  professional: {
    POLL_INTERVAL: 15000,
    MAX_NOTIFICATIONS: 2,
    PLAY_SOUND: false,
    POSITION: { bottom: 10, right: 10 },
    SIZE: { width: 300 },
  },
};


// ============================================
// UTILITAIRES
// ============================================

/**
 * Applique un preset à la configuration
 * @param {string} presetName - Nom du preset
 * @returns {object} Configuration fusionnée
 */
export function applyPreset(presetName) {
  const preset = MessagesPresets[presetName];
  if (!preset) {
    console.warn(`[Config] Preset "${presetName}" non trouvé`);
    return MessagesConfig;
  }
  
  return {
    ...MessagesConfig,
    ...preset,
  };
}

/**
 * Valide la configuration
 * @param {object} config - Configuration à valider
 * @returns {boolean} True si valide
 */
export function validateConfig(config) {
  const errors = [];
  
  if (config.POLL_INTERVAL < 1000) {
    errors.push('POLL_INTERVAL doit être >= 1000ms');
  }
  
  if (config.MAX_NOTIFICATIONS < 1) {
    errors.push('MAX_NOTIFICATIONS doit être >= 1');
  }
  
  if (config.SIZE.width < 200) {
    errors.push('SIZE.width doit être >= 200px');
  }
  
  if (errors.length > 0) {
    console.error('[Config] Erreurs de validation:', errors);
    return false;
  }
  
  return true;
}

/**
 * Exporte la configuration actuelle en JSON
 * @param {object} config - Configuration à exporter
 * @returns {string} JSON stringifié
 */
export function exportConfig(config) {
  return JSON.stringify(config, null, 2);
}

/**
 * Importe une configuration depuis JSON
 * @param {string} jsonString - Configuration JSON
 * @returns {object} Configuration parsée
 */
export function importConfig(jsonString) {
  try {
    const config = JSON.parse(jsonString);
    if (validateConfig(config)) {
      return config;
    }
  } catch (error) {
    console.error('[Config] Erreur lors de l\'import:', error);
  }
  return MessagesConfig;
}


// ============================================
// EXEMPLE D'UTILISATION
// ============================================

/*

// Dans messages-notifier-init.js

import { MessagesConfig, applyPreset } from './config-messages.js';

// Option 1 : Utiliser la config par défaut
const config = MessagesConfig;

// Option 2 : Utiliser un preset
const config = applyPreset('realtime');

// Option 3 : Configuration personnalisée
const config = {
  ...MessagesConfig,
  POLL_INTERVAL: 15000,
  MAX_NOTIFICATIONS: 5,
  COLORS: {
    ...MessagesConfig.COLORS,
    primary: '#FF0000',
  },
};

// Puis passer la config à la fonction de démarrage
startMessageNotifications(config.POLL_INTERVAL);

*/

