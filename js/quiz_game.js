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
const submitAnswerBtn = document.getElementById('submitAnswerBtn');

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

const getPlayerName = () => (playerProfile?.name || '').trim();
