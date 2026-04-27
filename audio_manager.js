const AudioManager = (() => {
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  let ctx = null;
  let master = null;
  let musicTimer = null;
  let musicStep = 0;
  let muted = localStorage.getItem('quizMuted') === '1';
  let musicStarted = false;

  function ensureCtx() {
    if (!AudioCtx) return null;
    if (!ctx) {
      ctx = new AudioCtx();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.16;
      master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    return ctx;
  }

  function setMasterVolume(value) {
    if (master) {
      master.gain.setValueAtTime(value, ensureCtx().currentTime);
    }
  }

  function tone({
    freq = 440,
    type = 'sine',
    volume = 0.12,
    start = 0,
    duration = 0.18,
    attack = 0.01,
    release = 0.08,
    endFreq = null
  }) {
    if (muted) return;
    const c = ensureCtx();
    if (!c) return;

    const osc = c.createOscillator();
    const gain = c.createGain();
    const when = c.currentTime + start;

    osc.type = type;
    osc.frequency.setValueAtTime(freq, when);
    if (typeof endFreq === 'number') {
      osc.frequency.exponentialRampToValueAtTime(Math.max(endFreq, 1), when + duration);
    }

    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.linearRampToValueAtTime(volume, when + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + duration + release);

    osc.connect(gain);
    gain.connect(master);
    osc.start(when);
    osc.stop(when + duration + release + 0.02);
  }

  function noise({ start = 0, duration = 0.08, volume = 0.05, highpass = 0 } = {}) {
    if (muted) return;
    const c = ensureCtx();
    if (!c) return;

    const buffer = c.createBuffer(1, Math.max(1, Math.floor(c.sampleRate * duration)), c.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) {
      data[i] = Math.random() * 2 - 1;
    }

    const source = c.createBufferSource();
    source.buffer = buffer;
    const gain = c.createGain();
    const when = c.currentTime + start;
    gain.gain.setValueAtTime(volume, when);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + duration);

    if (highpass > 0) {
      const filter = c.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.value = highpass;
      source.connect(filter);
      filter.connect(gain);
    } else {
      source.connect(gain);
    }

    gain.connect(master);
    source.start(when);
    source.stop(when + duration + 0.02);
  }

  const bgPattern = [
    [262, 392, 523],
    [294, 440, 587],
    [330, 494, 659],
    [392, 523, 784]
  ];

  function playBgStep() {
    if (muted || !musicStarted) return;
    const chord = bgPattern[musicStep % bgPattern.length];
    chord.forEach((freq, index) => {
      tone({
        freq,
        type: index === 0 ? 'triangle' : 'sine',
        volume: index === 0 ? 0.035 : 0.02,
        duration: 0.42,
        attack: 0.02,
        release: 0.12
      });
    });
    tone({
      freq: chord[0] / 2,
      type: 'triangle',
      volume: 0.03,
      duration: 0.24,
      attack: 0.01,
      release: 0.06
    });
    musicStep += 1;
  }

  function startBgMusic() {
    if (musicStarted || muted) return;
    if (!ensureCtx()) return;
    musicStarted = true;
    playBgStep();
    musicTimer = window.setInterval(playBgStep, 520);
  }

  function stopBgMusic() {
    musicStarted = false;
    if (musicTimer) {
      window.clearInterval(musicTimer);
      musicTimer = null;
    }
  }

  function click() {
    tone({ freq: 960, type: 'triangle', volume: 0.05, duration: 0.04, endFreq: 1220 });
  }

  function tick(urgent = false) {
    tone({
      freq: urgent ? 1480 : 920,
      type: urgent ? 'square' : 'triangle',
      volume: urgent ? 0.07 : 0.05,
      duration: urgent ? 0.06 : 0.05
    });
  }

  function countdown3() {
    [0, 0.3, 0.6].forEach((start, index) => {
      tone({ freq: [880, 1100, 1320][index], type: 'square', volume: 0.065, duration: 0.11, start });
    });
  }

  function correct() {
    [
      [0, 660],
      [0.05, 880],
      [0.11, 1320]
    ].forEach(([start, freq]) => tone({ freq, type: 'sine', volume: 0.08, duration: 0.18, start }));
  }

  function wrong() {
    tone({ freq: 360, type: 'sawtooth', volume: 0.075, duration: 0.15, endFreq: 190 });
    tone({ freq: 240, type: 'triangle', volume: 0.06, duration: 0.16, start: 0.04, endFreq: 120 });
  }

  function eliminated() {
    wrong();
    noise({ volume: 0.08, duration: 0.14, start: 0.05, highpass: 220 });
    tone({ freq: 95, type: 'sine', volume: 0.07, duration: 0.25, start: 0.08, endFreq: 55 });
  }

  function reveal() {
    [
      [0, 392],
      [0.05, 523],
      [0.1, 659]
    ].forEach(([start, freq]) => tone({ freq, type: 'triangle', volume: 0.06, duration: 0.22, start }));
  }

  function questionStart() {
    [
      [0, 523],
      [0.05, 659],
      [0.1, 784]
    ].forEach(([start, freq]) => tone({ freq, type: 'square', volume: 0.065, duration: 0.16, start }));
  }

  function gameStart() {
    [
      [0, 262],
      [0.06, 392],
      [0.12, 523],
      [0.2, 784]
    ].forEach(([start, freq]) => tone({ freq, type: 'triangle', volume: 0.085, duration: 0.22, start }));
    noise({ volume: 0.04, duration: 0.08, start: 0.04 });
  }

  function scoreboard() {
    questionStart();
    tone({ freq: 1046, type: 'sine', volume: 0.07, duration: 0.36, start: 0.22 });
  }

  function firstPlace() {
    [
      [0, 523],
      [0.12, 659],
      [0.24, 784],
      [0.38, 1046]
    ].forEach(([start, freq]) => tone({ freq, type: 'square', volume: 0.08, duration: 0.24, start }));
  }

  function joinRoom() {
    [
      [0, 523],
      [0.08, 659],
      [0.16, 784]
    ].forEach(([start, freq]) => tone({ freq, type: 'sine', volume: 0.06, duration: 0.16, start }));
  }

  function pop() {
    tone({ freq: 540, type: 'triangle', volume: 0.05, duration: 0.06, endFreq: 700 });
  }

  function setMute(nextMuted) {
    muted = !!nextMuted;
    localStorage.setItem('quizMuted', muted ? '1' : '0');
    if (muted) {
      stopBgMusic();
      setMasterVolume(0);
    } else {
      ensureCtx();
      setMasterVolume(0.16);
    }
  }

  function toggleMute() {
    setMute(!muted);
    return muted;
  }

  function isMuted() {
    return muted;
  }

  function resume() {
    ensureCtx();
  }

  function bindAutoStart() {
    const boot = () => {
      resume();
      startBgMusic();
    };
    document.addEventListener('click', boot, { once: true, capture: true });
    document.addEventListener('keydown', boot, { once: true, capture: true });
  }

  bindAutoStart();

  return {
    click,
    tick,
    pop,
    correct,
    wrong,
    eliminated,
    reveal,
    questionStart,
    gameStart,
    scoreboard,
    firstPlace,
    joinRoom,
    countdown3,
    startBgMusic,
    stopBgMusic,
    toggleMute,
    setMute,
    isMuted,
    resume
  };
})();

window.quizAudio = window.quizAudio || {};
window.quizAudio.click = () => AudioManager.click();
window.quizAudio.keypress = () => AudioManager.click();
window.quizAudio.success = () => AudioManager.correct();
window.quizAudio.fail = () => AudioManager.wrong();
window.quizAudio.pop = () => AudioManager.pop();
