// Gestion du clic sur le logo Vinted
document.getElementById('logoContainer').addEventListener('click', () => {
  chrome.tabs.create({
    url: 'https://www.vinted.fr/catalog'
  });
});

