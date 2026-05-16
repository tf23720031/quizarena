// js/analytics-teacher.js

let currentRoomId = '';
let overviewData = null;
let classDistChart = null;
let weakBarChart = null;

// ── Utility ──────────────────────────────────────────────────────────────────
function escapeHtml(v) {
  return String(v ?? '')
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}
function cssEscapeValue(v) {
  if (window.CSS && typeof window.CSS.escape === 'function') return window.CSS.escape(String(v));
  return String(v).replace(/[^a-zA-Z0-9_-]/g, '\\$&');
}

const AVATARS = ['🧝','🧙','🦸','🧑‍🎓','🧑‍🏫','👨‍🔬','👩‍🔬','🦹','🧚','🧜','🧞','🎯'];
function getAvatar(name) {
  let h = 0;
  for (let i = 0; i < (name || '').length; i++) h = (Math.imul(h, 31) + name.charCodeAt(i)) | 0;
  return AVATARS[Math.abs(h) % AVATARS.length];
}
function rankBadge(rank) {
  if (rank === 1) return '🥇';
  if (rank === 2) return '🥈';
  if (rank === 3) return '🥉';
  return `#${rank}`;
}
function statusColor(status) {
  return status === 'good' ? '#34d399' : status === 'warning' ? '#fbbf24' : '#f87171';
}
function errorRateGrad(rate) {
  if (rate >= 70) return 'linear-gradient(90deg,#dc2626,#ef4444)';
  if (rate >= 40) return 'linear-gradient(90deg,#ea580c,#f97316)';
  return 'linear-gradient(90deg,#d97706,#fbbf24)';
}

// ── Room Picker & Init ───────────────────────────────────────────────────────
function syncReportPinAndLoad(roomId) {
  const pinInput = document.getElementById('reportPinInput');
  if (pinInput && /^\d{6}$/.test(roomId)) {
    pinInput.value = roomId;
    document.getElementById('loadReportBtn')?.click();
  }
}

function bindAnalyticsEvents() {
  const sel = document.getElementById('analytics-room-select');
  if (sel && !sel.dataset.analyticsBound) {
    sel.dataset.analyticsBound = '1';
    sel.addEventListener('change', () => {
      const roomId = sel.value || '';
      document.querySelectorAll('.analytics-empty').forEach(e => e.style.display = roomId ? 'none' : '');
      if (!roomId) return;
      analyticsLoadRoom(roomId);
      syncReportPinAndLoad(roomId);
    });
  }
  if (!document.documentElement.dataset.analyticsDelegated) {
    document.documentElement.dataset.analyticsDelegated = '1';
    document.addEventListener('click', (ev) => {
      const st = ev.target.closest('[data-analytics-student]');
      if (st) { showStudentDetail(st.dataset.analyticsStudent || ''); return; }
      const ai = ev.target.closest('[data-ai-student]');
      if (ai) { fetchAiSuggestion(ai.dataset.aiStudent || '', ai); return; }
      const cp = ev.target.closest('[data-copy-url]');
      if (cp) navigator.clipboard?.writeText(cp.dataset.copyUrl || '').then(() => { cp.textContent = '已複製'; });
    });
  }
}

function _setAnalyticsEmpty(tab, show, msg) {
  const el = document.querySelector(`.analytics-empty[data-empty-for="${tab}"]`);
  if (!el) return;
  el.style.display = show ? '' : 'none';
  if (msg) { const p = el.querySelector('p'); if (p) p.textContent = msg; }
}
function _hideAllAnalyticsEmpty() {
  document.querySelectorAll('.analytics-empty').forEach(e => e.style.display = 'none');
}
function _waitForChart(cb, maxTries) {
  let tries = 0;
  (function tick() {
    if (typeof window.Chart !== 'undefined') { cb(); return; }
    if (++tries > (maxTries || 60)) return;
    setTimeout(tick, 100);
  })();
}

async function initRoomSelector() {
  bindAnalyticsEvents();
  try {
    const res = await fetch('/api/recent-rooms');
    const data = await res.json();
    const sel = document.getElementById('analytics-room-select');
    if (!sel) return;
    const rooms = Array.isArray(data.rooms) ? data.rooms : [];
    if (!rooms.length) {
      const opt = document.createElement('option');
      opt.value = ''; opt.textContent = '沒有歷史房間，請用上方 PIN 載入'; opt.disabled = true;
      sel.appendChild(opt);
    }
    rooms.forEach(r => {
      const opt = document.createElement('option');
      opt.value = r.room_id;
      opt.textContent = `${r.room_name || r.room_id} (${(r.played_at || '').slice(0, 10)})`;
      sel.appendChild(opt);
    });
    const picker = document.querySelector('.analytics-room-picker');
    if (picker) picker.style.display = '';
  } catch (e) { console.warn('[teacher] initRoomSelector error:', e); }

  const params = new URLSearchParams(location.search);
  const rid = params.get('room_id') || '';
  if (rid) {
    const sel = document.getElementById('analytics-room-select');
    if (sel) sel.value = rid;
    analyticsLoadRoom(rid);
  }
}

async function analyticsLoadRoom(roomId) {
  if (!roomId) return;
  currentRoomId = roomId;
  window.analyticsCurrentRoomId = roomId;
  _hideAllAnalyticsEmpty();
  const overviewBtn = document.querySelector('.tab-btn[data-tab="overview"]') || document.querySelectorAll('.tab-btn')[0];
  switchTeacherTab('overview', overviewBtn);
  await loadOverview();
  loadWeakQuestions();
}

async function loadOverview() {
  if (!currentRoomId) return;
  try {
    const res = await fetch(`/api/teacher/overview/${currentRoomId}`);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    overviewData = await res.json();
    const students = overviewData?.students || [];
    if (!students.length) {
      ['overview','student','ai','parent'].forEach(t =>
        _setAnalyticsEmpty(t, true, '此房間尚無完整作答資料。'));
      return;
    }
    ['overview','student','ai','parent'].forEach(t => _setAnalyticsEmpty(t, false));
    renderClassStats(overviewData);
    renderStudentGrid(overviewData);
    populateStudentLists(overviewData);
  } catch (e) {
    console.error('[teacher] loadOverview error:', e);
    _setAnalyticsEmpty('overview', true, '載入失敗：' + e.message);
  }
}

// ── 班級總覽 ─────────────────────────────────────────────────────────────────
function renderClassStats(data) {
  const el = document.getElementById('class-stats-grid');
  if (!el) return;
  const students = data.students || [];
  const scores = students.map(s => s.score ?? 0);
  const maxScore = data.max_score ?? (scores.length ? Math.max(...scores) : 0);
  const minScore = data.min_score ?? (scores.length ? Math.min(...scores) : 0);
  const avgScore = data.avg_score ?? (scores.length ? Math.round(scores.reduce((a, v) => a + v, 0) / scores.length) : 0);
  const needsHelp = (data.needs_help || []).length;

  el.innerHTML = [
    { icon: '👥', label: '玩家人數',   value: data.total_students || 0,  color: '#f0abfc' },
    { icon: '📊', label: '平均分數',   value: Math.round(avgScore),       color: '#34d399' },
    { icon: '🎯', label: '平均答對率', value: `${data.avg_accuracy || 0}%`, color: '#60a5fa' },
    { icon: '🏆', label: '最高分',     value: maxScore,                   color: '#ffd700' },
    { icon: '📉', label: '最低分',     value: minScore,                   color: '#fb923c' },
    { icon: '⚠️', label: '需關注人數', value: needsHelp,                  color: '#f87171' },
  ].map(s => `
    <div class="stat-card">
      <div style="font-size:18px;margin-bottom:2px;">${s.icon}</div>
      <div class="stat-value" style="color:${s.color};font-size:24px;">${s.value}</div>
      <div class="stat-label">${s.label}</div>
    </div>`).join('');

  // Distribution chart
  const buckets = { '0–49': 0, '50–69': 0, '70–89': 0, '90–100': 0 };
  students.forEach(s => {
    const a = s.accuracy || 0;
    if (a < 50) buckets['0–49']++;
    else if (a < 70) buckets['50–69']++;
    else if (a < 90) buckets['70–89']++;
    else buckets['90–100']++;
  });
  const canvas = document.getElementById('class-dist-chart');
  if (!canvas) return;
  _waitForChart(() => {
    if (classDistChart) classDistChart.destroy();
    classDistChart = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: Object.keys(buckets),
        datasets: [{ label: '人數', data: Object.values(buckets), borderRadius: 6, borderWidth: 0,
          backgroundColor: ['rgba(248,113,113,0.75)','rgba(251,191,36,0.75)','rgba(96,165,250,0.75)','rgba(52,211,153,0.75)'] }],
      },
      options: {
        animation: { duration: 600 },
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: '#a78bfa' }, grid: { color: 'rgba(139,92,246,0.1)' } },
          y: { min: 0, ticks: { color: '#a78bfa', stepSize: 1 }, grid: { color: 'rgba(139,92,246,0.1)' } },
        },
      },
    });
  });
}

// ── 學生分數一覽（mini cards）────────────────────────────────────────────────
function renderStudentGrid(data) {
  const el = document.getElementById('student-grid');
  if (!el) return;
  const students = data.students || [];
  el.innerHTML = students.map((s, i) => {
    const color = statusColor(s.status);
    const avatar = getAvatar(s.player_name);
    const badge = rankBadge(s.rank || (i + 1));
    const guestTag = s.is_guest
      ? '<span class="teacher-badge guest-badge">訪客</span>'
      : '<span class="teacher-badge login-badge">已登入</span>';
    return `<div class="student-mini-card" data-analytics-student="${escapeHtml(s.player_name)}"
        style="border-color:${color}55;">
      <div class="smc-top">
        <span class="smc-rank">${badge}</span>${guestTag}
      </div>
      <div class="smc-avatar">${avatar}</div>
      <div class="smc-name">${escapeHtml(s.player_name)}</div>
      <div class="smc-score" style="color:${color};">${s.score ?? 0} 分</div>
      <div class="smc-acc" style="color:${color};">${s.accuracy}%</div>
    </div>`;
  }).join('');
}

// ── 側欄清單 / AI卡片 / 家長選單 ────────────────────────────────────────────
function populateStudentLists(data) {
  const students = data.students || [];

  const listEl = document.getElementById('student-list');
  if (listEl) {
    listEl.innerHTML = students.map(s => {
      const color = statusColor(s.status);
      const guestIcon = s.is_guest ? ' 👤' : ' ✅';
      return `<div class="student-list-item" data-analytics-student="${escapeHtml(s.player_name)}"
        style="border-left-color:${color};">
        <div class="sli-name">${escapeHtml(s.player_name)}${guestIcon}</div>
        <div class="sli-stats" style="color:${color};">${s.accuracy}% · ${s.score ?? 0} 分</div>
      </div>`;
    }).join('');
  }

  const sel = document.getElementById('parent-student-select');
  if (sel) {
    while (sel.options.length > 1) sel.remove(1);
    students.forEach(s => {
      const opt = document.createElement('option');
      opt.value = s.player_name;
      opt.textContent = s.is_guest ? `${s.player_name} (訪客)` : s.player_name;
      sel.appendChild(opt);
    });
  }

  const aiEl = document.getElementById('ai-cards-container');
  if (aiEl) {
    aiEl.innerHTML = students.map(s => {
      const avatar = getAvatar(s.player_name);
      const color = statusColor(s.status);
      const guestTag = s.is_guest ? ' <span class="teacher-badge guest-badge">訪客</span>' : '';
      return `<div class="ai-student-card glass-card">
        <div class="ai-card-header">
          <span class="ai-avatar">${avatar}</span>
          <div class="ai-info">
            <div class="ai-name">${escapeHtml(s.player_name)}${guestTag}</div>
            <div class="ai-acc" style="color:${color};">正確率 ${s.accuracy}% · ${s.score ?? 0} 分</div>
          </div>
          <button class="btn-ai-gen" data-ai-student="${escapeHtml(s.player_name)}">✨ 生成建議</button>
        </div>
        <div class="ai-result-box" data-ai-result="${escapeHtml(s.player_name)}"></div>
      </div>`;
    }).join('');
  }
}

// ── 個別學生詳情 ──────────────────────────────────────────────────────────────
async function showStudentDetail(playerName) {
  switchTeacherTab('student', document.querySelectorAll('.tab-btn')[1]);
  const panel = document.getElementById('student-detail-panel');
  if (!panel) return;
  panel.innerHTML = '<p style="color:#a78bfa;text-align:center;padding:20px;">載入中...</p>';
  try {
    const res = await fetch(`/api/teacher/student/${currentRoomId}/${encodeURIComponent(playerName)}`);
    const s = await res.json();
    if (!res.ok) throw new Error(s.error || `HTTP ${res.status}`);

    const avatar = getAvatar(s.student_name);
    const acc = Number(s.accuracy || 0);
    const color = acc >= 70 ? '#34d399' : acc >= 50 ? '#fbbf24' : '#f87171';
    const currentUser = localStorage.getItem('currentUser') || localStorage.getItem('playerName') || '';

    let actionBtns = '';
    if (s.is_guest) {
      actionBtns = `<div style="margin-top:8px;"><span class="teacher-badge guest-badge" style="font-size:12px;padding:4px 12px;">👤 訪客玩家（未登入帳號）</span></div>`;
    } else if (s.student_name !== currentUser) {
      const uname = encodeURIComponent(s.username || s.student_name);
      actionBtns = `<div class="sd-actions">
        <a href="profile.html?user=${uname}" target="_blank" class="btn-action btn-profile">👤 查看個人資料</a>
        <button class="btn-action btn-friend" onclick="window.sendFriendReq('${escapeHtml(s.username || s.student_name)}',this)">➕ 好友申請</button>
      </div>`;
    }

    const answers = s.raw_answers || [];
    const answersHtml = answers.length ? `
      <div style="margin-top:16px;">
        <div class="sd-section-title">📋 作答詳情</div>
        <div style="overflow-x:auto;">
          <table class="answer-detail-table">
            <thead><tr><th>題號</th><th>題目</th><th>結果</th><th>得分</th></tr></thead>
            <tbody>${answers.map(a => {
              const ok = a.correct || a.is_correct;
              const qLabel = a.seq != null ? `Q${Number(a.seq) + 1}` : (a.q_id || '?');
              return `<tr class="${ok ? 'row-ok' : 'row-wrong'}">
                <td>${qLabel}</td>
                <td class="td-title">${escapeHtml((a.title || '').slice(0, 60))}</td>
                <td>${ok ? '✅' : '❌'}</td>
                <td>${a.score ?? a.points_earned ?? 0}</td>
              </tr>`;
            }).join('')}</tbody>
          </table>
        </div>
      </div>` : '';

    panel.innerHTML = `
      <div class="student-detail-header">
        <span class="sd-avatar">${avatar}</span>
        <div style="flex:1;">
          <div class="sd-name">${escapeHtml(s.student_name)}</div>
          <div class="sd-rank">第 ${s.rank || '?'} 名 / 共 ${s.total_players || '?'} 人</div>
          ${actionBtns}
        </div>
      </div>
      <div class="stat-grid" style="margin:14px 0;">
        <div class="stat-card"><div class="stat-value" style="color:${color};">${acc}%</div><div class="stat-label">答對率</div></div>
        <div class="stat-card"><div class="stat-value" style="color:#60a5fa;">${Number(s.avg_speed_sec || 0).toFixed(1)}s</div><div class="stat-label">平均速度</div></div>
        <div class="stat-card"><div class="stat-value" style="color:#f0abfc;">${s.score ?? 0}</div><div class="stat-label">本場分數</div></div>
        <div class="stat-card"><div class="stat-value" style="color:#34d399;">${s.correct_count ?? 0}</div><div class="stat-label">答對題數</div></div>
      </div>
      ${(s.weak_subjects || []).length ? `
        <div style="margin-bottom:10px;">
          <span style="color:#a78bfa;font-size:12px;">弱點：</span>
          ${s.weak_subjects.map(w => `<span class="badge badge-red">${escapeHtml(w)}</span>`).join(' ')}
        </div>` : ''}
      ${answersHtml}`;
  } catch (e) {
    panel.innerHTML = `<p style="color:#f87171;text-align:center;padding:20px;">載入失敗：${escapeHtml(e.message)}</p>`;
  }
}

window.sendFriendReq = async function(username, btn) {
  const me = localStorage.getItem('currentUser') || '';
  if (!me) { alert('請先登入才能送出好友申請'); return; }
  btn.disabled = true;
  try {
    const res = await fetch('/send_friend_request', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sender: me, receiver: username }),
    });
    const d = await res.json();
    btn.textContent = (d.success || !d.error) ? '✅ 已送出' : '已申請或已是好友';
  } catch { btn.textContent = '送出失敗'; btn.disabled = false; }
};

// ── 弱題分析 ─────────────────────────────────────────────────────────────────
async function loadWeakQuestions() {
  if (!currentRoomId) return;
  try {
    const res = await fetch(`/api/teacher/weak-questions/${currentRoomId}`);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    const questions = data.questions || [];

    if (!questions.length) {
      _setAnalyticsEmpty('weak', true, '此房間尚無完整作答資料。');
      const listEl = document.getElementById('weak-detail-list');
      if (listEl) listEl.innerHTML = '';
      if (weakBarChart) { weakBarChart.destroy(); weakBarChart = null; }
      return;
    }
    _setAnalyticsEmpty('weak', false);

    const canvas = document.getElementById('weak-bar-chart');
    if (canvas) {
      _waitForChart(() => {
        if (weakBarChart) weakBarChart.destroy();
        const top10 = questions.slice(0, 10);
        weakBarChart = new Chart(canvas, {
          type: 'bar',
          data: {
            labels: top10.map(q => q.title ? `Q${(q.seq || 0) + 1} ${q.title}`.slice(0, 22) : `Q${(q.seq || 0) + 1}`),
            datasets: [{
              label: '錯誤率 %', borderWidth: 0, borderRadius: 4,
              data: top10.map(q => q.error_rate),
              backgroundColor: top10.map(q =>
                q.error_rate >= 70 ? 'rgba(220,38,38,0.85)' :
                q.error_rate >= 40 ? 'rgba(234,88,12,0.8)' : 'rgba(202,138,4,0.75)'),
            }],
          },
          options: {
            indexAxis: 'y', animation: { duration: 600 },
            plugins: { legend: { display: false } },
            scales: {
              x: { min: 0, max: 100, ticks: { color: '#a78bfa', callback: v => v + '%' }, grid: { color: 'rgba(139,92,246,0.1)' } },
              y: { ticks: { color: '#e9d5ff' }, grid: { display: false } },
            },
          },
        });
      });
    }

    const listEl = document.getElementById('weak-detail-list');
    if (listEl) {
      listEl.innerHTML = questions.map(q => {
        const seq = q.seq != null ? `Q${Number(q.seq) + 1}` : '';
        const label = q.title ? `${seq} ${escapeHtml(q.title)}` : `Q${(q.seq || 0) + 1} (${escapeHtml(q.q_id)})`;
        const rate = q.error_rate || 0;
        const wrongOpt = q.wrong_option
          ? `<span class="wqc-wrong-opt">最多人選錯：<strong>${escapeHtml(q.wrong_option)}</strong></span>`
          : '';
        const wrongPpl = (q.wrong_players || []).length
          ? `<span class="wqc-wrong-ppl">${q.wrong_players.slice(0, 4).map(p => escapeHtml(p)).join('、')}${q.wrong_players.length > 4 ? '…' : ''} 答錯</span>`
          : '';
        return `<div class="weak-q-card glass-card" data-question-index="${escapeHtml(String(q.q_id))}">
          <div class="wqc-header">
            <span class="wqc-label">${label}</span>
            <span class="wqc-rate" style="background:${rate>=70?'rgba(220,38,38,0.85)':rate>=40?'rgba(234,88,12,0.75)':'rgba(202,138,4,0.7)'}">
              ${rate}% 錯誤率
            </span>
          </div>
          <div class="wqc-bar-wrap">
            <div class="wqc-bar" style="width:${Math.min(100, rate)}%;background:${errorRateGrad(rate)};"></div>
          </div>
          <div class="wqc-footer">
            <span>答錯 ${q.wrong_count || 0} / ${q.answered_count || 0} 人</span>
            ${wrongOpt}${wrongPpl}
          </div>
        </div>`;
      }).join('');
      listEl.querySelectorAll('[data-question-index]').forEach(card => {
        card.style.cursor = 'pointer';
        card.addEventListener('click', () => {
          if (window.openTeacherQuestionDetail) window.openTeacherQuestionDetail(card.dataset.questionIndex || '');
        });
      });
    }
  } catch (e) {
    console.error('[teacher] loadWeakQuestions error:', e);
    _setAnalyticsEmpty('weak', true, '弱題分析載入失敗：' + e.message);
  }
}

// ── AI 建議 ──────────────────────────────────────────────────────────────────
async function fetchAiSuggestion(playerName, btn) {
  btn.disabled = true;
  btn.textContent = '生成中...';
  const resultEl = document.querySelector(`[data-ai-result="${cssEscapeValue(playerName)}"]`);
  if (resultEl) resultEl.innerHTML = '<span style="color:#a78bfa;font-size:13px;">🤖 AI 分析中，請稍候...</span>';
  try {
    const res = await fetch('/api/teacher/ai-suggestion', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ student_name: playerName, room_id: currentRoomId }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    const lines = (data.suggestion || '無法生成建議').split('\n').filter(Boolean);
    if (resultEl) {
      resultEl.innerHTML = `<div class="ai-suggestion-box">${lines.map(line => {
        const [head, ...rest] = line.split('】');
        if (rest.length && head.startsWith('【')) {
          return `<div class="ai-line"><span class="ai-line-head">${escapeHtml(head + '】')}</span>${escapeHtml(rest.join('】'))}</div>`;
        }
        return `<div class="ai-line">${escapeHtml(line)}</div>`;
      }).join('')}</div>`;
    }
    btn.textContent = '✅ 已生成';
  } catch (e) {
    if (resultEl) resultEl.innerHTML = `<span style="color:#f87171;font-size:13px;">錯誤：${escapeHtml(e.message)}</span>`;
    btn.disabled = false;
    btn.textContent = '重試';
  }
}

// ── 家長報告（內嵌列印）──────────────────────────────────────────────────────
async function generateParentReport() {
  const studentName = document.getElementById('parent-student-select')?.value;
  if (!studentName || !currentRoomId) { alert('請選擇學生及房間'); return; }
  const resultEl = document.getElementById('parent-report-result');
  if (resultEl) resultEl.innerHTML = '<p style="color:#a78bfa;padding:12px;">產生中...</p>';
  try {
    const res = await fetch('/api/teacher/parent-report-inline', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        student_name: studentName, room_id: currentRoomId,
        teacher_name: localStorage.getItem('currentUser') || localStorage.getItem('playerName') || '',
      }),
    });
    const d = await res.json();
    if (!res.ok) throw new Error(d.error || `HTTP ${res.status}`);
    if (resultEl) resultEl.innerHTML = _buildParentReportHtml(d);
  } catch (e) {
    if (resultEl) resultEl.innerHTML = `<p style="color:#f87171;">錯誤：${escapeHtml(e.message)}</p>`;
  }
}

function _buildParentReportHtml(d) {
  const now = new Date().toLocaleDateString('zh-TW');
  const rankTxt = d.rank ? `第 ${d.rank} 名 / 共 ${d.total_players} 人` : '—';
  const cs = d.class_stats || {};

  const weakRows = (d.weak_questions || []).slice(0, 6).map(q => {
    const seq = q.seq != null ? `Q${Number(q.seq) + 1}` : '';
    const title = q.title ? `${seq} ${escapeHtml(q.title)}` : seq;
    return `<tr><td>${title}</td><td>${q.error_rate || 0}%</td><td>${q.wrong_count || 0} 人</td></tr>`;
  }).join('');

  const aiHtml = d.ai_suggestion
    ? d.ai_suggestion.split('\n').filter(Boolean).map(l => {
        const [head, ...rest] = l.split('】');
        if (rest.length && head.startsWith('【')) {
          return `<li><strong>${escapeHtml(head + '】')}</strong>${escapeHtml(rest.join('】'))}</li>`;
        }
        return `<li>${escapeHtml(l)}</li>`;
      }).join('')
    : '<li>尚未生成 AI 建議，請至「AI 建議」頁籤先生成後再列印。</li>';

  return `
    <div id="parent-report-area" class="parent-report-wrap">
      <div class="pr-sheet">
        <div class="pr-header">
          <h1 class="pr-title">學生學習報告</h1>
          <p class="pr-meta">報告日期：${now}${d.teacher_name ? ` ‧ 老師：${escapeHtml(d.teacher_name)}` : ''}</p>
          <p class="pr-meta">房間：${escapeHtml(d.room_name || d.room_id || currentRoomId)}</p>
        </div>

        <div class="pr-section">
          <h2 class="pr-section-title">🧑‍🎓 學生基本資訊</h2>
          <table class="pr-table">
            <tr><th>姓名</th><td>${escapeHtml(d.student_name)}</td><th>本場分數</th><td>${d.score ?? 0} 分</td></tr>
            <tr><th>班級排名</th><td>${rankTxt}</td><th>答對率</th><td>${d.accuracy ?? 0}%（${d.correct_count ?? 0}/${(d.correct_count ?? 0) + (d.wrong_count ?? 0)} 題）</td></tr>
          </table>
        </div>

        <div class="pr-section">
          <h2 class="pr-section-title">📊 班級匿名比較</h2>
          <table class="pr-table">
            <tr><th>班級人數</th><td>${cs.total_players ?? '—'} 人</td><th>班級平均分數</th><td>${cs.avg_score ?? '—'}</td></tr>
            <tr><th>班級最高分</th><td>${cs.max_score ?? '—'}</td><th>班級平均答對率</th><td>${cs.avg_accuracy ?? '—'}%</td></tr>
          </table>
        </div>

        ${weakRows ? `<div class="pr-section">
          <h2 class="pr-section-title">🎯 弱題分析（需加強）</h2>
          <table class="pr-table">
            <thead><tr><th>題目</th><th>錯誤率</th><th>答錯人數</th></tr></thead>
            <tbody>${weakRows}</tbody>
          </table>
        </div>` : ''}

        <div class="pr-section">
          <h2 class="pr-section-title">🧠 AI 個人化學習建議</h2>
          <ul class="pr-list">${aiHtml}</ul>
        </div>

        <div class="pr-section">
          <h2 class="pr-section-title">💡 家長可協助方式</h2>
          <ul class="pr-list">
            <li>每天陪孩子複習 15–20 分鐘，優先聚焦上方弱題。</li>
            <li>鼓勵孩子對答錯的題目重新思考，並試著解釋給家長聽。</li>
            <li>若答題速度偏慢，可利用計時練習培養反應力。</li>
            <li>給予正向鼓勵，避免過度施壓，讓孩子保持學習熱情。</li>
          </ul>
        </div>

        <div class="pr-footer">本報告由 QuizArena 老師模式自動生成，班級排名均已匿名處理，僅供家長參考。</div>
      </div>
    </div>
    <div class="pr-actions">
      <button onclick="window.print()" class="tool-btn primary"><i class="fa-solid fa-print"></i> 列印 / 存 PDF</button>
    </div>`;
}

// ── Tab ──────────────────────────────────────────────────────────────────────
function switchTeacherTab(name, btn) {
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  const panel = document.getElementById(`tab-${name}`);
  if (panel) panel.classList.add('active');
  if (btn) btn.classList.add('active');
  if (name === 'weak') loadWeakQuestions();
}

window.analyticsLoadRoom = analyticsLoadRoom;
window.switchTeacherTab = switchTeacherTab;
window.generateParentReport = generateParentReport;
window.fetchAiSuggestion = fetchAiSuggestion;
window.showStudentDetail = showStudentDetail;

initRoomSelector();
