// js/analytics-game-results.js

const ROOM_ID = location.pathname.split('/').pop();
const ME = localStorage.getItem('playerName') || '';

let gameData = null;

async function loadGameResults() {
  try {
    const res = await fetch(`/api/game-results/${ROOM_ID}?player=${encodeURIComponent(ME)}`);
    gameData = await res.json();
    renderRankings(gameData);
    renderMyStats(gameData);
    updateRoomSubtitle(gameData);

    // 教師 Tab：僅房主可見
    const isHost = localStorage.getItem('isHost') === 'true';
    if (isHost) {
      document.getElementById('teacher-tab-btn').style.display = '';
      renderTeacherView(gameData);
    }
  } catch (e) {
    console.error('[game-results] load error:', e);
  }
}

function updateRoomSubtitle(data) {
  const r = data.rankings?.[0];
  document.getElementById('room-subtitle').textContent = `房間 ${ROOM_ID} · ${r?.total_players || '?'} 位玩家`;
}

function rankEmoji(rank) {
  if (rank === 1) return '👑';
  if (rank === 2) return '🥈';
  if (rank === 3) return '🥉';
  return `#${rank}`;
}

function renderRankings(data) {
  const { rankings = [] } = data;
  const top3 = rankings.slice(0, 3);
  const rest = rankings.slice(3);

  // 頒獎台（前三名：銀、金、銅排列）
  const podiumOrder = [1, 0, 2];
  const podiumHTML = podiumOrder.map(i => {
    const p = top3[i];
    if (!p) return '';
    const cls = i === 0 ? 'gold' : i === 1 ? 'silver' : 'bronze';
    const crown = i === 0 ? '👑' : i === 1 ? '🥈' : '🥉';
    const isMe = p.player_name === ME;
    return `<div class="top-card ${cls}${isMe ? ' me' : ''}">
      <div class="crown">${crown}</div>
      <div class="top-avatar">🧝</div>
      <div class="top-name">${p.player_name}${isMe ? ' (你)' : ''}</div>
      <div class="top-score">${p.score}</div>
      <div style="font-size:11px;color:#a78bfa;margin-top:4px;">${p.accuracy}% 正確</div>
    </div>`;
  }).join('');
  document.getElementById('top3-container').innerHTML = podiumHTML;

  // 其餘排名列表
  const listHTML = rest.map(p => {
    const isMe = p.player_name === ME;
    return `<div class="lb-row${isMe ? ' me' : ''}">
      <span class="lb-rank">${p.rank}</span>
      <span class="lb-avatar">🧙</span>
      <span class="lb-name">${p.player_name}${isMe ? ' <span class="badge badge-purple">你</span>' : ''}</span>
      <span style="color:#a78bfa;font-size:12px;flex:1;">${p.accuracy}%</span>
      <span class="lb-score">${p.score}</span>
    </div>`;
  }).join('');
  document.getElementById('rankings-list').innerHTML = listHTML;
}

function renderMyStats(data) {
  const ms = data.my_stats || {};
  const grid = document.getElementById('my-stats-grid');

  grid.innerHTML = [
    { label: '本場分數', value: ms.score || 0, color: '#f0abfc' },
    { label: '排名', value: ms.rank ? `第 ${ms.rank} 名` : '-', color: '#ffd700' },
    { label: '超越玩家', value: `${ms.percentile || 0}%`, color: '#34d399' },
    { label: '答題速度', value: ms.avg_speed_sec ? `${ms.avg_speed_sec.toFixed(1)}s` : '-', color: '#60a5fa' },
  ].map(s => `
    <div class="stat-card">
      <div class="stat-value animate-number" style="color:${s.color};">${s.value}</div>
      <div class="stat-label">${s.label}</div>
    </div>
  `).join('');

  // 各科分數長條圖
  const subj = ms.subject_scores || {};
  const labels = Object.keys(subj);
  if (labels.length > 0) {
    new Chart(document.getElementById('subject-bar-chart'), {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: '我的分數',
          data: labels.map(l => subj[l]),
          backgroundColor: 'rgba(124,58,237,0.7)',
          borderColor: '#7c3aed',
          borderWidth: 1,
        }],
      },
      options: {
        animation: { duration: 800 },
        plugins: { legend: { labels: { color: '#e9d5ff' } } },
        scales: {
          x: { ticks: { color: '#a78bfa' }, grid: { color: 'rgba(139,92,246,0.1)' } },
          y: { min: 0, max: 100, ticks: { color: '#a78bfa' }, grid: { color: 'rgba(139,92,246,0.1)' } },
        },
      },
    });
  }

  // 圓餅圖
  const correct = ms.correct_count || 0;
  const wrong = ms.wrong_count || 0;
  new Chart(document.getElementById('accuracy-donut-chart'), {
    type: 'doughnut',
    data: {
      labels: ['答對', '答錯'],
      datasets: [{ data: [correct, wrong], backgroundColor: ['#34d399', '#f87171'], borderWidth: 0 }],
    },
    options: {
      animation: { duration: 1000 },
      plugins: { legend: { labels: { color: '#e9d5ff' } } },
    },
  });
}

function renderTeacherView(data) {
  const top5 = data.top5_wrong_questions || [];
  const total = data.rankings?.length || 1;
  document.getElementById('wrong-questions-list').innerHTML = top5.map(q => `
    <div style="margin-bottom:10px;">
      <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
        <span style="font-size:13px;">題目 ${q.q_id}</span>
        <span style="color:#f87171;font-size:13px;">${q.wrong_count}/${total} 人答錯</span>
      </div>
      <div class="progress-bar-container">
        <div class="progress-bar" style="width:${q.wrong_count/total*100}%;background:linear-gradient(90deg,#f87171,#dc2626);"></div>
      </div>
    </div>
  `).join('') || '<p style="color:#6d28d9;">無資料</p>';

  const rankings = data.rankings || [];
  if (!rankings.length) return;
  const tableHTML = `<table style="width:100%;border-collapse:collapse;font-size:12px;">
    <thead>
      <tr style="color:#a78bfa;border-bottom:1px solid rgba(139,92,246,0.3);">
        <th style="padding:6px;text-align:left;">玩家</th>
        <th style="padding:6px;text-align:center;">排名</th>
        <th style="padding:6px;text-align:center;">分數</th>
        <th style="padding:6px;text-align:center;">正確率</th>
        <th style="padding:6px;text-align:center;">速度</th>
      </tr>
    </thead>
    <tbody>
      ${rankings.map(p => `
        <tr style="border-bottom:1px solid rgba(139,92,246,0.1);color:${p.accuracy < 50 ? '#f87171' : '#e9d5ff'};">
          <td style="padding:6px;">${p.player_name}</td>
          <td style="padding:6px;text-align:center;">${p.rank}</td>
          <td style="padding:6px;text-align:center;">${p.score}</td>
          <td style="padding:6px;text-align:center;">${p.accuracy}%</td>
          <td style="padding:6px;text-align:center;">${p.avg_speed_sec ? p.avg_speed_sec.toFixed(1)+'s' : '-'}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>`;
  document.getElementById('student-table-container').innerHTML = tableHTML;
}

function switchTab(name, evt) {
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.getElementById(`tab-${name}`).classList.add('active');
  if (evt && evt.currentTarget) evt.currentTarget.classList.add('active');

  if (name === 'radar' && ME) {
    setTimeout(() => RadarChart.loadAndRender('radar-canvas', ME), 50);
  }
}

loadGameResults();
