/**
 * music_drawer.js
 * Universal music-drawer widget.
 * Call MusicDrawer.init() after DOM is ready (or after Audio_manager.js loads).
 * Works on every page. Injects its own HTML + CSS into the page.
 */
const MusicDrawer = (() => {

  /* ── CSS injected once ── */
  const CSS = `
  /* ══ Hamburger trigger ══ */
  .music-fab {
    position: fixed;
    top: 14px; right: 14px;
    z-index: 9000;
    width: 44px; height: 44px;
    border-radius: 12px;
    border: none;
    background: rgba(var(--md-fab-bg, 103,58,183), 0.92);
    color: #fff;
    font-size: 18px;
    cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    box-shadow: 0 4px 16px rgba(0,0,0,.35);
    transition: transform .15s, background .2s;
    backdrop-filter: blur(6px);
  }
  .music-fab:hover { transform: scale(1.08); }
  /* hide fab when a page already has its own topbar mute btn */
  .has-topbar-mute .music-fab { display: none !important; }
  /* Always hide the standalone music fab — access via the pink nav drawer instead */
  .music-fab { display: none !important; }

  /* ══ Overlay ══ */
  .music-drawer-overlay {
    display: none;
    position: fixed; inset: 0;
    background: rgba(0,0,0,.45);
    z-index: 9010;
    backdrop-filter: blur(2px);
  }
  .music-drawer-overlay.open { display: block; }

  /* ══ Drawer panel ══ */
  .music-drawer {
    position: fixed;
    top: 0; right: -320px;
    width: 300px; height: 100%;
    z-index: 9020;
    background: var(--md-panel-bg, #1a1040);
    border-left: 1px solid rgba(255,255,255,.08);
    display: flex; flex-direction: column;
    transition: right .28s cubic-bezier(.4,0,.2,1);
    box-shadow: -6px 0 32px rgba(0,0,0,.45);
  }
  .music-drawer.open { right: 0; }

  /* Dark mode aware */
  body:not(.dark-mode) .music-drawer {
    background: #f5f3ff;
    border-left-color: rgba(0,0,0,.08);
    box-shadow: -6px 0 32px rgba(0,0,0,.18);
  }

  /* ── Drawer header ── */
  .md-header {
    display: flex; align-items: center; gap: 10px;
    padding: 18px 16px 14px;
    border-bottom: 1px solid rgba(255,255,255,.07);
  }
  body:not(.dark-mode) .md-header { border-bottom-color: rgba(0,0,0,.07); }
  .md-header h3 { margin:0; font-size:15px; font-weight:700; flex:1;
    color: var(--md-text, #e8d8ff); }
  body:not(.dark-mode) .md-header h3 { color: #4a2d8a; }

  .md-close {
    background: none; border: none; cursor: pointer;
    color: rgba(255,255,255,.55); font-size: 20px; line-height:1;
    padding: 2px 4px; border-radius: 6px;
    transition: color .15s;
  }
  .md-close:hover { color: #fff; }
  body:not(.dark-mode) .md-close { color: #888; }
  body:not(.dark-mode) .md-close:hover { color: #333; }

  /* ── Now playing bar ── */
  .md-now-playing {
    margin: 14px 14px 6px;
    padding: 10px 14px;
    border-radius: 12px;
    background: rgba(255,255,255,.06);
    display: flex; align-items: center; gap: 10px;
  }
  body:not(.dark-mode) .md-now-playing { background: rgba(0,0,0,.05); }
  .md-now-playing .md-disc {
    font-size: 22px; animation: md-spin 4s linear infinite;
    display: inline-block;
  }
  .md-now-playing.paused .md-disc { animation-play-state: paused; }
  @keyframes md-spin { to { transform: rotate(360deg); } }
  .md-now-label { font-size: 11px; opacity:.6; color:#d0baff; }
  body:not(.dark-mode) .md-now-label { color:#7c5cbf; }
  .md-now-title { font-size: 14px; font-weight:700; color:#fff; }
  body:not(.dark-mode) .md-now-title { color:#3a1f78; }

  /* ── Mute toggle ── */
  .md-mute-btn {
    width: calc(100% - 28px); margin: 6px 14px 12px;
    padding: 10px; border-radius: 10px; border: none; cursor: pointer;
    font-size: 13px; font-weight:600;
    background: rgba(255,255,255,.08); color: #d8c6ff;
    display: flex; align-items: center; justify-content: center; gap: 8px;
    transition: background .15s;
  }
  .md-mute-btn:hover { background: rgba(255,255,255,.14); }
  .md-mute-btn.muted { background: rgba(239,83,80,.18); color: #ff8a85; }
  body:not(.dark-mode) .md-mute-btn { background: rgba(0,0,0,.06); color: #5e3ba8; }
  body:not(.dark-mode) .md-mute-btn:hover { background: rgba(0,0,0,.11); }
  body:not(.dark-mode) .md-mute-btn.muted { background: rgba(239,83,80,.12); color: #c62828; }

  /* ── Theme list ── */
  .md-section-label {
    padding: 4px 16px 8px;
    font-size: 10px; letter-spacing:.08em; text-transform:uppercase;
    color: rgba(255,255,255,.35);
    font-weight: 700;
  }
  body:not(.dark-mode) .md-section-label { color: rgba(0,0,0,.35); }

  .md-theme-list {
    flex: 1; overflow-y: auto; padding: 0 10px 16px;
    display: flex; flex-direction: column; gap: 5px;
  }
  .md-theme-list::-webkit-scrollbar { width: 4px; }
  .md-theme-list::-webkit-scrollbar-thumb { background: rgba(255,255,255,.15); border-radius:2px; }

  .md-theme-btn {
    padding: 11px 14px; border-radius: 10px; border: none; cursor: pointer;
    font-size: 13px; font-weight:600; text-align:left;
    background: rgba(255,255,255,.05); color: #cbb8f5;
    display: flex; align-items: center; gap: 10px;
    transition: background .15s, transform .1s;
    position: relative;
  }
  .md-theme-btn:hover { background: rgba(255,255,255,.10); transform: translateX(2px); }
  .md-theme-btn.active {
    background: linear-gradient(90deg, rgba(124,77,255,.35), rgba(103,58,183,.25));
    color: #fff;
    border: 1px solid rgba(124,77,255,.4);
  }
  body:not(.dark-mode) .md-theme-btn { background: rgba(0,0,0,.04); color: #5a3a9c; }
  body:not(.dark-mode) .md-theme-btn:hover { background: rgba(0,0,0,.09); }
  body:not(.dark-mode) .md-theme-btn.active { background: rgba(103,58,183,.12); color: #3d1f8c; border-color: rgba(103,58,183,.3); }

  .md-theme-btn .md-playing-dot {
    width:7px; height:7px; border-radius:50%; margin-left:auto;
    background: #7c4dff;
    animation: md-pulse 1s ease-in-out infinite;
    display: none;
  }
  .md-theme-btn.active .md-playing-dot { display: block; }
  @keyframes md-pulse { 0%,100%{opacity:.4;transform:scale(.85)} 50%{opacity:1;transform:scale(1.1)} }

  /* ── Footer ── */
  .md-footer {
    padding: 12px 16px;
    border-top: 1px solid rgba(255,255,255,.06);
    font-size: 10px; color: rgba(255,255,255,.25); text-align:center;
  }
  body:not(.dark-mode) .md-footer { border-top-color: rgba(0,0,0,.06); color: rgba(0,0,0,.25); }
  `;

  function injectCSS() {
    if (document.getElementById('music-drawer-styles')) return;
    const s = document.createElement('style');
    s.id = 'music-drawer-styles';
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  function buildHTML() {
    const themes = (window.AudioManager && window.AudioManager.getThemes) ? window.AudioManager.getThemes() : [];
    const currentTheme = window.AudioManager ? window.AudioManager.getTheme() : 'spark';
    const isMuted = window.AudioManager ? window.AudioManager.isMuted() : false;
    const currentLabel = themes.find(t => t.id === currentTheme)?.label || 'Spark';

    const themeButtons = themes.map(t => `
      <button class="md-theme-btn${t.id===currentTheme?' active':''}" data-theme="${t.id}">
        ${t.label}
        <span class="md-playing-dot"></span>
      </button>`).join('');

    const wrap = document.createElement('div');
    wrap.innerHTML = `
      <!-- FAB trigger -->
      <button class="music-fab" id="musicFab" title="音樂選單">
        <i class="fa-solid fa-bars"></i>
      </button>

      <!-- Overlay -->
      <div class="music-drawer-overlay" id="musicDrawerOverlay"></div>

      <!-- Drawer -->
      <aside class="music-drawer" id="musicDrawer" aria-label="音樂選單">
        <div class="md-header">
          <i class="fa-solid fa-music" style="color:#9c6dff;font-size:16px;"></i>
          <h3><i class="fa-solid fa-music" style="margin-right:6px;"></i>背景音樂</h3>
          <button class="md-close" id="musicDrawerClose" aria-label="關閉">✕</button>
        </div>

        <div class="md-now-playing${isMuted?' paused':''}" id="mdNowPlaying">
          <i class="fa-solid fa-compact-disc md-disc" style="font-size:22px;"></i>
          <div>
            <div class="md-now-label">正在播放</div>
            <div class="md-now-title" id="mdNowTitle">${currentLabel}</div>
          </div>
        </div>

        <button class="md-mute-btn${isMuted?' muted':''}" id="mdMuteBtn">
          <i class="fa-solid ${isMuted?'fa-volume-xmark':'fa-volume-high'}" id="mdMuteIcon"></i>
          ${isMuted?'已靜音 (點擊開啟)':'音樂開啟中 (點擊靜音)'}
        </button>

        <div class="md-section-label">選擇曲風</div>
        <div class="md-theme-list" id="mdThemeList">
          ${themeButtons}
        </div>

        <div class="md-footer">QuizArena · Music Player</div>
      </aside>
    `;
    return wrap;
  }

  function open() {
    document.getElementById('musicDrawer')?.classList.add('open');
    document.getElementById('musicDrawerOverlay')?.classList.add('open');
  }
  function close() {
    document.getElementById('musicDrawer')?.classList.remove('open');
    document.getElementById('musicDrawerOverlay')?.classList.remove('open');
  }

  function updateUI() {
    const AM = window.AudioManager;
    if (!AM) return;
    const isMuted = AM.isMuted();
    const cur = AM.getTheme();
    const themes = AM.getThemes();
    const label = themes.find(t=>t.id===cur)?.label || '';

    const muteBtn  = document.getElementById('mdMuteBtn');
    const muteIcon = document.getElementById('mdMuteIcon');
    const nowTitle = document.getElementById('mdNowTitle');
    const nowPlaying = document.getElementById('mdNowPlaying');

    if (muteBtn) {
      muteBtn.innerHTML = `<i class="fa-solid ${isMuted?'fa-volume-xmark':'fa-volume-high'}" id="mdMuteIcon"></i> ${isMuted?'已靜音 (點擊開啟)':'音樂開啟中 (點擊靜音)'}`;
      muteBtn.classList.toggle('muted', isMuted);
    }
    if (nowTitle) nowTitle.textContent = label;
    if (nowPlaying) nowPlaying.classList.toggle('paused', isMuted);

    document.querySelectorAll('.md-theme-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.theme === cur);
    });
  }

  function init() {
    if (document.getElementById('musicFab')) return; // already init

    injectCSS();
    const fragment = buildHTML();
    document.body.appendChild(fragment);

    // Bind FAB
    document.getElementById('musicFab')?.addEventListener('click', () => { open(); AudioManager?.resume?.(); AudioManager?.startBgMusic?.(); });
    document.getElementById('musicDrawerClose')?.addEventListener('click', close);
    document.getElementById('musicDrawerOverlay')?.addEventListener('click', close);

    // Mute toggle
    document.getElementById('mdMuteBtn')?.addEventListener('click', () => {
      window.AudioManager?.toggleMute?.();
      updateUI();
    });

    // Theme buttons
    document.getElementById('mdThemeList')?.addEventListener('click', e => {
      const btn = e.target.closest('.md-theme-btn');
      if (!btn) return;
      const t = btn.dataset.theme;
      window.AudioManager?.setTheme?.(t);
      updateUI();
      // small haptic delay then close
      setTimeout(close, 300);
    });
  }

  return { init, open, close, updateUI };
})();

// Auto-init once DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => MusicDrawer.init());
} else {
  MusicDrawer.init();
}

window.MusicDrawer = MusicDrawer;
