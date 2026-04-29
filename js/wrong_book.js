const $ = (id) => document.getElementById(id);

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function showToast(message, delay = 2200) {
  const toast = $("toast");
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove("show"), delay);
}

async function api(url) {
  const res = await fetch(url);
  const data = await res.json();
  if (!res.ok || data.success === false) throw new Error(data.message || "讀取失敗");
  return data;
}

function optionText(option, index) {
  if (typeof option === "string") return option;
  return option?.text || `選項 ${index + 1}`;
}

function topBy(items, key) {
  const counts = new Map();
  items.forEach((item) => {
    const name = item[key] || "未分類";
    counts.set(name, (counts.get(name) || 0) + Number(item.wrongCount || 1));
  });
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0] || ["-", 0];
}

function renderInsight(items) {
  const wrap = $("wrongBookInsight");
  if (!wrap) return;
  if (!items.length) {
    wrap.innerHTML = `<article><strong>狀態很好</strong><span>目前沒有錯題，之後答錯會自動產生複習建議。</span></article>`;
    return;
  }
  const [category, categoryCount] = topBy(items, "category");
  const [difficulty, difficultyCount] = topBy(items, "difficulty");
  const priority = [...items].sort((a, b) => Number(b.wrongCount || 0) - Number(a.wrongCount || 0))[0];
  wrap.innerHTML = `
    <article><strong>${escapeHtml(category)}</strong><span>最需要補強的類別，累積 ${categoryCount} 次錯誤。</span></article>
    <article><strong>${escapeHtml(difficulty)}</strong><span>最常出錯的難度，累積 ${difficultyCount} 次錯誤。</span></article>
    <article><strong>${escapeHtml(priority?.title || "-")}</strong><span>優先複習這題，已錯 ${Number(priority?.wrongCount || 0)} 次。</span></article>
  `;
}

function renderWrongBook(data) {
  const items = Array.isArray(data.items) ? data.items : [];
  $("wrongItemCount").textContent = String(items.length);
  $("wrongTotalCount").textContent = String(Number(data.totalWrongCount || 0));
  $("wrongUserName").textContent = data.username || "-";
  renderInsight(items);

  const list = $("wrongBookList");
  if (!items.length) {
    list.innerHTML = `
      <article class="question-card">
        <h3>目前沒有錯題</h3>
        <p>答錯的題目會自動收藏到這裡，之後可以回來複習。</p>
      </article>
    `;
    return;
  }

  list.innerHTML = items.map((item) => `
    <article class="question-card">
      <div class="question-meta-row">
        <h3>${escapeHtml(item.title)}</h3>
        <span class="answer-pill">答錯 ${Number(item.wrongCount || 0)} 次</span>
      </div>
      <p>${escapeHtml(item.content)}</p>
      ${item.image ? `<img src="${escapeHtml(item.image)}" alt="" style="max-width:100%;border-radius:14px;margin-top:12px;">` : ""}
      <ul class="option-list">
        ${(item.options || []).map((option, index) => `<li>${escapeHtml(optionText(option, index))}</li>`).join("")}
      </ul>
      ${item.explanation ? `<div class="explanation-box"><strong>解析</strong><br>${escapeHtml(item.explanation)}</div>` : ""}
      <div class="question-tags">
        <span>${escapeHtml(item.sourceBankTitle)}</span>
        <span>${escapeHtml(item.category)}</span>
        <span>${escapeHtml(item.difficulty)}</span>
        <span>最後錯誤：${escapeHtml(item.lastWrongAtText)}</span>
      </div>
    </article>
  `).join("");
}

async function loadWrongBook() {
  const username = localStorage.getItem("currentUser") || "";
  if (!username) {
    showToast("請先登入");
    $("wrongBookList").innerHTML = `<article class="question-card"><h3>請先登入</h3><p>登入後就能查看自己的錯題本。</p></article>`;
    return;
  }

  try {
    const data = await api(`/wrong_book_summary?username=${encodeURIComponent(username)}`);
    renderWrongBook(data);
  } catch (error) {
    showToast(error.message);
  }
}

$("refreshWrongBookBtn")?.addEventListener("click", loadWrongBook);
loadWrongBook();
