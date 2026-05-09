// js/analytics-history.js

const ME = localStorage.getItem('playerName') || '';
let currentOffset = 0;
const PAGE_SIZE = 10;
let trendChartInstance = null;

document.getElementById('player-name-label').textContent = ME || '（未登入）';

async function loadPage(offset) {
  currentOffset = offset;
  const [histRes, statsRes] = await Promise.all([
    fetch(`/api/history/${encodeURIComponent(ME)}?limit=${PAGE_SIZE}&offset=${offset}`),
    fetch(`/api/stats/${encodeURIComponent(ME)}`),
  ]);
  const histData = await histRes.json();
  const statsData = await statsRes.json();

  renderStats(statsData);
  renderHistory(histData.history || []);
  renderTrend(histData.history || []);
  renderPagination(histData.history || []);
}

function renderStats(stats) {
  document.getElementById('stats-grid').innerHTML = [
    { label: '總場數',    value: stats.total_games || 0,        color: '#f0abfc' },
    { label: '勝率',      value: `${stats.win_rate || 0}%`,     color: '#ffd700' },
    { label: '平均正確率', value: `${stats.accuracy || 0}%`,    color: '#34d399' },
    { label: '最長連勝',  value: `${stats.best_streak || 0} 場`, color: '#60a5fa' },
  ].map(s => `
    <div class="stat-card">
      <div class="stat-value" style="color:${s.color};">${s.value}</div>
      <div class="stat-label">${s.label}</div>
    </div>
  `).join('');
}

function renderTrend(history) {
  const recent = [...history].slice(0, 10).reverse();
  const labels = recent.map(h => h.played_at?.split('T')[0] || h.played_at?.split(' ')[0] || '');
  const scores = recent.map(h => h.total_score);

  if (trendChartInstance) trendChartInstance.destroy();
  trendChartInstance = new Chart(document.getElementById('trend-chart'), {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: '分數',
        data: scores,
        borderColor: '#7c3aed',
        backgroundColor: 'rgba(124,58,237,0.15)',
        fill: true,
        tension: 0.4,
        pointBackgroundColor: '#f0abfc',
        pointRadius: 5,
      }],
    },
    options: {
      animation: { duration: 1000 },
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: '#a78bfa', maxRotation: 30 }, grid: { color: 'rgba(139,92,246,0.1)' } },
        y: { ticks: { color: '#a78bfa' }, grid: { color: 'rgba(139,92,246,0.1)' } },
      },
    },
  });
}

function renderHistory(history) {
  if (!history.length) {
    document.getElementById('history-list').innerHTML =
      '<div style="text-align:center;color:#6d28d9;padding:40px;">尚無戰績紀錄</div>';
    return;
  }
  document.getElementById('history-list').innerHTML = history.map(h => {
    const accuracy = h.correct_count + h.wrong_count > 0
      ? Math.round(h.correct_count * 100 / (h.correct_count + h.wrong_count))
      : 0;
    const rankBadge = h.rank === 1 ? 'badge-gold' : h.rank <= 3 ? 'badge-purple' : '';
    const subj = h.subject_scores || {};
    const subjHTML = Object.entries(subj).map(([s, v]) =>
      `<span style="font-size:12px;color:#a78bfa;">${s}: <span style="color:#f0abfc;">${v}</span></span>`
    ).join(' · ');

    return `<div class="history-card" onclick="this.classList.toggle('expanded')">
      <div class="hc-header">
        <span class="hc-room">${h.room_name || h.room_id}</span>
        <span class="hc-date">${(h.played_at || '').slice(0, 10)}</span>
      </div>
      <div style="font-size:12px;color:#6d28d9;margin:2px 0;">${h.quiz_bank_name || ''}</div>
      <div class="hc-stats">
        <div class="hc-stat">分數 <span>${h.total_score}</span></div>
        <div class="hc-stat">排名 <span ${rankBadge ? `class="badge ${rankBadge}"` : ''}>
          第 ${h.rank} / ${h.total_players} 名</span></div>
        <div class="hc-stat">正確率 <span>${accuracy}%</span></div>
        ${h.avg_speed_sec ? `<div class="hc-stat">速度 <span>${Number(h.avg_speed_sec).toFixed(1)}s</span></div>` : ''}
      </div>
      <div class="hc-expand">
        ${subjHTML || '<span style="color:#6d28d9;font-size:12px;">無科目資料</span>'}
      </div>
    </div>`;
  }).join('');
}

function renderPagination(history) {
  const prevBtn = currentOffset > 0 ? `
    <button onclick="loadPage(${currentOffset - PAGE_SIZE})"
      style="background:rgba(139,92,246,0.2);border:1px solid rgba(139,92,246,0.4);color:#e9d5ff;padding:6px 16px;border-radius:8px;cursor:pointer;">
      ← 上一頁
    </button>
  ` : '';
  const nextBtn = history.length === PAGE_SIZE ? `
    <button onclick="loadPage(${currentOffset + PAGE_SIZE})"
      style="background:rgba(139,92,246,0.2);border:1px solid rgba(139,92,246,0.4);color:#e9d5ff;padding:6px 16px;border-radius:8px;cursor:pointer;">
      下一頁 →
    </button>
  ` : '';
  document.getElementById('pagination').innerHTML = prevBtn + nextBtn;
}

if (ME) {
  loadPage(0);
  RadarChart.loadAndRender('radar-canvas', ME);
} else {
  document.getElementById('history-list').innerHTML =
    '<div style="text-align:center;color:#f87171;padding:40px;">請先登入才能查看戰績</div>';
}
