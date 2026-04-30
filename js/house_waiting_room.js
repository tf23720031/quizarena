const toastEl = document.getElementById('toast');
const pin = localStorage.getItem('currentRoomPin') || '';
const playerProfile = JSON.parse(localStorage.getItem('roomPlayerProfile') || '{}');
let latestMessageCount = 0;
let lastTeamsSnap = '';
let hasLeftRoom = false;
let isInternalNav = false;

function showToast(message, delay = 2400) {
  toastEl.textContent = message;
  toastEl.classList.add('show');
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => toastEl.classList.remove('show'), delay);
}

async function api(url, options = {}) {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });
  const data = await res.json();
  if (!res.ok || data.success === false) throw new Error(data.message || '操作失敗');
  return data;
}

// ── 頭像 HTML ─────────────────────────────────────
function avatarHtml(item) {
  const oy = item.eyes_offset_y || 0;
  return `<div class="avatar-combo">
    <img src="${item.face || 'images/face/face.png'}" alt="">
    <img src="${item.hair || 'images/hair/hair01.png'}" alt="">
    <img src="${item.eyes || 'images/face/eyes01.png'}" alt=""
         style="transform:translateY(${oy}px)">
  </div>`;
}

// ── 隊伍顏色池 ────────────────────────────────────
const TEAM_COLORS = [
  '#ff8db8','#6ec6ff','#a3e080','#ffcc55',
  '#c59aff','#ff9a7a','#5fddcc','#ffb3d1'
];

// ── 渲染團體賽分組欄（房主視角）──────────────────
function renderTeamColumns(players, teams) {
  const wrap = document.getElementById('teamColumnsWrap');
  if (!wrap) return;

  // 用快照避免無謂重繪
  const snap = JSON.stringify(players.map(p => `${p.player_name}:${p.team_id}`));
  if (snap === lastTeamsSnap) return;
  lastTeamsSnap = snap;

  const nonHost = players.filter(p => !p.is_host);
  const unassigned = nonHost.filter(p => !p.team_id || p.team_id === 0);

  let html = '';

  // 未分組區塊
  if (unassigned.length) {
    html += `
      <div class="team-col">
        <div class="team-col-header" style="background:rgba(180,180,180,.18);border-left:4px solid #ccc">
          未分組 <span class="team-col-count">(${unassigned.length})</span>
        </div>
        <div class="team-col-members">
          ${unassigned.map(p => `
            <div class="team-member-item">
              ${avatarHtml(p)}
              <span>${p.player_name}</span>
            </div>`).join('')}
        </div>
      </div>`;
  }

  // 各隊
  teams.forEach((t, i) => {
    const color = TEAM_COLORS[i % TEAM_COLORS.length];
    const members = nonHost.filter(p => p.team_id === t.team_id);
    html += `
      <div class="team-col">
        <div class="team-col-header" style="background:${color}22;border-left:4px solid ${color}">
          ${t.team_name}
          <span class="team-col-count">(${members.length})</span>
        </div>
        <div class="team-col-members">
          ${members.map(p => `
            <div class="team-member-item">
              ${avatarHtml(p)}
              <span>${p.player_name}</span>
            </div>`).join('')}
          ${!members.length ? '<div class="team-empty-hint">尚無成員</div>' : ''}
        </div>
      </div>`;
  });

  wrap.innerHTML = html;
}

// ── 渲染個人賽玩家列表 ────────────────────────────
function renderPlayerList(players) {
  document.getElementById('playerList').innerHTML = players.map(p => `
    <div class="player-entry">
      ${avatarHtml(p)}
      <div class="player-meta">
        <div class="player-name-line">
          ${p.player_name}
          ${p.is_host ? '<span class="host-badge">HOST</span>' : ''}
        </div>
        <div class="chat-time">
          ${new Date((p.joined_at || Date.now() / 1000) * 1000)
            .toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>
    </div>`).join('');
}

// ── 渲染聊天 ─────────────────────────────────────
function renderMessages(messages) {
  const el = document.getElementById('chatList');
  if (!messages.length) {
    el.innerHTML = '<div class="chat-empty">No messages yet...</div>';
    latestMessageCount = 0;
    return;
  }
  el.innerHTML = messages.map(m => `
    <div class="chat-item">
      ${avatarHtml(m)}
      <div class="chat-content">
        <div class="chat-head">
          <div class="chat-name">${m.sender_name}</div>
          <span class="chat-time">
            ${new Date((m.created_at || Date.now() / 1000) * 1000)
              .toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
        <div class="chat-msg">${m.message}</div>
      </div>
    </div>`).join('');
  if (messages.length > latestMessageCount) el.scrollTop = el.scrollHeight;
  latestMessageCount = messages.length;
}

// ── 拉取房間狀態 ─────────────────────────────────
async function loadRoomState() {
  if (!pin || !playerProfile?.name) {
    showToast('缺少房間資料，將返回首頁。');
    setTimeout(() => (window.location.href = 'index.html'), 1400);
    return;
  }
  try {
    const data = await api(
      `/room_state/${pin}?playerName=${encodeURIComponent(playerProfile.name)}`
    );
    const room = data.room;
    const players = data.players || [];
    const teams = data.teams || [];
    const messages = data.messages || [];

    document.getElementById('roomPin').textContent = room.pin;
    document.getElementById('roomName').textContent =
      room.room_name || room.bank_title || `房間 ${room.pin}`;
    document.getElementById('bankTitle').textContent = room.bank_title || '未命名題庫';
    document.getElementById('roomStatus').textContent = room.status;
    document.getElementById('currentPlayerName').textContent = playerProfile.name;

    const isTeamMode = !!room.team_mode;
    const teamBox = document.getElementById('teamSetupBox');
    if (teamBox) teamBox.style.display = isTeamMode ? 'block' : 'none';

    if (isTeamMode) {
      renderTeamColumns(players, teams);
      document.getElementById('playerList').innerHTML = '';
    } else {
      renderPlayerList(players);
    }

    renderMessages(messages);

    if (room.status === 'playing') {
      document.getElementById('waitingHint').textContent = '遊戲已開始，正在進入答題頁面...';
      isInternalNav = true;
      setTimeout(() => (window.location.href = 'quiz_game.html'), 800);
    }
  } catch (e) {
    showToast(e.message);
  }
}

// ── 發送聊天 ─────────────────────────────────────
async function sendMessage(e) {
  e.preventDefault();
  const msg = document.getElementById('chatInput').value.trim();
  if (!msg) return;
  try {
    await api('/send_message', {
      method: 'POST',
      body: JSON.stringify({
        pin,
        senderName: playerProfile.name,
        message: msg,
        teamId: -1,
        face: playerProfile.face,
        hair: playerProfile.hair,
        eyes: playerProfile.eyes,
        eyesOffsetY: playerProfile.eyesOffsetY || 0
      })
    });
    document.getElementById('chatInput').value = '';
    loadRoomState();
  } catch (e) { showToast(e.message); }
}

// ── 離開房間 ─────────────────────────────────────
async function leaveRoom() {
  if (hasLeftRoom) return;
  hasLeftRoom = true;
  try {
    await api('/leave_room', {
      method: 'POST',
      body: JSON.stringify({ pin, playerName: playerProfile.name })
    });
  } catch (_) {}
  finally {
    ['currentRoomPin', 'currentRoomKey', 'roomPlayerProfile', 'pendingJoinContext']
      .forEach(k => localStorage.removeItem(k));
    window.location.href = 'index.html';
  }
}

function leaveRoomOnUnload() {
  if (!pin || !playerProfile?.name || hasLeftRoom || isInternalNav) return;
  hasLeftRoom = true;
  navigator.sendBeacon?.(
    '/leave_room',
    new Blob([JSON.stringify({ pin, playerName: playerProfile.name })],
             { type: 'application/json' })
  );
}

// ── Heartbeat ─────────────────────────────────────
async function sendHeartbeat() {
  if (!pin || !playerProfile?.name || hasLeftRoom) return;
  try {
    await fetch('/heartbeat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin, playerName: playerProfile.name })
    });
  } catch (_) {}
}

// ── 隨機分組 ─────────────────────────────────────
document.getElementById('shuffleTeamsBtn')?.addEventListener('click', async () => {
  try {
    await api('/shuffle_teams', {
      method: 'POST',
      body: JSON.stringify({ pin, playerName: playerProfile.name })
    });
    lastTeamsSnap = '';   // 強制重繪
    showToast('隨機分組完成！');
    window.quizAudio?.success?.();
    loadRoomState();
  } catch (e) {
    showToast(e.message);
    window.quizAudio?.fail?.();
  }
});

// ── 開始遊戲 ─────────────────────────────────────
document.getElementById('startGameBtn')?.addEventListener('click', async () => {
  try {
    await api('/start_game', {
      method: 'POST',
      body: JSON.stringify({ pin, playerName: playerProfile.name })
    });
    document.getElementById('waitingHint').textContent = '遊戲開始中，正在帶大家進場...';
    isInternalNav = true;
    AudioManager?.gameStart?.();
    setTimeout(() => (window.location.href = 'quiz_game.html'), 700);
  } catch (e) {
    showToast(e.message);
    window.quizAudio?.fail?.();
  }
});

document.getElementById('chatForm')?.addEventListener('submit', sendMessage);
document.getElementById('leaveRoomBtn')?.addEventListener('click', leaveRoom);
window.addEventListener('beforeunload', leaveRoomOnUnload);

// ── 初始化 ───────────────────────────────────────
loadRoomState();
sendHeartbeat();
setInterval(loadRoomState, 3000);
setInterval(sendHeartbeat, 5000);
