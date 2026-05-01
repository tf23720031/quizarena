// ── 題庫公開市集 ──
// 使用 localStorage 模擬共享市集（實際部署時替換為 API）
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

const MKT_KEY = "quizarena_marketplace_v1";
let currentFilter = "all";
let searchQuery = "";

const AI_MARKET_TOPICS = [
  ["ai_science", "AI設計：自然科學探索", "自然科學", "從光合作用、力學到生態系的 20 題基礎挑戰。"],
  ["ai_history", "AI設計：世界歷史冒險", "歷史", "用事件因果、文明交流與時代脈絡串成 20 題歷史題。"],
  ["ai_english", "AI設計：英文閱讀文法", "英文", "單字、時態、閱讀推論與語境判斷混合的 20 題。"],
  ["ai_math", "AI設計：數學推理塔", "數學", "運算、比例、數列、幾何與資料判讀的 20 題。"],
  ["ai_programming", "AI設計：程式邏輯入門", "程式語言", "變數、條件、迴圈、資料結構與除錯觀念的 20 題。"],
  ["ai_design", "AI設計：設計與遊戲企劃", "設計概論", "視覺層級、使用者流程、遊戲回饋與平衡的 20 題。"],
];

function buildAiQuestions(topicId, category) {
  const concepts = {
    "自然科學": ["光合作用", "力與運動", "生態系", "水循環", "物質狀態", "電路", "聲音", "光影", "天氣", "地震", "細胞", "消化", "能量轉換", "磁力", "酸鹼", "月相", "岩石", "分類", "實驗變因", "科學推論"],
    "歷史": ["文明起源", "農業革命", "城邦", "帝國", "貿易路線", "宗教改革", "文藝復興", "工業革命", "殖民", "民主制度", "戰爭原因", "條約", "文化交流", "科技傳播", "民族國家", "冷戰", "全球化", "史料判讀", "因果關係", "時序排列"],
    "英文": ["現在式", "過去式", "未來式", "比較級", "最高級", "介系詞", "連接詞", "代名詞", "被動語態", "完成式", "片語動詞", "閱讀主旨", "細節定位", "推論", "語氣", "同義詞", "上下文", "段落排序", "條件句", "摘要"],
    "數學": ["四則運算", "分數", "比例", "百分率", "一次方程", "面積", "周長", "角度", "座標", "平均數", "中位數", "機率", "倍數", "因數", "質數", "平方根", "數列", "速率", "圖表", "邏輯"],
    "程式語言": ["變數", "資料型別", "if 條件", "for 迴圈", "while 迴圈", "函式", "陣列", "物件", "布林值", "字串", "事件", "JSON", "API", "非同步", "錯誤處理", "搜尋", "排序", "測試", "重構", "註解"],
    "設計概論": ["視覺層級", "對比", "留白", "對齊", "重複", "親密性", "色彩", "字體", "品牌", "按鈕狀態", "表單", "資訊架構", "使用者流程", "無障礙", "原型", "回饋", "難度曲線", "獎勵", "社交互動", "留存"],
  }[category] || [];
  return concepts.map((concept, index) => ({
    id: `${topicId}_${index + 1}`,
    title: `${category}第 ${index + 1} 題`,
    content: `關於「${concept}」，哪一個做法最符合${category}的學習重點？`,
    type: "single",
    category,
    difficulty: index < 7 ? "easy" : index < 14 ? "medium" : "hard",
    time: "20 秒",
    score: 1000,
    explanation: `這題檢查「${concept}」的核心概念，先抓關鍵條件再判斷答案。`,
    options: [
      { text: `先理解${concept}的核心條件再作答`, correct: true },
      { text: `只看最短的選項就作答`, correct: false },
      { text: `忽略題目情境直接猜測`, correct: false },
      { text: `把熟悉的字都當成正解`, correct: false },
    ],
  }));
}

function loadMarket() {
  try { return JSON.parse(localStorage.getItem(MKT_KEY) || "[]"); } catch { return []; }
}
function saveMarket(data) { localStorage.setItem(MKT_KEY, JSON.stringify(data)); }
function normalizeUploadedBank(raw, fallbackTitle = "上傳題庫") {
  if (!raw || typeof raw !== "object") return { title: fallbackTitle, questions: [] };
  const questions = Array.isArray(raw) ? raw : (raw.questions || raw.quizBank?.questions || raw.banks?.[0]?.questions || []);
  const title = raw.title || raw.quizBank?.title || raw.banks?.[0]?.title || fallbackTitle;
  return { title, questions: Array.isArray(questions) ? questions : [] };
}
function ensureAiMarketBanks() {
  const market = loadMarket();
  let changed = false;
  AI_MARKET_TOPICS.forEach(([id, title, category, description]) => {
    if (market.some((bank) => bank.id === id)) return;
    market.push({
      id,
      title,
      author: "QuizArena AI",
      description,
      questions: buildAiQuestions(id, category),
      categories: [category, "AI設計"],
      source: "ai",
      copyCount: 0,
      ratings: [],
      publishedAt: Date.now() - (AI_MARKET_TOPICS.findIndex((item) => item[0] === id) + 1) * 3600 * 1000,
    });
    changed = true;
  });
  if (changed) saveMarket(market);
}

function getCurrentUser() { return localStorage.getItem("currentUser") || "匿名玩家"; }
function loadMyBanks() {
  try { return JSON.parse(localStorage.getItem("quizBanks") || "[]"); } catch { return []; }
}

function getThisWeekCount(market) {
  const weekAgo = Date.now() - 7 * 24 * 3600 * 1000;
  return market.filter(b => b.publishedAt > weekAgo).length;
}
function getAvgRating(market) {
  const rated = market.filter(b => b.ratings?.length);
  if (!rated.length) return "-";
  const avg = rated.reduce((s, b) => s + b.ratings.reduce((a, r) => a + r, 0) / b.ratings.length, 0) / rated.length;
  return avg.toFixed(1) + " ★";
}

function filterAndSearch(market) {
  let result = [...market];
  if (currentFilter === "hot") result.sort((a, b) => (b.copyCount || 0) - (a.copyCount || 0));
  else if (currentFilter === "new") result.sort((a, b) => b.publishedAt - a.publishedAt);
  else if (currentFilter === "mine") result = result.filter(b => b.author === getCurrentUser());
  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    result = result.filter(b =>
      b.title.toLowerCase().includes(q) ||
      (b.description || '').toLowerCase().includes(q) ||
      (b.categories || []).some(c => c.toLowerCase().includes(q)));
  }
  return result;
}

function avgRating(bank) {
  if (!bank.ratings?.length) return 0;
  return bank.ratings.reduce((a, b) => a + b, 0) / bank.ratings.length;
}

function renderStars(rating, bankId) {
  return [1,2,3,4,5].map(n =>
    `<span class="mkt-star" data-bank="${bankId}" data-star="${n}" style="color:${n<=Math.round(rating)?'#f59e0b':'#ddd'}">${n<=Math.round(rating)?'★':'☆'}</span>`
  ).join('');
}

function renderLeaderboard(market) {
  const board = $("mktLeaderboard"); if (!board) return;
  const top = [...market].sort((a, b) => (b.copyCount || 0) - (a.copyCount || 0)).slice(0, 5);
  if (!top.length) { board.innerHTML = `<p style="color:#aaa">尚無公開題庫</p>`; return; }
  const numClass = i => ['gold','silver','bronze','other','other'][i] || 'other';
  const rankIcons = ['🥇','🥈','🥉','🎖️','🏅'];
  const catIcons = { '自然科學':'fa-flask','歷史':'fa-landmark','英文':'fa-language','數學':'fa-calculator','程式語言':'fa-code','設計概論':'fa-pen-nib' };
  board.innerHTML = top.map((b, i) => {
    const cat = (b.categories||[])[0]||'';
    const fIcon = catIcons[cat] || 'fa-book-open';
    return `
    <div class="mkt-rank-item">
      <div class="mkt-rank-num ${numClass(i)}">${rankIcons[i]||i+1}</div>
      <div class="mkt-rank-icon"><i class="fa-solid ${fIcon}"></i></div>
      <div class="mkt-rank-info">
        <strong>${escapeHtml(b.title)}</strong>
        <span><i class="fa-solid fa-user" style="font-size:.7rem"></i> ${escapeHtml(b.author)} ・ ${b.questions?.length || 0} 題</span>
      </div>
      <div class="mkt-rank-score"><i class="fa-solid fa-copy" style="font-size:.8rem"></i> ${b.copyCount || 0}</div>
    </div>`;
  }).join('');
}

function renderBankList(market) {
  const list = $("mktBankList"); const note = $("mktResultNote");
  const filtered = filterAndSearch(market);
  note.textContent = `共 ${filtered.length} 個題庫`;
  if (!filtered.length) {
    list.innerHTML = `<div class="question-card"><h3>找不到相符題庫</h3><p>換個關鍵字試試，或上架你自己的！</p></div>`;
    return;
  }
  const catIcons2 = { '自然科學':'fa-flask','歷史':'fa-landmark','英文':'fa-language','數學':'fa-calculator','程式語言':'fa-code','設計概論':'fa-pen-nib','AI設計':'fa-wand-magic-sparkles' };
  list.innerHTML = filtered.map(b => {
    const rating = avgRating(b);
    const ratingCount = b.ratings?.length || 0;
    const cats = (b.categories || []).slice(0, 3);
    const mainCat = cats[0] || '';
    const cardIcon = catIcons2[mainCat] || (b.source === 'ai' ? 'fa-robot' : 'fa-book-open');
    return `
      <div class="mkt-bank-card">
        <span class="mkt-bank-card-icon"><i class="fa-solid ${cardIcon}"></i></span>
        <div class="mkt-bank-card-title">${escapeHtml(b.title)}</div>
        <div class="mkt-bank-card-author"><i class="fa-solid ${b.source === "ai" ? "fa-wand-magic-sparkles" : "fa-user"}"></i> ${escapeHtml(b.author)} ・ ${b.questions?.length || 0} 題</div>
        ${b.description ? `<div class="mkt-bank-card-desc">${escapeHtml(b.description)}</div>` : ''}
        <div class="mkt-bank-card-meta">
          ${cats.map(c => `<button type="button" class="mkt-tag mkt-search-tag" data-query="${escapeHtml(c)}">${escapeHtml(c)}</button>`).join('')}
          <span class="mkt-count-badge"><i class="fa-solid fa-copy"></i> ${b.copyCount || 0}</span>
        </div>
        <div class="mkt-bank-card-actions">
          <button class="mkt-copy-btn" data-id="${escapeHtml(b.id)}"><i class="fa-solid fa-clone"></i> 複製使用</button>
          <div class="mkt-rating-area">
            ${renderStars(rating, b.id)}
            <span style="color:#888;font-size:.75rem">(${ratingCount})</span>
          </div>
        </div>
      </div>`;
  }).join('');

  document.querySelectorAll('.mkt-copy-btn').forEach(btn => {
    btn.addEventListener('click', () => copyBank(btn.dataset.id));
  });
  document.querySelectorAll('.mkt-search-tag').forEach(tag => {
    tag.addEventListener('click', () => {
      const input = $("mktSearchInput");
      searchQuery = tag.dataset.query || "";
      if (input) {
        input.value = searchQuery;
        input.focus();
      }
      currentFilter = "all";
      $("mktFilterRow")?.querySelectorAll(".mkt-filter-btn").forEach(b => b.classList.toggle("active", b.dataset.filter === "all"));
      renderAll();
    });
  });
  document.querySelectorAll('.mkt-star').forEach(star => {
    star.addEventListener('click', () => rateBank(star.dataset.bank, parseInt(star.dataset.star)));
  });
}

function copyBank(id) {
  const market = loadMarket();
  const bank = market.find(b => b.id === id);
  if (!bank) return;
  const myBanks = loadMyBanks();
  const copy = { ...bank, id: `mkt_copy_${Date.now()}`, title: `${bank.title}（複製）`, isSystem: false };
  myBanks.push(copy);
  localStorage.setItem("quizBanks", JSON.stringify(myBanks));
  // Increment copy count
  bank.copyCount = (bank.copyCount || 0) + 1;
  saveMarket(market);
  showToast(`「${bank.title}」已複製到建立題庫，可前往編輯使用！`, 2600);
  renderAll();
}

function rateBank(id, stars) {
  const market = loadMarket();
  const bank = market.find(b => b.id === id);
  if (!bank) return;
  if (!bank.ratings) bank.ratings = [];
  // One rating per session (simple demo)
  bank.ratings.push(stars);
  saveMarket(market);
  showToast(`已評 ${stars} 星！`);
  renderAll();
}

function renderAll() {
  const market = loadMarket();
  $("mktTotal").textContent = String(market.length);
  $("mktWeekly").textContent = String(getThisWeekCount(market));
  $("mktAvgRating").textContent = getAvgRating(market);
  renderLeaderboard(market);
  renderBankList(market);
}

// ── 上架 ──
function openPublishModal() {
  const sel = $("publishBankSelect"); if (!sel) return;
  const banks = loadMyBanks().filter(b => !b.isSystem && !b.isWrongBook);
  sel.innerHTML = banks.length
    ? banks.map((b, i) => `<option value="${i}">${escapeHtml(b.title || `題庫 ${i+1}`)}</option>`).join('')
    : `<option value="">沒有本機題庫，可改用下方 JSON 上傳</option>`;
  $("publishUploadInput").value = "";
  $("publishModal").style.display = "flex";
}

async function doPublish() {
  const sel = $("publishBankSelect"); const desc = $("publishDescription");
  const uploadFile = $("publishUploadInput")?.files?.[0];
  const banks = loadMyBanks().filter(b => !b.isSystem && !b.isWrongBook);
  let bank = banks[parseInt(sel?.value ?? 0)];
  if (uploadFile) {
    try {
      bank = normalizeUploadedBank(JSON.parse(await uploadFile.text()), uploadFile.name.replace(/\.json$/i, ""));
    } catch {
      showToast("題庫 JSON 格式錯誤");
      return;
    }
  }
  if (!bank) { showToast("請選擇或上傳題庫"); return; }
  if (!Array.isArray(bank.questions) || bank.questions.length < 5) {
    showToast("玩家上架題庫至少需要 5 題");
    return;
  }
  const market = loadMarket();
  // Check duplicate
  if (market.find(m => m.title === bank.title && m.author === getCurrentUser())) {
    showToast("你已上架過同名題庫"); $("publishModal").style.display = "none"; return;
  }
  const cats = [...new Set((bank.questions || []).map(q => q.category).filter(Boolean))];
  const entry = {
    id: `mkt_${Date.now()}_${Math.random().toString(36).slice(2,7)}`,
    title: bank.title || "未命名題庫",
    author: getCurrentUser(),
    description: desc?.value.trim() || "",
    questions: bank.questions || [],
    categories: cats,
    source: "player",
    copyCount: 0,
    ratings: [],
    publishedAt: Date.now(),
  };
  market.push(entry);
  saveMarket(market);
  $("publishModal").style.display = "none";
  showToast("題庫已上架！🎉");
  renderAll();
}

// ── 事件 ──
$("publishMyBankBtn")?.addEventListener("click", openPublishModal);
$("doPublishBtn")?.addEventListener("click", doPublish);
$("cancelPublishBtn")?.addEventListener("click", () => { $("publishModal").style.display = "none"; });
$("mktSearchBtn")?.addEventListener("click", () => {
  searchQuery = $("mktSearchInput")?.value.trim() || "";
  renderAll();
});
$("mktSearchInput")?.addEventListener("keydown", e => { if (e.key === "Enter") $("mktSearchBtn")?.click(); });
$("mktFilterRow")?.querySelectorAll(".mkt-filter-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    $("mktFilterRow").querySelectorAll(".mkt-filter-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    currentFilter = btn.dataset.filter;
    const input = $("mktSearchInput");
    if (input && currentFilter !== "all") {
      input.focus();
    }
    renderAll();
  });
});

ensureAiMarketBanks();
renderAll();
