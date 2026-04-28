/* ================================================================
   quizarena_fix.js — 全面修正版
   修正項目：
   1. [object PointerEvent] 名稱 bug
   2. 好友數 / 成就 / 錯題數讀不到
   3. 上傳圖片無法讀取
   4. 深色模式跨頁同步
   5. 翻譯不完整（補全所有頁面字串）
   6. profileDisplayNameInput 重複綁定問題
   ================================================================ */

document.addEventListener('DOMContentLoaded', function () {

  /* ── 1. 深色模式跨頁同步 ── */
  if (localStorage.getItem('quizDarkMode') === '1') {
    document.body.classList.add('dark-mode');
  }

  /* ── 2. [object PointerEvent] / displayName 修正 ──
     根本原因：index.js 第一版 renderProfileSummary 把 event 物件賦值給 input.value
     這裡在 modal 開啟後再做一次保險修正 */
  function fixDisplayName() {
    var nameInput = document.getElementById('profileDisplayNameInput');
    if (!nameInput) return;
    var val = nameInput.value || '';
    if (val.includes('[object') || val.trim() === '') {
      var user = localStorage.getItem('currentUser') || '';
      nameInput.value = user;
    }
  }

  /* 監聽 profileModal 開啟 */
  var profileModalEl = document.getElementById('profileModal');
  if (profileModalEl) {
    profileModalEl.addEventListener('shown.bs.modal', function () {
      setTimeout(fixDisplayName, 80);
    });
  }

  /* ── 3. 上傳頭像圖片修正 ──
     額外綁定 change 事件（防止 index.js 的 handleProfileAvatarInput 沒正確執行） */
  var avatarInput = document.getElementById('profileAvatarInput');
  var avatarPreview = document.getElementById('profilePhotoPreview');
  var builderFace = document.getElementById('profileBuilderFace');

  if (avatarInput) {
    /* 移除可能重複的舊事件（用 clone 替換） */
    var freshInput = avatarInput.cloneNode(true);
    avatarInput.parentNode.replaceChild(freshInput, avatarInput);

    freshInput.addEventListener('change', function (e) {
      var file = e.target.files && e.target.files[0];
      if (!file) return;
      if (file.size > 2 * 1024 * 1024) {
        alert('頭像檔案請小於 2MB');
        e.target.value = '';
        return;
      }
      var reader = new FileReader();
      reader.onload = function (ev) {
        var dataUrl = ev.target.result;
        /* 即時預覽 */
        var prev = document.getElementById('profilePhotoPreview');
        if (prev) { prev.src = dataUrl; prev.style.display = 'block'; }
        /* 更新 index.js state（如果可用） */
        if (window._qa_state_set_avatar) window._qa_state_set_avatar(dataUrl);
        localStorage.setItem('qa_avatar_draft', dataUrl);
      };
      reader.readAsDataURL(file);
    });
  }

  /* ── 4. 好友數 / 成就 / 錯題數 — 強制從 API 刷新 ──
     index.js 已有正確的 loadProfileSummary / renderProfileSummary，
     但首次載入時 profileModal 尚未開過，stats 可能停在 0。
     這裡確保 profileModal 開啟時 stats 已填入。 */
  var _profileModalEl = document.getElementById('profileModal');
  if (_profileModalEl) {
    _profileModalEl.addEventListener('show.bs.modal', function () {
      /* 觸發 index.js 的 loadProfileSummary（它已掛在全域或 closure 內）
         若無法直接呼叫，就直接用 fetch */
      var user = localStorage.getItem('currentUser') || '';
      if (!user) return;
      fetch('/profile_summary?username=' + encodeURIComponent(user))
        .then(function (r) { return r.json(); })
        .then(function (data) {
          if (data && data.success !== false) {
            _fillProfileStats(data);
          }
        })
        .catch(function () { /* silent */ });
    });
  }

  function _fillProfileStats(data) {
    function setText(id, val) {
      var el = document.getElementById(id);
      if (el) el.textContent = String(val);
    }
    setText('profileWinsText', Number(data.wins || 0));
    setText('profileAchievementsText', (Number(data.unlockedCount || 0)) + ' / ' + (Number(data.totalAchievementCount || 0)));
    setText('profileFriendsText', Number(data.friendCount || 0));
    setText('profileWrongBookText', Number(data.wrongBookCount || 0));
    setText('profileUsernameText', data.username || localStorage.getItem('currentUser') || '玩家');
    setText('profileTitleText', data.title || '新手冒險家');
    /* displayName input */
    var dnInput = document.getElementById('profileDisplayNameInput');
    if (dnInput) {
      var dn = data.displayName || data.username || localStorage.getItem('currentUser') || '';
      if (!dnInput.value || dnInput.value.includes('[object')) dnInput.value = dn;
    }
  }

  /* ── 5. 翻譯補丁 — 擴充 i18n 字典未涵蓋的字串 ── */
  if (window.I18N && typeof I18N.scan === 'function') {
    /* 補充字典詞條（注入到 D 需要透過 applyLang 重掃） */
    var _extraKeys = {
      '錯題練習':       { en:'Wrong Answers', ja:'間違い練習', ko:'오답 연습', es:'Práctica errores' },
      '老師看報表':     { en:'Teacher Report', ja:'教師レポート', ko:'교사 보고서', es:'Informe docente' },
      '好友排行':       { en:'Friend Ranking', ja:'フレンドランキング', ko:'친구 순위', es:'Ranking amigos' },
      '加入好友':       { en:'Add Friend', ja:'フレンド追加', ko:'친구 추가', es:'Agregar amigo' },
      '好友戰績榜':     { en:'Friend Leaderboard', ja:'フレンドランキング', ko:'친구 순위표', es:'Clasificación' },
      '好友申請':       { en:'Friend Request', ja:'フレンド申請', ko:'친구 신청', es:'Solicitud' },
      '好友申請紀錄':   { en:'Friend Requests', ja:'フレンド申請履歴', ko:'친구 신청 기록', es:'Solicitudes' },
      '重新整理大廳':   { en:'Refresh Lobby', ja:'ロビー更新', ko:'로비 새로고침', es:'Actualizar sala' },
      '個人資料':       { en:'Profile', ja:'プロフィール', ko:'프로필', es:'Perfil' },
      '建立題庫':       { en:'Create Quiz', ja:'クイズ作成', ko:'퀴즈 만들기', es:'Crear quiz' },
      '登入後可編輯個人檔案': { en:'Login to edit profile', ja:'ログインしてプロフィール編集', ko:'로그인하여 프로필 수정', es:'Inicia sesión para editar' },
      '目前登入帳號':   { en:'Logged in as', ja:'ログイン中', ko:'로그인 계정', es:'Sesión' },
      '勝場':           { en:'Wins', ja:'勝利数', ko:'승리', es:'Victorias' },
      '已解鎖成就':     { en:'Achievements', ja:'実績', ko:'업적', es:'Logros' },
      '好友數':         { en:'Friends', ja:'フレンド数', ko:'친구 수', es:'Amigos' },
      '錯題收藏':       { en:'Wrong Book', ja:'間違いノート', ko:'오답 노트', es:'Errores guardados' },
      '顯示名稱':       { en:'Display Name', ja:'表示名', ko:'표시 이름', es:'Nombre visible' },
      '上傳頭像':       { en:'Upload Avatar', ja:'アバターアップロード', ko:'아바타 업로드', es:'Subir avatar' },
      '所在縣市':       { en:'City / County', ja:'都市', ko:'도시', es:'Ciudad' },
      '擅長領域':       { en:'Specialty', ja:'得意分野', ko:'전문 분야', es:'Especialidad' },
      '個人簡介':       { en:'Bio', ja:'自己紹介', ko:'자기소개', es:'Descripción' },
      '儲存個人資料':   { en:'Save Profile', ja:'プロフィール保存', ko:'프로필 저장', es:'Guardar perfil' },
      '只計算每局第一名的勝場': { en:'Only counts 1st place wins', ja:'1位のみカウント', ko:'1위만 집계', es:'Solo cuenta victorias 1°' },
      '回首頁':         { en:'Home', ja:'ホームへ', ko:'홈으로', es:'Inicio' },
      '班級答對率':     { en:'Class Accuracy', ja:'クラス正解率', ko:'학급 정답률', es:'Precisión de clase' },
      '學生排行榜':     { en:'Student Ranking', ja:'生徒ランキング', ko:'학생 순위', es:'Ranking estudiantes' },
      '答錯熱點題目':   { en:'Top Wrong Questions', ja:'誤答ホット問題', ko:'오답 인기 문제', es:'Preguntas falladas' },
      '最近錯題':       { en:'Recent Mistakes', ja:'最近の間違い', ko:'최근 오답', es:'Errores recientes' },
      '練習模式':       { en:'Practice Mode', ja:'練習モード', ko:'연습 모드', es:'Modo práctica' },
      '答錯分析':       { en:'Error Analysis', ja:'誤答分析', ko:'오답 분석', es:'Análisis de errores' },
      '收藏題目':       { en:'Saved Questions', ja:'保存した問題', ko:'저장된 문제', es:'Preguntas guardadas' },
    };

    /* 把補充詞條混入 i18n 字典（透過掃 DOM 後重翻） */
    var _origTr = I18N.tr;
    /* 注入 extra 後重掃 DOM 並重新套用當前語言 */
    Object.assign(I18N, {
      tr: function(key) {
        if (!key) return key;
        var lang = I18N.currentLang();
        if (lang === 'zh') return key;
        if (_extraKeys[key] && _extraKeys[key][lang]) return _extraKeys[key][lang];
        return _origTr(key);
      }
    });

    /* 對補充詞條補做 data-i18n 標記 */
    function _patchExtraKeys() {
      var lang = I18N.currentLang();
      document.querySelectorAll('*').forEach(function(el) {
        if (el.children.length > 0) return;
        var txt = (el.textContent || '').trim();
        if (_extraKeys[txt] && !el.dataset.i18n) {
          el.dataset.i18n = txt;
          if (lang !== 'zh' && _extraKeys[txt][lang]) {
            el.textContent = _extraKeys[txt][lang];
          }
        }
      });
      /* placeholders */
      document.querySelectorAll('[placeholder]').forEach(function(el) {
        var ph = el.placeholder.trim();
        if (_extraKeys[ph] && !el.dataset.i18nPh) {
          el.dataset.i18nPh = ph;
          var lang2 = I18N.currentLang();
          if (lang2 !== 'zh' && _extraKeys[ph][lang2]) el.placeholder = _extraKeys[ph][lang2];
        }
      });
    }

    setTimeout(_patchExtraKeys, 200);

    /* 讓語言切換時也翻補充字串 */
    document.querySelectorAll('.lang-switcher').forEach(function(sel) {
      sel.addEventListener('change', function() {
        setTimeout(_patchExtraKeys, 60);
      });
    });

    /* 監聽 lang-switcher-slot 填入後的事件（動態注入） */
    var _obs = new MutationObserver(function() {
      document.querySelectorAll('.lang-switcher:not([data-fix-bound])').forEach(function(sel) {
        sel.dataset.fixBound = '1';
        sel.addEventListener('change', function() {
          setTimeout(_patchExtraKeys, 60);
        });
      });
    });
    _obs.observe(document.body, { childList: true, subtree: true });
  }

  /* ── 6. 好友排行好友列表對齊 ── */
  function _fixFriendsLayout() {
    document.querySelectorAll('.friends-record-card').forEach(function(card) {
      card.style.display = 'flex';
      card.style.flexDirection = 'column';
    });
  }
  setTimeout(_fixFriendsLayout, 500);
  setInterval(_fixFriendsLayout, 3000);

});
