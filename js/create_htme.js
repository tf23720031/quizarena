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

function createEmptyBank(title = '') {
  return {
    id: uid('bank'),
    title: title || `未命名題庫 ${state.quizBanks.length + 1}`,
    questions: [],
    updatedAt: Math.floor(Date.now() / 1000)
  };
}

function getCurrentBank() {
  return state.quizBanks[state.currentBankIndex] || null;
}

function createOptionRow(index, type, value = '', checked = false) {
  const label = type === 'tf' ? (index === 0 ? '是' : '否') : OPTION_LABELS[index];
  const inputType = type === 'multiple' ? 'checkbox' : 'radio';
  const displayValue = type === 'tf' ? label : value;
  const readonly = type === 'tf' ? 'readonly' : '';

  return `
    <label class="option-row">
      <span class="option-badge">${label}</span>
      <input
        class="form-check-input correct-check"
        ${inputType === 'radio' ? 'name="correctAnswer"' : ''}
        type="${inputType}"
        ${checked ? 'checked' : ''}
      >
      <input
        class="form-control cute-input option-input"
        value="${escapeHtml(displayValue)}"
        placeholder="請輸入選項內容"
        ${readonly}
      >
    </label>
  `;
}

function renderOptions(type, options = []) {
  const area = $('optionsArea');
  const defaultCount = type === 'tf' ? 2 : 4;

  if (!options.length) {
    area.innerHTML = Array.from({ length: defaultCount }, (_, i) => createOptionRow(i, type)).join('');
    return;
  }

  area.innerHTML = options
    .map((opt, i) => createOptionRow(i, type, opt.text || '', !!opt.correct))
    .join('');
}

function resetQuestionForm() {
  state.editingQuestionId = null;

  $('questionTitle').value = '';
  $('questionText').value = '';
  $('questionType').value = 'single';
  $('questionTime').value = '20 秒';
  $('questionScore').value = '1000';
  $('questionExplanation').value = '';
  $('fakeAnswerSwitch').checked = false;
  $('answerMode').value = '個人賽';
  $('imageUpload').value = '';

  $('previewImg').style.display = 'none';
  $('previewImg').src = '';
  $('uploadPlaceholder').style.display = 'block';

  state.currentImageBase64 = '';
  renderOptions('single');
}

function selectBank(index) {
  state.currentBankIndex = index;
  const bank = getCurrentBank();
  $('quizBankTitle').value = bank?.title || '';
  renderBankList();
  renderQuestionList();
  resetQuestionForm();
}

function renderBankList() {
  const wrap = $('quizBankList');

  if (!state.quizBanks.length) {
    wrap.innerHTML = '<div class="no-title">還沒有題庫，先建立一個吧。</div>';
    return;
  }

  wrap.innerHTML = state.quizBanks
    .map((bank, index) => `
      <article class="bank-card ${state.currentBankIndex === index ? 'active' : ''}" data-index="${index}">
        <div class="bank-top">
          <div>
            <strong>${escapeHtml(bank.title || '未命名題庫')}</strong>
            <div class="small-muted">${(bank.questions || []).length} 題</div>
          </div>
          ${state.currentBankIndex === index ? '<span class="question-chip py-1 px-2">編輯中</span>' : ''}
        </div>
        <div class="bank-tools">
          <button class="tool-btn copy-bank-btn" data-id="${bank.id}">複製</button>
          <button class="tool-btn rename-bank-btn" data-id="${bank.id}">改名</button>
          <button class="tool-btn delete-bank-btn" data-id="${bank.id}">刪除</button>
        </div>
      </article>
    `)
    .join('');

  document.querySelectorAll('.bank-card').forEach((el) => {
    el.addEventListener('click', (e) => {
      if (e.target.classList.contains('tool-btn')) return;
      selectBank(Number(el.dataset.index));
    });
  });

  document.querySelectorAll('.copy-bank-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      copyBank(btn.dataset.id);
    });
  });

  document.querySelectorAll('.rename-bank-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      renameBank(btn.dataset.id);
    });
  });

  document.querySelectorAll('.delete-bank-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      deleteBank(btn.dataset.id);
    });
  });
}

function renderQuestionList() {
  const wrap = $('questionList');
  const questions = getCurrentBank()?.questions || [];

  if (!questions.length) {
    wrap.innerHTML = '<div class="no-title">這個題庫還沒有題目。</div>';
    return;
  }

  wrap.innerHTML = questions
    .map((q) => `
      <article class="question-card ${state.editingQuestionId === q.id ? 'active' : ''}" data-id="${q.id}">
        <strong>${escapeHtml(q.title || '未命名題目')}</strong>
        <div class="meta">
          ${escapeHtml(q.type || 'single')} ・
          ${escapeHtml(q.time || '20 秒')} ・
          ${escapeHtml(String(q.score || 1000))} 分 ・
          ${escapeHtml(q.mode || '個人賽')}
        </div>
        <div class="desc">${escapeHtml(q.content || '')}</div>
      </article>
    `)
    .join('');

  document.querySelectorAll('.question-card').forEach((el) => {
    el.addEventListener('click', () => loadQuestion(el.dataset.id));
  });
}

function loadQuestion(id) {
  const q = getCurrentBank()?.questions?.find((item) => item.id === id);
  if (!q) return;

  state.editingQuestionId = q.id;
  $('questionTitle').value = q.title || '';
  $('questionText').value = q.content || '';
  $('questionType').value = q.type || 'single';
  $('questionTime').value = q.time || '20 秒';
  $('questionScore').value = String(q.score || 1000);
  $('questionExplanation').value = q.explanation || '';
  $('fakeAnswerSwitch').checked = !!q.fakeAnswer;
  $('answerMode').value = q.mode || '個人賽';

  renderOptions(q.type || 'single', q.options || []);
  state.currentImageBase64 = q.image || '';

  if (state.currentImageBase64) {
    $('previewImg').src = state.currentImageBase64;
    $('previewImg').style.display = 'block';
    $('uploadPlaceholder').style.display = 'none';
  } else {
    $('previewImg').style.display = 'none';
    $('previewImg').src = '';
    $('uploadPlaceholder').style.display = 'block';
  }

  renderQuestionList();
}

function collectQuestionForm() {
  const content = $('questionText').value.trim();
  if (!content) {
    showToast('請先輸入題目內容');
    return null;
  }

  const type = $('questionType').value;
  const optionInputs = [...document.querySelectorAll('.option-input')];
  const checks = [...document.querySelectorAll('.correct-check')];

  const options = optionInputs
    .map((input, index) => ({
      text: input.value.trim(),
      correct: !!checks[index]?.checked
    }))
    .filter((item) => item.text !== '');

  if (type === 'tf') {
    if (options.length !== 2) {
      showToast('是非題只能有兩個選項');
      return null;
    }
    if (options.filter((i) => i.correct).length !== 1) {
      showToast('是非題必須只有一個正確答案');
      return null;
    }
  } else if (type === 'single') {
    if (options.length < 2) {
      showToast('單選題至少需要兩個選項');
      return null;
    }
    if (options.filter((i) => i.correct).length !== 1) {
      showToast('單選題必須只有一個正確答案');
      return null;
    }
  } else {
    if (options.length < 2) {
      showToast('多選題至少需要兩個選項');
      return null;
    }
    if (options.filter((i) => i.correct).length < 1) {
      showToast('多選題至少要勾一個正確答案');
      return null;
    }
  }

  return {
    id: state.editingQuestionId || uid('question'),
    title: $('questionTitle').value.trim() || `未命名題目 ${Date.now().toString().slice(-4)}`,
    content,
    type,
    options,
    time: $('questionTime').value,
    score: Number($('questionScore').value || 1000),
    fakeAnswer: $('fakeAnswerSwitch').checked,
    mode: $('answerMode').value,
    image: state.currentImageBase64,
    explanation: $('questionExplanation').value.trim()
  };
}

function copyCurrentQuestion() {
  const q = collectQuestionForm();
  if (!q) return;

  copiedQuestion = JSON.parse(JSON.stringify(q));
  showToast('題目已複製');
}

function pasteQuestion() {
  if (!copiedQuestion) {
    showToast('沒有可以貼上的題目');
    return;
  }

  const newQ = JSON.parse(JSON.stringify(copiedQuestion));

  newQ.id = uid('question');
  newQ.title = (newQ.title || '題目') + '（副本）';

  $('questionTitle').value = newQ.title || '';
  $('questionText').value = newQ.content || '';
  $('questionType').value = newQ.type || 'single';
  $('questionTime').value = newQ.time || '20 秒';
  $('questionScore').value = String(newQ.score || 1000);
  $('questionExplanation').value = newQ.explanation || '';
  $('fakeAnswerSwitch').checked = !!newQ.fakeAnswer;
  $('answerMode').value = newQ.mode || '個人賽';

  state.currentImageBase64 = newQ.image || '';

  if (state.currentImageBase64) {
    $('previewImg').src = state.currentImageBase64;
    $('previewImg').style.display = 'block';
    $('uploadPlaceholder').style.display = 'none';
  } else {
    $('previewImg').style.display = 'none';
    $('previewImg').src = '';
    $('uploadPlaceholder').style.display = 'block';
  }

  renderOptions(newQ.type || 'single', newQ.options || []);
  state.editingQuestionId = null;

  showToast('已貼上題目，按「新增 / 更新題目」就會加入目前題庫');
}

async function saveAllBanks() {
  await api('/save_quiz_banks', {
    method: 'POST',
    body: JSON.stringify({
      username: state.currentUser,
      quizBanks: state.quizBanks
    })
  });
}

async function loadBanks() {
  const data = await api(`/load_quiz_banks?username=${encodeURIComponent(state.currentUser)}`);
  state.quizBanks = data.quizBanks || [];

  if (!state.quizBanks.length) {
    state.quizBanks = [createEmptyBank()];
  }

  state.currentBankIndex = 0;
  $('quizBankTitle').value = getCurrentBank().title;
  renderBankList();
  renderQuestionList();
  resetQuestionForm();
}

async function handleBankSave() {
  const bank = getCurrentBank();
  if (!bank) return;

  bank.title = $('quizBankTitle').value.trim() || bank.title || '未命名題庫';
  bank.updatedAt = Math.floor(Date.now() / 1000);

  await saveAllBanks();
  renderBankList();
  showToast('題庫已儲存');
  window.quizAudio?.success?.();
}

function handleAddQuestion() {
  const bank = getCurrentBank();
  if (!bank) return;

  bank.title = $('quizBankTitle').value.trim() || bank.title;
  const question = collectQuestionForm();
  if (!question) return;

  const idx = bank.questions.findIndex((item) => item.id === question.id);
  if (idx >= 0) {
    bank.questions[idx] = question;
  } else {
    bank.questions.push(question);
  }

  renderBankList();
  renderQuestionList();
  showToast(idx >= 0 ? '題目已更新' : '題目已新增');
  window.quizAudio?.success?.();
}

function handleDeleteQuestion() {
  const bank = getCurrentBank();
  if (!bank || !state.editingQuestionId) {
    showToast('請先選擇要刪除的題目');
    return;
  }

  bank.questions = bank.questions.filter((q) => q.id !== state.editingQuestionId);
  resetQuestionForm();
  renderBankList();
  renderQuestionList();
  showToast('題目已刪除');
}

async function copyBank(bankId) {
  try {
    const data = await api('/copy_quiz_bank', {
      method: 'POST',
      body: JSON.stringify({
        username: state.currentUser,
        bankId,
        newTitle: ''
      })
    });

    state.quizBanks = data.quizBanks || [];
    state.currentBankIndex = 0;
    renderBankList();
    renderQuestionList();
    showToast('題庫已複製，可直接拿來改期末版本');
    window.quizAudio?.success?.();
  } catch (e) {
    showToast(e.message);
    window.quizAudio?.fail?.();
  }
}

function renameBank(bankId) {
  state.pendingNameMode = 'rename';
  state.pendingBankId = bankId;
  const bank = state.quizBanks.find((b) => b.id === bankId);
  $('bankNameInput').value = bank?.title || '';
  bankNameModal.show();
}

async function deleteBank(bankId) {
  if (!confirm('確定要刪除這個題庫嗎？')) return;

  try {
    const data = await api('/delete_quiz_bank', {
      method: 'POST',
      body: JSON.stringify({
        username: state.currentUser,
        bankId
      })
    });

    state.quizBanks = data.quizBanks || [];
    if (!state.quizBanks.length) {
      state.quizBanks = [createEmptyBank()];
    }

    state.currentBankIndex = 0;
    $('quizBankTitle').value = getCurrentBank().title;
    renderBankList();
    renderQuestionList();
    resetQuestionForm();
    showToast('題庫已刪除');
  } catch (e) {
    showToast(e.message);
  }
}

function openNewBank() {
  state.pendingNameMode = 'new';
  state.pendingBankId = '';
  $('bankNameInput').value = '';
  bankNameModal.show();
}

async function confirmBankName() {
  const name = $('bankNameInput').value.trim();
  if (!name) {
    showToast('請輸入名稱');
    return;
  }

  try {
    if (state.pendingNameMode === 'rename') {
      const data = await api('/rename_quiz_bank', {
        method: 'POST',
        body: JSON.stringify({
          username: state.currentUser,
          bankId: state.pendingBankId,
          newTitle: name
        })
      });
      state.quizBanks = data.quizBanks || [];
    } else {
      state.quizBanks.unshift(createEmptyBank(name));
      state.currentBankIndex = 0;
      $('quizBankTitle').value = name;
    }

    bankNameModal.hide();
    renderBankList();
    renderQuestionList();
    showToast('題庫名稱已更新');
  } catch (e) {
    showToast(e.message);
  }
}

function buildRoomQuestionPicker() {
  const bank = getCurrentBank();
  const questions = bank?.questions || [];

  if (!questions.length) {
    $('roomQuestionPicker').innerHTML = '<div class="no-title">這個題庫沒有題目，無法建立房間。</div>';
    return;
  }

  $('roomQuestionPicker').innerHTML = questions
    .map((q, index) => `
      <label class="picker-item">
        <div class="d-flex align-items-center justify-content-between gap-2">
          <div>
            <strong>${escapeHtml(q.title || `第${index + 1}題`)}</strong>
            <div class="small-muted">${escapeHtml(q.content || '').slice(0, 60)}</div>
          </div>
          <input type="checkbox" class="picker-check room-question-check" data-id="${q.id}" checked>
        </div>
        <textarea class="form-control cute-input room-question-explanation" data-id="${q.id}" placeholder="本房間用的解析，可直接沿用或修改">${escapeHtml(q.explanation || '')}</textarea>
      </label>
    `)
    .join('');
}

function getRoomQuestionSnapshot() {
  const bank = getCurrentBank();
  const questions = bank?.questions || [];
  const selectedIds = [...document.querySelectorAll('.room-question-check:checked')].map((el) => el.dataset.id);
  if (!selectedIds.length) return [];

  const explainMap = Object.fromEntries(
    [...document.querySelectorAll('.room-question-explanation')].map((el) => [el.dataset.id, el.value.trim()])
  );

  return questions
    .filter((q) => selectedIds.includes(q.id))
    .map((q) => ({
      ...q,
      roomQuestionId: uid('rq'),
      explanation: explainMap[q.id] ?? q.explanation ?? ''
    }));
}

async function createRoom() {
  const bank = getCurrentBank();
  if (!bank) return;

  const roomQuestions = getRoomQuestionSnapshot();
  if (!roomQuestions.length) {
    showToast('請至少勾選一題帶進房間');
    return;
  }

  try {
    const data = await api('/create_room', {
      method: 'POST',
      body: JSON.stringify({
        bankId: bank.id,
        bankTitle: $('quizBankTitle').value.trim() || bank.title,
        createdBy: state.currentUser,
        roomName: $('roomNameInput').value.trim(),
        isPrivate: $('isPrivateInput').checked,
        roomKey: $('roomKeyInput').value.trim(),
        maxPlayers: $('maxPlayersInput').value,
        allowLobbyJoin: $('allowLobbyJoinInput').checked,
        teamMode: $('teamModeSelect').value === 'true',
        roomQuestions
      })
    });

    localStorage.setItem(
      'pendingJoinContext',
      JSON.stringify({
        room: data.room,
        roomKey: $('roomKeyInput').value.trim(),
        isHost: true
      })
    );

    roomSettingsModal.hide();
    showToast(`房間建立成功，PIN：${data.room.pin}`);
    setTimeout(() => (window.location.href = 'player_join.html'), 700);
  } catch (e) {
    showToast(e.message);
    window.quizAudio?.fail?.();
  }
}

$('questionType').addEventListener('change', (e) => renderOptions(e.target.value));

$('quizBankTitle').addEventListener('input', () => {
  const bank = getCurrentBank();
  if (bank) bank.title = $('quizBankTitle').value.trim();
  renderBankList();
});

$('newBankBtn').addEventListener('click', openNewBank);
$('confirmBankNameBtn').addEventListener('click', confirmBankName);
$('saveBankBtn').addEventListener('click', handleBankSave);
$('addQuestionBtn').addEventListener('click', handleAddQuestion);
$('copyQuestionBtn').addEventListener('click', copyCurrentQuestion);
$('pasteQuestionBtn').addEventListener('click', pasteQuestion);
$('clearQuestionBtn').addEventListener('click', resetQuestionForm);
$('deleteQuestionBtn').addEventListener('click', handleDeleteQuestion);

$('openRoomSettingsBtn').addEventListener('click', () => {
  buildRoomQuestionPicker();
  roomSettingsModal.show();
});

$('confirmCreateRoomBtn').addEventListener('click', createRoom);

$('isPrivateInput').addEventListener('change', () => {
  $('roomKeyWrap').style.display = $('isPrivateInput').checked ? 'block' : 'none';
});

$('imageUpload').addEventListener('change', (event) => {
  const file = event.target.files?.[0];
  if (!file) return;

  if (!/^image\/(png|jpeg)$/.test(file.type)) {
    showToast('只支援 JPG / PNG');
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    state.currentImageBase64 = reader.result;
    $('previewImg').src = reader.result;
    $('previewImg').style.display = 'block';
    $('uploadPlaceholder').style.display = 'none';
  };
  reader.readAsDataURL(file);
});

(async function init() {
  if (!ensureUser()) return;
  await loadBanks();
})();