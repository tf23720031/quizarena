const roleText = document.getElementById('roleText');
const countdownText = document.getElementById('countdownText');
const hostMonitorBox = document.getElementById('hostMonitorBox');
const hostAnswerStatus = document.getElementById('hostAnswerStatus');
const hostAnswerBreakdown = document.getElementById('hostAnswerBreakdown');
const myLiveScoreText = document.getElementById('myLiveScoreText');
const resultTop5List = document.getElementById('resultTop5List');
const skipExplanationBtn = document.getElementById('skipExplanationBtn');
const nextQuestionBtn = document.getElementById('nextQuestionBtn');
const myRankBox = document.getElementById('myRankBox');
const myRankText = document.getElementById('myRankText');

const toastEl = document.getElementById('toast');
const pin = localStorage.getItem('currentRoomPin') || '';
const playerProfile = JSON.parse(localStorage.getItem('roomPlayerProfile') || '{}');

const roomPinText = document.getElementById('roomPinText');
const playerNameText = document.getElementById('playerNameText');
const totalScoreText = document.getElementById('totalScoreText');
const scoreBadge = totalScoreText ? totalScoreText.closest('.badge-pill') : null;
const finishScoreText = document.getElementById('finishScoreText');

const progressText = document.getElementById('progressText');
const leaderboardList = document.getElementById('leaderboardList');

const questionWrap = document.getElementById('questionWrap');
const finishWrap = document.getElementById('finishWrap');

const questionKicker = document.getElementById('questionKicker');
const questionTitle = document.getElementById('questionTitle');
const questionContent = document.getElementById('questionContent');
const questionImage = document.getElementById('questionImage');
const optionsList = document.getElementById('optionsList');
const submitAnswerBtn = document.getElementById('submitAnswerBtn');

const resultOverlay = document.getElementById('resultOverlay');
const earnedScoreText = document.getElementById('earnedScoreText');
const correctAnswerText = document.getElementById('correctAnswerText');
const resultExplanation = document.getElementById('resultExplanation');
const resultBadge = document.getElementById('resultBadge');

let currentQuestion = null;
let currentQuestionId = null;
let currentPhase = 'question';
let selected = [];
let timer = null;
let remainSeconds = 20;
let hasSubmitted = false;
let hasLeftRoom = false;
let isInternalNavigation = false;
let hostQuestionFinished = false;
let lastOverlayQuestionId = null;

const isHost = !!playerProfile?.isHost;

function getDisplayPlayerName() {
  const profileName = (playerProfile?.name || '').trim();
  const savedPlayerName = (localStorage.getItem('playerName') || '').trim();
  return profileName || savedPlayerName || '玩家';
}

function showToast(message, delay = 2400) {
  toastEl.textContent = message;
  toastEl.classList.add('show');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => {
    toastEl.classList.remove('show');
  }, delay);
}

async function api(url, options = {}) {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });
  const data = await res.json();
  if (!res.ok || data.success === false) {
    throw new Error(data.message || '操作失敗');
  }
  return data;
}

function renderLeaderboard(items = []) {
  const displayName = getDisplayPlayerName();
  leaderboardList.innerHTML = items.length
    ? items.map((item, idx) => `
        <div class="leader-item ${item.player_name === displayName ? 'mine' : ''}">
          <span>${idx + 1}. ${item.player_name}</span>
          <strong>${item.total_score}</strong>
        </div>
      `).join('')
    : '<div class="leader-item"><span>尚無分數資料</span><strong>0</strong></div>';
}

function renderResultTop5(items = []) {
  const displayName = getDisplayPlayerName();
  resultTop5List.innerHTML = items.length
    ? items.map((item, idx) => `
        <div class="result-top5-item ${item.player_name === displayName ? 'mine' : ''}">
          <span>${idx + 1}. ${item.player_name}</span>
          <strong>${item.total_score}</strong>
        </div>
      `).join('')
    : '<div class="result-top5-item"><span>尚無排行資料</span><strong>0</strong></div>';
}

function renderHostStatus(items = []) {
  if (!hostAnswerStatus) return;
  hostAnswerStatus.innerHTML = items.length
    ? items.map(item => `
        <div class="host-answer-item ${item.answered ? 'done' : 'wait'}">
          <span>${item.player_name}</span>
          <strong>${item.answered ? '已作答' : '未作答'}</strong>
        </div>
      `).join('')
    : '<div class="host-answer-item wait"><span>尚無玩家資料</span><strong>-</strong></div>';
}

function renderHostBreakdown(items = []) {
  if (!hostAnswerBreakdown) return;
  hostAnswerBreakdown.innerHTML = items.length
    ? items.map(item => `
        <div class="breakdown-item">
          <div class="breakdown-left">
            <span class="breakdown-label">${item.label}</span>
            <span class="breakdown-text">${item.text || '未命名選項'}</span>
          </div>
          <strong class="breakdown-count">${item.count} 人</strong>
        </div>
      `).join('')
    : '<div class="breakdown-item"><div class="breakdown-left"><span class="breakdown-label">-</span><span class="breakdown-text">尚無作答統計</span></div><strong class="breakdown-count">0</strong></div>';
}

function stopCountdown() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

async function finishQuestionAsHost() {
  if (!isHost || hostQuestionFinished || !currentQuestion) return;
  hostQuestionFinished = true;
  try {
    await api('/host_finish_question', {
      method: 'POST',
      body: JSON.stringify({ pin, playerName: getDisplayPlayerName() })
    });
    await loadState(true);
  } catch (e) {
    showToast(e.message);
  }
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
      if (!isHost && !hasSubmitted) {
        submitAnswer(true);
      }
      if (isHost) {
        showToast('倒數結束，正在切換到本題統計...');
        finishQuestionAsHost();
      }
    }
  }, 1000);
}

function setSelection(index) {
  if (!currentQuestion || isHost || hasSubmitted || currentPhase !== 'question') return;

  if (currentQuestion.type === 'multiple') {
    selected = selected.includes(index)
      ? selected.filter(i => i !== index)
      : [...selected, index].sort((a, b) => a - b);
  } else {
    selected = [index];
  }

  [...document.querySelectorAll('.option-btn')].forEach(btn => {
    btn.classList.toggle('selected', selected.includes(Number(btn.dataset.index)));
  });
}

function renderQuestion(q, answeredCount, totalQuestions) {
  currentQuestion = q;
  selected = [];
  hasSubmitted = false;
  hostQuestionFinished = false;
  progressText.textContent = `第 ${answeredCount + 1} / ${totalQuestions} 題`;
  questionKicker.textContent = `${q.type === 'multiple' ? '多選題' : q.type === 'tf' ? '是非題' : '單選題'} ・ ${q.time || '20 秒'} ・ ${q.score} 分`;
  questionTitle.textContent = q.title || `第 ${answeredCount + 1} 題`;
  questionContent.textContent = q.content || '';

  if (q.image) {
    questionImage.src = q.image;
    questionImage.style.display = 'block';
  } else {
    questionImage.style.display = 'none';
  }

  optionsList.innerHTML = (q.options || []).map((opt, idx) => `
    <button class="option-btn" data-index="${idx}">
      <span class="option-letter">${String.fromCharCode(65 + idx)}</span>
      <span>${opt.text}</span>
    </button>
  `).join('');

  document.querySelectorAll('.option-btn').forEach(btn => {
    btn.addEventListener('click', () => setSelection(Number(btn.dataset.index)));
  });

  if (isHost) {
    optionsList.style.pointerEvents = 'none';
  } else {
    optionsList.style.pointerEvents = '';
  }
}

function updateRankBox(myRank, showExactRank) {
  if (!myRankBox || !myRankText) return;
  if (showExactRank && myRank) {
    myRankBox.style.display = 'block';
    myRankText.textContent = `你目前第 ${myRank} 名`;
  } else {
    myRankBox.style.display = 'none';
    myRankText.textContent = '';
  }
}

function openResultOverlay({ badge, points, answerText, explanation, top5, myRank, showExactRank, hostMode = false }) {
  resultBadge.textContent = badge;
  earnedScoreText.textContent = points;
  correctAnswerText.textContent = answerText || '-';
  resultExplanation.textContent = explanation || '本題未提供解析。';
  renderResultTop5(top5 || []);
  updateRankBox(myRank, showExactRank);

  if (isHost) {
    if (myLiveScoreText?.parentElement) {
      myLiveScoreText.parentElement.style.display = 'none';
    }
    if (nextQuestionBtn) {
      nextQuestionBtn.style.display = 'none';
    }
    if (skipExplanationBtn) {
      skipExplanationBtn.style.display = hostMode ? 'inline-block' : 'none';
    }
  } else {
    if (myLiveScoreText?.parentElement) {
      myLiveScoreText.parentElement.style.display = 'block';
    }
    if (nextQuestionBtn) {
      nextQuestionBtn.style.display = 'none';
    }
    if (skipExplanationBtn) {
      skipExplanationBtn.style.display = 'none';
    }
  }

  resultOverlay.classList.add('show');
}

function closeResultOverlay() {
  resultOverlay.classList.remove('show');
}

async function submitAnswer(isTimeout = false) {
  if (!currentQuestion || hasSubmitted || isHost || currentPhase !== 'question') return;
  if (!selected.length && !isTimeout) {
    showToast('請先選擇答案');
    return;
  }

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
    if (myLiveScoreText) {
      myLiveScoreText.textContent = data.totalScore ?? 0;
    }

    openResultOverlay({
      badge: data.isCorrect ? '答對了！' : (isTimeout ? '時間到！' : '再接再厲'),
      points: `+${data.pointsEarned || 0}`,
      answerText: data.answerText || '-',
      explanation: '已送出答案，等待房主看完本題統計後進入下一題。',
      top5: data.top5 || [],
      myRank: data.myRank,
      showExactRank: data.showExactRank
    });

    if (data.isCorrect) window.quizAudio?.success();
    else window.quizAudio?.fail();
  } catch (e) {
    hasSubmitted = false;
    showToast(e.message);
  }
}

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
  const payload = JSON.stringify({ pin, playerName: getDisplayPlayerName() });
  if (navigator.sendBeacon) {
    navigator.sendBeacon('/leave_room', new Blob([payload], { type: 'application/json' }));
  }
}

function handlePhase(data) {
  currentPhase = data.phase || 'question';
  const questionId = data.nextQuestion?.question_id || null;

  if (questionId !== currentQuestionId) {
    currentQuestionId = questionId;
    lastOverlayQuestionId = null;
    closeResultOverlay();
    if (data.nextQuestion) {
      renderQuestion(data.nextQuestion, data.answeredCount, data.totalQuestions);
      if (currentPhase === 'question') {
        startCountdown(parseInt(data.nextQuestion?.time, 10) || 20);
      } else {
        stopCountdown();
        countdownText.textContent = 0;
      }
    }
  }

  if (currentPhase === 'question') {
    if (!currentQuestionId && data.nextQuestion) {
      currentQuestionId = data.nextQuestion.question_id;
      renderQuestion(data.nextQuestion, data.answeredCount, data.totalQuestions);
      startCountdown(parseInt(data.nextQuestion?.time, 10) || 20);
    }
    if (data.nextQuestion && !timer && !resultOverlay.classList.contains('show')) {
      startCountdown(parseInt(data.nextQuestion?.time, 10) || 20);
    }

    if (isHost) {
      submitAnswerBtn.style.display = 'none';
      if (hostMonitorBox) {
        hostMonitorBox.style.display = 'block';
      }
      renderHostStatus(data.answerStatus || []);
      renderHostBreakdown([]);
    } else {
      submitAnswerBtn.style.display = hasSubmitted ? 'none' : 'inline-block';
      if (hostMonitorBox) {
        hostMonitorBox.style.display = 'none';
      }
    }
    return;
  }

  stopCountdown();
  countdownText.textContent = 0;

  if (isHost) {
    submitAnswerBtn.style.display = 'none';
    if (hostMonitorBox) {
      hostMonitorBox.style.display = 'block';
    }
    renderHostStatus(data.answerStatus || []);
    renderHostBreakdown(data.answerBreakdown || []);
    if (lastOverlayQuestionId !== currentQuestionId) {
      openResultOverlay({
        badge: '本題統計',
        points: `已作答 ${((data.answerStatus || []).filter(x => x.answered).length)} 人`,
        answerText: data.correctAnswerText || '-',
        explanation: data.explanation || '本題沒有解析。',
        top5: data.leaderboard?.slice(0, 5) || [],
        myRank: null,
        showExactRank: false,
        hostMode: true
      });
      lastOverlayQuestionId = currentQuestionId;
    }
  } else {
    submitAnswerBtn.style.display = 'none';
    if (hostMonitorBox) {
      hostMonitorBox.style.display = 'none';
    }
    if (data.myAnswered && lastOverlayQuestionId !== currentQuestionId) {
      openResultOverlay({
        badge: '等待房主下一題',
        points: `+${data.myResult?.points_earned || 0}`,
        answerText: data.correctAnswerText || '-',
        explanation: data.explanation || '房主看完解析後會進入下一題。',
        top5: data.leaderboard?.slice(0, 5) || [],
        myRank: data.myRank,
        showExactRank: data.showExactRank
      });
      lastOverlayQuestionId = currentQuestionId;
    }
  }
}

async function loadState(force = false) {
  if (!pin || !getDisplayPlayerName()) {
    showToast('缺少玩家資料');
    setTimeout(() => { window.location.href = 'index.html'; }, 1000);
    return;
  }

  try {
    const data = await api(`/player_game_state?pin=${encodeURIComponent(pin)}&playerName=${encodeURIComponent(getDisplayPlayerName())}`);
    roomPinText.textContent = pin;
    playerNameText.textContent = getDisplayPlayerName();
    roleText.textContent = isHost ? '房主' : '玩家';

    if (scoreBadge) scoreBadge.style.display = isHost ? 'none' : 'inline-flex';
    if (!isHost) {
      totalScoreText.textContent = data.totalScore ?? 0;
      finishScoreText.textContent = data.totalScore ?? 0;
      if (myLiveScoreText) {
        myLiveScoreText.textContent = data.totalScore ?? 0;
      }
    }

    renderLeaderboard(data.leaderboard || []);

    if (data.finished) {
      stopCountdown();
      questionWrap.style.display = 'none';
      finishWrap.style.display = 'block';
      finishScoreText.textContent = data.totalScore ?? 0;
      closeResultOverlay();
      return;
    }

    questionWrap.style.display = 'block';
    finishWrap.style.display = 'none';
    handlePhase(data);
  } catch (e) {
    showToast(e.message);
  }
}

submitAnswerBtn?.addEventListener('click', () => submitAnswer(false));

nextQuestionBtn?.addEventListener('click', () => {
  closeResultOverlay();
});

skipExplanationBtn?.addEventListener('click', async () => {
  if (!isHost) return;
  try {
    await api('/host_skip_explanation', {
      method: 'POST',
      body: JSON.stringify({ pin, playerName: getDisplayPlayerName() })
    });
    closeResultOverlay();
    loadState(true);
  } catch (e) {
    showToast(e.message);
  }
});

window.addEventListener('beforeunload', leaveRoomOnUnload);

loadState(true);
sendHeartbeat();
setInterval(sendHeartbeat, 5000);
setInterval(() => {
  if (!hasLeftRoom) loadState();
}, isHost ? 1800 : 2200);