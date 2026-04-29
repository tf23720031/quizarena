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

function renderWrongBook(data) {
  const items = Array.isArray(data.items) ? data.items : [];
  $("wrongItemCount").textContent = String(items.length);
  $("wrongTotalCount").textContent = String(Number(data.totalWrongCount || 0));
  $("wrongUserName").textContent = data.username || "-";

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
