(function () {
  const options = document.querySelectorAll('.lang-option');
  const path = window.location.pathname.replace(/\/+$/, '');
  const pathLang = path === '/en' ? 'en' : path === '/ja' ? 'ja' : 'zh';
  const localizedLinks = {
    aboutLink: {
      en: 'https://blog.wei-lee.me/en/pages/about-me',
      ja: 'https://blog.wei-lee.me/en/pages/about-me',
      zh: 'https://blog.wei-lee.me/pages/about-me'
    },
    nowLink: {
      en: 'https://blog.wei-lee.me/en/pages/now',
      ja: 'https://blog.wei-lee.me/en/pages/now',
      zh: 'https://blog.wei-lee.me/pages/now'
    }
  };

  function setLang(lang) {
    const nextLang = lang === 'en' || lang === 'ja' ? lang : 'zh';
    document.documentElement.classList.remove('lang-zh', 'lang-en', 'lang-ja');
    document.documentElement.classList.add('lang-' + nextLang);
    document.documentElement.lang = { zh: 'zh-Hant', en: 'en', ja: 'ja' }[nextLang];

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
