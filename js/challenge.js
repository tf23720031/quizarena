// ── QuizArena 1v1 挑戰好友 ──
// 透過 URL hash 傳遞挑戰資料，不需要伺服器即可進行雙人對戰
// 流程：建立者產生連結 → 對手開啟連結加入 → 各自作答 → 比較結果

const $ = (id) => document.getElementById(id);

function escapeHtml(v) {
  return String(v || "").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;")
    .replaceAll('"',"&quot;").replaceAll("'","&#39;");
}
function showToast(msg, delay = 2200) {
  const t = $("toast"); if (!t) return;
  t.textContent = msg; t.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => t.classList.remove("show"), delay);
}

const gameState = {
  mode: null, // 'host' | 'guest'
  challengeData: null, // { hostName, bankTitle, questions, hostScores }
  playerName: '',
  questions: [],
  currentIndex: 0,
  score: 0,
  answers: [], // { correct: bool, selected: number }
  checked: false,
  selectedIndex: null,
};

// ── 讀取題庫 ──
function loadBanks() {
  const raw = localStorage.getItem("quizBanks") || "[]";
  try { return JSON.parse(raw); } catch { return []; }
}

function populateBankSelect() {
  const sel = $("challengeBankSelect"); if (!sel) return;
  const banks = loadBanks();
  if (!banks.length) {
    sel.innerHTML = `<option value="">尚未建立題庫，請先前往題庫中心</option>`; return;
  }
  sel.innerHTML = banks.map((b, i) =>
    `<option value="${i}">${escapeHtml(b.title || `題庫 ${i+1}`)}</option>`).join("");
}

// ── 建立挑戰 ──
function createChallenge() {
  const name = $("challengerName").value.trim();
  const bankIdx = parseInt($("challengeBankSelect").value);
  const qCount = parseInt($("challengeQuestionCount").value);
  if (!name) { showToast("請輸入你的名稱"); return; }
  const banks = loadBanks();
  const bank = banks[bankIdx];
  if (!bank || !bank.questions?.length) { showToast("此題庫沒有題目"); return; }
  const shuffled = [...bank.questions].sort(() => Math.random() - 0.5).slice(0, qCount);
  const payload = {
    hostName: name,
    bankTitle: bank.title || "題庫",
    questions: shuffled,
    hostScores: null, // filled after host completes
    ts: Date.now(),
  };
  gameState.mode = 'host';
  gameState.playerName = name;
  gameState.questions = shuffled;
  gameState.challengeData = payload;
  gameState.currentIndex = 0; gameState.score = 0; gameState.answers = [];
  // Encode to URL
  const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(payload))))
    .replaceAll('+','-').replaceAll('/','_').replaceAll('=','');
  const url = `${location.origin}${location.pathname}#challenge=${encoded}`;
  $("challengeLinkBox").textContent = url;
  $("createSection").style.display = "none";
  $("linkSection").style.display = "";
  // Start game for host
  setTimeout(() => startGame(), 500);
}

// ── 解析 URL hash ──
function parseHashChallenge() {
  const hash = location.hash;
  if (!hash.startsWith("#challenge=")) return null;
  try {
    const encoded = hash.slice("#challenge=".length).replaceAll('-','+').replaceAll('_','/');
    const padded = encoded + "==".slice(0, (4 - encoded.length % 4) % 4);
    return JSON.parse(decodeURIComponent(escape(atob(padded))));
  } catch { return null; }
}

// ── 加入挑戰 ──
function setupJoinMode(data) {
  $("createSection").style.display = "none";
  $("joinSection").style.display = "";
  $("challengeInviteBanner").innerHTML = `
    <i class="fa-solid fa-swords" style="color:#a855f7;font-size:1.4rem;"></i><br>
    <strong>${escapeHtml(data.hostName)}</strong> 邀請你挑戰「${escapeHtml(data.bankTitle)}」<br>
    <span style="font-size:.82rem;color:#888;margin-top:4px;display:block">${data.questions.length} 題搶答對決</span>`;
  gameState.mode = 'guest';
  gameState.challengeData = data;
  gameState.questions = data.questions;
}

function joinChallenge() {
  const name = $("opponentName").value.trim();
  if (!name) { showToast("請輸入你的名稱"); return; }
  gameState.playerName = name;
  gameState.currentIndex = 0; gameState.score = 0; gameState.answers = [];
  $("joinSection").style.display = "none";
  startGame();
}

// ── 遊戲主流程 ──
function startGame() {
  $("gameSection").style.display = "";
  $("linkSection").style.display = "none";
  renderQuestion();
}

function renderQuestion() {
  const q = gameState.questions[gameState.currentIndex];
  const area = $("challengeGameArea");
  $("gameTitle").textContent = `${gameState.playerName} 的挑戰`;
  $("gameProgress").textContent = `${gameState.currentIndex + 1} / ${gameState.questions.length}`;
  if (!q) { finishGame(); return; }

  const opts = (q.options || []);
  const correctIdxs = opts.map((o, i) => (o?.correct ? i : -1)).filter(i => i >= 0);

  area.innerHTML = `
    <div class="challenge-question-card">
      <div class="challenge-score-row">
        <span class="challenge-score-pill"><i class="fa-solid fa-star"></i> ${gameState.score} 分</span>
      </div>
      <h3 style="font-size:1.05rem;margin-bottom:8px;">${escapeHtml(q.title || '')}</h3>
      <p style="color:#555;margin-bottom:12px;">${escapeHtml(q.content || '')}</p>
      ${q.image ? `<img src="${escapeHtml(q.image)}" style="max-width:100%;border-radius:14px;margin-bottom:12px;">` : ''}
      <div class="challenge-options" id="challengeOpts">
        ${opts.map((o, i) => `
          <button class="challenge-opt-btn" data-index="${i}" type="button">
            <b>${String.fromCharCode(65+i)}.</b> ${escapeHtml(o?.text || '')}
          </button>`).join('')}
      </div>
      <div class="practice-actions" style="margin-top:12px;">
        <button id="challengeCheckBtn" class="tool-btn" disabled><i class="fa-solid fa-check"></i> 確認答案</button>
        <button id="challengeNextBtn" class="tool-btn secondary" style="display:none"><i class="fa-solid fa-forward"></i> 下一題</button>
      </div>
      <div id="challengeExplBox"></div>
    </div>`;

  let selected = null;
  document.querySelectorAll(".challenge-opt-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".challenge-opt-btn").forEach(b => b.classList.remove("selected"));
      btn.classList.add("selected");
      selected = parseInt(btn.dataset.index);
      $("challengeCheckBtn").disabled = false;
    });
  });

  $("challengeCheckBtn").addEventListener("click", () => {
    if (selected === null) return;
    const isCorrect = correctIdxs.includes(selected);
    if (isCorrect) gameState.score += Math.round(q.score || 1000);
    gameState.answers.push({ correct: isCorrect, selected });
    // reveal
    document.querySelectorAll(".challenge-opt-btn").forEach(btn => {
      const idx = parseInt(btn.dataset.index);
      if (correctIdxs.includes(idx)) btn.classList.add("correct");
      else if (idx === selected) btn.classList.add("wrong");
    });
    $("challengeCheckBtn").style.display = "none";
    $("challengeNextBtn").style.display = "";
    if (q.explanation) {
      $("challengeExplBox").innerHTML = `<div class="explanation-box">${escapeHtml(q.explanation)}</div>`;
    }
  });

  $("challengeNextBtn").addEventListener("click", () => {
    gameState.currentIndex++;
    renderQuestion();
  });
}

function finishGame() {
  $("gameSection").style.display = "none";
  $("resultSection").style.display = "";
  const totalQ = gameState.questions.length;
  const correct = gameState.answers.filter(a => a.correct).length;

  if (gameState.mode === 'host') {
    // Save host score to localStorage so guest can read it
    const key = `quizarena_challenge_host_${gameState.challengeData.ts}`;
    localStorage.setItem(key, JSON.stringify({ name: gameState.playerName, score: gameState.score, correct }));
    $("challengeResultArea").innerHTML = `
      <div class="challenge-result-player">
        <div class="score">${gameState.score}</div>
        <div class="name">${escapeHtml(gameState.playerName)}</div>
        <div style="color:#888;font-size:.85rem">${correct}/${totalQ} 題正確</div>
      </div>
      <div class="challenge-result-winner" style="margin-top:16px">
        <i class="fa-solid fa-share-nodes"></i> 把連結傳給好友，看誰得分更高！
      </div>`;
  } else {
    // Guest: try to read host score
    const key = `quizarena_challenge_host_${gameState.challengeData.ts}`;
    let hostData = null;
    try { hostData = JSON.parse(localStorage.getItem(key)); } catch {}
    const myScore = gameState.score;
    const hostScore = hostData?.score ?? null;
    let winnerHtml = '';
    if (hostScore !== null) {
      if (myScore > hostScore) winnerHtml = `<div class="challenge-result-winner">🎉 你贏了！恭喜</div>`;
      else if (myScore < hostScore) winnerHtml = `<div class="challenge-result-winner">🏆 ${escapeHtml(gameState.challengeData.hostName)} 贏了</div>`;
      else winnerHtml = `<div class="challenge-result-winner">🤝 平手！</div>`;
    }
    $("challengeResultArea").innerHTML = `
      <div class="challenge-result-vs">
        <div class="challenge-result-player">
          <div class="score">${escapeHtml(gameState.challengeData.hostName)}</div>
          <div class="score" style="font-size:1.8rem">${hostScore ?? '?'}</div>
          <div class="name">挑戰者</div>
        </div>
        <div style="font-size:1.5rem;font-weight:900;color:#a855f7">VS</div>
        <div class="challenge-result-player">
          <div class="score">${escapeHtml(gameState.playerName)}</div>
          <div class="score" style="font-size:1.8rem">${myScore}</div>
          <div class="name">你</div>
        </div>
      </div>
      ${winnerHtml}
      <p style="color:#888;font-size:.82rem;margin-top:12px">${correct}/${totalQ} 題正確</p>`;
  }
}

// ── 初始化 ──
function init() {
  populateBankSelect();
  const challengeData = parseHashChallenge();
  if (challengeData) {
    setupJoinMode(challengeData);
  }
  // Pre-fill name from localStorage
  const savedName = localStorage.getItem("currentUser") || "";
  if ($("challengerName")) $("challengerName").value = savedName;
  if ($("opponentName")) $("opponentName").value = savedName;
}

$("createChallengeBtn")?.addEventListener("click", createChallenge);
$("copyChallengeBtn")?.addEventListener("click", async () => {
  const url = $("challengeLinkBox").textContent;
  try { await navigator.clipboard.writeText(url); showToast("已複製挑戰連結！"); }
  catch { prompt("複製這個連結給好友", url); }
});
$("joinChallengeBtn")?.addEventListener("click", joinChallenge);
$("restartChallengeBtn")?.addEventListener("click", () => {
  location.hash = '';
  location.reload();
});

init();
