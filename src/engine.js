// Core helpers: screen constants, input, seeded randomness, pixel sprites,
// and the Earthbound-style window frame.
window.LQ = window.LQ || {};

LQ.W = 256;   // SNES-ish internal resolution
LQ.H = 224;
LQ.TILE = 16;

// GVSU blue + Laker-ish accents, plus Earthbound's pastel world palette.
LQ.COLORS = {
  gvBlue: '#0032a0',
  gvLight: '#5b8def',
  black: '#101018',
  white: '#f8f8f8',
  windowFill: '#101018',
  windowBorder: '#f8f8f8',
  windowBorder2: '#7088b8',
  text: '#f8f8f8',
  textDim: '#8890a8',
  highlight: '#f8e070',
};

// ---------------------------------------------------------------- input
LQ.Input = {
  down: {},
  pressed: {},
  typed: [],
  map: {
    ArrowUp: 'up', KeyW: 'up',
    ArrowDown: 'down', KeyS: 'down',
    ArrowLeft: 'left', KeyA: 'left',
    ArrowRight: 'right', KeyD: 'right',
    KeyZ: 'ok', Enter: 'ok', Space: 'ok',
    KeyX: 'cancel', Backspace: 'cancel', Escape: 'cancel',
    KeyC: 'menu', KeyM: 'map',
    ShiftLeft: 'run', ShiftRight: 'run',
  },
  init() {
    window.addEventListener('keydown', (e) => {
      if (e.key.length === 1 || e.key === 'Backspace' || e.key === 'Enter') this.typed.push(e.key);
      const a = this.map[e.code];
      if (!a) return;
      e.preventDefault();
      if (!this.down[a]) this.pressed[a] = true;
      this.down[a] = true;
    });
    window.addEventListener('keyup', (e) => {
      const a = this.map[e.code];
      if (a) this.down[a] = false;
    });
    window.addEventListener('blur', () => { this.down = {}; });
  },
  hit(a) { return !!this.pressed[a]; },
  held(a) { return !!this.down[a]; },
  endFrame() { this.pressed = {}; this.typed = []; },
};

// ---------------------------------------------------------------- random
// Deterministic hash noise so the generated map looks the same every load.
LQ.hash = function (x, y, seed) {
  let h = (x * 374761393 + y * 668265263 + (seed || 0) * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
};

LQ.rand = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
LQ.chance = (p) => Math.random() < p;
LQ.pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
LQ.clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// ---------------------------------------------------------------- sprites
// Build a canvas from rows of characters. `pal` maps a character to a color;
// '.' and ' ' are transparent.
LQ.makeSprite = function (rows, pal, scale) {
  scale = scale || 1;
  const w = Math.max(...rows.map((r) => r.length));
  const c = document.createElement('canvas');
  c.width = w * scale;
  c.height = rows.length * scale;
  const cx = c.getContext('2d');
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const col = pal[row[x]];
      if (!col) continue;
      cx.fillStyle = col;
      cx.fillRect(x * scale, y * scale, scale, scale);
    }
  });
  return c;
};

LQ.flipSprite = function (src) {
  const c = document.createElement('canvas');
  c.width = src.width;
  c.height = src.height;
  const cx = c.getContext('2d');
  cx.translate(src.width, 0);
  cx.scale(-1, 1);
  cx.drawImage(src, 0, 0);
  return c;
};

// Solid-color silhouette of a sprite, used for hit flashes.
LQ.tintSprite = function (src, color) {
  const c = document.createElement('canvas');
  c.width = src.width;
  c.height = src.height;
  const cx = c.getContext('2d');
  cx.drawImage(src, 0, 0);
  cx.globalCompositeOperation = 'source-in';
  cx.fillStyle = color;
  cx.fillRect(0, 0, c.width, c.height);
  return c;
};

// ---------------------------------------------------------------- windows
// Earthbound's "plain flavor" window: dark fill, rounded double border.
LQ.drawWindow = function (ctx, x, y, w, h, flavor) {
  const f = flavor || LQ.COLORS;
  ctx.fillStyle = f.windowFill || LQ.COLORS.windowFill;
  ctx.fillRect(x + 2, y + 2, w - 4, h - 4);
  ctx.fillStyle = f.windowBorder2 || LQ.COLORS.windowBorder2;
  ctx.fillRect(x + 2, y, w - 4, 1);
  ctx.fillRect(x + 2, y + h - 1, w - 4, 1);
  ctx.fillRect(x, y + 2, 1, h - 4);
  ctx.fillRect(x + w - 1, y + 2, 1, h - 4);
  ctx.fillRect(x + 1, y + 1, 1, 1);
  ctx.fillRect(x + w - 2, y + 1, 1, 1);
  ctx.fillRect(x + 1, y + h - 2, 1, 1);
  ctx.fillRect(x + w - 2, y + h - 2, 1, 1);
  ctx.fillStyle = f.windowBorder || LQ.COLORS.windowBorder;
  ctx.fillRect(x + 3, y + 2, w - 6, 1);
  ctx.fillRect(x + 3, y + h - 3, w - 6, 1);
  ctx.fillRect(x + 2, y + 3, 1, h - 6);
  ctx.fillRect(x + w - 3, y + 3, 1, h - 6);
};

// Blinking triangle cursor (Earthbound's pointing finger is close enough).
LQ.drawCursor = function (ctx, x, y, t) {
  const bob = Math.floor(t / 8) % 2;
  ctx.fillStyle = LQ.COLORS.highlight;
  for (let i = 0; i < 4; i++) ctx.fillRect(x + bob + i, y + 1 + i, 1, 7 - i * 2);
};

// "More text" arrow at the bottom of a dialogue box.
LQ.drawMoreArrow = function (ctx, x, y, t) {
  if (Math.floor(t / 15) % 2) return;
  ctx.fillStyle = LQ.COLORS.white;
  for (let i = 0; i < 3; i++) ctx.fillRect(x + i, y + i, 5 - i * 2, 1);
};

// ---------------------------------------------------------------- audio
// Tiny square-wave blips so menus feel responsive. No asset files needed.
LQ.Sound = {
  ctx: null,
  enabled: true,
  ensure() {
    if (!this.ctx) {
      try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { this.enabled = false; }
    }
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  },
  tone(freq, dur, type, vol, slide) {
    if (!this.enabled) return;
    this.ensure();
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type || 'square';
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.linearRampToValueAtTime(slide, t + dur);
    g.gain.setValueAtTime(vol || 0.05, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.ctx.destination);
    o.start(t);
    o.stop(t + dur);
  },
  cursor() { this.tone(880, 0.04); },
  select() { this.tone(660, 0.05); this.tone(990, 0.08); },
  cancel() { this.tone(440, 0.07, 'square', 0.05, 330); },
  text() { this.tone(1200 + Math.random() * 200, 0.015, 'square', 0.02); },
  hit() { this.tone(160, 0.12, 'sawtooth', 0.08, 60); },
  smash() { this.tone(90, 0.3, 'sawtooth', 0.1, 40); this.tone(1400, 0.2, 'square', 0.04, 300); },
  hurt() { this.tone(220, 0.15, 'square', 0.07, 110); },
  heal() { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => this.tone(f, 0.1, 'triangle', 0.06), i * 70)); },
  psi() { for (let i = 0; i < 6; i++) setTimeout(() => this.tone(300 + i * 150, 0.08, 'triangle', 0.05), i * 40); },
  encounter() { [880, 660, 440, 330, 220].forEach((f, i) => setTimeout(() => this.tone(f, 0.09, 'square', 0.06), i * 60)); },
  win() { [523, 659, 784, 659, 784, 1047].forEach((f, i) => setTimeout(() => this.tone(f, 0.14, 'square', 0.05), i * 110)); },
  levelUp() { [392, 523, 659, 784, 1047, 1319].forEach((f, i) => setTimeout(() => this.tone(f, 0.12, 'triangle', 0.07), i * 80)); },
  bell() { [392, 494, 587, 784].forEach((f, i) => setTimeout(() => { this.tone(f, 1.2, 'triangle', 0.06); this.tone(f * 2.01, 0.8, 'sine', 0.03); }, i * 400)); },
  offKeyBell() { [392, 415, 370, 311].forEach((f, i) => setTimeout(() => { this.tone(f, 1.0, 'triangle', 0.06); this.tone(f * 2.13, 0.7, 'sine', 0.03); }, i * 350)); },
};
