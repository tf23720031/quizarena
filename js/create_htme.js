const toastEl = document.getElementById('toast');
const bankNameModal = new bootstrap.Modal(document.getElementById('bankNameModal'));
const roomSettingsModal = new bootstrap.Modal(document.getElementById('roomSettingsModal'));

const OPTION_LABELS = ['A', 'B', 'C', 'D', 'E', 'F'];
let copiedQuestion = null;

function getStoredUser() {
  const direct = String(localStorage.getItem('currentUser') || sessionStorage.getItem('currentUser') || '').trim();
  if (direct) return direct;

  try {
    const profile = JSON.parse(localStorage.getItem('currentUserProfile') || 'null');
    const username = String(profile?.username || '').trim();
    if (username) {
      localStorage.setItem('currentUser', username);
      return username;
    }
  } catch {
    // Ignore broken local profile data and fall through to guest state.
  }

  try {
    const roomProfile = JSON.parse(localStorage.getItem('roomPlayerProfile') || 'null');
    const name = String(roomProfile?.username || roomProfile?.account || roomProfile?.name || '').trim();
    if (name) {
      localStorage.setItem('currentUser', name);
      return name;
    }
  } catch {
    // Ignore temporary room profile data.
  }

  const urlUser = String(new URLSearchParams(window.location.search).get('username') || '').trim();
  if (urlUser) {
    localStorage.setItem('currentUser', urlUser);
    return urlUser;
  }

  return '';
}

const state = {
  currentUser: getStoredUser(),
  quizBanks: [],
  currentBankIndex: null,
  editingQuestionId: null,
  pendingNameMode: 'new',
  pendingBankId: '',
  currentImageBase64: '',
  isGeneratingAi: false
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

  let data = {};
  try {
    data = await res.json();
  } catch {
    data = {
      success: false,
      message: '伺服器沒有回傳 JSON，請確認 Render 是否部署成功。'
    };
  }

  if (!res.ok || data.success === false) {
    throw new Error(data.message || '操作失敗');
  }

  return data;
}

function ensureUser() {
  state.currentUser = getStoredUser();
  if (!state.currentUser) {
    showToast('請先登入後再使用題庫中心。');
    setTimeout(() => (window.location.href = 'index.html'), 1200);
    return false;
  }

  delete $('currentUserText').dataset.i18n;
  $('currentUserText').dataset.i18nSkip = '1';
  $('currentUserText').textContent = state.currentUser;
  return true;
}

function createEmptyBank(title = '') {
  return {
    id: uid('bank'),
    title: title || `未命名題庫 ${state.quizBanks.length + 1}`,
    gameMode: 'individual',
    language: localStorage.getItem('quizLang') || 'zh',
    questions: [],
    updatedAt: Math.floor(Date.now() / 1000)
  };
}
function getLocalDraftKey() {
  return `quizarena_draft_${state.currentUser || 'guest'}`;
}

function saveLocalDraft() {
  if (!state.currentUser) return;
  const mutable = getMutableBanks();
  localStorage.setItem(getLocalDraftKey(), JSON.stringify({
    savedAt: Math.floor(Date.now() / 1000),
    quizBanks: mutable
  }));
}

function loadLocalDraft() {
  if (!state.currentUser) return [];
  try {
    const raw = JSON.parse(localStorage.getItem(getLocalDraftKey()) || 'null');
    const banks = Array.isArray(raw?.quizBanks) ? raw.quizBanks : [];
    if (banks.length) return banks;
  } catch {
    // Try recovering from other local draft keys below.
  }

  let bestDraft = null;
  for (let idx = 0; idx < localStorage.length; idx += 1) {
    const key = localStorage.key(idx) || '';
    if (!key.startsWith('quizarena_draft_')) continue;
    try {
      const draft = JSON.parse(localStorage.getItem(key) || 'null');
      const banks = Array.isArray(draft?.quizBanks) ? draft.quizBanks : [];
      if (!banks.length) continue;
      if (!bestDraft || Number(draft.savedAt || 0) > Number(bestDraft.savedAt || 0)) {
        bestDraft = { savedAt: Number(draft.savedAt || 0), quizBanks: banks };
      }
    } catch {
      // Skip broken draft records.
    }
  }
  return bestDraft?.quizBanks || [];
}
function getCurrentBank() {
  return state.quizBanks[state.currentBankIndex] || null;
}

function syncCurrentBankHeader() {
  const bank = getCurrentBank();
  if (!bank) return;

  const titleInput = $('quizBankTitle');
  const modeInput = $('bankGameMode');
  const languageInput = $('bankLanguage');

  if (titleInput) {
    titleInput.value = bank.title || '';
    titleInput.disabled = isReadonlyBank(bank);
  }

  if (modeInput) {
    modeInput.value = bank.gameMode || 'individual';
    modeInput.disabled = isReadonlyBank(bank);
  }

  if (languageInput) {
    languageInput.value = bank.language || localStorage.getItem('quizLang') || 'zh';
    languageInput.disabled = isReadonlyBank(bank);
  }
}

function isReadonlyBank(bank) {
  return !!(bank?.readonly || bank?.isSystem || bank?.isWrongBook);
}

function getMutableBanks() {
  return state.quizBanks.filter((bank) => !isReadonlyBank(bank));
}

function firstEditableBankIndex() {
  const idx = state.quizBanks.findIndex((bank) => !isReadonlyBank(bank));
  return idx >= 0 ? idx : 0;
}

function mergeLoadedBanks(userBanks = [], systemBanks = [], wrongBook = null) {
  const merged = [];

  if (wrongBook?.questions?.length) {
    merged.push({
      ...wrongBook,
      readonly: true,
      isWrongBook: true
    });
  }

  userBanks.forEach((bank) => merged.push(bank));

  systemBanks.forEach((bank) => {
    merged.push({
      ...bank,
      readonly: true,
      isSystem: true
    });
  });

  return merged;
}

function insertEditableBank(bank) {
  const copy = {
    ...bank,
    readonly: false,
    isSystem: false,
    isWrongBook: false
  };

  const insertAt = state.quizBanks.findIndex((item) => isReadonlyBank(item) && item?.isSystem);

  if (insertAt === -1) {
    state.quizBanks.push(copy);
  } else {
    state.quizBanks.splice(insertAt, 0, copy);
  }

  state.currentBankIndex = state.quizBanks.findIndex((item) => item.id === copy.id);
}

function createOptionRow(index, type, value = '', checked = false) {
  if (type === 'matching') {
    const left = typeof value === 'object' ? (value.left || value.text || '') : '';
    const right = typeof value === 'object' ? (value.right || value.match || '') : '';
    return `<div class="option-row matching-row">
      <span class="option-label">${index + 1}</span>
      <input type="text" class="form-control cute-input option-left" placeholder="左側項目" value="${escapeHtml(left)}">
      <i class="fa-solid fa-right-left"></i>
      <input type="text" class="form-control cute-input option-right" placeholder="右側答案" value="${escapeHtml(right)}">
    </div>`;
  }
  const isFill = type === 'fill';
  const label = type === 'tf'
    ? (index === 0 ? '是' : '否')
    : (isFill ? '答案' : OPTION_LABELS[index]);

  const inputType = type === 'multiple' ? 'checkbox' : 'radio';
  const displayValue = type === 'tf' ? label : value;
  const readonly = type === 'tf' ? 'readonly' : '';

  return `
    <label class="option-row">
      <span class="option-badge">${label}</span>
      <input class="form-check-input correct-check"
             ${inputType === 'radio' ? 'name="correctAnswer"' : ''}
             type="${inputType}" ${checked || isFill ? 'checked' : ''} ${isFill ? 'style="display:none;"' : ''}>
      <input class="form-control cute-input option-input"
             value="${escapeHtml(displayValue)}"
             placeholder="${isFill ? '請輸入正確答案' : '請輸入選項內容'}" ${readonly}>
    </label>`;
}

function renderOptions(type, options = []) {
  const area = $('optionsArea');
  if (type === 'matching') {
    const rows = options.length ? options : [
      { left: '', right: '' },
      { left: '', right: '' },
      { left: '', right: '' },
      { left: '', right: '' },
    ];
    area.innerHTML = rows.map((opt, i) => createOptionRow(i, type, opt)).join('');
    return;
  }
  const defaultCount = type === 'tf' ? 2 : (type === 'fill' ? 1 : 4);

  if (!options.length) {
    area.innerHTML = Array.from(
      { length: defaultCount },
      (_, i) => createOptionRow(i, type, '', type === 'fill')
    ).join('');
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
  $('questionDifficulty').value = 'medium';
  $('questionCategory').value = '';
  $('questionExplanation').value = '';
  $('fakeAnswerSwitch').checked = false;
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
  $('bankGameMode').value = bank?.gameMode || 'individual';
  $('bankLanguage').value = bank?.language || localStorage.getItem('quizLang') || 'zh';
  $('quizBankTitle').disabled = isReadonlyBank(bank);
  $('bankGameMode').disabled = isReadonlyBank(bank);
  $('bankLanguage').disabled = isReadonlyBank(bank);

  renderBankList();
  renderQuestionList();
  resetQuestionForm();
}

function renderBankList() {
  const myWrap = $('myQuizBankList');
  const suggestedWrap = $('suggestedBankList');

  const myBanks = state.quizBanks.filter((bank) => !bank.isSystem);
  const suggestedBanks = state.quizBanks.filter((bank) => bank.isSystem);

  if (!state.quizBanks.length) {
    myWrap.innerHTML = '<div class="no-title">還沒有題庫，先建立一個吧。</div>';
    suggestedWrap.innerHTML = '<div class="no-title">目前沒有系統建議題庫。</div>';
    return;
  }

  const renderCards = (list) => list.map((bank) => {
    const index = state.quizBanks.findIndex((item) => item.id === bank.id);
    const isTeam = bank.gameMode === 'team';
    const langLabel = { zh: '中文', en: 'EN', ja: '日本語', ko: '한국어', es: 'ES' }[bank.language || 'zh'] || '中文';

    const readonlyBadge = bank.isWrongBook
      ? `<span class="question-chip py-1 px-2" style="background:#fff1c7;color:#8a5b00;border-radius:8px">錯題本</span>`
      : (bank.isSystem
        ? `<span class="question-chip py-1 px-2" style="background:#dff8e8;color:#1e7a47;border-radius:8px">系統題庫</span>`
        : '');

    const modeBadge = isTeam
      ? `<span class="question-chip py-1 px-2" style="background:#ede0ff;color:#7952d4;border-radius:8px">團體賽</span>`
      : `<span class="question-chip py-1 px-2" style="background:#e0f7ff;color:#3a7cb8;border-radius:8px">個人賽</span>`;

    return `
      <article class="bank-card ${state.currentBankIndex === index ? 'active' : ''}" data-index="${index}">
        <div class="bank-top">
          <div>
            <strong>${escapeHtml(bank.title || '未命名題庫')}</strong>
            <div class="small-muted">${(bank.questions || []).length} 題 · ${escapeHtml(langLabel)}</div>
          </div>
          ${state.currentBankIndex === index
            ? '<span class="question-chip py-1 px-2">編輯中</span>'
            : (readonlyBadge || modeBadge)}
        </div>
        <div class="bank-tools">
          <button class="tool-btn copy-bank-btn" data-id="${bank.id}">複製</button>
          ${isReadonlyBank(bank) ? '' : `<button class="tool-btn rename-bank-btn" data-id="${bank.id}">改名</button>`}
          ${isReadonlyBank(bank) ? '' : `<button class="tool-btn delete-bank-btn" data-id="${bank.id}">刪除</button>`}
        </div>
      </article>`;
  }).join('');

  myWrap.innerHTML = myBanks.length ? renderCards(myBanks) : '<div class="no-title">你目前還沒有自訂題庫。</div>';
  suggestedWrap.innerHTML = suggestedBanks.length ? renderCards(suggestedBanks) : '<div class="no-title">目前沒有系統建議題庫。</div>';

  const wrongBook = state.quizBanks.find((bank) => bank.isWrongBook);
  $('wrongBookQuickWrap').style.display = wrongBook?.questions?.length ? 'block' : 'none';

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

  wrap.innerHTML = questions.map((q) => `
    <article class="question-card ${state.editingQuestionId === q.id ? 'active' : ''}" data-id="${q.id}">
      <strong>${escapeHtml(q.title || '未命名題目')}</strong>
      <div class="meta">
        ${escapeHtml(q.type || 'single')} ・
        ${escapeHtml(q.category || '綜合')} ・
        ${escapeHtml(q.difficulty || 'medium')} ・
        ${escapeHtml(q.time || '20 秒')} ・
        ${escapeHtml(String(q.score || 1000))} 分
      </div>
      <div class="desc">${escapeHtml(q.content || '')}</div>
    </article>`).join('');

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
  $('questionDifficulty').value = q.difficulty || 'medium';
  $('questionCategory').value = q.category || '';
  $('questionExplanation').value = q.explanation || '';
  $('fakeAnswerSwitch').checked = !!q.fakeAnswer;

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
  let options = [];
  if (type === 'matching') {
    options = [...document.querySelectorAll('.matching-row')]
      .map((row) => ({
        left: row.querySelector('.option-left')?.value.trim() || '',
        right: row.querySelector('.option-right')?.value.trim() || '',
        correct: true,
      }))
      .filter((item) => item.left && item.right);
  } else {
    const optionInputs = [...document.querySelectorAll('.option-input')];
    const checks = [...document.querySelectorAll('.correct-check')];
    options = optionInputs
      .map((input, index) => ({
        text: input.value.trim(),
        correct: !!checks[index]?.checked
      }))
      .filter((item) => item.text !== '');
  }

  if (type === 'matching') {
    if (options.length < 2) {
      showToast('配對題至少需要兩組左右配對');
      return null;
    }
  } else if (type === 'fill') {
    if (!options.length || !options[0].text) {
      showToast('填充題需要設定正確答案');
      return null;
    }

    options.splice(1);
    options[0].correct = true;
  } else if (type === 'tf') {
    if (options.length !== 2) {
      showToast('是非題只能有兩個選項');
      return null;
    }

    if (options.filter((item) => item.correct).length !== 1) {
      showToast('是非題必須只有一個正確答案');
      return null;
    }
  } else if (type === 'single') {
    if (options.length < 2) {
      showToast('單選題至少需要兩個選項');
      return null;
    }

    if (options.filter((item) => item.correct).length !== 1) {
      showToast('單選題必須只有一個正確答案');
      return null;
    }
  } else {
    if (options.length < 2) {
      showToast('多選題至少需要兩個選項');
      return null;
    }

    if (options.filter((item) => item.correct).length < 1) {
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
    difficulty: $('questionDifficulty').value,
    category: $('questionCategory').value.trim() || '綜合',
    language: getCurrentBank()?.language || localStorage.getItem('quizLang') || 'zh',
    fakeAnswer: $('fakeAnswerSwitch').checked,
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
    showToast('剪貼簿是空的，請先複製一道題目');
    return;
  }

  const newQ = JSON.parse(JSON.stringify(copiedQuestion));
  newQ.id = uid('question');
  state.editingQuestionId = newQ.id;

  $('questionTitle').value = newQ.title || '';
  $('questionText').value = newQ.content || '';
  $('questionType').value = newQ.type || 'single';
  $('questionTime').value = newQ.time || '20 秒';
  $('questionScore').value = String(newQ.score || 1000);
  $('questionDifficulty').value = newQ.difficulty || 'medium';
  $('questionCategory').value = newQ.category || '';
  $('questionExplanation').value = newQ.explanation || '';
  $('fakeAnswerSwitch').checked = !!newQ.fakeAnswer;

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
  showToast('題目已貼上，確認後按新增/更新');
}

async function saveAllBanks() {
  const bank = getCurrentBank();

  if (bank && !isReadonlyBank(bank)) {
    const titleInput = $('quizBankTitle').value.trim();

    if (titleInput) {
      bank.title = titleInput;
    }

    bank.gameMode = $('bankGameMode').value;
    bank.language = $('bankLanguage').value;
    bank.updatedAt = Math.floor(Date.now() / 1000);
  }

  await api('/save_quiz_banks', {
    method: 'POST',
    body: JSON.stringify({
      username: state.currentUser,
      quizBanks: getMutableBanks()
    })
  });
  saveLocalDraft();
}

async function loadBanks() {
  state.currentUser = getStoredUser();
  delete $('currentUserText').dataset.i18n;
  $('currentUserText').dataset.i18nSkip = '1';
  $('currentUserText').textContent = state.currentUser || '未登入';
  const data = await api(`/load_quiz_banks?username=${encodeURIComponent(state.currentUser)}`);
  const localDraftBanks = loadLocalDraft();
  const serverBanks = data.quizBanks || [];
  const effectiveBanks = serverBanks.length ? serverBanks : localDraftBanks;
  if (!serverBanks.length && localDraftBanks.length) {
    showToast('已從瀏覽器草稿恢復你之前的題庫，記得按「儲存題庫」同步。', 3600);
  }

  state.quizBanks = mergeLoadedBanks(
    effectiveBanks,
    data.systemQuizBanks || [],
    data.wrongBook || null
  );

  if (!state.quizBanks.length) {
    state.quizBanks = [createEmptyBank()];
  }

  if (!state.quizBanks.some((bank) => !isReadonlyBank(bank))) {
    insertEditableBank(createEmptyBank());
  }

  state.currentBankIndex = firstEditableBankIndex();

  syncCurrentBankHeader();
  renderBankList();
  renderQuestionList();
  resetQuestionForm();
}

async function handleBankSave() {
  const bank = getCurrentBank();
  if (!bank) return;

  if (isReadonlyBank(bank)) {
    showToast('系統題庫與錯題本不能直接修改，請先複製一份。');
    return;
  }

  bank.title = $('quizBankTitle').value.trim() || bank.title || '未命名題庫';
  bank.gameMode = $('bankGameMode').value;
  bank.language = $('bankLanguage').value;
  bank.updatedAt = Math.floor(Date.now() / 1000);

  await saveAllBanks();

  renderBankList();
  showToast('題庫已儲存');
  window.quizAudio?.success?.();
}

async function handleAddQuestion() {
  const bank = getCurrentBank();
  if (!bank) return;

  if (isReadonlyBank(bank)) {
    showToast('這個題庫是唯讀的，請先複製後再編輯。');
    return;
  }

  if ($('quizBankTitle').value.trim()) {
    bank.title = $('quizBankTitle').value.trim();
  }

  const question = collectQuestionForm();
  if (!question) return;

  const idx = bank.questions.findIndex((item) => item.id === question.id);

  if (idx >= 0) {
    bank.questions[idx] = question;
  } else {
    bank.questions.push(question);
  }
  await saveAllBanks();
  renderBankList();
  renderQuestionList();
  showToast(idx >= 0 ? '題目已更新' : '題目已新增');
  window.quizAudio?.success?.();
}

async function handleDeleteQuestion() {
  const bank = getCurrentBank();

  if (!bank || !state.editingQuestionId) {
    showToast('請先選擇要刪除的題目');
    return;
  }

  if (isReadonlyBank(bank)) {
    showToast('這個題庫是唯讀的，不能直接刪題。');
    return;
  }

  bank.questions = bank.questions.filter((q) => q.id !== state.editingQuestionId);
  await saveAllBanks();
  resetQuestionForm();
  renderBankList();
  renderQuestionList();
  showToast('題目已刪除');
}

async function copyBank(bankId) {
  try {
    const bank = state.quizBanks.find((b) => b.id === bankId);
    if (!bank) throw new Error('找不到要複製的題庫');

    const copied = JSON.parse(JSON.stringify(bank));
    copied.id = uid('bank');
    copied.title = `${copied.title || '未命名題庫'}（複製）`;
    copied.updatedAt = Math.floor(Date.now() / 1000);

    delete copied.readonly;
    delete copied.isSystem;
    delete copied.isWrongBook;

    insertEditableBank(copied);
    await saveAllBanks();

    renderBankList();
    renderQuestionList();
    showToast('題庫已複製');
    window.quizAudio?.success?.();
  } catch (e) {
    showToast(e.message);
    window.quizAudio?.fail?.();
  }
}

function renameBank(bankId) {
  const bank = state.quizBanks.find((b) => b.id === bankId);

  if (!bank || isReadonlyBank(bank)) {
    showToast('這個題庫不能直接改名，請先複製。');
    return;
  }

  state.pendingNameMode = 'rename';
  state.pendingBankId = bankId;

  $('bankNameInput').value = bank?.title || '';
  bankNameModal.show();
}

async function deleteBank(bankId) {
  const bank = state.quizBanks.find((b) => b.id === bankId);

  if (!bank || isReadonlyBank(bank)) {
    showToast('這個題庫不能直接刪除。');
    return;
  }

  if (!confirm('確定要刪除這個題庫嗎？')) return;

  try {
    state.quizBanks = state.quizBanks.filter((b) => b.id !== bankId);

    if (!state.quizBanks.some((item) => !isReadonlyBank(item))) {
      insertEditableBank(createEmptyBank());
    }

    state.currentBankIndex = firstEditableBankIndex();

    await saveAllBanks();

    syncCurrentBankHeader();
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
    showToast('請輸入題庫名稱');
    return;
  }

  try {
    if (state.pendingNameMode === 'rename') {
      const bank = state.quizBanks.find((b) => b.id === state.pendingBankId);

      if (!bank || isReadonlyBank(bank)) {
        throw new Error('這個題庫不能直接改名');
      }

      bank.title = name;
      bank.updatedAt = Math.floor(Date.now() / 1000);
      state.currentBankIndex = state.quizBanks.findIndex((b) => b.id === bank.id);
    } else {
      const newBank = createEmptyBank(name);
      insertEditableBank(newBank);
    }

    syncCurrentBankHeader();
    await saveAllBanks();

    bankNameModal.hide();
    renderBankList();
    renderQuestionList();

    $('bankNameInput').value = '';
    state.pendingNameMode = 'new';
    state.pendingBankId = '';

    showToast('題庫名稱已更新');
    window.quizAudio?.success?.();
  } catch (e) {
    showToast(e.message);
    window.quizAudio?.fail?.();
  }
}

function buildTeamNameInputs(count) {
  const wrap = $('teamNamesWrap');
  if (!wrap) return;

  wrap.innerHTML = Array.from({ length: count }, (_, i) => `
    <div class="d-flex align-items-center gap-2" style="min-width:150px;">
      <span class="small-muted" style="white-space:nowrap;font-weight:800">隊${i + 1}</span>
      <input type="text" class="form-control cute-input team-name-input"
             placeholder="隊名（選填）" style="height:36px;font-size:.88rem;">
    </div>`).join('');
}

function buildRoomQuestionPicker() {
  const bank = getCurrentBank();
  const questions = bank?.questions || [];

  if (!questions.length) {
    $('roomQuestionPicker').innerHTML = '<div class="no-title">這個題庫沒有題目，無法建立房間。</div>';
    return;
  }

  $('roomQuestionPicker').innerHTML = questions.map((q, index) => `
    <label class="picker-item">
      <div class="d-flex align-items-center justify-content-between gap-2">
        <div>
          <strong>${escapeHtml(q.title || `第${index + 1}題`)}</strong>
          <div class="small-muted">${escapeHtml(q.content || '').slice(0, 60)}</div>
        </div>
        <input type="checkbox" class="picker-check room-question-check" data-id="${q.id}" checked>
      </div>
      <textarea class="form-control cute-input room-question-explanation" data-id="${q.id}"
                placeholder="本房間用的解析，可直接沿用或修改">${escapeHtml(q.explanation || '')}</textarea>
    </label>`).join('');
}

function getRoomQuestionSnapshot() {
  const bank = getCurrentBank();
  const questions = bank?.questions || [];

  const selectedIds = [...document.querySelectorAll('.room-question-check:checked')]
    .map((el) => el.dataset.id);

  if (!selectedIds.length) return [];

  const explainMap = Object.fromEntries(
    [...document.querySelectorAll('.room-question-explanation')]
      .map((el) => [el.dataset.id, el.value.trim()])
  );

  return questions
    .filter((q) => selectedIds.includes(q.id))
    .map((q) => ({
      ...q,
      roomQuestionId: uid('rq'),
      explanation: explainMap[q.id] ?? q.explanation ?? ''
    }));
}

function syncRoomAccessMode(source = '') {
  const privateInput = $('isPrivateInput');
  const lobbyInput = $('allowLobbyJoinInput');
  const roomKeyWrap = $('roomKeyWrap');
  const roomKeyInput = $('roomKeyInput');

  if (source === 'private' && privateInput.checked) {
    lobbyInput.checked = false;
  }

  if (source === 'lobby' && lobbyInput.checked) {
    privateInput.checked = false;
    roomKeyInput.value = '';
  }

  if (privateInput.checked) {
    roomKeyWrap.style.display = 'block';
  } else {
    roomKeyWrap.style.display = 'none';
    roomKeyInput.value = '';
  }
}

async function createRoom() {
  const bank = getCurrentBank();
  if (!bank) return;

  const roomQuestions = getRoomQuestionSnapshot();

  if (!roomQuestions.length) {
    showToast('請至少勾選一題帶進房間');
    return;
  }

  const isTeam = $('teamModeSelect').value === 'true';
  const teamCount = isTeam ? Math.max(2, parseInt($('teamCountInput')?.value) || 2) : 0;
  const teamSize = isTeam ? Math.max(1, parseInt($('teamSizeInput')?.value) || 4) : 0;
  const teamPlayMode = isTeam ? String($('teamPlayModeSelect')?.value || 'classic') : 'classic';
  const teamNames = isTeam
    ? [...document.querySelectorAll('.team-name-input')].map((el) => el.value.trim())
    : [];

  try {
    const isPrivate = $('isPrivateInput').checked;
    const roomKey = $('roomKeyInput').value.trim();
    const allowLobbyJoin = isPrivate ? true : $('allowLobbyJoinInput').checked;

    if (isPrivate && !roomKey) {
      showToast('設定金鑰時請輸入房間金鑰');
      return;
    }

    const data = await api('/create_room', {
      method: 'POST',
      body: JSON.stringify({
        bankId: bank.id,
        bankTitle: $('quizBankTitle').value.trim() || bank.title,
        createdBy: state.currentUser,
        roomName: $('roomNameInput').value.trim(),
        isPrivate,
        roomKey,
        maxPlayers: $('maxPlayersInput').value,
        allowLobbyJoin,
        teamMode: isTeam,
        teamCount,
        teamSize,
        teamPlayMode,
        teamNames,
        roomTheme: $('roomThemeSelect')?.value || 'classic',
        musicTheme: $('roomMusicThemeSelect')?.value || 'spark',
        roomQuestions
      })
    });

    localStorage.setItem('pendingJoinContext', JSON.stringify({
      room: data.room,
      roomKey,
      isHost: true
    }));

    roomSettingsModal.hide();
    showToast(`房間建立成功，PIN：${data.room.pin}`);

    setTimeout(() => (window.location.href = 'player_join.html'), 700);
  } catch (e) {
    showToast(e.message);
    window.quizAudio?.fail?.();
  }
}

async function generateAiBank() {
  if (state.isGeneratingAi) return;

  const topic = $('aiTopicInput').value.trim();

  if (!topic) {
    showToast('請先輸入 AI 題庫主題');
    return;
  }

  const generateBtn = $('generateAiBankBtn');
  const originalText = generateBtn.innerHTML;

  state.isGeneratingAi = true;
  generateBtn.disabled = true;
  generateBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> 生成中...';

  try {
    const sourceMode = $('aiSourceModeInput')?.value || 'ai';
    const data = await api('/generate_quiz_bank', {
      method: 'POST',
      body: JSON.stringify({
        topic: sourceMode === 'kahoot_share'
          ? `${topic}，請模擬 Kahoot 分享題庫常見的短題幹、快節奏選項與課堂互動題型`
          : topic,
        category: $('aiCategoryInput').value.trim(),
        difficulty: $('aiDifficultyInput').value,
        language: $('bankLanguage')?.value || localStorage.getItem('quizLang') || 'zh',
        sourceMode,
        storyMode: sourceMode === 'story',
        count: Number($('aiCountInput')?.value || 5)
      })
    });

    if (!data.quizBank) {
      throw new Error('AI 沒有回傳題庫資料');
    }

    insertEditableBank(data.quizBank);
    syncCurrentBankHeader();

    await saveAllBanks();

    renderBankList();
    renderQuestionList();
    resetQuestionForm();

    showToast('AI 題庫已加入你的題庫清單');
    window.quizAudio?.success?.();
  } catch (e) {
    showToast(e.message || 'AI 題庫生成失敗');
    window.quizAudio?.fail?.();
  } finally {
    state.isGeneratingAi = false;
    generateBtn.disabled = false;
    generateBtn.innerHTML = originalText;
  }
}

function openWrongBookChallenge() {
  const wrongBookIndex = state.quizBanks.findIndex((bank) => bank.isWrongBook && (bank.questions || []).length);

  if (wrongBookIndex < 0) {
    showToast('目前還沒有錯題可以挑戰');
    return;
  }

  selectBank(wrongBookIndex);
  showToast('已切換到錯題本，直接選題後就能開房複習');
}

$('questionType').addEventListener('change', (e) => renderOptions(e.target.value));

$('quizBankTitle').addEventListener('input', () => {
  const bank = getCurrentBank();

  if (bank && !isReadonlyBank(bank)) {
    bank.title = $('quizBankTitle').value.trim();
  }

  renderBankList();
});

$('bankGameMode').addEventListener('change', () => {
  const bank = getCurrentBank();

  if (bank && !isReadonlyBank(bank)) {
    bank.gameMode = $('bankGameMode').value;
    renderBankList();
  }
});

$('bankLanguage').addEventListener('change', () => {
  const bank = getCurrentBank();

  if (bank && !isReadonlyBank(bank)) {
    bank.language = $('bankLanguage').value;
    localStorage.setItem('quizLang', bank.language);
    window.I18N?.applyLang?.(bank.language);
    renderBankList();
  }
});

$('newBankBtn').addEventListener('click', openNewBank);
$('confirmBankNameBtn').addEventListener('click', confirmBankName);
$('saveBankBtn').addEventListener('click', handleBankSave);
$('addQuestionBtn').addEventListener('click', handleAddQuestion);
$('copyQuestionBtn').addEventListener('click', copyCurrentQuestion);
$('pasteQuestionBtn').addEventListener('click', pasteQuestion);
$('clearQuestionBtn').addEventListener('click', resetQuestionForm);
$('deleteQuestionBtn').addEventListener('click', handleDeleteQuestion);
$('generateAiBankBtn').addEventListener('click', generateAiBank);
$('openWrongBookBtn').addEventListener('click', openWrongBookChallenge);

$('openRoomSettingsBtn').addEventListener('click', () => {
  const bank = getCurrentBank();

  if (bank) {
    const isTeam = bank.gameMode === 'team';
    $('teamModeSelect').value = isTeam ? 'true' : 'false';

    const wrap = $('teamSettingsWrap');

    if (wrap) {
      wrap.style.display = isTeam ? 'block' : 'none';

      if (isTeam) {
        buildTeamNameInputs(parseInt($('teamCountInput')?.value) || 2);
      }
    }
  }

  buildRoomQuestionPicker();
  roomSettingsModal.show();
});

$('confirmCreateRoomBtn').addEventListener('click', createRoom);

$('isPrivateInput').addEventListener('change', () => syncRoomAccessMode('private'));
$('allowLobbyJoinInput').addEventListener('change', () => syncRoomAccessMode('lobby'));

$('teamModeSelect').addEventListener('change', () => {
  const isTeam = $('teamModeSelect').value === 'true';
  const wrap = $('teamSettingsWrap');

  if (wrap) {
    wrap.style.display = isTeam ? 'block' : 'none';

    if (isTeam) {
      buildTeamNameInputs(parseInt($('teamCountInput')?.value) || 2);
    }
  }
});

$('teamCountInput')?.addEventListener('change', () => {
  buildTeamNameInputs(parseInt($('teamCountInput').value) || 2);
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

  syncRoomAccessMode();

  try {
    await loadBanks();
  } catch (e) {
    const localDraftBanks = loadLocalDraft();
    if (localDraftBanks.length) {
      state.quizBanks = mergeLoadedBanks(localDraftBanks, [], null);
      state.currentBankIndex = firstEditableBankIndex();
      syncCurrentBankHeader();
      renderBankList();
      renderQuestionList();
      resetQuestionForm();
      showToast('已從瀏覽器草稿恢復題庫資料');
      return;
    }
    showToast(e.message || '題庫讀取失敗');
  }
})();
