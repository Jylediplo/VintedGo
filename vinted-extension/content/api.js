// ==================== API ====================
function extractVintedUrlParams() {
  const currentUrl = new URL(window.location.href);
  const params = {};
  
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
    'order',
    'search_text'
  ];
  
  for (const [key, value] of currentUrl.searchParams.entries()) {
    if (key.endsWith('[]')) {
      if (!params[key]) {
        params[key] = [];
      }
      params[key].push(value);
    } else if (relevantParams.includes(key)) {
      params[key] = value;
    }
  }
  
  return params;
}

function extractItems(data) {
  if (data.items) return data.items;
  if (data.catalog_items) return data.catalog_items;
  if (data.catalog?.items) return data.catalog.items;
  if (data.data?.items) return data.data.items;
  return [];
}

async function fetchNewItems() {
  const url = new URL("https://www.vinted.fr/api/v2/catalog/items");
  const vintedParams = extractVintedUrlParams();
  
  if (!vintedParams['brand_ids[]'] || vintedParams['brand_ids[]'].length === 0) {
    url.searchParams.set("brand_ids[]", CONFIG.DEFAULT_BRAND_ID);
  } else {
    vintedParams['brand_ids[]'].forEach(brandId => {
      url.searchParams.append("brand_ids[]", brandId);
    });
  }
  
  for (const [key, value] of Object.entries(vintedParams)) {
    if (key === 'brand_ids[]') continue;
    if (Array.isArray(value)) {
      value.forEach(v => url.searchParams.append(key, v));
    } else {
      url.searchParams.set(key, value);
    }
  }
  
  if (!url.searchParams.has("order")) {
    url.searchParams.set("order", "newest_first");
  }
  url.searchParams.set("page", "1");
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