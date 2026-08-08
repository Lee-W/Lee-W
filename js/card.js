(function () {
  const options = document.querySelectorAll('.lang-option');

  function readStoredLang() {
    try {
      return localStorage.getItem('lang');
    } catch (e) {
      return null;
    }
  }

  function storeLang(lang) {
    try {
      localStorage.setItem('lang', lang);
    } catch (e) {
      /* private mode or storage disabled — the page still works, just not sticky */
    }
  }

  function setLang(lang) {
    const nextLang = lang === 'en' ? 'en' : 'zh';
    document.documentElement.classList.remove('lang-zh', 'lang-en');
    document.documentElement.classList.add('lang-' + nextLang);
    document.documentElement.lang = nextLang === 'zh' ? 'zh-Hant' : 'en';

    const titles = window.CARD_TITLES;
    if (titles && titles[nextLang]) document.title = titles[nextLang];

    options.forEach((option) => {
      const isActive = option.dataset.value === nextLang;
      option.classList.toggle('active', isActive);
      option.setAttribute('aria-pressed', String(isActive));
    });

    storeLang(nextLang);
  }

  setLang(readStoredLang());
  options.forEach((option) => {
    option.addEventListener('click', () => setLang(option.dataset.value));
  });

  const copyButton = document.getElementById('copyLink');
  if (copyButton) {
    const label = copyButton.querySelector('.copy-label');
    const original = label.innerHTML;
    let resetTimer = null;

    function fallbackCopy(text) {
      const field = document.createElement('textarea');
      field.value = text;
      field.setAttribute('readonly', '');
      field.style.position = 'fixed';
      field.style.opacity = '0';
      document.body.appendChild(field);
      field.select();
      let ok = false;
      try {
        ok = document.execCommand('copy');
      } catch (e) {
        ok = false;
      }
      document.body.removeChild(field);
      return ok;
    }

    function flash(zh, en) {
      label.innerHTML =
        '<span data-lang="zh">' + zh + '</span><span data-lang="en">' + en + '</span>';
      clearTimeout(resetTimer);
      resetTimer = setTimeout(() => {
        label.innerHTML = original;
      }, 1800);
    }

    function flashResult(ok) {
      if (ok) {
        flash('已複製', 'Copied');
      } else {
        flash('複製失敗', 'Copy failed');
      }
    }

    copyButton.addEventListener('click', () => {
      const text = copyButton.dataset.copy;
      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(text).then(
          () => flashResult(true),
          () => flashResult(fallbackCopy(text))
        );
      } else {
        flashResult(fallbackCopy(text));
      }
    });
  }
})();
