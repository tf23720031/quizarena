(function () {
  function ensureToggle() {
    if (document.getElementById('audioToggleBtn')) return;

    const btn = document.createElement('button');
    btn.id = 'audioToggleBtn';
    btn.className = 'audio-toggle';
    btn.type = 'button';
    btn.setAttribute('aria-label', '切換音效');
    btn.title = '切換音效';

    function render() {
      const muted = AudioManager?.isMuted?.() ?? false;
      btn.innerHTML = muted
        ? '<i class="fa-solid fa-volume-xmark"></i>'
        : '<i class="fa-solid fa-volume-high"></i>';
    }

    btn.addEventListener('click', () => {
      AudioManager?.toggleMute?.();
      if (!(AudioManager?.isMuted?.())) {
        AudioManager?.pop?.();
        AudioManager?.startBgMusic?.();
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
    }, true);

    document.addEventListener('input', (event) => {
      const target = event.target;
      if (target && target.matches('input, textarea')) {
        window.quizAudio?.keypress?.();
      }
    }, true);
  });
})();
