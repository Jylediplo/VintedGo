// ==================== PICKUP POINTS SYSTEM ====================

const PICKUP_POINTS_STORAGE_KEY = 'pickupPoints';
let pickupPointsRetries = 0;
const MAX_PICKUP_RETRIES = 10;

async function loadPickupPoints() {
  return new Promise((resolve) => {
    chrome.storage.local.get([PICKUP_POINTS_STORAGE_KEY], (result) => {
      const points = result[PICKUP_POINTS_STORAGE_KEY] || [];
      resolve(points);
    });
  });
}

function savePickupPoints(points) {
  chrome.storage.local.set({ [PICKUP_POINTS_STORAGE_KEY]: points }, () => {
    console.log('[Pickup Points] Points relais sauvegardés:', points);
  });
}

function createPickupPoint() {
  const name = prompt('Nom du point relais (ex: LOCKER 24/7 HYPER U ROMANS SUR):');
  if (!name || name.trim() === '') return;
  
  loadPickupPoints().then(points => {
    if (points.length >= 3) {
      alert('Vous ne pouvez enregistrer que 3 points relais maximum');
      return;
    }
    
    const newPoint = {
      id: Date.now().toString(),
      name: name.trim()
    };
    
    points.push(newPoint);
    savePickupPoints(points);
    renderPickupPointsList();
  });
}

function deletePickupPoint(pointId) {
  if (!confirm('Supprimer ce point relais ?')) return;
  
  loadPickupPoints().then(points => {
    const filtered = points.filter(p => p.id !== pointId);
    savePickupPoints(filtered);
    renderPickupPointsList();
  });
}

function movePickupPointUp(pointId) {
  loadPickupPoints().then(points => {
    const index = points.findIndex(p => p.id === pointId);
    if (index > 0) {
      [points[index - 1], points[index]] = [points[index], points[index - 1]];
      savePickupPoints(points);
      renderPickupPointsList();
    }
  });
}

function movePickupPointDown(pointId) {
  loadPickupPoints().then(points => {
    const index = points.findIndex(p => p.id === pointId);
    if (index < points.length - 1) {
      [points[index], points[index + 1]] = [points[index + 1], points[index]];
      savePickupPoints(points);
      renderPickupPointsList();
    }
  });
}

function renderPickupPointsList() {
  const list = document.getElementById('pickup-points-list');
  if (!list) return;
  
  // Mettre à jour le compteur
  updatePickupCount();
  
  loadPickupPoints().then(points => {
    if (points.length === 0) {
      list.innerHTML = '<p class="pickup-empty">Aucun point relais configuré</p>';
      return;
    }
    
    list.innerHTML = points.map((point, index) => `
      <div class="pickup-point-item" data-point-id="${point.id}">
        <div class="pickup-point-priority">${index + 1}</div>
        <div class="pickup-point-content">
          <div class="pickup-point-name">${escapeHtml(point.name)}</div>
        </div>
        <div class="pickup-point-actions">
          ${index > 0 ? `<button class="btn-move-up" data-point-id="${point.id}" title="Monter">↑</button>` : '<span class="btn-placeholder"></span>'}
          ${index < points.length - 1 ? `<button class="btn-move-down" data-point-id="${point.id}" title="Descendre">↓</button>` : '<span class="btn-placeholder"></span>'}
          <button class="btn-delete-pickup" data-point-id="${point.id}" title="Supprimer">✖</button>
        </div>
      </div>
    `).join('');
    
    // Event listeners
    list.querySelectorAll('.btn-move-up').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        movePickupPointUp(btn.dataset.pointId);
      });
    });
    
    list.querySelectorAll('.btn-move-down').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        movePickupPointDown(btn.dataset.pointId);
      });
    });
    
    list.querySelectorAll('.btn-delete-pickup').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        deletePickupPoint(btn.dataset.pointId);
      });
    });
  });
}

function createPickupPointsSystem() {
  const sidebar = document.getElementById('sidebar');
  
  if (!sidebar) {
    pickupPointsRetries++;
    if (pickupPointsRetries < MAX_PICKUP_RETRIES) {
      console.warn(`[Pickup Points] Sidebar non trouvée (tentative ${pickupPointsRetries}/${MAX_PICKUP_RETRIES}), réessai dans 500ms`);
      setTimeout(createPickupPointsSystem, 500);
    } else {
      console.error("[Pickup Points] Sidebar introuvable après plusieurs tentatives, abandon");
    }
    return;
  }
  
  if (document.getElementById('pickup-points-system')) {
    console.log("[Pickup Points] Interface déjà créée");
    return;
  }
  
  try {
    const pickupSystem = document.createElement('div');
    pickupSystem.id = 'pickup-points-system';
    pickupSystem.className = 'pickup-points-system';
    pickupSystem.style.display = 'none'; // Masqué par défaut
    pickupSystem.innerHTML = `
      <div class="pickup-system-header">
        <h3 class="pickup-system-title">Points Relais</h3>
        <button id="create-pickup-point" class="btn-create-pickup" title="Ajouter un point relais">Ajouter</button>
      </div>
      <div id="pickup-points-list" class="pickup-points-list">
        <p class="pickup-empty">Aucun point relais configuré</p>
      </div>
      <div class="pickup-system-info">
        <p class="pickup-info-text">
          <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style="display: inline-block; vertical-align: middle; margin-right: 4px;">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
          </svg>
          Priorité: 1 > 2 > 3
        </p>
      </div>
    `;
    
    // Insérer dans le conteneur sticky avec les autres sections
    const stickyContainer = document.getElementById('sidebar-sticky-container');
    if (stickyContainer) {
      // Insérer après les alertes
      const alertSystem = document.getElementById('alert-system');
      if (alertSystem && alertSystem.parentNode === stickyContainer) {
        stickyContainer.insertBefore(pickupSystem, alertSystem.nextSibling);
      } else {
        stickyContainer.appendChild(pickupSystem);
      }
    } else {
      // Fallback si le sticky container n'existe pas encore
      const alertSystem = document.getElementById('alert-system');
      if (alertSystem && alertSystem.parentNode) {
        alertSystem.parentNode.insertBefore(pickupSystem, alertSystem.nextSibling);
      } else {
        sidebar.insertBefore(pickupSystem, sidebar.firstChild);
      }
    }
    
    document.getElementById('create-pickup-point').addEventListener('click', createPickupPoint);
    renderPickupPointsList();
    
    console.log("[Pickup Points] Interface créée avec succès");
  } catch (error) {
    console.error("[Pickup Points] Erreur lors de la création:", error);
    pickupPointsRetries++;
    if (pickupPointsRetries < MAX_PICKUP_RETRIES) {
      setTimeout(createPickupPointsSystem, 500);
    }
  }
}