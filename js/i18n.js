/* ================================================================
   i18n.js  v2  ─  全站即時翻譯（可靠版）
   - 用 data-i18n 屬性存原始 key，不靠 textContent 比對
   - 支援中文 / English / 日本語 / 한국어 / Español
   - 中文 = 預設，不做任何翻譯
   - 記憶語言設定於 localStorage
   ================================================================ */

const I18N = (() => {

  /* ── 字典（key = 中文原文）────────────────────────────── */
  const D = {
    /* ── 通用 ── */
    '登入 / 註冊':    { en:'Login / Register', ja:'ログイン / 登録', ko:'로그인 / 가입', es:'Entrar / Registrar' },
    '登入':           { en:'Login', ja:'ログイン', ko:'로그인', es:'Iniciar sesión' },
    '登出':           { en:'Logout', ja:'ログアウト', ko:'로그아웃', es:'Cerrar sesión' },
    '註冊':           { en:'Register', ja:'登録', ko:'회원가입', es:'Registrarse' },
    '取消':           { en:'Cancel', ja:'キャンセル', ko:'취소', es:'Cancelar' },
    '知道了':         { en:'Got it', ja:'了解', ko:'확인', es:'Entendido' },
    '回首頁':         { en:'Home', ja:'ホーム', ko:'홈으로', es:'Inicio' },
    '確認加入':       { en:'Confirm', ja:'確認参加', ko:'확인 참가', es:'Confirmar' },
    '取消':           { en:'Cancel', ja:'キャンセル', ko:'취소', es:'Cancelar' },

    /* ── 首頁 ── */
    '目前帳號':       { en:'Account', ja:'アカウント', ko:'계정', es:'Cuenta' },
    '尚未登入':       { en:'Not logged in', ja:'未ログイン', ko:'미로그인', es:'Sin sesión' },
    '題庫中心':       { en:'Question Bank', ja:'問題バンク', ko:'문제 은행', es:'Banco de preguntas' },
    '重新整理':       { en:'Refresh', ja:'更新', ko:'새로고침', es:'Actualizar' },
    'Game Lobby':     { en:'Game Lobby', ja:'ゲームロビー', ko:'게임 로비', es:'Sala de juegos' },
    'Join Room':      { en:'Join Room', ja:'参加する', ko:'방 참가', es:'Unirse' },
    '等待中':         { en:'Waiting', ja:'待機中', ko:'대기 중', es:'Esperando' },
    '玩家總數':       { en:'Players', ja:'プレイヤー数', ko:'전체 플레이어', es:'Jugadores' },
    '私人房':         { en:'Private', ja:'非公開', ko:'비공개', es:'Privadas' },
    '個人賽':         { en:'Solo', ja:'個人戦', ko:'개인전', es:'Individual' },
    '團體賽':         { en:'Team', ja:'チーム戦', ko:'팀전', es:'Equipo' },
    '公開':           { en:'Public', ja:'公開', ko:'공개', es:'Público' },
    '進行中':         { en:'In progress', ja:'進行中', ko:'진행 중', es:'En curso' },
    '加入':           { en:'Join', ja:'参加', ko:'참가', es:'Unirse' },

    /* ── 登入 Modal ── */
    '會員中心':       { en:'Member Center', ja:'会員センター', ko:'회원 센터', es:'Centro de miembros' },
    '帳號':           { en:'Username', ja:'ユーザー名', ko:'사용자명', es:'Usuario' },
    '密碼':           { en:'Password', ja:'パスワード', ko:'비밀번호', es:'Contraseña' },
    'Email':          { en:'Email', ja:'メール', ko:'이메일', es:'Correo' },
    '請輸入帳號':     { en:'Enter username', ja:'ユーザー名を入力', ko:'사용자명 입력', es:'Tu usuario' },
    '請輸入密碼':     { en:'Enter password', ja:'パスワードを入力', ko:'비밀번호 입력', es:'Tu contraseña' },
    '請輸入 Email':   { en:'Enter email', ja:'メールを入力', ko:'이메일 입력', es:'Tu correo' },

    /* ── player_join ── */
    '髮型':           { en:'Hair', ja:'髪型', ko:'헤어', es:'Cabello' },
    '眼睛':           { en:'Eyes', ja:'目', ko:'눈', es:'Ojos' },
    '隨機':           { en:'Random', ja:'ランダム', ko:'랜덤', es:'Aleatorio' },
    '重設':           { en:'Reset', ja:'リセット', ko:'초기화', es:'Reiniciar' },
    '眼睛位置微調':   { en:'Eye position', ja:'目の位置', ko:'눈 위치', es:'Posición ojos' },
    '進入房間':       { en:'Enter Room', ja:'部屋に入る', ko:'방 입장', es:'Entrar' },
    '玩家名稱':       { en:'Player name', ja:'プレイヤー名', ko:'플레이어 이름', es:'Nombre' },
    '請輸入玩家名稱': { en:'Enter player name', ja:'プレイヤー名を入力', ko:'플레이어 이름 입력', es:'Tu nombre' },
    '房間名稱':       { en:'Room name', ja:'ルーム名', ko:'방 이름', es:'Sala' },
    '房間 PIN':       { en:'Room PIN', ja:'ルームPIN', ko:'방 PIN', es:'PIN' },
    '題庫':           { en:'Bank', ja:'問題バンク', ko:'문제 은행', es:'Banco' },
    '模式':           { en:'Mode', ja:'モード', ko:'모드', es:'Modo' },

    /* ── 等待室 ── */
    '✦ ROOM PIN ✦':  { en:'✦ ROOM PIN ✦', ja:'✦ ルーム PIN ✦', ko:'✦ 방 PIN ✦', es:'✦ SALA PIN ✦' },
    '✦ Player chat ✦':{ en:'✦ Player chat ✦', ja:'✦ チャット ✦', ko:'✦ 채팅 ✦', es:'✦ Chat ✦' },
    '✦ Player Joined ✦':{ en:'✦ Players ✦', ja:'✦ 参加者 ✦', ko:'✦ 참가자 ✦', es:'✦ Jugadores ✦' },
    'Share this PIN with friends':{ en:'Share this PIN', ja:'PINを共有', ko:'PIN 공유', es:'Comparte el PIN' },
    'Host room':      { en:'Host room', ja:'ホストルーム', ko:'호스트 방', es:'Sala del anfitrión' },
    '狀態':           { en:'Status', ja:'ステータス', ko:'상태', es:'Estado' },
    'No messages yet...':{ en:'No messages yet...', ja:'メッセージなし...', ko:'메시지 없음...', es:'Sin mensajes...' },
    'Type a message': { en:'Type a message', ja:'メッセージを入力', ko:'메시지 입력', es:'Escribe un mensaje' },
    'PLAYER':         { en:'PLAYER', ja:'プレイヤー', ko:'플레이어', es:'JUGADOR' },
    'HOST':           { en:'HOST', ja:'ホスト', ko:'호스트', es:'ANFITRIÓN' },
    '離開房間':       { en:'Leave Room', ja:'退室', ko:'방 나가기', es:'Salir' },
    '開始遊戲':       { en:'Start Game', ja:'ゲーム開始', ko:'게임 시작', es:'Iniciar juego' },
    'Waiting for host to start the game...':
      { en:'Waiting for host to start...', ja:'ホストの開始を待機中...', ko:'호스트 시작 대기 중...', es:'Esperando al anfitrión...' },
    '你是房主，可以確認玩家都進來後再開始。':
      { en:"You're the host. Start when ready.", ja:'ホストです。準備ができたら開始。', ko:'호스트입니다. 준비되면 시작하세요.', es:'Eres el anfitrión. Empieza cuando estés listo.' },
    '選擇你的隊伍':   { en:'Choose your team', ja:'チームを選択', ko:'팀 선택', es:'Elige tu equipo' },
    '團體賽分組':     { en:'Team Setup', ja:'チーム分け', ko:'팀 구성', es:'Equipos' },
    '隨機分組':       { en:'Shuffle Teams', ja:'ランダム分け', ko:'랜덤 배정', es:'Aleatorio' },

    /* ── 遊戲頁 ── */
    '倒數':           { en:'Timer', ja:'残り時間', ko:'카운트다운', es:'Tiempo' },
    '分數':           { en:'Score', ja:'スコア', ko:'점수', es:'Puntos' },
    '玩家':           { en:'Player', ja:'プレイヤー', ko:'플레이어', es:'Jugador' },
    '身分':           { en:'Role', ja:'役割', ko:'역할', es:'Rol' },
    '離開':           { en:'Leave', ja:'退出', ko:'나가기', es:'Salir' },
    '題目載入中...':  { en:'Loading...', ja:'読み込み中...', ko:'로딩 중...', es:'Cargando...' },
    '🏅 排行榜':      { en:'🏅 Leaderboard', ja:'🏅 ランキング', ko:'🏅 순위표', es:'🏅 Clasificación' },
    '玩家答題狀況':   { en:'Player Status', ja:'プレイヤー状況', ko:'플레이어 현황', es:'Estado' },
    '本題各選項統計': { en:'Option Stats', ja:'選択肢統計', ko:'선택지 통계', es:'Estadísticas' },
    '提交答案':       { en:'Submit', ja:'回答する', ko:'제출', es:'Enviar' },
    '你已被淘汰':     { en:'You are eliminated', ja:'脱落しました', ko:'탈락했습니다', es:'Estás eliminado' },
    '繼續觀戰':       { en:'Keep Watching', ja:'観戦を続ける', ko:'계속 관전', es:'Seguir viendo' },
    '進入下一題':     { en:'Next Question', ja:'次の問題へ', ko:'다음 문제', es:'Siguiente' },
    '所有人已作答，結束本題':
      { en:'All answered — end question', ja:'全員回答済み — 終了', ko:'전원 답변 완료 — 종료', es:'Todos respondieron' },
    '查看完整結算':   { en:'View Scoreboard', ja:'全スコアを見る', ko:'전체 점수 보기', es:'Ver clasificación' },
    '📊 本題結果':    { en:'📊 Round Result', ja:'📊 この問題の結果', ko:'📊 이번 문제 결과', es:'📊 Resultado' },
    '目前前五名':     { en:'Top 5', ja:'トップ5', ko:'상위 5위', es:'Top 5' },
    '目前排行':       { en:'Rankings', ja:'現在の順位', ko:'현재 순위', es:'Clasificación' },
    '💀 本題淘汰玩家':{ en:'💀 Eliminated', ja:'💀 今回の脱落者', ko:'💀 탈락자', es:'💀 Eliminados' },
    '🏆 遊戲結束！最終排名':{ en:'🏆 Final Rankings', ja:'🏆 最終順位', ko:'🏆 최종 순위', es:'🏆 Clasificación final' },
    '📊 完整結算':    { en:'📊 Full Scoreboard', ja:'📊 全スコア', ko:'📊 전체 점수', es:'📊 Puntuación' },
    '回首頁':         { en:'Home', ja:'ホームへ', ko:'홈으로', es:'Inicio' },
    '🎉 遊戲結束！':  { en:'🎉 Game Over!', ja:'🎉 ゲーム終了！', ko:'🎉 게임 종료!', es:'🎉 ¡Fin del juego!' },
    '你的總分：':     { en:'Your score: ', ja:'合計スコア：', ko:'총점: ', es:'Puntuación: ' },
    '感謝參與，最終結果請見結算頁面。':
      { en:'Thanks for playing!', ja:'ご参加ありがとう！', ko:'참여 감사합니다!', es:'¡Gracias por jugar!' },
    '📋 每人每題明細（房主限定）':
      { en:'📋 Detail (host only)', ja:'📋 詳細（ホストのみ）', ko:'📋 상세 (호스트 전용)', es:'📋 Detalle (solo anfitrión)' },
    '正解：':         { en:'Answer: ', ja:'正解：', ko:'정답: ', es:'Respuesta: ' },
    '本題得分：':     { en:'Points: ', ja:'獲得：', ko:'점수: ', es:'Puntos: ' },
    '我的目前總分：': { en:'Total: ', ja:'合計：', ko:'합계: ', es:'Total: ' },

    /* ── 題庫中心 ── */
    '我的題庫':       { en:'My Banks', ja:'問題バンク', ko:'내 문제 은행', es:'Mis bancos' },
    '儲存題庫':       { en:'Save Bank', ja:'バンク保存', ko:'뱅크 저장', es:'Guardar' },
    '建立房間':       { en:'Create Room', ja:'部屋を作る', ko:'방 만들기', es:'Crear sala' },
    '題庫名稱':       { en:'Bank name', ja:'バンク名', ko:'뱅크 이름', es:'Nombre' },
    '題庫賽制':       { en:'Mode', ja:'ゲームモード', ko:'게임 모드', es:'Modo de juego' },
    '題目名稱':       { en:'Question title', ja:'問題タイトル', ko:'문제 제목', es:'Título' },
    '題目內容':       { en:'Content', ja:'問題内容', ko:'내용', es:'Contenido' },
    '題型':           { en:'Type', ja:'種類', ko:'유형', es:'Tipo' },
    '單選題':         { en:'Single choice', ja:'単一選択', ko:'단일 선택', es:'Una respuesta' },
    '多選題':         { en:'Multiple choice', ja:'複数選択', ko:'복수 선택', es:'Múltiple respuesta' },
    '是非題':         { en:'True/False', ja:'○×問題', ko:'참/거짓', es:'V/F' },
    '秒數':           { en:'Seconds', ja:'秒数', ko:'초', es:'Segundos' },
    '最高分':         { en:'Max pts', ja:'最高得点', ko:'최대 점수', es:'Pts máx.' },
    '選項設定':       { en:'Options', ja:'選択肢', ko:'선택지', es:'Opciones' },
    '詳解 / 解析':    { en:'Explanation', ja:'解説', ko:'해설', es:'Explicación' },
    '淘汰模式':       { en:'Elimination', ja:'脱落モード', ko:'탈락 모드', es:'Eliminación' },
    '新增 / 更新題目':{ en:'Add / Update', ja:'追加 / 更新', ko:'추가 / 수정', es:'Agregar' },
    '複製題目':       { en:'Copy', ja:'コピー', ko:'복사', es:'Copiar' },
    '貼上到目前題庫': { en:'Paste', ja:'貼り付け', ko:'붙여넣기', es:'Pegar' },
    '清空表單':       { en:'Clear', ja:'クリア', ko:'초기화', es:'Limpiar' },
    '刪除題目':       { en:'Delete', ja:'削除', ko:'삭제', es:'Eliminar' },
    '目前題目清單':   { en:'Questions', ja:'問題一覧', ko:'문제 목록', es:'Lista' },
  };

  let lang = localStorage.getItem('quizLang') || 'zh';

  /* ── 翻譯一個字串 ── */
  function tr(key) {
    if (lang === 'zh' || !key) return key;
    const row = D[key];
    if (!row) return key;
    return row[lang] || key;
  }

  /* ── 把元素打上 data-i18n 標記並翻譯 ── */
  function markAndTranslate(el) {
    if (!el || el.nodeType !== 1) return;
    const tag = el.tagName;
    if (['SCRIPT','STYLE','NOSCRIPT','SELECT','OPTION'].includes(tag)) return;

    // 翻譯 placeholder
    if (el.placeholder) {
      const origPh = el.dataset.i18nPh || el.placeholder;
      el.dataset.i18nPh = origPh;
      el.placeholder = lang === 'zh' ? origPh : (tr(origPh) || origPh);
    }

    // 只處理只有純文字的元素（沒有子元素或只有 1 個文字節點）
    const children = [...el.childNodes];
    const textOnly = children.every(n => n.nodeType === 3); // 全部都是 Text

    if (textOnly && el.textContent.trim()) {
      const origText = el.dataset.i18n || el.textContent.trim();
      el.dataset.i18n = origText;
      const translated = lang === 'zh' ? origText : (tr(origText) || origText);
      if (translated !== el.textContent.trim()) {
        el.textContent = translated;
      }
    }
  }

  /* ── 掃描整個 DOM ── */
  function translateAll() {
    // 對所有已有 data-i18n 的元素直接重翻
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const orig = el.dataset.i18n;
      el.textContent = lang === 'zh' ? orig : (tr(orig) || orig);
    });
    document.querySelectorAll('[data-i18n-ph]').forEach(el => {
      const orig = el.dataset.i18nPh;
      el.placeholder = lang === 'zh' ? orig : (tr(orig) || orig);
    });

    // 首次：掃描未標記的元素
    const skip = new Set(['SCRIPT','STYLE','NOSCRIPT','SVG','PATH','INPUT','TEXTAREA','SELECT','OPTION']);
    function walk(node) {
      if (node.nodeType === 1) {
        if (skip.has(node.tagName)) return;
        if (node.dataset?.i18nSkip) return;
        // 如果有 id/class 屬性裡有特定功能元素，跳過
        if (['chatList','playerList','leaderboardList','hostAnswerStatus',
             'hostAnswerBreakdown','playerSideList','optionsList','hostOptionsList',
             'resultTop5List','hostResultTop5List','scoreboardWrap','podiumInner',
             'hostDetailWrap','teamColumnsWrap','teamJoinButtons'].includes(node.id)) {
          node.dataset.i18nSkip = '1';
          return;
        }
        markAndTranslate(node);
        node.childNodes.forEach(walk);
      }
    }
    walk(document.body);
  }

  /* ── 套用語言 ── */
  function apply(newLang) {
    lang = newLang;
    localStorage.setItem('quizLang', newLang);
    translateAll();
    document.querySelectorAll('.lang-switcher').forEach(s => { s.value = newLang; });
  }

  /* ── 建立選單 DOM ── */
  function makeSwitcher() {
    const sel = document.createElement('select');
    sel.className = 'lang-switcher';
    sel.title = 'Language';
    [
      ['zh','🌐 中文'],['en','🌐 English'],['ja','🌐 日本語'],
      ['ko','🌐 한국어'],['es','🌐 Español']
    ].forEach(([v,l]) => {
      const o = document.createElement('option');
      o.value = v; o.textContent = l;
      sel.appendChild(o);
    });
    sel.value = lang;
    sel.addEventListener('change', () => apply(sel.value));
    return sel;
  }

  /* ── 注入所有 slot ── */
  function injectSlots() {
    document.querySelectorAll('.lang-switcher-slot').forEach(slot => {
      if (!slot.querySelector('.lang-switcher')) {
        slot.appendChild(makeSwitcher());
      }
    });
    // 同步 quiz_game.html 的 #langSelect
    const ex = document.getElementById('langSelect');
    if (ex && !ex.classList.contains('lang-switcher')) {
      ex.classList.add('lang-switcher');
      ex.value = lang;
      ex.addEventListener('change', () => apply(ex.value));
    }
  }

  /* ── 初始化 ── */
  function init() {
    injectSlots();
    if (lang !== 'zh') translateAll();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    setTimeout(init, 0);
  }

  return { apply, makeSwitcher, currentLang: () => lang, tr };
})();
