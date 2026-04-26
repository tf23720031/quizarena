/* ======================================================
   quiz_game.js  —  完整版（含頭像、頒獎台、結算、房主明細）
   ====================================================== */

const roleText          = document.getElementById('roleText');
const countdownText     = document.getElementById('countdownText');
const hostMonitorBox    = document.getElementById('hostMonitorBox');
const hostAnswerStatus  = document.getElementById('hostAnswerStatus');
const hostAnswerBreakdown = document.getElementById('hostAnswerBreakdown');
const myLiveScoreText   = document.getElementById('myLiveScoreText');
const resultTop5List    = document.getElementById('resultTop5List');
const skipExplanationBtn = document.getElementById('skipExplanationBtn');
const nextQuestionBtn   = document.getElementById('nextQuestionBtn');
const myRankBox         = document.getElementById('myRankBox');
const myRankText        = document.getElementById('myRankText');
const finishHostSkipBtn = document.getElementById('skipExplanationBtn'); // alias

const toastEl         = document.getElementById('toast');
const pin             = localStorage.getItem('currentRoomPin') || '';
const playerProfile   = JSON.parse(localStorage.getItem('roomPlayerProfile') || '{}');

const roomPinText     = document.getElementById('roomPinText');
const playerNameText  = document.getElementById('playerNameText');
const totalScoreText  = document.getElementById('totalScoreText');
const scoreBadge      = totalScoreText ? totalScoreText.closest('.badge-pill') : null;
const finishScoreText = document.getElementById('finishScoreText');

const progressText    = document.getElementById('progressText');
const leaderboardList = document.getElementById('leaderboardList');

const questionWrap    = document.getElementById('questionWrap');
const finishWrap      = document.getElementById('finishWrap');

const questionKicker  = document.getElementById('questionKicker');
const questionTitle   = document.getElementById('questionTitle');
const questionContent = document.getElementById('questionContent');
const questionImage   = document.getElementById('questionImage');
const optionsList     = document.getElementById('optionsList');
const submitAnswerBtn = document.getElementById('submitAnswerBtn');

const resultOverlay   = document.getElementById('resultOverlay');
const earnedScoreText = document.getElementById('earnedScoreText');
const correctAnswerText = document.getElementById('correctAnswerText');
const resultExplanation = document.getElementById('resultExplanation');
const resultBadge     = document.getElementById('resultBadge');

/* 頒獎台 / 結算 */
const podiumOverlay   = document.getElementById('podiumOverlay');
const scoreboardWrap  = document.getElementById('scoreboardWrap');
const hostDetailWrap  = document.getElementById('hostDetailWrap');

/* 側邊玩家列表 */
const playerSideList  = document.getElementById('playerSideList');

let currentQuestion       = null;
let currentQuestionId     = null;
let currentPhase          = 'question';
let selected              = [];
let timer                 = null;
let remainSeconds         = 20;
let hasSubmitted          = false;
let hasLeftRoom           = false;
let isInternalNavigation  = false;
let hostQuestionFinished  = false;
let lastOverlayQuestionId = null;
let gameFinished          = false;
let lastAnswerStatusSnapshot = '';

const isHost = !!playerProfile?.isHost;

/* ── helpers ── */
function getDisplayPlayerName() {
  return (playerProfile?.name || localStorage.getItem('playerName') || '玩家').trim();
}

function showToast(msg, delay = 2400) {
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => toastEl.classList.remove('show'), delay);
}

async function api(url, opts = {}) {
  const res = await fetch(url, { headers: { 'Content-Type': 'application/json' }, ...opts });
  const data = await res.json();
  if (!res.ok || data.success === false) throw new Error(data.message || '操作失敗');
  return data;
}

function avatarHtml(p, size = 52) {
  const face = p.face || 'images/face/face.png';
  const hair = p.hair || 'images/hair/hair01.png';
  const eyes = p.eyes || 'images/face/eyes01.png';
  const oy   = p.eyes_offset_y || p.eyesOffsetY || 0;
  return `
    <div class="mini-avatar" style="width:${size}px;height:${size}px;">
      <img src="${face}" class="ma-layer ma-face">
      <img src="${eyes}" class="ma-layer ma-eyes" style="transform:translateX(-50%) translateY(${oy}px)">
      <img src="${hair}" class="ma-layer ma-hair">
    </div>`;
}

/* ── 側邊玩家列表（含頭像）── */
function renderPlayerSideList(answerStatus = []) {
  if (!playerSideList) return;
  if (!answerStatus.length) { playerSideList.innerHTML = ''; return; }
  playerSideList.innerHTML = answerStatus.map(p => {
    const cls = p.answered ? 'psl-item done' : 'psl-item wait';
    const icon = p.answered
      ? (p.is_correct ? '<i class="fa-solid fa-check" style="color:#5cb85c"></i>' : '<i class="fa-solid fa-xmark" style="color:#e05"></i>')
      : '<i class="fa-solid fa-ellipsis" style="color:#aaa"></i>';
    return `
      <div class="${cls}">
        ${avatarHtml(p, 42)}
        <span class="psl-name">${p.player_name}</span>
        <span class="psl-icon">${icon}</span>
      </div>`;
  }).join('');
}

/* ── 排行榜 ── */
function renderLeaderboard(items = []) {
  const me = getDisplayPlayerName();
  leaderboardList.innerHTML = items.length
    ? items.map((it, i) => `
        <div class="leader-item ${it.player_name === me ? 'mine' : ''}">
          <span>${i + 1}. ${it.player_name}</span>
          <strong>${it.total_score}</strong>
        </div>`).join('')
    : '<div class="leader-item"><span>尚無資料</span><strong>0</strong></div>';
}

function renderResultTop5(items = []) {
  const me = getDisplayPlayerName();
  resultTop5List.innerHTML = items.length
    ? items.map((it, i) => `
        <div class="result-top5-item ${it.player_name === me ? 'mine' : ''}">
          <span>${i + 1}. ${it.player_name}</span>
          <strong>${it.total_score}</strong>
        </div>`).join('')
    : '<div class="result-top5-item"><span>尚無排行</span><strong>0</strong></div>';
}

/* ── 房主監控 ── */
function renderHostStatus(items = []) {
  if (!hostAnswerStatus) return;
  hostAnswerStatus.innerHTML = items.length
    ? items.map(it => `
        <div class="host-answer-item ${it.answered ? 'done' : 'wait'}">
          <span>${it.player_name}</span>
          <strong>${it.answered ? '已作答' : '未作答'}</strong>
        </div>`).join('')
    : '<div class="host-answer-item wait"><span>尚無玩家</span><strong>-</strong></div>';

  /* 偵測「所有人都答完」→ 提示房主可跳過 */
  if (items.length && items.every(it => it.answered)) {
    const allDoneBtn = document.getElementById('hostAllDoneSkipBtn');
    if (allDoneBtn) allDoneBtn.style.display = 'inline-block';
  }
}

function renderHostBreakdown(items = []) {
  if (!hostAnswerBreakdown) return;
  hostAnswerBreakdown.innerHTML = items.length
    ? items.map(it => `
        <div class="breakdown-item">
          <div class="breakdown-left">
            <span class="breakdown-label">${it.label}</span>
            <span class="breakdown-text">${it.text || '選項'}</span>
          </div>
          <strong class="breakdown-count">${it.count} 人</strong>
        </div>`).join('')
    : '<div class="breakdown-item"><div class="breakdown-left"><span class="breakdown-label">-</span><span class="breakdown-text">尚無統計</span></div><strong class="breakdown-count">0</strong></div>';
}

/* ── 倒數 ── */
function stopCountdown() { clearInterval(timer); timer = null; }

async function finishQuestionAsHost() {
  if (!isHost || hostQuestionFinished || !currentQuestion) return;
  hostQuestionFinished = true;
  try {
    await api('/host_finish_question', {
      method: 'POST',
      body: JSON.stringify({ pin, playerName: getDisplayPlayerName() })
    });
    await loadState(true);
  } catch (e) { showToast(e.message); }
}

function startCountdown(seconds) {
  stopCountdown();
  remainSeconds = Number(seconds) || 20;
  countdownText.textContent = remainSeconds;
  timer = setInterval(() => {
    remainSeconds -= 1;
    countdownText.textContent = Math.max(remainSeconds, 0);
    if (remainSeconds <= 0) {
      stopCountdown();
      if (!isHost && !hasSubmitted) submitAnswer(true);
      if (isHost) { showToast('倒數結束，正在切換到本題統計...'); finishQuestionAsHost(); }
    }
  }, 1000);
}

/* ── 選項 ── */
function setSelection(index) {
  if (!currentQuestion || isHost || hasSubmitted || currentPhase !== 'question') return;
  if (currentQuestion.type === 'multiple') {
    selected = selected.includes(index)
      ? selected.filter(i => i !== index)
      : [...selected, index].sort((a, b) => a - b);
  } else {
    selected = [index];
  }
  document.querySelectorAll('.option-btn').forEach(btn =>
    btn.classList.toggle('selected', selected.includes(Number(btn.dataset.index))));
}

/* ── 渲染題目 ── */
function renderQuestion(q, answeredCount, totalQuestions) {
  currentQuestion      = q;
  selected             = [];
  hasSubmitted         = false;
  hostQuestionFinished = false;

  progressText.textContent = `第 ${answeredCount + 1} / ${totalQuestions} 題`;
  questionKicker.textContent = `${q.type === 'multiple' ? '多選題' : q.type === 'tf' ? '是非題' : '單選題'} ・ ${q.time || '20 秒'} ・ ${q.score} 分`;
  questionTitle.textContent  = q.title || `第 ${answeredCount + 1} 題`;
  questionContent.textContent = q.content || '';

  if (q.image) { questionImage.src = q.image; questionImage.style.display = 'block'; }
  else { questionImage.style.display = 'none'; }

  optionsList.innerHTML = (q.options || []).map((opt, idx) => `
    <button class="option-btn" data-index="${idx}">
      <span class="option-letter">${String.fromCharCode(65 + idx)}</span>
      <span>${opt.text}</span>
    </button>`).join('');

  document.querySelectorAll('.option-btn').forEach(btn =>
    btn.addEventListener('click', () => setSelection(Number(btn.dataset.index))));

  optionsList.style.pointerEvents = isHost ? 'none' : '';

  /* 房主「跳過剩餘時間」按鈕 */
  const allDoneBtn = document.getElementById('hostAllDoneSkipBtn');
  if (allDoneBtn) allDoneBtn.style.display = 'none';
}

/* ── result overlay ── */
function updateRankBox(myRank, showExactRank) {
  if (!myRankBox) return;
  if (showExactRank && myRank) {
    myRankBox.style.display = 'block';
    myRankText.textContent  = `你目前第 ${myRank} 名`;
  } else {
    myRankBox.style.display = 'none';
  }
}

function openResultOverlay({ badge, points, answerText, explanation, top5, myRank, showExactRank, hostMode = false }) {
  resultBadge.textContent       = badge;
  earnedScoreText.textContent   = points;
  correctAnswerText.textContent = answerText || '-';
  resultExplanation.textContent = explanation || '本題未提供解析。';
  renderResultTop5(top5 || []);
  updateRankBox(myRank, showExactRank);

  /* 房主：顯示跳過解析按鈕；玩家：隱藏 */
  if (skipExplanationBtn) skipExplanationBtn.style.display = (isHost && hostMode) ? 'inline-block' : 'none';
  if (nextQuestionBtn)    nextQuestionBtn.style.display    = 'none';
  if (myLiveScoreText?.parentElement)
    myLiveScoreText.parentElement.style.display = isHost ? 'none' : 'block';

  resultOverlay.classList.add('show');
}

function closeResultOverlay() { resultOverlay.classList.remove('show'); }

/* ── 提交答案 ── */
async function submitAnswer(isTimeout = false) {
  if (!currentQuestion || hasSubmitted || isHost || currentPhase !== 'question') return;
  if (!selected.length && !isTimeout) { showToast('請先選擇答案'); return; }

  try {
    hasSubmitted = true;
    stopCountdown();
    const data = await api('/submit_answer', {
      method: 'POST',
      body: JSON.stringify({
        pin,
        playerName: getDisplayPlayerName(),
        questionId: currentQuestion.question_id,
        selected,
        remainSeconds,
        isTimeout
      })
    });

    totalScoreText.textContent = data.totalScore ?? 0;
    finishScoreText.textContent = data.totalScore ?? 0;
    if (myLiveScoreText) myLiveScoreText.textContent = data.totalScore ?? 0;

    openResultOverlay({
      badge:       data.isCorrect ? '答對了！' : (isTimeout ? '時間到！' : '再接再厲'),
      points:      `+${data.pointsEarned || 0}`,
      answerText:  data.answerText || '-',
      explanation: '已送出答案，等待房主看完本題統計後進入下一題。',
      top5:        data.top5 || [],
      myRank:      data.myRank,
      showExactRank: data.showExactRank
    });

    if (data.isCorrect) window.quizAudio?.success(); else window.quizAudio?.fail();
  } catch (e) {
    hasSubmitted = false;
    showToast(e.message);
  }
}

/* ── 頒獎台 ── */
function buildPodiumHTML(leaderboard) {
  const top3 = leaderboard.slice(0, 3);
  while (top3.length < 3) top3.push(null);

  const medals = ['🥇', '🥈', '🥉'];
  const heights = ['140px', '110px', '85px'];
  /* 排列順序：2nd | 1st | 3rd */
  const order = [1, 0, 2];

  const cols = order.map(i => {
    const p = top3[i];
    if (!p) return `<div class="podium-col podium-${i + 1}"><div class="podium-stage" style="height:${heights[i]}"></div></div>`;
    return `
      <div class="podium-col podium-${i + 1}">
        <div class="podium-avatar">${avatarHtml(p, 64)}</div>
        <div class="podium-medal">${medals[i]}</div>
        <div class="podium-name">${p.player_name}</div>
        <div class="podium-score">${p.total_score} 分</div>
        <div class="podium-stage" style="height:${heights[i]}"></div>
      </div>`;
  });

  return `<div class="podium-row">${cols.join('')}</div>`;
}

function buildScoreboardHTML(leaderboard, allResults) {
  const me = getDisplayPlayerName();
  const rows = leaderboard.map((p, i) => `
    <div class="sb-row ${p.player_name === me ? 'sb-mine' : ''}">
      <span class="sb-rank">${i + 1}</span>
      <span class="sb-name">${p.player_name}</span>
      <span class="sb-score">${p.total_score} 分</span>
    </div>`).join('');

  return `<div class="scoreboard-list">${rows}</div>`;
}

function buildHostDetailHTML(allResults) {
  if (!allResults || !allResults.length) return '<p>無詳細資料</p>';

  /* 依玩家分組 */
  const byPlayer = {};
  allResults.forEach(r => {
    if (!byPlayer[r.player_name]) byPlayer[r.player_name] = [];
    byPlayer[r.player_name].push(r);
  });

  return Object.entries(byPlayer).map(([name, results]) => `
    <div class="hd-player-block">
      <div class="hd-player-name">${name}</div>
      <div class="hd-answers">
        ${results.map((r, qi) => {
          const sel = (() => { try { return JSON.parse(r.selected_json || '[]'); } catch { return []; } })();
          const selText = sel.map(i => String.fromCharCode(65 + i)).join(', ') || '未作答';
          return `
            <div class="hd-answer-item ${r.is_correct ? 'correct' : 'wrong'}">
              <span class="hd-q">第 ${qi + 1} 題</span>
              <span class="hd-sel">選：${selText}</span>
              <span class="hd-pts">${r.is_correct ? '+' + r.points_earned : '0'} 分</span>
            </div>`;
        }).join('')}
      </div>
    </div>`).join('');
}

async function showFinishScreen(data) {
  if (gameFinished) return;
  gameFinished = true;
  stopCountdown();
  closeResultOverlay();
  questionWrap.style.display = 'none';
  finishWrap.style.display   = 'none';

  /* 填充頒獎台 */
  const podiumInner = document.getElementById('podiumInner');
  if (podiumInner) podiumInner.innerHTML = buildPodiumHTML(data.leaderboard || []);

  /* 填充結算榜 */
  if (scoreboardWrap) {
    scoreboardWrap.innerHTML = buildScoreboardHTML(data.leaderboard || [], []);
  }

  /* 房主明細 */
  if (isHost && hostDetailWrap) {
    try {
      const detail = await api(`/host_all_results?pin=${encodeURIComponent(pin)}`);
      hostDetailWrap.innerHTML = buildHostDetailHTML(detail.results || []);
      document.getElementById('hostDetailSection')?.style.setProperty('display', 'block');
    } catch (e) {
      hostDetailWrap.innerHTML = '<p>無法載入詳細資料</p>';
    }
  }

  if (podiumOverlay) podiumOverlay.style.display = 'flex';
}

/* ── heartbeat / leave ── */
async function sendHeartbeat() {
  if (!pin || !getDisplayPlayerName() || hasLeftRoom) return;
  try {
    await fetch('/heartbeat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin, playerName: getDisplayPlayerName() })
    });
  } catch (e) {}
}

async function leaveRoom() {
  if (hasLeftRoom) return;
  hasLeftRoom = true;
  try {
    await api('/leave_room', {
      method: 'POST',
      body: JSON.stringify({ pin, playerName: getDisplayPlayerName() })
    });
  } catch (e) {
  } finally {
    ['currentRoomPin', 'currentRoomKey', 'roomPlayerProfile', 'pendingJoinContext'].forEach(k => localStorage.removeItem(k));
    isInternalNavigation = true;
    window.location.href = 'index.html';
  }
}

function leaveRoomOnUnload() {
  if (!pin || !getDisplayPlayerName() || hasLeftRoom || isInternalNavigation) return;
  hasLeftRoom = true;
  navigator.sendBeacon?.('/leave_room', new Blob([JSON.stringify({ pin, playerName: getDisplayPlayerName() })], { type: 'application/json' }));
}

/* ── phase handler ── */
function handlePhase(data) {
  currentPhase = data.phase || 'question';
  const questionId = data.nextQuestion?.question_id || null;

  if (questionId !== currentQuestionId) {
    currentQuestionId     = questionId;
    lastOverlayQuestionId = null;
    closeResultOverlay();
    if (data.nextQuestion) {
      renderQuestion(data.nextQuestion, data.answeredCount, data.totalQuestions);
      if (currentPhase === 'question') startCountdown(parseInt(data.nextQuestion?.time, 10) || 20);
      else { stopCountdown(); countdownText.textContent = 0; }
    }
  }

  /* 更新側邊玩家列表 */
  renderPlayerSideList(data.answerStatus || []);

  if (currentPhase === 'question') {
    /* ─ 作答中 ─ */
    if (data.nextQuestion && !timer && !resultOverlay.classList.contains('show')) {
      startCountdown(parseInt(data.nextQuestion?.time, 10) || 20);
    }

    if (isHost) {
      submitAnswerBtn.style.display = 'none';
      if (hostMonitorBox) hostMonitorBox.style.display = 'block';
      renderHostStatus(data.answerStatus || []);
      renderHostBreakdown([]);

      /* 所有人答完 → 顯示房主快速結束按鈕 */
      const allDone = (data.answerStatus || []).length > 0 && (data.answerStatus || []).every(x => x.answered);
      const allDoneBtn = document.getElementById('hostAllDoneSkipBtn');
      if (allDoneBtn) allDoneBtn.style.display = allDone ? 'inline-block' : 'none';
    } else {
      submitAnswerBtn.style.display = hasSubmitted ? 'none' : 'inline-block';
      if (hostMonitorBox) hostMonitorBox.style.display = 'none';
    }
    return;
  }

  /* ─ explanation 階段 ─ */
  stopCountdown();
  countdownText.textContent = 0;

  if (isHost) {
    submitAnswerBtn.style.display = 'none';
    if (hostMonitorBox) hostMonitorBox.style.display = 'block';
    renderHostStatus(data.answerStatus || []);
    renderHostBreakdown(data.answerBreakdown || []);

    if (lastOverlayQuestionId !== currentQuestionId) {
      openResultOverlay({
        badge:       '本題統計',
        points:      `已作答 ${(data.answerStatus || []).filter(x => x.answered).length} 人`,
        answerText:  data.correctAnswerText || '-',
        explanation: data.explanation || '本題沒有解析。',
        top5:        data.leaderboard?.slice(0, 5) || [],
        myRank:      null,
        showExactRank: false,
        hostMode:    true
      });
      lastOverlayQuestionId = currentQuestionId;
    }
  } else {
    submitAnswerBtn.style.display = 'none';
    if (hostMonitorBox) hostMonitorBox.style.display = 'none';

    if (data.myAnswered && lastOverlayQuestionId !== currentQuestionId) {
      openResultOverlay({
        badge:       '等待房主下一題',
        points:      `+${data.myResult?.points_earned || 0}`,
        answerText:  data.correctAnswerText || '-',
        explanation: data.explanation || '房主看完解析後會進入下一題。',
        top5:        data.leaderboard?.slice(0, 5) || [],
        myRank:      data.myRank,
        showExactRank: data.showExactRank
      });
      lastOverlayQuestionId = currentQuestionId;
    }
  }
}

/* ── main poll ── */
async function loadState(force = false) {
  if (!pin || !getDisplayPlayerName()) {
    showToast('缺少玩家資料');
    setTimeout(() => { window.location.href = 'index.html'; }, 1000);
    return;
  }

  try {
    const data = await api(`/player_game_state?pin=${encodeURIComponent(pin)}&playerName=${encodeURIComponent(getDisplayPlayerName())}`);
    roomPinText.textContent    = pin;
    playerNameText.textContent = getDisplayPlayerName();
    roleText.textContent       = isHost ? '房主' : '玩家';

    if (scoreBadge) scoreBadge.style.display = isHost ? 'none' : 'inline-flex';
    if (!isHost) {
      totalScoreText.textContent  = data.totalScore ?? 0;
      finishScoreText.textContent = data.totalScore ?? 0;
      if (myLiveScoreText) myLiveScoreText.textContent = data.totalScore ?? 0;
    }

    renderLeaderboard(data.leaderboard || []);

    if (data.finished) {
      await showFinishScreen(data);
      return;
    }

    questionWrap.style.display = 'block';
    finishWrap.style.display   = 'none';
    handlePhase(data);
  } catch (e) {
    showToast(e.message);
  }
}

/* ── event listeners ── */
submitAnswerBtn?.addEventListener('click', () => submitAnswer(false));
nextQuestionBtn?.addEventListener('click', closeResultOverlay);

skipExplanationBtn?.addEventListener('click', async () => {
  if (!isHost) return;
  try {
    await api('/host_skip_explanation', {
      method: 'POST',
      body: JSON.stringify({ pin, playerName: getDisplayPlayerName() })
    });
    closeResultOverlay();
    loadState(true);
  } catch (e) { showToast(e.message); }
});

/* 所有人答完 → 房主快速結束這題 */
document.getElementById('hostAllDoneSkipBtn')?.addEventListener('click', async () => {
  try {
    await api('/host_finish_question', {
      method: 'POST',
      body: JSON.stringify({ pin, playerName: getDisplayPlayerName() })
    });
    closeResultOverlay();
    loadState(true);
  } catch (e) { showToast(e.message); }
});

/* 結算頁：回首頁 */
document.getElementById('backHomeBtn')?.addEventListener('click', leaveRoom);

/* 頒獎台：點擊繼續進入結算 */
document.getElementById('podiumContinueBtn')?.addEventListener('click', () => {
  if (podiumOverlay) podiumOverlay.style.display = 'none';
  const sbOverlay = document.getElementById('scoreboardOverlay');
  if (sbOverlay) sbOverlay.style.display = 'flex';
});

window.addEventListener('beforeunload', leaveRoomOnUnload);

loadState(true);
sendHeartbeat();
setInterval(sendHeartbeat, 5000);
setInterval(() => { if (!hasLeftRoom && !gameFinished) loadState(); }, isHost ? 1800 : 2200);
