// js/analytics-leaderboard.js

const ME = localStorage.getItem('playerName') || '';
let currentType = 'total';

async function loadLeaderboard(type) {
  currentType = type || currentType;
  const subject = document.getElementById('subject-select')?.value || '';
  const url = `/api/leaderboard?type=${currentType}&subject=${encodeURIComponent(subject)}&limit=50`;

  document.getElementById('lb-content').innerHTML =
    '<div style="text-align:center;color:#6d28d9;padding:40px;">載入中...</div>';

  try {
    const res = await fetch(url);
    const data = await res.json();
    renderLeaderboard(data.rankings || []);
  } catch (e) {
    document.getElementById('lb-content').innerHTML =
      `<div style="color:#f87171;text-align:center;padding:40px;">載入失敗：${e.message}</div>`;
  }
}

function renderLeaderboard(rankings) {
  if (rankings.length === 0) {
    document.getElementById('lb-content').innerHTML =
      '<div style="text-align:center;color:#6d28d9;padding:40px;">尚無資料</div>';
    return;
  }

  const top3 = rankings.slice(0, 3);
  const rest = rankings.slice(3);

  const podiumOrder = [1, 0, 2];
  const podiumHTML = `<div class="top3-container">` +
    podiumOrder.map(i => {
      const p = top3[i];
      if (!p) return '';
      const cls = i === 0 ? 'gold' : i === 1 ? 'silver' : 'bronze';
      const crown = i === 0 ? '👑' : i === 1 ? '🥈' : '🥉';
      const isMe = p.player_name === ME;
      const scoreLabel = currentType === 'winrate' ? `${Number(p.score).toFixed(1)}%` :
                         currentType === 'streak'  ? `${p.score} 連勝` : p.score;
      return `<div class="top-card ${cls}${isMe ? ' me' : ''}">
        <div class="crown">${crown}</div>
        <div class="top-avatar">🧝</div>
        <div class="top-name">${p.player_name}${isMe ? '<br><span style="font-size:10px;color:#f0abfc;">你</span>' : ''}</div>
        <div class="top-score">${scoreLabel}</div>
      </div>`;
    }).join('') + `</div>`;

  const listHTML = rest.map(p => {
    const isMe = p.player_name === ME;
    const scoreLabel = currentType === 'winrate' ? `${Number(p.score).toFixed(1)}%` :
                       currentType === 'streak'  ? `${p.score} 連勝` : p.score;
    return `<div class="lb-row${isMe ? ' me' : ''}">
      <span class="lb-rank">${p.rank}</span>
      <span class="lb-avatar">🧙</span>
      <span class="lb-name">${p.player_name}${isMe ? ' <span class="badge badge-purple">你</span>' : ''}</span>
      <span class="lb-score">${scoreLabel}</span>
    </div>`;
  }).join('');

  document.getElementById('lb-content').innerHTML = podiumHTML + listHTML;

  const myEntry = rankings.find(p => p.player_name === ME);
  if (myEntry) {
    const sticky = document.getElementById('my-rank-sticky');
    sticky.style.display = 'flex';
    document.getElementById('my-sticky-rank').textContent = `第 ${myEntry.rank} 名`;
    document.getElementById('my-sticky-score').textContent = myEntry.score;
  }
}

function switchTab(type, btn) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('subject-selector').style.display = type === 'subject' ? '' : 'none';
  loadLeaderboard(type);
}

loadLeaderboard('total');
