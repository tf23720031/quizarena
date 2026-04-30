const AudioManager = (() => {
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  let ctx = null;
  let master = null;
  let musicTimer = null;
  let musicStep = 0;
  let muted = localStorage.getItem('quizMuted') === '1';
  let theme = localStorage.getItem('quizMusicTheme') || 'spark';
  let musicStarted = false;

  function ensureCtx() {
    if (!AudioCtx) return null;
    if (!ctx) {
      ctx = new AudioCtx();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.42;
      master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return ctx;
  }

  function setMasterVolume(value) {
    if (master) master.gain.setValueAtTime(value, ensureCtx().currentTime);
  }

  function tone({ freq=440, type='sine', volume=0.12, start=0, duration=0.18, attack=0.01, release=0.08, endFreq=null }) {
    if (muted) return;
    const c = ensureCtx(); if (!c) return;
    const osc = c.createOscillator(), gain = c.createGain(), when = c.currentTime + start;
    osc.type = type;
    osc.frequency.setValueAtTime(freq, when);
    if (typeof endFreq === 'number') osc.frequency.exponentialRampToValueAtTime(Math.max(endFreq,1), when+duration);
    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.linearRampToValueAtTime(volume, when+attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, when+duration+release);
    osc.connect(gain); gain.connect(master);
    osc.start(when); osc.stop(when+duration+release+0.02);
  }

  function noise({ start=0, duration=0.08, volume=0.05, highpass=0 }={}) {
    if (muted) return;
    const c = ensureCtx(); if (!c) return;
    const buf = c.createBuffer(1, Math.max(1, Math.floor(c.sampleRate*duration)), c.sampleRate);
    const d = buf.getChannelData(0); for (let i=0;i<d.length;i++) d[i]=Math.random()*2-1;
    const src = c.createBufferSource(); src.buffer = buf;
    const gain = c.createGain(), when = c.currentTime+start;
    gain.gain.setValueAtTime(volume,when); gain.gain.exponentialRampToValueAtTime(0.0001,when+duration);
    if (highpass>0) { const f=c.createBiquadFilter(); f.type='highpass'; f.frequency.value=highpass; src.connect(f); f.connect(gain); } else src.connect(gain);
    gain.connect(master); src.start(when); src.stop(when+duration+0.02);
  }

  // ═══════════════════════════════════════════════════════════════
  //  10 MUSIC THEMES
  // ═══════════════════════════════════════════════════════════════
  const musicThemes = {
    spark:     { label:'Spark',     tempo:520, wave:'triangle', pattern:[[262,392,523],[294,440,587],[330,494,659],[392,523,784]],                                          bass:[131,147,165,196] },
    lofi:      { label:'Lo-fi',     tempo:800, wave:'sine',     pattern:[[220,330,392],[196,294,370],[247,330,415],[175,262,349]],                                          bass:[110,98,123,87] },
    arcade:    { label:'Arcade',   tempo:320, wave:'square',   pattern:[[523,659,784],[587,740,880],[659,784,988],[784,988,1175]],                                         bass:[131,147,165,196] },
    focus:     { label:'Focus',    tempo:950, wave:'sine',     pattern:[[262,330,392],[247,330,392],[220,294,370],[196,262,330]],                                          bass:[65,62,55,49] },
    adventure: { label:'Adventure',tempo:560, wave:'triangle', pattern:[[196,392,523],[220,440,587],[247,494,659],[262,523,784]],                                          bass:[65,73,82,87] },
    dream:     { label:'Dream',    tempo:860, wave:'sine',     pattern:[[330,494,740],[294,440,659],[262,392,587],[349,523,784]],                                          bass:[82,73,65,87] },
    jazz:      { label:'Jazz',     tempo:650, wave:'triangle', pattern:[[262,330,392,494],[294,370,440,554],[196,247,294,370],[220,277,330,415]],                          bass:[131,73,98,55] },
    edm:       { label:'EDM',      tempo:270, wave:'sawtooth', pattern:[[349,523],[392,587],[440,659],[523,784]],                                                          bass:[87,98,110,131] },
    retro:     { label:'Retro',    tempo:390, wave:'square',   pattern:[[262,330],[294,370],[330,415],[294,370],[262,330],[220,277],[196,247],[220,277]],                   bass:[131,147,165,147,131,110,98,110] },
    epic:      { label:'Epic',     tempo:700, wave:'sawtooth', pattern:[[196,392,587],[175,349,523],[165,330,494],[147,294,440],[131,262,392],[147,294,440],[165,330,494],[175,349,523]], bass:[49,44,41,37,33,37,41,44] }
  };

  function playBgStep() {
    if (muted || !musicStarted) return;
    const t = musicThemes[theme] || musicThemes.spark;
    const chord = t.pattern[musicStep % t.pattern.length];
    const bassFreq = t.bass ? t.bass[musicStep % t.bass.length] : null;
    chord.forEach((freq, i) => tone({ freq, type: i===0 ? t.wave : 'sine', volume: i===0 ? 0.085 : 0.055, duration:0.48, attack:0.02, release:0.12 }));
    if (bassFreq) tone({ freq:bassFreq, type:'triangle', volume:0.075, duration:0.32, attack:0.01, release:0.06 });
    if ((theme==='edm'||theme==='arcade') && musicStep%2===1) noise({ volume:0.04, duration:0.05, highpass:4000 });
    if (theme==='epic' && musicStep%4===0) tone({ freq:55, type:'sine', volume:0.09, duration:0.45, release:0.2 });
    musicStep++;
  }

  function startBgMusic() {
    if (musicStarted||muted) return;
    if (!ensureCtx()) return;
    musicStarted=true; playBgStep();
    const t = musicThemes[theme]||musicThemes.spark;
    musicTimer = window.setInterval(playBgStep, t.tempo);
  }

  function stopBgMusic() {
    musicStarted=false;
    if (musicTimer) { window.clearInterval(musicTimer); musicTimer=null; }
  }

  // SFX
  function click()       { tone({ freq:960, type:'triangle', volume:0.05, duration:0.04, endFreq:1220 }); }
  function tick(u=false) { tone({ freq:u?1480:920, type:u?'square':'triangle', volume:u?0.07:0.05, duration:u?0.06:0.05 }); }
  function countdown3()  { [0,0.3,0.6].forEach((s,i) => tone({ freq:[880,1100,1320][i], type:'square', volume:0.065, duration:0.11, start:s })); }
  function correct()     { [[0,660],[0.05,880],[0.11,1320]].forEach(([s,f]) => tone({ freq:f, type:'sine', volume:0.08, duration:0.18, start:s })); }
  function wrong()       { tone({ freq:360, type:'sawtooth', volume:0.075, duration:0.15, endFreq:190 }); tone({ freq:240, type:'triangle', volume:0.06, duration:0.16, start:0.04, endFreq:120 }); }
  function eliminated()  { wrong(); noise({ volume:0.08, duration:0.14, start:0.05, highpass:220 }); tone({ freq:95, type:'sine', volume:0.07, duration:0.25, start:0.08, endFreq:55 }); }
  function reveal()      { [[0,392],[0.05,523],[0.1,659]].forEach(([s,f]) => tone({ freq:f, type:'triangle', volume:0.06, duration:0.22, start:s })); }
  function questionStart(){ [[0,523],[0.05,659],[0.1,784]].forEach(([s,f]) => tone({ freq:f, type:'square', volume:0.065, duration:0.16, start:s })); }
  function gameStart()   { [[0,262],[0.06,392],[0.12,523],[0.2,784]].forEach(([s,f]) => tone({ freq:f, type:'triangle', volume:0.085, duration:0.22, start:s })); noise({ volume:0.04, duration:0.08, start:0.04 }); }
  function scoreboard()  { questionStart(); tone({ freq:1046, type:'sine', volume:0.07, duration:0.36, start:0.22 }); }
  function firstPlace()  { [[0,523],[0.12,659],[0.24,784],[0.38,1046]].forEach(([s,f]) => tone({ freq:f, type:'square', volume:0.08, duration:0.24, start:s })); }
  function joinRoom()    { [[0,523],[0.08,659],[0.16,784]].forEach(([s,f]) => tone({ freq:f, type:'sine', volume:0.06, duration:0.16, start:s })); }
  function pop()         { tone({ freq:540, type:'triangle', volume:0.05, duration:0.06, endFreq:700 }); }

  function setMute(next) {
    muted = !!next; localStorage.setItem('quizMuted', muted?'1':'0');
    if (muted) { stopBgMusic(); setMasterVolume(0); }
    else { ensureCtx(); setMasterVolume(0.42); startBgMusic(); }
  }
  function toggleMute() { setMute(!muted); return muted; }
  function isMuted()    { return muted; }

  function setTheme(next) {
    theme = musicThemes[next] ? next : 'spark';
    localStorage.setItem('quizMusicTheme', theme);
    musicStep = 0;
    if (musicStarted) { stopBgMusic(); startBgMusic(); }
  }
  function getTheme()  { return theme; }
  function getThemes() { return Object.entries(musicThemes).map(([id,t]) => ({ id, label:t.label })); }
  function resume()    { ensureCtx(); }

  function bindAutoStart() {
    const boot = () => { resume(); startBgMusic(); };
    document.addEventListener('click',   boot, { once:true, capture:true });
    document.addEventListener('keydown', boot, { once:true, capture:true });
  }
  bindAutoStart();

  return { click,tick,pop,correct,wrong,eliminated,reveal,questionStart,gameStart,scoreboard,firstPlace,joinRoom,countdown3,startBgMusic,stopBgMusic,toggleMute,setMute,isMuted,setTheme,getTheme,getThemes,resume };
})();

window.AudioManager = AudioManager;
window.quizAudio = window.quizAudio || {};
window.quizAudio.click    = () => AudioManager.click();
window.quizAudio.keypress = () => AudioManager.click();
window.quizAudio.success  = () => AudioManager.correct();
window.quizAudio.fail     = () => AudioManager.wrong();
window.quizAudio.pop      = () => AudioManager.pop();
