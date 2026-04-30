(function () {
  const getAudioManager = () => window.AudioManager || null;

  function ensureToggle() {
    // Speaker button removed — mute is now inside the music drawer (nav_drawer.js → MusicDrawer)
  }

  document.addEventListener('DOMContentLoaded', () => {
    const audioManager = getAudioManager();
    if (!audioManager) {
      console.warn('AudioManager is not available. Check that js/Audio_manager.js is loaded before js/audio.js.');
      return;
    }

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
