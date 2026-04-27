const $ = (id) => document.getElementById(id);
let latestReport = null;

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

function renderReport(data) {
  latestReport = data;
  $("downloadCsvBtn").disabled = false;
  $("reportRoomName").textContent = data.room?.roomName || data.room?.pin || "-";
  $("reportPlayerCount").textContent = String((data.players || []).length);
  $("reportQuestionCount").textContent = String((data.questions || []).length);

  $("studentReportList").innerHTML = `
    <table class="report-table">
      <thead>
        <tr>
          <th>學生</th>
          <th>隊伍</th>
          <th>答題數</th>
          <th>答對</th>
          <th>正確率</th>
          <th>總分</th>
        </tr>
      </thead>
      <tbody>
        ${(data.players || []).map((player) => `
          <tr>
            <td>${escapeHtml(player.playerName)}</td>
            <td>${Number(player.teamId || 0) || "-"}</td>
            <td>${Number(player.answered || 0)}</td>
            <td>${Number(player.correct || 0)}</td>
            <td>${Number(player.accuracy || 0)}%</td>
            <td>${Number(player.totalScore || 0)}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;

  $("questionReportList").innerHTML = (data.questions || []).map((question) => `
    <article class="question-card">
      <div class="question-meta-row">
        <h3>Q${Number(question.seq || 0)} ${escapeHtml(question.title || "未命名題目")}</h3>
        <span class="answer-pill">${Number(question.accuracy || 0)}%</span>
      </div>
      <p>${escapeHtml(question.content || "")}</p>
      <div class="question-tags">
        <span>作答 ${Number(question.answered || 0)} 人</span>
        <span>答對 ${Number(question.correct || 0)} 人</span>
      </div>
    </article>
  `).join("") || `<article class="question-card"><h3>沒有題目資料</h3></article>`;
}

async function loadReport() {
  const pin = $("reportPinInput").value.trim();
  if (!/^\d{6}$/.test(pin)) {
    showToast("請輸入 6 位數 PIN");
    return;
  }

  try {
    const data = await api(`/teacher_report?pin=${encodeURIComponent(pin)}`);
    renderReport(data);
  } catch (error) {
    showToast(error.message);
  }
}

function csvEscape(value) {
  const text = String(value ?? "");
  return `"${text.replaceAll('"', '""')}"`;
}

function downloadCsv() {
  if (!latestReport) return;
  const rows = [
    ["類型", "學生", "隊伍", "題號", "題目", "答對", "分數", "正確率"],
    ...(latestReport.players || []).map((player) => [
      "學生總表",
      player.playerName,
      player.teamId || "",
      "",
      "",
      `${player.correct}/${player.answered}`,
      player.totalScore,
      `${player.accuracy}%`,
    ]),
    ...(latestReport.results || []).map((row) => [
      "作答明細",
      row.playerName,
      row.teamId || "",
      row.seq,
      row.title,
      row.isCorrect ? "是" : "否",
      row.pointsEarned,
      "",
    ]),
  ];
  const csv = "\ufeff" + rows.map((row) => row.map(csvEscape).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `quizarena-report-${latestReport.room?.pin || "room"}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

$("loadReportBtn")?.addEventListener("click", loadReport);
$("downloadCsvBtn")?.addEventListener("click", downloadCsv);
$("reportPinInput")?.addEventListener("keydown", (event) => {
  if (event.key === "Enter") loadReport();
});
