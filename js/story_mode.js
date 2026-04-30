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

const EXTRA_SCENES = [
  "AI旁白把你的答案寫進冒險日誌，遠處出現新的光點。",
  "一段資料流在空中展開，角色收到下一個任務座標。",
  "你解開封印後，支線角色交給你一枚記憶碎片。",
  "系統生成新的分岔道路，難度也悄悄提升。",
  "故事核心偵測到你的學習軌跡，派出更精準的挑戰。",
];

const STORY_ARCS = {
  chinese: {
    place: "失落圖書館",
    goal: "修復被打散的文學星圖",
    clues: ["銀色書籤", "古文頁角", "比喻墨水", "主旨羅盤", "段落鑰匙", "詩句羽毛", "修辭透鏡", "論點印章", "語氣鈴鐺", "象徵花紋"],
    concepts: ["主旨判斷", "修辭辨識", "情緒語氣", "段落摘要", "古文詞意", "詩句意象", "因果推論", "對比手法", "作者觀點", "論證結構", "人物描寫", "場景描寫", "轉折詞", "成語語意", "引用作用", "象徵意涵", "敘事視角", "文本證據", "結論歸納", "跨段整合"],
  },
  english: {
    place: "晨星學院",
    goal: "集齊跨語言通行證",
    clues: ["時態徽章", "單字羽筆", "閱讀地圖", "句型鑰匙", "介系詞羅盤", "條件句水晶", "聽力鐘", "片語卡", "段落燈", "語境指南"],
    concepts: ["現在簡單式", "過去式", "未來式", "條件句", "比較級", "最高級", "介系詞", "連接詞", "代名詞", "被動語態", "現在完成式", "片語動詞", "閱讀主旨", "細節定位", "上下文推詞", "同義改寫", "語氣判斷", "段落排序", "句子合併", "摘要選擇"],
  },
  programming: {
    place: "Debug 城",
    goal: "啟動城市核心編譯器",
    clues: ["變數晶片", "條件門卡", "迴圈齒輪", "函式藍圖", "陣列地圖", "物件徽章", "例外警報", "搜尋光束", "排序軸心", "API通行碼"],
    concepts: ["變數用途", "資料型別", "if條件", "for迴圈", "while迴圈", "函式回傳", "陣列索引", "物件屬性", "布林邏輯", "錯誤處理", "字串處理", "事件監聽", "非同步概念", "API請求", "JSON格式", "二分搜尋", "排序概念", "時間複雜度", "測試案例", "程式重構"],
  },
  design: {
    place: "星光工作室",
    goal: "完成一套品牌視覺委託",
    clues: ["色彩樣票", "版面尺", "對比卡", "字體章", "留白指南", "元件貼紙", "網格板", "動線草圖", "品牌手冊", "可用性紀錄"],
    concepts: ["視覺層級", "色彩對比", "留白", "對齊", "重複", "親密性", "字體選擇", "品牌一致性", "按鈕狀態", "資訊架構", "使用者流程", "可讀性", "圖示語意", "網格系統", "響應式設計", "表單易用性", "錯誤提示", "設計系統", "無障礙對比", "原型測試"],
  },
  game: {
    place: "關卡實驗室",
    goal: "打造能留住玩家的試煉場",
    clues: ["教學腳本", "回饋火花", "難度曲線", "獎勵徽章", "關卡節奏器", "Boss圖紙", "任務卷軸", "平衡砝碼", "玩家路徑", "重玩符石"],
    concepts: ["核心玩法", "新手教學", "即時回饋", "難度曲線", "獎勵節奏", "關卡目標", "失敗成本", "玩家動機", "遊戲平衡", "Boss機制", "任務設計", "資源管理", "風險回報", "重玩性", "操作手感", "敘事節奏", "關卡引導", "成就設計", "社交互動", "留存機制"],
  },
  math: {
    place: "數字高塔",
    goal: "點亮二十層推理燈塔",
    clues: ["加法石板", "比例齒輪", "方程鑰匙", "幾何透鏡", "機率骰", "函數線索", "數列階梯", "統計卷軸", "面積方磚", "邏輯羅盤"],
    concepts: ["四則運算", "分數比較", "比例", "百分率", "一次方程", "等差數列", "面積", "周長", "角度", "座標", "平均數", "中位數", "機率", "倍數因數", "質數", "平方根", "函數關係", "圖表判讀", "速率", "邏輯推理"],
  },
};

SUBJECTS.push(
  {
    id: "science",
    title: "自然科學",
    icon: "fa-atom",
    summary: "從生物、物理到地球科學，完成實驗室探索。",
    branches: [{ id: "lab", title: "星塵實驗室", stages: [] }],
  },
  {
    id: "history",
    title: "世界歷史",
    icon: "fa-landmark",
    summary: "穿越文明、革命與大航海，拼回時間線。",
    branches: [{ id: "archive", title: "時光檔案館", stages: [] }],
  },
  {
    id: "geography",
    title: "地理環境",
    icon: "fa-earth-asia",
    summary: "判讀地圖、氣候與區域特色，完成探險委託。",
    branches: [{ id: "atlas", title: "雲端地圖局", stages: [] }],
  },
  {
    id: "ai_data",
    title: "AI與巨量資料",
    icon: "fa-database",
    summary: "理解資料、模型與判讀倫理，修復智慧城市。",
    branches: [{ id: "data-city", title: "資料星城", stages: [] }],
  }
);

Object.assign(STORY_ARCS, {
  science: {
    place: "星塵實驗室",
    goal: "完成跨領域實驗報告",
    clues: ["光合作用葉片", "電路火花", "星圖碎片", "岩層樣本", "顯微鏡片", "酸鹼試紙", "力學彈簧", "氣候雲圖", "細胞徽章", "能量晶核"],
    concepts: ["光合作用", "食物鏈", "細胞構造", "酸鹼判斷", "電路通路", "力與運動", "能量轉換", "聲音傳播", "光的反射", "水循環", "天氣判讀", "地震成因", "岩石分類", "星球運行", "人體循環", "消化系統", "生態平衡", "實驗變因", "資料紀錄", "科學推論"],
  },
  history: {
    place: "時光檔案館",
    goal: "把散落的世界時間線重新排序",
    clues: ["文明陶片", "航海羅盤", "革命傳單", "古城印章", "王朝年表", "工廠齒輪", "思想手稿", "貿易銀幣", "條約副本", "博物館鑰匙"],
    concepts: ["古埃及文明", "古希臘城邦", "羅馬共和", "絲路交流", "中古莊園", "文藝復興", "宗教改革", "大航海時代", "科學革命", "啟蒙運動", "工業革命", "法國大革命", "民族主義", "帝國主義", "世界大戰", "冷戰格局", "全球化", "文化交流", "史料判讀", "因果分析"],
  },
  geography: {
    place: "雲端地圖局",
    goal: "完成一張會自己更新的世界地圖",
    clues: ["等高線羽筆", "季風指針", "河流藍圖", "都市座標", "人口晶片", "板塊碎片", "雨林種子", "沙漠沙漏", "港口徽章", "能源礦石"],
    concepts: ["經緯度", "比例尺", "等高線", "氣候類型", "季風", "洋流", "河川地形", "板塊運動", "火山地震", "人口分布", "都市化", "農業區位", "工業區位", "交通節點", "能源資源", "環境保育", "災害防治", "區域特色", "地圖判讀", "空間分析"],
  },
  ai_data: {
    place: "資料星城",
    goal: "讓失控的推薦系統重新學會判斷",
    clues: ["資料表碎片", "特徵徽章", "模型羅盤", "偏誤警示燈", "雲端鑰匙", "視覺化面板", "清理腳本", "隱私封條", "API票券", "決策紀錄"],
    concepts: ["資料欄位", "資料清理", "缺失值", "資料視覺化", "平均數", "中位數", "離群值", "分類任務", "回歸任務", "訓練資料", "測試資料", "模型準確率", "過度擬合", "推薦系統", "資料偏誤", "隱私保護", "API資料", "儀表板", "決策解釋", "AI倫理"],
  },
});

function buildUniqueStages(subject) {
  const arc = STORY_ARCS[subject.id];
  if (!arc) return subject.branches[0].stages;
  return arc.concepts.map((concept, index) => {
    const level = index + 1;
    const difficulty = level <= 7 ? "easy" : level <= 14 ? "medium" : "hard";
    const clue = arc.clues[index % arc.clues.length];
    return {
      level,
      difficulty,
      scene: `第 ${level} 幕，${arc.place}的路徑延伸到「${concept}」房間。你取得「${clue}」，它提示下一段任務：${arc.goal}。`,
      q: `在${subject.title}的「${concept}」任務中，哪一個做法最能推進目標？`,
      options: [
        `先判斷${concept}的核心條件，再選擇答案`,
        `只看題目中最短的一句話就作答`,
        `忽略${concept}，直接依照選項順序猜`,
        `把所有看起來熟悉的詞都當成正解`,
      ],
      answer: 0,
    };
  });
}

function expandStorySubjects() {
  SUBJECTS.forEach((subject) => {
    subject.branches.forEach((branch) => {
      branch.stages = buildUniqueStages(subject);
    });
  });
}

expandStorySubjects();

const state = { subjectId: SUBJECTS[0].id, branchId: SUBJECTS[0].branches[0].id, stageIndex: 0, selected: null, checked: false, lastCorrect: false, lives: 3 };

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

function livesKey(subjectId = state.subjectId, branchId = state.branchId) {
  return `quizarena_story_lives_${userKey()}_${subjectId}_${branchId}`;
}

function storyAchievementKey() {
  return `quizarena_story_achievements_${userKey()}`;
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

function loadLives() {
  state.lives = Math.max(0, Math.min(3, Number(localStorage.getItem(livesKey()) || 3)));
}

function saveLives() {
  localStorage.setItem(livesKey(), String(Math.max(0, Math.min(3, state.lives))));
}

function resetRun(message = "生命歸零，故事已重新開始") {
  const progress = loadProgress();
  delete progress[`${state.subjectId}:${state.branchId}`];
  localStorage.setItem(progressKey(), JSON.stringify(progress));
  state.stageIndex = 0;
  state.selected = null;
  state.checked = false;
  state.lastCorrect = false;
  state.lives = 3;
  saveLives();
  showStoryModal("重新開始故事", message, "挑戰重置");
}

function storyClearedTotal() {
  const progress = loadProgress();
  return Object.values(progress).reduce((sum, value) => sum + Number(value || 0), 0);
}

function showStoryModal(title, text, badge = "劇情推進") {
  $("storyModalBadge").textContent = badge;
  $("storyModalTitle").textContent = title;
  $("storyModalText").textContent = text;
  $("storyModalBackdrop").classList.add("show");
}

function checkStoryAchievements() {
  let unlocked = [];
  try { unlocked = JSON.parse(localStorage.getItem(storyAchievementKey()) || "[]"); } catch { unlocked = []; }
  const total = storyClearedTotal();
  const achievements = [
    { id: "story_5", target: 5, title: "故事初探者", text: "你完成 5 個故事關卡，AI夥伴開始記住你的學習風格。" },
    { id: "story_20", target: 20, title: "支線旅人", text: "你完成 20 個故事關卡，解鎖跨科目支線稱號。" },
    { id: "story_60", target: 60, title: "知識冒險家", text: "你完成 60 個故事關卡，主線世界開啟更高階挑戰。" },
  ];
  const hit = achievements.find((item) => total >= item.target && !unlocked.includes(item.id));
  if (!hit) return false;
  unlocked.push(hit.id);
  localStorage.setItem(storyAchievementKey(), JSON.stringify(unlocked));
  showStoryModal(hit.title, hit.text, "成就解鎖");
  return true;
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
        count: 20,
        sourceMode: "ai",
        storyMode: true,
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
      state.lastCorrect = false;
      loadLives();
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
      state.lastCorrect = false;
      loadLives();
      renderAll();
    });
  });
}

function renderPlayArea() {
  const subject = activeSubject();
  const branch = activeBranch();
  const progress = loadProgress();
  const cleared = Number(progress[`${subject.id}:${branch.id}`] || 0);
  const isLocked = state.stageIndex > cleared;
  if (isLocked) {
    state.stageIndex = Math.min(cleared, branch.stages.length - 1);
    state.selected = null;
    state.checked = false;
    state.lastCorrect = false;
  }
  const stage = branch.stages[state.stageIndex] || branch.stages[0];
  const canGoNext = state.checked && state.lastCorrect && state.stageIndex < branch.stages.length - 1;
  $("storyPlayArea").innerHTML = `
    <article class="story-stage-card">
      <div class="question-meta-row">
        <h3>${escapeHtml(branch.title)}：第 ${stage.level} 關</h3>
        <div class="story-status-row">
          <span class="story-lives text-danger">${"♥".repeat(state.lives)}${"♡".repeat(3 - state.lives)}</span>
          <span class="answer-pill">${escapeHtml(stage.difficulty)}</span>
        </div>
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
        <button id="checkStoryBtn" class="tool-btn" ${state.checked ? "disabled" : ""}><i class="fa-solid fa-check"></i> 確認答案</button>
        <button id="nextStoryBtn" class="tool-btn secondary" ${canGoNext ? "" : "disabled"}><i class="fa-solid fa-forward"></i> 下一關</button>
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
    state.lastCorrect = true;
    saveProgress(state.subjectId, state.branchId, stage.level);
    state.lives = 3;
    saveLives();
    if (!checkStoryAchievements()) {
      showStoryModal(
        "新的支線片段",
        `${stage.scene} 你答對後，角色取得新的線索，下一關將更接近這個科目的核心能力。`
      );
    }
  } else {
    state.lastCorrect = false;
    state.lives -= 1;
    saveLives();
    if (state.lives <= 0) {
      resetRun("三顆愛心都扣完了，這條故事線需要從第一關重新開始。");
      return;
    }
    state.checked = false;
    state.selected = null;
    showToast(`答錯了，扣 1 顆愛心，剩下 ${state.lives} 顆`);
  }
  renderAll();
}

function nextStoryStage() {
  const branch = activeBranch();
  const progress = loadProgress();
  const cleared = Number(progress[`${state.subjectId}:${state.branchId}`] || 0);
  if (!(state.checked && state.lastCorrect) && state.stageIndex >= cleared) {
    showToast("答對這題後才能前往下一關");
    return;
  }
  state.stageIndex = Math.min(state.stageIndex + 1, branch.stages.length - 1);
  state.selected = null;
  state.checked = false;
  state.lastCorrect = false;
  renderPlayArea();
}

function resetCurrentProgress() {
  const progress = loadProgress();
  delete progress[`${state.subjectId}:${state.branchId}`];
  localStorage.setItem(progressKey(), JSON.stringify(progress));
  state.stageIndex = 0;
  state.selected = null;
  state.checked = false;
  state.lastCorrect = false;
  state.lives = 3;
  saveLives();
  showToast("已重設本支線進度");
  renderAll();
}

function renderAll() {
  loadLives();
  $("storyUserName").textContent = userKey() === "guest" ? "訪客" : userKey();
  renderSubjects();
  renderBranches();
  renderPlayArea();
}

$("resetStoryBtn")?.addEventListener("click", resetCurrentProgress);
$("generateStoryBtn")?.addEventListener("click", generateAiStoryQuestions);
$("storyModalCloseBtn")?.addEventListener("click", () => $("storyModalBackdrop").classList.remove("show"));
renderAll();
