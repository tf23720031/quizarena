/* ================================================================
   quiz_game.js
   ─ 房主：看選項(唯讀+正解標記)、監控、全答完可提早結束
   ─ 玩家：選項亂序防作弊、答錯淘汰題→觀戰模式
   ─ 深色模式切換
   ================================================================ */

const toastEl       = document.getElementById('toast');
const pin           = localStorage.getItem('currentRoomPin') || '';
const playerProfile = JSON.parse(localStorage.getItem('roomPlayerProfile') || '{}');
const isHost        = !!playerProfile?.isHost;

/* ── DOM ── */
const roomPinText     = document.getElementById('roomPinText');
const playerNameText  = document.getElementById('playerNameText');
const roleText        = document.getElementById('roleText');
const countdownText   = document.getElementById('countdownText');
const totalScoreText  = document.getElementById('totalScoreText');
const scoreBadgePill  = document.getElementById('scoreBadgePill');
const progressText    = document.getElementById('progressText');
const leaderboardList = document.getElementById('leaderboardList');

/* host */
const hostView               = document.getElementById('hostView');
const hostQuestionKicker     = document.getElementById('hostQuestionKicker');
const hostQuestionTitle      = document.getElementById('hostQuestionTitle');
const hostQuestionContent    = document.getElementById('hostQuestionContent');
const hostQuestionImage      = document.getElementById('hostQuestionImage');
const hostOptionsList        = document.getElementById('hostOptionsList');
const hostAnswerStatus       = document.getElementById('hostAnswerStatus');
const hostAnswerBreakdown    = document.getElementById('hostAnswerBreakdown');
const hostAllDoneSkipBtn     = document.getElementById('hostAllDoneSkipBtn');
const hostExplanationOverlay = document.getElementById('hostExplanationOverlay');
const hostCorrectAnswerText  = document.getElementById('hostCorrectAnswerText');
const hostExplanationText    = document.getElementById('hostExplanationText');
const hostResultTop5List     = document.getElementById('hostResultTop5List');
const hostEliminatedList     = document.getElementById('hostEliminatedList');
const hostEliminatedNames    = document.getElementById('hostEliminatedNames');
const hostSkipExplanationBtn = document.getElementById('hostSkipExplanationBtn');

/* player */
const playerView      = document.getElementById('playerView');
const questionKicker  = document.getElementById('questionKicker');
const questionTitle   = document.getElementById('questionTitle');
const questionContent = document.getElementById('questionContent');
const questionImage   = document.getElementById('questionImage');
const optionsList     = document.getElementById('optionsList');
const fillAnswerWrap  = document.getElementById('fillAnswerWrap');
const fillAnswerInput = document.getElementById('fillAnswerInput');
const submitAnswerBtn = document.getElementById('submitAnswerBtn');
const teamQuestionSelectWrap = document.getElementById('teamQuestionSelectWrap');
const teamQuestionSelect = document.getElementById('teamQuestionSelect');

/* spectator */
const spectatorView        = document.getElementById('spectatorView');
const spectatorQuestionBox = document.getElementById('spectatorQuestionBox');
const spectatorKicker      = document.getElementById('spectatorKicker');
const spectatorTitle       = document.getElementById('spectatorTitle');
const spectatorContent     = document.getElementById('spectatorContent');
const spectatorImage       = document.getElementById('spectatorImage');
const spectatorOptionsList = document.getElementById('spectatorOptionsList');

/* result overlay */
const resultOverlay      = document.getElementById('resultOverlay');
const resultBadge        = document.getElementById('resultBadge');
const earnedScoreText    = document.getElementById('earnedScoreText');
const correctAnswerText  = document.getElementById('correctAnswerText');
const resultExplanation  = document.getElementById('resultExplanation');
const myLiveScoreText    = document.getElementById('myLiveScoreText');
const myRankBox          = document.getElementById('myRankBox');
const myRankText         = document.getElementById('myRankText');
const resultTop5List     = document.getElementById('resultTop5List');
const eliminatedNotice   = document.getElementById('eliminatedNotice');
const nextQuestionBtn    = document.getElementById('nextQuestionBtn');

/* finish */
const finishWrap        = document.getElementById('finishWrap');
const finishScoreText   = document.getElementById('finishScoreText');
const podiumOverlay     = document.getElementById('podiumOverlay');
const podiumInner       = document.getElementById('podiumInner');
const scoreboardOverlay = document.getElementById('scoreboardOverlay');
const scoreboardWrap    = document.getElementById('scoreboardWrap');
const hostDetailSection = document.getElementById('hostDetailSection');
const hostDetailWrap    = document.getElementById('hostDetailWrap');
const playerSideList    = document.getElementById('playerSideList');
const teamChatBox       = document.getElementById('teamChatBox');
const teamChatList      = document.getElementById('teamChatList');
const teamChatForm      = document.getElementById('teamChatForm');
const teamChatInput     = document.getElementById('teamChatInput');
/* ── state ── */
let currentQuestion      = null;
let currentQuestionId    = null;
let currentPhase         = 'question';
let selected             = [];
let shuffleMap           = [];
let timerInterval        = null;
let remainSeconds        = 0;
let hasSubmitted         = false;
let isEliminated         = false;
let hasLeftRoom          = false;
let isInternalNavigation = false;
let gameFinished         = false;
let lastHandledPhaseQid  = null;
let hostFinishedQuestion = false;
let isTeamMode           = false;
let myTeamId             = 0;
let latestTeamMsgCount   = 0;
let teamPlayMode         = 'classic';
let appliedRoomTheme     = '';

const getPlayerName = () => (playerProfile?.name || '').trim();

/* ── helpers ── */
function showToast(msg, delay = 2600) {
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => toastEl.classList.remove('show'), delay);
}

function applyRoomTheme(room = {}) {
  const theme = room.room_theme || room.roomTheme || 'classic';
  const music = room.music_theme || room.musicTheme || 'spark';
  if (appliedRoomTheme === `${theme}:${music}`) return;
  appliedRoomTheme = `${theme}:${music}`;
  document.body.dataset.roomTheme = theme;
  localStorage.setItem('quizMusicTheme', music);
  window.AudioManager?.setTheme?.(music);
}

async function api(url, opts = {}) {
  const res  = await fetch(url, { headers: { 'Content-Type': 'application/json' }, ...opts });
  const data = await res.json();
  if (!res.ok || data.success === false) throw new Error(data.message || '操作失敗');
  return data;
}

function avatarHtml(p, size = 48) {
  const face = p.face || 'images/face/face.png';
  const hair = p.hair || 'images/hair/hair01.png';
  const eyes = p.eyes || 'images/face/eyes01.png';
  const oy   = Number(p.eyes_offset_y ?? p.eyesOffsetY ?? 0);
  return `<div class="mini-avatar" style="width:${size}px;height:${size}px;">
    <img src="${face}" class="ma-layer ma-face">
    <img src="${eyes}" class="ma-layer ma-eyes" style="transform:translateX(-50%) translateY(${oy}px)">
    <img src="${hair}" class="ma-layer ma-hair">
  </div>`;
}

/* ══════════════════════════════════════
   語言 / 即時翻譯
   ══════════════════════════════════════ */
const LANG_DICT = {
  zh: {
    role_host: '🎓 房主', role_player: '🎮 玩家', role_spectator: '💀 觀戰',
    progress: (cur, total) => `第 ${cur} / ${total} 題`,
    leaderboard: '🏅 排行榜', no_data: '尚無資料',
    players_panel: '玩家', single: '單選題', multiple: '多選題', tf: '是非題',
    submit: '提交答案', leave: '離開',
    waiting_host: '等待房主...',
    correct_badge: '🎉 答對了！', wrong_badge: '😢 答錯了',
    eliminated_badge: '💀 淘汰！', timeout_badge: '⏰ 時間到！',
    pts_zeroed: '積分歸零', next_q: '繼續觀戰',
    explanation_wait: '等待房主進入下一題。',
    host_next: '進入下一題', all_answered: '所有人已作答，結束本題',
    spectator_hint: '你已被淘汰，目前為觀戰模式',
    finish_title: '🎉 遊戲結束！', finish_sub: '感謝參與，最終結果請見結算頁面。',
    finish_score: '你的總分：', podium_title: '🏆 遊戲結束！最終排名',
    scoreboard_title: '📊 完整結算', back_home: '回首頁',
    correct_answer: '正解：', rank_prefix: '你目前第', rank_suffix: '名',
    score_prefix: '目前總分：', earned_prefix: '本題得分：',
    eliminated_notice: '你已被淘汰！積分歸零，進入觀戰模式。',
    breakdown_title: '本題各選項統計', answer_status_title: '玩家答題狀況',
    correct_mark: '✓ 正確', wrong_mark: '✗ 錯誤', waiting_mark: '等待中', eliminated_mark: '💀 已淘汰',
    top5_title: '目前前五名', host_result_title: '📊 本題結果',
    host_eliminated_title: '💀 本題淘汰玩家',
  },
  en: {
    role_host: '🎓 Host', role_player: '🎮 Player', role_spectator: '💀 Spectator',
    progress: (cur, total) => `Q ${cur} / ${total}`,
    leaderboard: '🏅 Leaderboard', no_data: 'No data yet',
    players_panel: 'Players', single: 'Single Choice', multiple: 'Multiple Choice', tf: 'True/False',
    submit: 'Submit Answer', leave: 'Leave',
    waiting_host: 'Waiting for host...',
    correct_badge: '🎉 Correct!', wrong_badge: '😢 Wrong!',
    eliminated_badge: '💀 Eliminated!', timeout_badge: '⏰ Time Up!',
    pts_zeroed: 'Score reset to 0', next_q: 'Keep Watching',
    explanation_wait: 'Waiting for host to advance.',
    host_next: 'Next Question', all_answered: 'All answered — end question',
    spectator_hint: 'You are eliminated. Spectating now.',
    finish_title: '🎉 Game Over!', finish_sub: 'Thanks for playing!',
    finish_score: 'Your score: ', podium_title: '🏆 Final Rankings',
    scoreboard_title: '📊 Full Scoreboard', back_home: 'Home',
    correct_answer: 'Answer: ', rank_prefix: 'You are #', rank_suffix: '',
    score_prefix: 'Score: ', earned_prefix: 'Points: ',
    eliminated_notice: 'You are eliminated! Score reset to 0.',
    breakdown_title: 'Option Stats', answer_status_title: 'Player Status',
    correct_mark: '✓ Correct', wrong_mark: '✗ Wrong', waiting_mark: 'Waiting', eliminated_mark: '💀 Out',
    top5_title: 'Top 5', host_result_title: '📊 Result',
    host_eliminated_title: '💀 Eliminated this round',
  },
  ja: {
    role_host: '🎓 ホスト', role_player: '🎮 プレイヤー', role_spectator: '💀 観戦中',
    progress: (cur, total) => `第 ${cur} / ${total} 問`,
    leaderboard: '🏅 ランキング', no_data: 'データなし',
    players_panel: 'プレイヤー', single: '単一選択', multiple: '複数選択', tf: '○×問題',
    submit: '回答する', leave: '退出',
    waiting_host: 'ホストを待っています...',
    correct_badge: '🎉 正解！', wrong_badge: '😢 不正解',
    eliminated_badge: '💀 脱落！', timeout_badge: '⏰ 時間切れ！',
    pts_zeroed: 'スコアリセット', next_q: '観戦を続ける',
    explanation_wait: '次の問題をお待ちください。',
    host_next: '次の問題へ', all_answered: '全員回答済み — 終了',
    spectator_hint: '脱落しました。観戦モードです。',
    finish_title: '🎉 ゲーム終了！', finish_sub: 'ご参加ありがとうございました！',
    finish_score: '合計スコア：', podium_title: '🏆 最終順位',
    scoreboard_title: '📊 全スコア', back_home: 'ホームへ',
    correct_answer: '正解：', rank_prefix: '現在', rank_suffix: '位',
    score_prefix: '現在スコア：', earned_prefix: '獲得ポイント：',
    eliminated_notice: '脱落！スコアがリセットされました。',
    breakdown_title: '選択肢の統計', answer_status_title: 'プレイヤーの状況',
    correct_mark: '✓ 正解', wrong_mark: '✗ 不正解', waiting_mark: '待機中', eliminated_mark: '💀 脱落',
    top5_title: 'トップ5', host_result_title: '📊 結果',
    host_eliminated_title: '💀 今回の脱落者',
  },
  ko: {
    role_host: '🎓 호스트', role_player: '🎮 플레이어', role_spectator: '💀 관전 중',
    progress: (cur, total) => `${cur} / ${total} 문제`,
    leaderboard: '🏅 순위표', no_data: '데이터 없음',
    players_panel: '플레이어', single: '단일 선택', multiple: '다중 선택', tf: '참/거짓',
    submit: '제출', leave: '나가기',
    waiting_host: '호스트를 기다리는 중...',
    correct_badge: '🎉 정답!', wrong_badge: '😢 오답',
    eliminated_badge: '💀 탈락!', timeout_badge: '⏰ 시간 초과!',
    pts_zeroed: '점수 초기화', next_q: '계속 관전',
    explanation_wait: '호스트가 다음 문제로 넘어갈 때까지 기다려 주세요.',
    host_next: '다음 문제', all_answered: '모두 답변 완료 — 종료',
    spectator_hint: '탈락했습니다. 관전 모드입니다.',
    finish_title: '🎉 게임 종료!', finish_sub: '참여해 주셔서 감사합니다!',
    finish_score: '총점: ', podium_title: '🏆 최종 순위',
    scoreboard_title: '📊 전체 점수', back_home: '홈으로',
    correct_answer: '정답: ', rank_prefix: '현재 ', rank_suffix: '위',
    score_prefix: '현재 점수: ', earned_prefix: '획득 점수: ',
    eliminated_notice: '탈락했습니다! 점수가 초기화되었습니다.',
    breakdown_title: '선택지 통계', answer_status_title: '플레이어 현황',
    correct_mark: '✓ 정답', wrong_mark: '✗ 오답', waiting_mark: '대기 중', eliminated_mark: '💀 탈락',
    top5_title: '상위 5명', host_result_title: '📊 결과',
    host_eliminated_title: '💀 이번 라운드 탈락자',
  },
  es: {
    role_host: '🎓 Anfitrión', role_player: '🎮 Jugador', role_spectator: '💀 Espectador',
    progress: (cur, total) => `Pregunta ${cur} / ${total}`,
    leaderboard: '🏅 Clasificación', no_data: 'Sin datos',
    players_panel: 'Jugadores', single: 'Selección única', multiple: 'Selección múltiple', tf: 'V/F',
    submit: 'Enviar', leave: 'Salir',
    waiting_host: 'Esperando al anfitrión...',
    correct_badge: '🎉 ¡Correcto!', wrong_badge: '😢 Incorrecto',
    eliminated_badge: '💀 ¡Eliminado!', timeout_badge: '⏰ ¡Tiempo!',
    pts_zeroed: 'Puntos a 0', next_q: 'Seguir viendo',
    explanation_wait: 'Esperando al anfitrión.',
    host_next: 'Siguiente', all_answered: 'Todos respondieron — finalizar',
    spectator_hint: 'Estás eliminado. Modo espectador.',
    finish_title: '🎉 ¡Fin del juego!', finish_sub: '¡Gracias por jugar!',
    finish_score: 'Tu puntuación: ', podium_title: '🏆 Clasificación final',
    scoreboard_title: '📊 Puntuación completa', back_home: 'Inicio',
    correct_answer: 'Respuesta: ', rank_prefix: 'Posición ', rank_suffix: '',
    score_prefix: 'Puntuación: ', earned_prefix: 'Puntos: ',
    eliminated_notice: '¡Eliminado! Puntos a cero.',
    breakdown_title: 'Estadísticas', answer_status_title: 'Estado jugadores',
    correct_mark: '✓ Correcto', wrong_mark: '✗ Incorrecto', waiting_mark: 'Esperando', eliminated_mark: '💀 Eliminado',
    top5_title: 'Top 5', host_result_title: '📊 Resultado',
    host_eliminated_title: '💀 Eliminados esta ronda',
  }
};

let currentLang = localStorage.getItem('quizLang') || 'zh';
const t = (key, ...args) => {
  const d = LANG_DICT[currentLang] || LANG_DICT.zh;
  const val = d[key] ?? LANG_DICT.zh[key] ?? key;
  return typeof val === 'function' ? val(...args) : val;
};

function applyLang(lang) {
  currentLang = lang;
  localStorage.setItem('quizLang', lang);
  // 更新靜態 DOM 文字
  const el = (id) => document.getElementById(id);
  if (submitAnswerBtn) submitAnswerBtn.textContent = t('submit');
  const leave = el('leaveGameBtn');
  if (leave) leave.innerHTML = `<i class="fa-solid fa-right-from-bracket"></i> ${t('leave')}`;
  const pspTitle = document.querySelector('.psp-title');
  if (pspTitle) pspTitle.innerHTML = `<i class="fa-solid fa-users"></i> ${t('players_panel')}`;
  const ldTitle = document.querySelector('.leaderboard-title');
  if (ldTitle) ldTitle.textContent = t('leaderboard');
  if (hostAllDoneSkipBtn) hostAllDoneSkipBtn.innerHTML = `<i class="fa-solid fa-forward-step"></i> ${t('all_answered')}`;
  if (hostSkipExplanationBtn) hostSkipExplanationBtn.innerHTML = `<i class="fa-solid fa-forward"></i> ${t('host_next')}`;
  const backBtn = el('backHomeBtn');
  if (backBtn) backBtn.innerHTML = `<i class="fa-solid fa-house"></i> ${t('back_home')}`;
  if (roleText) roleText.textContent = isHost ? t('role_host') : (isEliminated ? t('role_spectator') : t('role_player'));
}

const langSelect = document.getElementById('langSelect');
langSelect?.addEventListener('change', () => { applyLang(langSelect.value); });
if (langSelect) langSelect.value = currentLang;

/* ══════════════════════════════════════
   深色模式
   ══════════════════════════════════════ */
const darkBtn  = document.getElementById('darkModeBtn');
const darkIcon = document.getElementById('darkModeIcon');

function applyDark(on) {
  document.body.classList.toggle('dark-mode', on);
  if (darkIcon) {
    darkIcon.className = on ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
  }
  localStorage.setItem('quizDarkMode', on ? '1' : '0');
}

darkBtn?.addEventListener('click', () => applyDark(!document.body.classList.contains('dark-mode')));
applyDark(localStorage.getItem('quizDarkMode') === '1');

/* ── 靜音按鈕 ── */
const muteBtn  = document.getElementById('muteBtn');
const muteIcon = document.getElementById('muteIcon');
function applyMute(muted) {
  AudioManager?.setMute(muted);
  if (muteIcon) muteIcon.className = muted ? 'fa-solid fa-volume-xmark' : 'fa-solid fa-volume-high';
  localStorage.setItem('quizMuted', muted ? '1' : '0');
}
muteBtn?.addEventListener('click', () => {
  const nowMuted = !AudioManager?.isMuted();
  applyMute(nowMuted);
  AudioManager?.click();
});
applyMute(localStorage.getItem('quizMuted') === '1');

/* ══════════════════════════════════════
   選項亂序（防作弊）
   ══════════════════════════════════════ */
function seededShuffle(arr, seed) {
  let s = seed >>> 0;
  const rand = () => { s ^= s << 13; s ^= s >> 17; s ^= s << 5; return (s >>> 0) / 4294967296; };
  const r = arr.slice();
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [r[i], r[j]] = [r[j], r[i]];
  }
  return r;
}

function strToSeed(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

function buildShuffleMap(options, questionId) {
  if (isHost) return options.map((_, i) => i);
  const seed = strToSeed(getPlayerName() + '|' + questionId);
  return seededShuffle(options.map((_, i) => i), seed);
}

/* ── 倒數 ── */
const stopTimer = () => { clearInterval(timerInterval); timerInterval = null; };

function startTimer(seconds, onEnd) {
  stopTimer();
  remainSeconds = Number(seconds) || 20;
  if (countdownText) countdownText.textContent = remainSeconds;
  timerInterval = setInterval(() => {
    remainSeconds = Math.max(0, remainSeconds - 1);
    if (countdownText) countdownText.textContent = remainSeconds;
    if (remainSeconds > 0 && remainSeconds <= 5 && !isHost && !isEliminated) {
      if (remainSeconds === 3) AudioManager?.countdown3();
      else AudioManager?.tick(remainSeconds <= 2);
    }
    if (remainSeconds <= 0) { stopTimer(); onEnd?.(); }
  }, 1000);
}

function getQuestionSeconds(q) {
  return parseInt(String(q?.time || q?.time_label || '20').replace(/[^0-9]/g, ''), 10) || 20;
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

function renderTop5(el, items = []) {
  if (!el) return;
  const me = getPlayerName();
  el.innerHTML = items.length
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
  const players = answerStatus.filter(p => !p.is_host);
  if (!players.length) { playerSideList.innerHTML = ''; return; }
  playerSideList.innerHTML = players.map(p => {
    const eliminated = p.is_eliminated;
    let icon = '<i class="fa-solid fa-ellipsis" style="color:#bbb"></i>';
    if (eliminated) {
      icon = '<i class="fa-solid fa-skull" style="color:#c03030"></i>';
    } else if (p.answered) {
      icon = p.is_correct
        ? '<i class="fa-solid fa-check" style="color:#5cb85c"></i>'
        : '<i class="fa-solid fa-xmark" style="color:#e05050"></i>';
    }
    return `<div class="psl-item ${p.answered ? 'done' : 'wait'} ${eliminated ? 'eliminated' : ''}">
      ${avatarHtml(p, 36)}
      <span class="psl-name">${p.player_name}</span>
      <span class="psl-icon">${icon}</span>
    </div>`;
  }).join('');
}

function updateHostAllDoneButton(answerStatus = []) {
  if (!hostAllDoneSkipBtn) return;
  const activePlayers = (answerStatus || []).filter(p => !p.is_host && !p.is_eliminated);
  const allAnswered = activePlayers.length > 0 && activePlayers.every(p => !!p.answered);
  hostAllDoneSkipBtn.style.display = (isHost && currentPhase === 'question' && allAnswered) ? 'inline-block' : 'none';
}

function setupTeamChatUI(data) {
  isTeamMode = !!data.isTeamMode;
  myTeamId   = Number(data.myTeamId || 0);
  teamPlayMode = String(data.teamPlayMode || 'classic');
  const canUseTeamChat = isTeamMode && !isHost && myTeamId > 0;
  if (teamChatBox) teamChatBox.style.display = canUseTeamChat ? 'block' : 'none';
  if (!canUseTeamChat && teamChatList) {
    teamChatList.innerHTML = '';
    latestTeamMsgCount = 0;
  }
}
function setupTeamQuestionPicker(data) {
  const isFreeAssign = isTeamMode && teamPlayMode === 'free_assign' && !isHost;
  if (!teamQuestionSelectWrap || !teamQuestionSelect) return null;
  teamQuestionSelectWrap.style.display = isFreeAssign ? 'block' : 'none';
  if (!isFreeAssign) return null;

  const statusList = data.teamQuestionStatus || [];
  const questionMap = Object.fromEntries((data.allQuestions || []).map((q) => [q.question_id, q]));
  const unanswered = statusList.find((s) => !s.submitted);
  const candidateId = teamQuestionSelect.value || unanswered?.question_id || statusList[0]?.question_id;

  teamQuestionSelect.innerHTML = statusList.map((s) => {
    const doneTag = s.submitted ? `✅ ${s.submitter || '已作答'}` : '🕒 未作答';
    return `<option value="${s.question_id}">第 ${Number(s.seq || 0) + 1} 題｜${s.title || ''}｜${doneTag}</option>`;
  }).join('');
  if (candidateId) teamQuestionSelect.value = candidateId;
  return questionMap[teamQuestionSelect.value] || null;
}


function renderTeamMessages(messages = []) {
  if (!teamChatList) return;
  if (!messages.length) {
    teamChatList.innerHTML = '<div class="team-chat-item">目前沒有隊伍訊息</div>';
    latestTeamMsgCount = 0;
    return;
  }
  teamChatList.innerHTML = messages.map(m => `
    <div class="team-chat-item">
      <div class="team-chat-head">
        <span>${m.sender_name || '-'}</span>
        <span>${new Date((m.created_at || Date.now() / 1000) * 1000).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })}</span>
      </div>
      <div class="team-chat-msg">${m.message || ''}</div>
    </div>
  `).join('');
  if (messages.length > latestTeamMsgCount) {
    teamChatList.scrollTop = teamChatList.scrollHeight;
  }
  latestTeamMsgCount = messages.length;
}

async function loadTeamMessages() {
  if (!isTeamMode || isHost || myTeamId <= 0 || !pin) return;
  try {
    const data = await api(`/team_messages?pin=${encodeURIComponent(pin)}&teamId=${encodeURIComponent(myTeamId)}`);
    renderTeamMessages(data.messages || []);
  } catch (e) {
    console.warn('[team_messages] load failed:', e.message);
  }
}
/* ══════════════════════════════════════
   房主視角
   ══════════════════════════════════════ */
function renderHostQuestion(q, answeredCount, totalQuestions) {
  progressText.textContent = `第 ${answeredCount + 1} / ${totalQuestions} 題`;
  const typeLabel = q.type === 'multiple' ? '多選題' : q.type === 'tf' ? '是非題' : q.type === 'fill' ? '填充題' : '單選題';
  const isFake    = q.fake_answer ? ' ⚠️ 淘汰題' : '';
  hostQuestionKicker.textContent  = `${typeLabel} ・ ${q.time || '20 秒'} ・ ${q.score} 分${isFake}`;
  hostQuestionTitle.textContent   = q.title || `第 ${answeredCount + 1} 題`;
  hostQuestionContent.textContent = q.content || '';

  if (q.image) { hostQuestionImage.src = q.image; hostQuestionImage.style.display = 'block'; }
  else { hostQuestionImage.style.display = 'none'; }

  if (hostOptionsList) {
    const correctIndexes = q.correct_indexes || [];
    if (q.type === 'matching') {
      hostOptionsList.innerHTML = (q.options || []).map((opt, idx) => `
        <div class="option-btn host-option host-correct-option">
          <span class="option-letter">${idx + 1}</span>
          <span>${opt.left || opt.text || ''} → ${opt.right || ''}</span>
          <span class="correct-tag">配對</span>
        </div>`).join('');
      return;
    }
    hostOptionsList.innerHTML = (q.options || []).map((opt, idx) => {
      const ok = correctIndexes.includes(idx);
      return `<div class="option-btn host-option ${ok ? 'host-correct-option' : ''}">
        <span class="option-letter">${String.fromCharCode(65 + idx)}</span>
        <span>${opt.text}</span>
        ${ok ? '<span class="correct-tag">✓ 正解</span>' : ''}
      </div>`;
    }).join('');
  }
}

function renderHostAnswerStatus(items = [], eliminatedThisRound = []) {
  if (!hostAnswerStatus) return;
  const players = items.filter(p => !p.is_host);
  const active  = players.filter(p => !p.is_eliminated);
  const done    = active.filter(x => x.answered).length;
  const total   = active.length;

  hostAnswerStatus.innerHTML = players.length
    ? players.map(it => `
        <div class="host-answer-item ${it.is_eliminated ? 'eliminated-item' : it.answered ? 'done' : 'wait'}">
          ${avatarHtml(it, 34)}
          <span>${it.player_name}</span>
          <strong class="${it.is_eliminated ? 'ans-wrong' : it.answered ? (it.is_correct ? 'ans-correct' : 'ans-wrong') : 'ans-wait'}">
            ${it.is_eliminated ? '💀 已淘汰' : it.answered ? (it.is_correct ? '✓ 正確' : '✗ 錯誤') : '等待中'}
          </strong>
        </div>`).join('')
    : '<div class="host-answer-item wait"><span>尚無玩家</span></div>';

  updateHostAllDoneButton(items);

  /* 顯示本題淘汰名單 */
  if (hostEliminatedList && hostEliminatedNames) {
    if (eliminatedThisRound.length) {
      hostEliminatedNames.innerHTML = eliminatedThisRound.map(n => `<span style="margin-right:8px">💀 ${n}</span>`).join('');
      hostEliminatedList.style.display = 'block';
    } else {
      hostEliminatedList.style.display = 'none';
    }
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
    : '<div class="breakdown-item"><span class="breakdown-text">尚無統計</span></div>';
}

function openHostExplanation({ correctText, explanation, top5, eliminatedNames = [] }) {
  if (hostCorrectAnswerText) hostCorrectAnswerText.textContent = correctText || '-';
  if (hostExplanationText)   hostExplanationText.textContent   = explanation || '本題未提供解析。';
  renderTop5(hostResultTop5List, top5 || []);
  if (hostEliminatedList && hostEliminatedNames) {
    if (eliminatedNames.length) {
      hostEliminatedNames.innerHTML = eliminatedNames.map(n => `<span style="margin:0 6px">💀 ${n}</span>`).join('');
      hostEliminatedList.style.display = 'block';
    } else {
      hostEliminatedList.style.display = 'none';
    }
  }
  hostExplanationOverlay?.classList.add('show');
  AudioManager?.reveal();
}

const closeHostExplanation = () => hostExplanationOverlay?.classList.remove('show');

/* ══════════════════════════════════════
   玩家視角（選項亂序）
   ══════════════════════════════════════ */
function renderPlayerQuestion(q, answeredCount, totalQuestions) {
  currentQuestion = q;
  selected        = [];
  hasSubmitted    = false;

  progressText.textContent = `第 ${answeredCount + 1} / ${totalQuestions} 題`;
  const typeLabel = q.type === 'multiple' ? '多選題' : q.type === 'tf' ? '是非題' : q.type === 'fill' ? '填充題' : '單選題';
  const fakeBadge = q.fake_answer ? ' ⚠️ 淘汰題' : '';
  questionKicker.textContent  = `${typeLabel} ・ ${q.time || '20 秒'} ・ ${q.score} 分${fakeBadge}`;
  questionTitle.textContent   = q.title || `第 ${answeredCount + 1} 題`;
  questionContent.textContent = q.content || '';

  if (q.image) { questionImage.src = q.image; questionImage.style.display = 'block'; }
  else { questionImage.style.display = 'none'; }

  if (q.type === 'matching') {
    if (fillAnswerWrap) fillAnswerWrap.style.display = 'none';
    const rights = buildShuffleMap(q.options || [], `${q.question_id}:matching`).map((origIdx) => ({
      origIdx,
      text: (q.options || [])[origIdx]?.right || (q.options || [])[origIdx]?.text || ''
    }));
    optionsList.innerHTML = `<div class="matching-play-grid">
      ${(q.options || []).map((opt, leftIdx) => `
        <label class="matching-play-row">
          <span>${leftIdx + 1}. ${opt.left || opt.text || ''}</span>
          <select class="form-select matching-select" data-left="${leftIdx}">
            <option value="">選擇右側答案</option>
            ${rights.map((right) => `<option value="${right.origIdx}">${right.text}</option>`).join('')}
          </select>
        </label>
      `).join('')}
    </div>`;
    document.querySelectorAll('.matching-select').forEach((select) => {
      select.addEventListener('change', () => {
        selected = [...document.querySelectorAll('.matching-select')].map((item) => Number(item.value));
      });
    });
  } else if (q.type === 'fill') {
    optionsList.innerHTML = '';
    if (fillAnswerWrap) fillAnswerWrap.style.display = 'block';
    if (fillAnswerInput) {
      fillAnswerInput.value = '';
      fillAnswerInput.disabled = false;
    }
  } else {
    if (fillAnswerWrap) fillAnswerWrap.style.display = 'none';
    shuffleMap = buildShuffleMap(q.options || [], q.question_id);
    optionsList.innerHTML = shuffleMap.map((origIdx, displayPos) => {
      const opt = (q.options || [])[origIdx];
      return `<button class="option-btn" data-orig="${origIdx}" data-pos="${displayPos}">
        <span class="option-letter">${String.fromCharCode(65 + displayPos)}</span>
        <span>${opt?.text || ''}</span>
      </button>`;
    }).join('');

    document.querySelectorAll('#optionsList .option-btn').forEach(btn =>
      btn.addEventListener('click', () => toggleOption(Number(btn.dataset.orig)))
    );
  }

  if (submitAnswerBtn) submitAnswerBtn.style.display = 'inline-block';
}

/* 觀戰者的題目顯示（唯讀，不能選） */
function renderSpectatorQuestion(q, answeredCount, totalQuestions) {
  if (!spectatorQuestionBox) return;
  progressText.textContent = `第 ${answeredCount + 1} / ${totalQuestions} 題（觀戰）`;
  const typeLabel = q.type === 'multiple' ? '多選題' : q.type === 'tf' ? '是非題' : q.type === 'fill' ? '填充題' : '單選題';
  if (spectatorKicker)  spectatorKicker.textContent  = `${typeLabel} ・ ${q.time || '20 秒'}`;
  if (spectatorTitle)   spectatorTitle.textContent   = q.title || '';
  if (spectatorContent) spectatorContent.textContent = q.content || '';
  if (spectatorImage) {
    if (q.image) { spectatorImage.src = q.image; spectatorImage.style.display = 'block'; }
    else { spectatorImage.style.display = 'none'; }
  }
  if (spectatorOptionsList) {
    spectatorOptionsList.innerHTML = (q.options || []).map((opt, idx) =>
      `<div class="option-btn">
        <span class="option-letter">${String.fromCharCode(65 + idx)}</span>
        <span>${opt.text}</span>
      </div>`
    ).join('');
  }
  spectatorQuestionBox.style.display = 'block';
}

function toggleOption(origIdx) {
  if (!currentQuestion || hasSubmitted || isEliminated) return;
  if (currentQuestion.type === 'multiple') {
    selected = selected.includes(origIdx)
      ? selected.filter(i => i !== origIdx)
      : [...selected, origIdx].sort((a, b) => a - b);
  } else {
    selected = [origIdx];
  }
  document.querySelectorAll('#optionsList .option-btn').forEach(btn =>
    btn.classList.toggle('selected', selected.includes(Number(btn.dataset.orig)))
  );
}

/* 解析階段顯示正解/錯選顏色 */
function revealOptions(correctIndexes, mySelected) {
  document.querySelectorAll('#optionsList .option-btn').forEach(btn => {
    const orig = Number(btn.dataset.orig);
    if (correctIndexes.includes(orig)) {
      btn.classList.add('correct-reveal');
    } else if (mySelected.includes(orig)) {
      btn.classList.add('wrong-reveal');
    }
  });
}

function openPlayerResult({ badge, points, answerText, explanation, top5, myRank, showExactRank, eliminated }) {
  resultBadge.textContent       = badge;
  earnedScoreText.textContent   = points;
  correctAnswerText.textContent = answerText || '-';
  resultExplanation.textContent = explanation || '本題未提供解析。';
  if (myLiveScoreText) myLiveScoreText.textContent = totalScoreText.textContent;
  renderTop5(resultTop5List, top5 || []);
  if (myRankBox) myRankBox.style.display = (showExactRank && myRank) ? 'block' : 'none';
  if (myRankText && myRank) myRankText.textContent = `你目前第 ${myRank} 名`;
  if (eliminatedNotice) eliminatedNotice.style.display = eliminated ? 'flex' : 'none';
  if (nextQuestionBtn) nextQuestionBtn.style.display = eliminated ? 'inline-block' : 'none';
  resultOverlay.classList.add('show');
  AudioManager?.reveal();
}

const closePlayerResult = () => resultOverlay?.classList.remove('show');

/* ── 提交答案 ── */
async function submitAnswer(isTimeout = false) {
  if (!currentQuestion || hasSubmitted || isHost || isEliminated) return;
  const textAnswer = (fillAnswerInput?.value || '').trim();
  if (currentQuestion.type === 'fill') {
    if (!textAnswer && !isTimeout) { showToast('請先輸入答案'); return; }
  } else if (currentQuestion.type === 'matching') {
    selected = [...document.querySelectorAll('.matching-select')].map((item) => Number(item.value));
    if ((!selected.length || selected.some((value) => Number.isNaN(value))) && !isTimeout) {
      showToast('請完成所有左右配對');
      return;
    }
  } else if (!selected.length && !isTimeout) { showToast('請先選擇答案'); return; }

  hasSubmitted = true;
  stopTimer();
  if (submitAnswerBtn) submitAnswerBtn.style.display = 'none';
  /* 鎖定選項 */
  document.querySelectorAll('#optionsList .option-btn').forEach(b => b.style.pointerEvents = 'none');
  if (fillAnswerInput) fillAnswerInput.disabled = true;

  try {
    const data = await api('/submit_answer', {
      method: 'POST',
      body: JSON.stringify({
        pin, playerName: getPlayerName(),
        username: localStorage.getItem('currentUser') || '',
        questionId: currentQuestion.question_id,
        selected, textAnswer, remainSeconds, isTimeout
      })
    });

    totalScoreText.textContent  = data.totalScore ?? 0;
    finishScoreText.textContent = data.totalScore ?? 0;

    /* 若被淘汰 */
    if (data.eliminated) {
      isEliminated = true;
      totalScoreText.textContent  = 0;
      finishScoreText.textContent = 0;
    }

    /* 顯示正解顏色 */
    if (data.correctIndexes) {
      const mySelected = selected;
      revealOptions(data.correctIndexes, mySelected);
    }

    openPlayerResult({
      badge:        data.isCorrect ? '🎉 答對了！' : (isTimeout ? '⏰ 時間到！' : (data.eliminated ? '💀 淘汰！' : '😢 答錯了')),
      points:       data.eliminated ? '積分歸零' : `+${data.pointsEarned || 0}`,
      answerText:   data.answerText || '-',
      explanation:  data.explanation || '等待房主進入下一題。',
      top5:         data.top5 || [],
      myRank:       data.myRank,
      showExactRank: data.showExactRank,
      eliminated:   !!data.eliminated
    });

    if (data.eliminated) {
      AudioManager?.eliminated();
    } else if (data.isCorrect) {
      AudioManager?.correct();
    } else {
      AudioManager?.wrong();
    }

  } catch (e) {
    hasSubmitted = false;
    if (submitAnswerBtn) submitAnswerBtn.style.display = 'inline-block';
    document.querySelectorAll('#optionsList .option-btn').forEach(b => b.style.pointerEvents = '');
    if (fillAnswerInput) fillAnswerInput.disabled = false;
    showToast(e.message);
  }
}

/* ── 房主結束本題 ── */
async function hostFinishQuestion() {
  if (hostFinishedQuestion) return;
  hostFinishedQuestion = true;
  try {
    await api('/host_finish_question', { method: 'POST', body: JSON.stringify({ pin, playerName: getPlayerName() }) });
    await loadState(true);
  } catch (e) { showToast(e.message); hostFinishedQuestion = false; }
}

/* ══════════════════════════════════════
   主狀態機
   ══════════════════════════════════════ */
function showView(view) {
  /* view: 'host' | 'player' | 'spectator' */
  if (hostView)      hostView.style.display      = (view === 'host')      ? 'block' : 'none';
  if (playerView)    playerView.style.display    = (view === 'player')    ? 'block' : 'none';
  if (spectatorView) spectatorView.style.display = (view === 'spectator') ? 'block' : 'none';
}

function legacyHandleStateDisabled(data) {
  try {
      if (isTeamMode && teamPlayMode === 'free_assign' && !isHost) {
    stopTimer();
    countdownText.textContent = '-';
    const pickedQ = setupTeamQuestionPicker(data);
    renderPlayerSideList(data.answerStatus || []);
    updateHostAllDoneButton(data.answerStatus || []);
    if (pickedQ) {
      const answeredCount = (data.teamQuestionStatus || []).filter((x) => x.submitted).length;
      renderPlayerQuestion(pickedQ, answeredCount, data.totalQuestions || 0);
      const myStatus = (data.teamQuestionStatus || []).find((x) => x.question_id === pickedQ.question_id);
      const locked = !!myStatus?.submitted;
      if (submitAnswerBtn) submitAnswerBtn.style.display = locked ? 'none' : 'inline-block';
      if (fillAnswerInput) fillAnswerInput.disabled = locked;
      document.querySelectorAll('#optionsList .option-btn').forEach((b) => { b.style.pointerEvents = locked ? 'none' : ''; });
      progressText.textContent = `團隊完成 ${answeredCount} / ${data.totalQuestions || 0} 題`;
    }
    return;
  }
  const q     = data.nextQuestion;
  const qId   = q?.question_id || null;
  const phase = data.phase || 'question';
  currentPhase = phase;

  /* 淘汰狀態同步 */
  if (data.isEliminated !== undefined) isEliminated = !!data.isEliminated;

  /* ─ 決定視角 ─ */
  if (isHost) showView('host');
  else if (isEliminated) showView('spectator');
  else showView('player');

  const qChanged = (qId !== currentQuestionId);
  if (!q && !data.finished) {
    console.warn('[handleState] nextQuestion is empty', data);
    return;
  }
  if (qChanged) {
    currentQuestionId    = qId;
    lastHandledPhaseQid  = null;
    hostFinishedQuestion = false;
    closePlayerResult();
    closeHostExplanation();

    if (q) {
      if (isHost) {
        renderHostQuestion(q, data.answeredCount, data.totalQuestions);
        if (phase === 'question') {
          startTimer((parseInt(String(q.time||'').replace(/[^0-9]/g,'')) || 20), () => {
            showToast('時間到，正在進入統計...');
            hostFinishQuestion();
          });
        }
      } else if (isEliminated) {
        renderSpectatorQuestion(q, data.answeredCount, data.totalQuestions);
      } else {
        renderPlayerQuestion(q, data.answeredCount, data.totalQuestions);
        AudioManager?.questionStart();
        if (phase === 'question' && !(isTeamMode && teamPlayMode === 'free_assign')) {
           startTimer((parseInt(String(q.time||'').replace(/[^0-9]/g,'')) || 20), () => submitAnswer(true));
        }
      }
    }
  }

  renderPlayerSideList(data.answerStatus || []);
  updateHostAllDoneButton(data.answerStatus || []);

  const phaseKey = `${qId}:${phase}`;

  if (phase === 'question') {
    if (isHost) {
      renderHostAnswerStatus(data.answerStatus || []);
      renderHostBreakdown([]);
      if (!qChanged && !timerInterval && q) {
        startTimer(remainSeconds || (parseInt(String(q.time||'').replace(/[^0-9]/g,'')) || 20), () => {
          showToast('時間到，正在進入統計...');
          hostFinishQuestion();
        });
      }
    } else if (!isEliminated) {
      if (data.myAnswered && submitAnswerBtn) submitAnswerBtn.style.display = 'none';
    }
    return;
  }

  /* ─ explanation 階段 ─ */
  stopTimer();
  countdownText.textContent = 0;
  if (lastHandledPhaseQid === phaseKey) return;
  lastHandledPhaseQid = phaseKey;

  /* 找本題被淘汰的玩家名單 */
  const eliminatedNames = (data.answerStatus || [])
    .filter(p => !p.is_host && p.is_eliminated && p.answered)
    .map(p => p.player_name);

  if (isHost) {
    renderHostAnswerStatus(data.answerStatus || [], eliminatedNames);
    renderHostBreakdown(data.answerBreakdown || []);
    openHostExplanation({
      correctText: data.correctAnswerText,
      explanation: data.explanation,
      top5: data.leaderboard?.slice(0, 5) || [],
      eliminatedNames
    });
  } else {
    /* 解析階段顯示選項正解標色 */
    if (!isEliminated && currentQuestion && data.correctAnswerText) {
      const correctLabels = (data.correctAnswerText || '').split('、');
      const correctIndexes = correctLabels
        .map(l => l.charCodeAt(0) - 65)
        .filter(i => i >= 0);
      const mySelected = (() => {
        try { return JSON.parse(data.myResult?.selected_json || '[]'); } catch { return []; }
      })();
      revealOptions(correctIndexes, mySelected);
    }

    openPlayerResult({
      badge:        data.myAnswered
                      ? (data.myResult?.is_correct ? '🎉 答對了！' : (isEliminated ? '💀 已淘汰' : '😢 答錯了'))
                      : '⏰ 時間到！',
      points:       isEliminated ? '積分歸零' : `+${data.myResult?.points_earned || 0}`,
      answerText:   data.correctAnswerText || '-',
      explanation:  data.explanation || '房主看完解析後會進入下一題。',
      top5:         data.leaderboard?.slice(0, 5) || [],
      myRank:       data.myRank,
      showExactRank: data.showExactRank,
      eliminated:   isEliminated
    });
    totalScoreText.textContent  = data.totalScore ?? 0;
    finishScoreText.textContent = data.totalScore ?? 0;
  }
  } catch(err) {
    console.error('[handleState error]', err);
    showToast('狀態更新錯誤：' + err.message);
  }
}

function handleState(data) {
  try {
    const q = data.nextQuestion;
    const qId = q?.question_id || null;
    const phase = data.phase || 'question';
    currentPhase = phase;
    if (data.isEliminated !== undefined) isEliminated = !!data.isEliminated;

    if (isTeamMode && teamPlayMode === 'free_assign' && !isHost) {
      showView(isEliminated ? 'spectator' : 'player');
      const pickedQ = setupTeamQuestionPicker(data);
      renderPlayerSideList(data.answerStatus || []);
      updateHostAllDoneButton(data.answerStatus || []);
      if (!pickedQ) {
        stopTimer();
        if (countdownText) countdownText.textContent = '-';
        return;
      }

      const pickedId = pickedQ.question_id || null;
      const pickedChanged = pickedId !== currentQuestionId;
      if (pickedChanged) {
        currentQuestionId = pickedId;
        lastHandledPhaseQid = null;
        closePlayerResult();
        closeHostExplanation();
        stopTimer();
      }

      const answeredCount = (data.teamQuestionStatus || []).filter((x) => x.submitted).length;
      if (pickedChanged || !currentQuestion) renderPlayerQuestion(pickedQ, answeredCount, data.totalQuestions || 0);
      const myStatus = (data.teamQuestionStatus || []).find((x) => x.question_id === pickedQ.question_id);
      const locked = !!myStatus?.submitted;
      if (submitAnswerBtn) submitAnswerBtn.style.display = locked ? 'none' : 'inline-block';
      if (fillAnswerInput) fillAnswerInput.disabled = locked;
      document.querySelectorAll('#optionsList .option-btn').forEach((b) => {
        b.style.pointerEvents = locked ? 'none' : '';
      });
      if (progressText) progressText.textContent = `團隊進度 ${answeredCount} / ${data.totalQuestions || 0} 題`;
      if (locked) {
        stopTimer();
        if (countdownText) countdownText.textContent = 0;
      } else if (!timerInterval) {
        startTimer(getQuestionSeconds(pickedQ), () => submitAnswer(true));
      }
      return;
    }

    if (!q && !data.finished) {
      console.warn('[handleState] nextQuestion is empty', data);
      return;
    }

    if (isHost) showView('host');
    else if (isEliminated) showView('spectator');
    else showView('player');

    const qChanged = qId !== currentQuestionId;
    if (qChanged) {
      currentQuestionId = qId;
      lastHandledPhaseQid = null;
      hostFinishedQuestion = false;
      closePlayerResult();
      closeHostExplanation();
      stopTimer();
      hasSubmitted = false;
    }

    if (q && (qChanged || !currentQuestion)) {
      if (isHost) renderHostQuestion(q, data.answeredCount, data.totalQuestions);
      else if (isEliminated) renderSpectatorQuestion(q, data.answeredCount, data.totalQuestions);
      else {
        renderPlayerQuestion(q, data.answeredCount, data.totalQuestions);
        AudioManager?.questionStart();
      }
    }

    renderPlayerSideList(data.answerStatus || []);
    updateHostAllDoneButton(data.answerStatus || []);

    if (phase === 'question') {
      if (isHost) {
        renderHostAnswerStatus(data.answerStatus || []);
        renderHostBreakdown([]);
        if (!timerInterval && q) {
          startTimer(getQuestionSeconds(q), () => {
            showToast('時間到，正在進入統計...');
            hostFinishQuestion();
          });
        }
      } else if (!isEliminated) {
        if (data.myAnswered) {
          if (submitAnswerBtn) submitAnswerBtn.style.display = 'none';
          stopTimer();
          if (countdownText) countdownText.textContent = 0;
        } else if (!timerInterval && q) {
          closePlayerResult();
          startTimer(getQuestionSeconds(q), () => submitAnswer(true));
        }
      }
      return;
    }

    stopTimer();
    if (countdownText) countdownText.textContent = 0;
    const phaseKey = `${qId}:${phase}`;
    if (lastHandledPhaseQid === phaseKey) return;
    lastHandledPhaseQid = phaseKey;

    const eliminatedNames = (data.answerStatus || [])
      .filter((p) => !p.is_host && p.is_eliminated && p.answered)
      .map((p) => p.player_name);

    if (isHost) {
      renderHostAnswerStatus(data.answerStatus || [], eliminatedNames);
      renderHostBreakdown(data.answerBreakdown || []);
      openHostExplanation({
        correctText: data.correctAnswerText,
        explanation: data.explanation,
        top5: data.leaderboard?.slice(0, 5) || [],
        eliminatedNames,
      });
    } else {
      if (!isEliminated && currentQuestion && data.correctAnswerText) {
        const correctIndexes = (data.correctAnswerText || '')
          .split('、')
          .map((label) => label.trim().charCodeAt(0) - 65)
          .filter((idx) => idx >= 0);
        const mySelected = (() => {
          try { return JSON.parse(data.myResult?.selected_json || '[]'); } catch { return []; }
        })();
        revealOptions(correctIndexes, mySelected);
      }
      openPlayerResult({
        badge: data.myAnswered
          ? (data.myResult?.is_correct ? '✅ 答對了' : (isEliminated ? '💀 已淘汰' : '❌ 答錯了'))
          : '⏰ 時間到',
        points: isEliminated ? '積分歸零' : `+${data.myResult?.points_earned || 0}`,
        answerText: data.correctAnswerText || '-',
        explanation: data.explanation || '本題未提供解析。',
        top5: data.leaderboard?.slice(0, 5) || [],
        myRank: data.myRank,
        showExactRank: data.showExactRank,
        eliminated: isEliminated,
      });
      totalScoreText.textContent = data.totalScore ?? 0;
      finishScoreText.textContent = data.totalScore ?? 0;
    }
  } catch (err) {
    console.error('[handleState error]', err);
    showToast('同步遊戲狀態失敗：' + err.message);
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
    applyRoomTheme(data.room || {});

    roomPinText.textContent    = pin;
    playerNameText.textContent = getPlayerName();
    roleText.textContent       = isHost ? '🎓 房主' : (isEliminated ? '💀 觀戰' : '🎮 玩家');

    if (scoreBadgePill) scoreBadgePill.style.display = isHost ? 'none' : '';
    if (!isHost) {
      totalScoreText.textContent  = isEliminated ? 0 : (data.totalScore ?? 0);
      finishScoreText.textContent = isEliminated ? 0 : (data.totalScore ?? 0);
    }
      setupTeamChatUI(data);
    await loadTeamMessages();
    renderLeaderboard(data.leaderboard || []);

    if (data.finished) {
      if (!gameFinished) showFinishScreen(data);
      return;
    }

    if (finishWrap) finishWrap.style.display = 'none';

    // 確保視角在 handleState 前就正確顯示，避免白畫面
    if (isHost) showView('host');
    else if (data.isEliminated) showView('spectator');
    else showView('player');

    handleState(data);
    if ((!data.answerStatus || !data.answerStatus.length) && data.players?.length) {
      renderPlayerSideList((data.players || []).map(p => ({
        ...p, answered: 0, is_correct: 0
      })));
    }
  } catch (e) {
    showToast('載入失敗：' + e.message);
    console.error('[loadState error]', e);
  }
}

/* ══════════════════════════════════════
   結束畫面
   ══════════════════════════════════════ */
function buildPodiumHTML(leaderboard) {
  const top3    = leaderboard.slice(0, 3);
  while (top3.length < 3) top3.push(null);
  const medals  = ['🥇', '🥈', '🥉'];
  const order   = [1, 0, 2];
  return `<div class="podium-row">${order.map(i => {
    const p = top3[i];
    if (!p) return `<div class="podium-col podium-${i + 1}"><div class="podium-stage"></div></div>`;
    return `<div class="podium-col podium-${i + 1}">
      <div class="podium-avatar">${avatarHtml(p, 64)}</div>
      <div class="podium-medal">${medals[i]}</div>
      <div class="podium-name">${p.player_name}</div>
      <div class="podium-score">${p.total_score} 分</div>
      <div class="podium-stage"></div>
    </div>`;
  }).join('')}</div>`;
}

function buildScoreboardHTML(leaderboard, allPlayers = []) {
  const me = getPlayerName();
  // 合併被淘汰且未在 leaderboard 的玩家
  const eliminatedSet = new Set(allPlayers.filter(p => p.is_eliminated).map(p => p.player_name));
  return `<div class="scoreboard-list">${leaderboard.map((p, i) => `
    <div class="sb-row ${p.player_name === me ? 'sb-mine' : ''} ${eliminatedSet.has(p.player_name) ? 'sb-eliminated' : ''}">
      <span class="sb-rank">${i + 1}</span>
      <span class="sb-name">${p.player_name} ${eliminatedSet.has(p.player_name) ? '💀' : ''}</span>
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
          const sel     = (() => { try { return JSON.parse(r.selected_json || '[]'); } catch { return []; } })();
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
  showView('player');  // 統一收起
  if (finishWrap) finishWrap.style.display = 'block';

  if (podiumInner)    podiumInner.innerHTML    = buildPodiumHTML(data.leaderboard || []);
  if (scoreboardWrap) scoreboardWrap.innerHTML = buildScoreboardHTML(data.leaderboard || [], data.answerStatus || []);

  if (isHost && hostDetailWrap) {
    try {
      const det = await api(`/host_all_results?pin=${encodeURIComponent(pin)}`);
      hostDetailWrap.innerHTML = buildHostDetailHTML(det.results || []);
      if (hostDetailSection) hostDetailSection.style.display = 'block';
    } catch { hostDetailWrap.innerHTML = '<p>無法載入明細</p>'; }
  }

  if (podiumOverlay) podiumOverlay.style.display = 'flex';
  AudioManager?.stopBgMusic();
  setTimeout(() => AudioManager?.scoreboard(), 400);
  // 若玩家是第一名，額外特效
  const myFinalRank = (data.leaderboard || []).findIndex(p => p.player_name === getPlayerName());
  if (myFinalRank === 0 && !isEliminated) setTimeout(() => AudioManager?.firstPlace(), 1200);
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
    await api('/leave_room', { method: 'POST', body: JSON.stringify({ pin, playerName: getPlayerName() }) });
  } catch (_) {}
  finally {
    ['currentRoomPin', 'currentRoomKey', 'roomPlayerProfile', 'pendingJoinContext'].forEach(k => localStorage.removeItem(k));
    isInternalNavigation = true;
    window.location.href = 'index.html';
  }
}

function leaveRoomOnUnload() {
  if (!pin || !getPlayerName() || hasLeftRoom || isInternalNavigation) return;
  hasLeftRoom = true;
  navigator.sendBeacon?.('/leave_room',
    new Blob([JSON.stringify({ pin, playerName: getPlayerName() })], { type: 'application/json' }));
}

/* ── 事件 ── */
submitAnswerBtn?.addEventListener('click', () => submitAnswer(false));
teamQuestionSelect?.addEventListener('change', () => {
  loadState(true);
});
nextQuestionBtn?.addEventListener('click', closePlayerResult);
teamChatForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const msg = (teamChatInput?.value || '').trim();
  if (!msg || !isTeamMode || isHost || myTeamId <= 0) return;
  try {
    await api('/send_message', {
      method: 'POST',
      body: JSON.stringify({
        pin,
        senderName: getPlayerName(),
        message: msg,
        teamId: myTeamId,
        face: playerProfile.face,
        hair: playerProfile.hair,
        eyes: playerProfile.eyes,
        eyesOffsetY: playerProfile.eyesOffsetY || 0
      })
    });
    if (teamChatInput) teamChatInput.value = '';
    await loadTeamMessages();
  } catch (e2) {
    showToast(e2.message);
  }
});
hostSkipExplanationBtn?.addEventListener('click', async () => {
  closeHostExplanation();
  AudioManager?.click();
  try {
    await api('/host_skip_explanation', { method: 'POST', body: JSON.stringify({ pin, playerName: getPlayerName() }) });
    AudioManager?.questionStart();
    await loadState(true);
  } catch (e) { showToast(e.message); }
});

hostAllDoneSkipBtn?.addEventListener('click', async () => {
  AudioManager?.click();
  try {
    await api('/host_finish_question', { method: 'POST', body: JSON.stringify({ pin, playerName: getPlayerName() }) });
    await loadState(true);
  } catch (e) { showToast(e.message); }
});

document.getElementById('podiumContinueBtn')?.addEventListener('click', () => {
  if (podiumOverlay)     podiumOverlay.style.display     = 'none';
  if (scoreboardOverlay) scoreboardOverlay.style.display = 'flex';
});

document.getElementById('backHomeBtn')?.addEventListener('click', leaveRoom);
document.getElementById('leaveGameBtn')?.addEventListener('click', leaveRoom);
window.addEventListener('beforeunload', leaveRoomOnUnload);

/* ── 初始化 ── */
// 使用者第一次互動後啟動背景音樂（瀏覽器限制需要 user gesture）
let bgStarted = false;
function tryStartBg() {
  if (bgStarted || AudioManager?.isMuted()) return;
  bgStarted = true;
  AudioManager?.startBgMusic();
}
document.addEventListener('click', () => {
  tryStartBg();
  AudioManager?.gameStart();
}, { once: true });
document.addEventListener('keydown', tryStartBg, { once: true });

loadState(true);
sendHeartbeat();
setInterval(sendHeartbeat, 5000);
setInterval(() => { if (!hasLeftRoom && !gameFinished) loadState(); }, isHost ? 1800 : 2200);
