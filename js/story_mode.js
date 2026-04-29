const $ = (id) => document.getElementById(id);

const SUBJECTS = [
  {
    id: "chinese",
    title: "國文",
    icon: "fa-feather",
    summary: "從文字理解到古文判讀，解開文學密室。",
    branches: [
      {
        id: "library",
        title: "失落圖書館",
        stages: [
          { level: 1, difficulty: "easy", scene: "你推開失落圖書館的大門，會說話的書籤要求你用情緒理解喚醒第一盞燈。", q: "「夜深忽夢少年事」主要描寫哪種情緒？", options: ["喜悅", "懷舊與感傷", "憤怒", "驚嚇"], answer: 1 },
          { level: 2, difficulty: "medium", scene: "書架像迷宮一樣旋轉，AI書靈投影出一句句文字，只有看懂修辭才能找到出口。", q: "「時間像河流」使用哪一種修辭？", options: ["譬喻", "排比", "設問", "頂真"], answer: 0 },
          { level: 3, difficulty: "hard", scene: "圖書館核心出現一位虛擬館長，她要求你從混亂文本中抽出作者真正想守護的觀點。", q: "閱讀議論文時，最能判斷主旨的是哪一項？", options: ["標點符號", "作者反覆強調的核心立場", "字數最多的段落", "最短的句子"], answer: 1 },
        ],
      },
    ],
  },
  {
    id: "english",
    title: "英文",
    icon: "fa-language",
    summary: "用文法與閱讀力穿越異國學院。",
    branches: [
      {
        id: "academy",
        title: "晨星學院",
        stages: [
          { level: 1, difficulty: "easy", scene: "校門口的魔法鐘問你第一題。", q: "She ___ to school every day.", options: ["go", "goes", "going", "gone"], answer: 1 },
          { level: 2, difficulty: "medium", scene: "你需要補全任務告示。", q: "If it rains tomorrow, we ___ at home.", options: ["stay", "stayed", "will stay", "staying"], answer: 2 },
          { level: 3, difficulty: "hard", scene: "期末迷宮只接受精準閱讀。", q: "Which word means 'to improve gradually'?", options: ["decline", "enhance", "ignore", "delay"], answer: 1 },
        ],
      },
    ],
  },
  {
    id: "programming",
    title: "程式語言",
    icon: "fa-code",
    summary: "修復程式世界的錯誤，從基礎邏輯走到演算法。",
    branches: [
      {
        id: "debug-city",
        title: "Debug 城",
        stages: [
          { level: 1, difficulty: "easy", scene: "城市入口的變數門需要開啟。", q: "變數最主要的用途是什麼？", options: ["儲存資料", "刪除電腦", "固定畫面亮度", "連接電源"], answer: 0 },
          { level: 2, difficulty: "medium", scene: "迴圈橋正在重複閃爍。", q: "for 迴圈通常適合用在什麼情況？", options: ["完全不知道次數", "需要重複固定次數", "只執行一次", "不能使用條件"], answer: 1 },
          { level: 3, difficulty: "hard", scene: "核心伺服器要求你降低搜尋成本。", q: "已排序陣列最適合使用哪種搜尋法？", options: ["線性搜尋", "二分搜尋", "隨機搜尋", "全部刪除"], answer: 1 },
        ],
      },
    ],
  },
  {
    id: "design",
    title: "設計概論",
    icon: "fa-pen-nib",
    summary: "用構成、色彩與視覺層級完成委託。",
    branches: [
      {
        id: "atelier",
        title: "星光工作室",
        stages: [
          { level: 1, difficulty: "easy", scene: "客戶想讓按鈕更醒目。", q: "想強調主要按鈕，最應優先調整什麼？", options: ["對比", "檔名", "註解", "隨機位置"], answer: 0 },
          { level: 2, difficulty: "medium", scene: "海報資訊太亂，需要重排。", q: "視覺層級主要幫助使用者做到什麼？", options: ["快速辨認重要資訊", "增加檔案大小", "讓文字更難讀", "移除所有顏色"], answer: 0 },
          { level: 3, difficulty: "hard", scene: "品牌指南要求一致體驗。", q: "設計系統最核心的價值是什麼？", options: ["每頁都不同", "提高一致性與維護效率", "禁止元件重用", "只使用一種顏色"], answer: 1 },
        ],
      },
    ],
  },
  {
    id: "game",
    title: "遊戲設計",
    icon: "fa-gamepad",
    summary: "設計規則、回饋與關卡節奏，打造好玩的挑戰。",
    branches: [
      {
        id: "quest-lab",
        title: "關卡實驗室",
        stages: [
          { level: 1, difficulty: "easy", scene: "第一個關卡需要清楚目標。", q: "新手教學最重要的是什麼？", options: ["一次塞滿全部規則", "讓玩家理解核心操作", "不給任何回饋", "隱藏所有按鈕"], answer: 1 },
          { level: 2, difficulty: "medium", scene: "測試玩家覺得太難。", q: "好的難度曲線通常應該如何安排？", options: ["突然極難", "逐步增加挑戰", "永遠不變", "完全隨機"], answer: 1 },
          { level: 3, difficulty: "hard", scene: "Boss 戰需要有張力。", q: "遊戲回饋的主要作用是什麼？", options: ["讓玩家知道行動結果", "減少互動", "遮住畫面", "拖慢載入"], answer: 0 },
        ],
      },
    ],
  },
  {
    id: "math",
    title: "數學",
    icon: "fa-square-root-variable",
    summary: "從運算、比例到推理，一步步破解數學塔。",
    branches: [
      {
        id: "number-tower",
        title: "數字高塔",
        stages: [
          { level: 1, difficulty: "easy", scene: "第一層是基礎運算門。", q: "12 + 18 = ?", options: ["20", "28", "30", "32"], answer: 2 },
          { level: 2, difficulty: "medium", scene: "第二層要求比例判斷。", q: "若 3 本書 150 元，5 本同價書多少元？", options: ["200", "250", "300", "350"], answer: 1 },
          { level: 3, difficulty: "hard", scene: "塔頂需要推理。", q: "等差數列 2, 5, 8, 11 的下一項是？", options: ["12", "13", "14", "15"], answer: 2 },
        ],
      },
    ],
  },
];

const state = { subjectId: SUBJECTS[0].id, branchId: SUBJECTS[0].branches[0].id, stageIndex: 0, selected: null, checked: false };

function escapeHtml(value) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}

function showToast(message, delay = 1800) {
  const toast = $("toast");
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove("show"), delay);
}

async function api(url, options = {}) {
  const res = await fetch(url, { headers: { "Content-Type": "application/json" }, ...options });
  const data = await res.json();
  if (!res.ok || data.success === false) throw new Error(data.message || "生成失敗");
  return data;
}

function userKey() {
  return localStorage.getItem("currentUser") || "guest";
}

function progressKey() {
  return `quizarena_story_progress_${userKey()}`;
}

function loadProgress() {
  try { return JSON.parse(localStorage.getItem(progressKey()) || "{}"); } catch { return {}; }
}

function saveProgress(subjectId, branchId, clearedLevel) {
  const progress = loadProgress();
  const key = `${subjectId}:${branchId}`;
  progress[key] = Math.max(Number(progress[key] || 0), clearedLevel);
  localStorage.setItem(progressKey(), JSON.stringify(progress));
}

function activeSubject() {
  return SUBJECTS.find((item) => item.id === state.subjectId) || SUBJECTS[0];
}

function activeBranch() {
  const subject = activeSubject();
  return subject.branches.find((item) => item.id === state.branchId) || subject.branches[0];
}

function makeStoryStageFromQuestion(question, index, subjectTitle) {
  const options = Array.isArray(question.options) && question.options.length
    ? question.options
    : [
      { text: "選項 A", correct: true },
      { text: "選項 B", correct: false },
      { text: "選項 C", correct: false },
      { text: "選項 D", correct: false },
    ];
  const answer = Math.max(0, options.findIndex((option) => option.correct));
  return {
    level: index + 1,
    difficulty: question.difficulty || (index < 2 ? "easy" : index < 4 ? "medium" : "hard"),
    scene: `AI劇情引擎在「${subjectTitle}」支線生成了第 ${index + 1} 個事件：你必須解開這題，才能讓角色取得新的線索。`,
    q: question.content || question.title || "AI生成題目",
    options: options.map((option) => option.text || String(option)),
    answer,
  };
}

async function generateAiStoryQuestions() {
  const subject = activeSubject();
  const branch = activeBranch();
  const button = $("generateStoryBtn");
  if (button) {
    button.disabled = true;
    button.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> 生成中';
  }
  try {
    const data = await api("/generate_quiz_bank", {
      method: "POST",
      body: JSON.stringify({
        topic: `${subject.title} ${branch.title} 故事闖關題`,
        category: subject.title,
        difficulty: "medium",
        language: "zh",
        count: 5,
        sourceMode: "ai",
      }),
    });
    const questions = data.quizBank?.questions || [];
    if (!questions.length) throw new Error("AI沒有回傳題目");
    branch.stages.push(...questions.map((question, index) => makeStoryStageFromQuestion(question, branch.stages.length + index, subject.title)));
    showToast("已加入AI故事題目");
    renderAll();
  } catch (error) {
    showToast(error.message || "AI生成失敗，請稍後再試", 2600);
  } finally {
    if (button) {
      button.disabled = false;
      button.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> AI生成更多題目';
    }
  }
}

function renderSubjects() {
  const progress = loadProgress();
  $("storySubjectList").innerHTML = SUBJECTS.map((subject) => {
    const total = subject.branches.reduce((sum, branch) => sum + branch.stages.length, 0);
    const done = subject.branches.reduce((sum, branch) => sum + Number(progress[`${subject.id}:${branch.id}`] || 0), 0);
    return `<button class="story-subject-card ${subject.id === state.subjectId ? "active" : ""}" data-subject="${subject.id}">
      <i class="fa-solid ${subject.icon}"></i>
      <strong>${escapeHtml(subject.title)}</strong>
      <span>${escapeHtml(subject.summary)}</span>
      <em>${done} / ${total} 關</em>
    </button>`;
  }).join("");
  document.querySelectorAll("[data-subject]").forEach((button) => {
    button.addEventListener("click", () => {
      state.subjectId = button.dataset.subject;
      state.branchId = activeSubject().branches[0].id;
      state.stageIndex = 0;
      state.selected = null;
      state.checked = false;
      renderAll();
    });
  });
}

function renderBranches() {
  const subject = activeSubject();
  const progress = loadProgress();
  $("storyBranchTitle").textContent = `${subject.title}故事支線`;
  $("storyBranchMeta").textContent = "每條支線都會逐關提高難度";
  $("storyBranchList").innerHTML = subject.branches.map((branch) => {
    const done = Number(progress[`${subject.id}:${branch.id}`] || 0);
    return `<button class="story-branch-card ${branch.id === state.branchId ? "active" : ""}" data-branch="${branch.id}">
      <strong>${escapeHtml(branch.title)}</strong>
      <span>已通關 ${done} / ${branch.stages.length}</span>
    </button>`;
  }).join("");
  document.querySelectorAll("[data-branch]").forEach((button) => {
    button.addEventListener("click", () => {
      state.branchId = button.dataset.branch;
      state.stageIndex = 0;
      state.selected = null;
      state.checked = false;
      renderAll();
    });
  });
}

function renderPlayArea() {
  const subject = activeSubject();
  const branch = activeBranch();
  const stage = branch.stages[state.stageIndex] || branch.stages[0];
  const progress = loadProgress();
  const cleared = Number(progress[`${subject.id}:${branch.id}`] || 0);
  $("storyPlayArea").innerHTML = `
    <article class="story-stage-card">
      <div class="question-meta-row">
        <h3>${escapeHtml(branch.title)}：第 ${stage.level} 關</h3>
        <span class="answer-pill">${escapeHtml(stage.difficulty)}</span>
      </div>
      <p class="story-scene">${escapeHtml(stage.scene)}</p>
      <h4>${escapeHtml(stage.q)}</h4>
      <div class="practice-options">
        ${stage.options.map((option, index) => {
          const selected = state.selected === index;
          const reveal = state.checked ? (stage.answer === index ? "correct" : selected ? "wrong" : "") : "";
          return `<button type="button" class="practice-option ${selected ? "selected" : ""} ${reveal}" data-answer="${index}">
            <b>${String.fromCharCode(65 + index)}</b><span>${escapeHtml(option)}</span>
          </button>`;
        }).join("")}
      </div>
      <div class="practice-actions">
        <button id="checkStoryBtn" class="tool-btn"><i class="fa-solid fa-check"></i> 確認答案</button>
        <button id="nextStoryBtn" class="tool-btn secondary"><i class="fa-solid fa-forward"></i> 下一關</button>
      </div>
      <div class="story-clear-state">本支線已通關 ${cleared} / ${branch.stages.length} 關</div>
    </article>
  `;
  document.querySelectorAll("[data-answer]").forEach((button) => {
    button.addEventListener("click", () => {
      if (state.checked) return;
      state.selected = Number(button.dataset.answer);
      renderPlayArea();
    });
  });
  $("checkStoryBtn")?.addEventListener("click", checkStoryAnswer);
  $("nextStoryBtn")?.addEventListener("click", nextStoryStage);
}

function checkStoryAnswer() {
  const stage = activeBranch().stages[state.stageIndex];
  if (state.selected === null) {
    showToast("請先選擇答案");
    return;
  }
  state.checked = true;
  if (state.selected === stage.answer) {
    saveProgress(state.subjectId, state.branchId, stage.level);
    showToast("通關成功");
  } else {
    showToast("答錯了，可以再看一次正解");
  }
  renderAll();
}

function nextStoryStage() {
  const branch = activeBranch();
  state.stageIndex = (state.stageIndex + 1) % branch.stages.length;
  state.selected = null;
  state.checked = false;
  renderPlayArea();
}

function resetCurrentProgress() {
  const progress = loadProgress();
  delete progress[`${state.subjectId}:${state.branchId}`];
  localStorage.setItem(progressKey(), JSON.stringify(progress));
  showToast("已重設本支線進度");
  renderAll();
}

function renderAll() {
  $("storyUserName").textContent = userKey() === "guest" ? "訪客" : userKey();
  renderSubjects();
  renderBranches();
  renderPlayArea();
}

$("resetStoryBtn")?.addEventListener("click", resetCurrentProgress);
$("generateStoryBtn")?.addEventListener("click", generateAiStoryQuestions);
renderAll();
