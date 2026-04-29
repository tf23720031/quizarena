const toastEl = document.getElementById("toast");
const pinModal = new bootstrap.Modal(document.getElementById("pinModal"));
const roomKeyModal = new bootstrap.Modal(document.getElementById("roomKeyModal"));
const memberModal = new bootstrap.Modal(document.getElementById("memberModal"));
const addFriendModal = new bootstrap.Modal(document.getElementById("addFriendModal"));
const friendRequestsModal = new bootstrap.Modal(document.getElementById("friendRequestsModal"));
const profileModal = new bootstrap.Modal(document.getElementById("profileModal"));

const loginBtn = document.getElementById("loginBtn");
const logoutBtn = document.getElementById("logoutBtn");
const loginStatus = document.getElementById("loginStatus");
const loginStatusCard = document.getElementById("loginStatusCard");
const loginStatusAvatar = document.getElementById("loginStatusAvatar");
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
const profileAvatarInput = document.getElementById("profileAvatarInput");
const profileAvatarPreview = document.getElementById("profileAvatarPreview");
const profileAvatarFallback = document.getElementById("profileAvatarFallback");
const profileUsernameText = document.getElementById("profileUsernameText");
const profileCurrentTitle = document.getElementById("profileCurrentTitle");
const profileTitleSelect = document.getElementById("profileTitleSelect");
const profileAvatarGallery = document.getElementById("profileAvatarGallery");
const profileAchievements = document.getElementById("profileAchievements");
const profileAchievementCount = document.getElementById("profileAchievementCount");
const profileWrongStats = document.getElementById("profileWrongStats");
const profileFaceLayer = document.getElementById("profileFaceLayer");
const profileHairLayer = document.getElementById("profileHairLayer");
const profileEyeLayer = document.getElementById("profileEyeLayer");
const profileHairTabBtn = document.getElementById("profileHairTabBtn");
const profileEyeTabBtn = document.getElementById("profileEyeTabBtn");
const profilePrevPartBtn = document.getElementById("profilePrevPartBtn");
const profileNextPartBtn = document.getElementById("profileNextPartBtn");
const profileEyeSlider = document.getElementById("profileEyeSlider");
const profileRandomBtn = document.getElementById("profileRandomBtn");
const profileResetBtn = document.getElementById("profileResetBtn");
const historyPlayerFilter = document.getElementById("historyPlayerFilter");
const historyBankFilter = document.getElementById("historyBankFilter");
const historyModeFilter = document.getElementById("historyModeFilter");
const historyStartDate = document.getElementById("historyStartDate");
const historyEndDate = document.getElementById("historyEndDate");
const reloadRoomHistoryBtn = document.getElementById("reloadRoomHistoryBtn");
const exportRoomHistoryBtn = document.getElementById("exportRoomHistoryBtn");
const roomHistoryList = document.getElementById("roomHistoryList");
const roomHistoryDetail = document.getElementById("roomHistoryDetail");
const saveProfileBtn = document.getElementById("saveProfileBtn");

const showLoginBtn = document.getElementById("showLoginBtn");
const showRegisterBtn = document.getElementById("showRegisterBtn");
const loginFormBox = document.getElementById("loginForm");
const registerFormBox = document.getElementById("registerForm");

const HAIRS = [
  "images/hair/hair01.png","images/hair/hair02.png","images/hair/hair03.png","images/hair/hair04.png",
  "images/hair/hair05.png","images/hair/hair06.png","images/hair/hair09.png","images/hair/hair10.png",
  "images/hair/hair11.png","images/hair/hair12.png","images/hair/hair13.png","images/hair/hair14.png",
  "images/hair/hair15.png","images/hair/hair16.png","images/hair/hair17.png"
];
const EYES = [
  "images/face/eyes01.png","images/face/eyes02.png","images/face/eyes03.png","images/face/eyes04.png",
  "images/face/eyes05.png","images/face/eyes06.png","images/face/eyes07.png","images/face/eyes08.png",
  "images/face/eyes09.png","images/face/eyes10.png","images/face/eyes11.png","images/face/eyes12.png"
];

const state = {
  rooms: [],
  pendingJoinRoom: null,
  pendingAfterLogin: null,
  friendRequests: [],
  pendingFriendCount: 0,
  profile: null,
  profileAvatarImage: "",
  profileAvatarGallery: [],
  currentAppearancePart: "hair",
  hairIndex: 0,
  eyeIndex: 0,
  eyesOffsetY: 0,
  isSavingProfile: false,
  profileSyncPausedUntil: 0,
  roomHistoryRecords: [],
  selectedHistoryId: 0,
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

function saveLocalProfile(profile) {
  localStorage.setItem("quizUserProfile", JSON.stringify(profile || {}));
}

function clearLocalProfile() {
  localStorage.removeItem("quizUserProfile");
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function buildCsvRow(values) {
  return values.map((value) => `"${String(value ?? "").replaceAll('"', '""')}"`).join(",");
}

function formatDateTime(ts) {
  if (!ts) return "-";
  const date = new Date(Number(ts) * 1000);
  return Number.isNaN(date.getTime()) ? "-" : date.toLocaleString("zh-TW", { hour12: false });
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

function syncProfileAppearanceLayers() {
  const hair = HAIRS[state.hairIndex] || HAIRS[0];
  const eyes = EYES[state.eyeIndex] || EYES[0];
  if (profileHairLayer) profileHairLayer.src = hair;
  if (profileEyeLayer) {
    profileEyeLayer.src = eyes;
    profileEyeLayer.style.transform = `translateY(${state.eyesOffsetY}px)`;
  }
  if (profileFaceLayer) profileFaceLayer.src = "images/face/face.png";
  if (profileEyeSlider) profileEyeSlider.value = String(state.eyesOffsetY);
  profileHairTabBtn?.classList.toggle("active", state.currentAppearancePart === "hair");
  profileEyeTabBtn?.classList.toggle("active", state.currentAppearancePart === "eye");
}

function hydrateProfileAppearance(profile) {
  state.hairIndex = Math.max(0, HAIRS.indexOf(profile?.hair || ""));
  state.eyeIndex = Math.max(0, EYES.indexOf(profile?.eyes || ""));
  state.eyesOffsetY = Number(profile?.eyesOffsetY || 0);
  syncProfileAppearanceLayers();
}

function renderProfileAvatarGallery() {
  if (!profileAvatarGallery) return;
  const items = state.profileAvatarGallery.filter(Boolean);
  profileAvatarGallery.innerHTML = items.length
    ? items.map((src, index) => `
        <button type="button" class="profile-gallery-item ${src === state.profileAvatarImage ? "active" : ""}" data-index="${index}">
          <img src="${escapeHtml(src)}" alt="avatar-${index}">
        </button>
      `).join("")
    : '<div class="profile-wrong-empty">尚未上傳頭像，先新增一張你喜歡的圖片。</div>';

  profileAvatarGallery.querySelectorAll(".profile-gallery-item").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.profileAvatarImage = state.profileAvatarGallery[Number(btn.dataset.index)] || "";
      renderProfileSummary({ ...(state.profile || {}), avatarImage: state.profileAvatarImage, avatarGallery: state.profileAvatarGallery }, true);
    });
  });
}

function renderRoomHistoryList() {
  if (!roomHistoryList) return;
  if (!state.roomHistoryRecords.length) {
    roomHistoryList.innerHTML = '<div class="profile-wrong-empty">目前沒有符合條件的歷史房間記錄。</div>';
    return;
  }
  roomHistoryList.innerHTML = state.roomHistoryRecords.map((record) => `
    <button type="button" class="room-history-card ${record.id === state.selectedHistoryId ? "active" : ""}" data-id="${record.id}">
      <strong>${escapeHtml(record.roomName || "未命名房間")}</strong>
      <div>${escapeHtml(record.bankTitle || "未命名題庫")}</div>
      <div>${escapeHtml(record.gameMode === "team" ? "團隊模式" : "個人模式")} · ${formatDateTime(record.closedAt)}</div>
      <div>${record.playerCount} 位玩家 · ${record.questionCount} 題</div>
    </button>
  `).join("");
  roomHistoryList.querySelectorAll(".room-history-card").forEach((btn) => {
    btn.addEventListener("click", () => loadRoomHistoryDetail(Number(btn.dataset.id)));
  });
}

function renderHistoryDetail(detail) {
  if (!roomHistoryDetail) return;
  const room = detail?.room || {};
  const leaderboard = Array.isArray(detail?.leaderboard) ? detail.leaderboard : [];
  const breakdown = Array.isArray(detail?.questionBreakdown) ? detail.questionBreakdown : [];
  const correctTotal = Number(detail?.chartStats?.correctTotal || 0);
  const wrongTotal = Number(detail?.chartStats?.wrongTotal || 0);
  const totalAnswers = Math.max(correctTotal + wrongTotal, 1);
  roomHistoryDetail.innerHTML = `
    <div class="history-detail-head">
      <h4>${escapeHtml(room.roomName || "未命名房間")}</h4>
      <div>${escapeHtml(room.bankTitle || "未命名題庫")} · ${escapeHtml(room.teamMode ? "團隊模式" : "個人模式")}</div>
      <div>${formatDateTime(room.closedAt)}</div>
    </div>
    <div class="history-chart-row">
      <div class="history-chart-card">
        <div class="section-label">答題分布（對 vs 錯）</div>
        <div class="history-bar">
          <span class="correct" style="width:${(correctTotal / totalAnswers) * 100}%"></span>
          <span class="wrong" style="width:${(wrongTotal / totalAnswers) * 100}%"></span>
        </div>
        <div>答對 ${correctTotal} 次 / 答錯 ${wrongTotal} 次</div>
      </div>
      <div class="history-chart-card">
        <div class="section-label">玩家排行榜</div>
        ${leaderboard.slice(0, 5).map((row, index) => `<div class="history-mini-row"><span>#${index + 1} ${escapeHtml(row.playerName)}</span><strong>${row.totalScore}</strong></div>`).join("") || '<div class="profile-wrong-empty">沒有排行榜資料</div>'}
      </div>
    </div>
    <div class="history-question-table">
      <div class="section-label">答錯熱點題目</div>
      ${breakdown.map((row) => `
        <div class="history-question-row">
          <div><strong>${row.seq + 1}. ${escapeHtml(row.title)}</strong></div>
          <div>答錯 ${row.wrongCount} 次 · 正答率 ${row.correctRate}%</div>
        </div>
      `).join("") || '<div class="profile-wrong-empty">目前沒有題目統計</div>'}
    </div>
  `;
}

async function loadRoomHistorySummary() {
  const user = getCurrentUser();
  if (!user) return;
  try {
    const query = new URLSearchParams({
      username: user,
      playerName: historyPlayerFilter?.value.trim() || "",
      bankKeyword: historyBankFilter?.value.trim() || "",
      gameMode: historyModeFilter?.value || "",
      startDate: historyStartDate?.value || "",
      endDate: historyEndDate?.value || "",
    });
    const data = await api(`/room_history_summary?${query.toString()}`);
    state.roomHistoryRecords = data.records || [];
    state.selectedHistoryId = state.roomHistoryRecords[0]?.id || 0;
    renderRoomHistoryList();
    if (state.selectedHistoryId) await loadRoomHistoryDetail(state.selectedHistoryId);
    else if (roomHistoryDetail) roomHistoryDetail.innerHTML = '<div class="profile-wrong-empty">目前沒有符合條件的歷史房間記錄。</div>';
  } catch (error) {
    if (roomHistoryDetail) roomHistoryDetail.innerHTML = `<div class="profile-wrong-empty">${escapeHtml(error.message)}</div>`;
  }
}

async function loadRoomHistoryDetail(id) {
  if (!id) return;
  state.selectedHistoryId = id;
  renderRoomHistoryList();
  try {
    const data = await api(`/room_history_detail?id=${encodeURIComponent(id)}`);
    renderHistoryDetail(data.detail || {});
  } catch (error) {
    if (roomHistoryDetail) roomHistoryDetail.innerHTML = `<div class="profile-wrong-empty">${escapeHtml(error.message)}</div>`;
  }
}

function exportRoomHistoryCsv() {
  if (!state.roomHistoryRecords.length) {
    showToast("目前沒有可匯出的歷史資料");
    return;
  }
  const rows = [
    buildCsvRow(["房間名稱", "題庫名稱", "賽制", "玩家數", "題目數", "結束時間", "玩家名單"]),
    ...state.roomHistoryRecords.map((record) => buildCsvRow([
      record.roomName,
      record.bankTitle,
      record.gameMode === "team" ? "團隊" : "個人",
      record.playerCount,
      record.questionCount,
      formatDateTime(record.closedAt),
      (record.playerNames || []).join(" / "),
    ])),
  ];
  const blob = new Blob(["\ufeff" + rows.join("\n")], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `quizarena-room-history-${Date.now()}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
}

function renderProfileSummary(profile, keepLocalState = false) {
  state.profile = profile || null;
  state.profileAvatarImage = profile?.avatarImage || "";
  state.profileAvatarGallery = Array.isArray(profile?.avatarGallery) ? profile.avatarGallery.filter(Boolean) : [];
  saveLocalProfile(profile || {});

  if (profileUsernameText) profileUsernameText.textContent = profile?.username || getCurrentUser() || "-";
  if (profileCurrentTitle) profileCurrentTitle.textContent = profile?.selectedTitle || "尚未選擇稱號";

  if (profileAvatarPreview && profileAvatarFallback) {
    if (state.profileAvatarImage) {
      profileAvatarPreview.src = state.profileAvatarImage;
      profileAvatarPreview.style.display = "block";
      profileAvatarFallback.style.display = "none";
      if (loginStatusAvatar) {
        loginStatusAvatar.src = state.profileAvatarImage;
        loginStatusAvatar.style.display = "block";
        loginStatusCard?.classList.add("has-avatar");
      }
    } else {
      profileAvatarPreview.style.display = "none";
      profileAvatarFallback.style.display = "grid";
      if (loginStatusAvatar) {
        loginStatusAvatar.style.display = "none";
        loginStatusCard?.classList.remove("has-avatar");
      }
    }
  }
  renderProfileAvatarGallery();

  if (profileTitleSelect) {
    const titles = Array.isArray(profile?.titles) ? profile.titles : [];
    profileTitleSelect.innerHTML = titles.length
      ? titles.map((item) => `<option value="${escapeHtml(item.name)}">${escapeHtml(item.name)}</option>`).join("")
      : '<option value="">尚無稱號</option>';
    profileTitleSelect.value = profile?.selectedTitle || titles[0]?.name || "";
  }

  if (profileWrongStats) {
    const rows = Array.isArray(profile?.wrongStats) ? profile.wrongStats : [];
    profileWrongStats.innerHTML = rows.length
      ? rows.map((item) => `
          <div class="profile-wrong-item">
            <strong>${escapeHtml(item.bankTitle)}</strong>
            <div>${escapeHtml(item.questionTitle)}</div>
            <span>${escapeHtml(item.category || "綜合")} · 錯 ${Number(item.wrongCount || 0)} 次</span>
          </div>
        `).join("")
      : '<div class="profile-wrong-empty">目前還沒有錯題紀錄</div>';
  }

  if (profileAchievements && profileAchievementCount) {
    const achievements = Array.isArray(profile?.achievements) ? profile.achievements : [];
    profileAchievementCount.textContent = `${achievements.length} 項`;
    profileAchievements.innerHTML = achievements.length
      ? achievements.map((item) => `<div class="profile-achievement-item"><strong>${escapeHtml(item.name)}</strong></div>`).join("")
      : '<div class="profile-wrong-empty">目前還沒有解鎖成就</div>';
  }

  if (!keepLocalState) hydrateProfileAppearance(profile || {});

  updateAuthUI();
}

async function loadProfileSummary() {
  const user = getCurrentUser();
  if (!user) return;
  if (state.isSavingProfile || Date.now() < state.profileSyncPausedUntil) return;
  try {
    const data = await api(`/profile_summary?username=${encodeURIComponent(user)}`);
    renderProfileSummary(data.profile || null);
  } catch (error) {
    showToast(error.message);
  }
}

async function saveProfileSummary(options = {}) {
  const user = getCurrentUser();
  if (!user) return;
  state.isSavingProfile = true;
  try {
    const profile = {
      ...(state.profile || {}),
      avatarImage: state.profileAvatarImage || "",
      avatarGallery: state.profileAvatarGallery || [],
      selectedTitle: profileTitleSelect?.value || "",
      face: "images/face/face.png",
      hair: HAIRS[state.hairIndex] || HAIRS[0],
      eyes: EYES[state.eyeIndex] || EYES[0],
      eyesOffsetY: state.eyesOffsetY || 0,
    };
    const data = await api("/save_profile", {
      method: "POST",
      body: JSON.stringify({ username: user, profile }),
    });
    renderProfileSummary(data.profile || profile);
    state.profileSyncPausedUntil = Date.now() + 3000;
    if (!options.keepModalOpen) profileModal.hide();
    if (!options.silentSuccess) {
      showToast(options.successMessage || data.message || "個人資料已更新");
    }
  } catch (error) {
    showToast(error.message);
  } finally {
    state.isSavingProfile = false;
  }
}

function updateAuthUI() {
  const user = getCurrentUser();
  if (user) {
    loginStatus.textContent = state.profile?.selectedTitle
      ? `${user} · ${state.profile.selectedTitle}`
      : user;
    loginBtn.classList.add("d-none");
    logoutBtn.classList.remove("d-none");
  } else {
    loginStatus.textContent = "尚未登入";
    loginBtn.classList.remove("d-none");
    logoutBtn.classList.add("d-none");
    if (loginStatusAvatar) loginStatusAvatar.style.display = "none";
    loginStatusCard?.classList.remove("has-avatar");
  }

  if (friendsShell) friendsShell.style.display = user ? "flex" : "none";
  if (friendsDockBtn) friendsDockBtn.style.display = user ? "flex" : "none";
  if (openAddFriendBtn) openAddFriendBtn.style.display = user ? "inline-flex" : "none";
  if (!user && friendsShell) friendsShell.classList.remove("open");
}

function buildFriendAvatar(record) {
  if (record?.avatarImage) {
    return `<img class="friends-avatar-image" src="${escapeHtml(record.avatarImage)}" alt="${escapeHtml(record.username)}">`;
  }
  return '<i class="fa-solid fa-circle-user"></i>';
}

function buildFriendTags(record, index) {
  const tags = [];
  tags.push(record?.isCurrentUser ? "好友同行" : "好友同行");
  if (index === 0 && Number(record?.wins || 0) > 0) tags.push("第一榜");
  if (record?.selectedTitle) tags.push(record.selectedTitle);
  return tags.map((tag) => `<span class="friends-record-tag">${escapeHtml(tag)}</span>`).join("");
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
              <div class="friends-avatar-badge">${buildFriendAvatar(item)}</div>
              <div>
                <div class="friends-record-name">${escapeHtml(item.username)}</div>
                <div class="friends-record-rank">${escapeHtml(item.selectedTitle || "無勝場紀錄")}</div>
                <div class="friends-record-tags">${buildFriendTags(item, 99)}</div>
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
                <div class="friends-avatar-badge ${index === 0 ? "is-top" : ""}">${buildFriendAvatar(item)}</div>
                <div>
                  <div class="friends-record-rank">${index === 0 ? "NO.1 WINNER" : `RANK ${index + 1}`}</div>
                  <div class="friends-record-name">${escapeHtml(item.username)}</div>
                  <div class="friends-record-title">${escapeHtml(item.selectedTitle || "尚無勝場紀錄")}</div>
                  <div class="friends-record-tags">${buildFriendTags(item, index)}</div>
                </div>
              </div>
              <div class="friends-record-wins"><strong>${Number(item.wins || 0)}</strong><span>勝場</span></div>
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
    renderProfileSummary(data.profile || null);
    memberModal.hide();
    updateAuthUI();
    await loadProfileSummary();
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
  clearLocalProfile();
  state.profile = null;
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
loginStatusCard?.addEventListener("click", async () => {
  if (!getCurrentUser()) {
    openLoginModal();
    return;
  }
  await loadProfileSummary();
  await loadRoomHistorySummary();
  profileModal.show();
});
profileAvatarInput?.addEventListener("change", (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  if (!/^image\/(png|jpeg)$/.test(file.type)) {
    showToast("只支援 JPG / PNG");
    return;
  }
  state.profileSyncPausedUntil = Date.now() + 15000;
  const reader = new FileReader();
  reader.onload = async () => {
    state.profileAvatarImage = String(reader.result || "");
    state.profileAvatarGallery = [
      state.profileAvatarImage,
      ...state.profileAvatarGallery.filter((item) => item && item !== state.profileAvatarImage),
    ];
    renderProfileSummary({
      ...(state.profile || {}),
      username: getCurrentUser(),
      avatarImage: state.profileAvatarImage,
      avatarGallery: state.profileAvatarGallery,
      selectedTitle: profileTitleSelect?.value || state.profile?.selectedTitle || "",
      titles: state.profile?.titles || [],
      achievements: state.profile?.achievements || [],
      wrongStats: state.profile?.wrongStats || [],
      hair: HAIRS[state.hairIndex] || HAIRS[0],
      eyes: EYES[state.eyeIndex] || EYES[0],
      eyesOffsetY: state.eyesOffsetY || 0,
    }, true);
    await saveProfileSummary({
      keepModalOpen: true,
      successMessage: "頭像已更新",
    });
  };
  reader.readAsDataURL(file);
});
saveProfileBtn?.addEventListener("click", saveProfileSummary);
profileHairTabBtn?.addEventListener("click", () => {
  state.currentAppearancePart = "hair";
  syncProfileAppearanceLayers();
});
profileEyeTabBtn?.addEventListener("click", () => {
  state.currentAppearancePart = "eye";
  syncProfileAppearanceLayers();
});
profilePrevPartBtn?.addEventListener("click", () => {
  if (state.currentAppearancePart === "hair") state.hairIndex = (state.hairIndex - 1 + HAIRS.length) % HAIRS.length;
  else state.eyeIndex = (state.eyeIndex - 1 + EYES.length) % EYES.length;
  syncProfileAppearanceLayers();
});
profileNextPartBtn?.addEventListener("click", () => {
  if (state.currentAppearancePart === "hair") state.hairIndex = (state.hairIndex + 1) % HAIRS.length;
  else state.eyeIndex = (state.eyeIndex + 1) % EYES.length;
  syncProfileAppearanceLayers();
});
profileEyeSlider?.addEventListener("input", () => {
  state.eyesOffsetY = Number(profileEyeSlider.value || 0);
  syncProfileAppearanceLayers();
});
profileRandomBtn?.addEventListener("click", () => {
  state.hairIndex = Math.floor(Math.random() * HAIRS.length);
  state.eyeIndex = Math.floor(Math.random() * EYES.length);
  state.eyesOffsetY = Math.floor(Math.random() * 25) - 12;
  syncProfileAppearanceLayers();
});
profileResetBtn?.addEventListener("click", () => {
  if (!window.confirm("確定要把外貌重設為預設值嗎？")) return;
  state.hairIndex = 0;
  state.eyeIndex = 0;
  state.eyesOffsetY = 0;
  state.currentAppearancePart = "hair";
  syncProfileAppearanceLayers();
});
reloadRoomHistoryBtn?.addEventListener("click", loadRoomHistorySummary);
exportRoomHistoryBtn?.addEventListener("click", exportRoomHistoryCsv);
[historyPlayerFilter, historyBankFilter, historyModeFilter, historyStartDate, historyEndDate].forEach((el) => {
  el?.addEventListener("change", loadRoomHistorySummary);
});
historyPlayerFilter?.addEventListener("keydown", (event) => {
  if (event.key === "Enter") loadRoomHistorySummary();
});
historyBankFilter?.addEventListener("keydown", (event) => {
  if (event.key === "Enter") loadRoomHistorySummary();
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
loadProfileSummary();
loadFriendsOverview();
loadFriendRequestSummary();
setInterval(loadLobby, 8000);
setInterval(loadProfileSummary, 30000);
setInterval(loadFriendsOverview, 15000);
setInterval(loadFriendRequestSummary, 15000);
