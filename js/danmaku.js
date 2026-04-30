// ── 彈幕系統 ──
// 被淘汰玩家可以發送彈幕，房主/玩家可選擇是否顯示
(function() {
  const DANMAKU_KEY_PREFIX = 'quizarena_danmaku_';
  let danmakuEnabled = true;
  let roomId = null;
  let isSpectator = false;

  function getRoomId() {
    const params = new URLSearchParams(location.search);
    return params.get('room') || params.get('pin') || 'default';
  }

  function danmakuKey() { return DANMAKU_KEY_PREFIX + getRoomId(); }

  function loadDanmakuList() {
    try { return JSON.parse(localStorage.getItem(danmakuKey()) || "[]"); } catch { return []; }
  }

  function saveDanmaku(text, sender) {
    const list = loadDanmakuList();
    list.push({ text, sender, ts: Date.now() });
    // Keep last 50
    if (list.length > 50) list.splice(0, list.length - 50);
    localStorage.setItem(danmakuKey(), JSON.stringify(list));
  }

  function fireDanmaku(text, sender) {
    if (!danmakuEnabled) return;
    const overlay = document.getElementById('danmakuOverlay');
    if (!overlay) return;
    const el = document.createElement('div');
    el.className = 'danmaku-item';
    const colors = ['#ff6b9d','#a855f7','#3b82f6','#10b981','#f59e0b'];
    el.style.color = colors[Math.floor(Math.random() * colors.length)];
    el.style.top = Math.random() * 75 + '%';
    el.textContent = sender ? `${sender}：${text}` : text;
    overlay.appendChild(el);
    el.addEventListener('animationend', () => el.remove());
  }

  // Poll for new danmakus every 1.5s
  let lastPollTs = Date.now();
  function pollDanmakus() {
    if (!danmakuEnabled) return;
    const list = loadDanmakuList();
    list.filter(d => d.ts > lastPollTs).forEach(d => fireDanmaku(d.text, d.sender));
    if (list.length) lastPollTs = Math.max(...list.map(d => d.ts));
  }
  setInterval(pollDanmakus, 1500);

  // Detect spectator / show danmaku inputs
  function checkSpectatorMode() {
    const spectatorView = document.getElementById('spectatorView');
    if (!spectatorView) return;
    const isVisible = spectatorView.style.display !== 'none';
    if (isVisible !== isSpectator) {
      isSpectator = isVisible;
      if (isSpectator) {
        document.getElementById('danmakuInputWrap')?.style && (document.getElementById('danmakuInputWrap').style.display = 'flex');
      }
    }
    // Always show toggle for active players and host
    document.getElementById('danmakuToggleWrap').style.display = '';
  }

  // Observe spectatorView visibility
  const spectatorView = document.getElementById('spectatorView');
  if (spectatorView) {
    new MutationObserver(checkSpectatorMode).observe(spectatorView, { attributes: true, attributeFilter: ['style'] });
  }
  checkSpectatorMode();

  // Send danmaku
  document.getElementById('sendDanmakuBtn')?.addEventListener('click', () => {
    const input = document.getElementById('danmakuInput');
    const text = input?.value.trim();
    if (!text) return;
    const sender = localStorage.getItem('currentUser') || '觀眾';
    saveDanmaku(text, sender);
    fireDanmaku(text, sender);
    if (input) input.value = '';
  });
  document.getElementById('danmakuInput')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('sendDanmakuBtn')?.click();
  });

  // Toggle danmaku
  document.getElementById('danmakuToggleBtn')?.addEventListener('click', () => {
    danmakuEnabled = !danmakuEnabled;
    document.getElementById('danmakuToggleLabel').textContent = danmakuEnabled ? '開' : '關';
    document.getElementById('danmakuToggleBtn').style.opacity = danmakuEnabled ? '1' : '0.5';
    if (!danmakuEnabled) {
      document.querySelectorAll('.danmaku-item').forEach(el => el.remove());
    }
  });
})();
