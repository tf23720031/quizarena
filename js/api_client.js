/**
 * QuizArena API Client
 * Centralised fetch wrapper for all persistent data.
 * Uses DB as source of truth; localStorage only as cache.
 * ────────────────────────────────────────────────────────
 */

const QA = window.QA || {};
window.QA = QA;

// ── Auth helpers ─────────────────────────────────────────────────────
QA.getUsername = function () {
  const direct = (localStorage.getItem('currentUser') || sessionStorage.getItem('currentUser') || '').trim();
  if (direct) return direct;
  try {
    const p = JSON.parse(localStorage.getItem('currentUserProfile') || 'null');
    return (p?.username || '').trim();
  } catch { return ''; }
};

// ── Generic fetch ────────────────────────────────────────────────────
QA.api = async function (url, options = {}) {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const data = await res.json();
  if (!res.ok || data.success === false) throw new Error(data.message || '請求失敗');
  return data;
};

// ── Profile ──────────────────────────────────────────────────────────
QA.loadProfile = async function () {
  const u = QA.getUsername();
  if (!u) return null;
  try {
    const data = await QA.api(`/api/profile?username=${encodeURIComponent(u)}`);
    localStorage.setItem('qa_profile_cache', JSON.stringify(data.profile));
    return data.profile;
  } catch {
    const cached = localStorage.getItem('qa_profile_cache');
    return cached ? JSON.parse(cached) : null;
  }
};

QA.patchProfile = async function (updates) {
  const u = QA.getUsername();
  if (!u) return;
  updates.username = u;
  await QA.api('/api/profile', { method: 'PATCH', body: JSON.stringify(updates) });
  // Update cache
  try {
    const cached = JSON.parse(localStorage.getItem('qa_profile_cache') || '{}');
    Object.assign(cached, updates);
    localStorage.setItem('qa_profile_cache', JSON.stringify(cached));
  } catch {}
};

// ── Quiz Banks ───────────────────────────────────────────────────────
QA.loadMyBanks = async function () {
  const u = QA.getUsername();
  if (!u) return [];
  try {
    const data = await QA.api(`/load_quiz_banks?username=${encodeURIComponent(u)}`);
    const banks = data.quizBanks || [];
    localStorage.setItem('qa_banks_cache', JSON.stringify(banks));
    return banks;
  } catch {
    const cached = localStorage.getItem('qa_banks_cache');
    return cached ? JSON.parse(cached) : [];
  }
};

QA.saveBank = async function (bank) {
  const u = QA.getUsername();
  if (!u) return;
  // Save via existing endpoint
  const existing = await QA.loadMyBanks();
  const idx = existing.findIndex(b => b.id === bank.id);
  if (idx >= 0) existing[idx] = bank; else existing.push(bank);
  await QA.api('/save_quiz_banks', {
    method: 'POST',
    body: JSON.stringify({ username: u, quizBanks: existing.filter(b => !b.isSystem && !b.isWrongBook) }),
  });
  localStorage.setItem('qa_banks_cache', JSON.stringify(existing));
};

// ── Story Progress ───────────────────────────────────────────────────
QA.loadStoryProgress = async function () {
  const u = QA.getUsername();
  if (!u) return [];
  try {
    const data = await QA.api(`/api/story/progress?username=${encodeURIComponent(u)}`);
    localStorage.setItem('qa_story_progress_cache', JSON.stringify(data.progress || []));
    return data.progress || [];
  } catch {
    const cached = localStorage.getItem('qa_story_progress_cache');
    return cached ? JSON.parse(cached) : [];
  }
};

QA.saveStoryProgress = async function (bankId, cleared, currentLevel, totalScore, completed) {
  const u = QA.getUsername();
  if (!u) return;
  const payload = {
    username: u,
    quiz_bank_id: bankId,
    cleared_levels: cleared,
    current_level: currentLevel,
    total_score: totalScore || 0,
    completed: !!completed,
    story_mode_type: 'solo',
  };
  try {
    await QA.api('/api/story/progress', { method: 'POST', body: JSON.stringify(payload) });
  } catch (e) {
    console.warn('[QA] story progress save failed:', e.message);
    // Fallback to localStorage
    const cacheKey = `quizarena_story_progress_${u}`;
    try {
      const prog = JSON.parse(localStorage.getItem(cacheKey) || '{}');
      prog[`custom:${bankId}:solo`] = cleared;
      localStorage.setItem(cacheKey, JSON.stringify(prog));
    } catch {}
  }
};

// ── Wrong Book ───────────────────────────────────────────────────────
QA.loadWrongBook = async function () {
  const u = QA.getUsername();
  if (!u) return { items: [], totalWrongCount: 0 };
  try {
    const data = await QA.api(`/wrong_book_summary?username=${encodeURIComponent(u)}`);
    return data;
  } catch {
    return { items: [], totalWrongCount: 0 };
  }
};

QA.addWrongAnswer = async function (stage, subjectTitle, extra = {}) {
  const u = QA.getUsername();
  if (!stage) return;
  const payload = {
    username: u || 'guest',
    sourceTitle: `故事模式 - ${subjectTitle}`,
    question: stage,
    story_chapter: extra.chapter || '',
    story_level: extra.level || 0,
    user_answer_index: extra.userAnswer ?? -1,
  };
  try {
    await QA.api('/story_wrong_question', { method: 'POST', body: JSON.stringify(payload) });
  } catch {
    // localStorage fallback
    if (!u) return;
    try {
      const key = `quizarena_wrong_book_${u}`;
      const book = JSON.parse(localStorage.getItem(key) || '[]');
      const ei = book.findIndex(i => i.q === stage.q);
      if (ei >= 0) {
        book[ei].wrongCount = (book[ei].wrongCount || 1) + 1;
        book[ei].lastWrongAt = Date.now();
      } else {
        book.push({
          q: stage.q, options: stage.options, answer: stage.answer,
          difficulty: stage.difficulty || 'medium',
          source: `故事模式 · ${subjectTitle}`,
          wrongCount: 1, lastWrongAt: Date.now(),
        });
      }
      localStorage.setItem(key, JSON.stringify(book));
    } catch {}
  }
};

// ── Achievements ─────────────────────────────────────────────────────
QA.loadAchievements = async function () {
  const u = QA.getUsername();
  if (!u) return { achievements: [], unlockedCount: 0 };
  try {
    const data = await QA.api(`/achievements_summary?username=${encodeURIComponent(u)}`);
    localStorage.setItem('qa_ach_cache', JSON.stringify(data));
    return data;
  } catch {
    const cached = localStorage.getItem('qa_ach_cache');
    return cached ? JSON.parse(cached) : { achievements: [], unlockedCount: 0 };
  }
};

QA.syncAchievement = async function (achievementId) {
  const u = QA.getUsername();
  if (!u) return;
  try {
    await QA.api('/api/achievements/sync', {
      method: 'POST',
      body: JSON.stringify({ username: u, achievement_id: achievementId }),
    });
  } catch (e) {
    console.warn('[QA] achievement sync failed:', e.message);
  }
};

QA.updateShowcase = async function (showcaseIds) {
  const u = QA.getUsername();
  if (!u) return;
  await QA.api('/api/achievements/showcase', {
    method: 'PATCH',
    body: JSON.stringify({ username: u, showcase_ids: showcaseIds }),
  });
};

// ── Daily Mission ────────────────────────────────────────────────────
QA.loadDailyMission = async function () {
  const u = QA.getUsername();
  if (!u) return null;
  try {
    return await QA.api(`/daily_mission_status?username=${encodeURIComponent(u)}`);
  } catch {
    return null;
  }
};

// ── Room History ─────────────────────────────────────────────────────
QA.loadRoomHistory = async function () {
  const u = QA.getUsername();
  if (!u) return [];
  try {
    const data = await QA.api(`/api/rooms/history?username=${encodeURIComponent(u)}`);
    return data.rooms || [];
  } catch {
    return [];
  }
};

// ── Marketplace ──────────────────────────────────────────────────────
QA.copyMarketplaceBank = async function (bankId) {
  const u = QA.getUsername();
  if (!u) throw new Error('請先登入');
  const data = await QA.api('/api/marketplace/copy', {
    method: 'POST',
    body: JSON.stringify({ username: u, bank_id: bankId }),
  });
  // Also update local cache
  const existing = await QA.loadMyBanks().catch(() => []);
  existing.push(data.bank);
  localStorage.setItem('qa_banks_cache', JSON.stringify(existing));
  return data;
};

QA.publishToMarketplace = async function (bank) {
  const u = QA.getUsername();
  if (!u) throw new Error('請先登入');
  return QA.api('/api/marketplace/publish', {
    method: 'POST',
    body: JSON.stringify({ username: u, bank }),
  });
};

// ── Account Status ───────────────────────────────────────────────────
QA.getAccountStatus = async function () {
  const u = QA.getUsername();
  if (!u) return 'guest';
  try {
    const data = await QA.api(`/api/account/status?username=${encodeURIComponent(u)}`);
    return data.status;
  } catch {
    return 'active';
  }
};

// ── Login hook: update last_login_at ─────────────────────────────────
QA.onLogin = async function (username) {
  try {
    await QA.api('/api/profile', {
      method: 'PATCH',
      body: JSON.stringify({ username, last_login_at: Math.floor(Date.now() / 1000) }),
    });
  } catch {}
};

console.log('[QA] api_client loaded. user:', QA.getUsername() || '(not logged in)');
