const toastEl =
  document.getElementById("toast") ||
  (() => {
    const el = document.createElement("div");
    el.id = "toast";
    el.className = "toast-qa";
    document.body.appendChild(el);
    return el;
  })();

function showToast(message, delay = 2400) {
  toastEl.textContent = message;
  toastEl.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => {
    toastEl.classList.remove("show");
  }, delay);
}

function getJoinContext() {
  try {
    return JSON.parse(localStorage.getItem("pendingJoinContext") || "null");
  } catch {
    return null;
  }
}

function getLastPlayerName() {
  try {
    const savedProfile = JSON.parse(localStorage.getItem("roomPlayerProfile") || "null");
    return (savedProfile?.name || "").trim();
  } catch {
    return "";
  }
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

/* ========= DOM ========= */
const roomNameText = document.getElementById("roomNameText");
const roomPinText = document.getElementById("roomPinText");
const roomBankText = document.getElementById("roomBankText");
const roomModeText = document.getElementById("roomModeText");

const playerNameInput = document.getElementById("playerNameInput");
const previewPlayerName = document.getElementById("previewPlayerName");

const hairTabBtn = document.getElementById("hairTabBtn");
const eyeTabBtn = document.getElementById("eyeTabBtn");

const mainFace = document.getElementById("mainFace");
const mainEye = document.getElementById("mainEye");
const mainHair = document.getElementById("mainHair");

const previewFace = document.getElementById("previewFace");
const previewEye = document.getElementById("previewEye");
const previewHair = document.getElementById("previewHair");

const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");
const eyeSlider = document.getElementById("eyeSlider");
const eyeSliderBox = document.getElementById("eyeSliderBox");

const randomBtn = document.getElementById("randomBtn");
const resetBtn = document.getElementById("resetBtn");
const joinRoomBtn = document.getElementById("joinRoomBtn");

/* ========= 資料 ========= */
const HAIRS = [
  "images/hair/hair01.png",
  "images/hair/hair02.png",
  "images/hair/hair03.png",
  "images/hair/hair04.png",
  "images/hair/hair05.png",
  "images/hair/hair06.png",
  "images/hair/hair09.png",
  "images/hair/hair10.png",
  "images/hair/hair11.png",
  "images/hair/hair12.png",
  "images/hair/hair13.png",
  "images/hair/hair14.png",
  "images/hair/hair15.png",
  "images/hair/hair16.png",
  "images/hair/hair17.png"
];

const EYES = [
  "images/face/eyes01.png",
  "images/face/eyes02.png",
  "images/face/eyes03.png",
  "images/face/eyes04.png",
  "images/face/eyes05.png",
  "images/face/eyes06.png",
  "images/face/eyes07.png",
  "images/face/eyes08.png",
  "images/face/eyes09.png",
  "images/face/eyes10.png",
  "images/face/eyes11.png",
  "images/face/eyes12.png"
];

const state = {
  currentPart: "hair",
  hairIndex: 0,
  eyeIndex: 0,
  eyesOffsetY: 0,
  context: getJoinContext(),
  profileSummary: null
};

async function loadProfileSummary() {
  const username = localStorage.getItem("currentUser") || "";
  if (!username) return null;
  try {
    const data = await api(`/profile_summary?username=${encodeURIComponent(username)}`);
    state.profileSummary = data;
    const hint = document.getElementById("profileSyncHint");
    const hintText = document.getElementById("profileSyncText");
    if (hint && hintText) {
      hint.style.display = "block";
      hintText.textContent = data.avatarUrl
        ? `已套用 ${data.title || "個人稱號"}、${data.county || "未設定縣市"} 與上傳頭像`
        : `已套用 ${data.title || "個人稱號"} 與 ${data.county || "未設定縣市"}`;
    }
    return data;
  } catch {
    return null;
  }
}

function populateRoomInfo() {
  const room = state.context?.room;

  if (!room?.pin) {
    showToast("找不到房間資料，請從首頁重新加入。");
    setTimeout(() => {
      window.location.href = "index.html";
    }, 1600);
    return;
  }

  roomNameText.textContent = room.room_name || room.display_name || "-";
  roomPinText.textContent = room.pin || "------";
  roomBankText.textContent = room.bank_title || "-";
  roomModeText.textContent = room.team_mode ? "團體賽" : "個人賽";

  const lastPlayerName = getLastPlayerName();
  playerNameInput.value =
    lastPlayerName || `PLAYER_${Math.floor(Math.random() * 900 + 100)}`;

  updateNamePreview();
}

function updateNamePreview() {
  previewPlayerName.textContent =
    playerNameInput.value.trim() || "玩家名稱";
}

function applyEyesOffset() {
  mainEye.style.transform = `translateX(-50%) translateY(${state.eyesOffsetY}px)`;
  previewEye.style.transform = `translateX(-50%) translateY(${state.eyesOffsetY}px)`;
}

function syncAvatarImages() {
  const hair = HAIRS[state.hairIndex];
  const eyes = EYES[state.eyeIndex];

  mainHair.src = hair;
  previewHair.src = hair;

  mainEye.src = eyes;
  previewEye.src = eyes;

  applyEyesOffset();
}

function updatePartTabs() {
  const isHair = state.currentPart === "hair";
  const isEye = state.currentPart === "eye";

  hairTabBtn.classList.toggle("active", isHair);
  eyeTabBtn.classList.toggle("active", isEye);

  mainHair.classList.toggle("hidden-layer", !isHair);
  mainEye.classList.toggle("hidden-layer", !isEye);

  previewHair.classList.remove("hidden-layer");
  previewEye.classList.remove("hidden-layer");

  eyeSliderBox.classList.toggle("hidden-layer", !isEye);
}

function movePart(direction) {
  if (state.currentPart === "hair") {
    state.hairIndex =
      (state.hairIndex + direction + HAIRS.length) % HAIRS.length;
  } else {
    state.eyeIndex =
      (state.eyeIndex + direction + EYES.length) % EYES.length;
  }

  syncAvatarImages();
}

function randomizeAvatar() {
  state.hairIndex = Math.floor(Math.random() * HAIRS.length);
  state.eyeIndex = Math.floor(Math.random() * EYES.length);
  state.eyesOffsetY = Math.floor(Math.random() * 11) - 5;
  eyeSlider.value = String(state.eyesOffsetY);

  syncAvatarImages();
  updatePartTabs();
}

function resetAvatar() {
  state.hairIndex = 0;
  state.eyeIndex = 0;
  state.eyesOffsetY = 0;
  state.currentPart = "hair";
  eyeSlider.value = "0";

  syncAvatarImages();
  updatePartTabs();
}

async function joinRoom() {
  const context = state.context;
  if (!context?.room?.pin) {
    showToast("找不到房間資料，請從首頁重新加入。");
    return;
  }

  const playerName = playerNameInput.value.trim();
  if (!playerName) {
    showToast("請先輸入玩家名稱");
    return;
  }

  const isHost = !!context.isHost;

  const payload = {
    pin: context.room.pin,
    roomKey: context.roomKey || "",
    player: {
      username: localStorage.getItem("currentUser") || "",
      name: playerName,
      face: "images/face/face.png",
      hair: HAIRS[state.hairIndex],
      eyes: EYES[state.eyeIndex],
      eyesOffsetY: state.eyesOffsetY,
      avatarUrl: state.profileSummary?.avatarUrl || "",
      county: state.profileSummary?.county || "",
      title: state.profileSummary?.title || "",
      isHost: isHost
    }
  };

  try {
    await api("/join_room", {
      method: "POST",
      body: JSON.stringify(payload)
    });

    localStorage.setItem("roomPlayerProfile", JSON.stringify(payload.player));
    localStorage.setItem("currentRoomPin", context.room.pin);
    localStorage.setItem("currentRoomKey", context.roomKey || "");

    // 加入成功音效
    try { AudioManager?.joinRoom?.(); } catch(_) {}
    setTimeout(() => {
      window.location.href = isHost
        ? "house_waiting_room.html"
        : "waiting_room.html";
    }, 350);
  } catch (e) {
    showToast(e.message);
  }
}

playerNameInput?.addEventListener("input", updateNamePreview);

hairTabBtn?.addEventListener("click", () => {
  state.currentPart = "hair";
  updatePartTabs();
});

eyeTabBtn?.addEventListener("click", () => {
  state.currentPart = "eye";
  updatePartTabs();
});

prevBtn?.addEventListener("click", () => movePart(-1));
nextBtn?.addEventListener("click", () => movePart(1));
randomBtn?.addEventListener("click", randomizeAvatar);
resetBtn?.addEventListener("click", resetAvatar);

eyeSlider?.addEventListener("input", () => {
  state.eyesOffsetY = Number(eyeSlider.value || 0);
  applyEyesOffset();
});

joinRoomBtn?.addEventListener("click", joinRoom);

populateRoomInfo();
syncAvatarImages();
loadProfileSummary();

// ── 房主在選頭像期間發 heartbeat，防止房間被系統刪除 ──────
(function startHostHeartbeat() {
  const ctx = getJoinContext();
  if (!ctx?.isHost || !ctx?.room?.pin) return;   // 只有房主需要

  const pin = ctx.room.pin;

  // 先用一個暫時名稱發一次 join，讓 last_seen 存進去
  // （房主真正 join 會在按「進入房間」時完成，這裡只是保持心跳）
  // 用 __host_{帳號}__ 格式讓後端辨識為佔位心跳
  const hostPlaceholderName = `__host_${ctx.room.created_by || 'host'}__`;
  async function beat() {
    try {
      await fetch('/heartbeat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin, playerName: hostPlaceholderName })
      });
    } catch (_) {}
  }

  // 每 20 秒發一次（host_alive_cutoff = 80 秒，20 秒保底夠用）
  beat();
  setInterval(beat, 20000);
})();
updatePartTabs();
