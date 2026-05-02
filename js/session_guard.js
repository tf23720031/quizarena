/**
 * QuizArena Session Guard
 * - Single account, single device login enforcement
 * - Conflict modal with device/IP info
 * - Guest identity lifecycle management
 * - Taiwan Taipei timezone display
 */

// ── Device ID ──────────────────────────────────────────────────────────
function getOrCreateDeviceId() {
  let did = localStorage.getItem('deviceId');
  if (!did) {
    did = 'dev_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9);
    localStorage.setItem('deviceId', did);
  }
  return did;
}

// ── Session Validation ─────────────────────────────────────────────────
let _sessionCheckInterval = null;

async function validateCurrentSession() {
  const username = localStorage.getItem('currentUser');
  const sessionToken = localStorage.getItem('sessionToken');
  if (!username || !sessionToken) return;

  try {
    const res = await fetch('/validate_session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username,
        sessionToken,
        deviceId: getOrCreateDeviceId(),
      }),
    });
    const data = await res.json();
    if (!data.valid) {
      showSessionConflictModal(data.conflict || {});
    }
  } catch (e) {
    // Network error — don't force logout (user might be offline)
    console.warn('[SessionGuard] validate failed:', e.message);
  }
}

function startSessionGuard() {
  // Validate immediately, then every 90 seconds
  validateCurrentSession();
  if (_sessionCheckInterval) clearInterval(_sessionCheckInterval);
  _sessionCheckInterval = setInterval(validateCurrentSession, 90_000);
}

// ── Conflict Modal ─────────────────────────────────────────────────────
function showSessionConflictModal(conflict) {
  // Remove any existing modal
  document.getElementById('qa-session-conflict-modal')?.remove();

  const modal = document.createElement('div');
  modal.id = 'qa-session-conflict-modal';
  modal.innerHTML = `
    <div style="
      position:fixed;inset:0;z-index:99999;
      background:rgba(20,5,40,.75);backdrop-filter:blur(8px);
      display:flex;align-items:center;justify-content:center;padding:20px;
    ">
      <div style="
        max-width:420px;width:100%;border-radius:28px;padding:32px;
        background:linear-gradient(145deg,rgba(255,255,255,.92),rgba(255,230,250,.88));
        box-shadow:0 32px 80px rgba(120,40,200,.30),inset 0 1px 0 rgba(255,255,255,.9);
        backdrop-filter:blur(20px);border:1.5px solid rgba(255,255,255,.8);
        text-align:center;
      ">
        <div style="font-size:2.5rem;margin-bottom:12px">⚠️</div>
        <h2 style="font-size:1.2rem;font-weight:900;color:#2d1550;margin:0 0 10px">帳號已在其他裝置登入</h2>
        <p style="font-size:.88rem;color:#6b4a90;line-height:1.65;margin-bottom:16px">
          你的帳號於以下裝置登入，請確認是否為本人操作。<br>
          若非本人，請立即變更密碼。
        </p>
        <div style="
          background:rgba(147,51,234,.07);border-radius:14px;padding:14px 18px;
          margin-bottom:20px;text-align:left;font-size:.84rem;color:#3a1a60;
        ">
          <div>📱 <strong>裝置：</strong>${conflict.conflicting_device || '未知裝置'}</div>
          <div>🌐 <strong>IP：</strong>${conflict.conflicting_ip || '未知 IP'}</div>
          <div>🕐 <strong>時間：</strong>${conflict.login_at || '未知'}</div>
        </div>
        <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap;">
          <button id="qa-conflict-logout" style="
            padding:11px 24px;border-radius:99px;border:none;cursor:pointer;
            background:linear-gradient(135deg,#9333ea,#c026d3);color:#fff;
            font-weight:800;font-size:.88rem;
            box-shadow:0 4px 16px rgba(147,51,234,.3);
          ">強制登出並重新登入</button>
          <button id="qa-conflict-stay" style="
            padding:11px 20px;border-radius:99px;
            border:1.5px solid rgba(147,51,234,.25);cursor:pointer;
            background:rgba(255,255,255,.7);color:#7c3aed;font-weight:800;font-size:.88rem;
          ">這是我，繼續使用</button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  document.getElementById('qa-conflict-logout').addEventListener('click', async () => {
    await doLogout();
    modal.remove();
    window.location.href = 'index.html';
  });

  document.getElementById('qa-conflict-stay').addEventListener('click', async () => {
    // Re-issue session token for this device
    modal.remove();
    await reissueSession();
  });
}

async function doLogout() {
  const username = localStorage.getItem('currentUser');
  try {
    await fetch('/logout_session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username }),
    });
  } catch {}
  clearLocalSession();
}

function clearLocalSession() {
  localStorage.removeItem('currentUser');
  localStorage.removeItem('sessionToken');
  localStorage.removeItem('currentUserProfile');
  localStorage.removeItem('qa_profile_cache');
}

async function reissueSession() {
  // Login again with stored credentials is not possible without password,
  // so we just force a fresh login
  await doLogout();
  window.location.href = 'index.html?reason=session_conflict';
}

// ── Guest Identity Lifecycle ───────────────────────────────────────────
const GUEST_PREFIX = 'guest_';

function isGuestSession() {
  const name = localStorage.getItem('roomPlayerName') || '';
  return name.startsWith(GUEST_PREFIX) || localStorage.getItem('isGuestSession') === '1';
}

function setGuestSession(playerName) {
  const guestId = GUEST_PREFIX + playerName.replace(/\s+/g, '_') + '_' + Date.now();
  localStorage.setItem('roomPlayerName', playerName);
  localStorage.setItem('guestSessionId', guestId);
  localStorage.setItem('isGuestSession', '1');
  // Never write to currentUser for guests
}

function clearGuestSession() {
  localStorage.removeItem('roomPlayerName');
  localStorage.removeItem('guestSessionId');
  localStorage.removeItem('isGuestSession');
  localStorage.removeItem('roomPin');
  localStorage.removeItem('roomPlayerProfile');
  console.log('[SessionGuard] Guest session cleared');
}

// Clear guest data when game ends or tab closes
window.addEventListener('beforeunload', () => {
  if (isGuestSession()) {
    // Use sendBeacon for reliable cleanup
    const pin = localStorage.getItem('roomPin');
    const name = localStorage.getItem('roomPlayerName');
    if (pin && name) {
      navigator.sendBeacon('/leave_room', JSON.stringify({ pin, playerName: name }));
    }
    clearGuestSession();
  }
});

// ── Taiwan Time Display ────────────────────────────────────────────────
function toTaipeiTimeStr(ts) {
  if (!ts) return '';
  const d = new Date(Number(ts) * 1000);
  return d.toLocaleString('zh-TW', {
    timeZone: 'Asia/Taipei',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
    hour12: false,
  });
}

function toTaipeiDateStr(ts) {
  if (!ts) return '';
  const d = new Date(Number(ts) * 1000);
  return d.toLocaleDateString('zh-TW', { timeZone: 'Asia/Taipei' });
}

// Expose globally
window.QASession = {
  getOrCreateDeviceId,
  validateCurrentSession,
  startSessionGuard,
  doLogout,
  clearLocalSession,
  isGuestSession,
  setGuestSession,
  clearGuestSession,
  toTaipeiTimeStr,
  toTaipeiDateStr,
};

// Auto-start if user is logged in (not a guest)
if (localStorage.getItem('currentUser') && !localStorage.getItem('isGuestSession')) {
  getOrCreateDeviceId(); // ensure device ID exists
  // Delay slightly so page JS initializes first
  setTimeout(startSessionGuard, 2000);
}

console.log('[SessionGuard] loaded. user:', localStorage.getItem('currentUser') || '(guest/none)');
