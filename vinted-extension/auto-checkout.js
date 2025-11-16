// Script pour automatiser le processus de checkout sur Vinted
// Clique automatiquement sur "Choisir un point relais"

(function() {
  'use strict';
  
  console.log('[Vinted Auto-Checkout] Script chargé sur:', window.location.href);
  
  // Vérifier si l'auto-buy est actif via le storage
  chrome.storage.local.get(['autoBuyActive', 'autoBuyTimestamp'], (result) => {
    console.log('[Vinted Auto-Checkout] Storage récupéré:', result);
    
    const shouldAutoCheckout = result.autoBuyActive === true;
    const timestamp = result.autoBuyTimestamp || 0;
    const isRecent = (Date.now() - timestamp) < 60000; // Moins de 60 secondes
    
    if (!shouldAutoCheckout || !isRecent) {
      console.log('[Vinted Auto-Checkout] Auto-checkout inactif ou expiré (active:', shouldAutoCheckout, ', recent:', isRecent, ')');
      return;
    }
    
    console.log('[Vinted Auto-Checkout] Mode auto-checkout activé, recherche du bouton point relais...');
    
    // Nettoyer le storage après utilisation
    chrome.storage.local.remove(['autoBuyActive', 'autoBuyTimestamp'], () => {
      console.log('[Vinted Auto-Checkout] Storage nettoyé');
    });
    
    startAutoCheckout();
  });
  
  function startAutoCheckout() {
  
  // Fonction pour trouver et cliquer sur "Choisir un point relais"
  function findAndClickPickupPoint() {
    console.log('[Vinted Auto-Checkout] Recherche du bouton "Choisir un point relais"...');
    
    // Méthode 1: Par data-testid (état vide)
    let pickupButton = document.querySelector('[data-testid="pickup_point_empty_state"]');
    
    // Méthode 2: Par data-testid (état édition - point relais déjà sélectionné)
    if (!pickupButton) {
      pickupButton = document.querySelector('[data-testid="pickup_point_edit"]');
      if (pickupButton) {
        console.log('[Vinted Auto-Checkout] Point relais déjà sélectionné, clic pour modifier...');
      }
    }
    
    // Méthode 3: Par texte "Choisir un point relais"
    if (!pickupButton) {
      const cells = document.querySelectorAll('.web_ui__Cell__cell');
      for (const cell of cells) {
        const title = cell.querySelector('.web_ui__Text__title');
        if (title && title.textContent.includes('Choisir un point relais')) {
          pickupButton = cell;
          break;
        }
      }
    }
    
    // Méthode 4: Recherche large par texte
    if (!pickupButton) {
      const allElements = document.querySelectorAll('*');
      for (const el of allElements) {
        if (el.textContent === 'Choisir un point relais' && el.closest('[role="button"]')) {
          pickupButton = el.closest('[role="button"]');
          break;
        }
      }
    }
    
    if (pickupButton) {
      console.log('[Vinted Auto-Checkout] Bouton point relais trouvé:', pickupButton);
      console.log('[Vinted Auto-Checkout] Classes:', pickupButton.className);
      
      // Vérifier si l'élément est visible et cliquable
      const isVisible = pickupButton.offsetParent !== null;
      const rect = pickupButton.getBoundingClientRect();
      const isInViewport = rect.top >= 0 && rect.bottom <= window.innerHeight;
      
      console.log('[Vinted Auto-Checkout] État - Visible:', isVisible, ', Dans viewport:', isInViewport);
      
      if (isVisible) {
        console.log('[Vinted Auto-Checkout] Scroll et clic sur le bouton...');
        
        // Scroll vers l'élément
        pickupButton.scrollIntoView({ behavior: 'smooth', block: 'center' });
        
        setTimeout(() => {
          // Méthode 1: click()
          console.log('[Vinted Auto-Checkout] Tentative - Méthode 1: click()');
          pickupButton.click();
          
          setTimeout(() => {
            // Méthode 2: MouseEvent
            console.log('[Vinted Auto-Checkout] Tentative - Méthode 2: MouseEvent');
            
            const clickEvent = new MouseEvent('click', {
              bubbles: true,
              cancelable: true,
              view: window,
              button: 0
            });
            pickupButton.dispatchEvent(clickEvent);
            
            setTimeout(() => {
              // Méthode 3: PointerEvent
              console.log('[Vinted Auto-Checkout] Tentative - Méthode 3: PointerEvent');
              
              const pointerDownEvent = new PointerEvent('pointerdown', {
                bubbles: true,
                cancelable: true,
                view: window,
                pointerId: 1,
                pointerType: 'mouse',
                isPrimary: true
              });
              const pointerUpEvent = new PointerEvent('pointerup', {
                bubbles: true,
                cancelable: true,
                view: window,
                pointerId: 1,
                pointerType: 'mouse',
                isPrimary: true
              });
              
              pickupButton.dispatchEvent(pointerDownEvent);
              pickupButton.dispatchEvent(pointerUpEvent);
              
              // Focus
              pickupButton.focus();
              
              console.log('[Vinted Auto-Checkout] ✅ Tous les événements envoyés !');
              
              // Nettoyer l'URL
              const cleanUrl = window.location.href.split('?')[0];
              window.history.replaceState({}, document.title, cleanUrl);
            }, 200);
          }, 300);
        }, 800);
        
        return true;
      } else {
        console.log('[Vinted Auto-Checkout] ⚠️ Bouton trouvé mais pas visible');
        return false;
      }
    } else {
      console.log('[Vinted Auto-Checkout] ❌ Bouton "Choisir un point relais" non trouvé');
      return false;
    }
  }
  
  // Fonction pour vérifier si le bon point relais est déjà sélectionné
  function checkIfCorrectPickupSelected(savedPickupPoints) {
    console.log('[Vinted Auto-Checkout] Vérification du point relais déjà sélectionné...');
    
    // Chercher le bouton "pickup_point_edit" qui indique qu'un point est déjà sélectionné
    const editButton = document.querySelector('[data-testid="pickup_point_edit"]');
    
    if (!editButton) {
      console.log('[Vinted Auto-Checkout] Aucun point relais déjà sélectionné');
      return false;
    }
    
    // Récupérer le nom du point relais actuellement sélectionné
    const titleElement = editButton.querySelector('[data-testid="pickup_point_edit--title"]');
    if (!titleElement) {
      console.log('[Vinted Auto-Checkout] Impossible de trouver le titre du point relais');
      return false;
    }
    
    const currentPickupText = titleElement.textContent.toUpperCase();
    console.log('[Vinted Auto-Checkout] Point relais actuellement sélectionné:', currentPickupText);
    
    // Vérifier si c'est un des points relais prioritaires
    for (const savedPoint of savedPickupPoints) {
      const savedName = savedPoint.name.toUpperCase();
      if (currentPickupText.includes(savedName)) {
        console.log('[Vinted Auto-Checkout] ✅ Le bon point relais est déjà sélectionné:', savedPoint.name);
        return true;
      }
    }
    
    console.log('[Vinted Auto-Checkout] ⚠️ Le point relais sélectionné ne correspond pas aux priorités');
    return false;
  }
  
  // Fonction pour sélectionner un point relais spécifique
  function selectPickupPoint() {
    console.log('[Vinted Auto-Checkout] Recherche du point relais à sélectionner...');
    
    // Récupérer les points relais sauvegardés
    chrome.storage.local.get(['pickupPoints'], (result) => {
      const savedPickupPoints = result.pickupPoints || [];
      console.log('[Vinted Auto-Checkout] Points relais sauvegardés:', savedPickupPoints);
      
      if (savedPickupPoints.length === 0) {
        console.log('[Vinted Auto-Checkout] ⚠️ Aucun point relais configuré');
        return;
      }
      
      // Vérifier si le bon point relais est déjà sélectionné
      if (checkIfCorrectPickupSelected(savedPickupPoints)) {
        console.log('[Vinted Auto-Checkout] ✅ Pas besoin de changer de point relais, clic sur Confirmer...');
        setTimeout(() => {
          clickConfirmButton();
        }, 500);
        return;
      }
      
      // Chercher les points relais disponibles sur la page
      const pickupCards = document.querySelectorAll('[data-testid="shipping-info-card"]');
      console.log('[Vinted Auto-Checkout] Points relais trouvés sur la page:', pickupCards.length);
      
      // Essayer de trouver un point relais correspondant par ordre de priorité
      for (const savedPoint of savedPickupPoints) {
        for (const card of pickupCards) {
          const fullText = card.textContent;
          
          console.log('[Vinted Auto-Checkout] Comparaison:', {
            saved: savedPoint.name,
            cardText: fullText.substring(0, 100)
          });
          
            // Vérifier si le nom correspond (recherche insensible à la casse)
          if (fullText.toUpperCase().includes(savedPoint.name.toUpperCase())) {
            console.log('[Vinted Auto-Checkout] ✅ Point relais trouvé:', savedPoint.name);
            
            // Cliquer sur la carte
            card.scrollIntoView({ behavior: 'smooth', block: 'center' });
            
            setTimeout(() => {
              card.click();
              
              setTimeout(() => {
                const clickEvent = new MouseEvent('click', {
                  bubbles: true,
                  cancelable: true,
                  view: window
                });
                card.dispatchEvent(clickEvent);
                
                console.log('[Vinted Auto-Checkout] ✅ Point relais sélectionné !');
                
                // Attendre un peu puis cliquer sur le bouton Confirmer
                setTimeout(() => {
                  clickConfirmButton();
                }, 1000);
              }, 300);
            }, 500);
            
            return;
          }
        }
      }
      
      console.log('[Vinted Auto-Checkout] ⚠️ Aucun point relais correspondant trouvé');
    });
  }
  
  // Fonction pour cliquer sur le bouton Confirmer
  function clickConfirmButton() {
    console.log('[Vinted Auto-Checkout] Recherche du bouton "Confirmer"...');
    
    // Méthode 1: Par texte du bouton
    let confirmButton = null;
    const buttons = document.querySelectorAll('button');
    
    for (const button of buttons) {
      const label = button.querySelector('.web_ui__Button__label');
      if (label && label.textContent.trim() === 'Confirmer') {
        confirmButton = button;
        break;
      }
    }
    
    // Méthode 2: Recherche large
    if (!confirmButton) {
      for (const button of buttons) {
        if (button.textContent.includes('Confirmer')) {
          confirmButton = button;
          break;
        }
      }
    }
    
    if (confirmButton) {
      console.log('[Vinted Auto-Checkout] Bouton "Confirmer" trouvé:', confirmButton);
      
      // Vérifier si le bouton est cliquable
      const isVisible = confirmButton.offsetParent !== null;
      const isDisabled = confirmButton.disabled || confirmButton.getAttribute('disabled') !== null;
      
      console.log('[Vinted Auto-Checkout] État du bouton - Visible:', isVisible, ', Disabled:', isDisabled);
      
      if (isVisible && !isDisabled) {
        console.log('[Vinted Auto-Checkout] Clic sur le bouton "Confirmer"...');
        
        // Scroll vers le bouton
        confirmButton.scrollIntoView({ behavior: 'smooth', block: 'center' });
        
        setTimeout(() => {
          // Méthode 1: click()
          confirmButton.click();
          
          setTimeout(() => {
            // Méthode 2: MouseEvent
            const clickEvent = new MouseEvent('click', {
              bubbles: true,
              cancelable: true,
              view: window,
              button: 0
            });
            confirmButton.dispatchEvent(clickEvent);
            
            setTimeout(() => {
              // Méthode 3: PointerEvent
              const pointerDownEvent = new PointerEvent('pointerdown', {
                bubbles: true,
                cancelable: true,
                view: window,
                pointerId: 1,
                pointerType: 'mouse',
                isPrimary: true
              });
              const pointerUpEvent = new PointerEvent('pointerup', {
                bubbles: true,
                cancelable: true,
                view: window,
                pointerId: 1,
                pointerType: 'mouse',
                isPrimary: true
              });
              
              confirmButton.dispatchEvent(pointerDownEvent);
              confirmButton.dispatchEvent(pointerUpEvent);
              
              console.log('[Vinted Auto-Checkout] ✅ Bouton "Confirmer" cliqué !');
            }, 200);
          }, 300);
        }, 500);
      } else {
        console.log('[Vinted Auto-Checkout] ⚠️ Bouton "Confirmer" non cliquable');
      }
    } else {
      console.log('[Vinted Auto-Checkout] ❌ Bouton "Confirmer" non trouvé');
    }
  }
  
  // Essayer immédiatement
  let clicked = findAndClickPickupPoint();
  
  // Si non trouvé, réessayer
  if (!clicked) {
    console.log('[Vinted Auto-Checkout] Nouvelle tentative dans 1 seconde...');
    setTimeout(() => {
      clicked = findAndClickPickupPoint();
      
      // Si toujours pas trouvé, utiliser MutationObserver
      if (!clicked) {
        console.log('[Vinted Auto-Checkout] Utilisation du MutationObserver...');
        
        const observer = new MutationObserver((mutations, obs) => {
          if (findAndClickPickupPoint()) {
            obs.disconnect();
            
            // Attendre que la modal s'ouvre et sélectionner le point relais
            setTimeout(() => {
              selectPickupPoint();
            }, 2000);
          }
        });
        
        observer.observe(document.body, {
          childList: true,
          subtree: true
        });
        
        // Timeout après 15 secondes
        setTimeout(() => {
          observer.disconnect();
          console.log('[Vinted Auto-Checkout] Timeout - arrêt de la recherche');
        }, 15000);
      } else {
        // Si le clic a réussi, attendre et sélectionner le point relais
        setTimeout(() => {
          selectPickupPoint();
        }, 2000);
      }
    }, 1000);
  } else {
    // Si le clic a réussi immédiatement, attendre et sélectionner le point relais
    setTimeout(() => {
      selectPickupPoint();
    }, 2000);
  }
  
  } // Fin de startAutoCheckout
})();

