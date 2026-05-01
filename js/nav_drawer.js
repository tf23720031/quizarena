/**
 * nav_drawer.js  — Universal pink hamburger drawer
 * Injects a pink ☰ FAB + full-screen side drawer into every page.
 * Contains: page navigation, language switcher, dark mode, music shortcut.
 * The music panel itself is still handled by music_drawer.js / MusicDrawer.
 */
(function () {
  'use strict';

  /* ── detect current page ── */
  const PAGE = location.pathname.split('/').pop() || 'index.html';

  const NAV_LINKS = [
    { href: 'index.html',         icon: 'fa-house',              label: '首頁大廳' },
    { href: 'create_home.html',   icon: 'fa-wand-magic-sparkles',label: '建立題庫' },
    { href: 'story_mode.html',    icon: 'fa-map-location-dot',   label: '故事模式' },
    { href: 'wrong_book.html',    icon: 'fa-book-open-reader',   label: '錯題本' },
    { href: 'daily_mission.html', icon: 'fa-calendar-check',     label: '每日任務' },
    { href: 'marketplace.html',   icon: 'fa-store',              label: '題庫市集' },
    { href: 'teacher_report.html',icon: 'fa-chalkboard-user',    label: '老師模式' },
    { href: 'profile.html',       icon: 'fa-id-card',            label: '個人資料' },
  ];

  const LANGS = [
    { value: 'zh', label: '中文' },
    { value: 'en', label: 'English' },
    { value: 'ja', label: '日本語' },
    { value: 'ko', label: '한국어' },
    { value: 'es', label: 'Español' },
  ];

  /* ── CSS ── */
  const CSS = `
  /* Pink FAB hamburger */
  /* FAB cluster — two pink buttons side by side, fixed top-right */
  .unav-fab-cluster {
    position: fixed;
    top: 14px;
    right: 14px;
    z-index: 8500;
    display: flex;
    gap: 8px;
    align-items: center;
  }

  .unav-fab {
    width: 46px; height: 46px;
    border-radius: 14px;
    border: none;
    background: linear-gradient(135deg, #ff7eb3 0%, #ff4f8b 100%);
    color: #fff;
    font-size: 19px;
    cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    box-shadow: 0 6px 20px rgba(255, 79, 139, 0.45);
    transition: transform .15s, box-shadow .2s;
  }
  .unav-fab:hover {
    transform: scale(1.07);
    box-shadow: 0 8px 28px rgba(255, 79, 139, 0.6);
  }

  /* Dark mode toggle button — same shape as hamburger */
  .unav-dark-fab {
    width: 46px; height: 46px;
    border-radius: 14px;
    border: none;
    background: linear-gradient(135deg, #ff7eb3 0%, #ff4f8b 100%);
    color: #fff;
    font-size: 18px;
    cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    box-shadow: 0 6px 20px rgba(255, 79, 139, 0.45);
    transition: transform .15s, box-shadow .2s;
  }
  .unav-dark-fab:hover {
    transform: scale(1.07);
    box-shadow: 0 8px 28px rgba(255, 79, 139, 0.6);
  }

  /* Inline variant — sits in the normal flow (index.html header) */
  .unav-fab-cluster--inline {
    position: static;
    display: flex;
  }
  /* On index.html hide the fixed cluster, show inline only */
  body.unav-index-page .unav-fab-cluster:not(.unav-fab-cluster--inline) {
    display: none !important;
  }

  .unav-hide-fab .unav-fab-cluster { display: none !important; }

  /* Overlay */
  .unav-overlay {
    display: none; position: fixed; inset: 0;
    background: rgba(20,10,40,.52);
    z-index: 8510;
    backdrop-filter: blur(3px);
  }
  .unav-overlay.open { display: block; }

  /* Drawer panel */
  .unav-drawer {
    position: fixed;
    top: 0; right: -320px;
    width: 300px; height: 100%;
    z-index: 8520;
    display: flex; flex-direction: column;
    background: linear-gradient(160deg, #fff0f8 0%, #fdf4ff 100%);
    border-left: 1px solid rgba(255,126,179,.18);
    box-shadow: -8px 0 40px rgba(200,50,120,.18);
    transition: right .27s cubic-bezier(.4,0,.2,1);
    overflow: hidden;
  }
  .unav-drawer.open { right: 0; }
  body.dark-mode .unav-drawer {
    background: linear-gradient(160deg, #1a0828 0%, #160820 100%);
    border-left-color: rgba(255,126,179,.10);
    box-shadow: -8px 0 40px rgba(0,0,0,.5);
  }

  /* Drawer header */
  .unav-head {
    padding: 20px 18px 14px;
    display: flex; align-items: center; gap: 10px;
    border-bottom: 1px solid rgba(255,126,179,.14);
    flex-shrink: 0;
  }
  body.dark-mode .unav-head { border-bottom-color: rgba(255,126,179,.10); }
  .unav-head img { height: 36px; object-fit: contain; }
  .unav-close {
    background: none; border: none; cursor: pointer;
    font-size: 20px; color: #cca0c0; padding: 4px;
    border-radius: 8px; line-height: 1;
    transition: color .15s;
  }
  .unav-close:hover { color: #ff4f8b; }

  /* Scrollable body */
  .unav-body {
    flex: 1; overflow-y: auto; padding: 12px 12px 8px;
    display: flex; flex-direction: column; gap: 5px;
  }
  .unav-body::-webkit-scrollbar { width: 4px; }
  .unav-body::-webkit-scrollbar-thumb { background: rgba(255,126,179,.25); border-radius: 2px; }

  /* Section label */
  .unav-section {
    padding: 8px 6px 4px;
    font-size: 10px; letter-spacing:.07em; text-transform:uppercase;
    font-weight: 800; color: #e07ab0;
  }
  body.dark-mode .unav-section { color: #c060a0; }

  /* Nav link / button row */
  .unav-link, .unav-btn {
    display: flex; align-items: center; gap: 12px;
    padding: 11px 14px;
    border-radius: 12px; border: none; cursor: pointer;
    font-size: 14px; font-weight: 600; text-decoration: none;
    color: #4a2060;
    background: rgba(255,126,179,.07);
    transition: background .15s, transform .1s;
    width: 100%; text-align: left;
  }
  .unav-link:hover, .unav-btn:hover {
    background: rgba(255,126,179,.16);
    transform: translateX(3px);
    color: #c0306a;
  }
  .unav-link.active {
    background: linear-gradient(90deg, rgba(255,79,139,.18), rgba(192,107,255,.12));
    color: #c0306a;
    border: 1px solid rgba(255,79,139,.22);
  }
  body.dark-mode .unav-link, body.dark-mode .unav-btn { color: #f5cce5; background: rgba(255,126,179,.06); }
  body.dark-mode .unav-link:hover, body.dark-mode .unav-btn:hover { background: rgba(255,126,179,.12); color: #ffaad4; }
  body.dark-mode .unav-link.active { background: rgba(255,79,139,.18); color: #ffaad4; border-color: rgba(255,79,139,.22); }

  .unav-link i, .unav-btn i { width: 18px; text-align: center; font-size: 15px; color: #ff6ba0; flex-shrink:0; }
  body.dark-mode .unav-link i, body.dark-mode .unav-btn i { color: #ff8fc0; }

  /* Divider */
  .unav-divider {
    height: 1px; background: rgba(255,126,179,.12);
    margin: 6px 4px;
  }
  body.dark-mode .unav-divider { background: rgba(255,126,179,.08); }

  /* Language selector */
  .unav-lang-wrap {
    display: flex; align-items: center; gap: 10px;
    padding: 10px 14px;
    border-radius: 12px;
    background: rgba(255,126,179,.07);
  }
  body.dark-mode .unav-lang-wrap { background: rgba(255,126,179,.06); }
  .unav-lang-wrap i { color: #ff6ba0; font-size: 15px; width:18px; text-align:center; }
  .unav-lang-wrap span { font-size:14px; font-weight:600; color:#4a2060; flex:1; }
  body.dark-mode .unav-lang-wrap span { color:#f5cce5; }
  .unav-lang-sel {
    border: 1px solid rgba(255,126,179,.3);
    border-radius: 8px;
    padding: 5px 8px;
    font-size: 13px; font-weight: 600;
    background: #fff; color: #4a2060; cursor: pointer;
    outline: none;
  }
  body.dark-mode .unav-lang-sel { background: #2a0f3a; color: #f5cce5; border-color: rgba(255,126,179,.2); }

  /* Dark mode toggle row */
  .unav-dark-row {
    display: flex; align-items: center; gap: 12px;
    padding: 11px 14px; border-radius: 12px;
    background: rgba(255,126,179,.07);
    cursor: pointer; border: none; width: 100%;
  }
  body.dark-mode .unav-dark-row { background: rgba(255,126,179,.06); }
  .unav-dark-row i { color: #ff6ba0; font-size: 15px; width:18px; text-align:center; }
  .unav-dark-row span { font-size:14px; font-weight:600; color:#4a2060; flex:1; text-align:left; }
  body.dark-mode .unav-dark-row span { color:#f5cce5; }
  .unav-dark-row:hover { background: rgba(255,126,179,.16); }

  /* Music button */
  .unav-music-btn {
    background: linear-gradient(90deg, rgba(255,79,139,.12), rgba(192,107,255,.10));
    border: 1px solid rgba(255,79,139,.2);
    color: #b0306a !important;
  }
  body.dark-mode .unav-music-btn { color: #ffaad4 !important; border-color: rgba(255,79,139,.18); }
  .unav-music-btn:hover { background: linear-gradient(90deg, rgba(255,79,139,.22), rgba(192,107,255,.18)) !important; }

  /* Footer */
  .unav-footer {
    padding: 12px 16px;
    border-top: 1px solid rgba(255,126,179,.1);
    font-size: 10px; color: #c8a0be; text-align: center;
    flex-shrink: 0;
  }
  body.dark-mode .unav-footer { color: #7a4060; }
  `;

  function injectCSS() {
    if (document.getElementById('unav-styles')) return;
    const s = document.createElement('style');
    s.id = 'unav-styles';
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  function getCurrentLang() {
    return localStorage.getItem('quizLang') || 'zh';
  }

  function buildDrawer() {
    const lang = getCurrentLang();
    const isDark = document.body.classList.contains('dark-mode');

    const navItems = NAV_LINKS.map(link => {
      const isActive = PAGE === link.href;
      return `<a class="unav-link${isActive ? ' active' : ''}" href="${link.href}">
        <i class="fa-solid ${link.icon}"></i>${link.label}
      </a>`;
    }).join('');

    const langOptions = LANGS.map(l =>
      `<option value="${l.value}"${lang === l.value ? ' selected' : ''}>${l.label}</option>`
    ).join('');

    const wrap = document.createElement('div');
    wrap.innerHTML = `
      <div class="unav-fab-cluster" id="unavFabClusterFixed">
        <button class="unav-dark-fab" id="unavDarkFab" aria-label="切換深色模式">
          <i class="fa-solid fa-moon" id="unavDarkFabIcon"></i>
        </button>
        <button class="unav-fab" id="unavFab" aria-label="開啟選單">
          <i class="fa-solid fa-bars"></i>
        </button>
      </div>

      <div class="unav-overlay" id="unavOverlay"></div>

      <aside class="unav-drawer" id="unavDrawer" aria-label="導覽選單">
        <div class="unav-head">
          <img src="images/LOGO.png" alt="QuizArena" onerror="this.style.display='none'">
          <button class="unav-close" id="unavClose" aria-label="關閉">✕</button>
        </div>

        <div class="unav-body">
          <div class="unav-section"><i class="fa-solid fa-grid-2" style="margin-right:5px;font-size:10px;"></i>頁面</div>
          ${navItems}

          <div class="unav-divider"></div>

          <div class="unav-section"><i class="fa-solid fa-gear" style="margin-right:5px;font-size:10px;"></i>設定</div>

          <!-- Language -->
          <div class="unav-lang-wrap">
            <i class="fa-solid fa-globe"></i>
            <span>語言</span>
            <select class="unav-lang-sel" id="unavLangSel">${langOptions}</select>
          </div>

          <!-- Dark mode -->
          <button class="unav-dark-row" id="unavDarkBtn" type="button">
            <i class="fa-solid ${isDark ? 'fa-sun' : 'fa-moon'}" id="unavDarkIcon"></i>
            <span id="unavDarkLabel">${isDark ? '切換淺色模式' : '切換深色模式'}</span>
          </button>

          <div class="unav-divider"></div>

          <div class="unav-section"><i class="fa-solid fa-music" style="margin-right:5px;font-size:10px;"></i>音樂</div>

          <!-- Music shortcut -->
          <button class="unav-btn unav-music-btn" id="unavMusicBtn" type="button">
            <i class="fa-solid fa-music"></i>背景音樂設定
          </button>
        </div>

        <div class="unav-footer">© 2026 QuizArena</div>
      </aside>
    `;
    document.body.appendChild(wrap);
  }

  function openDrawer() {
    document.getElementById('unavDrawer')?.classList.add('open');
    document.getElementById('unavOverlay')?.classList.add('open');
  }
  function closeDrawer() {
    document.getElementById('unavDrawer')?.classList.remove('open');
    document.getElementById('unavOverlay')?.classList.remove('open');
  }

  function _syncDarkIcons(isDark) {
    const cls = `fa-solid ${isDark ? 'fa-sun' : 'fa-moon'}`;
    // Fixed FAB icon
    const fabIcon = document.getElementById('unavDarkFabIcon');
    if (fabIcon) fabIcon.className = cls;
    // Inline index FAB icon
    const fabIconIndex = document.getElementById('unavDarkFabIndexIcon');
    if (fabIconIndex) fabIconIndex.className = cls;
    // Drawer row icon + label
    const drawerIcon  = document.getElementById('unavDarkIcon');
    const drawerLabel = document.getElementById('unavDarkLabel');
    if (drawerIcon)  drawerIcon.className  = cls;
    if (drawerLabel) drawerLabel.textContent = isDark ? '切換淺色模式' : '切換深色模式';
    // Legacy page icon (if any page still has one)
    const pageIcon = document.getElementById('darkModeIcon');
    if (pageIcon) pageIcon.className = isDark ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
  }

  function bindEvents() {
    document.getElementById('unavFab')?.addEventListener('click', openDrawer);
    document.getElementById('unavClose')?.addEventListener('click', closeDrawer);
    document.getElementById('unavOverlay')?.addEventListener('click', closeDrawer);

    // Dark mode FAB (top-right cluster)
    document.getElementById('unavDarkFab')?.addEventListener('click', function () {
      const isDark = document.body.classList.toggle('dark-mode');
      localStorage.setItem('quizDarkMode', isDark ? '1' : '0');
      _syncDarkIcons(isDark);
    });

    // Dark mode toggle inside drawer
    document.getElementById('unavDarkBtn')?.addEventListener('click', function () {
      const isDark = document.body.classList.toggle('dark-mode');
      localStorage.setItem('quizDarkMode', isDark ? '1' : '0');
      _syncDarkIcons(isDark);
    });

    // Language
    document.getElementById('unavLangSel')?.addEventListener('change', function () {
      const lang = this.value;
      localStorage.setItem('quizLang', lang);
      // sync with i18n system if available
      if (window.i18n?.applyLang) window.i18n.applyLang(lang);
      else document.querySelectorAll('.lang-switcher').forEach(s => {
        s.value = lang;
        s.dispatchEvent(new Event('change'));
      });
    });

    // Music shortcut → open MusicDrawer
    document.getElementById('unavMusicBtn')?.addEventListener('click', function () {
      closeDrawer();
      setTimeout(() => {
        if (window.MusicDrawer) window.MusicDrawer.open();
      }, 200);
    });

    // Close drawer when clicking a nav link (same page links)
    document.querySelectorAll('.unav-link').forEach(a => {
      a.addEventListener('click', () => {
        if (a.classList.contains('active')) closeDrawer();
      });
    });
  }

  function hideIndexFab() {
    if (PAGE === 'index.html') {
      // Hide the fixed cluster; inline one in the header takes over
      const fixed = document.getElementById('unavFabClusterFixed');
      if (fixed) fixed.style.display = 'none';

      // Wire inline buttons
      document.getElementById('unavFabIndex')?.addEventListener('click', openDrawer);
      document.getElementById('unavDarkFabIndex')?.addEventListener('click', function () {
        const isDark = document.body.classList.toggle('dark-mode');
        localStorage.setItem('quizDarkMode', isDark ? '1' : '0');
        _syncDarkIcons(isDark);
      });
    }
  }

  function init() {
    if (document.getElementById('unavFab')) return;
    injectCSS();
    buildDrawer();
    bindEvents();
    hideIndexFab();
    // Sync icon to current dark state
    _syncDarkIcons(document.body.classList.contains('dark-mode'));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.NavDrawer = { open: openDrawer, close: closeDrawer };
})();
