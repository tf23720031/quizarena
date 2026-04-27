const toastEl = document.getElementById("toast");
const pinModal = new bootstrap.Modal(document.getElementById("pinModal"));
const roomKeyModal = new bootstrap.Modal(document.getElementById("roomKeyModal"));
const memberModal = new bootstrap.Modal(document.getElementById("memberModal"));
const addFriendModal = new bootstrap.Modal(document.getElementById("addFriendModal"));
const friendRequestsModal = new bootstrap.Modal(document.getElementById("friendRequestsModal"));

const loginBtn = document.getElementById("loginBtn");
const logoutBtn = document.getElementById("logoutBtn");
const loginStatus = document.getElementById("loginStatus");
const createQuizBtn = document.getElementById("createQuizBtn");
const refreshLobbyBtn = document.getElementById("refreshLobbyBtn");

const pinInput = document.getElementById("pinInput");
const startBtn = document.getElementById("startBtn");
const confirmRoomKeyBtn = document.getElementById("confirmRoomKeyBtn");
const roomKeyInput = document.getElementById("roomKeyInput");
const roomKeyPrompt = document.getElementById("roomKeyPrompt");

const loginForm = document.getElementById("loginForm");
const registerForm = document.getElementById("registerForm");
const loginUsername = document.getElementById("loginUsername");
const loginPassword = document.getElementById("loginPassword");
const registerUsername = document.getElementById("registerUsername");
const registerEmail = document.getElementById("registerEmail");
const registerPassword = document.getElementById("registerPassword");

const lobbyGrid = document.getElementById("lobbyGrid");
const waitingRoomCount = document.getElementById("waitingRoomCount");
const onlinePlayerCount = document.getElementById("onlinePlayerCount");
const privateRoomCount = document.getElementById("privateRoomCount");

const friendsShell = document.getElementById("friendsShell");
const friendsRecords = document.getElementById("friendsRecords");
const friendsList = document.getElementById("friendsList");
const friendsDockBtn = document.getElementById("friendsDockBtn");
const closeFriendsDrawerBtn = document.getElementById("closeFriendsDrawerBtn");
const openAddFriendBtn = document.getElementById("openAddFriendBtn");
const addFriendBtn = document.getElementById("addFriendBtn");
const friendUsernameInput = document.getElementById("friendUsernameInput");
const openFriendRequestsBtn = document.getElementById("openFriendRequestsBtn");
const friendRequestBadge = document.getElementById("friendRequestBadge");
const friendRequestsContent = document.getElementById("friendRequestsContent");

const showLoginBtn = document.getElementById("showLoginBtn");
const showRegisterBtn = document.getElementById("showRegisterBtn");
const loginFormBox = document.getElementById("loginForm");
const registerFormBox = document.getElementById("registerForm");

const state = {
  rooms: [],
  pendingJoinRoom: null,
  pendingAfterLogin: null,
  friendRequests: [],
  pendingFriendCount: 0,
};

function showToast(message, delay = 2400) {
  if (!toastEl) return;
  toastEl.textContent = message;
  toastEl.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toastEl.classList.remove("show"), delay);
}

function showModalMessage(message) {
  const modalMessage = document.getElementById("modalMessage");
  if (modalMessage) modalMessage.textContent = message;
  pinModal.show();
}

function getCurrentUser() {
  return localStorage.getItem("currentUser") || "";
}

function setCurrentUser(username) {
  localStorage.setItem("currentUser", username);
}

function clearCurrentUser() {
  localStorage.removeItem("currentUser");
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

async function api(url, options = {}) {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const data = await res.json();
  if (!res.ok || data.success === false) {
    throw new Error(data.message || "發生錯誤");
  }
  return data;
}

function updateAuthUI() {
  const user = getCurrentUser();
  if (user) {
    loginStatus.textContent = user;
    loginBtn.classList.add("d-none");
    logoutBtn.classList.remove("d-none");
  } else {
    loginStatus.textContent = "尚未登入";
    loginBtn.classList.remove("d-none");
    logoutBtn.classList.add("d-none");
  }

  if (friendsShell) friendsShell.style.display = user ? "block" : "none";
  if (friendsDockBtn) friendsDockBtn.style.display = user ? "flex" : "none";
  if (openAddFriendBtn) openAddFriendBtn.style.display = user ? "inline-flex" : "none";
  if (!user && friendsShell) friendsShell.classList.remove("open");
}

function renderFriendsOverview(data = {}) {
  if (!friendsRecords || !friendsList) return;

  const records = Array.isArray(data.records) ? data.records : [];
  const hasWins = records.some((item) => Number(item.wins || 0) > 0);

  if (!records.length) {
    friendsRecords.innerHTML = `
      <article class="friends-empty-card">
        <i class="fa-solid fa-user-group"></i>
        <strong>還沒有好友資料</strong>
        <span>登入後送出好友申請，就可以開始累積排行。</span>
      </article>
    `;
  } else if (!hasWins) {
    friendsRecords.innerHTML = records
      .map(
        (item) => `
          <article class="friends-record-card is-empty">
            <div class="friends-empty-user">
              <div class="friends-avatar-badge"><i class="fa-solid fa-circle-user"></i></div>
              <div>
                <div class="friends-record-name">${escapeHtml(item.username)}</div>
                <div class="friends-record-rank">無勝場紀錄</div>
              </div>
            </div>
          </article>
        `
      )
      .join("");
  } else {
    friendsRecords.innerHTML = records
      .map(
        (item, index) => `
          <article class="friends-record-card ${index === 0 ? "is-top" : ""}">
            <div class="friends-record-top">
              <div class="friends-record-left">
                <div class="friends-rank-medal">${index + 1}</div>
                <div>
                  <div class="friends-record-rank">${index === 0 ? "NO.1 WINNER" : `RANK ${index + 1}`}</div>
                  <div class="friends-record-name">${escapeHtml(item.username)}</div>
                </div>
              </div>
              <div class="friends-record-wins">${Number(item.wins || 0)} 勝</div>
            </div>
          </article>
        `
      )
      .join("");
  }

  const friends = Array.isArray(data.friends) ? data.friends : [];
  friendsList.textContent = friends.length
    ? `好友列表：${friends.join("、")}`
    : "好友列表：目前還沒有好友，先送出第一個好友申請吧。";
}

function renderFriendRequestBadge(count) {
  state.pendingFriendCount = Number(count || 0);
  if (!friendRequestBadge) return;

  if (state.pendingFriendCount > 0) {
    friendRequestBadge.textContent = String(state.pendingFriendCount);
    friendRequestBadge.classList.remove("d-none");
  } else {
    friendRequestBadge.classList.add("d-none");
  }
}

function renderFriendRequestsModal() {
  if (!friendRequestsContent) return;

  const rows = Array.isArray(state.friendRequests) ? state.friendRequests : [];
  if (!rows.length) {
    friendRequestsContent.innerHTML = `
      <div class="friend-request-empty">
        <i class="fa-solid fa-inbox"></i>
        <p>目前無申請紀錄</p>
      </div>
    `;
    return;
  }

  friendRequestsContent.innerHTML = rows
    .map(
      (row) => `
        <article class="friend-request-card">
          <div class="friend-request-top">
            <div>
              <div class="friend-request-name">${escapeHtml(row.requester)}</div>
              <div class="friend-request-meta">${escapeHtml(row.createdAtText)} ・ ${escapeHtml(row.device)}</div>
            </div>
            <div class="friend-request-actions">
              <button class="friend-request-btn accept" data-action="accept" data-request-id="${row.id}">接受</button>
              <button class="friend-request-btn reject" data-action="reject" data-request-id="${row.id}">略過</button>
            </div>
          </div>
        </article>
      `
    )
    .join("");

  friendRequestsContent.querySelectorAll(".friend-request-btn").forEach((btn) => {
    btn.addEventListener("click", () => respondFriendRequest(btn.dataset.requestId, btn.dataset.action));
  });
}

function toggleFriendsDrawer(forceOpen = null) {
  if (!friendsShell || friendsShell.style.display === "none") return;
  const shouldOpen = forceOpen === null ? !friendsShell.classList.contains("open") : !!forceOpen;
  friendsShell.classList.toggle("open", shouldOpen);
}

async function loadFriendsOverview() {
  const user = getCurrentUser();
  if (!user) return;

  try {
    const data = await api(`/friends_overview?username=${encodeURIComponent(user)}`);
    renderFriendsOverview(data);
  } catch (error) {
    friendsRecords.innerHTML = `<div class="empty-lobby text-pink">${escapeHtml(error.message)}</div>`;
  }
}

async function loadFriendRequestSummary() {
  const user = getCurrentUser();
  if (!user) {
    state.friendRequests = [];
    renderFriendRequestBadge(0);
    return;
  }

  try {
    const data = await api(`/friend_requests_summary?username=${encodeURIComponent(user)}`);
    state.friendRequests = data.requests || [];
    renderFriendRequestBadge(data.pendingCount || 0);
    renderFriendRequestsModal();
  } catch (error) {
    renderFriendRequestBadge(0);
    if (friendRequestsContent) {
      friendRequestsContent.innerHTML = `<div class="friend-request-empty"><p>${escapeHtml(error.message)}</p></div>`;
    }
  }
}

async function handleAddFriend() {
  const user = getCurrentUser();
  const friendName = friendUsernameInput?.value.trim();

  if (!user) {
    showToast("請先登入再送出好友申請");
    return;
  }
  if (!friendName) {
    showToast("請輸入好友帳號");
    return;
  }

  try {
    const data = await api("/send_friend_request", {
      method: "POST",
      body: JSON.stringify({ username: user, friendName }),
    });
    if (friendUsernameInput) friendUsernameInput.value = "";
    addFriendModal.hide();
    showToast(data.message || "好友申請已送出");
    await loadFriendRequestSummary();
  } catch (error) {
    showToast(error.message);
  }
}

async function respondFriendRequest(requestId, action) {
  const user = getCurrentUser();
  if (!user) return;

  try {
    const data = await api("/respond_friend_request", {
      method: "POST",
      body: JSON.stringify({
        username: user,
        requestId: Number(requestId || 0),
        action,
      }),
    });
    showToast(data.message || "已處理好友申請");
    renderFriendsOverview(data.overview || {});
    state.friendRequests = (data.requestSummary && data.requestSummary.requests) || [];
    renderFriendRequestBadge((data.requestSummary && data.requestSummary.pendingCount) || 0);
    renderFriendRequestsModal();
  } catch (error) {
    showToast(error.message);
  }
}

function saveJoinContext(room, roomKey = "", isHost = false) {
  localStorage.setItem("pendingJoinContext", JSON.stringify({ room, roomKey, isHost: !!isHost }));
}

function redirectToJoin(room, roomKey = "", isHost = false) {
  saveJoinContext(room, roomKey, isHost);
  window.location.href = "player_join.html";
}

function buildRoomCard(room) {
  const privacy = room.is_private
    ? '<span class="badge-qa badge-private"><i class="fa-solid fa-lock"></i> 私人房</span>'
    : '<span class="badge-qa badge-public"><i class="fa-solid fa-earth-asia"></i> 公開房</span>';
  const mode = room.team_mode
    ? '<span class="badge-qa badge-team"><i class="fa-solid fa-people-group"></i> 團隊模式</span>'
    : '<span class="badge-qa"><i class="fa-solid fa-user"></i> 個人模式</span>';
  const status = room.status === "playing"
    ? '<span class="badge-qa badge-playing"><i class="fa-solid fa-gamepad"></i> 遊戲中</span>'
    : '<span class="badge-qa"><i class="fa-regular fa-clock"></i> 等待中</span>';
  const disabled = !room.joinable ? "disabled" : "";
  const keyInfo = room.is_private && room.room_key_plain
    ? `<div class="tiny-text">房間金鑰</div><div class="room-pin" style="font-size:1.15rem;">${room.room_key_plain}</div>`
    : `<div class="tiny-text">房間 PIN</div><div class="room-pin">${room.pin}</div>`;

  return `
    <article class="room-card">
      <div class="room-top">
        <div>
          <h3>${escapeHtml(room.display_name)}</h3>
          <div class="small-text">題庫：${escapeHtml(room.bank_title || "未命名題庫")}</div>
        </div>
        ${status}
      </div>
      <div class="room-meta">${privacy}${mode}</div>
      <div>${keyInfo}</div>
      <div class="room-footer-meta">
        <span class="badge-qa"><i class="fa-solid fa-crown"></i>${escapeHtml(room.created_by || "Host")}</span>
        <span class="badge-qa"><i class="fa-solid fa-users"></i>${room.player_count}/${room.max_players}</span>
      </div>
      <button class="custom-btn btn-create join-room-btn" data-pin="${room.pin}" ${disabled}>
        ${room.joinable ? "加入房間" : "房間不可加入"}
      </button>
    </article>
  `;
}

function renderLobby(rooms) {
  const roomPlayers = rooms.reduce((sum, room) => sum + Number(room.player_count || 0), 0);
  const browsing = 1;

  waitingRoomCount.textContent = rooms.filter((room) => room.status === "waiting").length;
  onlinePlayerCount.textContent = roomPlayers + browsing;
  privateRoomCount.textContent = rooms.filter((room) => room.is_private).length;

  if (!rooms.length) {
    lobbyGrid.innerHTML = '<div class="empty-lobby text-pink">目前還沒有可加入的房間</div>';
    return;
  }

  lobbyGrid.innerHTML = rooms.map(buildRoomCard).join("");
  document.querySelectorAll(".join-room-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const room = state.rooms.find((item) => item.pin === btn.dataset.pin);
      if (!room) return;

      if (room.is_private) {
        state.pendingJoinRoom = room;
        roomKeyPrompt.textContent = `${room.display_name} 是私人房，請輸入金鑰加入。`;
        roomKeyInput.value = "";
        roomKeyModal.show();
      } else {
        redirectToJoin(room, "");
      }
    });
  });
}

async function loadLobby() {
  try {
    const data = await api("/lobby_rooms");
    state.rooms = data.rooms || [];
    renderLobby(state.rooms);
  } catch (error) {
    if (lobbyGrid) {
      lobbyGrid.innerHTML = `<div class="empty-lobby">載入大廳失敗：${escapeHtml(error.message)}</div>`;
    }
  }
}

async function handlePinJoin() {
  const pin = pinInput.value.trim();
  if (!/^\d{6}$/.test(pin)) {
    showModalMessage("PIN 必須是 6 碼數字");
    return;
  }

  try {
    const data = await api("/check_pin", {
      method: "POST",
      body: JSON.stringify({ pin }),
    });

    if (data.room.is_private) {
      state.pendingJoinRoom = data.room;
      roomKeyPrompt.textContent = `房間 ${data.room.room_name || data.room.bank_title || data.room.pin} 需要金鑰，請先驗證。`;
      roomKeyInput.value = "";
      roomKeyModal.show();
      return;
    }

    redirectToJoin(data.room, "");
  } catch (error) {
    showModalMessage(error.message);
  }
}

async function handleConfirmRoomKey() {
  const room = state.pendingJoinRoom;
  if (!room) return;

  try {
    await api("/verify_room_key", {
      method: "POST",
      body: JSON.stringify({
        pin: room.pin,
        roomKey: roomKeyInput.value.trim(),
      }),
    });
    roomKeyModal.hide();
    redirectToJoin(room, roomKeyInput.value.trim());
  } catch (error) {
    showToast(error.message);
  }
}

async function handleLogin(event) {
  event.preventDefault();

  try {
    const data = await api("/login", {
      method: "POST",
      body: JSON.stringify({
        username: loginUsername.value.trim(),
        password: loginPassword.value.trim(),
      }),
    });

    setCurrentUser(data.username);
    memberModal.hide();
    updateAuthUI();
    await loadFriendsOverview();
    await loadFriendRequestSummary();
    showToast(`歡迎回來，${data.username}`);

    if (state.pendingAfterLogin === "create_home") {
      state.pendingAfterLogin = null;
      window.location.href = "create_home.html";
    }
  } catch (error) {
    showToast(error.message);
  }
}

async function handleRegister(event) {
  event.preventDefault();

  try {
    await api("/register", {
      method: "POST",
      body: JSON.stringify({
        username: registerUsername.value.trim(),
        email: registerEmail.value.trim(),
        password: registerPassword.value.trim(),
      }),
    });

    showToast("註冊成功，現在可以直接登入");
    showLoginBtn.classList.add("active");
    showRegisterBtn.classList.remove("active");
    loginFormBox.style.display = "block";
    registerFormBox.style.display = "none";
  } catch (error) {
    showToast(error.message);
  }
}

function openLoginModal() {
  memberModal.show();
}

function handleCreateQuizClick() {
  if (!getCurrentUser()) {
    state.pendingAfterLogin = "create_home";
    showToast("請先登入，才能建立自己的題庫");
    openLoginModal();
    return;
  }
  window.location.href = "create_home.html";
}

function handleLogout() {
  clearCurrentUser();
  state.friendRequests = [];
  renderFriendRequestBadge(0);
  updateAuthUI();
  if (friendsRecords) friendsRecords.innerHTML = "";
  if (friendsList) friendsList.textContent = "";
  showToast("已登出");
}

startBtn?.addEventListener("click", handlePinJoin);
pinInput?.addEventListener("keydown", (event) => {
  if (event.key === "Enter") handlePinJoin();
});
refreshLobbyBtn?.addEventListener("click", loadLobby);
confirmRoomKeyBtn?.addEventListener("click", handleConfirmRoomKey);

loginBtn?.addEventListener("click", openLoginModal);
logoutBtn?.addEventListener("click", handleLogout);
createQuizBtn?.addEventListener("click", handleCreateQuizClick);

loginForm?.addEventListener("submit", handleLogin);
registerForm?.addEventListener("submit", handleRegister);
addFriendBtn?.addEventListener("click", handleAddFriend);
friendsDockBtn?.addEventListener("click", () => toggleFriendsDrawer(true));
closeFriendsDrawerBtn?.addEventListener("click", () => toggleFriendsDrawer(false));
openAddFriendBtn?.addEventListener("click", () => {
  if (!getCurrentUser()) {
    showToast("請先登入");
    openLoginModal();
    return;
  }
  addFriendModal.show();
});
openFriendRequestsBtn?.addEventListener("click", async () => {
  await loadFriendRequestSummary();
  friendRequestsModal.show();
});
friendUsernameInput?.addEventListener("keydown", (event) => {
  if (event.key === "Enter") handleAddFriend();
});

showLoginBtn?.addEventListener("click", () => {
  showLoginBtn.classList.add("active");
  showRegisterBtn.classList.remove("active");
  loginFormBox.style.display = "block";
  registerFormBox.style.display = "none";
});

showRegisterBtn?.addEventListener("click", () => {
  showRegisterBtn.classList.add("active");
  showLoginBtn.classList.remove("active");
  loginFormBox.style.display = "none";
  registerFormBox.style.display = "block";
});

updateAuthUI();
loadLobby();
loadFriendsOverview();
loadFriendRequestSummary();
setInterval(loadLobby, 8000);
setInterval(loadFriendsOverview, 15000);
setInterval(loadFriendRequestSummary, 15000);
