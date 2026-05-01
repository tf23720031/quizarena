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
  {
    id: "geography",
    title: "地理",
    icon: "fa-earth-asia",
    summary: "穿越地形、氣候與城市網絡，理解世界如何運作。",
    branches: [{ id: "atlas-port", title: "星圖港口", stages: [] }],
  },
  {
    id: "civics",
    title: "公民",
    icon: "fa-scale-balanced",
    summary: "從權利、責任到公共議題，完成城市議會任務。",
    branches: [{ id: "council-city", title: "議會城", stages: [] }],
  },
  {
    id: "arts",
    title: "藝術",
    icon: "fa-palette",
    summary: "走進美術館，辨識風格、媒材與創作語言。",
    branches: [{ id: "color-museum", title: "色彩美術館", stages: [] }],
  },
  {
    id: "health",
    title: "健康教育",
    icon: "fa-heart-pulse",
    summary: "用營養、運動與心理健康知識完成生活任務。",
    branches: [{ id: "wellness-camp", title: "元氣營地", stages: [] }],
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
  geography: {
    place: "星圖港口",
    goal: "拼回世界地圖核心",
    clues: ["等高線羅盤", "氣候風向袋", "河流航線", "城市燈塔", "板塊石片", "人口圖層", "產業徽章", "海流瓶", "雨量尺", "比例尺"],
    concepts: ["地形判讀", "氣候類型", "河流流域", "人口分布", "都市機能", "產業活動", "交通路網", "經緯度", "比例尺", "板塊運動", "自然災害", "資源分布", "海洋環流", "季風", "地圖符號", "區域特色", "環境保育", "全球化", "觀光影響", "空間分析"],
  },
  civics: {
    place: "議會城",
    goal: "修復公共決策系統",
    clues: ["權利章", "責任票券", "法治鐘", "媒體濾鏡", "預算算盤", "投票章", "社群指南", "倫理燈", "契約筆", "公民地圖"],
    concepts: ["權利義務", "民主投票", "法治精神", "公共利益", "媒體識讀", "消費者權益", "家庭關係", "校園自治", "地方政府", "中央政府", "預算分配", "社會規範", "性別平等", "隱私保護", "網路公民", "契約責任", "公平正義", "志願服務", "公共議題", "理性溝通"],
  },
  arts: {
    place: "色彩美術館",
    goal: "喚醒沉睡的展覽廳",
    clues: ["色票", "構圖框", "筆觸放大鏡", "光影杯", "雕塑底座", "版畫滾輪", "節奏譜", "策展卡", "材質盒", "風格印章"],
    concepts: ["色彩三要素", "構圖", "透視", "光影", "媒材", "筆觸", "雕塑", "版畫", "設計元素", "節奏", "對稱", "比例", "風格辨識", "藝術流派", "策展", "視覺符號", "公共藝術", "文化脈絡", "創作意圖", "作品鑑賞"],
  },
  health: {
    place: "元氣營地",
    goal: "完成身心平衡訓練",
    clues: ["營養盤", "睡眠燈", "運動鞋", "情緒卡", "安全帽", "急救包", "水壺", "姿勢鏡", "壓力球", "人際橋"],
    concepts: ["均衡飲食", "睡眠習慣", "有氧運動", "肌力訓練", "情緒調節", "壓力管理", "人際溝通", "網路安全", "急救觀念", "用藥安全", "視力保健", "姿勢保健", "水分補充", "食品標示", "疾病預防", "心理健康", "拒絕技巧", "安全風險", "自我照顧", "健康目標"],
  },
};

function buildUniqueStages(subject) {
  const arc = STORY_ARCS[subject.id];
  if (!arc) return subject.branches[0].stages;
  return arc.concepts.map((concept, index) => {
    const level = index + 1;
    const difficulty = level <= 7 ? "easy" : level <= 14 ? "medium" : "hard";
    const clue = arc.clues[index % arc.clues.length];
    const options = buildPlausibleStoryOptions(subject.title, concept, arc.goal, index);
    return {
      level,
      difficulty,
      scene: `第 ${level} 幕，${arc.place}的路徑延伸到「${concept}」房間。你取得「${clue}」，它提示下一段任務：${arc.goal}。`,
      q: `在${subject.title}的「${concept}」任務中，哪一個做法最能推進目標？`,
      options: options.map((item) => item.text),
      answer: options.findIndex((item) => item.correct),
    };
  });
}

function buildPlausibleStoryOptions(subjectTitle, concept, goal, index) {
  const correct = `先辨認「${concept}」的關鍵條件，再用題目證據判斷`;
  const distractorSets = [
    [
      `只抓「${concept}」中的單一關鍵字，不檢查題目限制`,
      `把與「${concept}」相關但沒有證據的推論當成答案`,
      `先套用${subjectTitle}常見規則，但忽略本題例外條件`,
    ],
    [
      `選擇看起來最接近「${concept}」定義的敘述，不回到題幹比對`,
      `把${goal}當成唯一線索，略過選項中的細節差異`,
      `用上一題的解法處理「${concept}」，不重新確認情境`,
    ],
    [
      `先排除陌生詞，再把剩下最熟悉的「${concept}」說法當正解`,
      `把部分符合「${concept}」的選項視為完整答案`,
      `只比較選項長短，選出最像解釋「${concept}」的一項`,
    ],
  ];
  const distractors = distractorSets[index % distractorSets.length];
  return shuffleArray([
    { text: correct, correct: true },
    ...distractors.map((text) => ({ text, correct: false })),
  ]);
}

function expandStorySubjects() {
  SUBJECTS.forEach((subject) => {
    subject.branches.forEach((branch) => {
      branch.stages = buildUniqueStages(subject);
    });
  });
}

expandStorySubjects();

const state = { subjectId: SUBJECTS[0].id, branchId: SUBJECTS[0].branches[0].id, stageIndex: 0, selected: null, checked: false, hearts: 3, stageOrder: [] };

function shuffleArray(items) {
  return [...items].sort(() => Math.random() - 0.5);
}

function resetStoryRun(shuffle = false) {
  const branch = activeBranch();
  state.stageOrder = Array.from({ length: branch.stages.length }, (_, index) => index);
  if (shuffle) state.stageOrder = shuffleArray(state.stageOrder);
  state.stageIndex = 0;
  state.selected = null;
  state.checked = false;
  state.hearts = 3;
}

function customStoryBanksKey() {
  return `quizarena_story_custom_banks_${userKey()}`;
}

function normalizeStoryStageFromQuestion(question, index, subjectTitle) {
  return makeStoryStageFromQuestion(question, index, subjectTitle);
}

function addCustomStorySubject(title, questions, options = {}) {
  const safeTitle = String(title || "自訂故事題庫").trim();
  const stages = questions.map((question, index) => normalizeStoryStageFromQuestion(question, index, safeTitle));
  const subject = {
    id: options.id || `custom_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    title: safeTitle,
    icon: options.icon || "fa-book-open",
    summary: options.summary || "玩家新增的故事題庫，會以支線形式逐題推進。",
    custom: true,
    branches: [{ id: "main", title: `${safeTitle}故事線`, stages }],
  };
  SUBJECTS.push(subject);
  state.subjectId = subject.id;
  state.branchId = "main";
  state.stageIndex = 0;
  state.selected = null;
  state.checked = false;
  state.stageOrder = [];
  state.hearts = 3;
  return subject;
}

function loadCustomStorySubjects() {
  let banks = [];
  try { banks = JSON.parse(localStorage.getItem(customStoryBanksKey()) || "[]"); } catch { banks = []; }
  const previous = { subjectId: state.subjectId, branchId: state.branchId };
  banks.filter((bank) => Array.isArray(bank.questions) && bank.questions.length >= 5).forEach((bank) => {
    if (!SUBJECTS.some((subject) => subject.id === bank.id)) {
      addCustomStorySubject(bank.title, bank.questions, {
        id: bank.id,
        icon: bank.icon || "fa-book-open",
        summary: bank.summary || "玩家新增的故事題庫，會以支線形式逐題推進。",
      });
    }
  });
  state.subjectId = previous.subjectId;
  state.branchId = previous.branchId;
  state.stageOrder = [];
  state.hearts = 3;
}

function saveCustomStorySubject(subject) {
  let banks = [];
  try { banks = JSON.parse(localStorage.getItem(customStoryBanksKey()) || "[]"); } catch { banks = []; }
  const bank = {
    id: subject.id,
    title: subject.title,
    icon: subject.icon,
    summary: subject.summary,
    questions: subject.branches[0].stages.map((stage) => ({
      id: `${subject.id}_${stage.level}`,
      title: `${subject.title} 第 ${stage.level} 題`,
      content: stage.q,
      difficulty: stage.difficulty,
      explanation: stage.scene,
      options: stage.options.map((text, index) => ({ text, correct: index === stage.answer })),
    })),
  };
  banks = banks.filter((item) => item.id !== bank.id);
  banks.unshift(bank);
  localStorage.setItem(customStoryBanksKey(), JSON.stringify(banks.slice(0, 20)));
}

loadCustomStorySubjects();

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
  const explicitAnswer = Number.isInteger(Number(question.answer)) ? Number(question.answer) : -1;
  const answer = Math.max(0, explicitAnswer >= 0 ? explicitAnswer : options.findIndex((option) => option.correct));
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

function uniqueQuestions(questions) {
  const seenQuestions = new Set();
  return (Array.isArray(questions) ? questions : []).filter((question) => {
    const content = String(question.content || question.q || question.title || "").trim();
    if (!content || seenQuestions.has(content)) return false;
    seenQuestions.add(content);
    const options = Array.isArray(question.options) ? question.options : [];
    const optionTexts = options.map((option) => String(option?.text || option || "").trim()).filter(Boolean);
    return optionTexts.length >= 2 && new Set(optionTexts).size === optionTexts.length;
  });
}

async function generateTopicStoryBank() {
  const input = $("aiStoryTopicInput");
  const button = $("generateTopicBankBtn");
  const topic = String(input?.value || "").trim();
  if (!topic) {
    showToast("請先輸入要生成的主題");
    return;
  }
  if (button) {
    button.disabled = true;
    button.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> 生成中';
  }
  try {
    const data = await api("/generate_quiz_bank", {
      method: "POST",
      body: JSON.stringify({
        topic,
        category: topic,
        difficulty: "medium",
        language: "zh",
        count: 20,
        sourceMode: "ai",
        storyMode: true,
      }),
    });
    const questions = uniqueQuestions(data.quizBank?.questions || []).slice(0, 20);
    if (questions.length < 20) throw new Error("AI 題庫需要至少 20 題，且題目與選項不能重複");
    const subject = addCustomStorySubject(topic, questions, {
      icon: "fa-wand-magic-sparkles",
      summary: `AI 生成的「${topic}」故事線，共 20 題。`,
    });
    saveCustomStorySubject(subject);
    showToast(`已生成「${topic}」故事題庫`);
    renderAll();
  } catch (error) {
    showToast(error.message || "AI生成失敗，請稍後再試", 3200);
  } finally {
    if (button) {
      button.disabled = false;
      button.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> 生成題庫';
    }
  }
}

function extractQuestionsFromUpload(raw) {
  if (Array.isArray(raw)) return raw;
  if (Array.isArray(raw?.questions)) return raw.questions;
  if (Array.isArray(raw?.quizBank?.questions)) return raw.quizBank.questions;
  if (Array.isArray(raw?.banks?.[0]?.questions)) return raw.banks[0].questions;
  return [];
}

async function uploadStoryBank() {
  const input = $("uploadStoryBankInput");
  const file = input?.files?.[0];
  if (!file) {
    showToast("請先選擇 JSON 題庫檔");
    return;
  }
  try {
    const raw = JSON.parse(await file.text());
    const title = String(raw.title || raw.quizBank?.title || file.name.replace(/\.json$/i, "") || "自訂故事題庫").trim();
    const questions = uniqueQuestions(extractQuestionsFromUpload(raw));
    if (questions.length < 5) throw new Error("上傳題庫必須有 5 題或以上，且題目與選項不可重複");
    const subject = addCustomStorySubject(title, questions, {
      icon: "fa-upload",
      summary: `玩家上傳的「${title}」故事線，共 ${questions.length} 題。`,
    });
    saveCustomStorySubject(subject);
    showToast(`已匯入「${title}」`);
    renderAll();
  } catch (error) {
    showToast(error.message || "題庫 JSON 格式錯誤", 3200);
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
      resetStoryRun(false);
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
      resetStoryRun(false);
      renderAll();
    });
  });
}

function renderPlayArea() {
  const subject = activeSubject();
  const branch = activeBranch();
  if (!state.stageOrder.length || state.stageOrder.length !== branch.stages.length) resetStoryRun(false);
  const stageRealIndex = state.stageOrder[state.stageIndex] ?? 0;
  const stage = branch.stages[stageRealIndex] || branch.stages[0];
  const progress = loadProgress();
  const cleared = Number(progress[`${subject.id}:${branch.id}`] || 0);
  const hearts = Array.from({ length: 3 }, (_, index) => `<i class="fa-solid fa-heart ${index >= state.hearts ? "lost" : ""}"></i>`).join("");
  $("storyPlayArea").innerHTML = `
    <article class="story-stage-card">
      <div class="question-meta-row">
        <h3>${escapeHtml(branch.title)}：第 ${stage.level} 關</h3>
        <div class="story-heart-row" aria-label="剩餘生命 ${state.hearts}">${hearts}</div>
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
}

function checkStoryAnswer() {
  const branch = activeBranch();
  const stage = branch.stages[state.stageOrder[state.stageIndex] ?? 0];
  if (state.checked) return;
  if (state.selected === null) {
    showToast("請先選擇答案");
    return;
  }
  state.checked = true;
  if (state.selected === stage.answer) {
    saveProgress(state.subjectId, state.branchId, stage.level);
    checkStoryAchievements();
    showToast("答對了，前往下一題");
    setTimeout(nextStoryStage, 450);
  } else {
    addToWrongBook(stage, activeSubject().title);
    state.hearts = Math.max(0, state.hearts - 1);
    if (state.hearts <= 0) {
      const progress = loadProgress();
      delete progress[`${state.subjectId}:${state.branchId}`];
      localStorage.setItem(progressKey(), JSON.stringify(progress));
      showToast("三顆愛心用完，題庫重新開始並打亂順序", 2600);
      resetStoryRun(true);
    } else {
      showToast(`答錯了，扣 1 顆愛心，剩下 ${state.hearts} 顆`);
      setTimeout(nextStoryStage, 900);
    }
    renderAll();
    return;
  }
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
$("generateTopicBankBtn")?.addEventListener("click", generateTopicStoryBank);
$("uploadStoryBankBtn")?.addEventListener("click", uploadStoryBank);
$("storyModalCloseBtn")?.addEventListener("click", () => $("storyModalBackdrop").classList.remove("show"));
renderAll();


// ═══════════════════════════════════════════════════════
//  錯題本整合
// ═══════════════════════════════════════════════════════
function wrongBookKey() {
  return `quizarena_wrong_book_${userKey()}`;
}

function addToWrongBook(stage, subjectTitle) {
  if (!stage) return;
  const username = userKey();
  if (username && username !== "guest") {
    api("/story_wrong_question", {
      method: "POST",
      body: JSON.stringify({ username, sourceTitle: `故事模式 - ${subjectTitle}`, question: stage }),
    }).catch((error) => console.warn("[WrongBook] story sync failed", error));
    return;
  }
  try {
    const book = JSON.parse(localStorage.getItem(wrongBookKey()) || "[]");
    const existing = book.findIndex((item) => item.q === stage.q);
    if (existing >= 0) {
      book[existing].wrongCount = (book[existing].wrongCount || 1) + 1;
      book[existing].lastWrongAt = Date.now();
    } else {
      book.push({
        q: stage.q,
        options: stage.options,
        answer: stage.answer,
        difficulty: stage.difficulty || "medium",
        source: `故事模式 · ${subjectTitle}`,
        wrongCount: 1,
        lastWrongAt: Date.now(),
      });
    }
    localStorage.setItem(wrongBookKey(), JSON.stringify(book));
  } catch (e) {
    console.warn("[WrongBook] 寫入失敗", e);
  }
}

// ═══════════════════════════════════════════════════════
//  模式選擇系統
// ═══════════════════════════════════════════════════════
let currentStoryMode = "solo"; // "solo" | "pvp" | "coop"

function setStoryMode(mode) {
  currentStoryMode = mode;
  const pill = $("storyModePill");
  const multiPanel = $("storyMultiPanel");
  const soloSection = $("storySoloSection");
  const duelSection = $("storyDuelSection");
  const subjectSection = document.querySelector(".story-subject-grid")?.closest(".tool-card");
  const branchSection = $("storyBranchList")?.closest(".tool-card");

  document.querySelectorAll(".story-mode-tab").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.mode === mode);
  });

  if (mode === "solo") {
    if (pill) pill.textContent = "單人闖關";
    if (multiPanel) multiPanel.style.display = "none";
    if (soloSection) soloSection.style.display = "";
    if (duelSection) duelSection.style.display = "none";
    if (subjectSection) subjectSection.style.display = "";
    if (branchSection) branchSection.style.display = "";
    renderAll();
  } else {
    if (pill) pill.textContent = mode === "pvp" ? "挑戰模式" : "合作模式";
    if (multiPanel) multiPanel.style.display = "";
    if (soloSection) soloSection.style.display = "none";
    if (duelSection) duelSection.style.display = "none";
    if (subjectSection) subjectSection.style.display = "";
    if (branchSection) branchSection.style.display = "";
  }
}

document.querySelectorAll(".story-mode-tab").forEach((btn) => {
  btn.addEventListener("click", () => setStoryMode(btn.dataset.mode));
});

// ═══════════════════════════════════════════════════════
//  雙人邀請系統：題庫選定後，等第二位玩家加入才開始
// ═══════════════════════════════════════════════════════
let storyMatchPoll = null;

function buildChallengeLink(token, mode, subjectId, branchId) {
  const base = location.href.split("?")[0];
  return `${base}?challenge=${token}&mode=${mode}&sub=${subjectId}&branch=${branchId}`;
}

function parseChallengeLink(url) {
  try {
    const u = new URL(url);
    return {
      token: u.searchParams.get("challenge"),
      mode: u.searchParams.get("mode"),
      subjectId: u.searchParams.get("sub"),
      branchId: u.searchParams.get("branch"),
    };
  } catch {
    return null;
  }
}

function clearStoryMatchPoll() {
  if (storyMatchPoll) clearInterval(storyMatchPoll);
  storyMatchPoll = null;
}

function startMatchWhenReady(match, roleName = userKey()) {
  if (!match || match.status !== "ready" || !Array.isArray(match.players) || match.players.length < 2) return false;
  clearStoryMatchPoll();
  const waitingMsg = $("storyWaitingMsg");
  if (waitingMsg) waitingMsg.style.display = "none";
  const names = match.players.slice(0, 2).map((player) => player.name);
  const me = String(roleName || userKey() || names[0]).trim();
  const other = names.find((name) => name !== me) || names[1] || "玩家 2";
  currentStoryMode = match.mode || currentStoryMode;
  startDuelGame(me, other, currentStoryMode, match.stages || activeBranch().stages);
  return true;
}

function pollStoryMatch(token, roleName = userKey()) {
  clearStoryMatchPoll();
  storyMatchPoll = setInterval(async () => {
    try {
      const data = await api(`/story_match_state/${encodeURIComponent(token)}`);
      startMatchWhenReady(data.match, roleName);
    } catch (error) {
      clearStoryMatchPoll();
      showToast(error.message || "邀請狀態讀取失敗");
    }
  }, 1200);
}

$("createChallengeBtn")?.addEventListener("click", async () => {
  const subject = activeSubject();
  const branch = activeBranch();
  const linkDisplay = $("storyLinkDisplay");
  const linkText = $("storyLinkText");
  const waitingMsg = $("storyWaitingMsg");
  const hostName = userKey() === "guest" ? "玩家 1" : userKey();
  try {
    const data = await api("/story_match_create", {
      method: "POST",
      body: JSON.stringify({
        mode: currentStoryMode,
        hostName,
        subjectId: state.subjectId,
        branchId: state.branchId,
        subjectTitle: subject.title,
        stages: branch.stages.slice(0, 20),
      }),
    });
    const token = data.match.token;
    const link = buildChallengeLink(token, currentStoryMode, state.subjectId, state.branchId);
    if (linkText) linkText.textContent = link;
    if (linkDisplay) linkDisplay.style.display = "";
    if (waitingMsg) {
      waitingMsg.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> 題庫已選定，等待另一位玩家加入...';
      waitingMsg.style.display = "";
    }
    showToast("邀請連結已建立，另一位玩家加入後才會開始");
    pollStoryMatch(token, hostName);
  } catch (error) {
    showToast(error.message || "建立邀請失敗");
  }
});

$("copyLinkBtn")?.addEventListener("click", () => {
  const link = $("storyLinkText")?.textContent || "";
  if (!link) return;
  navigator.clipboard.writeText(link).then(() => showToast("連結已複製！")).catch(() => {
    // fallback
    const ta = document.createElement("textarea");
    ta.value = link;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    ta.remove();
    showToast("連結已複製！");
  });
});

$("joinChallengeBtn")?.addEventListener("click", async () => {
  const raw = $("challengeLinkInput")?.value?.trim() || "";
  if (!raw) { showToast("請先貼上邀請連結"); return; }
  const parsed = parseChallengeLink(raw);
  if (!parsed?.token) { showToast("連結格式不正確"); return; }
  if (parsed.subjectId) state.subjectId = parsed.subjectId;
  if (parsed.branchId) state.branchId = parsed.branchId;
  const mode = parsed.mode || "pvp";
  currentStoryMode = mode;
  const playerName = userKey() === "guest" ? "玩家 2" : userKey();
  try {
    const data = await api("/story_match_join", {
      method: "POST",
      body: JSON.stringify({ token: parsed.token, playerName }),
    });
    showToast("已加入，雙方到齊後開始");
    if (!startMatchWhenReady(data.match, playerName)) pollStoryMatch(parsed.token, playerName);
  } catch (error) {
    showToast(error.message || "加入邀請失敗");
  }
});

// 頁面載入時自動判斷 URL 參數（被貼入連結後跳轉）
(function checkIncomingChallenge() {
  const params = new URLSearchParams(location.search);
  const token = params.get("challenge");
  const mode = params.get("mode");
  const subjectId = params.get("sub");
  const branchId = params.get("branch");
  if (!token) return;
  if (subjectId) state.subjectId = subjectId;
  if (branchId) state.branchId = branchId;
  if (mode) currentStoryMode = mode;
  setTimeout(async () => {
    setStoryMode(mode || "pvp");
    const playerName = userKey() === "guest" ? "玩家 2" : userKey();
    try {
      const data = await api("/story_match_join", {
        method: "POST",
        body: JSON.stringify({ token, playerName }),
      });
      showToast("已加入故事邀請，準備開始");
      if (!startMatchWhenReady(data.match, playerName)) pollStoryMatch(token, playerName);
    } catch (error) {
      showToast(error.message || "加入邀請失敗");
    }
  }, 600);
})();

// ═══════════════════════════════════════════════════════
//  雙人遊戲引擎
// ═══════════════════════════════════════════════════════
const DUEL_TOTAL = 20;
const DUEL_TIME = 10;
const MAX_SCORE_PER_Q = 1000;

const duelState = {
  mode: "pvp",         // "pvp" | "coop"
  stages: [],
  index: 0,
  scores: [0, 0],
  names: ["你", "對手"],
  answered: false,     // 本題是否已有人送出（合作用）
  timerInterval: null,
  timeLeft: DUEL_TIME,
};

function startDuelGame(nameLeft, nameRight, mode, stages) {
  duelState.mode = mode;
  duelState.stages = stages.slice(0, DUEL_TOTAL);
  // 若題目不足 20 題，循環補足
  while (duelState.stages.length < DUEL_TOTAL) {
    duelState.stages.push(...stages.slice(0, DUEL_TOTAL - duelState.stages.length));
  }
  duelState.index = 0;
  duelState.scores = [0, 0];
  duelState.names = [nameLeft, nameRight];

  // 顯示雙人區塊，隱藏單人
  $("storySoloSection").style.display = "none";
  $("storyDuelSection").style.display = "";
  $("storyMultiPanel").style.display = "none";
  $("duelResultOverlay").style.display = "none";

  if ($("duelNameLeft")) $("duelNameLeft").textContent = nameLeft;
  if ($("duelNameRight")) $("duelNameRight").textContent = nameRight;
  if ($("duelModeLabel")) $("duelModeLabel").textContent = mode === "pvp" ? "挑戰模式" : "合作模式";

  renderDuelQuestion();
}

function renderDuelQuestion() {
  const stage = duelState.stages[duelState.index];
  if (!stage) { endDuelGame(); return; }
  duelState.answered = false;

  // 進度
  if ($("duelQIndex")) $("duelQIndex").textContent = `第 ${duelState.index + 1} 題`;
  if ($("duelScoreLeft")) $("duelScoreLeft").textContent = duelState.scores[0];
  if ($("duelScoreRight")) $("duelScoreRight").textContent = duelState.scores[1];

  // 題目
  if ($("duelQuestionBox")) $("duelQuestionBox").textContent = stage.q;

  // 選項
  if ($("duelOptions")) {
    $("duelOptions").innerHTML = stage.options.map((opt, i) => `
      <button class="duel-option-btn" data-idx="${i}">
        <b>${String.fromCharCode(65 + i)}</b><span>${escapeHtml(opt)}</span>
      </button>
    `).join("");
    $("duelOptions").querySelectorAll(".duel-option-btn").forEach((btn) => {
      btn.addEventListener("click", () => onDuelAnswer(Number(btn.dataset.idx)));
    });
  }

  // 合作模式提示重置
  if ($("coopAnsweredMsg")) $("coopAnsweredMsg").style.display = "none";

  // 倒數計時
  startDuelTimer();
}

function startDuelTimer() {
  clearInterval(duelState.timerInterval);
  duelState.timeLeft = DUEL_TIME;
  updateTimerUI();
  duelState.timerInterval = setInterval(() => {
    duelState.timeLeft--;
    updateTimerUI();
    if (duelState.timeLeft <= 0) {
      clearInterval(duelState.timerInterval);
      if (!duelState.answered) {
        // 超時：答錯，加入錯題本
        const stage = duelState.stages[duelState.index];
        addToWrongBook(stage, activeSubject().title);
        highlightDuelAnswer(-1, stage.answer);
        setTimeout(() => advanceDuel(), 1200);
      }
    }
  }, 1000);
}

function updateTimerUI() {
  const pct = (duelState.timeLeft / DUEL_TIME) * 100;
  if ($("duelTimerDisplay")) $("duelTimerDisplay").textContent = duelState.timeLeft;
  if ($("duelTimerFill")) {
    $("duelTimerFill").style.width = pct + "%";
    $("duelTimerFill").style.background =
      duelState.timeLeft > 5 ? "linear-gradient(90deg,#7c7bff,#ff8fbd)"
        : "linear-gradient(90deg,#ff4444,#ff8800)";
  }
}

function onDuelAnswer(idx) {
  if (duelState.answered) return;
  if (duelState.timeLeft <= 0) return;
  duelState.answered = true;
  clearInterval(duelState.timerInterval);

  const stage = duelState.stages[duelState.index];
  const isCorrect = idx === stage.answer;

  // 計分：剩餘時間越多分越高
  const bonus = Math.round((duelState.timeLeft / DUEL_TIME) * MAX_SCORE_PER_Q);
  const points = isCorrect ? Math.max(100, bonus) : 0;

  if (duelState.mode === "pvp") {
    // PvP：玩家0（左）得分
    duelState.scores[0] += points;
    // 模擬對手（右）答題
    const opponentCorrect = Math.random() > 0.45;
    const opponentTime = Math.random() * DUEL_TIME;
    const opponentPoints = opponentCorrect
      ? Math.max(100, Math.round((opponentTime / DUEL_TIME) * MAX_SCORE_PER_Q))
      : 0;
    duelState.scores[1] += opponentPoints;
  } else {
    // Coop：合併得分到左
    duelState.scores[0] += points;
    if ($("coopAnsweredMsg")) $("coopAnsweredMsg").style.display = "";
  }

  if (!isCorrect) addToWrongBook(stage, activeSubject().title);

  highlightDuelAnswer(idx, stage.answer);
  setTimeout(() => advanceDuel(), 1400);
}

function highlightDuelAnswer(selected, correct) {
  document.querySelectorAll(".duel-option-btn").forEach((btn) => {
    const i = Number(btn.dataset.idx);
    btn.disabled = true;
    if (i === correct) btn.classList.add("duel-correct");
    else if (i === selected) btn.classList.add("duel-wrong");
  });
  if ($("duelScoreLeft")) $("duelScoreLeft").textContent = duelState.scores[0];
  if ($("duelScoreRight")) $("duelScoreRight").textContent = duelState.scores[1];
}

function advanceDuel() {
  duelState.index++;
  if (duelState.index >= duelState.stages.length) {
    endDuelGame();
  } else {
    renderDuelQuestion();
  }
}

function endDuelGame() {
  clearInterval(duelState.timerInterval);
  const [s0, s1] = duelState.scores;
  const [n0, n1] = duelState.names;
  const isPvp = duelState.mode === "pvp";

  let icon = "🏆", title = "";
  if (isPvp) {
    if (s0 > s1) { icon = "🏆"; title = `${n0} 獲勝！`; }
    else if (s1 > s0) { icon = "😅"; title = `${n1} 獲勝！`; }
    else { icon = "🤝"; title = "平局！"; }
  } else {
    const total = s0;
    icon = total >= 10000 ? "🎉" : "💪";
    title = `合作得分：${total}`;
  }

  if ($("duelResultIcon")) $("duelResultIcon").textContent = icon;
  if ($("duelResultTitle")) $("duelResultTitle").textContent = title;
  if ($("duelFinalNameLeft")) $("duelFinalNameLeft").textContent = n0;
  if ($("duelFinalScoreLeft")) $("duelFinalScoreLeft").textContent = s0;
  if ($("duelFinalNameRight")) $("duelFinalNameRight").textContent = n1;
  if ($("duelFinalScoreRight")) $("duelFinalScoreRight").textContent = s1;
  if ($("duelResultOverlay")) $("duelResultOverlay").style.display = "";
}

$("duelPlayAgainBtn")?.addEventListener("click", () => {
  $("duelResultOverlay").style.display = "none";
  startDuelGame(duelState.names[0], duelState.names[1], duelState.mode, activeBranch().stages);
});

$("duelBackBtn")?.addEventListener("click", () => {
  clearInterval(duelState.timerInterval);
  $("storyDuelSection").style.display = "none";
  $("storySoloSection").style.display = "";
  setStoryMode("solo");
});
