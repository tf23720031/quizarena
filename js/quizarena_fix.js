
document.addEventListener('DOMContentLoaded', () => {
  // 修正 [object PointerEvent]
  const nameInput = document.getElementById('profileDisplayNameInput');
  if(nameInput && String(nameInput.value).includes('[object')){
    nameInput.value = localStorage.getItem('currentUser') || '';
  }

  // 修正好友 / 成就同步
  const loginStatus = document.getElementById('loginStatus');
  const profileUsernameText = document.getElementById('profileUsernameText');

  if(loginStatus && profileUsernameText){
    const fixedName = localStorage.getItem('currentUser') || profileUsernameText.textContent || '玩家';
    if(profileUsernameText.textContent.includes('[object')){
      profileUsernameText.textContent = fixedName;
    }
  }

  // 上傳圖片即時預覽
  const avatarInput = document.getElementById('profileAvatarInput');
  const avatarPreview = document.getElementById('profilePhotoPreview');

  if(avatarInput && avatarPreview){
    avatarInput.addEventListener('change', (e)=>{
      const file = e.target.files?.[0];
      if(!file) return;

      const reader = new FileReader();

      reader.onload = (ev)=>{
        avatarPreview.src = ev.target.result;
        avatarPreview.style.display = 'block';
        localStorage.setItem('qa_avatar', ev.target.result);
      };

      reader.readAsDataURL(file);
    });
  }

  // 同步好友排行頭像
  const savedAvatar = localStorage.getItem('qa_avatar');
  if(savedAvatar){
    document.querySelectorAll('.friends-avatar-stack img').forEach(img=>{
      img.src = savedAvatar;
    });
  }

  // 文字更直覺
  const wrongBookBtn = document.getElementById('wrongBookBtn');
  const teacherReportBtn = document.getElementById('teacherReportBtn');

  if(wrongBookBtn){
    wrongBookBtn.innerHTML = '<i class="fa-solid fa-book"></i> 錯題練習';
  }

  if(teacherReportBtn){
    teacherReportBtn.innerHTML = '<i class="fa-solid fa-chart-column"></i> 老師看報表';
  }

  // 翻譯補丁
  const patchMap = {
    '錯題練習':'Wrong Practice',
    '老師看報表':'Teacher Dashboard',
    '好友排行':'Friends Ranking',
  };

  const lang = localStorage.getItem('quizLang') || 'zh';

  if(lang === 'en'){
    document.querySelectorAll('*').forEach(el=>{
      if(el.children.length === 0){
        const txt = el.textContent.trim();
        if(patchMap[txt]){
          el.textContent = patchMap[txt];
        }
      }
    });
  }

  // 深色模式同步內頁
  if(localStorage.getItem('quizDarkMode') === '1'){
    document.body.classList.add('dark-mode');
  }
});
