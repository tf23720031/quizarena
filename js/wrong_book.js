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

async function api(url, options = {}) {
  const res = await fetch(url, { headers: { "Content-Type": "application/json" }, ...options });
  const data = await res.json();
  if (!res.ok || data.success === false) throw new Error(data.message || "讀取失敗");
  return data;
}

function optionText(option, index) {
  if (typeof option === "string") return option;
  return option?.text || `選項 ${index + 1}`;
}

function questionTypeText(type) {
  return { single: "單選題", multiple: "多選題", tf: "是非題", fill: "填充題", matching: "配對題" }[type] || "單選題";
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
  if (item.type === "matching") {
    return options.map(o => `${o.left || ''} ↔ ${o.right || ''}`).join("、");
  }
  const indexes = correctIndexes(item);
  if (!indexes.length) return "未提供正解";
  return indexes.map((index) => `${String.fromCharCode(65 + index)}. ${optionText(options[index], index)}`).join("、");
}

// ── 筆記持久化 ──
function notesKey(item) {
  const username = localStorage.getItem("currentUser") || "guest";
  return `quizarena_note_${username}_${item.questionId || item.title}`;
}
function getNote(item) { return localStorage.getItem(notesKey(item)) || ""; }
function saveNote(item, text) { localStorage.setItem(notesKey(item), text); }

// ── 知識地圖 ──
function buildCategoryMastery(items) {
  const map = new Map();
  items.forEach(item => {
    const cat = item.category || "未分類";
    if (!map.has(cat)) map.set(cat, { wrong: 0, total: 0 });
    const entry = map.get(cat);
    entry.wrong += Number(item.wrongCount || 1);
    entry.total += 1;
  });
  return map;
}

function masteryLevel(wrongCount, total) {
  const ratio = wrongCount / Math.max(1, total);
  if (ratio >= 0.7) return { label: "需加強", color: "#ff6b6b", icon: "fa-circle-xmark", cls: "mastery-low" };
  if (ratio >= 0.3) return { label: "練習中", color: "#ffb347", icon: "fa-circle-half-stroke", cls: "mastery-mid" };
  return { label: "已掌握", color: "#51cf66", icon: "fa-circle-check", cls: "mastery-high" };
}

function renderKnowledgeMap(items) {
  const area = $("knowledgeMapArea");
  if (!area) return;
  const catMap = buildCategoryMastery(items);
  if (!catMap.size) {
    area.innerHTML = `<p class="km-empty">答錯題目後此處將呈現各主題掌握狀況。</p>`;
    return;
  }
  const sorted = [...catMap.entries()].sort((a, b) => b[1].wrong - a[1].wrong);
  area.innerHTML = sorted.map(([cat, data]) => {
    const m = masteryLevel(data.wrong, data.total);
    const pct = Math.max(5, 100 - Math.round((data.wrong / Math.max(1, data.total)) * 100));
    return `
      <div class="km-node ${m.cls}">
        <div class="km-node-top">
          <i class="fa-solid ${m.icon}" style="color:${m.color}"></i>
          <strong>${escapeHtml(cat)}</strong>
          <span class="km-badge">${m.label}</span>
        </div>
        <div class="km-bar-track"><div class="km-bar-fill" style="width:${pct}%;background:${m.color}"></div></div>
        <div class="km-meta">${data.total} 題 ・ 累積錯 ${data.wrong} 次</div>
      </div>`;
  }).join("");
}

function sharePayload(item) {
  return btoa(unescape(encodeURIComponent(JSON.stringify({
    title: item.title,
    content: item.content,
    answer: correctAnswerText(item),
    ai: item.aiExplanation || item.explanation || '',
  })))).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

async function copyWrongShareLink(itemIndex) {
  const item = practiceState.items[itemIndex];
  if (!item) return;
  const url = `${location.origin}${location.pathname}#share=${sharePayload(item)}`;
  try {
    await navigator.clipboard.writeText(url);
    showToast('已複製錯題分享連結');
  } catch {
    prompt('複製這個分享連結', url);
  }
}

function exportWrongImage(itemIndex) {
  const item = practiceState.items[itemIndex];
  if (!item) return;
  const canvas = document.createElement('canvas');
  canvas.width = 1080; canvas.height = 760;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#f7f8ff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#5d63d8'; ctx.font = '800 44px Microsoft JhengHei, sans-serif';
  ctx.fillText('QuizArena 錯題分享', 56, 80);
  ctx.fillStyle = '#293150'; ctx.font = '800 34px Microsoft JhengHei, sans-serif';
  wrapCanvasText(ctx, item.title || '錯題', 56, 150, 960, 42);
  ctx.font = '500 30px Microsoft JhengHei, sans-serif';
  wrapCanvasText(ctx, item.content || '', 56, 240, 960, 38);
  ctx.fillStyle = '#1e7a47'; ctx.font = '800 30px Microsoft JhengHei, sans-serif';
  wrapCanvasText(ctx, `正解：${correctAnswerText(item)}`, 56, 430, 960, 38);
  ctx.fillStyle = '#626b91'; ctx.font = '500 26px Microsoft JhengHei, sans-serif';
  wrapCanvasText(ctx, `AI解析：${item.aiExplanation || item.explanation || '尚未產生解析'}`, 56, 510, 960, 34);
  const link = document.createElement('a');
  link.download = `quizarena-wrong-${item.questionId || Date.now()}.png`;
  link.href = canvas.toDataURL('image/png'); link.click();
}

function wrapCanvasText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = String(text || '').split('');
  let line = ''; let currentY = y;
  words.forEach((word) => {
    const testLine = line + word;
    if (ctx.measureText(testLine).width > maxWidth && line) {
      ctx.fillText(line, x, currentY); line = word; currentY += lineHeight;
    } else { line = testLine; }
  });
  if (line) ctx.fillText(line, x, currentY);
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
  const groups = [["類別", "category"], ["難度", "difficulty"], ["題型", "type"]];
  return groups.flatMap(([groupLabel, key]) => {
    const counts = new Map();
    items.forEach((item) => {
      const label = key === "type" ? questionTypeText(item.type) : (item[key] || "未分類");
      counts.set(label, (counts.get(label) || 0) + Number(item.wrongCount || 1));
    });
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 2)
      .map(([label, count]) => ({ label: `${groupLabel}:${label}`, value: count }));
  }).slice(0, 6);
}

function renderWeaknessRadar(items) {
  const canvas = $("weaknessRadar"); const legend = $("weaknessRadarLegend");
  if (!canvas || !legend) return;
  const ctx = canvas.getContext("2d"); const metrics = buildWeaknessMetrics(items);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (!metrics.length) { legend.innerHTML = `<span>目前沒有足夠錯題資料</span>`; return; }
  const cx = canvas.width / 2; const cy = canvas.height / 2;
  const radius = Math.min(cx, cy) - 62;
  const max = Math.max(1, ...metrics.map((item) => item.value));
  ctx.lineWidth = 1; ctx.strokeStyle = "rgba(113, 121, 175, 0.22)";
  ctx.fillStyle = "rgba(102, 112, 155, 0.9)"; ctx.font = "700 13px sans-serif";
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  for (let ring = 1; ring <= 4; ring += 1) {
    ctx.beginPath();
    metrics.forEach((_, index) => {
      const angle = -Math.PI / 2 + (Math.PI * 2 * index) / metrics.length;
      const r = (radius * ring) / 4;
      const x = cx + Math.cos(angle) * r; const y = cy + Math.sin(angle) * r;
      if (index === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.closePath(); ctx.stroke();
  }
  metrics.forEach((item, index) => {
    const angle = -Math.PI / 2 + (Math.PI * 2 * index) / metrics.length;
    ctx.beginPath(); ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius); ctx.stroke();
    const labelX = cx + Math.cos(angle) * (radius + 38);
    const labelY = cy + Math.sin(angle) * (radius + 38);
    item.label.split(":").forEach((part, line) => { ctx.fillText(part, labelX, labelY + (line - 0.5) * 16); });
  });
  ctx.beginPath();
  metrics.forEach((item, index) => {
    const angle = -Math.PI / 2 + (Math.PI * 2 * index) / metrics.length;
    const r = radius * (item.value / max);
    const x = cx + Math.cos(angle) * r; const y = cy + Math.sin(angle) * r;
    if (index === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  });
  ctx.closePath(); ctx.fillStyle = "rgba(255, 107, 166, 0.28)";
  ctx.strokeStyle = "rgba(124, 123, 255, 0.9)"; ctx.lineWidth = 3; ctx.fill(); ctx.stroke();
  legend.innerHTML = metrics.map((item) => `<span><b>${escapeHtml(item.label)}</b>${Number(item.value)} 次</span>`).join("");
}

function renderInsight(items) {
  const wrap = $("wrongBookInsight"); if (!wrap) return;
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

function shuffleItems(items) { return [...items].sort(() => Math.random() - 0.5); }
function currentPracticeItem() { return practiceState.order[practiceState.index] || null; }

function renderPractice() {
  const box = $("wrongPracticeBox"); const item = currentPracticeItem();
  if (!box) return;
  if (!item) {
    if (practiceState.items.length) {
      box.innerHTML = `<p>按下開始練習後，系統會從 ${practiceState.items.length} 題錯題中抽題讓你反覆測試。</p>`; return;
    }
    box.innerHTML = `<p>目前沒有可以練習的錯題。</p>`; return;
  }
  const isFill = item.type === "fill";
  const isMatching = item.type === "matching";
  const selectedSet = new Set(practiceState.selected);
  const correctSet = new Set(correctIndexes(item));

  let optionsHtml = '';
  if (isMatching) {
    const opts = item.options || [];
    const shuffledRight = practiceState.checked
      ? opts.map(o => o.right)
      : [...opts.map(o => o.right)].sort(() => Math.random() - 0.5);
    if (!practiceState.matchingRight) practiceState.matchingRight = shuffledRight;
    optionsHtml = `
      <div class="matching-practice-wrap">
        <div class="matching-col">
          ${opts.map((o, i) => `<div class="match-left-item">${escapeHtml(o.left)}</div>`).join('')}
        </div>
        <div class="matching-col">
          ${(practiceState.matchingRight || shuffledRight).map((r, i) => `
            <div class="match-right-item ${practiceState.checked ? (opts.find(o=>o.right===r && opts[i]?.right===r) ? 'correct' : 'wrong') : ''}" data-right="${escapeHtml(r)}">${escapeHtml(r)}</div>
          `).join('')}
        </div>
      </div>`;
  } else if (isFill) {
    optionsHtml = `<input id="practiceFillInput" class="practice-input" placeholder="輸入答案">`;
  } else {
    optionsHtml = `<div class="practice-options">
      ${(item.options || []).map((option, index) => {
        const selected = selectedSet.has(index);
        const correct = correctSet.has(index);
        const revealClass = practiceState.checked ? (correct ? "correct" : selected ? "wrong" : "") : "";
        return `<button type="button" class="practice-option ${selected ? "selected" : ""} ${revealClass}" data-index="${index}">
          <b>${String.fromCharCode(65 + index)}</b><span>${escapeHtml(optionText(option, index))}</span>
        </button>`;
      }).join("")}
    </div>`;
  }

  box.innerHTML = `
    <article class="practice-card">
      <div class="question-meta-row">
        <h3>${escapeHtml(item.title)}</h3>
        <span class="answer-pill">${practiceState.index + 1} / ${practiceState.order.length}</span>
      </div>
      <p>${escapeHtml(item.content)}</p>
      ${item.image ? `<img src="${escapeHtml(item.image)}" alt="" class="practice-image">` : ""}
      ${optionsHtml}
      <div class="practice-actions">
        <button id="checkPracticeBtn" class="tool-btn"><i class="fa-solid fa-check"></i> 檢查答案</button>
        <button id="nextPracticeBtn" class="tool-btn secondary"><i class="fa-solid fa-forward"></i> 下一題</button>
        <button id="aiTutorBtn" class="tool-btn tutor" style="${practiceState.checked ? "" : "display:none;}"><i class="fa-solid fa-chalkboard-user"></i> AI 家教講解</button>
      </div>
      <div id="aiTutorBox" class="ai-tutor-box"></div>
      ${practiceState.checked ? `<div class="explanation-box">
        ${item.explanation ? `<strong>解析</strong><br>${escapeHtml(item.explanation)}` : "綠色選項就是正確答案。"}
      </div>` : ""}
    </article>`;

  box.querySelectorAll(".practice-option").forEach((button) => {
    button.addEventListener("click", () => {
      if (practiceState.checked) return;
      const index = Number(button.dataset.index);
      if (item.type === "multiple") {
        practiceState.selected = selectedSet.has(index)
          ? practiceState.selected.filter((v) => v !== index)
          : [...practiceState.selected, index].sort((a, b) => a - b);
      } else { practiceState.selected = [index]; }
      renderPractice();
    });
  });
  $("checkPracticeBtn")?.addEventListener("click", checkPracticeAnswer);
  $("nextPracticeBtn")?.addEventListener("click", nextPracticeQuestion);
  $("aiTutorBtn")?.addEventListener("click", loadAiTutor);
}

function startPractice() {
  if (!practiceState.items.length) { showToast("目前沒有錯題可以練習"); return; }
  practiceState.order = shuffleItems(practiceState.items);
  practiceState.index = 0; practiceState.selected = []; practiceState.checked = false; practiceState.matchingRight = null;
  renderPractice();
}

function checkPracticeAnswer() {
  const item = currentPracticeItem(); if (!item) return;
  if (item.type === "fill") {
    const input = String($("practiceFillInput")?.value || "").trim().toLowerCase();
    const correct = correctAnswerText(item).trim().toLowerCase();
    practiceState.selected = input ? [0] : []; practiceState.checked = true;
    showToast(input && input === correct ? "答對了" : "再複習一次"); renderPractice(); return;
  }
  if (!practiceState.selected.length) { showToast("請先選擇答案"); return; }
  const picked = practiceState.selected.join(","); const answer = correctIndexes(item).join(",");
  practiceState.checked = true;
  showToast(picked === answer ? "答對了" : "答錯了，下面有正解"); renderPractice();
}

async function loadAiTutor() {
  const item = currentPracticeItem(); const box = $("aiTutorBox");
  if (!item || !box) return;
  const pickedText = practiceState.selected.map((idx) => `${String.fromCharCode(65 + idx)}. ${optionText(item.options?.[idx], idx)}`).join("、");
  box.innerHTML = `<div class="explanation-box"><i class="fa-solid fa-spinner fa-spin"></i> AI 家教正在整理講解...</div>`;
  try {
    const data = await api("/ai_tutor", {
      method: "POST",
      body: JSON.stringify({
        question: item.content, selected: pickedText, correct: correctAnswerText(item),
        explanation: item.explanation || "", language: localStorage.getItem("quizLang") || "zh",
      }),
    });
    box.innerHTML = `<div class="explanation-box"><strong>AI 家教</strong><br>${escapeHtml(data.tutor || "").replaceAll("\n", "<br>")}</div>`;
  } catch (error) {
    box.innerHTML = `<div class="explanation-box">AI 家教暫時無法回應，請先看綠色正解與解析。</div>`;
  }
}

function nextPracticeQuestion() {
  if (!practiceState.order.length) return;
  practiceState.index = (practiceState.index + 1) % practiceState.order.length;
  practiceState.selected = []; practiceState.checked = false; practiceState.matchingRight = null;
  renderPractice();
}

// ── AI 個人化解析（錯題本每題） ──
async function loadInlineAiExplanation(itemIndex, btn) {
  const item = practiceState.items[itemIndex];
  const box = document.getElementById(`ai-inline-box-${itemIndex}`);
  if (!item || !box) return;
  btn.disabled = true;
  box.innerHTML = `<div class="explanation-box ai-personal-explanation"><i class="fa-solid fa-spinner fa-spin"></i> AI 正在針對你的弱點分析中...</div>`;
  try {
    const data = await api("/ai_tutor", {
      method: "POST",
      body: JSON.stringify({
        question: item.content, selected: "（答錯）", correct: correctAnswerText(item),
        explanation: item.explanation || "", language: localStorage.getItem("quizLang") || "zh",
        wrongCount: item.wrongCount || 1,
      }),
    });
    const text = data.tutor || "";
    // Save to item
    item.aiExplanation = text;
    box.innerHTML = `<div class="explanation-box ai-personal-explanation"><strong><i class="fa-solid fa-robot"></i> AI 個人化解析</strong><br>${escapeHtml(text).replaceAll("\n", "<br>")}</div>`;
    btn.innerHTML = `<i class="fa-solid fa-rotate"></i> 重新解析`;
    btn.disabled = false;
  } catch {
    box.innerHTML = `<div class="explanation-box">AI 暫時無法回應，請稍後再試。</div>`;
    btn.disabled = false;
  }
}

function renderWrongBook(data) {
  const items = Array.isArray(data.items) ? data.items : [];
  practiceState.items = items;
  practiceState.order = []; practiceState.index = 0; practiceState.selected = []; practiceState.checked = false;
  $("wrongItemCount").textContent = String(items.length);
  $("wrongTotalCount").textContent = String(Number(data.totalWrongCount || 0));
  $("wrongUserName").textContent = data.username || "-";
  renderInsight(items); renderWeaknessRadar(items); renderKnowledgeMap(items); renderPractice();

  const list = $("wrongBookList");
  if (!items.length) {
    list.innerHTML = `<article class="question-card"><h3>目前沒有錯題</h3><p>答錯的題目會自動收藏到這裡，之後可以回來複習。</p></article>`;
    return;
  }

  list.innerHTML = items.map((item, itemIndex) => {
    const note = getNote(item);
    return `
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
      ${item.explanation ? `<div class="explanation-box"><strong>解析</strong><br>${escapeHtml(item.explanation)}</div>` : ""}
      ${item.aiExplanation ? `<div class="explanation-box ai-personal-explanation"><strong><i class="fa-solid fa-robot"></i> AI 個人化解析</strong><br>${escapeHtml(item.aiExplanation).replaceAll("\n", "<br>")}</div>` : ""}
      <div id="ai-inline-box-${itemIndex}"></div>
      <!-- 筆記欄 -->
      <div class="wrong-note-wrap">
        <label class="wrong-note-label"><i class="fa-solid fa-pencil"></i> 我的筆記・記憶法</label>
        <textarea class="wrong-note-input" data-note-index="${itemIndex}" placeholder="寫下自己的記憶法或補充說明...">${escapeHtml(note)}</textarea>
        <button class="tool-btn secondary save-note-btn" data-note-index="${itemIndex}" type="button"><i class="fa-solid fa-floppy-disk"></i> 儲存筆記</button>
      </div>
      <div class="practice-actions">
        <button class="tool-btn ai-inline-btn" type="button" data-ai-index="${itemIndex}"><i class="fa-solid fa-robot"></i> AI 解題講解</button>
        <button class="tool-btn secondary wrong-share-link" type="button" data-share-index="${itemIndex}"><i class="fa-solid fa-link"></i> 分享連結</button>
        <button class="tool-btn secondary wrong-export-image" type="button" data-image-index="${itemIndex}"><i class="fa-solid fa-image"></i> 匯出圖片</button>
      </div>
      <div class="question-tags">
        <span>${escapeHtml(item.sourceBankTitle)}</span>
        <span>${escapeHtml(item.category)}</span>
        <span>${escapeHtml(item.difficulty)}</span>
        <span>最後錯誤：${escapeHtml(item.lastWrongAtText)}</span>
      </div>
    </article>`;
  }).join("");

  document.querySelectorAll(".wrong-share-link").forEach((btn) =>
    btn.addEventListener("click", () => copyWrongShareLink(Number(btn.dataset.shareIndex))));
  document.querySelectorAll(".wrong-export-image").forEach((btn) =>
    btn.addEventListener("click", () => exportWrongImage(Number(btn.dataset.imageIndex))));

  // AI inline btn
  document.querySelectorAll(".ai-inline-btn").forEach((btn) => {
    btn.addEventListener("click", () => loadInlineAiExplanation(Number(btn.dataset.aiIndex), btn));
  });

  // Save note btn
  document.querySelectorAll(".save-note-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const idx = Number(btn.dataset.noteIndex);
      const item = practiceState.items[idx];
      const textarea = document.querySelector(`.wrong-note-input[data-note-index="${idx}"]`);
      if (!item || !textarea) return;
      saveNote(item, textarea.value);
      showToast("筆記已儲存 ✓");
    });
  });
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
  } catch (error) { showToast(error.message); }
}

$("refreshWrongBookBtn")?.addEventListener("click", loadWrongBook);
$("startPracticeBtn")?.addEventListener("click", startPractice);
loadWrongBook();
