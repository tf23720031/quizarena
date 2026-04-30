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

function loadMarket() {
  try { return JSON.parse(localStorage.getItem(MKT_KEY) || "[]"); } catch { return []; }
}
function saveMarket(data) { localStorage.setItem(MKT_KEY, JSON.stringify(data)); }

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
  board.innerHTML = top.map((b, i) => `
    <div class="mkt-rank-item">
      <div class="mkt-rank-num ${numClass(i)}">${i+1}</div>
      <div class="mkt-rank-info">
        <strong>${escapeHtml(b.title)}</strong>
        <span>by ${escapeHtml(b.author)} ・ ${b.questions?.length || 0} 題</span>
      </div>
      <div class="mkt-rank-score">${b.copyCount || 0} 複製</div>
    </div>`).join('');
}

function renderBankList(market) {
  const list = $("mktBankList"); const note = $("mktResultNote");
  const filtered = filterAndSearch(market);
  note.textContent = `共 ${filtered.length} 個題庫`;
  if (!filtered.length) {
    list.innerHTML = `<div class="question-card"><h3>找不到相符題庫</h3><p>換個關鍵字試試，或上架你自己的！</p></div>`;
    return;
  }
  list.innerHTML = filtered.map(b => {
    const rating = avgRating(b);
    const ratingCount = b.ratings?.length || 0;
    const cats = (b.categories || []).slice(0, 3);
    return `
      <div class="mkt-bank-card">
        <div class="mkt-bank-card-title">${escapeHtml(b.title)}</div>
        <div class="mkt-bank-card-author"><i class="fa-solid fa-user"></i> ${escapeHtml(b.author)} ・ ${b.questions?.length || 0} 題</div>
        ${b.description ? `<div class="mkt-bank-card-desc">${escapeHtml(b.description)}</div>` : ''}
        <div class="mkt-bank-card-meta">
          ${cats.map(c => `<span class="mkt-tag">${escapeHtml(c)}</span>`).join('')}
          <span class="mkt-tag"><i class="fa-solid fa-copy"></i> ${b.copyCount || 0}</span>
        </div>
        <div class="mkt-bank-card-actions">
          <button class="mkt-copy-btn" data-id="${escapeHtml(b.id)}"><i class="fa-solid fa-copy"></i> 複製使用</button>
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
  showToast(`「${bank.title}」已複製到你的題庫！`);
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
  if (!banks.length) { showToast("你還沒有可上架的題庫"); return; }
  sel.innerHTML = banks.map((b, i) => `<option value="${i}">${escapeHtml(b.title || `題庫 ${i+1}`)}</option>`).join('');
  $("publishModal").style.display = "flex";
}

function doPublish() {
  const sel = $("publishBankSelect"); const desc = $("publishDescription");
  const banks = loadMyBanks().filter(b => !b.isSystem && !b.isWrongBook);
  const bank = banks[parseInt(sel?.value ?? 0)];
  if (!bank) return;
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
    renderAll();
  });
});

renderAll();
