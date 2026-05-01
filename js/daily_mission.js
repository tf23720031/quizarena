const $ = (id) => document.getElementById(id);
const EXP_PER_DAY = 60;

let latestState = null;

function getCurrentUser() {
  const direct = String(localStorage.getItem("currentUser") || sessionStorage.getItem("currentUser") || "").trim();
  if (direct) return direct;
  try {
    const profile = JSON.parse(localStorage.getItem("currentUserProfile") || "null");
    return String(profile?.username || "").trim();
  } catch {
    return "";
  }
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function showToast(message) {
  const toast = $("toast");
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove("show"), 1800);
}

async function api(url, options = {}) {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  let data = {};
  try {
    data = await res.json();
  } catch {
    data = { success: false, message: "伺服器回傳格式不正確" };
  }
  if (!res.ok || data.success === false) {
    throw new Error(data.message || "操作失敗");
  }
  return data;
}

function renderStreakDots(state) {
  const dots = $("dailyStreakDots");
  if (!dots) return;
  const streak = Number(state.currentStreak || 0);
  const cycleDay = Number(state.cycleDay || 0);
  dots.innerHTML = Array.from({ length: 7 }, (_, index) => {
    const day = index + 1;
    const active = streak > 0 && day <= cycleDay;
    const current = streak > 0 && day === cycleDay;
    const label = streak > 0 && current ? `今天是第 ${day} 天` : `第 ${day} 天`;
    return `<span class="daily-streak-dot ${active ? "active" : ""} ${current ? "current" : ""}" title="${label}" aria-label="${label}"></span>`;
  }).join("");
}

function renderBreakModal(state) {
  const modal = $("streakBreakModal");
  const message = $("streakBreakMessage");
  if (!modal) return;
  if (state.showStreakBroken) {
    if (message) {
      message.textContent = `你原本連續完成 ${Number(state.brokenStreak || 0)} 天，但中間有一天沒有完成，所以連續被中斷。今天可以重新開始累積。`;
    }
    modal.classList.add("show");
    modal.setAttribute("aria-hidden", "false");
  } else {
    modal.classList.remove("show");
    modal.setAttribute("aria-hidden", "true");
  }
}

function render(state) {
  latestState = state;
  const required = Number(state.required || 3);
  const progress = Number(state.progress || 0);
  const streak = Number(state.currentStreak || 0);
  const totalDays = Number(state.totalCompletedDays || 0);
  const cycleDay = Number(state.cycleDay || 0);
  $("dailyProgress").textContent = `${progress}/${required}`;
  $("dailyStreak").textContent = `${streak} 天`;
  $("dailyCompletedDays").textContent = `${totalDays} 天`;
  if ($("dailyDayInfo")) {
    $("dailyDayInfo").textContent = state.completedToday
      ? `今天是連續第 ${cycleDay || Math.min(streak, 7) || 1} 天完成任務`
      : (streak > 0 ? `目前連續 ${streak} 天，完成今日任務可延續` : "今日尚未完成");
  }
  $("dailyReward").textContent = state.completedToday
    ? (state.titleUnlocked ? `連續 7 天完成，已獲得稱號：連勤學者` : `今日已完成，已獲得 +${Number(state.exp || EXP_PER_DAY)} EXP`)
    : `完成 ${required} 題可獲得 +${Number(state.exp || EXP_PER_DAY)} EXP`;
  renderStreakDots(state);
  renderBreakModal(state);

  const questions = Array.isArray(state.questions) ? state.questions : [];
  $("dailyMissionList").innerHTML = questions.map((item, index) => {
    const done = Boolean(item.done);
    return `<article class="question-card daily-question-card ${done ? "daily-completed-card" : ""}">
      <div class="question-meta-row">
        <h3>每日任務 ${index + 1}</h3>
        <span class="answer-pill">${done ? "已完成" : "未完成"}</span>
      </div>
      <p>${escapeHtml(item.q)}</p>
      <div class="practice-options">
        ${(item.options || []).map((option, optIndex) => {
          const correct = done && Number(item.answer) === optIndex;
          return `<button class="practice-option ${correct ? "correct completed-answer" : ""}" data-q="${index}" data-a="${optIndex}" ${done ? "disabled" : ""}>
            <b>${String.fromCharCode(65 + optIndex)}</b><span>${escapeHtml(option)}</span>
          </button>`;
        }).join("")}
      </div>
    </article>`;
  }).join("");

  document.querySelectorAll("[data-q]").forEach((btn) => {
    btn.addEventListener("click", () => submitAnswer(Number(btn.dataset.q), Number(btn.dataset.a)));
  });
}

async function loadDailyMission() {
  const username = getCurrentUser();
  if (!username) {
    $("dailyMissionList").innerHTML = `<article class="question-card"><p>請先登入後再查看每日任務。</p></article>`;
    return;
  }
  try {
    const data = await api(`/daily_mission_status?username=${encodeURIComponent(username)}`);
    render(data);
  } catch (error) {
    showToast(error.message);
    $("dailyMissionList").innerHTML = `<article class="question-card"><p>${escapeHtml(error.message)}</p></article>`;
  }
}

async function submitAnswer(questionIndex, answerIndex) {
  const username = getCurrentUser();
  if (!username) {
    showToast("請先登入後再作答");
    return;
  }
  try {
    const beforeCompleted = Boolean(latestState?.completedToday);
    const data = await api("/daily_mission_answer", {
      method: "POST",
      body: JSON.stringify({ username, questionIndex, answerIndex }),
    });
    if (!data.correct) {
      showToast("答錯了，再想一下！");
      return;
    }
    if (data.rewarded && !beforeCompleted) {
      showToast(`每日任務完成！獲得 +${Number(data.exp || EXP_PER_DAY)} EXP`);
    } else {
      showToast("答對了！");
    }
    render(data);
  } catch (error) {
    showToast(error.message);
  }
}

$("refreshDailyBtn")?.addEventListener("click", loadDailyMission);
$("streakBreakOkBtn")?.addEventListener("click", async () => {
  const username = getCurrentUser();
  if (!username) return;
  try {
    const data = await api("/daily_mission_ack_break", {
      method: "POST",
      body: JSON.stringify({ username }),
    });
    render(data);
  } catch (error) {
    showToast(error.message);
  }
});

loadDailyMission();
