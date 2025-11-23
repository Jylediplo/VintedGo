// ==================== UTILS ====================
function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function formatPrice(item) {
  const amount = item.price?.amount || item.price?.value || item.price || 0;
  const currency = item.price?.currency || item.price?.currency_code || "EUR";
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: currency,
  }).format(amount);
}

function formatTime(date) {
  return new Intl.DateTimeFormat("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(date);
}

function extractSize(item) {
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

function extractCondition(item) {
  if (typeof item.condition === "string") return item.condition;
  return (
    item.condition?.translated_title ||
    item.condition?.title ||
    item.condition_title ||
    item.status ||
    null
  );
}