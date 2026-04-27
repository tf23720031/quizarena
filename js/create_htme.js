const toastEl = document.getElementById('toast');
const bankNameModal = new bootstrap.Modal(document.getElementById('bankNameModal'));
const roomSettingsModal = new bootstrap.Modal(document.getElementById('roomSettingsModal'));

const OPTION_LABELS = ['A', 'B', 'C', 'D', 'E', 'F'];
let copiedQuestion = null;

const state = {
  currentUser: localStorage.getItem('currentUser') || '',
  quizBanks: [],
  currentBankIndex: null,
  editingQuestionId: null,
  pendingNameMode: 'new',
  pendingBankId: '',
  currentImageBase64: ''
};

const $ = (id) => document.getElementById(id);

function showToast(message, delay = 2400) {
  toastEl.textContent = message;
  toastEl.classList.add('show');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toastEl.classList.remove('show'), delay);
}

function escapeHtml(str = '') {
  return String(str)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function uid(prefix = 'id') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

async function api(url, options = {}) {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });
  const data = await res.json();
  if (!res.ok || data.success === false) {
    throw new Error(data.message || '操作失敗');
  }
  return data;
}

function ensureUser() {
  if (!state.currentUser) {
    showToast('請先登入後再使用題庫中心。');
    setTimeout(() => (window.location.href = 'index.html'), 1200);
    return false;
  }
  $('currentUserText').textContent = state.currentUser;
  return true;
}

// gameMode: 'individual' | 'team'
function createEmptyBank(title = '') {
  return {
    id: uid('bank'),
    title: title || `未命名題庫 ${state.quizBanks.length + 1}`,
    gameMode: 'individual',
    questions: [],
    updatedAt: Math.floor(Date.now() / 1000)
  };
}

function getCurrentBank() {
  return state.quizBanks[state.currentBankIndex] || null;
}

// ── 選項渲染 ──────────────────────────────────────
function createOptionRow(index, type, value = '', checked = false) {
  const label = type === 'tf' ? (index === 0 ? '是' : '否') : OPTION_LABELS[index];
  const inputType = type === 'multiple' ? 'checkbox' : 'radio';
  const displayValue = type === 'tf' ? label : value;
  const readonly = type === 'tf' ? 'readonly' : '';
  return `
    <label class="option-row">
      <span class="option-badge">${label}</span>
      <input class="form-check-input correct-check"
             ${inputType === 'radio' ? 'name="correctAnswer"' : ''}
             type="${inputType}" ${checked ? 'checked' : ''}>
      <input class="form-control cute-input option-input"
             value="${escapeHtml(displayValue)}"
             placeholder="請輸入選項內容" ${readonly}>
    </label>`;
}

function renderOptions(type, options = []) {
  const area = $('optionsArea');
  const defaultCount = type === 'tf' ? 2 : 4;
  if (!options.length) {
    area.innerHTML = Array.from({ length: defaultCount }, (_, i) => createOptionRow(i, type)).join('');
    return;
  }
