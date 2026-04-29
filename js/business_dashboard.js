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

function renderDashboard(data) {
  $("userCount").textContent = Number(data.userCount || 0);
  $("reportCount").textContent = Number(data.reportCount || 0);
  $("studentParticipations").textContent = Number(data.studentParticipations || 0);
  $("averageAccuracy").textContent = `${Number(data.averageAccuracy || 0)}%`;
  $("totalWins").textContent = Number(data.totalWins || 0);
  $("trackedPlayers").textContent = Number(data.trackedPlayers || 0);

  const reports = Array.isArray(data.recentReports) ? data.recentReports : [];
  const list = $("recentReportsList");
  if (!reports.length) {
    list.innerHTML = `
      <article class="history-card">
        <strong>還沒有營運資料</strong>
        <span>完成幾場遊戲後，這裡會出現最近建房紀錄。</span>
      </article>
    `;
    return;
  }

  list.innerHTML = reports.map((report) => `
    <button class="history-card history-button" type="button" data-pin="${escapeHtml(report.pin)}">
      <strong>${escapeHtml(report.roomName || report.bankTitle || report.pin)}</strong>
      <span>PIN ${escapeHtml(report.pin)} · ${escapeHtml(report.createdBy || "unknown")} · ${Number(report.studentCount || 0)} 人</span>
      <span>${escapeHtml(report.savedAtText || "")}</span>
    </button>
  `).join("");

  list.querySelectorAll("[data-pin]").forEach((btn) => {
    btn.addEventListener("click", () => {
      window.location.href = `teacher_report.html?pin=${encodeURIComponent(btn.dataset.pin || "")}`;
    });
  });
}

async function loadDashboard() {
  try {
    const data = await api("/business_dashboard_summary");
    renderDashboard(data);
  } catch (error) {
    showToast(error.message);
  }
}

$("refreshDashboardBtn")?.addEventListener("click", loadDashboard);
loadDashboard();
