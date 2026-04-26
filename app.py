/* ── base ── */
body{margin:0;min-height:100vh;font-family:"Comic Sans MS","Arial","GenSenRounded",sans-serif;background:url(../images/waiting.jpg) center/cover no-repeat fixed;color:#865d72}
body::before{content:"";position:fixed;inset:0;background:linear-gradient(180deg,rgba(255,235,244,.22),rgba(255,208,228,.18));pointer-events:none}

/* ── shell & topbar ── */
.game-shell{position:relative;z-index:1;padding:18px;max-width:1500px;margin:0 auto}
.game-topbar{display:flex;justify-content:space-between;align-items:center;gap:14px;flex-wrap:wrap;margin-bottom:20px}
.game-logo{width:min(280px,70vw)}
.game-badges{display:flex;gap:10px;flex-wrap:wrap}
.badge-pill{background:rgba(255,255,255,.82);padding:10px 16px;border-radius:999px;font-weight:800;box-shadow:0 8px 24px rgba(116,35,70,.15)}
.badge-pill strong{color:#df5c93}

/* ── layout: 3 columns on wide, 1 column on mobile ── */
.game-layout{
  display:grid;
  grid-template-columns:280px 1fr 200px;
  gap:18px;
  align-items:start;
}

/* ── glass card ── */
.glass-card{background:linear-gradient(180deg,rgba(255,255,255,.82),rgba(255,245,249,.72));border:2px solid rgba(255,255,255,.9);border-radius:30px;backdrop-filter:blur(14px);box-shadow:0 16px 34px rgba(168,102,136,.18)}

/* ── left side board ── */
.side-board{padding:22px}
.side-board h3{margin:0 0 12px;color:#d65d94}
.progress-copy{font-size:1.12rem;font-weight:800;margin-bottom:18px}
.leaderboard-title{font-weight:900;margin-bottom:10px;color:#c85f81}
.leaderboard-list{display:grid;gap:10px}
.leader-item{background:rgba(255,255,255,.74);border-radius:16px;padding:10px 12px;display:flex;justify-content:space-between;gap:10px;font-weight:800}
.leader-item.mine{outline:3px solid rgba(255,143,188,.5)}

/* ── right side player panel ── */
.player-side-panel{padding:16px}
.psp-title{font-weight:900;color:#d65d94;margin-bottom:12px;font-size:1rem}
.player-side-list{display:flex;flex-direction:column;gap:10px}

.psl-item{
  display:flex;
  align-items:center;
  gap:8px;
  background:rgba(255,255,255,.74);
  border-radius:16px;
  padding:8px 10px;
  font-weight:800;
  font-size:.88rem;
}
.psl-item.done{outline:2px solid rgba(100,200,130,.4)}
.psl-item.wait{opacity:.75}
.psl-name{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.psl-icon{flex-shrink:0}

/* ── mini avatar ── */
.mini-avatar{
  position:relative;
  flex-shrink:0;
  overflow:hidden;
}
.ma-layer{
  position:absolute;
  left:50%;
  transform:translateX(-50%);
  width:100%;
  bottom:0;
  pointer-events:none;
  user-select:none;
}
.ma-face{z-index:1}
.ma-eyes{z-index:2}
.ma-hair{z-index:3}

/* ── main board ── */
.main-board{padding:22px}
.question-kicker{display:inline-block;background:#ffd5e4;color:#c85f81;border-radius:999px;padding:8px 14px;font-weight:900}
.question-title{font-size:clamp(1.7rem,3vw,2.6rem);color:#df5d95;margin:16px 0 10px}
.question-content{font-size:1.1rem;line-height:1.8;color:#7e6070}
.question-image{max-width:100%;max-height:280px;border-radius:20px;display:block;margin:12px auto 18px;box-shadow:0 12px 22px rgba(168,102,136,.18)}

/* ── options ── */
.options-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;margin-top:20px}
.option-btn{border:none;text-align:left;border-radius:24px;padding:18px;background:rgba(255,255,255,.9);font-size:1rem;font-weight:800;color:#87596f;box-shadow:0 10px 18px rgba(168,102,136,.1);display:flex;gap:12px;align-items:center;cursor:pointer;transition:.2s}
.option-btn:hover{transform:translateY(-2px);filter:brightness(1.03)}
.option-btn.selected{outline:4px solid rgba(255,144,188,.5);background:rgba(255,240,246,.96)}
.option-letter{width:42px;height:42px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;background:linear-gradient(180deg,#ff8eb7,#ff72a8);color:#fff;flex-shrink:0}

/* ── submit / action btns ── */
.submit-btn{margin-top:22px;border:none;border-radius:18px;padding:16px 22px;background:linear-gradient(180deg,#ff93ba,#f66f9f);color:#fff;font-weight:900;font-size:1.06rem;box-shadow:0 14px 22px rgba(243,115,160,.24);cursor:pointer;transition:.2s;display:inline-block}
.submit-btn:hover{transform:translateY(-2px);filter:brightness(1.05)}
.back-home-btn{text-decoration:none}

.host-skip-early-btn{
  background:linear-gradient(135deg,#6fd4a0,#3cb87a);
  display:block;
  width:100%;
  margin:10px 0;
  box-shadow:0 8px 18px rgba(60,184,122,.22);
}

/* ── finish wrap ── */
.finish-wrap{text-align:center;padding:60px 20px}
.finish-score{font-size:1.3rem;color:#c85f81;margin:20px 0}

/* ── host monitor ── */
.host-monitor-box{margin-bottom:18px;padding:16px;border-radius:20px;background:rgba(255,255,255,.78);border:1px solid rgba(255,255,255,.9)}
.host-monitor-title{font-weight:900;color:#d65d94;margin-bottom:12px}
.host-answer-status{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
.host-answer-item{background:rgba(255,245,249,.95);border-radius:14px;padding:10px 12px;display:flex;justify-content:space-between;font-weight:800}
.host-answer-item.done{outline:3px solid rgba(120,214,150,.35)}
.host-answer-item.wait{opacity:.75}
.host-breakdown-title{margin:14px 0 10px;font-weight:900;color:#c85f81}
.host-answer-breakdown{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
.breakdown-item{background:rgba(255,255,255,.86);border-radius:16px;padding:12px 14px;display:flex;justify-content:space-between;gap:12px;align-items:center}
.breakdown-left{display:flex;gap:10px;align-items:center;min-width:0}
.breakdown-label{width:32px;height:32px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;background:linear-gradient(180deg,#ff8eb7,#ff72a8);color:#fff;font-weight:900;flex-shrink:0}
.breakdown-text{font-weight:800;color:#865d72;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.breakdown-count{color:#d65d94;font-size:1.05rem}

/* ── result overlay ── */
.result-overlay{position:fixed;inset:0;background:rgba(62,33,48,.34);display:none;align-items:center;justify-content:center;z-index:9998;padding:20px}
.result-overlay.show{display:flex}
.result-card{max-width:560px;width:100%;background:linear-gradient(180deg,rgba(255,250,252,.98),rgba(255,233,241,.96));border-radius:28px;padding:28px;border:3px solid rgba(255,255,255,.95);box-shadow:0 22px 40px rgba(116,35,70,.22);text-align:center;max-height:90vh;overflow-y:auto}
.result-badge{font-size:2rem;font-weight:900;color:#df5d95}
.result-score{font-size:1.12rem;margin-top:12px}
.result-answer{font-weight:900;margin-top:10px;color:#b35379}
.result-my-score{margin-top:12px;font-weight:900;color:#c85f81}
.result-top5-title{margin-top:18px;font-weight:900;color:#c85f81}
.result-top5-list{margin-top:10px;display:grid;gap:8px}
.result-top5-item{display:flex;justify-content:space-between;padding:10px 12px;border-radius:14px;background:rgba(255,255,255,.82);font-weight:800}
.result-top5-item.mine{outline:3px solid rgba(255,143,188,.34)}
.result-rank-box{margin-top:12px;padding:12px 14px;border-radius:16px;background:rgba(255,255,255,.82);color:#c85f81;font-weight:900}
.result-explanation{margin-top:16px;padding:16px;border-radius:18px;background:rgba(255,255,255,.75);line-height:1.7;text-align:left}
.result-actions{display:flex;gap:12px;justify-content:center;flex-wrap:wrap}

/* ── 頒獎台 overlay ── */
.podium-overlay{
  position:fixed;inset:0;
  background:rgba(40,20,32,.72);
  display:none;
  align-items:center;
  justify-content:center;
  z-index:9999;
  padding:20px;
}
.podium-card{
  max-width:680px;width:100%;
  background:linear-gradient(180deg,rgba(255,248,252,.98),rgba(255,230,242,.96));
  border-radius:32px;
  padding:36px 28px 28px;
  border:3px solid rgba(255,255,255,.95);
  box-shadow:0 24px 48px rgba(116,35,70,.28);
  text-align:center;
  max-height:92vh;overflow-y:auto;
}
.podium-title{font-size:1.7rem;font-weight:900;color:#df5d95;margin-bottom:28px}
.podium-inner{display:flex;justify-content:center}
.podium-row{
  display:flex;
  align-items:flex-end;
  justify-content:center;
  gap:12px;
}
.podium-col{
  display:flex;
  flex-direction:column;
  align-items:center;
  gap:6px;
}
.podium-avatar{margin-bottom:4px}
.podium-medal{font-size:1.8rem}
.podium-name{font-weight:900;color:#865d72;font-size:1rem;max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.podium-score{font-size:.9rem;color:#c85f81;font-weight:800}
.podium-stage{
  width:110px;
  border-radius:12px 12px 0 0;
  background:linear-gradient(180deg,#ffb3d4,#ff8db8);
  box-shadow:0 8px 20px rgba(255,100,170,.25);
}
.podium-1 .podium-stage{background:linear-gradient(180deg,#ffd700,#ffa500);box-shadow:0 8px 20px rgba(255,165,0,.3)}
.podium-2 .podium-stage{background:linear-gradient(180deg,#c0c0c0,#a0a0a0);box-shadow:0 8px 20px rgba(160,160,160,.3)}
.podium-3 .podium-stage{background:linear-gradient(180deg,#cd7f32,#a0522d);box-shadow:0 8px 20px rgba(160,82,45,.3)}
.podium-continue-btn{margin-top:24px}

/* ── 結算 overlay ── */
.scoreboard-overlay{
  position:fixed;inset:0;
  background:rgba(40,20,32,.72);
  display:none;
  align-items:center;
  justify-content:center;
  z-index:9999;
  padding:20px;
}
.scoreboard-card{
  max-width:720px;width:100%;
  background:linear-gradient(180deg,rgba(255,248,252,.98),rgba(255,230,242,.96));
  border-radius:32px;
  padding:36px 28px 28px;
  border:3px solid rgba(255,255,255,.95);
  box-shadow:0 24px 48px rgba(116,35,70,.28);
  text-align:center;
  max-height:92vh;overflow-y:auto;
}
.scoreboard-list{display:grid;gap:10px;margin-top:16px}
.sb-row{
  display:flex;
  align-items:center;
  gap:14px;
  background:rgba(255,255,255,.82);
  border-radius:16px;
  padding:12px 16px;
  font-weight:800;
  text-align:left;
}
.sb-row.sb-mine{outline:3px solid rgba(255,143,188,.4)}
.sb-rank{width:32px;height:32px;border-radius:50%;background:linear-gradient(135deg,#ff8eb7,#ff72a8);color:#fff;display:inline-flex;align-items:center;justify-content:center;font-weight:900;flex-shrink:0}
.sb-name{flex:1;color:#865d72}
.sb-score{color:#df5d95;font-size:1.05rem}

/* ── 房主明細 ── */
.host-detail-title{font-size:1.1rem;font-weight:900;color:#d65d94;margin-bottom:14px;text-align:left}
.host-detail-wrap{display:grid;gap:16px;text-align:left}
.hd-player-block{background:rgba(255,255,255,.8);border-radius:18px;padding:14px 16px}
.hd-player-name{font-weight:900;color:#d65d94;margin-bottom:10px;font-size:1rem}
.hd-answers{display:grid;gap:8px}
.hd-answer-item{display:flex;gap:12px;align-items:center;padding:8px 12px;border-radius:12px;font-weight:800;font-size:.9rem}
.hd-answer-item.correct{background:rgba(210,255,225,.9);color:#2a7a4b}
.hd-answer-item.wrong{background:rgba(255,220,225,.9);color:#b93030}
.hd-q{min-width:60px}
.hd-sel{flex:1}
.hd-pts{font-weight:900}

/* ── toast ── */
.toast-qa{position:fixed;right:18px;bottom:18px;background:rgba(54,37,48,.92);color:#fff;padding:12px 16px;border-radius:14px;opacity:0;pointer-events:none;transform:translateY(10px);transition:.2s;z-index:10000}
.toast-qa.show{opacity:1;transform:translateY(0)}
.audio-toggle{position:fixed;right:18px;top:18px;z-index:9999;border:none;border-radius:999px;padding:10px 14px;background:rgba(255,255,255,.9);color:#d35f93;font-weight:800;box-shadow:0 8px 24px rgba(116,35,70,.2);cursor:pointer}

/* ── RWD ── */
@media (max-width:1100px){
  .game-layout{grid-template-columns:240px 1fr}
  .player-side-panel{display:none} /* 收起右側，改併入左側排行榜 */
}

@media (max-width:960px){
  .game-layout{grid-template-columns:1fr}
  .options-list{grid-template-columns:1fr}
  .host-answer-breakdown,.host-answer-status{grid-template-columns:1fr}
  .player-side-panel{display:block}
  .player-side-list{flex-direction:row;flex-wrap:wrap}
  .psl-item{width:calc(50% - 5px)}
}

@media (max-width:560px){
  .game-shell{padding:12px}
  .game-topbar{gap:8px}
  .game-badges{gap:6px}
  .badge-pill{padding:8px 12px;font-size:.85rem}
  .question-title{font-size:1.4rem}
  .podium-row{gap:6px}
  .podium-stage{width:80px}
  .podium-name{max-width:80px;font-size:.85rem}
  .scoreboard-card,.podium-card{padding:20px 14px}
}

/* ═══════════════════════════════════════
   房主視角補丁
   ═══════════════════════════════════════ */

/* 房主題目標頭 */
.host-question-header {
  padding: 16px 20px 12px;
  border-bottom: 2px solid rgba(255,255,255,0.3);
  margin-bottom: 16px;
}

/* 答題狀況：正確 / 錯誤 / 等待 顏色 */
.ans-correct { color: #2ecc71; }
.ans-wrong   { color: #e74c3c; }
.ans-wait    { color: #aaa; }

/* 答題狀況 item 加頭像 */
.host-answer-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border-radius: 12px;
  background: rgba(255,255,255,0.36);
  margin-bottom: 6px;
}
.host-answer-item.done { background: rgba(200,255,200,0.28); }
.host-answer-item.wait { background: rgba(255,255,255,0.20); }
.host-answer-item span { flex: 1; font-weight: 800; font-size: .95rem; }
.host-answer-item strong { font-size: .88rem; }

/* 房主解析 overlay（共用 result-overlay 底層樣式，只換 class） */
#hostExplanationOverlay {
  /* 完全同 resultOverlay，CSS 已有 .result-overlay */
}
.host-badge-label {
  background: linear-gradient(135deg, #6c5ce7, #a29bfe) !important;
}

/* 離開遊戲按鈕 */
.leave-game-btn {
  border: none;
  border-radius: 999px;
  padding: 8px 16px;
  background: rgba(255,255,255,0.22);
  color: #fff;
  font-weight: 800;
  font-size: .88rem;
  cursor: pointer;
  margin-left: auto;
  transition: background .15s;
}
.leave-game-btn:hover { background: rgba(255,80,80,0.55); }

/* ═══════════════════════════════════════
   房主選項（看得到、不能點、正解標色）
   ═══════════════════════════════════════ */

.host-options-list {
  margin-top: 16px;
  pointer-events: none;   /* 整塊不可互動 */
}

/* 房主的選項按鈕：改用 div，灰化 */
.host-option {
  opacity: 0.72;
  cursor: default !important;
  background: rgba(240,240,240,0.85) !important;
  color: #7a6070 !important;
  box-shadow: none !important;
  position: relative;
}

/* 正確選項：亮綠邊框 + 淡綠背景 */
.host-correct-option {
  opacity: 1 !important;
  background: rgba(200,255,218,0.92) !important;
  outline: 3px solid #3cbe7a !important;
  color: #1a6640 !important;
}

/* 正解標籤 */
.correct-tag {
  margin-left: auto;
  font-size: 0.82rem;
  font-weight: 900;
  color: #2a7a4b;
  background: rgba(100,220,150,0.25);
  padding: 3px 10px;
  border-radius: 999px;
  white-space: nowrap;
}
