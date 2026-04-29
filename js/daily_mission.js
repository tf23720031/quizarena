const $ = (id) => document.getElementById(id);
const user = localStorage.getItem("currentUser") || "guest";
const today = new Date().toISOString().slice(0, 10);
const key = `quizarena_daily_${user}`;
const rewardKey = `quizarena_daily_reward_${user}`;
const titleKey = `quizarena_daily_title_${user}`;
const EXP_PER_DAY = 60;

const POOL = [
  { q: "哪一種學習方式最適合複習錯題？", options: ["直接背答案", "先看錯因再重做", "跳過不看", "只看分數"], answer: 1 },
  { q: "閱讀題目時，第一步通常應該做什麼？", options: ["找關鍵字", "隨機選", "看最短選項", "關掉題目"], answer: 0 },
  { q: "程式中的變數主要用途是什麼？", options: ["儲存資料", "裝飾畫面", "刪除資料庫", "增加音量"], answer: 0 },
  { q: "設計按鈕時，主要行動按鈕應該？", options: ["完全隱藏", "有明確對比", "與背景同色", "不能點擊"], answer: 1 },
  { q: "英文 She goes 中 goes 使用原因是？", options: ["第三人稱單數", "過去式", "複數", "被動語態"], answer: 0 },
  { q: "12 x 3 = ?", options: ["24", "30", "36", "42"], answer: 2 },
];

function escapeHtml(value) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}

function showToast(message) {
  const toast = $("toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove("show"), 1800);
}

function loadState(reset = false) {
  let state = {};
  try { state = JSON.parse(localStorage.getItem(key) || "{}"); } catch {}
  if (reset || state.date !== today) {
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    const keptYesterday = state.date === yesterday && Array.isArray(state.done) && state.done.length >= 3;
    const streak = keptYesterday ? Number(state.streak || 0) + 1 : 1;
    const start = Math.abs([...today].reduce((sum, ch) => sum + ch.charCodeAt(0), 0)) % POOL.length;
    state = { date: today, streak, done: [], questions: [0, 1, 2].map((n) => (start + n) % POOL.length) };
    localStorage.setItem(key, JSON.stringify(state));
  }
  return state;
}

function saveState(state) {
  localStorage.setItem(key, JSON.stringify(state));
}

function loadReward() {
  try {
    return JSON.parse(localStorage.getItem(rewardKey) || "{}");
  } catch {
    return {};
  }
}

function saveReward(reward) {
  localStorage.setItem(rewardKey, JSON.stringify(reward));
}

function grantDailyReward(state) {
  const reward = loadReward();
  if (reward.lastRewardDate === today) return false;
  reward.exp = Number(reward.exp || 0) + EXP_PER_DAY;
  reward.completedDays = Number(reward.completedDays || 0) + 1;
  reward.lastRewardDate = today;
  reward.streak = Number(state.streak || 1);
  if (Number(state.streak || 0) >= 7) {
    reward.title = "連勤學者";
    localStorage.setItem(titleKey, "連勤學者");
  }
  saveReward(reward);
  return true;
}

function render() {
  const state = loadState();
  const reward = loadReward();
  $("dailyProgress").textContent = `${state.done.length}/3`;
  $("dailyStreak").textContent = `${Number(state.streak || 0)} 天`;
  $("dailyReward").textContent = Number(state.streak || 0) >= 7 ? `連勤學者 +${EXP_PER_DAY} EXP` : `+${EXP_PER_DAY} EXP｜第 ${Number(reward.completedDays || 0)} 天`;
  $("dailyMissionList").innerHTML = state.questions.map((poolIndex, index) => {
    const item = POOL[poolIndex];
    const done = state.done.includes(index);
    return `<article class="question-card">
      <div class="question-meta-row"><h3>每日第 ${index + 1} 題</h3><span class="answer-pill">${done ? "完成" : "未完成"}</span></div>
      <p>${escapeHtml(item.q)}</p>
      <div class="practice-options">
        ${item.options.map((option, optIndex) => `<button class="practice-option ${done && optIndex === item.answer ? "correct" : ""}" data-q="${index}" data-a="${optIndex}" ${done ? "disabled" : ""}><b>${String.fromCharCode(65 + optIndex)}</b><span>${escapeHtml(option)}</span></button>`).join("")}
      </div>
    </article>`;
  }).join("");
  document.querySelectorAll("[data-q]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const qIndex = Number(btn.dataset.q);
      const aIndex = Number(btn.dataset.a);
      const latest = loadState();
      const item = POOL[latest.questions[qIndex]];
      if (aIndex !== item.answer) {
        showToast("差一點，再想想關鍵字");
        return;
      }
      latest.done = [...new Set([...latest.done, qIndex])];
      const completedNow = latest.done.length >= 3;
      const rewarded = completedNow ? grantDailyReward(latest) : false;
      saveState(latest);
      showToast(completedNow ? (rewarded ? `今日任務完成，獲得 ${EXP_PER_DAY} EXP` : "今日任務已完成") : "答對了");
      render();
    });
  });
}

$("resetDailyBtn")?.addEventListener("click", () => {
  loadState(true);
  render();
});
render();
