const $ = (id) => document.getElementById(id);
let latestReport = null;

function escapeHtml(value) {
  return String(value ?? "")
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

function toNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function round1(value) {
  return Math.round(toNumber(value) * 10) / 10;
}

function average(items, pick) {
  if (!items.length) return 0;
  return round1(items.reduce((sum, item) => sum + toNumber(pick(item)), 0) / items.length);
}

function safePercent(value) {
  return Math.max(0, Math.min(100, round1(value)));
}

function fileSafeName(value) {
  return String(value || "room").replace(/[\\/:*?"<>|]+/g, "-").trim() || "room";
}

function getReportAnalysis(report) {
  const players = [...(report.players || [])];
  const questions = [...(report.questions || [])].sort((a, b) => toNumber(a.seq) - toNumber(b.seq));
  const totalQuestions = questions.length;
  const avgAccuracy = average(players, (player) => player.accuracy);
  const avgScore = average(players, (player) => player.totalScore);
  const needsHelp = players.filter((player) => toNumber(player.accuracy) < 60 || toNumber(player.answered) < totalQuestions).length;
  const topPlayers = [...players]
    .sort((a, b) => toNumber(b.totalScore) - toNumber(a.totalScore) || String(a.playerName).localeCompare(String(b.playerName)))
    .slice(0, 6);
  const hardestQuestions = [...questions]
    .filter((question) => toNumber(question.answered) > 0)
    .sort((a, b) => toNumber(a.accuracy) - toNumber(b.accuracy) || toNumber(a.seq) - toNumber(b.seq))
    .slice(0, 5);
  const easiestQuestions = [...questions]
    .filter((question) => toNumber(question.answered) > 0)
    .sort((a, b) => toNumber(b.accuracy) - toNumber(a.accuracy) || toNumber(a.seq) - toNumber(b.seq))
    .slice(0, 3);
  const unansweredQuestions = questions.filter((question) => toNumber(question.answered) === 0).length;
  const maxScore = Math.max(1, ...players.map((player) => toNumber(player.totalScore)));
  const accuracyBands = [
    { label: "90-100%", count: players.filter((player) => toNumber(player.accuracy) >= 90).length },
    { label: "70-89%", count: players.filter((player) => toNumber(player.accuracy) >= 70 && toNumber(player.accuracy) < 90).length },
    { label: "60-69%", count: players.filter((player) => toNumber(player.accuracy) >= 60 && toNumber(player.accuracy) < 70).length },
    { label: "0-59%", count: players.filter((player) => toNumber(player.accuracy) < 60).length },
  ];

  const teamMap = new Map();
  players.forEach((player) => {
    const key = toNumber(player.teamId) || 0;
    if (!teamMap.has(key)) {
      teamMap.set(key, { teamId: key, members: 0, answered: 0, correct: 0, totalScore: 0 });
    }
    const team = teamMap.get(key);
    team.members += 1;
    team.answered += toNumber(player.answered);
    team.correct += toNumber(player.correct);
    team.totalScore += toNumber(player.totalScore);
  });
  const teams = [...teamMap.values()].map((team) => ({
    ...team,
    teamName: team.teamId ? `第 ${team.teamId} 隊` : "未分隊",
    accuracy: team.answered ? round1((team.correct / team.answered) * 100) : 0,
    averageScore: team.members ? round1(team.totalScore / team.members) : 0,
  })).sort((a, b) => b.totalScore - a.totalScore);

  return {
    players,
    questions,
    totalQuestions,
    avgAccuracy,
    avgScore,
    needsHelp,
    topPlayers,
    hardestQuestions,
    easiestQuestions,
    unansweredQuestions,
    maxScore,
    accuracyBands,
    teams,
  };
}

function renderHistory(reports) {
  const list = $("reportHistoryList");
  if (!list) return;
  if (!reports.length) {
    list.innerHTML = `
      <article class="history-card">
        <strong>目前沒有歷史報表</strong>
        <span>遊戲結束或房間被刪除前，系統會自動保存報表快照。</span>
      </article>
    `;
    return;
  }

  list.innerHTML = reports.map((report) => `
    <button class="history-card history-button" type="button" data-pin="${escapeHtml(report.pin)}">
      <strong>${escapeHtml(report.roomName || report.bankTitle || report.pin)}</strong>
      <span>PIN ${escapeHtml(report.pin)} · ${escapeHtml(report.savedAtText || "")}</span>
    </button>
  `).join("");

  list.querySelectorAll("[data-pin]").forEach((btn) => {
    btn.addEventListener("click", () => {
      $("reportPinInput").value = btn.dataset.pin || "";
      loadReport(btn.dataset.pin || "");
    });
  });
}

async function loadHistory() {
  const username = localStorage.getItem("currentUser") || "";
  const query = username ? `?username=${encodeURIComponent(username)}` : "";
  try {
    const data = await api(`/teacher_report_history${query}`);
    renderHistory(data.reports || []);
  } catch (error) {
    showToast(error.message);
  }
}

function barRows(items, options) {
  const max = Math.max(1, toNumber(options.max || 100));
  if (!items.length) return `<p class="report-empty">${escapeHtml(options.empty || "目前沒有資料")}</p>`;
  return `
    <div class="bar-list">
      ${items.map((item) => {
        const value = toNumber(options.value(item));
        const width = safePercent((value / max) * 100);
        const warn = options.warn ? options.warn(item) : false;
        return `
          <div class="bar-row">
            <span class="bar-label" title="${escapeHtml(options.label(item))}">${escapeHtml(options.label(item))}</span>
            <span class="bar-track"><span class="bar-fill ${warn ? "warn" : ""}" style="width:${width}%"></span></span>
            <span class="bar-value">${escapeHtml(options.format ? options.format(value, item) : value)}</span>
          </div>
        `;
      }).join("")}
    </div>
  `;
}

function renderAnalysis(data) {
  const panel = $("reportAnalysisPanel");
  if (!panel) return;
  const analysis = getReportAnalysis(data);

  panel.innerHTML = `
    <article class="analysis-card">
      <h3>重點洞察</h3>
      <ul class="insight-list">
        <li><span>全班平均正確率</span><strong>${analysis.avgAccuracy}%</strong></li>
        <li><span>全班平均分數</span><strong>${analysis.avgScore}</strong></li>
        <li><span>需補強學生</span><strong>${analysis.needsHelp} 人</strong></li>
        <li><span>未被作答題目</span><strong>${analysis.unansweredQuestions} 題</strong></li>
      </ul>
    </article>

    <article class="analysis-card">
      <h3>正確率分布</h3>
      <div class="distribution-grid">
        ${analysis.accuracyBands.map((band) => `
          <div class="distribution-item">
            <span>${escapeHtml(band.label)}</span>
            <strong>${band.count}</strong>
          </div>
        `).join("")}
      </div>
    </article>

    <article class="analysis-card wide">
      <h3>學生分數排行</h3>
      ${barRows(analysis.topPlayers, {
        label: (player) => player.playerName,
        value: (player) => player.totalScore,
        max: analysis.maxScore,
        format: (value, player) => `${value} 分 / ${toNumber(player.accuracy)}%`,
        empty: "目前沒有學生資料",
      })}
    </article>

    <article class="analysis-card">
      <h3>最需要複習的題目</h3>
      ${barRows(analysis.hardestQuestions, {
        label: (question) => `Q${toNumber(question.seq)} ${question.title || "未命名題目"}`,
        value: (question) => question.accuracy,
        max: 100,
        format: (value, question) => `${value}%`,
        warn: (question) => toNumber(question.accuracy) < 60,
        empty: "目前沒有題目作答資料",
      })}
    </article>

    <article class="analysis-card">
      <h3>隊伍表現</h3>
      ${barRows(analysis.teams, {
        label: (team) => team.teamName,
        value: (team) => team.accuracy,
        max: 100,
        format: (value, team) => `${value}% / ${toNumber(team.totalScore)} 分`,
        warn: (team) => toNumber(team.accuracy) < 60,
        empty: "目前沒有隊伍資料",
      })}
    </article>
  `;
}

function renderReport(data) {
  const analysis = getReportAnalysis(data);
  latestReport = data;
  $("downloadCsvBtn").disabled = false;
  $("downloadExcelReportBtn").disabled = false;
  $("downloadHtmlReportBtn").disabled = false;
  $("reportRoomName").textContent = data.room?.roomName || data.room?.pin || "-";
  $("reportPlayerCount").textContent = String((data.players || []).length);
  $("reportQuestionCount").textContent = String((data.questions || []).length);
  $("reportAverageAccuracy").textContent = `${analysis.avgAccuracy}%`;
  $("reportAverageScore").textContent = String(analysis.avgScore);
  $("reportNeedsHelp").textContent = String(analysis.needsHelp);
  if (data.fromHistory) showToast("已載入歷史報表");

  renderAnalysis(data);

  $("studentReportList").innerHTML = `
    <table class="report-table">
      <thead>
        <tr>
          <th>排名</th>
          <th>學生</th>
          <th>隊伍</th>
          <th>答題數</th>
          <th>答對</th>
          <th>正確率</th>
          <th>總分</th>
          <th>狀態</th>
        </tr>
      </thead>
      <tbody>
        ${(data.players || []).map((player, index) => {
          const needsHelp = toNumber(player.accuracy) < 60 || toNumber(player.answered) < analysis.totalQuestions;
          return `
            <tr>
              <td>${index + 1}</td>
              <td>${escapeHtml(player.playerName)}</td>
              <td>${Number(player.teamId || 0) || "-"}</td>
              <td>${Number(player.answered || 0)}</td>
              <td>${Number(player.correct || 0)}</td>
              <td>${Number(player.accuracy || 0)}%</td>
              <td>${Number(player.totalScore || 0)}</td>
              <td>${needsHelp ? "需補強" : "穩定"}</td>
            </tr>
          `;
        }).join("")}
      </tbody>
    </table>
  `;

  $("questionReportList").innerHTML = (data.questions || []).map((question) => {
    const accuracy = Number(question.accuracy || 0);
    const status = toNumber(question.answered) === 0 ? "未作答" : accuracy < 60 ? "建議複習" : "掌握良好";
    return `
      <article class="question-card">
        <div class="question-meta-row">
          <h3>Q${Number(question.seq || 0)} ${escapeHtml(question.title || "未命名題目")}</h3>
          <span class="answer-pill">${accuracy}% · ${status}</span>
        </div>
        <p>${escapeHtml(question.content || "")}</p>
        <div class="question-tags">
          <span>作答 ${Number(question.answered || 0)} 人</span>
          <span>答對 ${Number(question.correct || 0)} 人</span>
          <span>答錯 ${Math.max(0, Number(question.answered || 0) - Number(question.correct || 0))} 人</span>
          <span>正解 ${escapeHtml(question.correctAnswerText || "-")}</span>
        </div>
        ${question.explanation ? `<div class="explanation-box">${escapeHtml(question.explanation)}</div>` : ""}
      </article>
    `;
  }).join("") || `<article class="question-card"><h3>沒有題目資料</h3></article>`;
}

async function loadReport(pinOverride = "") {
  const pin = String(pinOverride || $("reportPinInput").value || "").trim();
  if (!/^\d{6}$/.test(pin)) {
    showToast("請輸入 6 位數 PIN");
    return;
  }

  try {
    const data = await api(`/teacher_report?pin=${encodeURIComponent(pin)}`);
    renderReport(data);
    loadHistory();
  } catch (error) {
    showToast(error.message);
  }
}

function csvEscape(value) {
  const text = String(value ?? "");
  return `"${text.replaceAll('"', '""')}"`;
}

function downloadBlob(content, type, filename) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function downloadCsv() {
  if (!latestReport) return;
  const analysis = getReportAnalysis(latestReport);
  const room = latestReport.room || {};
  const rows = [
    ["QuizArena 老師報表"],
    ["房間", room.roomName || room.pin || ""],
    ["PIN", room.pin || ""],
    ["題庫", room.bankTitle || ""],
    ["學生數", analysis.players.length],
    ["題目數", analysis.questions.length],
    ["平均正確率", `${analysis.avgAccuracy}%`],
    ["平均分數", analysis.avgScore],
    ["需關注學生", analysis.needsHelp],
    [],
    ["學生總表"],
    ["排名", "學生", "隊伍", "答題數", "答對", "答錯", "正確率", "總分", "狀態"],
    ...analysis.players.map((player, index) => [
      index + 1,
      player.playerName,
      player.teamId || "",
      player.answered || 0,
      player.correct || 0,
      Math.max(0, toNumber(player.answered) - toNumber(player.correct)),
      `${player.accuracy || 0}%`,
      player.totalScore || 0,
      (toNumber(player.accuracy) < 60 || toNumber(player.answered) < analysis.totalQuestions) ? "需補強" : "穩定",
    ]),
    [],
    ["隊伍分析"],
    ["隊伍", "成員數", "答題數", "答對", "正確率", "總分", "平均分數"],
    ...analysis.teams.map((team) => [
      team.teamName,
      team.members,
      team.answered,
      team.correct,
      `${team.accuracy}%`,
      team.totalScore,
      team.averageScore,
    ]),
    [],
    ["題目分析"],
    ["題號", "題目", "內容", "正確答案", "解析", "作答人數", "答對", "答錯", "正確率", "判讀"],
    ...analysis.questions.map((question) => [
      question.seq,
      question.title,
      question.content,
      question.correctAnswerText || "",
      question.explanation || "",
      question.answered || 0,
      question.correct || 0,
      Math.max(0, toNumber(question.answered) - toNumber(question.correct)),
      `${question.accuracy || 0}%`,
      toNumber(question.answered) === 0 ? "未作答" : toNumber(question.accuracy) < 60 ? "建議複習" : "掌握良好",
    ]),
    [],
    ["作答明細"],
    ["學生", "隊伍", "題號", "題目", "是否答對", "得分", "作答順序"],
    ...(latestReport.results || []).map((row) => [
      row.playerName,
      row.teamId || "",
      row.seq,
      row.title,
      row.isCorrect ? "是" : "否",
      row.pointsEarned,
      row.answerOrder || "",
    ]),
  ];
  const csv = "\ufeff" + rows.map((row) => row.map(csvEscape).join(",")).join("\n");
  downloadBlob(csv, "text/csv;charset=utf-8", `quizarena-report-${fileSafeName(room.pin)}.csv`);
}

function excelTableRows(items, cells) {
  return items.map((item, index) => `
    <tr>${cells.map((cell) => `<td>${escapeHtml(cell(item, index))}</td>`).join("")}</tr>
  `).join("");
}

function excelBar(value, max = 100, warn = false) {
  const width = safePercent((toNumber(value) / Math.max(1, toNumber(max))) * 100);
  const color = warn ? "#ff6cae" : "#5d63d8";
  return `
    <div class="excel-bar">
      <span style="width:${width}%;background:${color};"></span>
    </div>
    <b>${escapeHtml(value)}</b>
  `;
}

function buildExcelReport(report) {
  const analysis = getReportAnalysis(report);
  const room = report.room || {};
  const generatedAt = new Date().toLocaleString("zh-TW");
  const questionStatus = (question) => {
    if (toNumber(question.answered) === 0) return "未作答";
    return toNumber(question.accuracy) < 60 ? "建議複習" : "掌握良好";
  };
  const playerStatus = (player) => (
    toNumber(player.accuracy) < 60 || toNumber(player.answered) < analysis.totalQuestions
      ? "需補強"
      : "穩定"
  );

  return `<!doctype html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body{font-family:"Microsoft JhengHei",Arial,sans-serif;color:#293150}
    h1{font-size:24px;color:#293150}
    h2{margin-top:24px;font-size:18px;color:#5d63d8}
    .muted{color:#66709b}
    table{border-collapse:collapse;width:100%;margin-bottom:18px}
    th{background:#5d63d8;color:#fff;font-weight:700}
    th,td{border:1px solid #dfe3f4;padding:8px;text-align:left;vertical-align:middle}
    .metric th{background:#eef0ff;color:#5d63d8}
    .metric td{font-size:20px;font-weight:700;color:#293150}
    .good{color:#168557;font-weight:700}
    .warn{color:#d23b77;font-weight:700}
    .excel-bar{display:inline-block;width:160px;height:12px;margin-right:8px;background:#edf0fb;border-radius:8px;overflow:hidden;vertical-align:middle}
    .excel-bar span{display:block;height:12px;border-radius:8px}
  </style>
</head>
<body>
  <h1>QuizArena 老師 Excel 報表</h1>
  <p class="muted">${escapeHtml(room.roomName || room.bankTitle || "未命名房間")}｜PIN ${escapeHtml(room.pin || "")}｜${escapeHtml(generatedAt)}</p>

  <h2>報表摘要</h2>
  <table class="metric">
    <tr><th>學生數</th><th>題目數</th><th>平均正確率</th><th>平均分數</th><th>需關注學生</th></tr>
    <tr><td>${analysis.players.length}</td><td>${analysis.questions.length}</td><td>${analysis.avgAccuracy}%</td><td>${analysis.avgScore}</td><td>${analysis.needsHelp}</td></tr>
  </table>

  <h2>圖表分析</h2>
  <table>
    <tr><th>類型</th><th>名稱</th><th>視覺化</th><th>補充</th></tr>
    ${analysis.topPlayers.map((player) => `
      <tr>
        <td>學生分數</td>
        <td>${escapeHtml(player.playerName)}</td>
        <td>${excelBar(player.totalScore, analysis.maxScore)}</td>
        <td>${toNumber(player.totalScore)} 分 / ${toNumber(player.accuracy)}%</td>
      </tr>
    `).join("")}
    ${analysis.hardestQuestions.map((question) => `
      <tr>
        <td>難題正確率</td>
        <td>Q${toNumber(question.seq)} ${escapeHtml(question.title || "未命名題目")}</td>
        <td>${excelBar(toNumber(question.accuracy), 100, toNumber(question.accuracy) < 60)}%</td>
        <td>${escapeHtml(questionStatus(question))}</td>
      </tr>
    `).join("")}
    ${analysis.teams.map((team) => `
      <tr>
        <td>隊伍正確率</td>
        <td>${escapeHtml(team.teamName)}</td>
        <td>${excelBar(toNumber(team.accuracy), 100, toNumber(team.accuracy) < 60)}%</td>
        <td>${toNumber(team.totalScore)} 分 / ${toNumber(team.members)} 人</td>
      </tr>
    `).join("")}
  </table>

  <h2>學生總表</h2>
  <table>
    <tr><th>排名</th><th>學生</th><th>隊伍</th><th>答題數</th><th>答對</th><th>答錯</th><th>正確率</th><th>總分</th><th>狀態</th></tr>
    ${excelTableRows(analysis.players, [
      (player, index) => index + 1,
      (player) => player.playerName,
      (player) => player.teamId || "",
      (player) => player.answered || 0,
      (player) => player.correct || 0,
      (player) => Math.max(0, toNumber(player.answered) - toNumber(player.correct)),
      (player) => `${player.accuracy || 0}%`,
      (player) => player.totalScore || 0,
      (player) => playerStatus(player),
    ])}
  </table>

  <h2>隊伍分析</h2>
  <table>
    <tr><th>隊伍</th><th>成員數</th><th>答題數</th><th>答對</th><th>正確率</th><th>總分</th><th>平均分數</th></tr>
    ${excelTableRows(analysis.teams, [
      (team) => team.teamName,
      (team) => team.members,
      (team) => team.answered,
      (team) => team.correct,
      (team) => `${team.accuracy}%`,
      (team) => team.totalScore,
      (team) => team.averageScore,
    ])}
  </table>

  <h2>題目分析</h2>
  <table>
    <tr><th>題號</th><th>題目</th><th>內容</th><th>正確答案</th><th>解析</th><th>作答</th><th>答對</th><th>答錯</th><th>正確率</th><th>判讀</th></tr>
    ${excelTableRows(analysis.questions, [
      (question) => question.seq,
      (question) => question.title,
      (question) => question.content,
      (question) => question.correctAnswerText || "",
      (question) => question.explanation || "",
      (question) => question.answered || 0,
      (question) => question.correct || 0,
      (question) => Math.max(0, toNumber(question.answered) - toNumber(question.correct)),
      (question) => `${question.accuracy || 0}%`,
      (question) => questionStatus(question),
    ])}
  </table>

  <h2>作答明細</h2>
  <table>
    <tr><th>學生</th><th>隊伍</th><th>題號</th><th>題目</th><th>是否答對</th><th>得分</th><th>作答順序</th></tr>
    ${excelTableRows(report.results || [], [
      (row) => row.playerName,
      (row) => row.teamId || "",
      (row) => row.seq,
      (row) => row.title,
      (row) => row.isCorrect ? "是" : "否",
      (row) => row.pointsEarned,
      (row) => row.answerOrder || "",
    ])}
  </table>
</body>
</html>`;
}

function downloadExcelReport() {
  if (!latestReport) return;
  const excel = "\ufeff" + buildExcelReport(latestReport);
  downloadBlob(excel, "application/vnd.ms-excel;charset=utf-8", `quizarena-excel-report-${fileSafeName(latestReport.room?.pin)}.xls`);
}

function htmlBars(items, options) {
  const max = Math.max(1, toNumber(options.max || 100));
  if (!items.length) return `<p class="empty">目前沒有資料</p>`;
  return items.map((item) => {
    const value = toNumber(options.value(item));
    const width = safePercent((value / max) * 100);
    const warn = options.warn ? options.warn(item) : false;
    return `
      <div class="bar-row">
        <span>${escapeHtml(options.label(item))}</span>
        <b><i class="${warn ? "warn" : ""}" style="width:${width}%"></i></b>
        <em>${escapeHtml(options.format ? options.format(value, item) : value)}</em>
      </div>
    `;
  }).join("");
}

function buildHtmlReport(report) {
  const analysis = getReportAnalysis(report);
  const room = report.room || {};
  const generatedAt = new Date().toLocaleString("zh-TW");
  return `<!doctype html>
<html lang="zh-Hant">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>QuizArena 分析報告 - ${escapeHtml(room.pin || "")}</title>
  <style>
    *{box-sizing:border-box}body{margin:0;color:#293150;font-family:"Noto Sans TC","Microsoft JhengHei",Arial,sans-serif;background:#f5f7ff}.page{width:min(1040px,calc(100% - 32px));margin:0 auto;padding:32px 0 48px}header{padding:26px;border-radius:24px;color:#fff;background:linear-gradient(135deg,#5d63d8,#48c0d8);box-shadow:0 20px 42px rgba(83,92,143,.18)}h1,h2,h3,p{margin:0}header p{margin-top:8px;opacity:.9}.grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin:18px 0}.card{padding:18px;border-radius:18px;background:#fff;box-shadow:0 12px 30px rgba(83,92,143,.1)}.metric span{display:block;color:#7880a5;font-weight:800;font-size:.82rem}.metric strong{display:block;margin-top:4px;color:#5d63d8;font-size:1.8rem}.section{margin-top:18px}.bar-row{display:grid;grid-template-columns:minmax(120px,1fr) minmax(160px,2fr) 70px;gap:12px;align-items:center;margin-top:10px;font-weight:800}.bar-row span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.bar-row b{height:13px;overflow:hidden;border-radius:999px;background:#edf0fb}.bar-row i{display:block;height:100%;border-radius:999px;background:linear-gradient(90deg,#7c7bff,#48c0d8)}.bar-row i.warn{background:linear-gradient(90deg,#ff9a8b,#ff6cae)}.bar-row em{color:#66709b;font-style:normal;text-align:right}table{width:100%;border-collapse:collapse;margin-top:12px}th,td{padding:10px;border-bottom:1px solid #e8ebf8;text-align:left}th{color:#66709b;font-size:.8rem}.tag{display:inline-block;padding:5px 9px;border-radius:999px;background:#f0f2ff;color:#66709b;font-weight:900;font-size:.78rem}.empty{padding:12px;border-radius:12px;background:#f7f8ff;color:#66709b;font-weight:800}@media(max-width:760px){.grid{grid-template-columns:1fr}.bar-row{grid-template-columns:1fr}.bar-row em{text-align:left}}
  </style>
</head>
<body>
  <main class="page">
    <header>
      <h1>QuizArena 老師分析報告</h1>
      <p>${escapeHtml(room.roomName || room.bankTitle || "未命名房間")} · PIN ${escapeHtml(room.pin || "")} · ${escapeHtml(generatedAt)}</p>
    </header>

    <section class="grid">
      <article class="card metric"><span>學生數</span><strong>${analysis.players.length}</strong></article>
      <article class="card metric"><span>題目數</span><strong>${analysis.questions.length}</strong></article>
      <article class="card metric"><span>平均正確率</span><strong>${analysis.avgAccuracy}%</strong></article>
      <article class="card metric"><span>需關注學生</span><strong>${analysis.needsHelp}</strong></article>
    </section>

    <section class="card section">
      <h2>學生分數排行</h2>
      ${htmlBars(analysis.topPlayers, {
        label: (player) => player.playerName,
        value: (player) => player.totalScore,
        max: analysis.maxScore,
        format: (value, player) => `${value} 分 / ${toNumber(player.accuracy)}%`,
      })}
    </section>

    <section class="grid section">
      <article class="card">
        <h2>最需要複習的題目</h2>
        ${htmlBars(analysis.hardestQuestions, {
          label: (question) => `Q${toNumber(question.seq)} ${question.title || "未命名題目"}`,
          value: (question) => question.accuracy,
          max: 100,
          format: (value) => `${value}%`,
          warn: (question) => toNumber(question.accuracy) < 60,
        })}
      </article>
      <article class="card">
        <h2>隊伍表現</h2>
        ${htmlBars(analysis.teams, {
          label: (team) => team.teamName,
          value: (team) => team.accuracy,
          max: 100,
          format: (value, team) => `${value}% / ${toNumber(team.totalScore)} 分`,
          warn: (team) => toNumber(team.accuracy) < 60,
        })}
      </article>
    </section>

    <section class="card section">
      <h2>學生總表</h2>
      <table>
        <thead><tr><th>排名</th><th>學生</th><th>隊伍</th><th>答對</th><th>正確率</th><th>總分</th><th>狀態</th></tr></thead>
        <tbody>
          ${analysis.players.map((player, index) => {
            const needsHelp = toNumber(player.accuracy) < 60 || toNumber(player.answered) < analysis.totalQuestions;
            return `<tr><td>${index + 1}</td><td>${escapeHtml(player.playerName)}</td><td>${toNumber(player.teamId) || "-"}</td><td>${toNumber(player.correct)}/${toNumber(player.answered)}</td><td>${toNumber(player.accuracy)}%</td><td>${toNumber(player.totalScore)}</td><td><span class="tag">${needsHelp ? "需補強" : "穩定"}</span></td></tr>`;
          }).join("")}
        </tbody>
      </table>
    </section>

    <section class="card section">
      <h2>題目分析</h2>
      <table>
        <thead><tr><th>題號</th><th>題目</th><th>正確答案</th><th>作答</th><th>答對</th><th>正確率</th><th>判讀</th></tr></thead>
        <tbody>
          ${analysis.questions.map((question) => {
            const accuracy = toNumber(question.accuracy);
            const status = toNumber(question.answered) === 0 ? "未作答" : accuracy < 60 ? "建議複習" : "掌握良好";
            return `<tr><td>Q${toNumber(question.seq)}</td><td>${escapeHtml(question.title || question.content || "未命名題目")}</td><td>${escapeHtml(question.correctAnswerText || "-")}</td><td>${toNumber(question.answered)}</td><td>${toNumber(question.correct)}</td><td>${accuracy}%</td><td><span class="tag">${status}</span></td></tr>`;
          }).join("")}
        </tbody>
      </table>
    </section>
  </main>
</body>
</html>`;
}

function downloadHtmlReport() {
  if (!latestReport) return;
  const html = buildHtmlReport(latestReport);
  downloadBlob(html, "text/html;charset=utf-8", `quizarena-analysis-${fileSafeName(latestReport.room?.pin)}.html`);
}

$("loadReportBtn")?.addEventListener("click", () => loadReport());
$("downloadCsvBtn")?.addEventListener("click", downloadCsv);
$("downloadExcelReportBtn")?.addEventListener("click", downloadExcelReport);
$("downloadHtmlReportBtn")?.addEventListener("click", downloadHtmlReport);
$("refreshHistoryBtn")?.addEventListener("click", loadHistory);
$("reportPinInput")?.addEventListener("keydown", (event) => {
  if (event.key === "Enter") loadReport();
});

loadHistory();

const initialPin = new URLSearchParams(window.location.search).get("pin") || "";
if (/^\d{6}$/.test(initialPin)) {
  $("reportPinInput").value = initialPin;
  loadReport(initialPin);
}
