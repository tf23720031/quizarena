const $ = (id) => document.getElementById(id);
const practiceState = { items: [], order: [], index: 0, selected: [], checked: false };

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

function questionTypeText(type) {
  return { single: "單選題", multiple: "多選題", tf: "是非題", fill: "填充題" }[type] || "單選題";
}

function correctIndexes(item) {
  const options = Array.isArray(item.options) ? item.options : [];
  return options
    .map((option, index) => (option && typeof option === "object" && option.correct ? index : -1))
    .filter((index) => index >= 0);
}

function correctAnswerText(item) {
  const options = Array.isArray(item.options) ? item.options : [];
  if (item.type === "fill") return optionText(options[0], 0) || "未提供正解";
  const indexes = correctIndexes(item);
  if (!indexes.length) return "未提供正解";
  return indexes.map((index) => `${String.fromCharCode(65 + index)}. ${optionText(options[index], index)}`).join("、");
}

function topBy(items, key) {
  const counts = new Map();
  items.forEach((item) => {
    const name = item[key] || "未分類";
    counts.set(name, (counts.get(name) || 0) + Number(item.wrongCount || 1));
  });
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0] || ["-", 0];
}

function buildWeaknessMetrics(items) {
  const groups = [
    ["類別", "category"],
    ["難度", "difficulty"],
    ["題型", "type"],
  ];
  return groups.flatMap(([groupLabel, key]) => {
    const counts = new Map();
    items.forEach((item) => {
      const label = key === "type" ? questionTypeText(item.type) : (item[key] || "未分類");
      counts.set(label, (counts.get(label) || 0) + Number(item.wrongCount || 1));
    });
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 2)
      .map(([label, count]) => ({ label: `${groupLabel}:${label}`, value: count }));
  }).slice(0, 6);
}

function renderWeaknessRadar(items) {
  const canvas = $("weaknessRadar");
  const legend = $("weaknessRadarLegend");
  if (!canvas || !legend) return;
  const ctx = canvas.getContext("2d");
  const metrics = buildWeaknessMetrics(items);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (!metrics.length) {
    legend.innerHTML = `<span>目前沒有足夠錯題資料</span>`;
    return;
  }

  const cx = canvas.width / 2;
  const cy = canvas.height / 2;
  const radius = Math.min(cx, cy) - 62;
  const max = Math.max(1, ...metrics.map((item) => item.value));
  ctx.lineWidth = 1;
  ctx.strokeStyle = "rgba(113, 121, 175, 0.22)";
  ctx.fillStyle = "rgba(102, 112, 155, 0.9)";
  ctx.font = "700 13px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  for (let ring = 1; ring <= 4; ring += 1) {
    ctx.beginPath();
    metrics.forEach((_, index) => {
      const angle = -Math.PI / 2 + (Math.PI * 2 * index) / metrics.length;
      const r = (radius * ring) / 4;
      const x = cx + Math.cos(angle) * r;
      const y = cy + Math.sin(angle) * r;
      if (index === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.closePath();
    ctx.stroke();
  }

  metrics.forEach((item, index) => {
    const angle = -Math.PI / 2 + (Math.PI * 2 * index) / metrics.length;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius);
    ctx.stroke();
    const labelX = cx + Math.cos(angle) * (radius + 38);
    const labelY = cy + Math.sin(angle) * (radius + 38);
    item.label.split(":").forEach((part, line) => {
      ctx.fillText(part, labelX, labelY + (line - 0.5) * 16);
    });
  });

  ctx.beginPath();
  metrics.forEach((item, index) => {
    const angle = -Math.PI / 2 + (Math.PI * 2 * index) / metrics.length;
    const r = radius * (item.value / max);
    const x = cx + Math.cos(angle) * r;
    const y = cy + Math.sin(angle) * r;
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.closePath();
  ctx.fillStyle = "rgba(255, 107, 166, 0.28)";
  ctx.strokeStyle = "rgba(124, 123, 255, 0.9)";
  ctx.lineWidth = 3;
  ctx.fill();
  ctx.stroke();

  legend.innerHTML = metrics.map((item) => `
    <span><b>${escapeHtml(item.label)}</b>${Number(item.value)} 次</span>
  `).join("");
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

function shuffleItems(items) {
  return [...items].sort(() => Math.random() - 0.5);
}

function currentPracticeItem() {
  return practiceState.order[practiceState.index] || null;
}

function renderPractice() {
  const box = $("wrongPracticeBox");
  const item = currentPracticeItem();
  if (!box) return;
  if (!item) {
    if (practiceState.items.length) {
      box.innerHTML = `<p>按下開始練習後，系統會從 ${practiceState.items.length} 題錯題中抽題讓你反覆測試。</p>`;
      return;
    }
    box.innerHTML = `<p>目前沒有可以練習的錯題。</p>`;
    return;
  }
  const isFill = item.type === "fill";
  const selectedSet = new Set(practiceState.selected);
  const correctSet = new Set(correctIndexes(item));
  box.innerHTML = `
    <article class="practice-card">
      <div class="question-meta-row">
        <h3>${escapeHtml(item.title)}</h3>
        <span class="answer-pill">${practiceState.index + 1} / ${practiceState.order.length}</span>
      </div>
      <p>${escapeHtml(item.content)}</p>
      ${item.image ? `<img src="${escapeHtml(item.image)}" alt="" class="practice-image">` : ""}
      ${isFill ? `
        <input id="practiceFillInput" class="practice-input" placeholder="輸入答案">
      ` : `
        <div class="practice-options">
          ${(item.options || []).map((option, index) => {
            const selected = selectedSet.has(index);
            const correct = correctSet.has(index);
            const revealClass = practiceState.checked ? (correct ? "correct" : selected ? "wrong" : "") : "";
            return `<button type="button" class="practice-option ${selected ? "selected" : ""} ${revealClass}" data-index="${index}">
              <b>${String.fromCharCode(65 + index)}</b><span>${escapeHtml(optionText(option, index))}</span>
            </button>`;
          }).join("")}
        </div>
      `}
      <div class="practice-actions">
        <button id="checkPracticeBtn" class="tool-btn"><i class="fa-solid fa-check"></i> 檢查答案</button>
        <button id="nextPracticeBtn" class="tool-btn secondary"><i class="fa-solid fa-forward"></i> 下一題</button>
      </div>
      ${practiceState.checked ? `
        <div class="explanation-box">
          <strong>正解</strong><br>${escapeHtml(correctAnswerText(item))}
          ${item.explanation ? `<hr><strong>解析</strong><br>${escapeHtml(item.explanation)}` : ""}
        </div>
      ` : ""}
    </article>
  `;

  box.querySelectorAll(".practice-option").forEach((button) => {
    button.addEventListener("click", () => {
      if (practiceState.checked) return;
      const index = Number(button.dataset.index);
      if (item.type === "multiple") {
        practiceState.selected = selectedSet.has(index)
          ? practiceState.selected.filter((value) => value !== index)
          : [...practiceState.selected, index].sort((a, b) => a - b);
      } else {
        practiceState.selected = [index];
      }
      renderPractice();
    });
  });
  $("checkPracticeBtn")?.addEventListener("click", checkPracticeAnswer);
  $("nextPracticeBtn")?.addEventListener("click", nextPracticeQuestion);
}

function startPractice() {
  if (!practiceState.items.length) {
    showToast("目前沒有錯題可以練習");
    return;
  }
  practiceState.order = shuffleItems(practiceState.items);
  practiceState.index = 0;
  practiceState.selected = [];
  practiceState.checked = false;
  renderPractice();
}

function checkPracticeAnswer() {
  const item = currentPracticeItem();
  if (!item) return;
  if (item.type === "fill") {
    const input = String($("practiceFillInput")?.value || "").trim().toLowerCase();
    const correct = correctAnswerText(item).trim().toLowerCase();
    practiceState.selected = input ? [0] : [];
    practiceState.checked = true;
    showToast(input && input === correct ? "答對了" : "再複習一次");
    renderPractice();
    return;
  }
  if (!practiceState.selected.length) {
    showToast("請先選擇答案");
    return;
  }
  const picked = practiceState.selected.join(",");
  const answer = correctIndexes(item).join(",");
  practiceState.checked = true;
  showToast(picked === answer ? "答對了" : "答錯了，下面有正解");
  renderPractice();
}

function nextPracticeQuestion() {
  if (!practiceState.order.length) return;
  practiceState.index = (practiceState.index + 1) % practiceState.order.length;
  practiceState.selected = [];
  practiceState.checked = false;
  renderPractice();
}

function renderWrongBook(data) {
  const items = Array.isArray(data.items) ? data.items : [];
  practiceState.items = items;
  practiceState.order = [];
  practiceState.index = 0;
  practiceState.selected = [];
  practiceState.checked = false;
  $("wrongItemCount").textContent = String(items.length);
  $("wrongTotalCount").textContent = String(Number(data.totalWrongCount || 0));
  $("wrongUserName").textContent = data.username || "-";
  renderInsight(items);
  renderWeaknessRadar(items);
  renderPractice();

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
        ${(item.options || []).map((option, index) => {
          const isCorrect = correctIndexes(item).includes(index);
          return `<li class="${isCorrect ? "is-correct" : ""}">${escapeHtml(optionText(option, index))}${isCorrect ? " ✓" : ""}</li>`;
        }).join("")}
      </ul>
      <div class="explanation-box"><strong>正解</strong><br>${escapeHtml(correctAnswerText(item))}</div>
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
$("startPracticeBtn")?.addEventListener("click", startPractice);
loadWrongBook();
