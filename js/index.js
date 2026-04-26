const toastEl = document.getElementById("toast");
const pinModal = new bootstrap.Modal(document.getElementById("pinModal"));
const roomKeyModal = new bootstrap.Modal(document.getElementById("roomKeyModal"));
const memberModal = new bootstrap.Modal(document.getElementById("memberModal"));

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

const state = {
  rooms: [],
  pendingJoinRoom: null,
  pendingAfterLogin: null
};

function showToast(message, delay = 2400) {
  toastEl.textContent = message;
  toastEl.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => {
    toastEl.classList.remove("show");
  }, delay);
}

function showModalMessage(message) {
  document.getElementById("modalMessage").textContent = message;
  pinModal.show();
  window.quizAudio?.pop?.();
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
}
function saveJoinContext(room, roomKey = "", isHost = false) {
  localStorage.setItem(
    "pendingJoinContext",
    JSON.stringify({ room, roomKey, isHost: !!isHost })
  );
}

function redirectToJoin(room, roomKey = "", isHost = false) {
  saveJoinContext(room, roomKey, isHost);
  window.location.href = "player_join.html";
}

async function api(url, options = {}) {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options
  });

  const data = await res.json();

  if (!res.ok || data.success === false) {
    throw new Error(data.message || "操作失敗");
  }

  return data;
}

function buildRoomCard(room) {
  const privacy = room.is_private
    ? '<span class="badge-qa badge-private"><i class="fa-solid fa-lock"></i> 私人房</span>'
    : '<span class="badge-qa badge-public"><i class="fa-solid fa-earth-asia"></i> 公開房</span>';

  const mode = room.team_mode
    ? '<span class="badge-qa badge-team"><i class="fa-solid fa-people-group"></i> 團體賽</span>'
    : '<span class="badge-qa"><i class="fa-solid fa-user"></i> 個人賽</span>';

  const status = room.status === "playing"
    ? '<span class="badge-qa badge-playing"><i class="fa-solid fa-gamepad"></i> 進行中</span>'
    : '<span class="badge-qa"><i class="fa-regular fa-clock"></i> 等待中</span>';

  const disabled = !room.joinable ? "disabled" : "";

  return `
    <article class="room-card">
      <div class="room-top">
        <div>
          <h3>${room.display_name}</h3>
          <div class="small-text">題庫：${room.bank_title || "未命名題庫"}</div>
        </div>
        ${status}
      </div>

      <div class="room-meta">
        ${privacy}
        ${mode}
      </div>

      <div>
        <div class="tiny-text">房間 PIN</div>
        <div class="room-pin">${room.pin}</div>
      </div>

      <div class="room-footer-meta">
        <span class="badge-qa">
          <i class="fa-solid fa-crown"></i>${room.created_by || "Host"}
        </span>
        <span class="badge-qa">
          <i class="fa-solid fa-users"></i>${room.player_count}/${room.max_players}
        </span>
      </div>

      <button class="custom-btn btn-create join-room-btn" data-pin="${room.pin}" ${disabled}>
        ${room.joinable ? "直接加入" : "目前不可加入"}
      </button>
    </article>
  `;
}

function renderLobby(rooms) {
  const roomPlayers = rooms.reduce((sum, room) => sum + Number(room.player_count || 0), 0);
  const currentUser = getCurrentUser();
  const joinedPins = new Set();

  if (currentUser) {
    rooms.forEach(room => {
      const names = Array.isArray(room.player_names) ? room.player_names : [];
      if (names.includes(currentUser)) joinedPins.add(room.pin);
    });
  }

  const includeLobbyViewer = currentUser && joinedPins.size === 0 ? 1 : 0;

  waitingRoomCount.textContent = rooms.filter(r => r.status === "waiting").length;
  onlinePlayerCount.textContent = roomPlayers + includeLobbyViewer;
  privateRoomCount.textContent = rooms.filter(r => r.is_private).length;

  if (!rooms.length) {
    lobbyGrid.innerHTML = '<div class="empty-lobby text-pink">目前還沒有人創建房間喔~</div>';
    return;
  }

  lobbyGrid.innerHTML = rooms.map(buildRoomCard).join("");

  document.querySelectorAll(".join-room-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const room = state.rooms.find(item => item.pin === btn.dataset.pin);
      if (!room) return;

      if (room.is_private) {
        state.pendingJoinRoom = room;
        roomKeyPrompt.textContent = `「${room.display_name}」是私人房，請輸入密鑰後加入。`;
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
  } catch (e) {
    lobbyGrid.innerHTML = `<div class="empty-lobby">讀取大廳失敗：${e.message}</div>`;
  }
}

async function handlePinJoin() {
  const pin = pinInput.value.trim();

  if (!/^\d{6}$/.test(pin)) {
    showModalMessage("PIN 必須是 6 位數字");
    return;
  }

  try {
    const data = await api("/check_pin", {
      method: "POST",
      body: JSON.stringify({ pin })
    });

    if (data.room.is_private) {
      state.pendingJoinRoom = data.room;
      roomKeyPrompt.textContent = `房間 ${data.room.room_name || data.room.bank_title || data.room.pin} 需要密鑰。`;
      roomKeyInput.value = "";
      roomKeyModal.show();
      return;
    }

    redirectToJoin(data.room, "");
  } catch (e) {
    showModalMessage(e.message);
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
        roomKey: roomKeyInput.value.trim()
      })
    });

    roomKeyModal.hide();
    redirectToJoin(room, roomKeyInput.value.trim());
  } catch (e) {
    showToast(e.message);
    window.quizAudio?.fail?.();
  }
}

async function handleLogin(event) {
  event.preventDefault();

  try {
    const data = await api("/login", {
      method: "POST",
      body: JSON.stringify({
        username: loginUsername.value.trim(),
        password: loginPassword.value.trim()
      })
    });

    setCurrentUser(data.username);
    memberModal.hide();
    updateAuthUI();
    showToast(`歡迎回來，${data.username}`);
    window.quizAudio?.success?.();

    if (state.pendingAfterLogin === "create_home") {
      state.pendingAfterLogin = null;
      window.location.href = "create_home.html";
    }
  } catch (e) {
    showToast(e.message);
    window.quizAudio?.fail?.();
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
        password: registerPassword.value.trim()
      })
    });

    showToast("註冊成功，請直接登入");
    loginFormBox.style.display = "block";
    registerFormBox.style.display = "none";
    showLoginBtn.classList.add("active");
    showRegisterBtn.classList.remove("active");
    window.quizAudio?.success?.();
  } catch (e) {
    showToast(e.message);
    window.quizAudio?.fail?.();
  }
}

function openLoginModal() {
  memberModal.show();
}

function handleCreateQuizClick() {
  if (!getCurrentUser()) {
    state.pendingAfterLogin = "create_home";
    showToast("請先登入，登入後才可以進入題庫中心。");
    openLoginModal();
    return;
  }

  window.location.href = "create_home.html";
}

function handleLogout() {
  clearCurrentUser();
  updateAuthUI();
  showToast("已登出");
}

startBtn.addEventListener("click", handlePinJoin);

pinInput.addEventListener("keydown", e => {
  if (e.key === "Enter") handlePinJoin();
});

refreshLobbyBtn.addEventListener("click", loadLobby);
confirmRoomKeyBtn.addEventListener("click", handleConfirmRoomKey);

loginBtn.addEventListener("click", openLoginModal);
logoutBtn.addEventListener("click", handleLogout);
createQuizBtn.addEventListener("click", handleCreateQuizClick);

loginForm.addEventListener("submit", handleLogin);
registerForm.addEventListener("submit", handleRegister);

updateAuthUI();
loadLobby();
setInterval(loadLobby, 8000);

const showLoginBtn = document.getElementById("showLoginBtn");
const showRegisterBtn = document.getElementById("showRegisterBtn");

const loginFormBox = document.getElementById("loginForm");
const registerFormBox = document.getElementById("registerForm");

showLoginBtn.addEventListener("click", () => {
  showLoginBtn.classList.add("active");
  showRegisterBtn.classList.remove("active");

  loginFormBox.style.display = "block";
  registerFormBox.style.display = "none";
});

showRegisterBtn.addEventListener("click", () => {
  showRegisterBtn.classList.add("active");
  showLoginBtn.classList.remove("active");

  loginFormBox.style.display = "none";
  registerFormBox.style.display = "block";
});