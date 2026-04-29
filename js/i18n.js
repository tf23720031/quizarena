/* ================================================================
   i18n.js  v4  最終版
   策略：
   1. 首次掃描 DOM，找到所有匹配字典的文字節點
   2. 在父元素上打 data-i18n="key"（永久記錄原文 key）
   3. 切換語言時只改 data-i18n 元素的文字，icon 等不受影響
   4. 切回中文時還原原文
   ================================================================ */
const I18N = (() => {

  /* ── 字典 ── */
  const D = {
    // 通用
    '登入 / 註冊':    { en:'Login / Register',   ja:'ログイン / 登録',    ko:'로그인 / 가입',     es:'Entrar / Registrar' },
    '登入':           { en:'Login',               ja:'ログイン',            ko:'로그인',             es:'Iniciar sesión' },
    '登出':           { en:'Logout',              ja:'ログアウト',          ko:'로그아웃',           es:'Cerrar sesión' },
    '註冊':           { en:'Register',            ja:'登録',                ko:'회원가입',           es:'Registrarse' },
    '取消':           { en:'Cancel',              ja:'キャンセル',          ko:'취소',               es:'Cancelar' },
    '知道了':         { en:'Got it',              ja:'了解',                ko:'확인',               es:'Entendido' },
    '回首頁':         { en:'Home',                ja:'ホームへ',            ko:'홈으로',             es:'Inicio' },
    '確認加入':       { en:'Confirm Join',        ja:'参加確認',            ko:'참가 확인',           es:'Confirmar' },
    '確認':           { en:'Confirm',             ja:'確認',                ko:'확인',               es:'Confirmar' },
    // 首頁
    '目前帳號':       { en:'Account',             ja:'アカウント',          ko:'계정',               es:'Cuenta' },
    '目前登入帳號':   { en:'Current account',     ja:'現在のアカウント',    ko:'현재 로그인 계정',     es:'Cuenta actual' },
    '尚未登入':       { en:'Not logged in',       ja:'未ログイン',          ko:'미로그인',           es:'Sin sesión' },
    '個人資料':       { en:'Profile',             ja:'プロフィール',        ko:'프로필',             es:'Perfil' },
    '建立題庫':       { en:'Create Bank',         ja:'問題集を作成',        ko:'문제 은행 만들기',     es:'Crear banco' },
    '錯題本':         { en:'Wrong Book',          ja:'復習ノート',          ko:'오답 노트',           es:'Cuaderno de errores' },
    '老師模式':       { en:'Teacher Mode',        ja:'先生モード',          ko:'교사 모드',           es:'Modo profesor' },
    '重新整理大廳':   { en:'Refresh Lobby',       ja:'ロビー更新',          ko:'로비 새로고침',       es:'Actualizar sala' },
    '好友排行':       { en:'Friend Ranking',      ja:'友達ランキング',      ko:'친구 랭킹',           es:'Ranking amigos' },
    '好友戰績榜':     { en:'Friend Records',      ja:'友達成績表',          ko:'친구 전적',           es:'Historial amigos' },
    '好友申請':       { en:'Friend Requests',     ja:'友達申請',            ko:'친구 요청',           es:'Solicitudes' },
    '加入好友':       { en:'Add Friend',          ja:'友達を追加',          ko:'친구 추가',           es:'Agregar amigo' },
    '好友申請紀錄':   { en:'Friend Requests',     ja:'友達申請履歴',        ko:'친구 요청 기록',      es:'Solicitudes' },
    '好友個人資料':   { en:'Friend Profile',      ja:'友達プロフィール',    ko:'친구 프로필',         es:'Perfil amigo' },
    '送出申請':       { en:'Send Request',        ja:'申請を送信',          ko:'요청 보내기',         es:'Enviar solicitud' },
    '輸入玩家帳號':   { en:'Enter player account',ja:'プレイヤーIDを入力',  ko:'플레이어 계정 입력',   es:'Cuenta del jugador' },
    '成就':           { en:'Achievements',        ja:'実績',                ko:'업적',               es:'Logros' },
    '已解鎖':         { en:'Unlocked',            ja:'解除済み',            ko:'잠금 해제',           es:'Desbloqueado' },
    '已獲得':         { en:'Unlocked',            ja:'獲得済み',            ko:'획득',               es:'Obtenidos' },
    '題庫中心':       { en:'Question Bank',       ja:'問題バンク',          ko:'문제 은행',           es:'Banco de preguntas' },
    '重新整理':       { en:'Refresh',             ja:'更新',                ko:'새로고침',           es:'Actualizar' },
    'Game Lobby':     { en:'Game Lobby',          ja:'ゲームロビー',        ko:'게임 로비',           es:'Sala de juegos' },
    'Join Room':      { en:'Join Room',           ja:'参加する',            ko:'방 참가',             es:'Unirse' },
    '等待中':         { en:'Waiting',             ja:'待機中',              ko:'대기 중',             es:'Esperando' },
    '玩家總數':       { en:'Players',             ja:'プレイヤー数',        ko:'플레이어',            es:'Jugadores' },
    '私人房':         { en:'Private',             ja:'非公開',              ko:'비공개',             es:'Privadas' },
    '個人賽':         { en:'Solo',                ja:'個人戦',              ko:'개인전',             es:'Individual' },
    '團體賽':         { en:'Team',                ja:'チーム戦',            ko:'팀전',               es:'Equipo' },
    '公開':           { en:'Public',              ja:'公開',                ko:'공개',               es:'Público' },
    '進行中':         { en:'In progress',         ja:'進行中',              ko:'진행 중',             es:'En curso' },
    '加入':           { en:'Join',                ja:'参加',                ko:'참가',               es:'Unirse' },
    // 登入 Modal
    '會員中心':       { en:'Member Center',       ja:'会員センター',        ko:'회원 센터',           es:'Centro de miembros' },
    '帳號':           { en:'Username',            ja:'ユーザー名',          ko:'사용자명',           es:'Usuario' },
    '密碼':           { en:'Password',            ja:'パスワード',          ko:'비밀번호',           es:'Contraseña' },
    'Email':          { en:'Email',               ja:'メール',              ko:'이메일',             es:'Correo' },
    '請輸入帳號':     { en:'Enter username',      ja:'ユーザー名を入力',    ko:'사용자명 입력',       es:'Tu usuario' },
    '請輸入密碼':     { en:'Enter password',      ja:'パスワードを入力',    ko:'비밀번호 입력',       es:'Tu contraseña' },
    '請輸入 Email':   { en:'Enter email',         ja:'メールを入力',        ko:'이메일 입력',         es:'Tu correo' },
    '私人房驗證':     { en:'Private Room',        ja:'プライベート認証',    ko:'비공개 방 인증',      es:'Sala privada' },
    '請輸入房間密鑰': { en:'Enter room key',      ja:'ルームキーを入力',    ko:'방 키 입력',           es:'Ingresa la clave' },
    '輸入房間密鑰':   { en:'Room key',            ja:'ルームキー',          ko:'방 키',               es:'Clave' },
    // player_join
    '髮型':           { en:'Hair',                ja:'髪型',                ko:'헤어',               es:'Cabello' },
    '眼睛':           { en:'Eyes',                ja:'目',                  ko:'눈',                 es:'Ojos' },
    '隨機':           { en:'Random',              ja:'ランダム',            ko:'랜덤',               es:'Aleatorio' },
    '重設':           { en:'Reset',               ja:'リセット',            ko:'초기화',             es:'Reiniciar' },
    '眼睛位置微調':   { en:'Eye position',        ja:'目の位置',            ko:'눈 위치',             es:'Posición ojos' },
    '進入房間':       { en:'Enter Room',          ja:'部屋に入る',          ko:'방 입장',             es:'Entrar' },
    '玩家名稱':       { en:'Player name',         ja:'プレイヤー名',        ko:'플레이어 이름',       es:'Nombre' },
    '請輸入玩家名稱': { en:'Enter player name',   ja:'プレイヤー名を入力',  ko:'이름 입력',           es:'Tu nombre' },
    '房間名稱':       { en:'Room name',           ja:'ルーム名',            ko:'방 이름',             es:'Sala' },
    '房間 PIN':       { en:'Room PIN',            ja:'ルームPIN',           ko:'방 PIN',              es:'PIN' },
    '題庫':           { en:'Bank',                ja:'問題バンク',          ko:'뱅크',               es:'Banco' },
    '模式':           { en:'Mode',                ja:'モード',              ko:'모드',               es:'Modo' },
    // 等待室
    '✦ ROOM PIN ✦':  { en:'✦ ROOM PIN ✦',        ja:'✦ ルーム PIN ✦',      ko:'✦ 방 PIN ✦',          es:'✦ SALA PIN ✦' },
    '✦ Player chat ✦':{ en:'✦ Player chat ✦',    ja:'✦ チャット ✦',        ko:'✦ 채팅 ✦',            es:'✦ Chat ✦' },
    '✦ Player Joined ✦':{ en:'✦ Players ✦',      ja:'✦ 参加者 ✦',          ko:'✦ 참가자 ✦',          es:'✦ Jugadores ✦' },
    'Share this PIN with friends':
      { en:'Share this PIN',        ja:'PINを友達に共有',      ko:'PIN 공유',             es:'Comparte el PIN' },
    'Host room':      { en:'Host room',           ja:'ホストルーム',        ko:'호스트 방',           es:'Sala anfitrión' },
    '狀態':           { en:'Status',              ja:'ステータス',          ko:'상태',               es:'Estado' },
    'No messages yet...':{ en:'No messages yet...', ja:'メッセージなし...', ko:'메시지 없음...',     es:'Sin mensajes...' },
    'Type a message': { en:'Type a message',      ja:'メッセージを入力',    ko:'메시지 입력',         es:'Escribe un mensaje' },
    'PLAYER':         { en:'PLAYER',              ja:'プレイヤー',          ko:'플레이어',            es:'JUGADOR' },
    'HOST':           { en:'HOST',                ja:'ホスト',              ko:'호스트',             es:'ANFITRIÓN' },
    '離開房間':       { en:'Leave Room',          ja:'退室',                ko:'방 나가기',           es:'Salir' },
    '開始遊戲':       { en:'Start Game',          ja:'ゲーム開始',          ko:'게임 시작',           es:'Iniciar juego' },
    'Waiting for host to start the game...':
      { en:'Waiting for host...',   ja:'ホストを待機中...',    ko:'호스트 대기 중...',    es:'Esperando...' },
    '你是房主，可以確認玩家都進來後再開始。':
      { en:"You're the host. Start when ready.",
        ja:'準備ができたら開始してください。',
        ko:'준비되면 시작하세요.',
        es:'Empieza cuando estés listo.' },
    '選擇你的隊伍':   { en:'Choose team',         ja:'チームを選択',        ko:'팀 선택',             es:'Elige tu equipo' },
    '團體賽分組':     { en:'Team Setup',          ja:'チーム分け',          ko:'팀 구성',             es:'Equipos' },
    '隨機分組':       { en:'Shuffle Teams',       ja:'ランダム分け',        ko:'랜덤 배정',           es:'Aleatorio' },
    // 遊戲頁
    '倒數':           { en:'Timer',               ja:'残り時間',            ko:'카운트다운',          es:'Tiempo' },
    '分數':           { en:'Score',               ja:'スコア',              ko:'점수',               es:'Puntos' },
    '玩家':           { en:'Player',              ja:'プレイヤー',          ko:'플레이어',            es:'Jugador' },
    '身分':           { en:'Role',                ja:'役割',                ko:'역할',               es:'Rol' },
    '離開':           { en:'Leave',               ja:'退出',                ko:'나가기',             es:'Salir' },
    '題目載入中...':  { en:'Loading...',           ja:'読み込み中...',       ko:'로딩 중...',          es:'Cargando...' },
    '🏅 排行榜':      { en:'🏅 Leaderboard',       ja:'🏅 ランキング',       ko:'🏅 순위표',           es:'🏅 Clasificación' },
    '玩家答題狀況':   { en:'Player Status',       ja:'プレイヤー状況',      ko:'플레이어 현황',       es:'Estado' },
    '本題各選項統計': { en:'Option Stats',         ja:'選択肢統計',          ko:'선택지 통계',         es:'Estadísticas' },
    '提交答案':       { en:'Submit',              ja:'回答する',            ko:'제출',               es:'Enviar' },
    '你已被淘汰':     { en:'You are eliminated',  ja:'脱落しました',        ko:'탈락했습니다',        es:'Estás eliminado' },
    '繼續觀戰':       { en:'Keep Watching',       ja:'観戦を続ける',        ko:'계속 관전',           es:'Seguir viendo' },
    '進入下一題':     { en:'Next Question',       ja:'次の問題へ',          ko:'다음 문제',           es:'Siguiente' },
    '所有人已作答，結束本題':
      { en:'All answered — end',    ja:'全員回答済み — 終了', ko:'전원 답변 완료',       es:'Terminar ronda' },
    '查看完整結算':   { en:'View Scoreboard',     ja:'スコアを見る',        ko:'점수 보기',           es:'Ver clasificación' },
    '📊 本題結果':    { en:'📊 Round Result',      ja:'📊 この問題の結果',   ko:'📊 이번 문제 결과',  es:'📊 Resultado' },
    '目前前五名':     { en:'Top 5',               ja:'トップ5',             ko:'상위 5위',            es:'Top 5' },
    '目前排行':       { en:'Rankings',            ja:'現在の順位',          ko:'현재 순위',           es:'Clasificación' },
    '💀 本題淘汰玩家':{ en:'💀 Eliminated',        ja:'💀 今回の脱落者',     ko:'💀 탈락자',           es:'💀 Eliminados' },
    '🏆 遊戲結束！最終排名':
      { en:'🏆 Final Rankings',     ja:'🏆 最終順位',          ko:'🏆 최종 순위',         es:'🏆 Clasificación final' },
    '📊 完整結算':    { en:'📊 Full Scoreboard',   ja:'📊 全スコア',          ko:'📊 전체 점수',        es:'📊 Puntuación' },
    '🎉 遊戲結束！':  { en:'🎉 Game Over!',        ja:'🎉 ゲーム終了！',     ko:'🎉 게임 종료!',       es:'🎉 ¡Fin del juego!' },
    '你的總分：':     { en:'Your score: ',         ja:'合計スコア：',        ko:'총점: ',              es:'Puntuación: ' },
    '感謝參與，最終結果請見結算頁面。':
      { en:'Thanks for playing!',   ja:'ご参加ありがとう！',  ko:'참여 감사합니다!',     es:'¡Gracias por jugar!' },
    '📋 每人每題明細（房主限定）':
      { en:'📋 Detail (host only)', ja:'📋 詳細（ホストのみ）', ko:'📋 상세 (호스트)',    es:'📋 Detalle' },
    '正解：':         { en:'Answer: ',             ja:'正解：',              ko:'정답: ',              es:'Respuesta: ' },
    '本題得分：':     { en:'Points: ',             ja:'獲得：',              ko:'점수: ',              es:'Puntos: ' },
    '我的目前總分：': { en:'Total: ',              ja:'合計：',              ko:'합계: ',              es:'Total: ' },
    // 題庫中心
    '我的題庫':       { en:'My Banks',            ja:'問題バンク',          ko:'내 문제 은행',         es:'Mis bancos' },
    '儲存題庫':       { en:'Save Bank',           ja:'バンク保存',          ko:'뱅크 저장',           es:'Guardar' },
    '建立房間':       { en:'Create Room',         ja:'部屋を作る',          ko:'방 만들기',           es:'Crear sala' },
    '題庫名稱':       { en:'Bank name',           ja:'バンク名',            ko:'뱅크 이름',           es:'Nombre' },
    '題庫賽制':       { en:'Game mode',           ja:'ゲームモード',        ko:'게임 모드',           es:'Modo' },
    '題目名稱':       { en:'Question title',      ja:'問題タイトル',        ko:'문제 제목',           es:'Título' },
    '題目內容':       { en:'Content',             ja:'問題内容',            ko:'내용',               es:'Contenido' },
    '題型':           { en:'Type',                ja:'種類',                ko:'유형',               es:'Tipo' },
    '單選題':         { en:'Single choice',       ja:'単一選択',            ko:'단일 선택',           es:'Una respuesta' },
    '多選題':         { en:'Multiple choice',     ja:'複数選択',            ko:'복수 선택',           es:'Múltiple' },
    '是非題':         { en:'True/False',          ja:'○×問題',             ko:'참/거짓',             es:'V/F' },
    '秒數':           { en:'Seconds',             ja:'秒数',                ko:'초',                 es:'Segundos' },
    '最高分':         { en:'Max pts',             ja:'最高得点',            ko:'최대 점수',           es:'Pts máx.' },
    '選項設定':       { en:'Options',             ja:'選択肢',              ko:'선택지',             es:'Opciones' },
    '詳解 / 解析':    { en:'Explanation',         ja:'解説',                ko:'해설',               es:'Explicación' },
    '淘汰模式':       { en:'Elimination',         ja:'脱落モード',          ko:'탈락 모드',           es:'Eliminación' },
    '新增 / 更新題目':{ en:'Add / Update',         ja:'追加 / 更新',         ko:'추가 / 수정',         es:'Agregar' },
    '複製題目':       { en:'Copy',                ja:'コピー',              ko:'복사',               es:'Copiar' },
    '貼上到目前題庫': { en:'Paste',               ja:'貼り付け',            ko:'붙여넣기',           es:'Pegar' },
    '清空表單':       { en:'Clear form',          ja:'クリア',              ko:'초기화',             es:'Limpiar' },
    '刪除題目':       { en:'Delete',              ja:'削除',                ko:'삭제',               es:'Eliminar' },
    '目前題目清單':   { en:'Questions',           ja:'問題一覧',            ko:'문제 목록',           es:'Lista' },
    // 個人資料 / 報表
    '解鎖的成就':     { en:'Unlocked Achievements', ja:'獲得した実績',      ko:'획득한 업적',         es:'Logros obtenidos' },
    '我的稱號':       { en:'My Titles',           ja:'称号',                ko:'내 칭호',             es:'Mis títulos' },
    '更換造型':       { en:'Avatar Studio',       ja:'アバター編集',        ko:'아바타 꾸미기',       es:'Editar avatar' },
    '上傳頭像':       { en:'Upload Avatar',       ja:'画像をアップロード',  ko:'아바타 업로드',       es:'Subir avatar' },
    '眼睛上下微調':   { en:'Eye vertical adjust', ja:'目の上下調整',        ko:'눈 위치 조정',        es:'Ajustar ojos' },
    '確認更改':       { en:'Save Changes',        ja:'変更を保存',          ko:'변경 저장',           es:'Guardar cambios' },
    '偏好語言':       { en:'Preferred Language',  ja:'優先言語',            ko:'선호 언어',           es:'Idioma preferido' },
    '所在縣市':       { en:'County / City',       ja:'地域',                ko:'지역',               es:'Ciudad / condado' },
    '尚未設定':       { en:'Not set',             ja:'未設定',              ko:'미설정',             es:'Sin configurar' },
    '尚未設定所在地': { en:'Location not set',    ja:'地域未設定',          ko:'지역 미설정',         es:'Ubicación sin definir' },
    '總勝場':         { en:'Total wins',          ja:'合計勝利',            ko:'총 승리',             es:'Victorias totales' },
    '學生表現':       { en:'Student Performance', ja:'学生の成績',          ko:'학생 성과',           es:'Rendimiento' },
    '學生分數排行':   { en:'Student Ranking',     ja:'学生ランキング',      ko:'학생 점수 순위',      es:'Ranking' },
    '最需要複習的題目': { en:'Review Priority',   ja:'復習優先問題',        ko:'복습 우선 문제',      es:'Prioridad de repaso' },
    '隊伍表現':       { en:'Team Performance',    ja:'チーム成績',          ko:'팀 성과',             es:'Rendimiento equipo' },
    '查看報表':       { en:'View Report',         ja:'レポートを見る',      ko:'보고서 보기',         es:'Ver reporte' },
    '匯出 CSV':       { en:'Export CSV',          ja:'CSV出力',             ko:'CSV 내보내기',        es:'Exportar CSV' },
    '匯出 Excel 報表': { en:'Export Excel Report', ja:'Excelレポート出力',  ko:'Excel 보고서 내보내기', es:'Exportar Excel' },
    '匯出分析報告':   { en:'Export Analysis',     ja:'分析レポート出力',    ko:'분석 보고서 내보내기', es:'Exportar análisis' },
  };

  /* 動態內容區域（遊戲執行中不翻）*/
  const SKIP_IDS = new Set([
    'chatList','playerList','leaderboardList','hostAnswerStatus','hostAnswerBreakdown',
    'playerSideList','optionsList','hostOptionsList','resultTop5List','hostResultTop5List',
    'scoreboardWrap','podiumInner','hostDetailWrap','teamColumnsWrap','teamJoinButtons',
    'hostEliminatedNames','quizBankList','questionList','roomQuestionPicker',
    'lobbyGrid','memberMessage','toast','teamNamesWrap',
    'friendsRecords','friendsList','friendRequestsContent','friendProfileContent',
    'achievementsList','profileAchievementsList','profileTitleList','profileAvatarPreview',
    'profileHeroAvatar','studentTableBody','scoreRankingList','questionReviewList','teamPerformanceList',
  ]);

  let lang = localStorage.getItem('quizLang') || 'zh';

  function tr(key) {
    if (!key || lang === 'zh') return key;
    return (D[key] && D[key][lang]) || key;
  }

  /* 判斷元素是否在跳過區域內 */
  function inSkipZone(el) {
    let p = el;
    while (p) {
      if (p.id && SKIP_IDS.has(p.id)) return true;
      if (p.dataset?.i18nSkip) return true;
      p = p.parentElement;
    }
    return false;
  }

  /* 翻譯單一元素（只改它的直接 TextNode，不動子元素） */
  function translateEl(el, targetLang) {
    const key = el.dataset.i18n;
    if (!key) return;
    const translated = targetLang === 'zh' ? key : (tr(key) || key);
    // 找並替換直接子 TextNode
    let found = false;
    for (const node of el.childNodes) {
      if (node.nodeType === 3 && node.textContent.trim()) {
        const orig = node.textContent;
        // 保留前後空白結構
        const leading  = orig.match(/^\s*/)[0];
        const trailing = orig.match(/\s*$/)[0];
        node.textContent = leading + translated + trailing;
        found = true;
        break;
      }
    }
    // fallback：整個 textContent 是 key（純文字元素）
    if (!found && el.textContent.trim() === key) {
      el.textContent = translated;
    }
  }

  /* 翻譯 placeholder */
  function translatePh(el, targetLang) {
    const key = el.dataset.i18nPh;
    if (!key) return;
    el.placeholder = targetLang === 'zh' ? key : (tr(key) || key);
  }

  /* 首次掃描：標記所有匹配的元素 */
  function scanDOM(root) {
    if (!root || root.nodeType !== 1) return;
    const tag = root.tagName;
    if (['SCRIPT','STYLE','NOSCRIPT','SVG'].includes(tag)) return;
    if (inSkipZone(root)) return;

    // placeholder
    if ((tag === 'INPUT' || tag === 'TEXTAREA') && root.placeholder && !root.dataset.i18nPh) {
      const ph = root.placeholder.trim();
      if (D[ph]) {
        root.dataset.i18nPh = ph;
        if (lang !== 'zh') root.placeholder = tr(ph) || ph;
      }
    }

    // 找直接子 TextNode
    for (const node of root.childNodes) {
      if (node.nodeType === 3) {
        const txt = node.textContent.trim();
        if (txt && D[txt] && !root.dataset.i18n) {
          root.dataset.i18n = txt;
          if (lang !== 'zh') {
            const leading  = node.textContent.match(/^\s*/)[0];
            const trailing = node.textContent.match(/\s*$/)[0];
            node.textContent = leading + (tr(txt) || txt) + trailing;
          }
        }
      } else if (node.nodeType === 1) {
        scanDOM(node);
      }
    }
  }

  /* 切換語言：重翻所有已標記元素 */
  function applyLang(newLang) {
    lang = newLang;
    localStorage.setItem('quizLang', newLang);

    // 重翻所有標記過的元素
    document.querySelectorAll('[data-i18n]').forEach(el => {
      if (!inSkipZone(el)) translateEl(el, newLang);
    });
    document.querySelectorAll('[data-i18n-ph]').forEach(el => {
      translatePh(el, newLang);
    });

    // 同步所有選單
    document.querySelectorAll('.lang-switcher').forEach(s => { s.value = newLang; });
  }

  /* 建立選單 */
  function makeSwitcher() {
    const sel = document.createElement('select');
    sel.className = 'lang-switcher';
    sel.title = 'Language';
    [['zh','🌐 中文'],['en','🌐 English'],['ja','🌐 日本語'],['ko','🌐 한국어'],['es','🌐 Español']]
      .forEach(([v,l]) => {
        const o = document.createElement('option');
        o.value = v; o.textContent = l; sel.appendChild(o);
      });
    sel.value = lang;
    sel.addEventListener('change', () => applyLang(sel.value));
    return sel;
  }

  /* 注入 slot */
  function injectSlots() {
    document.querySelectorAll('.lang-switcher-slot').forEach(slot => {
      if (!slot.querySelector('.lang-switcher')) slot.appendChild(makeSwitcher());
    });
    // 同步 quiz_game.html 的 #langSelect
    const ex = document.getElementById('langSelect');
    if (ex && !ex.classList.contains('lang-switcher')) {
      ex.classList.add('lang-switcher');
      ex.value = lang;
      ex.addEventListener('change', () => applyLang(ex.value));
    }
  }

  /* 初始化 */
  function init() {
    injectSlots();
    scanDOM(document.body);
    // 如果當前語言不是中文，補翻一次（scanDOM 已順便翻了，這裡是保險）
    if (lang !== 'zh') applyLang(lang);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    setTimeout(init, 30);
  }

  return { applyLang, makeSwitcher, scan: scanDOM, currentLang: () => lang, tr };
})();

window.I18N = I18N;
