/* ================================================================
   audio_manager.js
   使用 Web Audio API 合成音效，不需要外部音檔
   ================================================================ */

const AudioManager = (() => {
  let ctx = null;
  let bgGain = null;
  let bgSource = null;
  let bgPlaying = false;
  let muted = false;

  function getCtx() {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      bgGain = ctx.createGain();
      bgGain.gain.value = 0.18;
      bgGain.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  /* ── 基礎音效工具 ── */
  function playTone({ freq = 440, type = 'sine', duration = 0.2, volume = 0.3, delay = 0, attack = 0.01, release = 0.05 }) {
    if (muted) return;
    try {
      const c   = getCtx();
      const osc = c.createOscillator();
      const g   = c.createGain();
      osc.connect(g);
      g.connect(c.destination);
      osc.type = type;
      osc.frequency.setValueAtTime(freq, c.currentTime + delay);
      g.gain.setValueAtTime(0, c.currentTime + delay);
      g.gain.linearRampToValueAtTime(volume, c.currentTime + delay + attack);
      g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + delay + duration - release);
      osc.start(c.currentTime + delay);
      osc.stop(c.currentTime + delay + duration);
    } catch (_) {}
  }

  function playChord(freqs, opts = {}) {
    freqs.forEach((f, i) => playTone({ freq: f, delay: (opts.arpDelay || 0) * i, ...opts }));
  }

  /* ══════════════════════════════════════
     背景音樂（輕快像素風 loop）
     ══════════════════════════════════════ */
  function startBgMusic() {
    if (muted || bgPlaying) return;
    bgPlaying = true;

    const c = getCtx();
    const tempo = 0.25; // 每拍秒數（240bpm）
    const scale = [261.6, 293.7, 329.6, 349.2, 392.0, 440.0, 493.9, 523.3]; // C大調

    // 簡單旋律序列
    const melody = [0, 2, 4, 5, 4, 2, 0, 2, 4, 7, 5, 4, 2, 4, 5, 4];
    const bass   = [0, 0, 4, 4, 5, 5, 4, 4, 0, 0, 2, 2, 3, 3, 2, 2];
    const totalBeats = melody.length;

    let beatIdx = 0;
    let stopped = false;

    function scheduleBeat() {
      if (stopped || muted) return;
      const ct = c.currentTime;

      // 旋律
      const mOsc = c.createOscillator();
      const mG   = c.createGain();
      mOsc.connect(mG); mG.connect(bgGain);
      mOsc.type = 'square';
      mOsc.frequency.setValueAtTime(scale[melody[beatIdx]] * 2, ct);
      mG.gain.setValueAtTime(0, ct);
      mG.gain.linearRampToValueAtTime(0.12, ct + 0.02);
      mG.gain.exponentialRampToValueAtTime(0.001, ct + tempo * 0.7);
      mOsc.start(ct); mOsc.stop(ct + tempo);

      // 低音（每偶數拍）
      if (beatIdx % 2 === 0) {
        const bOsc = c.createOscillator();
        const bG   = c.createGain();
        bOsc.connect(bG); bG.connect(bgGain);
        bOsc.type = 'triangle';
        bOsc.frequency.setValueAtTime(scale[bass[beatIdx]], ct);
        bG.gain.setValueAtTime(0, ct);
        bG.gain.linearRampToValueAtTime(0.15, ct + 0.03);
        bG.gain.exponentialRampToValueAtTime(0.001, ct + tempo * 1.5);
        bOsc.start(ct); bOsc.stop(ct + tempo * 1.5);
      }

      beatIdx = (beatIdx + 1) % totalBeats;
      bgSource = setTimeout(scheduleBeat, tempo * 1000);
    }

    scheduleBeat();
    return () => { stopped = true; clearTimeout(bgSource); bgPlaying = false; };
  }

  function stopBgMusic() {
    clearTimeout(bgSource);
    bgPlaying = false;
  }

  /* ══════════════════════════════════════
     音效庫
     ══════════════════════════════════════ */

  // 答對！上升和弦
  function correct() {
    if (muted) return;
    [523.3, 659.3, 783.9, 1046.5].forEach((f, i) =>
      playTone({ freq: f, type: 'triangle', duration: 0.25, volume: 0.28, delay: i * 0.06 })
    );
  }

  // 答錯！下降音
  function wrong() {
    if (muted) return;
    [300, 240, 180].forEach((f, i) =>
      playTone({ freq: f, type: 'sawtooth', duration: 0.22, volume: 0.22, delay: i * 0.08 })
    );
  }

  // 淘汰！低沉轟炸
  function eliminated() {
    if (muted) return;
    playTone({ freq: 120, type: 'sawtooth', duration: 0.5, volume: 0.35 });
    playTone({ freq: 80,  type: 'sawtooth', duration: 0.7, volume: 0.25, delay: 0.1 });
  }

  // 解析/結果頁出現
  function reveal() {
    if (muted) return;
    [440, 550, 660].forEach((f, i) =>
      playTone({ freq: f, type: 'sine', duration: 0.18, volume: 0.2, delay: i * 0.05 })
    );
  }

  // 按鈕點擊
  function click() {
    if (muted) return;
    playTone({ freq: 800, type: 'sine', duration: 0.08, volume: 0.15 });
  }

  // 計時警報（最後5秒）
  function tick(urgent = false) {
    if (muted) return;
    playTone({ freq: urgent ? 1200 : 880, type: 'square', duration: 0.06, volume: urgent ? 0.18 : 0.1 });
  }

  // 題目開始！
  function questionStart() {
    if (muted) return;
    [330, 415, 523, 659].forEach((f, i) =>
      playTone({ freq: f, type: 'triangle', duration: 0.15, volume: 0.22, delay: i * 0.04 })
    );
  }

  // 遊戲開始
  function gameStart() {
    if (muted) return;
    [261.6, 329.6, 392.0, 523.3, 659.3].forEach((f, i) =>
      playTone({ freq: f, type: 'square', duration: 0.2, volume: 0.25, delay: i * 0.07 })
    );
  }

  // 結算出現
  function scoreboard() {
    if (muted) return;
    playChord([523, 659, 784], { type: 'triangle', duration: 0.5, volume: 0.22, arpDelay: 0.06 });
    setTimeout(() => playChord([523, 659, 784, 1047], { type: 'triangle', duration: 0.6, volume: 0.2, arpDelay: 0.04 }), 350);
  }

  // 第一名特效
  function firstPlace() {
    if (muted) return;
    [523, 659, 784, 1047, 1319, 1047, 784, 659, 523].forEach((f, i) =>
      playTone({ freq: f, type: 'triangle', duration: 0.15, volume: 0.25, delay: i * 0.06 })
    );
  }

  /* ── 靜音切換 ── */
  function toggleMute() {
    muted = !muted;
    if (muted) stopBgMusic();
    return muted;
  }

  function setMute(val) { muted = !!val; }

  return {
    startBgMusic, stopBgMusic,
    correct, wrong, eliminated, reveal, click, tick, questionStart, gameStart, scoreboard, firstPlace,
    toggleMute, setMute,
    isMuted: () => muted,
    resume: () => ctx?.resume()
  };
})();

// 讓舊的 audio.js 呼叫也能用
window.quizAudio = {
  success: () => AudioManager.correct(),
  fail:    () => AudioManager.wrong()
};
