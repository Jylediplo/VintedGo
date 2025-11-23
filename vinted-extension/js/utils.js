// Utilitaires généraux

// Échapper le HTML
export function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

// Formater le prix
export function formatPrice(item) {
  // Gérer différents formats de prix
  let amount = item.price?.amount || item.price?.value || item.price || 0;
  
  // Si amount est une chaîne, la convertir en nombre
  if (typeof amount === 'string') {
    amount = parseFloat(amount.replace(',', '.')) || 0;
  }
  
  const currency = item.price?.currency || item.price?.currency_code || "EUR";

  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: currency,
  }).format(amount);
}

// Formater l'heure
export function formatTime(date) {
  return new Intl.DateTimeFormat("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(date);
}

// Extraire la taille
export function extractSize(item) {
  const sizeLabel =
    item.size_title ||
    item.size?.localized_title ||
    item.size?.title ||
    item.size?.brand_size;

  if (!sizeLabel) return null;

  return sizeLabel
    .replace(/^(taille|size)\s+/i, "")
    .replace(/\b(taille unique|unique size)\b/i, "TU")
    .split(/[\s,/|-]+/)[0]
    ?.toUpperCase();
}

// Extraire la condition
export function extractCondition(item) {
  if (typeof item.condition === "string") return item.condition;
  return (
    item.condition?.translated_title ||
    item.condition?.title ||
    item.condition_title ||
    item.status ||
    null
  );
}

