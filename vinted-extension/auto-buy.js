// Script pour cliquer automatiquement sur le bouton "Acheter" sur les pages d'articles Vinted
// S'exécute uniquement si la page a été ouverte via le bouton Buy de l'extension

(function() {
  'use strict';
  
  console.log('[Vinted Auto-Buy] Script chargé sur:', window.location.href);
  
  // Vérifier si on doit auto-cliquer (via paramètre URL)
  const urlParams = new URLSearchParams(window.location.search);
  const shouldAutoBuy = urlParams.get('auto_buy') === 'true';
  
  if (!shouldAutoBuy) {
    console.log('[Vinted Auto-Buy] Pas de paramètre auto_buy, script inactif');
    return;
  }
  
  console.log('[Vinted Auto-Buy] Mode auto-buy activé, recherche du bouton...');
  
  // Sauvegarder dans le storage pour la page checkout
  chrome.storage.local.set({ autoBuyActive: true, autoBuyTimestamp: Date.now() }, () => {
    console.log('[Vinted Auto-Buy] État sauvegardé dans storage');
  });
  
  // Fonction pour trouver et cliquer sur le bouton "Acheter"
  function findAndClickBuyButton() {
    // Sélecteurs possibles pour le bouton "Acheter"
    const selectors = [
      'button[data-testid="item-buy-button"]',
      'button.web_ui__Button__button:has(.web_ui__Button__label:contains("Acheter"))',
      'button:contains("Acheter")',
      '.web_ui__Button__button .web_ui__Button__label:contains("Acheter")'
    ];
    
    // Essayer de trouver le bouton avec différents sélecteurs
    let buyButton = null;
    
    // Méthode 1: Par data-testid
    buyButton = document.querySelector('button[data-testid="item-buy-button"]');
    
    // Méthode 2: Par texte du bouton
    if (!buyButton) {
      const buttons = document.querySelectorAll('button');
      for (const button of buttons) {
        const label = button.querySelector('.web_ui__Button__label');
        if (label && label.textContent.trim() === 'Acheter') {
          buyButton = button;
          break;
        }
      }
    }
    
    // Méthode 3: Recherche plus large
    if (!buyButton) {
      const buttons = document.querySelectorAll('button');
      for (const button of buttons) {
        if (button.textContent.includes('Acheter')) {
          buyButton = button;
          break;
        }
      }
    }
    
    if (buyButton) {
      console.log('[Vinted Auto-Buy] Bouton trouvé:', buyButton);
      console.log('[Vinted Auto-Buy] Classes du bouton:', buyButton.className);
      console.log('[Vinted Auto-Buy] HTML du bouton:', buyButton.outerHTML.substring(0, 200));
      
      // Vérifier si le bouton est visible et cliquable
      const isVisible = buyButton.offsetParent !== null;
      const isDisabled = buyButton.disabled || buyButton.getAttribute('disabled') !== null || buyButton.classList.contains('disabled');
      
      console.log('[Vinted Auto-Buy] État du bouton - Visible:', isVisible, ', Disabled:', isDisabled);
      
      if (isVisible && !isDisabled) {
        console.log('[Vinted Auto-Buy] Clic sur le bouton Acheter...');
        
        // Scroll vers le bouton
        buyButton.scrollIntoView({ behavior: 'smooth', block: 'center' });
        
        setTimeout(() => {
          // Essayer plusieurs méthodes de clic
          console.log('[Vinted Auto-Buy] Tentative de clic - Méthode 1: click()');
          buyButton.click();
          
          setTimeout(() => {
            // Méthode 2: Dispatch d'événements MouseEvent
            console.log('[Vinted Auto-Buy] Tentative de clic - Méthode 2: MouseEvent');
            
            const mouseDownEvent = new MouseEvent('mousedown', {
              bubbles: true,
              cancelable: true,
              view: window,
              button: 0
            });
            const mouseUpEvent = new MouseEvent('mouseup', {
              bubbles: true,
              cancelable: true,
              view: window,
              button: 0
            });
            const clickEvent = new MouseEvent('click', {
              bubbles: true,
              cancelable: true,
              view: window,
              button: 0
            });
            
            buyButton.dispatchEvent(mouseDownEvent);
            buyButton.dispatchEvent(mouseUpEvent);
            buyButton.dispatchEvent(clickEvent);
            
            setTimeout(() => {
              // Méthode 3: PointerEvent (utilisé par React)
              console.log('[Vinted Auto-Buy] Tentative de clic - Méthode 3: PointerEvent');
              
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
              
              buyButton.dispatchEvent(pointerDownEvent);
              buyButton.dispatchEvent(pointerUpEvent);
              
              // Focus sur le bouton
              buyButton.focus();
              
              console.log('[Vinted Auto-Buy] ✅ Tous les événements de clic envoyés !');
              
              // Nettoyer l'URL pour retirer le paramètre auto_buy
              const cleanUrl = window.location.href.split('?')[0];
              window.history.replaceState({}, document.title, cleanUrl);
            }, 200);
          }, 300);
        }, 800);
        
        return true;
      } else {
        console.log('[Vinted Auto-Buy] ⚠️ Bouton trouvé mais non cliquable (visible:', isVisible, ', disabled:', isDisabled, ')');
        return false;
      }
    } else {
      console.log('[Vinted Auto-Buy] ❌ Bouton "Acheter" non trouvé');
      return false;
    }
  }
  
  // Essayer de cliquer immédiatement
  let clicked = findAndClickBuyButton();
  
  // Si le bouton n'est pas trouvé, réessayer avec un délai
  if (!clicked) {
    console.log('[Vinted Auto-Buy] Nouvelle tentative dans 1 seconde...');
    setTimeout(() => {
      clicked = findAndClickBuyButton();
      
      // Si toujours pas trouvé, utiliser un MutationObserver
      if (!clicked) {
        console.log('[Vinted Auto-Buy] Utilisation du MutationObserver...');
        
        const observer = new MutationObserver((mutations, obs) => {
          if (findAndClickBuyButton()) {
            obs.disconnect();
          }
        });
        
        observer.observe(document.body, {
          childList: true,
          subtree: true
        });
        
        // Arrêter l'observation après 10 secondes
        setTimeout(() => {
          observer.disconnect();
          console.log('[Vinted Auto-Buy] Timeout - arrêt de la recherche');
        }, 10000);
      }
    }, 1000);
  }
})();

