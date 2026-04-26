:root {
  --bg-1: #fff7fc;
  --bg-2: #ffe7f3;
  --bg-3: #ffd4ea;
  --card: rgba(255,255,255,.74);
  --card-strong: rgba(255,255,255,.9);
  --line: rgba(255, 133, 193, .24);
  --text: #663154;
  --muted: #8e6280;
  --primary: #ff78b3;
  --primary-strong: #f25a9e;
  --secondary: #8f7cff;
  --success: #53b58a;
  --warning: #ffb457;
  --danger: #f06d85;
  --shadow: 0 18px 50px rgba(227, 113, 169, .18);
  --radius-xl: 30px;
  --radius-lg: 22px;
  --radius-md: 16px;
}

* { box-sizing: border-box; }
html, body { min-height: 100%; }
body {
  margin: 0;
  color: var(--text);
  font-family: "Segoe UI", "Noto Sans TC", system-ui, sans-serif;
  background:
    radial-gradient(circle at top left, rgba(255,255,255,.9), transparent 38%),
    radial-gradient(circle at bottom right, rgba(255,255,255,.65), transparent 30%),
    linear-gradient(135deg, var(--bg-1), var(--bg-2) 50%, var(--bg-3));
}
body::before {
  content: "";
  position: fixed;
  inset: 0;
  pointer-events: none;
  background-image:
    radial-gradient(rgba(255,255,255,.8) 1.2px, transparent 1.2px),
    radial-gradient(rgba(255,179,215,.45) 1.2px, transparent 1.2px);
  background-size: 24px 24px, 36px 36px;
  background-position: 0 0, 12px 12px;
  opacity: .36;
}

img { max-width: 100%; display: block; }
a { color: inherit; text-decoration: none; }
button, input, select, textarea { font: inherit; }

.page-shell {
  position: relative;
  z-index: 1;
  max-width: 1320px;
  margin: 0 auto;
  padding: 24px 20px 36px;
}

.topbar, .page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 22px;
  flex-wrap: wrap;
}

.logo-pill, .status-pill {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  padding: 12px 18px;
  border-radius: 999px;
  background: rgba(255,255,255,.7);
  border: 1px solid var(--line);
  box-shadow: var(--shadow);
  backdrop-filter: blur(14px);
}
.logo-pill img { height: 42px; width: auto; }

.card-glass {
  background: var(--card);
  border: 1px solid var(--line);
  box-shadow: var(--shadow);
  border-radius: var(--radius-xl);
  backdrop-filter: blur(18px);
}

.section-title { font-size: clamp(1.25rem, 2vw, 1.8rem); font-weight: 800; margin: 0 0 8px; }
.section-desc { color: var(--muted); margin: 0; }
.muted { color: var(--muted); }
.small-text { font-size: .92rem; }
.tiny-text { font-size: .82rem; }

.btn-qa {
  border: 0;
  border-radius: 999px;
  padding: 12px 20px;
  font-weight: 700;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  transition: transform .18s ease, box-shadow .18s ease, opacity .18s ease;
}
.btn-qa:hover { transform: translateY(-1px); }
.btn-qa:active { transform: translateY(0); }
.btn-primary-qa { background: linear-gradient(135deg, var(--primary), var(--primary-strong)); color: white; box-shadow: 0 14px 28px rgba(242, 90, 158, .28); }
.btn-secondary-qa { background: rgba(255,255,255,.95); color: var(--text); border: 1px solid var(--line); }
.btn-soft-qa { background: rgba(255, 255, 255, .56); color: var(--text); border: 1px dashed rgba(255, 120, 179, .32); }
.btn-danger-qa { background: linear-gradient(135deg, #ffa0b8, #f06d85); color: white; }
.btn-success-qa { background: linear-gradient(135deg, #78d9af, #53b58a); color: white; }

.input-qa,
.select-qa,
.textarea-qa {
  width: 100%;
  border-radius: 16px;
  border: 1px solid rgba(255, 133, 193, .28);
  background: rgba(255,255,255,.85);
  padding: 14px 16px;
  color: var(--text);
  outline: none;
  box-shadow: inset 0 1px 0 rgba(255,255,255,.7);
}
.textarea-qa { min-height: 110px; resize: vertical; }
.input-qa:focus,
.select-qa:focus,
.textarea-qa:focus {
  border-color: rgba(242, 90, 158, .5);
  box-shadow: 0 0 0 4px rgba(242, 90, 158, .12);
}

.label-qa {
  display: block;
  margin-bottom: 8px;
  font-weight: 700;
  font-size: .95rem;
}

.grid-2 { display: grid; grid-template-columns: 1.1fr .9fr; gap: 22px; }
.grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
.stack-16 { display: flex; flex-direction: column; gap: 16px; }
.stack-20 { display: flex; flex-direction: column; gap: 20px; }
.row-wrap { display: flex; gap: 12px; flex-wrap: wrap; }

.badge-qa {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 7px 12px;
  border-radius: 999px;
  font-size: .82rem;
  font-weight: 700;
  background: rgba(255,255,255,.72);
  border: 1px solid var(--line);
}
.badge-private { color: #b35578; }
.badge-public { color: #5b61d0; }
.badge-team { color: #37906a; }
.badge-playing { color: #ad6b19; }

.avatar-stage {
  position: relative;
  width: 200px;
  aspect-ratio: 1 / 1;
  margin: 0 auto;
}
.avatar-stage.sm { width: 72px; }
.avatar-stage.xs { width: 54px; }
.avatar-layer {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: contain;
  pointer-events: none;
}

.toast-qa {
  position: fixed;
  right: 18px;
  bottom: 18px;
  z-index: 3000;
  min-width: 230px;
  max-width: 380px;
  padding: 14px 16px;
  border-radius: 16px;
  background: rgba(102, 49, 84, .92);
  color: #fff;
  box-shadow: 0 16px 40px rgba(0,0,0,.18);
  transform: translateY(14px);
  opacity: 0;
  pointer-events: none;
  transition: .24s ease;
}
.toast-qa.show { transform: translateY(0); opacity: 1; }

.modal-content {
  border: 1px solid var(--line);
  border-radius: 28px;
  background: rgba(255, 250, 253, .96);
  box-shadow: var(--shadow);
}

@media (max-width: 1024px) {
  .grid-2 { grid-template-columns: 1fr; }
}
@media (max-width: 768px) {
  .page-shell { padding: 18px 14px 28px; }
  .grid-3 { grid-template-columns: 1fr; }
}
