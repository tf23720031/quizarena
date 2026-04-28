const toastEl = document.getElementById('toast');
const pin = localStorage.getItem('currentRoomPin') || '';
const playerProfile = JSON.parse(localStorage.getItem('roomPlayerProfile') || '{}');
let latestMessageCount = 0;
let myCurrentTeamId = 0;
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
  if (item.avatar_url || item.avatarUrl) {
    const src = item.avatar_url || item.avatarUrl;
    return `<div class="avatar-combo avatar-photo"><img src="${src}" alt=""></div>`;
  }
  const oy = item.eyes_offset_y || 0;
  return `<div class="avatar-combo">
    <img src="${item.face || 'images/face/face.png'}" alt="">
    <img src="${item.hair || 'images/hair/hair01.png'}" alt="">
    <img src="${item.eyes || 'images/face/eyes01.png'}" alt=""
         style="transform:translateY(${oy}px)">
  </div>`;
}

function playerMetaLine(item) {
  const bits = [item.user_title || item.userTitle || "", item.county || ""].filter(Boolean);
  return bits.length ? `<div class="chat-time">${bits.join("・")}</div>` : "";
}

// ── 隊伍顏色池 ────────────────────────────────────
const TEAM_COLORS = [
  '#ff8db8','#6ec6ff','#a3e080','#ffcc55',
  '#c59aff','#ff9a7a','#5fddcc','#ffb3d1'
];

// ── 渲染選隊按鈕 ─────────────────────────────────
function renderTeamJoinButtons(teams, players, teamSize) {
  const wrap = document.getElementById('teamJoinButtons');
  const label = document.getElementById('myTeamLabel');
  if (!wrap) return;

  // 我目前的隊伍
  const me = players.find(p => p.player_name === playerProfile.name);
  myCurrentTeamId = parseInt(me?.team_id || 0);

  // 更新 label
  if (label) {
    const myTeam = teams.find(t => t.team_id === myCurrentTeamId);
    if (myTeam) {
      label.textContent = `✅ 你目前在：${myTeam.team_name}`;
      label.style.color = '#5cb85c';
    } else {
      label.textContent = '⚠️ 尚未選隊，請選一個隊伍加入';
      label.style.color = '#e6a817';
    }
  }

  wrap.innerHTML = teams.map((t, i) => {
    const color = TEAM_COLORS[i % TEAM_COLORS.length];
    const count = players.filter(p => !p.is_host && p.team_id === t.team_id).length;
    const isFull = count >= teamSize;
    const isMyTeam = t.team_id === myCurrentTeamId;
    return `
      <button class="team-join-btn ${isMyTeam ? 'selected' : ''} ${isFull && !isMyTeam ? 'full' : ''}"
              data-team="${t.team_id}"
              style="border-color:${color};${isMyTeam ? `background:${color}33` : ''}"
              ${isFull && !isMyTeam ? 'disabled' : ''}>
        <span class="team-btn-name">${t.team_name}</span>
        <span class="team-btn-count" style="color:${color}">${count}/${teamSize}</span>
      </button>`;
  }).join('');

  wrap.querySelectorAll('.team-join-btn:not([disabled])').forEach(btn => {
    btn.addEventListener('click', async () => {
      const teamId = parseInt(btn.dataset.team);
      if (teamId === myCurrentTeamId) return;
      try {
        await api('/choose_team', {
          method: 'POST',
          body: JSON.stringify({ pin, playerName: playerProfile.name, teamId })
        });
        myCurrentTeamId = teamId;
        showToast('選隊成功！');
        window.quizAudio?.success?.();
        loadRoomState();
      } catch (e) {
        showToast(e.message);
        window.quizAudio?.fail?.();
      }
    });
  });
}

// ── 渲染玩家列表 ─────────────────────────────────
function renderPlayerList(players) {
  const isCurrentHost = !!players.find(p => p.player_name === playerProfile.name && p.is_host);
  const inviteBtn = document.getElementById('inviteRoomBtn');
  if (inviteBtn) inviteBtn.style.display = isCurrentHost ? 'inline-flex' : 'none';
  document.getElementById('playerList').innerHTML = players.map(p => `
    <div class="player-entry">
      ${avatarHtml(p)}
      <div class="player-meta">
        <div class="player-name-line">
          ${p.player_name}
          ${p.is_host ? '<span class="host-badge">HOST</span>' : ''}
        </div>
        ${playerMetaLine(p)}
        <div class="chat-time">
          ${new Date((p.joined_at || Date.now() / 1000) * 1000)
            .toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>
      ${isCurrentHost && !p.is_host ? `<button class="leave-soft kick-btn" data-player="${p.player_name}">踢出</button>` : ''}
    </div>`).join('');

  document.querySelectorAll('.kick-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      try {
        await api('/kick_player', {
          method: 'POST',
          body: JSON.stringify({ pin, hostName: playerProfile.name, targetName: btn.dataset.player })
        });
        showToast(`已踢出 ${btn.dataset.player}`);
        loadRoomState();
      } catch (e) {
        showToast(e.message);
      }
    });
  });
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
    const joinBox = document.getElementById('teamJoinBox');
    if (joinBox) joinBox.style.display = isTeamMode ? 'block' : 'none';

    if (isTeamMode && teams.length) {
      renderTeamJoinButtons(teams, players, room.team_size || 4);
    }

    renderPlayerList(players);
    renderMessages(messages);

    if (room.status === 'playing') {
      document.getElementById('waitingHint').textContent = '房主已開始遊戲，正在進入答題頁面...';
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
        username: localStorage.getItem('currentUser') || '',
        teamId: -1,
        face: playerProfile.face,
        hair: playerProfile.hair,
        eyes: playerProfile.eyes,
        eyesOffsetY: playerProfile.eyesOffsetY || 0,
        avatarUrl: playerProfile.avatarUrl || '',
        county: playerProfile.county || '',
        title: playerProfile.title || ''
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

async function copyInvite() {
  try {
    const roomName = document.getElementById('roomName').textContent.trim();
    await navigator.clipboard.writeText(`加入我的 QuizArena 房間：${roomName}，PIN：${pin}`);
    showToast('邀請資訊已複製');
  } catch (_) {
    showToast('複製失敗，請手動分享 PIN');
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

document.getElementById('chatForm').addEventListener('submit', sendMessage);
document.getElementById('leaveRoomBtn').addEventListener('click', leaveRoom);
document.getElementById('inviteRoomBtn')?.addEventListener('click', copyInvite);
window.addEventListener('beforeunload', leaveRoomOnUnload);

// ── 初始化 ───────────────────────────────────────
loadRoomState();
sendHeartbeat();
setInterval(loadRoomState, 3000);
setInterval(sendHeartbeat, 5000);
