/* ================================================================
   audio_manager.js  v2  ─  Web Audio API 全合成音效引擎
   ・真正的旋律背景音樂（含和弦 + 低音 + 打擊樂）
   ・答對 / 答錯 / 淘汰 / 倒數 / 開始 / 結算 專屬音效
   ・無需外部音檔，無版權問題
   ================================================================ */

const AudioManager = (() => {

  /* ── 音訊上下文 ─────────────────────────────────────── */
  let ctx = null;
  let masterGain = null;
  let bgLoopTimer = null;
  let bgPlaying = false;
  let muted = false;
  let bgBeat = 0;

  function getCtx() {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      masterGain = ctx.createGain();
      masterGain.gain.value = 0.7;
      masterGain.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  /* ── 基礎波形工具 ──────────────────────────────────── */

  /**
   * 單音振盪器
   * @param {object} opts - freq, type, vol, start, dur, attack, decay, sustain, release
   */
  function osc(opts) {
    if (muted) return;
    const c = getCtx();
    const now = c.currentTime;
    const {
      freq = 440, type = 'sine',
      vol = 0.3,
      start = 0,     // 相對延遲（秒）
      dur = 0.3,     // 總時長
      attack = 0.01,
      decay = 0.05,
      sustain = 0.6, // sustain level (ratio)
      release = 0.1
    } = opts;

    const o = c.createOscillator();
    const g = c.createGain();
    o.connect(g); g.connect(masterGain);
    o.type = type;
    o.frequency.setValueAtTime(freq, now + start);

    const peakVol = vol;
    const susVol  = vol * sustain;
    const t0 = now + start;
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(peakVol, t0 + attack);
    g.gain.linearRampToValueAtTime(susVol,  t0 + attack + decay);
    g.gain.setValueAtTime(susVol, t0 + dur - release);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

    o.start(t0);
    o.stop(t0 + dur);
  }

  /** 噪音爆擊（鼓用） */
  function noise(opts) {
    if (muted) return;
    const c = getCtx();
    const now = c.currentTime;
    const { vol = 0.25, start = 0, dur = 0.1, hipass = 0 } = opts;

    const buf = c.createBuffer(1, c.sampleRate * dur, c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;

    const src = c.createBufferSource();
    src.buffer = buf;

    const g = c.createGain();
    const t0 = now + start;
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

    if (hipass > 0) {
      const flt = c.createBiquadFilter();
      flt.type = 'highpass';
      flt.frequency.value = hipass;
      src.connect(flt); flt.connect(g);
    } else {
      src.connect(g);
    }
    g.connect(masterGain);
    src.start(t0); src.stop(t0 + dur + 0.01);
  }

  /** 頻率滑音 */
  function sweep(opts) {
    if (muted) return;
    const c = getCtx();
    const now = c.currentTime;
    const { freqFrom = 800, freqTo = 200, type = 'sawtooth', vol = 0.2, start = 0, dur = 0.3 } = opts;

    const o = c.createOscillator();
    const g = c.createGain();
    o.connect(g); g.connect(masterGain);
    o.type = type;
    const t0 = now + start;
    o.frequency.setValueAtTime(freqFrom, t0);
    o.frequency.exponentialRampToValueAtTime(freqTo, t0 + dur);
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.start(t0); o.stop(t0 + dur + 0.01);
  }

  /* ══════════════════════════════════════════════════════
     背景音樂引擎
     ── C 大調，BPM 128，帶旋律 + 和弦 + 低音 + 打擊
     ══════════════════════════════════════════════════════ */

  /* 音符頻率表（C4 = 261.63Hz 基準） */
  const NOTE = {
    C3:130.81, D3:146.83, E3:164.81, F3:174.61, G3:196.00, A3:220.00, B3:246.94,
    C4:261.63, D4:293.66, E4:329.63, F4:349.23, G4:392.00, A4:440.00, B4:493.88,
    C5:523.25, D5:587.33, E5:659.25, F5:698.46, G5:783.99, A5:880.00,
    C6:1046.50, D6:1174.66, E6:1318.51
  };

  const BPM   = 128;
  const BEAT  = 60 / BPM;         // 0.469s/拍
  const BAR   = BEAT * 4;         // 1小節

  /* 旋律序列（16拍 = 4小節，循環） */
  const MELODY = [
    // 拍號, 音符, 時值(拍), 音量
    [0,  'E5', 0.5, 0.18],
    [0.5,'G5', 0.5, 0.16],
    [1,  'A5', 1.0, 0.20],
    [2,  'G5', 0.5, 0.16],
    [2.5,'E5', 0.5, 0.16],
    [3,  'C5', 1.0, 0.18],
    [4,  'D5', 0.5, 0.16],
    [4.5,'F5', 0.5, 0.15],
    [5,  'G5', 1.0, 0.20],
    [6,  'F5', 0.5, 0.16],
    [6.5,'D5', 0.5, 0.15],
    [7,  'E5', 2.0, 0.18],
    [9,  'C5', 0.5, 0.16],
    [9.5,'E5', 0.5, 0.16],
    [10, 'G5', 0.5, 0.18],
    [10.5,'A5',0.5, 0.20],
    [11, 'G5', 1.0, 0.18],
    [12, 'F5', 0.5, 0.16],
    [12.5,'E5',0.5, 0.15],
    [13, 'D5', 0.5, 0.16],
    [13.5,'C5',0.5, 0.15],
    [14, 'E5', 0.5, 0.16],
    [14.5,'G5',0.5, 0.18],
    [15, 'C6', 1.0, 0.22],
  ];

  /* 和弦（每2拍換一次，16拍循環） */
  const CHORDS = [
    // [C,E,G], [Am=A,C,E], [F,A,C], [G,B,D]
    [NOTE.C4, NOTE.E4, NOTE.G4],  // 拍 0-1  → C
    [NOTE.C4, NOTE.E4, NOTE.G4],  // 拍 2-3  → C
    [NOTE.A3, NOTE.C4, NOTE.E4],  // 拍 4-5  → Am
    [NOTE.A3, NOTE.C4, NOTE.E4],  // 拍 6-7  → Am
    [NOTE.F3, NOTE.A3, NOTE.C4],  // 拍 8-9  → F
    [NOTE.F3, NOTE.A3, NOTE.C4],  // 拍 10-11→ F
    [NOTE.G3, NOTE.B3, NOTE.D4],  // 拍 12-13→ G
    [NOTE.G3, NOTE.B3, NOTE.D4],  // 拍 14-15→ G
  ];

  /* 低音線（每拍一個音） */
  const BASS = [
    NOTE.C3, NOTE.C3, NOTE.C3, NOTE.C3,
    NOTE.A3, NOTE.A3, NOTE.A3, NOTE.A3,
    NOTE.F3, NOTE.F3, NOTE.F3, NOTE.F3,
    NOTE.G3, NOTE.G3, NOTE.G3, NOTE.G3,
  ];

  /* 打擊樂型（1=大鼓, 2=小鼓, 3=hi-hat, 0=空） */
  const DRUMS = [
    1, 3, 2, 3,   1, 3, 2, 3,
    1, 3, 2, 3,   1, 3, 2, 3,
  ];

  function scheduleBar(barStartTime) {
    if (muted || !bgPlaying) return;
    const c = getCtx();
    const t = barStartTime; // 絕對時間

    /* ── 打擊樂 ── */
    DRUMS.forEach((d, i) => {
      const bt = t + i * (BAR / 16); // 16分音符
      if (d === 1) {
        // 大鼓：低頻 sweep
        noise({ vol: 0.28, start: bt - c.currentTime, dur: 0.12 });
        sweep({ freqFrom: 200, freqTo: 50, type: 'sine', vol: 0.22,
                start: bt - c.currentTime, dur: 0.18 });
      } else if (d === 2) {
        // 小鼓：中頻 noise + 短音
        noise({ vol: 0.18, start: bt - c.currentTime, dur: 0.10, hipass: 400 });
        osc({ freq: 220, type: 'triangle', vol: 0.08,
              start: bt - c.currentTime, dur: 0.08, attack: 0.002, decay: 0.04, release: 0.03 });
      } else if (d === 3) {
        // hi-hat：高頻 noise
        noise({ vol: 0.06, start: bt - c.currentTime, dur: 0.04, hipass: 8000 });
      }
    });

    /* ── 和弦（每2拍，各音稍微錯開arpeggio）── */
    CHORDS.forEach((chord, ci) => {
      const ct = t + ci * BEAT * 2;
      chord.forEach((freq, ni) => {
        osc({ freq, type: 'triangle', vol: 0.055,
              start: ct - c.currentTime + ni * 0.025,
              dur: BEAT * 2 - 0.05,
              attack: 0.02, decay: 0.1, sustain: 0.7, release: 0.15 });
      });
    });

    /* ── 低音線（每拍）── */
    BASS.forEach((freq, i) => {
      osc({ freq, type: 'triangle', vol: 0.14,
            start: t - c.currentTime + i * BEAT,
            dur: BEAT * 0.85,
            attack: 0.01, decay: 0.08, sustain: 0.6, release: 0.08 });
    });

    /* ── 旋律 ── */
    MELODY.forEach(([beat, noteName, dur, vol]) => {
      osc({ freq: NOTE[noteName], type: 'square', vol: vol * 0.8,
            start: t - c.currentTime + beat * BEAT,
            dur: dur * BEAT * 0.88,
            attack: 0.01, decay: 0.06, sustain: 0.75, release: 0.08 });
      // 旋律加一個八度的泛音，讓聲音更亮
      osc({ freq: NOTE[noteName] * 2, type: 'sine', vol: vol * 0.25,
            start: t - c.currentTime + beat * BEAT,
            dur: dur * BEAT * 0.7,
            attack: 0.01, decay: 0.05, sustain: 0.5, release: 0.06 });
    });
  }

  function startBgMusic() {
    if (muted || bgPlaying) return;
    bgPlaying = true;
    const c = getCtx();
    let nextBarTime = c.currentTime + 0.1;
    const barLen = BAR * 4; // 16拍 = 4小節

    function tick() {
      if (!bgPlaying || muted) return;
      const now = c.currentTime;
      // 提前 0.5 秒預排
      if (nextBarTime < now + 0.5) {
        scheduleBar(nextBarTime);
        nextBarTime += barLen;
      }
      bgLoopTimer = setTimeout(tick, 200);
    }
    tick();
  }

  function stopBgMusic() {
    bgPlaying = false;
    clearTimeout(bgLoopTimer);
    bgLoopTimer = null;
  }

  /* ══════════════════════════════════════════════════════
     音效庫（精心設計的合成音）
     ══════════════════════════════════════════════════════ */

  /** 答對！— 上升三和弦 + 星星閃爍 */
  function correct() {
    if (muted) return;
    // 主和弦上升
    [[0, NOTE.C5, 'triangle', 0.22],
     [0.06, NOTE.E5, 'triangle', 0.20],
     [0.12, NOTE.G5, 'triangle', 0.22],
     [0.20, NOTE.C6, 'sine',     0.25]
    ].forEach(([s, f, t, v]) =>
      osc({ freq: f, type: t, vol: v, start: s, dur: 0.4, attack: 0.01, decay: 0.06, sustain: 0.8, release: 0.15 })
    );
    // 高頻閃爍裝飾
    [[0.22, NOTE.E6, 0.12, 0.10],
     [0.30, NOTE.G5, 0.10, 0.08],
     [0.36, NOTE.C6, 0.15, 0.12]
    ].forEach(([s, f, d, v]) =>
      osc({ freq: f, type: 'sine', vol: v, start: s, dur: d, attack: 0.005, decay: 0.04, sustain: 0.5, release: 0.06 })
    );
  }

  /** 答錯！— 下降不和諧音 + 噪音打擊 */
  function wrong() {
    if (muted) return;
    sweep({ freqFrom: 480, freqTo: 140, type: 'sawtooth', vol: 0.20, start: 0,    dur: 0.28 });
    sweep({ freqFrom: 360, freqTo: 100, type: 'sawtooth', vol: 0.16, start: 0.04, dur: 0.28 });
    noise({ vol: 0.15, start: 0, dur: 0.18, hipass: 200 });
    // 低沉結尾
    osc({ freq: 90, type: 'sine', vol: 0.18, start: 0.15, dur: 0.25,
          attack: 0.02, decay: 0.1, sustain: 0.4, release: 0.1 });
  }

  /** 淘汰！— 戲劇性下沉 + 爆炸感 */
  function eliminated() {
    if (muted) return;
    // 大爆炸噪音
    noise({ vol: 0.30, start: 0, dur: 0.35 });
    // 下沉掃音（三層）
    sweep({ freqFrom: 600, freqTo: 60,  type: 'sawtooth', vol: 0.28, start: 0,    dur: 0.55 });
    sweep({ freqFrom: 400, freqTo: 40,  type: 'square',   vol: 0.20, start: 0.05, dur: 0.55 });
    sweep({ freqFrom: 200, freqTo: 30,  type: 'sine',     vol: 0.22, start: 0.10, dur: 0.60 });
    // 尾音
    osc({ freq: 55, type: 'sine', vol: 0.20, start: 0.4, dur: 0.5,
          attack: 0.05, decay: 0.2, sustain: 0.3, release: 0.2 });
  }

  /** 解析/結果頁出現 — 輕柔揭示和弦 */
  function reveal() {
    if (muted) return;
    [[0,    NOTE.C4, 'sine',     0.14],
     [0.05, NOTE.E4, 'sine',     0.12],
     [0.10, NOTE.G4, 'sine',     0.14],
     [0.18, NOTE.C5, 'triangle', 0.16],
    ].forEach(([s, f, t, v]) =>
      osc({ freq: f, type: t, vol: v, start: s, dur: 0.55,
            attack: 0.02, decay: 0.08, sustain: 0.7, release: 0.2 })
    );
    // 輕柔閃爍
    osc({ freq: NOTE.E5, type: 'sine', vol: 0.08, start: 0.28, dur: 0.3,
          attack: 0.02, decay: 0.06, sustain: 0.5, release: 0.15 });
  }

  /** 按鈕點擊 — 輕脆一聲 */
  function click() {
    if (muted) return;
    osc({ freq: 1200, type: 'sine', vol: 0.12, start: 0, dur: 0.06,
          attack: 0.002, decay: 0.02, sustain: 0.3, release: 0.03 });
    osc({ freq: 900,  type: 'sine', vol: 0.08, start: 0.02, dur: 0.05,
          attack: 0.002, decay: 0.02, sustain: 0.2, release: 0.02 });
  }

  /** 倒數 tick — 每秒一下，最後2秒更急促 */
  function tick(urgent = false) {
    if (muted) return;
    if (urgent) {
      osc({ freq: 1400, type: 'square', vol: 0.14, start: 0, dur: 0.07,
            attack: 0.002, decay: 0.03, sustain: 0.2, release: 0.03 });
      osc({ freq: 1800, type: 'sine',   vol: 0.08, start: 0.04, dur: 0.05,
            attack: 0.002, decay: 0.02, sustain: 0.1, release: 0.02 });
    } else {
      osc({ freq: 880,  type: 'square', vol: 0.09, start: 0, dur: 0.06,
            attack: 0.002, decay: 0.02, sustain: 0.3, release: 0.03 });
    }
  }

  /** 題目開始！— 活潑的起始音效 */
  function questionStart() {
    if (muted) return;
    // 快速上升 arpeggio
    [[0,    NOTE.C5, 'square',   0.16],
     [0.05, NOTE.E5, 'square',   0.14],
     [0.10, NOTE.G5, 'square',   0.16],
     [0.16, NOTE.C6, 'triangle', 0.20],
    ].forEach(([s, f, t, v]) =>
      osc({ freq: f, type: t, vol: v, start: s, dur: 0.22,
            attack: 0.005, decay: 0.05, sustain: 0.6, release: 0.08 })
    );
    // 底部打擊
    noise({ vol: 0.12, start: 0, dur: 0.08 });
    osc({ freq: 80, type: 'sine', vol: 0.16, start: 0, dur: 0.14,
          attack: 0.005, decay: 0.06, sustain: 0.4, release: 0.06 });
  }

  /** 遊戲開始！— 宏大的開場 */
  function gameStart() {
    if (muted) return;
    // 大和弦展開
    [[0,    NOTE.C4, 'square',   0.20],
     [0.05, NOTE.G4, 'square',   0.18],
     [0.10, NOTE.C5, 'square',   0.20],
     [0.16, NOTE.E5, 'triangle', 0.22],
     [0.22, NOTE.G5, 'triangle', 0.22],
     [0.30, NOTE.C6, 'sine',     0.26],
    ].forEach(([s, f, t, v]) =>
      osc({ freq: f, type: t, vol: v, start: s, dur: 0.6,
            attack: 0.01, decay: 0.08, sustain: 0.8, release: 0.2 })
    );
    // 鼓點
    [0, 0.15, 0.30].forEach(s => {
      noise({ vol: 0.20, start: s, dur: 0.08 });
      osc({ freq: 80, type: 'sine', vol: 0.18, start: s, dur: 0.12,
            attack: 0.003, decay: 0.05, sustain: 0.3, release: 0.05 });
    });
  }

  /** 結算出現 — 頒獎典禮感 */
  function scoreboard() {
    if (muted) return;
    // 鼓聲揭幕
    [0, 0.12, 0.24].forEach(s =>
      noise({ vol: 0.18, start: s, dur: 0.10, hipass: 200 })
    );
    // 上升和弦展開（兩波）
    const wave1 = [
      [0.05, NOTE.C5], [0.12, NOTE.E5], [0.19, NOTE.G5], [0.27, NOTE.C6]
    ];
    wave1.forEach(([s, f]) =>
      osc({ freq: f, type: 'triangle', vol: 0.18, start: s, dur: 0.5,
            attack: 0.01, decay: 0.06, sustain: 0.8, release: 0.2 })
    );
    setTimeout(() => {
      if (muted) return;
      const wave2 = [
        [0,    NOTE.C4], [0.06, NOTE.E4], [0.12, NOTE.G4],
        [0.18, NOTE.C5], [0.24, NOTE.E5], [0.30, NOTE.G5], [0.36, NOTE.C6]
      ];
      wave2.forEach(([s, f]) =>
        osc({ freq: f, type: 'triangle', vol: 0.20, start: s, dur: 0.7,
              attack: 0.01, decay: 0.06, sustain: 0.85, release: 0.25 })
      );
      // 最後一顆大音
      osc({ freq: NOTE.C6, type: 'sine', vol: 0.22, start: 0.5, dur: 1.0,
            attack: 0.02, decay: 0.1, sustain: 0.9, release: 0.4 });
    }, 500);
  }

  /** 第一名！— 勝利fanfare */
  function firstPlace() {
    if (muted) return;
    // 三角形上升
    const fanfare = [
      [0,    NOTE.C5, 0.25], [0.25, NOTE.C5, 0.25], [0.50, NOTE.C5, 0.25],
      [0.75, NOTE.E5, 0.50], [1.25, NOTE.D5, 0.25],
      [1.50, NOTE.D5, 0.25], [1.75, NOTE.D5, 0.25],
      [2.00, NOTE.F5, 0.50], [2.50, NOTE.E5, 0.25],
      [2.75, NOTE.C5, 0.25], [3.00, NOTE.E5, 0.25],
      [3.25, NOTE.G5, 1.50],
    ];
    fanfare.forEach(([s, f, d]) => {
      osc({ freq: f, type: 'square',   vol: 0.20, start: s, dur: d * 0.9,
            attack: 0.01, decay: 0.04, sustain: 0.8, release: 0.08 });
      osc({ freq: f * 2, type: 'sine', vol: 0.08, start: s, dur: d * 0.7,
            attack: 0.01, decay: 0.03, sustain: 0.5, release: 0.06 });
    });
    // 和聲支撐
    [[0, NOTE.C4], [0.75, NOTE.C4], [1.50, NOTE.D4], [2.00, NOTE.C4], [3.25, NOTE.C4]].forEach(([s, f]) =>
      osc({ freq: f, type: 'triangle', vol: 0.12, start: s, dur: 0.5,
            attack: 0.02, decay: 0.08, sustain: 0.6, release: 0.15 })
    );
    // 慶典鼓點
    [0, 0.75, 1.50, 2.00, 3.25].forEach(s => {
      noise({ vol: 0.15, start: s, dur: 0.08 });
      osc({ freq: 70, type: 'sine', vol: 0.14, start: s, dur: 0.12,
            attack: 0.003, decay: 0.05, sustain: 0.3, release: 0.05 });
    });
  }

  /** 加入房間成功 — 歡迎音效 */
  function joinRoom() {
    if (muted) return;
    [NOTE.C5, NOTE.E5, NOTE.G5].forEach((f, i) =>
      osc({ freq: f, type: 'sine', vol: 0.15, start: i * 0.08, dur: 0.3,
            attack: 0.01, decay: 0.06, sustain: 0.7, release: 0.12 })
    );
  }

  /** 倒數最後提示 — 急促警告 */
  function countdown3() {
    if (muted) return;
    [0, 0.35, 0.70].forEach((s, i) => {
      const freq = [880, 1100, 1320][i];
      osc({ freq, type: 'square', vol: 0.16, start: s, dur: 0.2,
            attack: 0.003, decay: 0.05, sustain: 0.5, release: 0.08 });
    });
    noise({ vol: 0.08, start: 0, dur: 0.05 });
  }

  /* ══════════════════════════════════════════════════════
     靜音控制
     ══════════════════════════════════════════════════════ */
  function toggleMute() {
    muted = !muted;
    if (muted) { stopBgMusic(); }
    if (masterGain) masterGain.gain.value = muted ? 0 : 0.7;
    return muted;
  }
  function setMute(val) {
    muted = !!val;
    if (muted) { stopBgMusic(); }
    if (masterGain) masterGain.gain.value = muted ? 0 : 0.7;
  }
  function isMuted() { return muted; }

  /* ── 對外介面 ─────────────────────────────────────── */
  return {
    startBgMusic, stopBgMusic,
    correct, wrong, eliminated,
    reveal, click, tick,
    questionStart, gameStart,
    scoreboard, firstPlace,
    joinRoom, countdown3,
    toggleMute, setMute, isMuted,
    resume: () => ctx?.resume()
  };
})();

/* 相容舊版 audio.js 呼叫 */
window.quizAudio = {
  success: () => AudioManager.correct(),
  fail:    () => AudioManager.wrong()
};
