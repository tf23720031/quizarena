(() => {
  let pinModal;
  let roomKeyModal;
  let memberModal;
  let addFriendModal;
  let friendRequestsModal;

  const state = {
    rooms: [],
    pendingJoinRoom: null,
    pendingAfterLogin: null,
    friendRequests: [],
    pendingFriendCount: 0,
    achievements: [],
  };

  const $ = (id) => document.getElementById(id);

  function getModal(id) {
    const el = $(id);
    if (!el || !window.bootstrap) return null;
    return bootstrap.Modal.getOrCreateInstance(el);
  }

  function showToast(message, delay = 2400) {
    const toastEl = $("toast");
    if (!toastEl) {
      alert(message);
      return;
    }
    toastEl.textContent = message;
    toastEl.classList.add("show");
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => toastEl.classList.remove("show"), delay);
  }

  function showModalMessage(message) {
    const modalMessage = $("modalMessage");
    if (modalMessage) modalMessage.textContent = message;
    if (pinModal) pinModal.show();
    else showToast(message);
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

    let data = {};
    try {
      data = await res.json();
    } catch (error) {
      data = { success: false, message: "伺服器沒有回傳 JSON，請確認 Flask 是否正在執行。" };
    }

    if (!res.ok || data.success === false) {
      throw new Error(data.message || "發生錯誤");
    }
    return data;
  }

  function openLoginModal() {
    if (memberModal) memberModal.show();
    else showToast("找不到登入視窗，請檢查 memberModal 是否存在");
  }

  function updateAuthUI() {
    const user = getCurrentUser();
    const loginStatus = $("loginStatus");
    const loginBtn = $("loginBtn");
    const logoutBtn = $("logoutBtn");
    const friendsShell = $("friendsShell");
    const friendsDockBtn = $("friendsDockBtn");
    const openAddFriendBtn = $("openAddFriendBtn");

    if (loginStatus) loginStatus.textContent = user || "尚未登入";
    loginBtn?.classList.toggle("d-none", !!user);
    logoutBtn?.classList.toggle("d-none", !user);

    if (friendsShell) {
      friendsShell.style.display = user ? "block" : "none";
      if (!user) friendsShell.classList.remove("open");
    }
    if (friendsDockBtn) friendsDockBtn.style.display = user ? "flex" : "none";
    if (openAddFriendBtn) openAddFriendBtn.style.display = user ? "inline-flex" : "none";
  }

  function renderFriendsOverview(data = {}) {
    const friendsRecords = $("friendsRecords");
    const friendsList = $("friendsList");
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
      friendsRecords.innerHTML = records.map((item) => `
        <article class="friends-record-card is-empty">
          <div class="friends-empty-user">
            <div class="friends-avatar-badge"><i class="fa-solid fa-circle-user"></i></div>
            <div>
              <div class="friends-record-name">${escapeHtml(item.username)}</div>
              <div class="friends-record-rank">無勝場紀錄</div>
            </div>
          </div>
        </article>
      `).join("");
    } else {
      friendsRecords.innerHTML = records.map((item, index) => `
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
      `).join("");
    }

    const friends = Array.isArray(data.friends) ? data.friends : [];
    friendsList.textContent = friends.length
      ? `好友列表：${friends.join("、")}`
      : "好友列表：目前還沒有好友，先送出第一個好友申請吧。";
  }

  function renderFriendRequestBadge(count) {
    state.pendingFriendCount = Number(count || 0);
    const badges = [$("friendRequestBadge"), $("friendDockBadge")].filter(Boolean);
    if (!badges.length) return;

    if (state.pendingFriendCount > 0) {
      badges.forEach((badge) => {
        badge.textContent = String(state.pendingFriendCount);
        badge.classList.remove("d-none");
      });
    } else {
      badges.forEach((badge) => {
        badge.textContent = "0";
        badge.classList.add("d-none");
      });
    }
  }

  function renderFriendRequestsModal() {
    const friendRequestsContent = $("friendRequestsContent");
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

    friendRequestsContent.innerHTML = rows.map((row) => `
      <article class="friend-request-card">
        <div class="friend-request-top">
          <div>
            <div class="friend-request-name">${escapeHtml(row.requester)}</div>
            <div class="friend-request-meta">${escapeHtml(row.createdAtText)} ・ ${escapeHtml(row.device)}</div>
          </div>
          <div class="friend-request-actions">
            <button class="friend-request-btn accept" type="button" data-action="accept" data-request-id="${row.id}">接受</button>
            <button class="friend-request-btn reject" type="button" data-action="reject" data-request-id="${row.id}">略過</button>
          </div>
        </div>
      </article>
    `).join("");

    friendRequestsContent.querySelectorAll(".friend-request-btn").forEach((btn) => {
      btn.addEventListener("click", () => respondFriendRequest(btn.dataset.requestId, btn.dataset.action));
    });
  }

  function renderAchievementsSummary(data = {}) {
    const achievementCount = $("achievementCount");
    const achievementsList = $("achievementsList");
    if (!achievementCount || !achievementsList) return;

    const achievements = Array.isArray(data.achievements) ? data.achievements : [];
    state.achievements = achievements;
    achievementCount.textContent = `${Number(data.unlockedCount || 0)}/${Number(data.totalCount || achievements.length || 0)}`;
    const user = getCurrentUser();
    const seenKey = user ? `seenAchievements:${user}` : "";
    let seenItems = [];
    try {
      seenItems = seenKey ? JSON.parse(localStorage.getItem(seenKey) || "[]") : [];
    } catch (error) {
      seenItems = [];
    }
    const seen = new Set(Array.isArray(seenItems) ? seenItems : []);
    const visibleAchievements = achievements.filter((item) => !item.unlocked || !seen.has(item.id));

    if (!visibleAchievements.length) {
      achievementsList.innerHTML = `
        <article class="achievement-card is-empty">
          <i class="fa-solid fa-award"></i>
          <div>
            <strong>目前沒有新的成就</strong>
            <span>新的挑戰解鎖後會出現在這裡。</span>
          </div>
        </article>
      `;
      return;
    }

    const newlyUnlocked = [];
    achievementsList.innerHTML = visibleAchievements.map((item) => {
      const progress = Math.max(0, Math.min(100, Number(item.progress || 0)));
      const current = Number(item.rawCurrent ?? item.current ?? 0);
      const target = Number(item.target || 1);
      const isNewUnlock = item.unlocked && !seen.has(item.id);
      if (isNewUnlock) newlyUnlocked.push(item.id);
      return `
        <article class="achievement-card ${item.unlocked ? "is-unlocked" : ""} ${isNewUnlock ? "is-new-unlock" : ""}" data-achievement-id="${escapeHtml(item.id)}">
          <div class="achievement-icon"><i class="fa-solid ${escapeHtml(item.icon || "fa-award")}"></i></div>
          <div class="achievement-body">
            <div class="achievement-title-row">
              <strong>${escapeHtml(item.title)}</strong>
              <span>${item.unlocked ? "已解鎖" : `${Math.min(current, target)}/${target}`}</span>
            </div>
            <p>${escapeHtml(item.description)}</p>
            <div class="achievement-progress" aria-hidden="true">
              <span style="width:${progress}%"></span>
            </div>
          </div>
        </article>
      `;
    }).join("");

    if (newlyUnlocked.length && seenKey) {
      setTimeout(() => {
        newlyUnlocked.forEach((id) => seen.add(id));
        localStorage.setItem(seenKey, JSON.stringify([...seen]));
        achievementsList.querySelectorAll(".achievement-card.is-new-unlock").forEach((card) => {
          card.classList.add("is-clearing");
        });
        setTimeout(() => renderAchievementsSummary(data), 620);
      }, 1200);
    }
  }

  async function loadAchievementsSummary() {
    const user = getCurrentUser();
    const achievementsList = $("achievementsList");
    if (!user) {
      state.achievements = [];
      renderAchievementsSummary({ unlockedCount: 0, totalCount: 0, achievements: [] });
      return;
    }

    try {
      const data = await api(`/achievements_summary?username=${encodeURIComponent(user)}`);
      renderAchievementsSummary(data);
    } catch (error) {
      if (achievementsList) {
        achievementsList.innerHTML = `<article class="achievement-card is-empty"><div><strong>成就載入失敗</strong><span>${escapeHtml(error.message)}</span></div></article>`;
      }
    }
  }

  function toggleFriendsDrawer(forceOpen = null) {
    const friendsShell = $("friendsShell");
    if (!friendsShell || friendsShell.style.display === "none") return;
    const shouldOpen = forceOpen === null ? !friendsShell.classList.contains("open") : !!forceOpen;
    friendsShell.classList.toggle("open", shouldOpen);
  }

  async function loadFriendsOverview() {
    const user = getCurrentUser();
    const friendsRecords = $("friendsRecords");
    if (!user) return;

    try {
      const data = await api(`/friends_overview?username=${encodeURIComponent(user)}`);
      renderFriendsOverview(data);
    } catch (error) {
      if (friendsRecords) friendsRecords.innerHTML = `<div class="empty-lobby text-pink">${escapeHtml(error.message)}</div>`;
    }
  }

  async function loadFriendRequestSummary() {
    const user = getCurrentUser();
    const friendRequestsContent = $("friendRequestsContent");
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
    const friendUsernameInput = $("friendUsernameInput");
    const friendName = friendUsernameInput?.value.trim() || "";

    if (!user) {
      showToast("請先登入再送出好友申請");
      openLoginModal();
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
      addFriendModal?.hide();
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
      loadAchievementsSummary();
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
      ? `<div class="tiny-text">房間金鑰</div><div class="room-pin" style="font-size:1.15rem;">${escapeHtml(room.room_key_plain)}</div>`
      : `<div class="tiny-text">房間 PIN</div><div class="room-pin">${escapeHtml(room.pin)}</div>`;

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
          <span class="badge-qa"><i class="fa-solid fa-users"></i>${Number(room.player_count || 0)}/${Number(room.max_players || 0)}</span>
        </div>
        <button class="custom-btn btn-create join-room-btn" type="button" data-pin="${escapeHtml(room.pin)}" ${disabled}>
          ${room.joinable ? "加入房間" : "房間不可加入"}
        </button>
      </article>
    `;
  }

  function renderLobby(rooms) {
    const lobbyGrid = $("lobbyGrid");
    const waitingRoomCount = $("waitingRoomCount");
    const onlinePlayerCount = $("onlinePlayerCount");
    const privateRoomCount = $("privateRoomCount");
    if (!lobbyGrid) return;

    const safeRooms = Array.isArray(rooms) ? rooms : [];
    const roomPlayers = safeRooms.reduce((sum, room) => sum + Number(room.player_count || 0), 0);
    if (waitingRoomCount) waitingRoomCount.textContent = safeRooms.filter((room) => room.status === "waiting").length;
    if (onlinePlayerCount) onlinePlayerCount.textContent = roomPlayers + 1;
    if (privateRoomCount) privateRoomCount.textContent = safeRooms.filter((room) => room.is_private).length;

    if (!safeRooms.length) {
      lobbyGrid.innerHTML = '<div class="empty-lobby text-pink">目前還沒有可加入的房間</div>';
      return;
    }

    lobbyGrid.innerHTML = safeRooms.map(buildRoomCard).join("");
    document.querySelectorAll(".join-room-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const room = state.rooms.find((item) => item.pin === btn.dataset.pin);
        if (!room) return;

        if (room.is_private) {
          state.pendingJoinRoom = room;
          const roomKeyPrompt = $("roomKeyPrompt");
          const roomKeyInput = $("roomKeyInput");
          if (roomKeyPrompt) roomKeyPrompt.textContent = `${room.display_name} 是私人房，請輸入金鑰加入。`;
          if (roomKeyInput) roomKeyInput.value = "";
          roomKeyModal?.show();
        } else {
          redirectToJoin(room, "");
        }
      });
    });
  }

  async function loadLobby() {
    const lobbyGrid = $("lobbyGrid");
    try {
      const data = await api("/lobby_rooms");
      state.rooms = data.rooms || [];
      renderLobby(state.rooms);
    } catch (error) {
      if (lobbyGrid) lobbyGrid.innerHTML = `<div class="empty-lobby">載入大廳失敗：${escapeHtml(error.message)}</div>`;
    }
  }

  async function handlePinJoin() {
    const pinInput = $("pinInput");
    const pin = pinInput?.value.trim() || "";
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
        const roomKeyPrompt = $("roomKeyPrompt");
        const roomKeyInput = $("roomKeyInput");
        if (roomKeyPrompt) roomKeyPrompt.textContent = `房間 ${data.room.room_name || data.room.bank_title || data.room.pin} 需要金鑰，請先驗證。`;
        if (roomKeyInput) roomKeyInput.value = "";
        roomKeyModal?.show();
        return;
      }

      redirectToJoin(data.room, "");
    } catch (error) {
      showModalMessage(error.message);
    }
  }

  async function handleConfirmRoomKey() {
    const room = state.pendingJoinRoom;
    const roomKeyInput = $("roomKeyInput");
    if (!room) return;

    try {
      await api("/verify_room_key", {
        method: "POST",
        body: JSON.stringify({ pin: room.pin, roomKey: roomKeyInput?.value.trim() || "" }),
      });
      roomKeyModal?.hide();
      redirectToJoin(room, roomKeyInput?.value.trim() || "");
    } catch (error) {
      showToast(error.message);
    }
  }

  async function handleLogin(event) {
    event.preventDefault();
    const loginUsername = $("loginUsername");
    const loginPassword = $("loginPassword");

    try {
      const data = await api("/login", {
        method: "POST",
        body: JSON.stringify({
          username: loginUsername?.value.trim() || "",
          password: loginPassword?.value.trim() || "",
        }),
      });

      setCurrentUser(data.username);
      memberModal?.hide();
      updateAuthUI();
      await loadFriendsOverview();
      await loadFriendRequestSummary();
      await loadAchievementsSummary();
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
    const registerUsername = $("registerUsername");
    const registerEmail = $("registerEmail");
    const registerPassword = $("registerPassword");
    const email = registerEmail?.value.trim() || "";

    if (!email.includes("@")) {
      showToast("Email 格式不正確，至少要包含 @");
      return;
    }

    try {
      await api("/register", {
        method: "POST",
        body: JSON.stringify({
          username: registerUsername?.value.trim() || "",
          email,
          password: registerPassword?.value.trim() || "",
        }),
      });

      showToast("註冊成功，現在可以直接登入");
      switchMemberTab("login");
    } catch (error) {
      showToast(error.message);
    }
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
    state.achievements = [];
    renderFriendRequestBadge(0);
    renderAchievementsSummary({ unlockedCount: 0, totalCount: 0, achievements: [] });
    updateAuthUI();
    const friendsRecords = $("friendsRecords");
    const friendsList = $("friendsList");
    if (friendsRecords) friendsRecords.innerHTML = "";
    if (friendsList) friendsList.textContent = "";
    showToast("已登出");
  }

  function switchMemberTab(type) {
    const showLoginBtn = $("showLoginBtn");
    const showRegisterBtn = $("showRegisterBtn");
    const loginFormBox = $("loginForm");
    const registerFormBox = $("registerForm");
    const isLogin = type === "login";

    showLoginBtn?.classList.toggle("active", isLogin);
    showRegisterBtn?.classList.toggle("active", !isLogin);
    if (loginFormBox) loginFormBox.style.display = isLogin ? "block" : "none";
    if (registerFormBox) registerFormBox.style.display = isLogin ? "none" : "block";
  }

  function bindEvents() {
    $("startBtn")?.addEventListener("click", handlePinJoin);
    $("pinInput")?.addEventListener("keydown", (event) => {
      if (event.key === "Enter") handlePinJoin();
    });
    $("refreshLobbyBtn")?.addEventListener("click", loadLobby);
    $("confirmRoomKeyBtn")?.addEventListener("click", handleConfirmRoomKey);

    $("loginBtn")?.addEventListener("click", openLoginModal);
    $("logoutBtn")?.addEventListener("click", handleLogout);
    $("createQuizBtn")?.addEventListener("click", handleCreateQuizClick);

    $("loginForm")?.addEventListener("submit", handleLogin);
    $("registerForm")?.addEventListener("submit", handleRegister);
    $("addFriendBtn")?.addEventListener("click", handleAddFriend);

    $("friendsDockBtn")?.addEventListener("click", () => {
      toggleFriendsDrawer(true);
      loadFriendsOverview();
      loadFriendRequestSummary();
      loadAchievementsSummary();
    });

    $("closeFriendsDrawerBtn")?.addEventListener("click", () => toggleFriendsDrawer(false));

    $("openAddFriendBtn")?.addEventListener("click", () => {
      if (!getCurrentUser()) {
        showToast("請先登入");
        openLoginModal();
        return;
      }
      addFriendModal?.show();
    });

    $("openFriendRequestsBtn")?.addEventListener("click", async () => {
      if (!getCurrentUser()) {
        showToast("請先登入");
        openLoginModal();
        return;
      }
      await loadFriendRequestSummary();
      friendRequestsModal?.show();
    });

    $("friendUsernameInput")?.addEventListener("keydown", (event) => {
      if (event.key === "Enter") handleAddFriend();
    });

    $("showLoginBtn")?.addEventListener("click", () => switchMemberTab("login"));
    $("showRegisterBtn")?.addEventListener("click", () => switchMemberTab("register"));
  }

  function initModals() {
    pinModal = getModal("pinModal");
    roomKeyModal = getModal("roomKeyModal");
    memberModal = getModal("memberModal");
    addFriendModal = getModal("addFriendModal");
    friendRequestsModal = getModal("friendRequestsModal");
  }

  function init() {
    initModals();
    bindEvents();
    updateAuthUI();
    loadLobby();
    loadFriendsOverview();
    loadFriendRequestSummary();
    loadAchievementsSummary();
    setInterval(loadLobby, 8000);
    setInterval(loadFriendsOverview, 15000);
    setInterval(loadFriendRequestSummary, 15000);
    setInterval(loadAchievementsSummary, 15000);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
