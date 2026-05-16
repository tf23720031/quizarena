// js/analytics-teacher.js

let currentRoomId = '';
let overviewData = null;
let classDistChart = null;
let weakBarChart = null;

function escapeHtml(v) {
  return String(v ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function cssEscapeValue(v) {
  if (window.CSS && typeof window.CSS.escape === 'function') return window.CSS.escape(String(v));
  return String(v).replace(/[^a-zA-Z0-9_-]/g, '\\$&');
}

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
    document.addEventListener('click', (event) => {
      const studentTarget = event.target.closest('[data-analytics-student]');
      if (studentTarget) {
        showStudentDetail(studentTarget.dataset.analyticsStudent || '');
        return;
      }
      const aiTarget = event.target.closest('[data-ai-student]');
      if (aiTarget) {
        fetchAiSuggestion(aiTarget.dataset.aiStudent || '', aiTarget);
        return;
      }
      const copyTarget = event.target.closest('[data-copy-url]');
      if (copyTarget) {
        navigator.clipboard?.writeText(copyTarget.dataset.copyUrl || '').then(() => {
          copyTarget.textContent = '已複製';
        });
      }
    });
  }
}

// ── 空狀態 / 錯誤狀態小工具 ──────────────────────────────────────────
function _setAnalyticsEmpty(tab, show, msg) {
  const el = document.querySelector(`.analytics-empty[data-empty-for="${tab}"]`);
  if (!el) return;
  el.style.display = show ? '' : 'none';
  if (msg) {
    const p = el.querySelector('p');
    if (p) p.textContent = msg;
  }
}
function _hideAllAnalyticsEmpty() {
  document.querySelectorAll('.analytics-empty').forEach(e => e.style.display = 'none');
}

// 等 Chart.js 載入完成才繼續（避免 new Chart 時還沒定義）
function _waitForChart(cb, maxTries) {
  let tries = 0;
  (function tick() {
    if (typeof window.Chart !== 'undefined') { cb(); return; }
    if (++tries > (maxTries || 60)) return; // ~6s
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
      opt.value = '';
      opt.textContent = '沒有歷史房間，請用上方 PIN 載入';
      opt.disabled = true;
      sel.appendChild(opt);
    }
    rooms.forEach(r => {
      const opt = document.createElement('option');
      opt.value = r.room_id;
      opt.textContent = `${r.room_name || r.room_id} (${(r.played_at || '').slice(0, 10)})`;
      sel.appendChild(opt);
    });
  } catch (e) {
    console.warn('[teacher] initRoomSelector error:', e);
  }

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
  // 切換到班級總覽頁籤
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
    if (!overviewData || !(overviewData.students || []).length) {
      _setAnalyticsEmpty('overview', true, '這個房間目前沒有學生資料。');
      _setAnalyticsEmpty('student', true, '這個房間目前沒有學生資料。');
      _setAnalyticsEmpty('ai', true, '這個房間目前沒有學生資料。');
      _setAnalyticsEmpty('parent', true, '這個房間目前沒有學生資料。');
      return;
    }
    renderClassStats(overviewData);
    renderStudentGrid(overviewData);
    populateStudentLists(overviewData);
  } catch (e) {
    console.error('[teacher] loadOverview error:', e);
    _setAnalyticsEmpty('overview', true, '載入失敗：' + e.message);
  }
}

function renderClassStats(data) {
  const el = document.getElementById('class-stats-grid');
  if (!el) return;
  el.innerHTML = [
    { label: '學生人數',   value: data.total_students || 0,       color: '#f0abfc' },
    { label: '平均正確率', value: `${data.avg_accuracy || 0}%`,   color: '#34d399' },
    { label: '平均速度',   value: `${data.avg_speed || 0}s`,      color: '#60a5fa' },
    { label: '需輔導人數', value: (data.needs_help || []).length,  color: '#f87171' },
  ].map(s => `
    <div class="stat-card">
      <div class="stat-value" style="color:${s.color};">${s.value}</div>
      <div class="stat-label">${s.label}</div>
    </div>
  `).join('');

  const students = data.students || [];
  const buckets = { '0-49': 0, '50-69': 0, '70-89': 0, '90-100': 0 };
  students.forEach(s => {
    const a = s.accuracy;
    if (a < 50) buckets['0-49']++;
    else if (a < 70) buckets['50-69']++;
    else if (a < 90) buckets['70-89']++;
    else buckets['90-100']++;
  });

  const canvas = document.getElementById('class-dist-chart');
  if (!canvas) return;
  _waitForChart(() => {
    if (classDistChart) classDistChart.destroy();
    classDistChart = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: Object.keys(buckets),
        datasets: [{
          label: '人數',
          data: Object.values(buckets),
          backgroundColor: ['rgba(248,113,113,0.7)','rgba(251,191,36,0.7)','rgba(96,165,250,0.7)','rgba(52,211,153,0.7)'],
          borderWidth: 0,
        }],
      },
      options: {
        animation: { duration: 600 },
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: '#a78bfa' }, grid: { color: 'rgba(139,92,246,0.1)' } },
          y: { ticks: { color: '#a78bfa', stepSize: 1 }, grid: { color: 'rgba(139,92,246,0.1)' } },
        },
      },
    });
  });
}

function renderStudentGrid(data) {
  const el = document.getElementById('student-grid');
  if (!el) return;
  const students = data.students || [];
  el.innerHTML = students.map(s => {
    const color = s.status === 'good' ? '#34d399' : s.status === 'warning' ? '#fbbf24' : '#f87171';
    return `<div data-analytics-student="${escapeHtml(s.player_name)}" style="
      background:rgba(139,92,246,0.08);border:1px solid ${color}40;border-radius:10px;
      padding:12px;text-align:center;cursor:pointer;transition:all 0.2s;
    " onmouseover="this.style.borderColor='${color}'" onmouseout="this.style.borderColor='${color}40'">
      <div style="font-size:24px;margin-bottom:4px;">🧝</div>
      <div style="font-size:12px;font-weight:600;color:#e9d5ff;margin-bottom:4px;">${escapeHtml(s.player_name)}</div>
      <div style="font-size:11px;color:${color};">${s.accuracy}%</div>
    </div>`;
  }).join('');
}

function populateStudentLists(data) {
  const students = data.students || [];

  const listEl = document.getElementById('student-list');
  if (listEl) {
    listEl.innerHTML = students.map(s => {
      const color = s.status === 'good' ? '#34d399' : s.status === 'warning' ? '#fbbf24' : '#f87171';
      return `<div data-analytics-student="${escapeHtml(s.player_name)}"
        style="padding:8px 10px;border-radius:8px;cursor:pointer;margin-bottom:4px;border-left:3px solid ${color};background:rgba(139,92,246,0.05);">
        <div style="font-size:13px;">${escapeHtml(s.player_name)}</div>
        <div style="font-size:11px;color:${color};">${s.accuracy}%</div>
      </div>`;
    }).join('');
  }

  const sel = document.getElementById('parent-student-select');
  if (sel) {
    while (sel.options.length > 1) sel.remove(1);
    students.forEach(s => {
      const opt = document.createElement('option');
      opt.value = s.player_name;
      opt.textContent = s.player_name;
      sel.appendChild(opt);
    });
  }

  const aiEl = document.getElementById('ai-cards-container');
  if (aiEl) {
    aiEl.innerHTML = students.map(s => `
      <div class="glass-card" style="margin-bottom:12px;">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">
          <span style="font-size:20px;">🧝</span>
          <div>
            <div style="font-size:14px;font-weight:600;">${escapeHtml(s.player_name)}</div>
            <div style="font-size:12px;color:#a78bfa;">正確率 ${s.accuracy}%</div>
          </div>
          <button data-ai-student="${escapeHtml(s.player_name)}"
            style="margin-left:auto;background:rgba(124,58,237,0.3);border:1px solid #7c3aed;color:#e9d5ff;padding:5px 12px;border-radius:6px;cursor:pointer;font-size:12px;">
            生成建議
          </button>
        </div>
        <div data-ai-result="${escapeHtml(s.player_name)}" style="font-size:13px;color:#a78bfa;white-space:pre-line;"></div>
      </div>
    `).join('');
  }
}

async function showStudentDetail(playerName) {
  switchTeacherTab('student', document.querySelectorAll('.tab-btn')[1]);

  const panel = document.getElementById('student-detail-panel');
  if (!panel) return;
  panel.innerHTML = '<p style="color:#6d28d9;text-align:center;padding:20px;">載入中...</p>';

  try {
    const res = await fetch(`/api/teacher/student/${currentRoomId}/${encodeURIComponent(playerName)}`);
    const s = await res.json();
    if (!res.ok) throw new Error(s.error || `HTTP ${res.status}`);

    const weakHTML = s.weak_subjects?.length
      ? s.weak_subjects.map(w => `<span class="badge badge-red">${w}</span>`).join(' ')
      : '<span style="color:#34d399;font-size:13px;">無明顯弱科 ✓</span>';

    const subjHTML = Object.entries(s.subject_scores || {}).map(([subj, score]) => `
      <div style="margin-bottom:8px;">
        <div style="display:flex;justify-content:space-between;margin-bottom:3px;">
          <span style="font-size:13px;">${subj}</span>
          <span style="color:#f0abfc;font-size:13px;">${score}%</span>
        </div>
        <div class="progress-bar-container">
          <div class="progress-bar" style="width:${score}%;background:linear-gradient(90deg,#7c3aed,#f0abfc);"></div>
        </div>
      </div>
    `).join('');

    panel.innerHTML = `
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px;">
        <span style="font-size:32px;">🧝</span>
        <div>
          <div style="font-size:18px;font-weight:700;">${s.student_name}</div>
          <div style="font-size:13px;color:#a78bfa;">第 ${s.rank} 名 / 共 ${s.total_players} 人</div>
        </div>
      </div>
      <div class="stat-grid" style="margin-bottom:16px;">
        <div class="stat-card"><div class="stat-value" style="color:#34d399;">${s.accuracy}%</div><div class="stat-label">正確率</div></div>
        <div class="stat-card"><div class="stat-value" style="color:#60a5fa;">${s.avg_speed_sec?.toFixed(1) || '-'}s</div><div class="stat-label">平均速度</div></div>
        <div class="stat-card"><div class="stat-value" style="color:#f0abfc;">${s.score}</div><div class="stat-label">本場分數</div></div>
      </div>
      <div style="margin-bottom:12px;">
        <div style="color:#a78bfa;font-size:12px;margin-bottom:6px;">弱點科目</div>
        ${weakHTML}
      </div>
      ${subjHTML ? `<div style="margin-top:12px;"><div style="color:#a78bfa;font-size:12px;margin-bottom:8px;">各科分數</div>${subjHTML}</div>` : ''}
    `;
  } catch (e) {
    panel.innerHTML = `<p style="color:#f87171;text-align:center;padding:20px;">載入失敗：${e.message}</p>`;
  }
}

async function loadWeakQuestions() {
  if (!currentRoomId) return;
  try {
    const res = await fetch(`/api/teacher/weak-questions/${currentRoomId}`);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    const questions = data.questions || [];

    if (!questions.length) {
      _setAnalyticsEmpty('weak', true, '這個房間目前沒有弱題資料。');
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
            labels: top10.map(q => q.title ? `Q${(q.seq||0)+1} ${q.title}`.slice(0, 18) : `題目 ${q.q_id}`),
            datasets: [{
              label: '錯題率 %',
              data: top10.map(q => q.error_rate),
              backgroundColor: top10.map(q => q.error_rate >= 50 ? 'rgba(239,68,68,0.75)' : 'rgba(248,113,113,0.7)'),
              borderColor: '#f87171',
              borderWidth: 1,
            }],
          },
          options: {
            indexAxis: 'y',
            animation: { duration: 600 },
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
        const label = q.title ? `Q${(q.seq||0)+1} ${escapeHtml(q.title)}` : `題目 ${escapeHtml(q.q_id)}`;
        const wrongCount = q.wrong_count || 0;
        const answeredCount = q.answered_count || 0;
        const errorRate = q.error_rate || 0;
        return `
        <button class="glass-card" data-question-index="${escapeHtml(q.q_id)}" style="margin-bottom:8px;width:100%;text-align:left;cursor:pointer;border:none;background:rgba(139,92,246,0.08);border-radius:10px;padding:12px 16px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
            <span style="font-size:13px;font-weight:600;color:#e9d5ff;">${label}</span>
            <span class="badge badge-red" style="background:rgba(239,68,68,${errorRate>=50?'0.9':'0.7'});color:#fff;padding:2px 8px;border-radius:999px;font-size:11px;">${errorRate}% 錯題率</span>
          </div>
          <div style="margin-bottom:4px;">
            <div style="height:6px;background:rgba(255,255,255,0.1);border-radius:3px;overflow:hidden;">
              <div style="height:100%;width:${Math.min(100,errorRate)}%;background:linear-gradient(90deg,#f87171,#ef4444);border-radius:3px;"></div>
            </div>
          </div>
          <div style="color:#a78bfa;font-size:12px;">答錯 ${wrongCount}/${answeredCount} 人${q.wrong_players?.length ? '：' + q.wrong_players.slice(0,5).join('、') + (q.wrong_players.length>5?'...':'') : ''}</div>
        </button>`;
      }).join('');
      listEl.querySelectorAll('[data-question-index]').forEach((btn) => {
        btn.addEventListener('click', () => {
          if (window.openTeacherQuestionDetail) window.openTeacherQuestionDetail(btn.dataset.questionIndex || '');
        });
      });
    }
  } catch (e) {
    console.error('[teacher] loadWeakQuestions error:', e);
    _setAnalyticsEmpty('weak', true, '弱題分析載入失敗：' + e.message);
  }
}

async function fetchAiSuggestion(playerName, btn) {
  btn.disabled = true;
  btn.textContent = '生成中...';
  const resultEl = document.querySelector(`[data-ai-result="${cssEscapeValue(playerName)}"]`);
  if (resultEl) resultEl.textContent = '🤖 AI 分析中...';

  try {
    const res = await fetch('/api/teacher/ai-suggestion', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ student_name: playerName, room_id: currentRoomId }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    if (resultEl) resultEl.textContent = data.suggestion || '無法生成建議';
    btn.textContent = '已生成';
  } catch (e) {
    if (resultEl) resultEl.textContent = `錯誤：${e.message}`;
    btn.disabled = false;
    btn.textContent = '重試';
  }
}

async function generateParentReport() {
  const studentName = document.getElementById('parent-student-select')?.value;
  if (!studentName || !currentRoomId) {
    alert('請選擇學生及房間');
    return;
  }

  const resultEl = document.getElementById('parent-report-result');
  if (resultEl) resultEl.innerHTML = '<p style="color:#a78bfa;">產生中...</p>';

  try {
    const res = await fetch('/api/teacher/parent-report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        student_name: studentName,
        room_id: currentRoomId,
        teacher_name: localStorage.getItem('currentUser') || localStorage.getItem('playerName') || '',
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    if (resultEl) {
      resultEl.innerHTML = `
        <div style="background:rgba(52,211,153,0.1);border:1px solid #34d399;border-radius:10px;padding:16px;">
          <div style="color:#34d399;font-weight:600;margin-bottom:8px;">✅ 報告已生成</div>
          <div style="font-size:13px;color:#a78bfa;margin-bottom:8px;">分享連結：</div>
          <div style="background:rgba(0,0,0,0.3);border-radius:6px;padding:8px;font-size:12px;color:#e9d5ff;word-break:break-all;margin-bottom:12px;">${escapeHtml(data.url)}</div>
          <div style="display:flex;gap:8px;">
            <button data-copy-url="${escapeHtml(data.url)}"
              style="background:rgba(139,92,246,0.3);border:1px solid #7c3aed;color:#e9d5ff;padding:6px 14px;border-radius:6px;cursor:pointer;font-size:12px;">
              複製連結
            </button>
            <a href="${escapeHtml(data.url)}" target="_blank"
              style="background:var(--purple-primary);color:#fff;padding:6px 14px;border-radius:6px;text-decoration:none;font-size:12px;">
              預覽報告
            </a>
          </div>
        </div>
      `;
    }
  } catch (e) {
    if (resultEl) resultEl.innerHTML = `<p style="color:#f87171;">錯誤：${e.message}</p>`;
  }
}

function switchTeacherTab(name, btn) {
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  const panel = document.getElementById(`tab-${name}`);
  if (panel) panel.classList.add('active');
  if (btn) btn.classList.add('active');

  if (name === 'weak') loadWeakQuestions();
}

// 暴露 globals 供 teacher_report.html 內的事件綁定使用
window.analyticsLoadRoom = analyticsLoadRoom;
window.switchTeacherTab = switchTeacherTab;
window.generateParentReport = generateParentReport;
window.fetchAiSuggestion = fetchAiSuggestion;
window.showStudentDetail = showStudentDetail;

initRoomSelector();
