/* ================================================================
   quiz_game.js  ─  房主=老師（監控 + 進題）/ 玩家=學生（答題）
   ================================================================ */

const toastEl    = document.getElementById('toast');
const pin        = localStorage.getItem('currentRoomPin') || '';
const playerProfile = JSON.parse(localStorage.getItem('roomPlayerProfile') || '{}');
const isHost     = !!playerProfile?.isHost;

/* ── DOM refs ── */
const roomPinText      = document.getElementById('roomPinText');
const playerNameText   = document.getElementById('playerNameText');
const roleText         = document.getElementById('roleText');
const countdownText    = document.getElementById('countdownText');
const totalScoreText   = document.getElementById('totalScoreText');
const scoreBadgePill   = document.getElementById('scoreBadgePill');
const progressText     = document.getElementById('progressText');
const leaderboardList  = document.getElementById('leaderboardList');

/* 房主視角 */
const hostView              = document.getElementById('hostView');
const hostQuestionKicker    = document.getElementById('hostQuestionKicker');
const hostQuestionTitle     = document.getElementById('hostQuestionTitle');
const hostQuestionContent   = document.getElementById('hostQuestionContent');
const hostQuestionImage     = document.getElementById('hostQuestionImage');
const hostMonitorBox        = document.getElementById('hostMonitorBox');
const hostAnswerStatus      = document.getElementById('hostAnswerStatus');
const hostAnswerBreakdown   = document.getElementById('hostAnswerBreakdown');
const hostAllDoneSkipBtn    = document.getElementById('hostAllDoneSkipBtn');
const hostExplanationOverlay = document.getElementById('hostExplanationOverlay');
const hostCorrectAnswerText = document.getElementById('hostCorrectAnswerText');
const hostExplanationText   = document.getElementById('hostExplanationText');
const hostResultTop5List    = document.getElementById('hostResultTop5List');
const hostSkipExplanationBtn = document.getElementById('hostSkipExplanationBtn');

/* 玩家視角 */
const playerView      = document.getElementById('playerView');
const questionWrap    = document.getElementById('questionWrap');
const questionKicker  = document.getElementById('questionKicker');
const questionTitle   = document.getElementById('questionTitle');
const questionContent = document.getElementById('questionContent');
const questionImage   = document.getElementById('questionImage');
const optionsList     = document.getElementById('optionsList');
const submitAnswerBtn = document.getElementById('submitAnswerBtn');

/* 結果 overlay（玩家用）*/
const resultOverlay      = document.getElementById('resultOverlay');
const resultBadge        = document.getElementById('resultBadge');
const earnedScoreText    = document.getElementById('earnedScoreText');
const correctAnswerText  = document.getElementById('correctAnswerText');
const resultExplanation  = document.getElementById('resultExplanation');
const myLiveScoreText    = document.getElementById('myLiveScoreText');
const myRankBox          = document.getElementById('myRankBox');
const myRankText         = document.getElementById('myRankText');
const resultTop5List     = document.getElementById('resultTop5List');
const skipExplanationBtn = document.getElementById('skipExplanationBtn');
const nextQuestionBtn    = document.getElementById('nextQuestionBtn');

/* 結束 */
const finishWrap    = document.getElementById('finishWrap');
const finishScoreText = document.getElementById('finishScoreText');
const podiumOverlay = document.getElementById('podiumOverlay');
const podiumInner   = document.getElementById('podiumInner');
const scoreboardOverlay = document.getElementById('scoreboardOverlay');
const scoreboardWrap    = document.getElementById('scoreboardWrap');
const hostDetailSection = document.getElementById('hostDetailSection');
const hostDetailWrap    = document.getElementById('hostDetailWrap');
const playerSideList    = document.getElementById('playerSideList');

/* ── state ── */
let currentQuestion       = null;
let currentQuestionId     = null;
let currentPhase          = 'question';
let selected              = [];
let timerInterval         = null;
let remainSeconds         = 0;
let hasSubmitted          = false;
let hasLeftRoom           = false;
let isInternalNavigation  = false;
let gameFinished          = false;
let lastHandledPhaseQid   = null;   // 避免重複開 overlay
let hostFinishedQuestion  = false;

/* ── helpers ── */
function getPlayerName() {
  return (playerProfile?.name || '').trim();
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

function avatarHtml(p, size = 48) {
  const face = p.face || 'images/face/face.png';
  const hair = p.hair || 'images/hair/hair01.png';
  const eyes = p.eyes || 'images/face/eyes01.png';
  const oy   = p.eyes_offset_y || p.eyesOffsetY || 0;
  return `<div class="mini-avatar" style="width:${size}px;height:${size}px;">
    <img src="${face}" class="ma-layer ma-face">
    <img src="${eyes}" class="ma-layer ma-eyes" style="transform:translateX(-50%) translateY(${oy}px)">
    <img src="${hair}" class="ma-layer ma-hair">
  </div>`;
}

/* ── 倒數計時 ── */
function stopTimer() { clearInterval(timerInterval); timerInterval = null; }

function startTimer(seconds, onEnd) {
  stopTimer();
  remainSeconds = Number(seconds) || 20;
  countdownText.textContent = remainSeconds;
  timerInterval = setInterval(() => {
    remainSeconds = Math.max(0, remainSeconds - 1);
    countdownText.textContent = remainSeconds;
    if (remainSeconds <= 0) {
      stopTimer();
      onEnd?.();
    }
  }, 1000);
}

/* ── 排行榜 ── */
function renderLeaderboard(items = []) {
  const me = getPlayerName();
  leaderboardList.innerHTML = items.length
    ? items.map((it, i) => `
        <div class="leader-item ${it.player_name === me ? 'mine' : ''}">
          <span>${i + 1}. ${it.player_name}</span>
          <strong>${it.total_score}</strong>
        </div>`).join('')
    : '<div class="leader-item"><span>尚無資料</span><strong>0</strong></div>';
}

function renderTop5(listEl, items = []) {
  if (!listEl) return;
  const me = getPlayerName();
  listEl.innerHTML = items.length
    ? items.map((it, i) => `
        <div class="result-top5-item ${it.player_name === me ? 'mine' : ''}">
          <span>${i + 1}. ${it.player_name}</span>
          <strong>${it.total_score}</strong>
        </div>`).join('')
    : '<div class="result-top5-item"><span>-</span></div>';
}

/* ── 側邊玩家列表 ── */
function renderPlayerSideList(answerStatus = []) {
  if (!playerSideList) return;
  if (!answerStatus.length) { playerSideList.innerHTML = ''; return; }
  playerSideList.innerHTML = answerStatus.map(p => {
    let icon = '<i class="fa-solid fa-ellipsis" style="color:#bbb"></i>';
    if (p.answered) {
      icon = p.is_correct
        ? '<i class="fa-solid fa-check" style="color:#5cb85c"></i>'
        : '<i class="fa-solid fa-xmark" style="color:#e05050"></i>';
    }
    return `<div class="psl-item ${p.answered ? 'done' : 'wait'}">
      ${avatarHtml(p, 38)}
      <span class="psl-name">${p.player_name}</span>
      <span class="psl-icon">${icon}</span>
    </div>`;
  }).join('');
}

/* ══════════════════════════════════════
   房主視角
   ══════════════════════════════════════ */
function renderHostQuestion(q, answeredCount, totalQuestions) {
  progressText.textContent = `第 ${answeredCount + 1} / ${totalQuestions} 題`;
  const typeLabel = q.type === 'multiple' ? '多選題' : q.type === 'tf' ? '是非題' : '單選題';
  hostQuestionKicker.textContent = `${typeLabel} ・ ${q.time || '20 秒'} ・ ${q.score} 分`;
  hostQuestionTitle.textContent  = q.title || `第 ${answeredCount + 1} 題`;
  hostQuestionContent.textContent = q.content || '';
  if (q.image) { hostQuestionImage.src = q.image; hostQuestionImage.style.display = 'block'; }
  else { hostQuestionImage.style.display = 'none'; }
}

function renderHostAnswerStatus(items = []) {
  if (!hostAnswerStatus) return;
  const done  = items.filter(x => x.answered).length;
  const total = items.length;
  hostAnswerStatus.innerHTML = items.length
    ? items.map(it => `
        <div class="host-answer-item ${it.answered ? 'done' : 'wait'}">
          ${avatarHtml(it, 34)}
          <span>${it.player_name}</span>
          <strong class="${it.answered ? (it.is_correct ? 'ans-correct' : 'ans-wrong') : 'ans-wait'}">
            ${it.answered ? (it.is_correct ? '✓ 正確' : '✗ 錯誤') : '等待中'}
          </strong>
        </div>`).join('')
    : '<div class="host-answer-item wait"><span>尚無玩家</span></div>';

  if (hostAllDoneSkipBtn) {
    hostAllDoneSkipBtn.style.display =
      (total > 0 && done === total) ? 'inline-block' : 'none';
  }
}

function renderHostBreakdown(items = []) {
  if (!hostAnswerBreakdown) return;
  hostAnswerBreakdown.innerHTML = items.length
    ? items.map(it => `
        <div class="breakdown-item">
          <div class="breakdown-left">
            <span class="breakdown-label">${it.label}</span>
            <span class="breakdown-text">${it.text || ''}</span>
          </div>
          <strong class="breakdown-count">${it.count} 人</strong>
        </div>`).join('')
    : '<div class="breakdown-item"><span class="breakdown-label">-</span><span class="breakdown-text">尚無統計</span></div>';
}

/* 房主解析 overlay */
function openHostExplanation({ correctText, explanation, top5 }) {
  if (hostCorrectAnswerText) hostCorrectAnswerText.textContent = correctText || '-';
  if (hostExplanationText)   hostExplanationText.textContent   = explanation || '本題未提供解析。';
  renderTop5(hostResultTop5List, top5 || []);
  if (hostExplanationOverlay) hostExplanationOverlay.classList.add('show');
}

function closeHostExplanation() {
  if (hostExplanationOverlay) hostExplanationOverlay.classList.remove('show');
}

/* ══════════════════════════════════════
   玩家視角
   ══════════════════════════════════════ */
function renderPlayerQuestion(q, answeredCount, totalQuestions) {
  currentQuestion   = q;
  selected          = [];
  hasSubmitted      = false;

  progressText.textContent = `第 ${answeredCount + 1} / ${totalQuestions} 題`;
  const typeLabel = q.type === 'multiple' ? '多選題' : q.type === 'tf' ? '是非題' : '單選題';
  questionKicker.textContent  = `${typeLabel} ・ ${q.time || '20 秒'} ・ ${q.score} 分`;
  questionTitle.textContent   = q.title || `第 ${answeredCount + 1} 題`;
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

  if (submitAnswerBtn) submitAnswerBtn.style.display = 'inline-block';
}

function setSelection(index) {
  if (!currentQuestion || hasSubmitted) return;
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

/* 玩家結果 overlay */
function openPlayerResult({ badge, points, answerText, explanation, top5, myRank, showExactRank }) {
  resultBadge.textContent       = badge;
  earnedScoreText.textContent   = points;
  correctAnswerText.textContent = answerText || '-';
  resultExplanation.textContent = explanation || '本題未提供解析。';
  if (myLiveScoreText) myLiveScoreText.textContent = totalScoreText.textContent;
  renderTop5(resultTop5List, top5 || []);
  if (myRankBox) myRankBox.style.display = (showExactRank && myRank) ? 'block' : 'none';
  if (myRankText && myRank) myRankText.textContent = `你目前第 ${myRank} 名`;
  if (skipExplanationBtn) skipExplanationBtn.style.display = 'none';
  if (nextQuestionBtn)    nextQuestionBtn.style.display    = 'none';
  resultOverlay.classList.add('show');
}

function closePlayerResult() { resultOverlay.classList.remove('show'); }

/* ── 提交答案 ── */
async function submitAnswer(isTimeout = false) {
  if (!currentQuestion || hasSubmitted || isHost) return;
  if (!selected.length && !isTimeout) { showToast('請先選擇答案'); return; }

  hasSubmitted = true;
  stopTimer();
  if (submitAnswerBtn) submitAnswerBtn.style.display = 'none';

  try {
    const data = await api('/submit_answer', {
      method: 'POST',
      body: JSON.stringify({
        pin,
        playerName: getPlayerName(),
        questionId: currentQuestion.question_id,
        selected,
        remainSeconds,
        isTimeout
      })
    });

    totalScoreText.textContent  = data.totalScore ?? 0;
    finishScoreText.textContent = data.totalScore ?? 0;

    openPlayerResult({
      badge:        data.isCorrect ? '🎉 答對了！' : (isTimeout ? '⏰ 時間到！' : '😢 再接再厲'),
      points:       `+${data.pointsEarned || 0}`,
      answerText:   data.answerText || '-',
      explanation:  '已送出，等待房主進入下一題。',
      top5:         data.top5 || [],
      myRank:       data.myRank,
      showExactRank: data.showExactRank
    });

    if (data.isCorrect) window.quizAudio?.success?.(); else window.quizAudio?.fail?.();
  } catch (e) {
    hasSubmitted = false;
    if (submitAnswerBtn) submitAnswerBtn.style.display = 'inline-block';
    showToast(e.message);
  }
}

/* ── 房主結束本題 ── */
async function hostFinishQuestion() {
  if (hostFinishedQuestion) return;
  hostFinishedQuestion = true;
  try {
    await api('/host_finish_question', {
      method: 'POST',
      body: JSON.stringify({ pin, playerName: getPlayerName() })
    });
    await loadState(true);
  } catch (e) { showToast(e.message); hostFinishedQuestion = false; }
}

/* ══════════════════════════════════════
   主狀態機
   ══════════════════════════════════════ */
function handleState(data) {
  const q     = data.nextQuestion;
  const qId   = q?.question_id || null;
  const phase = data.phase || 'question';
  currentPhase = phase;

  /* ─ 題目切換 ─ */
  const qChanged = (qId !== currentQuestionId);
  if (qChanged) {
    currentQuestionId   = qId;
    lastHandledPhaseQid = null;
    hostFinishedQuestion = false;
    closePlayerResult();
    closeHostExplanation();

    if (q) {
      if (isHost) {
        renderHostQuestion(q, data.answeredCount, data.totalQuestions);
        if (phase === 'question') {
          startTimer(parseInt(q.time) || 20, () => {
            showToast('時間到，正在切換到本題統計...');
            hostFinishQuestion();
          });
        }
      } else {
        renderPlayerQuestion(q, data.answeredCount, data.totalQuestions);
        if (phase === 'question') {
          startTimer(parseInt(q.time) || 20, () => submitAnswer(true));
        }
      }
    }
  }

  /* ─ 玩家側邊列表 ─ */
  renderPlayerSideList(data.answerStatus || []);

  /* ─ phase 分支 ─ */
  const phaseKey = `${qId}:${phase}`;

  if (phase === 'question') {
    if (isHost) {
      renderHostAnswerStatus(data.answerStatus || []);
      renderHostBreakdown([]);
      if (!qChanged && !timerInterval && q) {
        // 倒數被中斷後補回（例如重新整理）
        startTimer(remainSeconds || parseInt(q.time) || 20, () => {
          showToast('時間到，正在切換到本題統計...');
          hostFinishQuestion();
        });
      }
    } else {
      if (data.myAnswered && submitAnswerBtn) submitAnswerBtn.style.display = 'none';
    }
    return;
  }

  /* ─ explanation 階段 ─ */
  stopTimer();
  countdownText.textContent = 0;

  if (lastHandledPhaseQid === phaseKey) return;  // 已處理過，不重複開 overlay
  lastHandledPhaseQid = phaseKey;

  if (isHost) {
    renderHostAnswerStatus(data.answerStatus || []);
    renderHostBreakdown(data.answerBreakdown || []);
    openHostExplanation({
      correctText: data.correctAnswerText,
      explanation: data.explanation,
      top5: data.leaderboard?.slice(0, 5) || []
    });
  } else {
    // 玩家：如果已作答就顯示帶解析的 overlay；未作答也給個提示
    openPlayerResult({
      badge:        data.myAnswered
                      ? (data.myResult?.is_correct ? '🎉 答對了！' : '😢 答錯了')
                      : '⏰ 時間到！',
      points:       `+${data.myResult?.points_earned || 0}`,
      answerText:   data.correctAnswerText || '-',
      explanation:  data.explanation || '房主看完解析後會進入下一題。',
      top5:         data.leaderboard?.slice(0, 5) || [],
      myRank:       data.myRank,
      showExactRank: data.showExactRank
    });
    totalScoreText.textContent  = data.totalScore ?? 0;
    finishScoreText.textContent = data.totalScore ?? 0;
  }
}

/* ── main poll ── */
async function loadState(force = false) {
  if (!pin || !getPlayerName()) {
    showToast('缺少玩家資料，返回首頁...');
    setTimeout(() => { window.location.href = 'index.html'; }, 1200);
    return;
  }
  try {
    const data = await api(
      `/player_game_state?pin=${encodeURIComponent(pin)}&playerName=${encodeURIComponent(getPlayerName())}`
    );

    /* topbar */
    roomPinText.textContent    = pin;
    playerNameText.textContent = getPlayerName();
    roleText.textContent       = isHost ? '🎓 房主' : '🎮 玩家';

    /* 房主不需要分數 badge */
    if (scoreBadgePill) scoreBadgePill.style.display = isHost ? 'none' : '';
    if (!isHost) {
      totalScoreText.textContent  = data.totalScore ?? 0;
      finishScoreText.textContent = data.totalScore ?? 0;
    }

    renderLeaderboard(data.leaderboard || []);

    /* 顯示對應的視角 */
    if (hostView)   hostView.style.display   = isHost ? 'block' : 'none';
    if (playerView) playerView.style.display = isHost ? 'none'  : 'block';

    /* 遊戲結束 */
    if (data.finished) {
      if (!gameFinished) showFinishScreen(data);
      return;
    }

    /* 正常遊戲中 */
    if (finishWrap) finishWrap.style.display = 'none';
    handleState(data);

  } catch (e) {
    showToast(e.message);
  }
}

/* ══════════════════════════════════════
   結束畫面
   ══════════════════════════════════════ */
function buildPodiumHTML(leaderboard) {
  const top3 = leaderboard.slice(0, 3);
  while (top3.length < 3) top3.push(null);
  const medals  = ['🥇', '🥈', '🥉'];
  const heights = ['140px', '110px', '85px'];
  const order   = [1, 0, 2];  // 2nd | 1st | 3rd
  return `<div class="podium-row">${order.map(i => {
    const p = top3[i];
    if (!p) return `<div class="podium-col podium-${i + 1}"><div class="podium-stage" style="height:${heights[i]}"></div></div>`;
    return `<div class="podium-col podium-${i + 1}">
      <div class="podium-avatar">${avatarHtml(p, 64)}</div>
      <div class="podium-medal">${medals[i]}</div>
      <div class="podium-name">${p.player_name}</div>
      <div class="podium-score">${p.total_score} 分</div>
      <div class="podium-stage" style="height:${heights[i]}"></div>
    </div>`;
  }).join('')}</div>`;
}

function buildScoreboardHTML(leaderboard) {
  const me = getPlayerName();
  return `<div class="scoreboard-list">${leaderboard.map((p, i) => `
    <div class="sb-row ${p.player_name === me ? 'sb-mine' : ''}">
      <span class="sb-rank">${i + 1}</span>
      <span class="sb-name">${p.player_name}</span>
      <span class="sb-score">${p.total_score} 分</span>
    </div>`).join('')}</div>`;
}

function buildHostDetailHTML(results) {
  if (!results?.length) return '<p>無詳細資料</p>';
  const byPlayer = {};
  results.forEach(r => { if (!byPlayer[r.player_name]) byPlayer[r.player_name] = []; byPlayer[r.player_name].push(r); });
  return Object.entries(byPlayer).map(([name, rows]) => `
    <div class="hd-player-block">
      <div class="hd-player-name">${name}</div>
      <div class="hd-answers">
        ${rows.sort((a, b) => a.seq - b.seq).map(r => {
          const sel = (() => { try { return JSON.parse(r.selected_json || '[]'); } catch { return []; } })();
          const selText = sel.map(i => String.fromCharCode(65 + i)).join(', ') || '未作答';
          return `<div class="hd-answer-item ${r.is_correct ? 'correct' : 'wrong'}">
            <span class="hd-q">第 ${r.seq + 1} 題</span>
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
  stopTimer();
  closePlayerResult();
  closeHostExplanation();
  if (hostView)   hostView.style.display   = 'none';
  if (playerView) playerView.style.display = 'none';
  if (finishWrap) finishWrap.style.display = 'block';

  if (podiumInner) podiumInner.innerHTML = buildPodiumHTML(data.leaderboard || []);
  if (scoreboardWrap) scoreboardWrap.innerHTML = buildScoreboardHTML(data.leaderboard || []);

  if (isHost && hostDetailWrap) {
    try {
      const det = await api(`/host_all_results?pin=${encodeURIComponent(pin)}`);
      hostDetailWrap.innerHTML = buildHostDetailHTML(det.results || []);
      if (hostDetailSection) hostDetailSection.style.display = 'block';
    } catch { hostDetailWrap.innerHTML = '<p>無法載入明細</p>'; }
  }

  if (podiumOverlay) podiumOverlay.style.display = 'flex';
}

/* ── heartbeat / leave ── */
async function sendHeartbeat() {
  if (!pin || !getPlayerName() || hasLeftRoom) return;
  try {
    await fetch('/heartbeat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin, playerName: getPlayerName() })
    });
  } catch (_) {}
}

async function leaveRoom() {
  if (hasLeftRoom) return;
  hasLeftRoom = true;
  try {
    await api('/leave_room', {
      method: 'POST',
      body: JSON.stringify({ pin, playerName: getPlayerName() })
    });
  } catch (_) {}
  finally {
    ['currentRoomPin', 'currentRoomKey', 'roomPlayerProfile', 'pendingJoinContext']
      .forEach(k => localStorage.removeItem(k));
    isInternalNavigation = true;
    window.location.href = 'index.html';
  }
}

function leaveRoomOnUnload() {
  if (!pin || !getPlayerName() || hasLeftRoom || isInternalNavigation) return;
  hasLeftRoom = true;
  navigator.sendBeacon?.(
    '/leave_room',
    new Blob([JSON.stringify({ pin, playerName: getPlayerName() })], { type: 'application/json' })
  );
}

/* ── 事件綁定 ── */
submitAnswerBtn?.addEventListener('click', () => submitAnswer(false));
nextQuestionBtn?.addEventListener('click', closePlayerResult);

/* 房主：「進入下一題」按鈕（在 hostExplanationOverlay 裡） */
hostSkipExplanationBtn?.addEventListener('click', async () => {
  closeHostExplanation();
  try {
    await api('/host_skip_explanation', {
      method: 'POST',
      body: JSON.stringify({ pin, playerName: getPlayerName() })
    });
    await loadState(true);
  } catch (e) { showToast(e.message); }
});

/* 房主：所有人答完快速結束按鈕 */
hostAllDoneSkipBtn?.addEventListener('click', async () => {
  try {
    await api('/host_finish_question', {
      method: 'POST',
      body: JSON.stringify({ pin, playerName: getPlayerName() })
    });
    await loadState(true);
  } catch (e) { showToast(e.message); }
});

/* 頒獎台 → 結算 */
document.getElementById('podiumContinueBtn')?.addEventListener('click', () => {
  if (podiumOverlay) podiumOverlay.style.display = 'none';
  if (scoreboardOverlay) scoreboardOverlay.style.display = 'flex';
});

document.getElementById('backHomeBtn')?.addEventListener('click', leaveRoom);
document.getElementById('leaveGameBtn')?.addEventListener('click', leaveRoom);

window.addEventListener('beforeunload', leaveRoomOnUnload);

/* ── 初始化 ── */
loadState(true);
sendHeartbeat();
setInterval(sendHeartbeat, 5000);
setInterval(() => { if (!hasLeftRoom && !gameFinished) loadState(); }, isHost ? 1800 : 2200);
