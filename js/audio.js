(function () {
  function ensureToggle() {
    if (document.getElementById('audioToggleBtn')) return;
 const btn = document.createElement('button');
    btn.id = 'audioToggleBtn';
    btn.className = 'audio-toggle';
    btn.style.position = 'fixed';
    btn.style.right = '16px';
    btn.style.bottom = '16px';
    btn.style.zIndex = '9999';
    btn.style.border = 'none';
    btn.style.borderRadius = '999px';
    btn.style.padding = '10px 14px';
    btn.style.background = 'rgba(36, 22, 66, 0.88)';
    btn.style.color = '#fff';
    btn.style.fontWeight = '700';
    btn.style.boxShadow = '0 10px 24px rgba(0,0,0,0.18)';
    function render() {
      const muted = AudioManager?.isMuted?.() ?? false;
      btn.innerHTML = muted
        ? '<i class="fa-solid fa-volume-xmark"></i> 音效關'
        : '<i class="fa-solid fa-volume-high"></i> 音效開';
    }
btn.addEventListener('click', () => {
      AudioManager?.toggleMute?.();
      if (!(AudioManager?.isMuted?.())) {
        AudioManager?.pop?.();
      }
      render();
    });
 document.body.appendChild(btn);
    render();
  }
document.addEventListener('DOMContentLoaded', () => {
    ensureToggle();
 document.body.addEventListener('click', (event) => {
      if (event.target.closest('button, .btn, a, [role="button"], .tool-btn, .top-action, .option-btn')) {
        window.quizAudio?.click?.();
      }
document.addEventListener('input', (event) => {
      const target = event.target;
      if (target && target.matches('input, textarea')) {
        window.quizAudio?.keypress?.();
      }
   }, true);
  });
    document.addEventListener(
      "keydown",
      (e) => {
        const target = e.target;
        const isTypingField =
          target &&
          (target.matches("input, textarea") || target.isContentEditable);

        if (!isTypingField) return;

        const isDigitKey = /^[0-9]$/.test(e.key) || /^Numpad[0-9]$/.test(e.code);
        if (isDigitKey) {
          playDigitRandom();
        }
      },
      true
    );
  });
})();
