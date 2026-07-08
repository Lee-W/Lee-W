(function () {
  const options = document.querySelectorAll('.lang-option');
  const pathLang = window.location.pathname.replace(/\/+$/, '') === '/en' ? 'en' : 'zh';
  const localizedLinks = {
    aboutLink: {
      en: 'https://blog.wei-lee.me/en/pages/about-me',
      zh: 'https://blog.wei-lee.me/pages/about-me'
    },
    nowLink: {
      en: 'https://blog.wei-lee.me/en/pages/now',
      zh: 'https://blog.wei-lee.me/pages/now'
    }
  };

  function setLang(lang) {
    const nextLang = lang === 'zh' ? 'zh' : 'en';
    document.documentElement.classList.remove('lang-zh', 'lang-en');
    document.documentElement.classList.add('lang-' + nextLang);
    document.documentElement.lang = nextLang === 'zh' ? 'zh-Hant' : 'en';

    options.forEach((option) => {
      const isActive = option.dataset.value === nextLang;
      option.classList.toggle('active', isActive);
      option.setAttribute('aria-pressed', String(isActive));
    });

    Object.entries(localizedLinks).forEach(([id, urls]) => {
      const link = document.getElementById(id);
      if (link) link.href = urls[nextLang];
    });

    localStorage.setItem('lang', nextLang);
  }

  setLang(pathLang);
  options.forEach((option) => {
    option.addEventListener('click', () => {
      localStorage.setItem('lang', option.dataset.value);
    });
  });
})();
