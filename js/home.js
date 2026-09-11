(function () {
  function storeLang(lang) {
    try {
      localStorage.setItem('lang', lang);
    } catch (e) {
      // Language links and localized content also work with storage disabled.
    }
  }

  // The generated document is authoritative, including /en/index.html URLs.
  const current = document.querySelector('.lang-option[aria-current="page"]');
  if (current) storeLang(current.dataset.value);
  document.querySelectorAll('.lang-option').forEach((option) => {
    option.addEventListener('click', () => storeLang(option.dataset.value));
  });
})();
