window.AudioManager = AudioManager;
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
      master.gain.value = muted ? 0 : 0.42;
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
