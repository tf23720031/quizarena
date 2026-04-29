const $ = (id) => document.getElementById(id);
let profileState = null;
let nextAvatar = null;
let activeMode = "hair";

const HAIRS = [
  "images/hair/hair01.png", "images/hair/hair02.png", "images/hair/hair03.png",
  "images/hair/hair04.png", "images/hair/hair05.png", "images/hair/hair06.png",
  "images/hair/hair09.png", "images/hair/hair10.png", "images/hair/hair11.png",
  "images/hair/hair12.png", "images/hair/hair13.png", "images/hair/hair14.png",
  "images/hair/hair15.png", "images/hair/hair16.png", "images/hair/hair17.png",
];
const EYES = [
  "images/face/eyes01.png", "images/face/eyes02.png", "images/face/eyes03.png",
  "images/face/eyes04.png", "images/face/eyes05.png", "images/face/eyes06.png",
  "images/face/eyes07.png", "images/face/eyes08.png", "images/face/eyes09.png",
  "images/face/eyes10.png", "images/face/eyes11.png", "images/face/eyes12.png",
];
const DEFAULT_STYLE = { type: "style", face: "images/face/face.png", hair: HAIRS[0], eyes: EYES[0], eyeOffset: 0 };
let avatarStyle = { ...DEFAULT_STYLE };

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function showToast(message, delay = 2200) {
  const toast = $("toast");
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove("show"), delay);
}

async function api(url, options = {}) {
  const res = await fetch(url, { headers: { "Content-Type": "application/json" }, ...options });
  const data = await res.json();
  if (!res.ok || data.success === false) throw new Error(data.message || "讀取失敗");
  return data;
}

function languageText(lang) {
  return { zh: "中文", en: "English", ja: "日本語", ko: "한국어", es: "Español" }[lang] || "中文";
}

function styleToAvatar(style) {
  return `style:${JSON.stringify(style)}`;
}

function parseAvatar(value) {
  const avatar = String(value || "");
  if (avatar.startsWith("style:")) {
    try {
      return { kind: "style", style: { ...DEFAULT_STYLE, ...JSON.parse(avatar.slice(6)) } };
    } catch {
      return { kind: "style", style: { ...DEFAULT_STYLE } };
    }
  }
  return avatar ? { kind: "image", src: avatar } : { kind: "style", style: { ...DEFAULT_STYLE } };
}

function avatarMarkup(value, sizeClass = "") {
  const parsed = parseAvatar(value);
  if (parsed.kind === "image") return `<img class="${sizeClass}" src="${escapeHtml(parsed.src)}" alt="">`;
  const style = parsed.style;
  return `
    <div class="profile-composite-avatar ${sizeClass}">
      <img class="avatar-layer avatar-face" src="${escapeHtml(style.face || DEFAULT_STYLE.face)}" alt="">
      <img class="avatar-layer avatar-hair" src="${escapeHtml(style.hair || DEFAULT_STYLE.hair)}" alt="">
      <img class="avatar-layer avatar-eyes" src="${escapeHtml(style.eyes || DEFAULT_STYLE.eyes)}" style="transform:translate(-50%, calc(-50% + ${Number(style.eyeOffset || 0)}px));" alt="">
    </div>
  `;
}

function syncAvatarPreview() {
  nextAvatar = styleToAvatar(avatarStyle);
  $("profileAvatarPreview").innerHTML = avatarMarkup(nextAvatar, "large");
  $("profileHeroAvatar").innerHTML = avatarMarkup(nextAvatar, "small");
  $("eyeOffsetSlider").value = String(avatarStyle.eyeOffset || 0);
}

function renderUploadedAvatar(src) {
  nextAvatar = src;
  $("profileAvatarPreview").innerHTML = `<img class="profile-upload-preview" src="${escapeHtml(src)}" alt="">`;
  $("profileHeroAvatar").innerHTML = `<img src="${escapeHtml(src)}" alt="">`;
}

function renderProfile(profile) {
  profileState = profile;
  const parsed = parseAvatar(profile.avatar || "");
  if (parsed.kind === "style") {
    avatarStyle = { ...DEFAULT_STYLE, ...parsed.style };
    syncAvatarPreview();
  } else {
    renderUploadedAvatar(parsed.src);
  }

  $("profileUsername").textContent = profile.username || "-";
  $("profileDisplayTitle").textContent = profile.displayTitle || "新手挑戰者";
  $("profileWins").textContent = String(profile.wins || 0);
  const level = profile.level || {};
  let dailyReward = {};
  try { dailyReward = JSON.parse(localStorage.getItem(`quizarena_daily_reward_${profile.username}`) || "{}"); } catch {}
  const dailyExp = Number(dailyReward.exp || 0);
  const totalXp = Number(level.xp || 0) + dailyExp;
  const computedLevel = Math.max(Number(level.level || 1), Math.floor(totalXp / 180) + 1);
  const currentLevelXp = totalXp % 180;
  $("profileLevel").textContent = `Lv.${computedLevel}`;
  $("profileDailyExp").textContent = `${dailyExp} EXP`;
  $("profileXpText").textContent = `${currentLevelXp} / 180 XP`;
  $("profileLevelBar").style.width = `${Math.min(100, Math.round((currentLevelXp / 180) * 100))}%`;
  $("profileLanguageSelect").value = profile.language || "zh";
  $("profileCountySelect").value = profile.county || "";
  $("profileLocationChip").textContent = profile.county || "尚未設定所在地";
  $("profileCategoryChip").textContent = profile.displayTitle || "尚未設定常玩分類";

  const summary = profile.achievements || {};
  $("profileAchievementCount").textContent = `已獲得:${Number(summary.unlockedCount || 0)}`;
  $("profileAchievementBadge").textContent = `已獲得 ${Number(summary.unlockedCount || 0)} 項`;
  const unlocked = (summary.achievements || []).filter((item) => item.unlocked);
  $("profileAchievementsList").innerHTML = unlocked.length ? unlocked.map((item) => `
    <article class="profile-achievement-card">
      <i class="fa-solid ${escapeHtml(item.icon || "fa-award")}"></i>
      <div>
        <strong>${escapeHtml(item.title)}</strong>
        <span>${escapeHtml(item.description)}</span>
      </div>
    </article>
  `).join("") : `
    <article class="profile-achievement-card is-empty">
      <i class="fa-solid fa-seedling"></i>
      <div><strong>還沒有解鎖成就</strong><span>完成對戰、交朋友、複習錯題都能推進成就。</span></div>
    </article>
  `;

  const currentTitle = profile.displayTitle || "新手挑戰者";
  const dailyTitle = localStorage.getItem(`quizarena_daily_title_${profile.username || ""}`) || "";
  const titleOptions = [...(profile.titleOptions || [])];
  if (dailyTitle && !titleOptions.some((item) => item.id === dailyTitle)) {
    titleOptions.push({ id: dailyTitle, label: dailyTitle });
  }
  $("profileTitleList").innerHTML = titleOptions.map((title) => `
    <button type="button" class="profile-title-option ${title.id === currentTitle ? "active" : ""}" data-title="${escapeHtml(title.id)}">
      <strong>${escapeHtml(title.label)}</strong>
      <span>${title.id === currentTitle ? "使用中" : "點擊套用"}</span>
    </button>
  `).join("");
  document.querySelectorAll(".profile-title-option").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".profile-title-option").forEach((item) => item.classList.remove("active"));
      btn.classList.add("active");
      $("profileDisplayTitle").textContent = btn.dataset.title || "新手挑戰者";
      $("profileCategoryChip").textContent = btn.dataset.title || "尚未設定常玩分類";
    });
  });
}

async function loadProfile() {
  const username = localStorage.getItem("currentUser") || "";
  if (!username) {
    showToast("請先登入");
    setTimeout(() => { window.location.href = "index.html"; }, 900);
    return;
  }
  try {
    const data = await api(`/user_profile?username=${encodeURIComponent(username)}`);
    renderProfile(data.profile);
  } catch (error) {
    showToast(error.message);
  }
}

function handleAvatarFile(file) {
  if (!file) return;
  if (!/^image\/(png|jpeg|webp)$/.test(file.type)) {
    showToast("請選擇 PNG、JPG 或 WebP 圖片");
    return;
  }
  if (file.size > 320 * 1024) {
    showToast("圖片請小於 320KB，頭像載入會更快");
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    renderUploadedAvatar(String(reader.result || ""));
    showToast("頭像已預覽，記得確認更改");
  };
  reader.readAsDataURL(file);
}

function stepStyle(direction) {
  const list = activeMode === "hair" ? HAIRS : EYES;
  const key = activeMode === "hair" ? "hair" : "eyes";
  const current = list.indexOf(avatarStyle[key]);
  const next = (current + direction + list.length) % list.length;
  avatarStyle[key] = list[next];
  syncAvatarPreview();
}

async function saveProfile() {
  if (!profileState?.username) return;
  const activeTitle = document.querySelector(".profile-title-option.active")?.dataset.title || "新手挑戰者";
  try {
    const data = await api("/update_user_profile", {
      method: "POST",
      body: JSON.stringify({
        username: profileState.username,
        avatar: nextAvatar || styleToAvatar(avatarStyle),
        displayTitle: activeTitle,
        language: $("profileLanguageSelect").value,
        county: $("profileCountySelect").value,
      }),
    });
    localStorage.setItem("currentUserProfile", JSON.stringify(data.profile));
    if (window.I18N?.applyLang) window.I18N.applyLang(data.profile.language || "zh");
    renderProfile(data.profile);
    showToast("個人資料已儲存");
  } catch (error) {
    showToast(error.message);
  }
}

$("profileAvatarInput")?.addEventListener("change", (event) => handleAvatarFile(event.target.files?.[0]));
$("hairModeBtn")?.addEventListener("click", () => {
  activeMode = "hair";
  $("hairModeBtn").classList.add("active");
  $("eyesModeBtn").classList.remove("active");
});
$("eyesModeBtn")?.addEventListener("click", () => {
  activeMode = "eyes";
  $("eyesModeBtn").classList.add("active");
  $("hairModeBtn").classList.remove("active");
});
$("prevStyleBtn")?.addEventListener("click", () => stepStyle(-1));
$("nextStyleBtn")?.addEventListener("click", () => stepStyle(1));
$("eyeOffsetSlider")?.addEventListener("input", () => {
  avatarStyle.eyeOffset = Number($("eyeOffsetSlider").value || 0);
  syncAvatarPreview();
});
$("randomAvatarBtn")?.addEventListener("click", () => {
  avatarStyle = {
    ...DEFAULT_STYLE,
    hair: HAIRS[Math.floor(Math.random() * HAIRS.length)],
    eyes: EYES[Math.floor(Math.random() * EYES.length)],
    eyeOffset: Math.floor(Math.random() * 13) - 6,
  };
  syncAvatarPreview();
});
$("resetAvatarBtn")?.addEventListener("click", () => {
  avatarStyle = { ...DEFAULT_STYLE };
  syncAvatarPreview();
});
$("profileLanguageSelect")?.addEventListener("change", () => {
  const lang = $("profileLanguageSelect").value;
  if (window.I18N?.applyLang) window.I18N.applyLang(lang);
});
$("profileCountySelect")?.addEventListener("change", () => {
  $("profileLocationChip").textContent = $("profileCountySelect").value || "尚未設定所在地";
});
$("saveProfileBtn")?.addEventListener("click", saveProfile);
loadProfile();
