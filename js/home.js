(function () {
  function storeLang(lang) {
    try {
      localStorage.setItem('lang', lang);
    } catch (e) {
      // Language links and localized content also work with storage disabled.
    }
  }

  // The generated document is authoritative, including /en/index.html URLs.
  // "/" is only a Chinese fallback that redirects; it must not overwrite the
  // reader's saved language before (or instead of) that redirect.
  const current = document.querySelector('.lang-option[aria-current="page"]');
  const atRoot = location.pathname === '/' || location.pathname === '/index.html';
  if (current && !atRoot) storeLang(current.dataset.value);
  document.querySelectorAll('.lang-option').forEach((option) => {
    option.addEventListener('click', () => storeLang(option.dataset.value));
  });
})();
