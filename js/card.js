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
    const nextLang = lang === 'en' || lang === 'ja' ? lang : 'zh';
    document.documentElement.classList.remove('lang-zh', 'lang-en', 'lang-ja');
    document.documentElement.classList.add('lang-' + nextLang);
    document.documentElement.lang = { zh: 'zh-Hant', en: 'en', ja: 'ja' }[nextLang];

    const titles = window.CARD_TITLES;
    if (titles && titles[nextLang]) document.title = titles[nextLang];

    // "Back to homepage" has to mean the reader's own homepage — a ja reader
    // sent to / lands on the Chinese one and the language silently resets.
    // There is no Japanese homepage, so the ja card sends readers to the
    // English one rather than dropping them on the Chinese homepage.
    const back = document.getElementById('backLink');
    if (back) back.href = { zh: '/', en: '/en/', ja: '/en/' }[nextLang];

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

    function flash(zh, en, ja) {
      label.innerHTML =
        '<span data-lang="zh">' + zh + '</span>' +
        '<span data-lang="en">' + en + '</span>' +
        '<span data-lang="ja">' + ja + '</span>';
      clearTimeout(resetTimer);
      resetTimer = setTimeout(() => {
        label.innerHTML = original;
      }, 1800);
    }

    function flashResult(ok) {
      if (ok) {
        flash('已複製', 'Copied', 'コピーしました');
      } else {
        flash('複製失敗', 'Copy failed', 'コピーできませんでした');
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

/*
  Present mode — the one thing a QR on a phone screen is for: holding the
  screen up so someone else can scan it. Tapping the small QR on the card
  blows it up full screen. The overlay stays white in both colour schemes
  (dark modules on a light field scan far more reliably) and takes a screen
  wake lock so the display does not dim mid-scan. There is no web API for
  raising screen brightness, so a white full-bleed plate is as close as it gets.

  Two entry points, deliberately different:
    - tapping the card's QR       → plain present mode, nothing else on screen
    - /card/#qr or /card/#qr=name → present mode plus the campaign field

  Only the second shows the campaign controls, so a visitor who taps the QR
  never sees them. #qr=name is bookmarkable — one home-screen shortcut per
  event gets you straight to that campaign's code.
*/
(function () {
  const openButton = document.getElementById('showQr');
  const overlay = document.getElementById('qrOverlay');
  const closeButton = document.getElementById('closeQr');
  const overlayPlate = document.getElementById('qrOverlayPlate');
  const urlLabel = document.getElementById('qrOverlayUrl');
  const campaignForm = document.getElementById('qrCampaign');
  const campaignInput = document.getElementById('qrCampaignInput');
  if (!openButton || !overlay || !closeButton || !overlayPlate || !urlLabel) return;

  // Derived, not hardcoded: the same script serves every card face, and each
  // one has to tag its own URL rather than the work card's.
  const canonical = document.querySelector('link[rel="canonical"]');
  const CARD_URL = (canonical && canonical.href) || 'https://wei-lee.me/card/';
  // Any QR on a screen is the same medium; the occasion lives in the
  // campaign, so present mode shares its source with the static code.
  const QR_SOURCE = 'qr';
  const DEFAULT_LABEL = CARD_URL.replace(/^https:\/\//, '').replace(/\/$/, '');
  const DEFAULT_CAMPAIGN = 'card';
  const SVG_NS = 'http://www.w3.org/2000/svg';

  let lastFocused = null;
  let wakeLock = null;
  let encoderPromise = null;
  let defaultQr = null;
  let inputTimer = null;

  function campaignUrl(name) {
    return CARD_URL + '?utm_campaign=' + encodeURIComponent(name || DEFAULT_CAMPAIGN) +
      '&utm_source=' + QR_SOURCE;
  }

  function currentCampaign() {
    return (campaignInput && campaignInput.value.trim()) || DEFAULT_CAMPAIGN;
  }

  function encode(url) {
    return loadEncoder().then((qrcode) => {
      const qr = qrcode(0, 'M');
      qr.addData(url);
      qr.make();
      return qr;
    });
  }

  // The 57KB encoder is only worth downloading once you actually change the
  // campaign; the default code is the static SVG already in the page.
  function loadEncoder() {
    if (!encoderPromise) {
      encoderPromise = import('/js/vendor/qrcode.mjs').then((mod) => mod.default);
    }
    return encoderPromise;
  }

  // Same shape as the static SVG in the card: one white ground rect plus a
  // single path of horizontal runs, so both codes render identically.
  function buildSvg(qr, url) {
    const modules = qr.getModuleCount();
    const quiet = 3;
    const size = modules + quiet * 2;
    let d = '';
    for (let row = 0; row < modules; row++) {
      let col = 0;
      while (col < modules) {
        if (!qr.isDark(row, col)) { col++; continue; }
        let run = 0;
        while (col + run < modules && qr.isDark(row, col + run)) run++;
        d += 'M' + (col + quiet) + ' ' + (row + quiet) + 'h' + run + 'v1h-' + run + 'z';
        col += run;
      }
    }

    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('class', 'qr-svg');
    svg.setAttribute('viewBox', '0 0 ' + size + ' ' + size);
    svg.setAttribute('shape-rendering', 'crispEdges');
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', 'QR code linking to ' + url);

    const ground = document.createElementNS(SVG_NS, 'rect');
    ground.setAttribute('width', String(size));
    ground.setAttribute('height', String(size));
    ground.setAttribute('fill', '#ffffff');

    const path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('fill', '#1a1a1a');
    path.setAttribute('d', d);

    svg.appendChild(ground);
    svg.appendChild(path);
    return svg;
  }

  function showDefault() {
    if (!defaultQr) {
      const source = openButton.querySelector('svg');
      if (source) defaultQr = source.cloneNode(true);
    }
    if (defaultQr) overlayPlate.replaceChildren(defaultQr.cloneNode(true));
    urlLabel.textContent = DEFAULT_LABEL;
  }

  function showCampaign(name) {
    const url = campaignUrl(name);
    return encode(url).then((qr) => {
      overlayPlate.replaceChildren(buildSvg(qr, url));
      // Only the campaign varies, and the full URL is long enough to wrap
      // into three ragged lines on a phone. The SVG's aria-label still
      // carries the whole thing for anyone who needs it.
      urlLabel.textContent = 'campaign: ' + name;
    });
  }

  function render(name) {
    const trimmed = (name || '').trim();
    if (!trimmed) { showDefault(); return; }
    // A failed encode (library blocked, or a campaign name long enough to
    // overflow version 40) falls back to the code that is already in the page.
    showCampaign(trimmed).catch(showDefault);
  }

  async function acquireWakeLock() {
    if (!('wakeLock' in navigator)) return;
    try {
      wakeLock = await navigator.wakeLock.request('screen');
    } catch (e) {
      /* denied, unsupported, or the tab lost visibility — presenting still works */
      wakeLock = null;
    }
  }

  function releaseWakeLock() {
    if (!wakeLock) return;
    wakeLock.release().catch(() => {});
    wakeLock = null;
  }

  function isOpen() {
    return !overlay.hasAttribute('hidden');
  }

  function open(options) {
    const withControls = !!(options && options.controls);
    const campaign = (options && options.campaign) || '';

    if (campaignForm) campaignForm.hidden = !withControls;
    if (campaignInput) campaignInput.value = campaign;
    render(campaign);

    if (!isOpen()) {
      lastFocused = document.activeElement;
      overlay.removeAttribute('hidden');
      document.body.classList.add('is-presenting');
      acquireWakeLock();
    }
    (withControls && campaignInput ? campaignInput : closeButton).focus();
  }

  function close() {
    if (!isOpen()) return;
    overlay.setAttribute('hidden', '');
    document.body.classList.remove('is-presenting');
    releaseWakeLock();
    if (readHash().present) {
      history.replaceState(null, '', location.pathname + location.search);
    }
    if (lastFocused && typeof lastFocused.focus === 'function') lastFocused.focus();
  }

  function readHash() {
    const raw = location.hash.replace(/^#/, '');
    if (raw === 'qr') return { present: true, campaign: '' };
    if (raw.indexOf('qr=') === 0) {
      let campaign = raw.slice(3);
      try { campaign = decodeURIComponent(campaign); } catch (e) { /* keep raw */ }
      return { present: true, campaign: campaign };
    }
    return { present: false, campaign: '' };
  }

  function syncFromHash() {
    const state = readHash();
    if (state.present) {
      open({ controls: true, campaign: state.campaign });
    } else if (isOpen()) {
      close();
    }
  }

  openButton.addEventListener('click', () => open({ controls: false }));
  closeButton.addEventListener('click', close);

  // Easter egg: double-tap the enlarged code to reveal the campaign field.
  // It lives here rather than on the card's small QR because the first tap
  // there already covers the button with this overlay, so a dblclick on it
  // can never fire without delaying every open by a couple hundred ms.
  // ---- saving a campaign code to hand off into slides, posters, badges ----

  function modulePath(qr, quiet) {
    const modules = qr.getModuleCount();
    let d = '';
    for (let row = 0; row < modules; row++) {
      let col = 0;
      while (col < modules) {
        if (!qr.isDark(row, col)) { col++; continue; }
        let run = 0;
        while (col + run < modules && qr.isDark(row, col + run)) run++;
        d += 'M' + (col + quiet) + ' ' + (row + quiet) + 'h' + run + 'v1h-' + run + 'z';
        col += run;
      }
    }
    return d;
  }

  function svgSource(qr, url) {
    const size = qr.getModuleCount() + 6;
    return '<?xml version="1.0" encoding="UTF-8"?>\n' +
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + size + ' ' + size + '" ' +
      'width="' + size * 10 + '" height="' + size * 10 + '" role="img" ' +
      'aria-label="QR code linking to ' + url.replace(/&/g, '&amp;') + '" ' +
      'shape-rendering="crispEdges">' +
      '<rect width="' + size + '" height="' + size + '" fill="#ffffff"/>' +
      '<path fill="#1a1a1a" d="' + modulePath(qr, 3) + '"/></svg>\n';
  }

  function pngBlob(qr) {
    const modules = qr.getModuleCount();
    const span = modules + 6;
    const scale = Math.max(8, Math.round(1024 / span));
    const side = span * scale;
    const canvas = document.createElement('canvas');
    canvas.width = side;
    canvas.height = side;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, side, side);
    ctx.fillStyle = '#1a1a1a';
    for (let row = 0; row < modules; row++) {
      for (let col = 0; col < modules; col++) {
        if (qr.isDark(row, col)) {
          ctx.fillRect((col + 3) * scale, (row + 3) * scale, scale, scale);
        }
      }
    }
    return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
  }

  function handOff(file) {
    // iOS Safari treats a `download` link as "file it away in Files", which
    // reads as nothing happening — same trap as the vCard link on the card.
    // The share sheet lets it reach Photos or AirDrop instead.
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      return navigator.share({ files: [file] }).catch((error) => {
        if (error && error.name === 'AbortError') return;
        saveViaLink(file);
      });
    }
    saveViaLink(file);
    return Promise.resolve();
  }

  function saveViaLink(file) {
    const href = URL.createObjectURL(file);
    const link = document.createElement('a');
    link.href = href;
    link.download = file.name;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(href), 10000);
  }

  function save(format, button) {
    const campaign = currentCampaign();
    const url = campaignUrl(campaign);
    // Strip only what a filesystem actually rejects — an all-CJK campaign
    // name should survive into the filename, not be scrubbed to nothing.
    const slug = campaign
      .replace(/[\\/:*?"<>|\u0000-\u001f]+/g, '-')
      .replace(/\s+/g, '-')
      .replace(/-{2,}/g, '-')
      .replace(/^-+|-+$/g, '');
    const stem = 'wei-lee-card-' + (slug || DEFAULT_CAMPAIGN);
    button.disabled = true;
    encode(url)
      .then((qr) => (format === 'svg'
        ? new File([svgSource(qr, url)], stem + '.svg', { type: 'image/svg+xml' })
        : pngBlob(qr).then((blob) => new File([blob], stem + '.png', { type: 'image/png' }))))
      .then(handOff)
      .catch(() => { /* encoder blocked or canvas unavailable — nothing saved */ })
      .then(() => { button.disabled = false; });
  }

  if (campaignForm) {
    campaignForm.querySelectorAll('.qr-save').forEach((button) => {
      button.addEventListener('click', () => save(button.dataset.format, button));
    });
  }

  overlayPlate.addEventListener('dblclick', () => {
    if (!campaignForm) return;
    campaignForm.hidden = !campaignForm.hidden;
    if (!campaignForm.hidden && campaignInput) campaignInput.focus();
  });

  // Tapping the empty field around the QR dismisses it; taps on the code
  // itself do not, so nobody closes the card while lining up a scan.
  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) close();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && isOpen()) close();
  });

  // Switching tabs drops the wake lock; take it again on the way back.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && isOpen()) acquireWakeLock();
  });

  if (campaignForm) {
    campaignForm.addEventListener('submit', (event) => event.preventDefault());
  }

  if (campaignInput) {
    campaignInput.addEventListener('input', () => {
      clearTimeout(inputTimer);
      inputTimer = setTimeout(() => {
        const name = campaignInput.value.trim();
        render(name);
        // Keep the address bar in step so the current code stays bookmarkable.
        history.replaceState(null, '', name ? '#qr=' + encodeURIComponent(name) : '#qr');
      }, 200);
    });
  }

  window.addEventListener('hashchange', syncFromHash);
  syncFromHash();
})();
