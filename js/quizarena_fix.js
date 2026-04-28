/* QuizArena hotfix: profile/name/avatar/friends/i18n/dark/nav */
(() => {
  const $ = (id) => document.getElementById(id);
  const safe = (v, fb = '') => {
    if (v == null) return fb;
    if (typeof v === 'object') return fb;
    const s = String(v).trim();
    return s && s !== '[object PointerEvent]' ? s : fb;
  };
  const user = () => safe(localStorage.getItem('currentUser'));
  const key = (name) => `qa:${user() || 'guest'}:${name}`;
  const read = (name, fb = null) => { try { return JSON.parse(localStorage.getItem(key(name)) || 'null') ?? fb; } catch { return fb; } };
  const write = (name, val) => localStorage.setItem(key(name), JSON.stringify(val));
  const dict = {
    '錯題本':'錯題練習','老師模式':'老師看報表','建立題庫':'建立題庫','個人資料':'個人資料','重新整理大廳':'重新整理大廳',
    '目前登入帳號':'目前登入帳號','尚未登入':'尚未登入','登入後可編輯個人檔案':'登入後可編輯個人檔案','登入 / 註冊':'登入 / 註冊',
    '勝場':'勝場','已解鎖成就':'已解鎖成就','好友數':'好友數','錯題收藏':'錯題收藏','上傳頭像':'上傳頭像','選擇檔案':'選擇檔案',
    '編輯檔案':'編輯檔案','所在縣市':'所在縣市','擅長領域':'擅長領域','個人簡介':'個人簡介','儲存個人資料':'儲存個人資料',
    '好友排行':'好友排行','好友同行':'好友同行','尚無勝場紀錄':'尚無勝場紀錄','新竹縣':'新竹縣','目前還沒有解鎖成就。':'目前還沒有解鎖成就。'
  };
  const en = {
    '錯題練習':'Wrong Practice','老師看報表':'Teacher Dashboard','建立題庫':'Create Quiz Bank','個人資料':'Profile','重新整理大廳':'Refresh Lobby',
    '目前登入帳號':'Current account','尚未登入':'Not logged in','登入後可編輯個人檔案':'Log in to edit profile','登入 / 註冊':'Login / Register','登出':'Logout',
    '勝場':'Wins','已解鎖成就':'Achievements','好友數':'Friends','錯題收藏':'Saved Mistakes','上傳頭像':'Upload avatar','選擇檔案':'Choose file',
    '編輯檔案':'Edit profile','所在縣市':'County / City','擅長領域':'Favorite category','個人簡介':'Bio','儲存個人資料':'Save Profile',
    '好友排行':'Friend Ranking','好友同行':'Friend','尚無勝場紀錄':'No wins yet','新竹縣':'Hsinchu County','目前還沒有解鎖成就。':'No unlocked achievements yet.',
    'PLAYER PROFILE':'PLAYER PROFILE','冒險起步者':'Rookie Adventurer','未設定縣市':'County not set','尚未設定常玩分類':'Category not set','尚未設定擅長領域':'Category not set',
    '輸入 6 碼 PIN':'Enter 6-digit PIN','Join Room':'Join Room','Game Lobby':'Game Lobby'
  };
  const translateText = (root=document.body) => {
    const lang = localStorage.getItem('quizLang') || 'zh';
    const map = lang === 'en' ? en : dict;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(n){
        if (!n.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
        const p=n.parentElement; if(!p || ['SCRIPT','STYLE','TEXTAREA','INPUT'].includes(p.tagName)) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    const nodes=[]; while(walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(n=>{ const t=n.nodeValue.trim(); if(map[t]) n.nodeValue=n.nodeValue.replace(t,map[t]); });
    document.querySelectorAll('[placeholder]').forEach(el=>{ const t=el.getAttribute('placeholder'); if(map[t]) el.setAttribute('placeholder', map[t]); });
  };
  const displayName = () => safe(read('profile')?.displayName) || safe(localStorage.getItem('profileDisplayName')) || user();
  function patchLabels(){
    const wrong=$('wrongBookBtn'); if(wrong) wrong.innerHTML='<i class="fa-solid fa-book-open-reader"></i> 錯題練習';
    const teacher=$('teacherReportBtn'); if(teacher) teacher.innerHTML='<i class="fa-solid fa-chart-simple"></i> 老師看報表';
  }
  function patchStatus(){
    const name = displayName();
    if ($('loginStatus')) $('loginStatus').textContent = name || '尚未登入';
    if ($('profileUsernameText')) $('profileUsernameText').textContent = name || '玩家';
    const p = read('profile', {});
    if ($('profileCountyBadge')) $('profileCountyBadge').textContent = safe(p.county,'未設定縣市');
    if ($('profileFavCategoryBadge')) $('profileFavCategoryBadge').textContent = safe(p.favoriteCategory,'尚未設定常玩分類');
    if ($('profileFriendsText')) $('profileFriendsText').textContent = String((read('friends',[])||[]).length);
    if ($('profileWrongBookText')) $('profileWrongBookText').textContent = String((read('wrongBook',[])||[]).length);
  }
  function setAvatar(src){
    if(!src) return;
    ['profilePhotoPreview'].forEach(id=>{ const el=$(id); if(el){ el.src=src; el.style.display='block'; }});
    document.querySelectorAll('.friends-avatar-stack img:first-child,.login-status-card img').forEach(img=>img.src=src);
  }
  function patchUpload(){
    const input=$('profileAvatarInput'); if(!input || input.dataset.hotfixed) return;
    input.dataset.hotfixed='1';
    input.addEventListener('change', e=>{
      const f=e.target.files && e.target.files[0]; if(!f) return;
      if(!/^image\/(png|jpe?g|webp)$/i.test(f.type)){ alert('請選 PNG / JPG / WEBP 圖片'); input.value=''; return; }
      const r=new FileReader();
      r.onload=()=>{ const p=read('profile',{}); p.avatarUrl=String(r.result); write('profile',p); setAvatar(p.avatarUrl); };
      r.readAsDataURL(f);
    }, true);
  }
  function patchSave(){
    const btn=$('saveProfileBtn'); if(!btn || btn.dataset.hotfixed) return; btn.dataset.hotfixed='1';
    btn.addEventListener('click',()=>{
      const p=read('profile',{});
      p.displayName=safe($('profileDisplayNameInput')?.value, displayName());
      p.county=safe($('profileCountySelect')?.value, p.county||'');
      p.favoriteCategory=safe($('profileFavoriteCategoryInput')?.value, p.favoriteCategory||'');
      p.bio=safe($('profileBioInput')?.value, p.bio||'');
      write('profile',p); localStorage.setItem('profileDisplayName',p.displayName||''); patchStatus(); setAvatar(p.avatarUrl);
    }, true);
  }
  function patchFriends(){
    document.querySelectorAll('.friends-record-name').forEach(el=>{ if(el.textContent.trim()===user()) el.textContent=displayName(); });
  }
  function patchDark(){
    const on=localStorage.getItem('quizDarkMode')==='1'; document.documentElement.classList.toggle('qa-dark',on); document.body.classList.toggle('dark-mode',on);
    const btn=$('darkModeBtn'); if(btn && !btn.dataset.hotfixed){ btn.dataset.hotfixed='1'; btn.addEventListener('click',()=>{ const n=!document.body.classList.contains('dark-mode'); localStorage.setItem('quizDarkMode',n?'1':'0'); patchDark(); }); }
  }
  function run(){ patchLabels(); patchStatus(); patchUpload(); patchSave(); patchFriends(); patchDark(); translateText(); }
  document.addEventListener('DOMContentLoaded', run);
  window.addEventListener('load', run);
  new MutationObserver(()=>{ clearTimeout(window.__qaFixT); window.__qaFixT=setTimeout(run,80); }).observe(document.documentElement,{childList:true,subtree:true});
})();
