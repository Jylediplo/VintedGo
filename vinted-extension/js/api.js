// Gestion des appels API Vinted
import { CONFIG } from './config.js';

// Extraire les paramètres de recherche de l'URL Vinted actuelle
export function extractVintedUrlParams() {
  const currentUrl = new URL(window.location.href);
  const params = {};
  
  // Extraire tous les paramètres pertinents
  const relevantParams = [
    'brand_ids[]',
    'size_ids[]',
    'color_ids[]',
    'material_ids[]',
    'status_ids[]',
    'catalog_ids[]',
    'price_from',
    'price_to',
    'currency',
    'order'
  ];
  
  // Parcourir tous les paramètres de l'URL
  for (const [key, value] of currentUrl.searchParams.entries()) {
    // Garder les paramètres de type tableau (brand_ids[], size_ids[], etc.)
    if (key.endsWith('[]')) {
      if (!params[key]) {
        params[key] = [];
      }
      params[key].push(value);
    }
    // Garder les autres paramètres pertinents
    else if (relevantParams.includes(key)) {
      params[key] = value;
    }
  }
  
  return params;
}

// Extraire les items de la réponse API
export function extractItems(data) {
  // Chercher les items dans différentes structures possibles
  if (data.items) return data.items;
  if (data.catalog_items) return data.catalog_items;
  if (data.catalog?.items) return data.catalog.items;
  if (data.data?.items) return data.data.items;
  return [];
}

// Récupérer les nouveaux articles depuis l'API
export async function fetchNewItems() {
  const url = new URL("https://www.vinted.fr/api/v2/catalog/items");
  
  // Récupérer les paramètres de l'URL Vinted actuelle
  const vintedParams = extractVintedUrlParams();
  
  // Si aucun brand_ids dans l'URL, utiliser la valeur par défaut
  if (!vintedParams['brand_ids[]'] || vintedParams['brand_ids[]'].length === 0) {
    url.searchParams.set("brand_ids[]", CONFIG.DEFAULT_BRAND_ID);
  } else {
    // Ajouter tous les brand_ids de l'URL
    vintedParams['brand_ids[]'].forEach(brandId => {
      url.searchParams.append("brand_ids[]", brandId);
    });
  }
  
  // Ajouter tous les autres paramètres extraits
  for (const [key, value] of Object.entries(vintedParams)) {
    if (key === 'brand_ids[]') continue; // Déjà traité
    
    if (Array.isArray(value)) {
      value.forEach(v => url.searchParams.append(key, v));
    } else {
      url.searchParams.set(key, value);
    }
  }
  
  // Paramètres obligatoires
  if (!url.searchParams.has("order")) {
    url.searchParams.set("order", "newest_first");
  }
  url.searchParams.set("page", "1");
  
  // Ajouter 30 secondes dans le futur
  const futureTime = Math.floor(Date.now() / 1000) + 30;
  url.searchParams.set("time", futureTime.toString());

  const response = await fetch(url.toString(), {
    credentials: "include",
    headers: {
      "accept": "application/json, text/plain, */*",
      "accept-language": "fr-FR,fr;q=0.9",
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const data = await response.json();
  return extractItems(data);
}

