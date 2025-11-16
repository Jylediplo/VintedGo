# 🛍️ Vinted Extension - Monitor & Messages

Extension Chrome pour monitorer les articles Vinted et recevoir des notifications de messages en temps réel.

## 🚀 Fonctionnalités

### 1. Monitor d'articles Vinted (Catalog)
- Surveillance en temps réel des nouveaux articles
- Filtres personnalisés
- Interface utilisateur élégante

### 2. 🔔 Notifications de messages (NOUVEAU)
- ✅ Vérification automatique toutes les 10 secondes
- ✅ Notifications popup élégantes en bas à droite
- ✅ Affichage de l'avatar de l'expéditeur et de l'article
- ✅ Clic pour ouvrir la conversation
- ✅ Support multi-notifications (empilage automatique)

## 📦 Installation

### Option 1 : Installation depuis les sources

1. **Cloner ou télécharger le projet**
   ```bash
   git clone <repo-url>
   cd vintedGo/vinted-extension
   ```

2. **Builder le système de notifications**
   ```bash
   node build-messages-notifier.js
   ```
   
   Ceci créera le fichier `messages-notifier-bundled.js` nécessaire.

3. **Charger l'extension dans Chrome**
   - Ouvrir Chrome
   - Aller à `chrome://extensions/`
   - Activer le "Mode développeur" (en haut à droite)
   - Cliquer sur "Charger l'extension non empaquetée"
   - Sélectionner le dossier `vinted-extension`

4. **Vérifier l'installation**
   - Aller sur https://www.vinted.fr
   - Ouvrir la console (F12)
   - Vous devriez voir : `[Vinted Messages] 🔔 Démarrage du système de notifications`

### Option 2 : Utilisation du bundle pré-compilé

Si `messages-notifier-bundled.js` existe déjà, passez directement à l'étape 3 ci-dessus.

## 🎯 Utilisation

### Notifications de messages

**Fonctionnement automatique** : Une fois l'extension chargée, le système démarre automatiquement sur toutes les pages Vinted.

**Test rapide** :
1. Ouvrez `test-messages.html` dans votre navigateur
2. Cliquez sur "Démarrer les notifications"
3. Envoyez-vous un message depuis un autre compte
4. La notification apparaît en bas à droite

**Personnalisation** : Voir [MESSAGES_NOTIFICATIONS.md](./MESSAGES_NOTIFICATIONS.md)

### Monitor d'articles

1. Aller sur https://www.vinted.fr/catalog
2. L'interface du monitor apparaît automatiquement
3. Configurer vos filtres et démarrer la surveillance

## 📁 Structure du projet

```
vinted-extension/
├── manifest.json                      # Configuration de l'extension
├── js/
│   ├── messagesApi.js                # API pour récupérer les messages
│   ├── messagesNotifier.js           # Système de notifications
│   ├── api.js                        # API Vinted (articles)
│   ├── config.js                     # Configuration globale
│   ├── monitor.js                    # Monitor d'articles
│   ├── ui.js                         # Interface utilisateur
│   └── ...
├── messages-notifier-init.js         # Point d'entrée des notifications
├── messages-notifier-bundled.js      # Bundle compilé (généré)
├── build-messages-notifier.js        # Script de build
├── content-bundled.js                # Bundle du monitor d'articles
├── auto-buy.js                       # Achat automatique
├── auto-checkout.js                  # Checkout automatique
└── test-messages.html                # Page de test

Documentation/
├── README.md                         # Ce fichier
└── MESSAGES_NOTIFICATIONS.md         # Documentation détaillée des notifications
```

## 🔧 Développement

### Modifier le système de notifications

1. Éditer les fichiers sources :
   - `js/messagesApi.js` : Logique API
   - `js/messagesNotifier.js` : Logique des notifications
   - `messages-notifier-init.js` : Initialisation

2. Rebuilder le bundle :
   ```bash
   node build-messages-notifier.js
   ```

3. Recharger l'extension dans Chrome :
   - Aller à `chrome://extensions/`
   - Cliquer sur l'icône de rechargement de l'extension

### Changer l'intervalle de vérification

Dans `messages-notifier-init.js`, ligne 36 :
```javascript
startMessageNotifications(10000); // 10 secondes
// Changer en :
startMessageNotifications(5000);  // 5 secondes
startMessageNotifications(30000); // 30 secondes
```

Puis rebuilder : `node build-messages-notifier.js`

### Déboguer

Ouvrir la console Chrome (F12) sur n'importe quelle page Vinted :
```javascript
// Vérifier l'état
console.log(window.__VINTED_MESSAGE_NOTIFIER_INITIALIZED__); // devrait être true

// Logs utiles
// [Vinted Messages] 🔔 Démarrage du système de notifications
// [Vinted Messages] Initialisé avec X conversations connues
// [Vinted Messages] X nouvelle(s) conversation(s) non lue(s)
```

## 🐛 Résolution de problèmes

### Les notifications n'apparaissent pas

1. **Vérifier que l'extension est chargée** :
   - Aller à `chrome://extensions/`
   - Vérifier que "Vinted Monitor" est activé

2. **Vérifier la console** :
   - Ouvrir F12 sur www.vinted.fr
   - Chercher les erreurs en rouge

3. **Vérifier la connexion Vinted** :
   - Vous devez être connecté à Vinted
   - Essayer de vous déconnecter/reconnecter

4. **Vérifier les permissions** :
   - L'extension doit avoir accès à `https://www.vinted.fr/*`

### Le bundle n'est pas créé

```bash
# Vérifier que Node.js est installé
node --version

# Vérifier les permissions du fichier
ls -la build-messages-notifier.js

# Exécuter avec des droits explicites
chmod +x build-messages-notifier.js
node build-messages-notifier.js
```

### Erreur "MODULE_NOT_FOUND"

Le bundle n'a pas été créé. Exécuter :
```bash
node build-messages-notifier.js
```

### Les notifications apparaissent au démarrage

C'est normal si vous aviez déjà des messages non lus. Le système les détecte comme "nouveaux" la première fois.

**Solution** : Après le premier lancement, rechargez la page. Les messages déjà vus ne réapparaîtront pas.

## 🔐 Sécurité & Confidentialité

- ✅ Aucun serveur tiers
- ✅ Toutes les requêtes vont directement vers Vinted
- ✅ Utilise votre session Vinted existante
- ✅ Aucun stockage de mots de passe ou tokens
- ✅ Code open source et auditable

## 📊 Performance

- Requête légère : ~2-5 Ko toutes les 10 secondes
- Impact minimal sur les performances du navigateur
- Notifications optimisées avec animations CSS

## 🚀 Évolutions prévues

- [ ] Sons de notification
- [ ] Notifications desktop (API Notifications du navigateur)
- [ ] Badge avec compteur de messages non lus
- [ ] Réponse rapide depuis la notification
- [ ] Support multi-comptes
- [ ] Filtres de notifications (par type de message)

## 📝 Changelog

### Version 1.1.0 (Actuelle)
- ✨ Ajout du système de notifications de messages
- ✨ Interface de test pour les notifications
- 📚 Documentation complète

### Version 1.0.0
- 🎉 Version initiale
- Monitor d'articles Vinted
- Auto-buy et auto-checkout

## 📄 Licence

Ce projet est fourni à des fins éducatives.

## 🤝 Contribution

Les contributions sont les bienvenues ! N'hésitez pas à ouvrir une issue ou une pull request.

## ⚠️ Avertissement

Cette extension interagit avec le site Vinted. Utilisez-la de manière responsable et conformément aux conditions d'utilisation de Vinted.

## 📞 Support

Pour plus d'informations sur le système de notifications :
- Voir [MESSAGES_NOTIFICATIONS.md](./MESSAGES_NOTIFICATIONS.md)
- Utiliser `test-messages.html` pour tester

---

Fait avec ❤️ pour la communauté Vinted

