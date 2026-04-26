/* ================================================================
   i18n.js  ─  全站即時翻譯
   用法：每頁 HTML 加 <script src="js/i18n.js"></script>
   中文 = 預設雙語（中文 UI，英文副標籤）
   其他語言 = 全部換成目標語言
   ================================================================ */

const I18N = (() => {

  /* ── 所有要翻譯的字串 ────────────────────────────────
     key: 中文原文（同時是 data-i18n 屬性值）
     每個語言提供對應翻譯
  ──────────────────────────────────────────────────── */
  const DICT = {

    /* ── 首頁 index.html ── */
    '目前帳號':        { en:'Account', ja:'アカウント', ko:'계정', es:'Cuenta' },
    '尚未登入':        { en:'Not logged in', ja:'未ログイン', ko:'미로그인', es:'Sin sesión' },
    '登入 / 註冊':    { en:'Login / Register', ja:'ログイン / 登録', ko:'로그인 / 가입', es:'Entrar / Registrar' },
    '登出':            { en:'Logout', ja:'ログアウト', ko:'로그아웃', es:'Cerrar sesión' },
    '題庫中心':        { en:'Question Bank', ja:'問題バンク', ko:'문제 은행', es:'Banco de preguntas' },
    '重新整理':        { en:'Refresh', ja:'更新', ko:'새로고침', es:'Actualizar' },
    '歡迎來到 QuizArena 遊戲大廳': { en:'Welcome to QuizArena Lobby', ja:'QuizArena へようこそ', ko:'QuizArena 로비', es:'Bienvenido a QuizArena' },
    '你可以直接輸入 PIN，也可以從首頁看公開房間、房主、人數、模式，看到喜歡的房間就立刻加入。':
      { en:'Enter a PIN or browse public rooms below to join instantly.',
        ja:'PINを入力するか、下のロビーから部屋を選んで参加してください。',
        ko:'PIN을 입력하거나 아래 로비에서 방을 선택해 바로 참여하세요.',
        es:'Ingresa un PIN o elige una sala del lobby para unirte.' },
    'Game Lobby':      { en:'Game Lobby', ja:'ゲームロビー', ko:'게임 로비', es:'Sala de juegos' },
    '可直接看到目前房間、房主、人數、公開 / 私人、個人賽 / 團體賽。':
      { en:'Browse active rooms — host, players, mode, and privacy.',
        ja:'部屋一覧：ホスト、人数、モード、公開/非公開。',
        ko:'방 목록：호스트, 인원, 모드, 공개/비공개.',
        es:'Lista de salas activas con host, jugadores y modo.' },
    '等待中':          { en:'Waiting', ja:'待機中', ko:'대기 중', es:'Esperando' },
    '玩家總數':        { en:'Players', ja:'プレイヤー数', ko:'전체 플레이어', es:'Jugadores' },
    '私人房':          { en:'Private', ja:'プライベート', ko:'비공개', es:'Privadas' },
    '輸入6位PIN碼':    { en:'Enter 6-digit PIN', ja:'6桁のPINを入力', ko:'6자리 PIN 입력', es:'Ingresa PIN de 6 dígitos' },
    'Join Room':       { en:'Join Room', ja:'参加する', ko:'방 참가', es:'Unirse' },

    /* ── 登入/註冊 modal ── */
    '會員中心':        { en:'Member Center', ja:'会員センター', ko:'회원 센터', es:'Centro de miembros' },
    '登入':            { en:'Login', ja:'ログイン', ko:'로그인', es:'Iniciar sesión' },
    '註冊':            { en:'Register', ja:'登録', ko:'회원가입', es:'Registrarse' },
    '帳號':            { en:'Username', ja:'ユーザー名', ko:'사용자명', es:'Usuario' },
    '密碼':            { en:'Password', ja:'パスワード', ko:'비밀번호', es:'Contraseña' },
    'Email':           { en:'Email', ja:'メール', ko:'이메일', es:'Correo' },
    '請輸入帳號':      { en:'Enter username', ja:'ユーザー名を入力', ko:'사용자명 입력', es:'Ingresa tu usuario' },
    '請輸入密碼':      { en:'Enter password', ja:'パスワードを入力', ko:'비밀번호 입력', es:'Ingresa tu contraseña' },
    '請輸入 Email':    { en:'Enter email', ja:'メールを入力', ko:'이메일 입력', es:'Ingresa tu correo' },
    '知道了':          { en:'Got it', ja:'了解', ko:'확인', es:'Entendido' },

    /* ── 私人房 modal ── */
    '私人房驗證':      { en:'Private Room Auth', ja:'プライベート認証', ko:'비공개 방 인증', es:'Verificación privada' },
    '請輸入房間密鑰':  { en:'Enter room key', ja:'ルームキーを入力', ko:'방 키 입력', es:'Ingresa la clave' },
    '輸入房間密鑰':    { en:'Room key', ja:'ルームキー', ko:'방 키', es:'Clave de sala' },
    '取消':            { en:'Cancel', ja:'キャンセル', ko:'취소', es:'Cancelar' },
    '確認加入':        { en:'Confirm', ja:'確認して参加', ko:'확인 참가', es:'Confirmar' },

    /* ── 大廳房間卡片 ── */
    '人':              { en:'', ja:'人', ko:'명', es:'' },
    '個人賽':          { en:'Solo', ja:'個人戦', ko:'개인전', es:'Individual' },
    '團體賽':          { en:'Team', ja:'チーム戦', ko:'팀전', es:'Equipo' },
    '公開':            { en:'Public', ja:'公開', ko:'공개', es:'Público' },
    '進行中':          { en:'In progress', ja:'進行中', ko:'진행 중', es:'En curso' },
    '加入':            { en:'Join', ja:'参加', ko:'참가', es:'Unirse' },
    '房間已滿':        { en:'Full', ja:'満員', ko:'만원', es:'Llena' },

    /* ── player_join.html ── */
    '進入房間前先整理門面': { en:'Customize your avatar before joining', ja:'参加前にアバターを設定', ko:'참가 전 아바타 설정', es:'Personaliza tu avatar antes de entrar' },
    '房間資料、玩家名稱與頭像都會同步到等待室與聊天室。':
      { en:'Your name and avatar will appear in the waiting room and chat.',
        ja:'名前とアバターは待合室とチャットに表示されます。',
        ko:'이름과 아바터는 대기실과 채팅에 표시됩니다.',
        es:'Tu nombre y avatar aparecerán en la sala de espera y el chat.' },
    '房間名稱':        { en:'Room name', ja:'ルーム名', ko:'방 이름', es:'Nombre de sala' },
    '房間 PIN':        { en:'Room PIN', ja:'ルームPIN', ko:'방 PIN', es:'PIN de sala' },
    '題庫':            { en:'Question bank', ja:'問題バンク', ko:'문제 은행', es:'Banco' },
    '模式':            { en:'Mode', ja:'モード', ko:'모드', es:'Modo' },
    '玩家名稱':        { en:'Player name', ja:'プレイヤー名', ko:'플레이어 이름', es:'Nombre del jugador' },
    '請輸入玩家名稱':  { en:'Enter player name', ja:'プレイヤー名を入力', ko:'플레이어 이름 입력', es:'Ingresa tu nombre' },
    '髮型':            { en:'Hair', ja:'髪型', ko:'헤어', es:'Cabello' },
    '眼睛':            { en:'Eyes', ja:'目', ko:'눈', es:'Ojos' },
    '隨機':            { en:'Random', ja:'ランダム', ko:'랜덤', es:'Aleatorio' },
    '重設':            { en:'Reset', ja:'リセット', ko:'초기화', es:'Reiniciar' },
    '眼睛位置微調':    { en:'Eye position', ja:'目の位置調整', ko:'눈 위치 조정', es:'Posición de ojos' },
    '進入房間':        { en:'Enter Room', ja:'部屋に入る', ko:'방 입장', es:'Entrar a la sala' },
    '回首頁':          { en:'Home', ja:'ホームへ', ko:'홈으로', es:'Inicio' },

    /* ── 等待室 waiting_room.html / house_waiting_room.html ── */
    '✦ ROOM PIN ✦':   { en:'✦ ROOM PIN ✦', ja:'✦ ルーム PIN ✦', ko:'✦ 방 PIN ✦', es:'✦ SALA PIN ✦' },
    'Share this PIN with friends': { en:'Share this PIN with friends', ja:'PINを友達に共有', ko:'PIN을 친구에게 공유', es:'Comparte este PIN con tus amigos' },
    'Host room':       { en:'Host room', ja:'ホストルーム', ko:'호스트 방', es:'Sala del anfitrión' },
    '狀態':            { en:'Status', ja:'ステータス', ko:'상태', es:'Estado' },
    '✦ Player chat ✦': { en:'✦ Player chat ✦', ja:'✦ チャット ✦', ko:'✦ 채팅 ✦', es:'✦ Chat ✦' },
    'No messages yet...': { en:'No messages yet...', ja:'まだメッセージなし...', ko:'메시지 없음...', es:'Sin mensajes aún...' },
    'Type a message':  { en:'Type a message', ja:'メッセージを入力', ko:'메시지 입력', es:'Escribe un mensaje' },
    '✦ Player Joined ✦': { en:'✦ Player Joined ✦', ja:'✦ 参加者 ✦', ko:'✦ 참가자 ✦', es:'✦ Jugadores ✦' },
    'PLAYER':          { en:'PLAYER', ja:'プレイヤー', ko:'플레이어', es:'JUGADOR' },
    'HOST':            { en:'HOST', ja:'ホスト', ko:'호스트', es:'ANFITRIÓN' },
    '離開房間':        { en:'Leave Room', ja:'退室', ko:'방 나가기', es:'Salir de sala' },
    'Waiting for host to start the game...': { en:'Waiting for host to start...', ja:'ホストの開始を待っています...', ko:'호스트 시작을 기다리는 중...', es:'Esperando al anfitrión...' },
    '你是房主，可以確認玩家都進來後再開始。': { en:"You're the host. Start when everyone is ready.", ja:'ホストです。全員が揃ったら開始してください。', ko:'호스트입니다. 모두 준비되면 시작하세요.', es:'Eres el anfitrión. Empieza cuando todos estén listos.' },
    '開始遊戲':        { en:'Start Game', ja:'ゲーム開始', ko:'게임 시작', es:'Iniciar juego' },
    '團體賽分組':      { en:'Team Setup', ja:'チーム分け', ko:'팀 구성', es:'Equipos' },
    '隨機分組':        { en:'Shuffle Teams', ja:'ランダム分け', ko:'랜덤 배정', es:'Aleatorio' },
    '選擇你的隊伍':    { en:'Choose your team', ja:'チームを選択', ko:'팀 선택', es:'Elige tu equipo' },

    /* ── 遊戲頁 quiz_game.html ── */
    '離開':            { en:'Leave', ja:'退出', ko:'나가기', es:'Salir' },
    '倒數':            { en:'Timer', ja:'残り時間', ko:'카운트다운', es:'Tiempo' },
    '分數':            { en:'Score', ja:'スコア', ko:'점수', es:'Puntos' },
    'PIN':             { en:'PIN', ja:'PIN', ko:'PIN', es:'PIN' },
    '玩家':            { en:'Player', ja:'プレイヤー', ko:'플레이어', es:'Jugador' },
    '身分':            { en:'Role', ja:'役割', ko:'역할', es:'Rol' },
    '題目載入中...':   { en:'Loading...', ja:'読み込み中...', ko:'로딩 중...', es:'Cargando...' },
    '🏅 排行榜':       { en:'🏅 Leaderboard', ja:'🏅 ランキング', ko:'🏅 순위표', es:'🏅 Clasificación' },
    '玩家答題狀況':    { en:'Player Status', ja:'プレイヤー状況', ko:'플레이어 현황', es:'Estado' },
    '本題各選項統計':  { en:'Option Stats', ja:'選択肢統計', ko:'선택지 통계', es:'Estadísticas' },
    '提交答案':        { en:'Submit', ja:'回答する', ko:'제출', es:'Enviar' },
    '你已被淘汰':      { en:'You are eliminated', ja:'脱落しました', ko:'탈락했습니다', es:'Estás eliminado' },
    '答錯了淘汰題！積分歸零，目前為觀戰模式。': { en:"Wrong on elimination question! Score reset. Now spectating.", ja:'脱落問題を間違えました！スコアリセット。観戦モードです。', ko:'탈락 문제 오답! 점수 초기화. 관전 모드입니다.', es:'¡Respuesta incorrecta! Puntos a cero. Modo espectador.' },
    '你仍可以看到題目、解析和排名，但無法繼續作答。': { en:"You can still see questions, explanations and rankings.", ja:'問題、解説、順位は引き続き表示されます。', ko:'문제, 해설, 순위는 계속 볼 수 있습니다.', es:'Aún puedes ver preguntas, explicaciones y clasificaciones.' },
    '🎉 遊戲結束！':   { en:'🎉 Game Over!', ja:'🎉 ゲーム終了！', ko:'🎉 게임 종료!', es:'🎉 ¡Fin del juego!' },
    '感謝參與，最終結果請見結算頁面。': { en:'Thanks for playing! See final results.', ja:'ご参加ありがとう！最終結果をご確認ください。', ko:'참여해 주셔서 감사합니다! 최종 결과를 확인하세요.', es:'¡Gracias por jugar! Mira los resultados finales.' },
    '你的總分：':      { en:'Your score: ', ja:'合計スコア：', ko:'총점: ', es:'Tu puntuación: ' },
    '🏆 遊戲結束！最終排名': { en:'🏆 Final Rankings', ja:'🏆 最終順位', ko:'🏆 최종 순위', es:'🏆 Clasificación final' },
    '📊 完整結算':     { en:'📊 Full Scoreboard', ja:'📊 全スコア', ko:'📊 전체 점수', es:'📊 Puntuación completa' },
    '📋 每人每題明細（房主限定）': { en:'📋 Per-player detail (host only)', ja:'📋 詳細（ホストのみ）', ko:'📋 상세 내역 (호스트 전용)', es:'📋 Detalle por jugador (solo anfitrión)' },
    '回首頁':          { en:'Home', ja:'ホームへ', ko:'홈으로', es:'Inicio' },
    '正解：':          { en:'Answer: ', ja:'正解：', ko:'정답: ', es:'Respuesta: ' },
    '本題得分：':      { en:'Points: ', ja:'獲得ポイント：', ko:'획득 점수: ', es:'Puntos: ' },
    '我的目前總分：':  { en:'Total score: ', ja:'合計スコア：', ko:'현재 점수: ', es:'Puntuación total: ' },
    '目前前五名':      { en:'Top 5', ja:'トップ5', ko:'상위 5위', es:'Top 5' },
    '目前排行':        { en:'Rankings', ja:'現在の順位', ko:'현재 순위', es:'Clasificación actual' },
    '所有人已作答，結束本題': { en:'All answered — end question', ja:'全員回答済み — 終了', ko:'전원 답변 완료 — 종료', es:'Todos respondieron — terminar' },
    '💀 本題淘汰玩家': { en:'💀 Eliminated this round', ja:'💀 今回の脱落者', ko:'💀 이번 라운드 탈락자', es:'💀 Eliminados esta ronda' },
    '進入下一題':      { en:'Next Question', ja:'次の問題へ', ko:'다음 문제', es:'Siguiente pregunta' },
    '繼續觀戰':        { en:'Keep Watching', ja:'観戦を続ける', ko:'계속 관전', es:'Seguir viendo' },
    '查看完整結算':    { en:'View Full Scoreboard', ja:'全スコアを見る', ko:'전체 점수 보기', es:'Ver clasificación completa' },
    '📊 本題結果':     { en:'📊 Round Result', ja:'📊 この問題の結果', ko:'📊 이번 문제 결과', es:'📊 Resultado de la ronda' },

    /* ── create_home.html ── */
    '我的題庫':        { en:'My Question Banks', ja:'問題バンク', ko:'내 문제 은행', es:'Mis bancos' },
    '可建立多個題庫，每個題庫獨立設定賽制。': { en:'Create multiple banks, each with its own game mode.', ja:'複数のバンクを作成できます。', ko:'여러 뱅크를 만들 수 있습니다.', es:'Crea varios bancos con su propio modo.' },
    '題庫編輯中心':    { en:'Question Bank Editor', ja:'問題バンクエディタ', ko:'문제 은행 편집기', es:'Editor de banco' },
    '儲存題庫':        { en:'Save Bank', ja:'バンクを保存', ko:'뱅크 저장', es:'Guardar banco' },
    '建立房間':        { en:'Create Room', ja:'部屋を作る', ko:'방 만들기', es:'Crear sala' },
    '題庫名稱':        { en:'Bank name', ja:'バンク名', ko:'뱅크 이름', es:'Nombre del banco' },
    '題庫賽制':        { en:'Game mode', ja:'ゲームモード', ko:'게임 모드', es:'Modo de juego' },
    '全題庫套用':      { en:'Applied to all', ja:'全問題に適用', ko:'전체 적용', es:'Para todo el banco' },
    '題目名稱':        { en:'Question title', ja:'問題タイトル', ko:'문제 제목', es:'Título de pregunta' },
    '題目內容':        { en:'Question content', ja:'問題内容', ko:'문제 내용', es:'Contenido' },
    '題型':            { en:'Type', ja:'種類', ko:'유형', es:'Tipo' },
    '單選題':          { en:'Single choice', ja:'単一選択', ko:'단일 선택', es:'Única respuesta' },
    '多選題':          { en:'Multiple choice', ja:'複数選択', ko:'복수 선택', es:'Múltiple respuesta' },
    '是非題':          { en:'True/False', ja:'○×問題', ko:'참/거짓', es:'Verdadero/Falso' },
    '秒數':            { en:'Seconds', ja:'秒数', ko:'초', es:'Segundos' },
    '最高分':          { en:'Max points', ja:'最高得点', ko:'최대 점수', es:'Puntos máx.' },
    '選項設定':        { en:'Options', ja:'選択肢設定', ko:'선택지 설정', es:'Opciones' },
    '詳解 / 解析':     { en:'Explanation', ja:'解説', ko:'해설', es:'Explicación' },
    '題目圖片（JPG / PNG）': { en:'Image (JPG/PNG)', ja:'画像 (JPG/PNG)', ko:'이미지 (JPG/PNG)', es:'Imagen (JPG/PNG)' },
    '點我上傳圖片或更換圖片': { en:'Click to upload image', ja:'画像をアップロード', ko:'이미지 업로드', es:'Subir imagen' },
    '淘汰模式':        { en:'Elimination mode', ja:'脱落モード', ko:'탈락 모드', es:'Modo eliminación' },
    '新增 / 更新題目': { en:'Add / Update', ja:'追加 / 更新', ko:'추가 / 수정', es:'Agregar / Actualizar' },
    '複製題目':        { en:'Copy question', ja:'問題をコピー', ko:'문제 복사', es:'Copiar pregunta' },
    '貼上到目前題庫':  { en:'Paste to bank', ja:'バンクに貼り付け', ko:'뱅크에 붙여넣기', es:'Pegar en banco' },
    '清空表單':        { en:'Clear form', ja:'フォームをクリア', ko:'폼 초기화', es:'Limpiar formulario' },
    '刪除題目':        { en:'Delete question', ja:'問題を削除', ko:'문제 삭제', es:'Eliminar pregunta' },
    '目前題目清單':    { en:'Question list', ja:'問題一覧', ko:'문제 목록', es:'Lista de preguntas' },
  };

  /* ── 目前語言 ── */
  let currentLang = localStorage.getItem('quizLang') || 'zh';

  /* ── 翻譯一個文字節點 ── */
  function translateText(text, lang) {
    if (lang === 'zh') return text; // 中文直接原文
    const d = DICT[text.trim()];
    if (!d) return text;
    return d[lang] || text;
  }

  /* ── 翻譯整個 DOM ── */
  function translateDOM(lang) {
    if (lang === 'zh') {
      // 恢復所有元素的原始文字
      document.querySelectorAll('[data-orig]').forEach(el => {
        el.textContent = el.dataset.orig;
        delete el.dataset.orig;
      });
      document.querySelectorAll('[data-orig-ph]').forEach(el => {
        el.placeholder = el.dataset.origPh;
        delete el.dataset.origPh;
      });
      return;
    }

    // 翻譯所有文字節點
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode(node) {
          const tag = node.parentElement?.tagName;
          if (['SCRIPT','STYLE','NOSCRIPT'].includes(tag)) return NodeFilter.FILTER_REJECT;
          if (!node.textContent.trim()) return NodeFilter.FILTER_SKIP;
          return NodeFilter.FILTER_ACCEPT;
        }
      }
    );

    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);

    nodes.forEach(node => {
      const orig = node.textContent;
      const trimmed = orig.trim();
      if (!trimmed) return;
      const translated = translateText(trimmed, lang);
      if (translated !== trimmed) {
        const el = node.parentElement;
        if (el && !el.dataset.orig) el.dataset.orig = trimmed;
        // 保留前後空白
        node.textContent = orig.replace(trimmed, translated);
      }
    });

    // 翻譯 placeholder
    document.querySelectorAll('[placeholder]').forEach(el => {
      const orig = el.dataset.origPh || el.placeholder;
      const translated = translateText(orig.trim(), lang);
      if (translated !== orig.trim()) {
        if (!el.dataset.origPh) el.dataset.origPh = orig;
        el.placeholder = translated;
      }
    });
  }

  /* ── 套用語言 ── */
  function applyLang(lang) {
    currentLang = lang;
    localStorage.setItem('quizLang', lang);
    translateDOM(lang);
    // 更新所有語言選單到同一值
    document.querySelectorAll('.lang-switcher').forEach(sel => { sel.value = lang; });
  }

  /* ── 建立語言切換 UI ── */
  function createSwitcher() {
    const sel = document.createElement('select');
    sel.className = 'lang-switcher';
    sel.setAttribute('aria-label', 'Language');
    sel.title = 'Language / 語言';
    [
      { v:'zh', l:'🌐 中文' },
      { v:'en', l:'🌐 English' },
      { v:'ja', l:'🌐 日本語' },
      { v:'ko', l:'🌐 한국어' },
      { v:'es', l:'🌐 Español' }
    ].forEach(({ v, l }) => {
      const opt = document.createElement('option');
      opt.value = v; opt.textContent = l;
      sel.appendChild(opt);
    });
    sel.value = currentLang;
    sel.addEventListener('change', () => applyLang(sel.value));
    return sel;
  }

  /* ── 注入切換器到頁面 ── */
  function injectSwitchers() {
    // 找所有 .lang-switcher-slot 的容器注入
    document.querySelectorAll('.lang-switcher-slot').forEach(slot => {
      slot.innerHTML = '';
      slot.appendChild(createSwitcher());
    });
    // 如果已有 #langSelect，讓它同步
    const existing = document.getElementById('langSelect');
    if (existing) {
      existing.value = currentLang;
      existing.addEventListener('change', () => applyLang(existing.value));
      existing.classList.add('lang-switcher');
    }
  }

  /* ── 初始化（DOM 載入後自動執行）── */
  function init() {
    injectSwitchers();
    if (currentLang !== 'zh') translateDOM(currentLang);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  return { applyLang, createSwitcher, currentLang: () => currentLang };
})();
