// ── 房間主題皮膚 ──
const THEMES = [
  { id: 'default',  label: '預設',       bg: 'images/waiting.jpg',  music: null,  emoji: '🏠', color: '#f4dce4' },
  { id: 'space',    label: '宇宙星空',   bg: 'images/bg_space.jpg',  music: null,  emoji: '🚀', color: '#0f0c29' },
  { id: 'forest',  label: '魔法森林',    bg: 'images/bg_forest.jpg', music: null,  emoji: '🌲', color: '#134e1a' },
  { id: 'ocean',   label: '深海世界',    bg: 'images/bg_ocean.jpg',  music: null,  emoji: '🌊', color: '#0c3460' },
  { id: 'sakura',  label: '櫻花祭典',    bg: 'images/bg_sakura.jpg', music: null,  emoji: '🌸', color: '#ffd6e0' },
  { id: 'cyber',   label: '賽博龐克',    bg: 'images/bg_cyber.jpg',  music: null,  emoji: '🤖', color: '#1a0533' },
  { id: 'cute',    label: '可愛粉彩',    bg: 'images/bg_cute.jpg',   music: null,  emoji: '🎀', color: '#ffe8f5' },
  { id: 'egypt',   label: '古埃及探索',  bg: 'images/bg_egypt.jpg',  music: null,  emoji: '🏛️',  color: '#4a2c00' },
];

const THEME_KEY = 'quizarena_room_theme';

function getCurrentTheme() {
  try { return JSON.parse(localStorage.getItem(THEME_KEY)) || THEMES[0]; } catch { return THEMES[0]; }
}
function saveTheme(theme) { localStorage.setItem(THEME_KEY, JSON.stringify(theme)); }

function applyTheme(theme) {
  // Apply background color overlay (fallback if image not found)
  document.body.style.setProperty('--theme-overlay', theme.color + '44');
  // Try to apply background image
  const img = new Image();
  img.onload = () => { document.body.style.backgroundImage = `url(${theme.bg})`; };
  img.onerror = () => {
    // fallback: gradient based on theme color
    document.body.style.backgroundImage = `none`;
    document.body.style.backgroundColor = theme.color;
  };
  img.src = theme.bg;
}

function renderThemePicker() {
  const grid = document.getElementById('themePickerGrid');
  const wrap = document.getElementById('themePickerWrap');
  if (!grid || !wrap) return;
  
  // Only show for host
  const currentUser = localStorage.getItem('currentUser') || '';
  const roomHost = localStorage.getItem('quizarena_room_host') || '';
  // Show picker in waiting room always (host only in real app)
  wrap.style.display = '';

  const current = getCurrentTheme();
  grid.innerHTML = THEMES.map(t => `
    <button class="theme-opt-btn ${t.id === current.id ? 'active' : ''}" 
            data-theme-id="${t.id}" type="button" title="${t.label}"
            style="background:${t.color};">
      <span class="theme-emoji">${t.emoji}</span>
      <span class="theme-label">${t.label}</span>
      ${t.id === current.id ? '<i class="fa-solid fa-check theme-check"></i>' : ''}
    </button>`).join('');

  grid.querySelectorAll('.theme-opt-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const theme = THEMES.find(t => t.id === btn.dataset.themeId);
      if (!theme) return;
      saveTheme(theme);
      applyTheme(theme);
      renderThemePicker(); // re-render to update active state
      // Broadcast to other players via localStorage event
      localStorage.setItem('quizarena_room_theme_update', JSON.stringify({ theme, ts: Date.now() }));
    });
  });
}

// Listen for theme changes from host
window.addEventListener('storage', (e) => {
  if (e.key === 'quizarena_room_theme_update') {
    try {
      const { theme } = JSON.parse(e.newValue);
      applyTheme(theme);
    } catch {}
  }
});

// Init
applyTheme(getCurrentTheme());
renderThemePicker();
