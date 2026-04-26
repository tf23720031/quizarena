const toastEl = document.getElementById('toast');
const pin = localStorage.getItem('currentRoomPin') || '';
const playerProfile = JSON.parse(localStorage.getItem('roomPlayerProfile') || '{}');
let latestMessageCount = 0;

function showToast(message, delay=2400){
  toastEl.textContent = message;
  toastEl.classList.add('show');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toastEl.classList.remove('show'), delay);
}

async function api(url, options={}){
  const res = await fetch(url, {
    headers:{'Content-Type':'application/json'},
    ...options
  });
  const data = await res.json();
  if(!res.ok || data.success===false) throw new Error(data.message || '操作失敗');
  return data;
}

function avatarHtml(item){
  return `<div class="avatar-combo">
    <img src="${item.face || 'images/face/face.png'}">
    <img src="${item.hair || 'images/hair/hair01.png'}">
    <img src="${item.eyes || 'images/face/eyes01.png'}" style="transform:translateY(${item.eyes_offset_y || 0}px)">
  </div>`;
}

function renderPlayers(players){
  playerList.innerHTML = players.map(p => `
    <div class="player-entry">
      ${avatarHtml(p)}
      <div class="player-meta">
        <div class="player-name-line">
          ${p.player_name}${p.is_host ? '<span class="host-badge">HOST</span>' : ''}
        </div>
        <div class="chat-time">
          加入時間 ${new Date((p.joined_at || Date.now()/1000) * 1000).toLocaleTimeString('zh-TW',{hour:'2-digit',minute:'2-digit'})}
        </div>
      </div>
    </div>
  `).join('');
}

function renderMessages(messages){
  if(!messages.length){
    chatList.innerHTML = '<div class="chat-empty">No messages yet...</div>';
    latestMessageCount = 0;
    return;
  }

  chatList.innerHTML = messages.map(m => `
    <div class="chat-item">
      ${avatarHtml(m)}
      <div class="chat-content">
        <div class="chat-head">
          <div class="chat-name">${m.sender_name}</div>
          <span class="chat-time">${new Date((m.created_at || Date.now()/1000) * 1000).toLocaleTimeString('zh-TW',{hour:'2-digit',minute:'2-digit'})}</span>
        </div>
        <div class="chat-msg">${m.message}</div>
      </div>
    </div>
  `).join('');

  if(messages.length > latestMessageCount){
    chatList.scrollTop = chatList.scrollHeight;
  }
  latestMessageCount = messages.length;
}

async function loadRoomState(){
  if(!pin || !playerProfile?.name){
    showToast('缺少房間資料，將返回首頁。');
    setTimeout(() => window.location.href='index.html', 1400);
    return;
  }

  try{
    const data = await api(`/room_state/${pin}`);
    roomPin.textContent = data.room.pin;
    roomName.textContent = data.room.room_name || data.room.bank_title || `房間 ${data.room.pin}`;
    bankTitle.textContent = data.room.bank_title || '未命名題庫';
    roomStatus.textContent = data.room.status;
    currentPlayerName.textContent = playerProfile.name;
    renderPlayers(data.players || []);
    renderMessages(data.messages || []);

    if(data.room.status === 'playing'){
      waitingHint.textContent = '房主已開始遊戲，正在進入答題頁面...';
      isInternalNavigation = true;
      setTimeout(() => window.location.href='quiz_game.html', 800);
    }
  }catch(e){
    showToast(e.message);
  }
}

async function sendMessage(e){
  e.preventDefault();
  const message = chatInput.value.trim();
  if(!message) return;

  try{
    await api('/send_message',{
      method:'POST',
      body:JSON.stringify({
        pin,
        senderName: playerProfile.name,
        message,
        face: playerProfile.face,
        hair: playerProfile.hair,
        eyes: playerProfile.eyes,
        eyesOffsetY: playerProfile.eyesOffsetY
      })
    });
    chatInput.value='';
    loadRoomState();
  }catch(e){
    showToast(e.message);
  }
}

let hasLeftRoom = false;
let isInternalNavigation = false;

async function leaveRoom(){
  if (hasLeftRoom) return;
  hasLeftRoom = true;

  try{
    await api('/leave_room',{
      method:'POST',
      body:JSON.stringify({pin, playerName: playerProfile.name})
    });
  } catch(e){
  } finally {
    ['currentRoomPin','currentRoomKey','roomPlayerProfile','pendingJoinContext'].forEach(k => localStorage.removeItem(k));
    window.location.href='index.html';
  }
}

async function sendHeartbeat(){
  if (!pin || !playerProfile?.name || hasLeftRoom) return;
  try {
    await fetch('/heartbeat', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({ pin, playerName: playerProfile.name })
    });
  } catch(e){}
}

function leaveRoomOnUnload(){
  if (!pin || !playerProfile?.name || hasLeftRoom || isInternalNavigation) return;
  hasLeftRoom = true;
  const payload = JSON.stringify({ pin, playerName: playerProfile.name });

  if (navigator.sendBeacon) {
    navigator.sendBeacon('/leave_room', new Blob([payload], { type: 'application/json' }));
  }
}

chatForm.addEventListener('submit', sendMessage);
leaveRoomBtn.addEventListener('click', leaveRoom);
window.addEventListener('beforeunload', leaveRoomOnUnload);

loadRoomState();
sendHeartbeat();
setInterval(loadRoomState, 3000);
setInterval(sendHeartbeat, 5000);

startGameBtn.addEventListener('click', async()=>{
  try{
    await api('/start_game',{
      method:'POST',
      body:JSON.stringify({pin, playerName: playerProfile.name})
    });

    waitingHint.textContent='遊戲開始中，正在帶大家進場...';
    isInternalNavigation = true;
    window.quizAudio?.success();
    setTimeout(() => window.location.href='quiz_game.html', 700);
  }catch(e){
    showToast(e.message);
    window.quizAudio?.fail();
  }
});