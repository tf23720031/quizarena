(() => {
  const KEY = "quizArenaSoundEnabled";
  let enabled = localStorage.getItem(KEY);
  if (enabled === null) enabled = "true";
  enabled = enabled === "true";

  function ensureCtx() {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return null;
    if (!window.__qaCtx) window.__qaCtx = new AudioCtx();
    if (window.__qaCtx.state === "suspended") {
      window.__qaCtx.resume().catch(() => {});
    }
    return window.__qaCtx;
  }

  function playTone({ freq = 660, duration = 0.06, type = "triangle", volume = 0.025, endFreq = null }) {
    if (!enabled) return;
    const ctx = ensureCtx();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    if (typeof endFreq === "number") {
      osc.frequency.exponentialRampToValueAtTime(Math.max(endFreq, 1), ctx.currentTime + duration);
    }

    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + duration);
  }

  const buttonSoundPool = [
    { freq: 650, duration: 0.045, type: "triangle", volume: 0.022, endFreq: 760 },
    { freq: 720, duration: 0.05, type: "sine", volume: 0.022, endFreq: 820 },
    { freq: 560, duration: 0.04, type: "triangle", volume: 0.024, endFreq: 680 },
    { freq: 810, duration: 0.035, type: "square", volume: 0.018, endFreq: 880 }
  ];

  const digitSoundPool = [
    { freq: 880, duration: 0.04, type: "triangle", volume: 0.022, endFreq: 980 },
    { freq: 940, duration: 0.045, type: "sine", volume: 0.021, endFreq: 1050 },
    { freq: 780, duration: 0.035, type: "triangle", volume: 0.022, endFreq: 920 },
    { freq: 1020, duration: 0.03, type: "square", volume: 0.018, endFreq: 1120 }
  ];

  function randomFrom(list) {
    return list[Math.floor(Math.random() * list.length)];
  }

  function playButtonRandom() {
    playTone(randomFrom(buttonSoundPool));
  }

  function playDigitRandom() {
    playTone(randomFrom(digitSoundPool));
  }

  function playSuccess() {
    playTone({ freq: 660, duration: 0.07, type: "sine", volume: 0.028, endFreq: 760 });
    setTimeout(() => playTone({ freq: 880, duration: 0.09, type: "sine", volume: 0.024, endFreq: 1020 }), 65);
  }

  function playFail() {
    playTone({ freq: 320, duration: 0.08, type: "sawtooth", volume: 0.024, endFreq: 250 });
    setTimeout(() => playTone({ freq: 240, duration: 0.08, type: "sawtooth", volume: 0.02, endFreq: 180 }), 70);
  }

  function playPop() {
    playTone({ freq: 560, duration: 0.05, type: "triangle", volume: 0.02, endFreq: 660 });
  }

  function injectCursorStyle() {
    if (document.getElementById("qaCursorStyle")) return;

    const defaultCursor = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='34' height='34' viewBox='0 0 34 34'%3E%3Cg transform='rotate(-18 17 17)'%3E%3Cpath d='M17 2.8l2.8 7.2 7.7.5-5.9 5 2 7.5L17 19.4 10.4 23l2-7.5-5.9-5 7.7-.5L17 2.8z' fill='%23ff8db8' stroke='%23ffffff' stroke-width='1.8' stroke-linejoin='round'/%3E%3Ccircle cx='17' cy='17' r='2.2' fill='%23fff7fb'/%3E%3C/g%3E%3C/svg%3E") 6 6, auto`;
    const pointerCursor = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='34' height='34' viewBox='0 0 34 34'%3E%3Cpath d='M6 4l19 12-8.2 1.1 4.2 8.4-4.3 2.2-4.1-8.2-5.3 6.2L6 4z' fill='%239d63ff' stroke='%23ffffff' stroke-width='1.8' stroke-linejoin='round'/%3E%3Ccircle cx='24.5' cy='8.5' r='3.1' fill='%23ff8db8' stroke='%23ffffff' stroke-width='1.4'/%3E%3C/svg%3E") 4 3, pointer`;

    const style = document.createElement("style");
    style.id = "qaCursorStyle";
    style.textContent = `
      html, body, .page-wrap, .home-page, .join-shell, .waiting-shell, .quiz-shell, main, section, div {
        cursor: ${defaultCursor};
      }

      button,
      .btn,
      .custom-btn,
      .start-btn,
      .join-room-btn,
      .confirm-btn,
      .circle-arrow,
      .top-action,
      .tool-btn,
      .option-btn,
      a,
      label[for],
      .clickable,
      [role="button"],
      input[type="checkbox"],
      input[type="radio"],
      summary {
        cursor: ${pointerCursor};
      }

      input,
      textarea,
      select,
      [contenteditable="true"] {
        cursor: text;
      }
    `;
    document.head.appendChild(style);
  }

  window.quizAudio = {
    click: playButtonRandom,
    keypress: playDigitRandom,
    success: playSuccess,
    fail: playFail,
    pop: playPop,
    isEnabled() {
      return enabled;
    },
    setEnabled(v) {
      enabled = !!v;
      localStorage.setItem(KEY, String(enabled));
      updateBtn();
    }
  };

  function updateBtn() {
    const btn = document.getElementById("audioToggleBtn");
    if (!btn) return;
    btn.innerHTML = enabled
      ? '<i class="fa-solid fa-volume-high"></i> 音效開'
      : '<i class="fa-solid fa-volume-xmark"></i> 音效關';
  }

  document.addEventListener("DOMContentLoaded", () => {
    injectCursorStyle();

    if (!document.getElementById("audioToggleBtn")) {
      const btn = document.createElement("button");
      btn.id = "audioToggleBtn";
      btn.className = "audio-toggle";
      document.body.appendChild(btn);
      btn.addEventListener("click", () => {
        enabled = !enabled;
        localStorage.setItem(KEY, String(enabled));
        if (enabled) playTone({ freq: 920, duration: 0.06, type: "triangle", volume: 0.03, endFreq: 1040 });
        updateBtn();
      });
      updateBtn();
    }

    document.body.addEventListener(
      "click",
      (e) => {
        if (e.target.closest("button, .btn, .custom-btn, .top-action, .tool-btn, .option-btn, .join-room-btn, .confirm-btn, .circle-arrow, [role='button']")) {
          playButtonRandom();
        }
      },
      true
    );

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

    document.addEventListener(
      "input",
      (e) => {
        const target = e.target;
        if (!target || !target.matches("input, textarea")) return;

        const value = typeof target.value === "string" ? target.value : "";
        const prev = target.dataset.prevValue || "";
        const added = value.length > prev.length ? value.slice(prev.length) : "";

        if (/\d/.test(added)) {
          playDigitRandom();
        }

        target.dataset.prevValue = value;
      },
      true
    );
  });
})();