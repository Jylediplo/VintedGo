// ==================== WALLET BALANCE ====================
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
                    console.log("[Wallet] User ID trouvé via API inbox (conversation complète):", userId);
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
    console.error("[Wallet] Erreur lors de la récupération via API inbox:", error);
  }
  
  console.warn("[Wallet] User ID non trouvé");
  return null;
}

async function fetchWalletBalance() {
  const userId = await getUserId();
  if (!userId) {
    console.warn("[Wallet] User ID non trouvé");
    return null;
  }

  try {
    const response = await fetch(`https://www.vinted.fr/api/v2/users/${userId}/balance`, {
      method: 'GET',
      credentials: 'include',
      headers: {
        'accept': 'application/json, text/plain, */*',
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    if (data.user_balance) {
      return {
        available: parseFloat(data.user_balance.available_amount?.amount || data.user_balance.available_amount || 0) || 0,
        escrow: parseFloat(data.user_balance.escrow_amount?.amount || data.user_balance.escrow_amount || 0) || 0,
        currency: data.user_balance.available_amount?.currency_code || data.user_balance.currency || 'EUR'
      };
    }
    return null;
  } catch (error) {
    console.error("[Wallet] Erreur lors de la récupération du solde:", error);
    return null;
  }
}

function formatBalance(amount, currency = 'EUR') {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
}

function updateWalletDisplay(balance) {
  const walletDisplay = document.getElementById('vinted-wallet-balance');
  if (!walletDisplay) return;

  if (balance) {
    const availableText = formatBalance(balance.available, balance.currency);
    const escrowText = formatBalance(balance.escrow, balance.currency);
    
    // Afficher le solde disponible et le montant à venir
    if (balance.escrow > 0) {
      walletDisplay.textContent = `${availableText} (+ ${escrowText})`;
      walletDisplay.title = `Solde disponible: ${availableText} | Montant à venir: ${escrowText}`;
    } else {
      walletDisplay.textContent = availableText;
      walletDisplay.title = `Solde disponible: ${availableText}`;
    }
  } else {
    walletDisplay.textContent = '--';
    walletDisplay.title = 'Solde non disponible';
  }
}

async function loadWalletBalance() {
  const balance = await fetchWalletBalance();
  updateWalletDisplay(balance);
  // Ne pas appeler initOfferCount ici car il est déjà appelé dans ui.js
  // pour éviter les appels en double
  return balance;
}