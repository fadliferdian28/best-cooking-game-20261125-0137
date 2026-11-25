// All the drawing. Given a kitchen state it paints the whole diner: wall,
// appliances, crates, plate, pass and the ticket board. Nothing else draws.
import { W, H, HEADER, BOARD, SERVE, PLATE, HAND, STATIONS, CRATES, START_BTN } from './layout.js';
import { INGREDIENTS, DISHES, dishById, PROCESS_LABEL } from './recipes.js';
import { SHIFT_SECONDS } from './kitchen.js';

const FONT = 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
const INK = '#1b1d21';
const CREAM = '#f7ead2';
const BRASS = '#e2b467';
const RED = '#e14b3a';
const MINT = '#7fd0a8';

let glowUntil = 0;
let glowDish = null;
let steamSeed = 0;

function rr(ctx, x, y, w, h, r) {
  const rad = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + w, y, x + w, y + h, rad);
  ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad);
  ctx.arcTo(x, y, x + w, y, rad);
  ctx.closePath();
}

function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.min(255, (n >> 16) + amt));
  const g = Math.max(0, Math.min(255, ((n >> 8) & 255) + amt));
  const b = Math.max(0, Math.min(255, (n & 255) + amt));
  return `rgb(${r},${g},${b})`;
}

function label(ctx, text, x, y, size, color = CREAM, weight = 600, align = 'left', track = 0) {
  ctx.font = `${weight} ${size}px ${FONT}`;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  if (!track) {
    ctx.fillText(text, x, y);
    return;
  }
  ctx.save();
  let cx = x;
  if (align === 'center') cx = x - (text.length - 1) * track / 2;
  if (align === 'right') cx = x - (text.length - 1) * track;
  ctx.textAlign = 'left';
  for (const ch of text) {
    ctx.fillText(ch, cx, y);
    cx += ctx.measureText(ch).width + track;
  }
  ctx.restore();
}

function fmtClock(sec) {
  const s = Math.max(0, Math.ceil(sec));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}

// ---- small food glyphs ---------------------------------------------------

function tomato(ctx, x, y, s) {
  ctx.fillStyle = RED;
  ctx.beginPath();
  ctx.ellipse(x, y + s * 0.06, s * 0.46, s * 0.43, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.22)';
  ctx.beginPath();
  ctx.ellipse(x - s * 0.13, y - s * 0.12, s * 0.12, s * 0.09, -0.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#4f8d40';
  for (let i = 0; i < 5; i++) {
    const a = i * (Math.PI * 2 / 5) - 0.4;
    ctx.beginPath();
    ctx.ellipse(x + Math.cos(a) * s * 0.16, y - s * 0.36 + Math.sin(a) * s * 0.06, s * 0.11, s * 0.05, a, 0, Math.PI * 2);
    ctx.fill();
  }
}

function onion(ctx, x, y, s) {
  ctx.fillStyle = '#c46b92';
  ctx.beginPath();
  ctx.ellipse(x, y + s * 0.08, s * 0.42, s * 0.38, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,230,242,.7)';
  ctx.lineWidth = Math.max(1, s * 0.05);
  for (let i = 1; i <= 3; i++) {
    ctx.beginPath();
    ctx.ellipse(x, y + s * 0.08, s * 0.42 * (i / 4), s * 0.38 * (i / 4), 0, -2.5, 1.4);
    ctx.stroke();
  }
  ctx.strokeStyle = '#6c9a4e';
  ctx.beginPath();
  ctx.moveTo(x, y - s * 0.3);
  ctx.quadraticCurveTo(x + s * 0.1, y - s * 0.55, x + s * 0.26, y - s * 0.52);
  ctx.stroke();
}

function herb(ctx, x, y, s) {
  ctx.strokeStyle = '#3f7a35';
  ctx.lineWidth = Math.max(1.6, s * 0.07);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x - s * 0.05, y + s * 0.42);
  ctx.quadraticCurveTo(x + s * 0.05, y, x - s * 0.02, y - s * 0.42);
  ctx.stroke();
  ctx.fillStyle = '#6fb552';
  for (let i = 0; i < 4; i++) {
    const yy = y + s * 0.22 - i * s * 0.19;
    const dir = i % 2 === 0 ? 1 : -1;
    ctx.beginPath();
    ctx.ellipse(x + dir * s * 0.17, yy, s * 0.17, s * 0.08, dir * -0.5, 0, Math.PI * 2);
    ctx.fill();
  }
}

function bun(ctx, x, y, s) {
  ctx.fillStyle = '#d79a55';
  ctx.beginPath();
  ctx.moveTo(x - s * 0.48, y + s * 0.3);
  ctx.quadraticCurveTo(x - s * 0.5, y - s * 0.3, x, y - s * 0.34);
  ctx.quadraticCurveTo(x + s * 0.5, y - s * 0.3, x + s * 0.48, y + s * 0.3);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(120,70,20,.45)';
  ctx.lineWidth = Math.max(1, s * 0.03);
  ctx.beginPath();
  ctx.moveTo(x - s * 0.47, y + s * 0.16);
  ctx.quadraticCurveTo(x, y + s * 0.32, x + s * 0.47, y + s * 0.16);
  ctx.stroke();
  ctx.fillStyle = '#f3d9a9';
  for (const [dx, dy] of [[-0.2, -0.18], [0.05, -0.24], [0.27, -0.14], [-0.04, -0.06], [0.19, -0.02]]) {
    ctx.beginPath();
    ctx.ellipse(x + s * dx, y + s * dy, s * 0.035, s * 0.022, -0.5, 0, Math.PI * 2);
    ctx.fill();
  }
}

function patty(ctx, x, y, s, cooked = true) {
  ctx.fillStyle = cooked ? '#7a4a2c' : '#9c6444';
  rr(ctx, x - s * 0.5, y - s * 0.19, s, s * 0.4, s * 0.15);
  ctx.fill();
  ctx.strokeStyle = cooked ? 'rgba(40,18,8,.55)' : 'rgba(255,220,180,.25)';
  ctx.lineWidth = Math.max(1, s * 0.04);
  for (let i = -1; i <= 1; i++) {
    ctx.beginPath();
    ctx.moveTo(x - s * 0.33, y + i * s * 0.1);
    ctx.lineTo(x + s * 0.33, y + i * s * 0.1 + s * 0.03);
    ctx.stroke();
  }
  if (cooked) {
    ctx.fillStyle = 'rgba(255,190,120,.35)';
    ctx.beginPath();
    ctx.ellipse(x - s * 0.14, y - s * 0.1, s * 0.14, s * 0.05, -0.2, 0, Math.PI * 2);
    ctx.fill();
  }
}

function cheese(ctx, x, y, s) {
  ctx.fillStyle = '#f4c64d';
  ctx.beginPath();
  ctx.moveTo(x - s * 0.48, y - s * 0.1);
  ctx.lineTo(x + s * 0.48, y - s * 0.2);
  ctx.lineTo(x + s * 0.34, y + s * 0.26);
  ctx.lineTo(x - s * 0.36, y + s * 0.2);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(255,240,180,.75)';
  for (const [dx, dy] of [[-0.2, 0.0], [0.12, -0.06], [0.22, 0.08]]) {
    ctx.beginPath();
    ctx.arc(x + s * dx, y + s * dy, s * 0.05, 0, Math.PI * 2);
    ctx.fill();
  }
}

function pasta(ctx, x, y, s) {
  ctx.strokeStyle = '#f0d596';
  ctx.lineWidth = Math.max(1.4, s * 0.055);
  ctx.lineCap = 'round';
  for (let i = 0; i < 5; i++) {
    ctx.beginPath();
    ctx.ellipse(x, y, s * (0.16 + i * 0.06), s * (0.1 + i * 0.042), 0.25 + i * 0.08, 0.3, Math.PI * 1.7);
    ctx.stroke();
  }
  ctx.fillStyle = '#fff1c6';
  ctx.beginPath();
  ctx.arc(x + s * 0.1, y - s * 0.05, s * 0.05, 0, Math.PI * 2);
  ctx.fill();
}

export function drawIngredient(ctx, id, x, y, s, processed = false) {
  ctx.save();
  if (processed && (id === 'tomato' || id === 'onion' || id === 'herb')) {
    // chopped: three little bits on a board-like shadow
    ctx.fillStyle = 'rgba(20,14,10,.18)';
    ctx.beginPath();
    ctx.ellipse(x, y + s * 0.3, s * 0.5, s * 0.16, 0, 0, Math.PI * 2);
    ctx.fill();
    const bits = id === 'herb' ? 9 : 7;
    for (let i = 0; i < bits; i++) {
      const a = (i / bits) * Math.PI * 2 + 0.4;
      const bx = x + Math.cos(a) * s * 0.26;
      const by = y + Math.sin(a) * s * 0.16 + s * 0.06;
      if (id === 'herb') {
        ctx.fillStyle = i % 2 ? '#6fb552' : '#4c8a3d';
        ctx.beginPath();
        ctx.ellipse(bx, by, s * 0.09, s * 0.04, a, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = id === 'tomato' ? (i % 2 ? '#e14b3a' : '#c93a2d') : (i % 2 ? '#c46b92' : '#b05a80');
        rr(ctx, bx - s * 0.09, by - s * 0.07, s * 0.18, s * 0.14, s * 0.04);
        ctx.fill();
      }
    }
    ctx.restore();
    return;
  }
  if (id === 'tomato') tomato(ctx, x, y, s);
  else if (id === 'onion') onion(ctx, x, y, s);
  else if (id === 'herb') herb(ctx, x, y, s);
  else if (id === 'bun') bun(ctx, x, y, s);
  else if (id === 'patty') patty(ctx, x, y, s, processed);
  else if (id === 'cheese') cheese(ctx, x, y, s);
  else pasta(ctx, x, y, s);
  ctx.restore();
}

export function drawDish(ctx, dishId, x, y, s) {
  const dish = dishById(dishId);
  ctx.save();
  if (dish.id === 'sunset' || dish.id === 'melt') {
    bun(ctx, x, y + s * 0.36, s * 0.95);
    patty(ctx, x, y + s * 0.14, s, true);
    if (dish.id === 'melt') onion(ctx, x + s * 0.06, y - s * 0.02, s * 0.55);
    tomato(ctx, x - s * 0.1, y - s * 0.06, s * 0.5);
    cheese(ctx, x, y - s * 0.2, s * 0.86);
    bun(ctx, x, y - s * 0.3, s * 0.9);
  } else if (dish.id === 'pasta') {
    ctx.fillStyle = '#d8cbb4';
    ctx.beginPath();
    ctx.ellipse(x, y + s * 0.1, s * 0.6, s * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f4efe4';
    ctx.beginPath();
    ctx.ellipse(x, y + s * 0.02, s * 0.52, s * 0.24, 0, 0, Math.PI * 2);
    ctx.fill();
    pasta(ctx, x, y - s * 0.02, s);
    drawTomatoBits(ctx, x + s * 0.14, y - s * 0.06, s * 0.36);
    herb(ctx, x - s * 0.16, y - s * 0.16, s * 0.42);
  } else {
    bun(ctx, x, y + s * 0.2, s);
    drawTomatoBits(ctx, x, y, s * 0.7);
    onion(ctx, x + s * 0.2, y - s * 0.08, s * 0.4);
    herb(ctx, x - s * 0.2, y - s * 0.12, s * 0.5);
  }
  ctx.restore();
}

function drawTomatoBits(ctx, x, y, s) {
  for (const [dx, dy] of [[-0.2, 0.1], [0.22, 0.06], [0.02, -0.12]]) {
    ctx.fillStyle = '#d8412f';
    ctx.beginPath();
    ctx.ellipse(x + s * dx, y + s * dy, s * 0.12, s * 0.08, 0.3, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ---- background ----------------------------------------------------------

function drawHeader(ctx, st) {
  const g = ctx.createLinearGradient(0, 0, 0, HEADER);
  g.addColorStop(0, '#20262b');
  g.addColorStop(1, '#161a1e');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, HEADER);
  ctx.fillStyle = 'rgba(226,180,103,.35)';
  ctx.fillRect(0, HEADER - 2, W, 2);

  label(ctx, 'SIZZLE', 24, 28, 21, CREAM, 800, 'left', 2);
  label(ctx, 'SHIFT', 24, 48, 13, BRASS, 700, 'left', 4);

  // score
  const score = Math.max(0, st.score).toString().padStart(4, '0');
  label(ctx, 'SCORE', 208, 20, 10, 'rgba(247,234,210,.55)', 700, 'left', 1.5);
  label(ctx, `$${score}`, 208, 42, 24, CREAM, 800, 'left', 1);

  // combo
  const mult = st.comboMult;
  label(ctx, 'COMBO', 336, 20, 10, 'rgba(247,234,210,.55)', 700, 'left', 1.5);
  label(ctx, st.combo > 0 ? `x${mult.toFixed(1)}` : '—', 336, 42, 22, st.combo > 0 ? MINT : 'rgba(247,234,210,.35)', 800);
  if (st.combo > 1) {
    label(ctx, `${st.combo} in a row`, 402, 44, 11, MINT, 600);
  }

  // hearts
  label(ctx, 'TICKETS LOST', 552, 20, 10, 'rgba(247,234,210,.55)', 700, 'left', 1.2);
  for (let i = 0; i < 3; i++) {
    drawHeart(ctx, 560 + i * 24, 42, 9, i < st.hearts ? RED : 'rgba(247,234,210,.14)');
  }

  // clock
  const left = st.shiftLeft;
  const frac = left / SHIFT_SECONDS;
  const warn = left <= 30;
  label(ctx, 'SHIFT CLOCK', 880, 18, 10, 'rgba(247,234,210,.55)', 700, 'right', 1.4);
  label(ctx, fmtClock(left), 880, 42, 26, warn ? '#ff8a72' : CREAM, 800, 'right');
  rr(ctx, 900, 22, 168, 24, 12);
  ctx.fillStyle = 'rgba(255,255,255,.08)';
  ctx.fill();
  ctx.save();
  rr(ctx, 900, 22, 168, 24, 12);
  ctx.clip();
  ctx.fillStyle = frac > 0.35 ? MINT : frac > 0.15 ? BRASS : '#e0573f';
  ctx.fillRect(900, 22, 168 * Math.max(0, Math.min(1, frac)), 24);
  ctx.restore();
  label(ctx, `RUSH ${st.rushLevel + 1}/4`, 1104, 22, 11, st.rushLevel >= 2 ? '#ff9a7f' : 'rgba(247,234,210,.7)', 700);
  for (let i = 0; i < 4; i++) {
    rr(ctx, 1104 + i * 30, 34, 22, 10, 4);
    ctx.fillStyle = i <= st.rushLevel ? (i >= 2 ? '#e0573f' : BRASS) : 'rgba(255,255,255,.1)';
    ctx.fill();
  }

  label(ctx, 'M  sound', 1244, 22, 9, 'rgba(247,234,210,.4)', 600, 'right');
  label(ctx, 'P  pause', 1244, 44, 9, 'rgba(247,234,210,.4)', 600, 'right');
}

function drawHeart(ctx, x, y, s, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x, y + s * 0.9);
  ctx.bezierCurveTo(x - s * 1.6, y - s * 0.3, x - s * 0.6, y - s * 1.3, x, y - s * 0.4);
  ctx.bezierCurveTo(x + s * 0.6, y - s * 1.3, x + s * 1.6, y - s * 0.3, x, y + s * 0.9);
  ctx.fill();
}

function drawRoom(ctx, st, t) {
  // wall
  const wall = ctx.createLinearGradient(0, HEADER, 0, 350);
  wall.addColorStop(0, '#243238');
  wall.addColorStop(1, '#2f4048');
  ctx.fillStyle = wall;
  ctx.fillRect(0, HEADER, W, H - HEADER);

  ctx.strokeStyle = 'rgba(255,255,255,.045)';
  ctx.lineWidth = 1;
  for (let x = 0; x < W; x += 64) {
    ctx.beginPath();
    ctx.moveTo(x, HEADER);
    ctx.lineTo(x, 150);
    ctx.stroke();
  }
  for (let y = HEADER + 24; y < 150; y += 22) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }

  // shelf with jars on the left top
  ctx.fillStyle = '#43301f';
  ctx.fillRect(0, 148, 840, 10);
  ctx.fillStyle = 'rgba(0,0,0,.28)';
  ctx.fillRect(0, 158, 840, 6);
  const jars = [['#8da05e', 0.5], ['#c9714b', 0.62], ['#d9b25f', 0.45], ['#7fb087', 0.55], ['#b3765d', 0.4]];
  jars.forEach(([c, fill], i) => {
    const x = 46 + i * 62;
    ctx.fillStyle = 'rgba(220,240,240,.10)';
    rr(ctx, x, 100, 34, 50, 8);
    ctx.fill();
    ctx.fillStyle = c;
    rr(ctx, x + 3, 100 + 50 * (1 - fill), 28, 50 * fill, 5);
    ctx.fill();
    ctx.fillStyle = '#d9c7a3';
    rr(ctx, x - 2, 92, 38, 12, 4);
    ctx.fill();
  });

  // hanging pans top-right over the pass
  for (let i = 0; i < 3; i++) {
    const x = 960 + i * 92;
    ctx.strokeStyle = 'rgba(230,200,150,.35)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, HEADER);
    ctx.lineTo(x, 96);
    ctx.stroke();
    ctx.fillStyle = '#3a4148';
    ctx.beginPath();
    ctx.arc(x, 116, 22 - i * 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#5a6269';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(x, 116, 22 - i * 3, 0, Math.PI * 2);
    ctx.stroke();
  }

  // back counter edge
  ctx.fillStyle = '#5a3c28';
  ctx.fillRect(0, 330, W, 16);
  ctx.fillStyle = 'rgba(255,220,170,.18)';
  ctx.fillRect(0, 330, W, 3);

  // front counter, warm wood with grain
  const wood = ctx.createLinearGradient(0, 346, 0, H);
  wood.addColorStop(0, '#6a4630');
  wood.addColorStop(0.35, '#5b3a26');
  wood.addColorStop(1, '#4a2f1f');
  ctx.fillStyle = wood;
  ctx.fillRect(0, 346, W, H - 346);
  ctx.strokeStyle = 'rgba(0,0,0,.12)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 26; i++) {
    const y = 352 + i * 15 + Math.sin(i * 2.1) * 2;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.bezierCurveTo(W * 0.3, y + 5, W * 0.6, y - 6, W, y + 2);
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(255,225,180,.13)';
  ctx.fillRect(0, 346, W, 4);

  // stove splash on wall behind stations
  ctx.fillStyle = 'rgba(0,0,0,.18)';
  rr(ctx, 24, 140, 776, 200, 14);
  ctx.fill();
}

function drawStations(ctx, st, t) {
  for (const spot of STATIONS) {
    const s = st.stations[spot.key];
    const held = s.item ? INGREDIENTS[s.item] : null;
    const hoverGlow = s.ready ? 1 : 0;
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,.30)';
    rr(ctx, spot.x + 5, spot.y + 8, spot.w, spot.h, 18);
    ctx.fill();

    const body = ctx.createLinearGradient(0, spot.y, 0, spot.y + spot.h);
    if (spot.key === 'chop') {
      body.addColorStop(0, '#a87a4e');
      body.addColorStop(1, '#7c5634');
    } else if (spot.key === 'grill') {
      body.addColorStop(0, '#4a5259');
      body.addColorStop(1, '#2c3237');
    } else {
      body.addColorStop(0, '#46545c');
      body.addColorStop(1, '#29343a');
    }
    ctx.fillStyle = body;
    rr(ctx, spot.x, spot.y, spot.w, spot.h, 18);
    ctx.fill();
    ctx.strokeStyle = s.ready ? 'rgba(127,208,168,.9)' : 'rgba(255,255,255,.09)';
    ctx.lineWidth = s.ready ? 3 : 1.5;
    ctx.stroke();

    // station nameplate
    label(ctx, spot.name.toUpperCase(), spot.x + 16, spot.y + 20, 11, 'rgba(247,234,210,.72)', 700, 'left', 1.2);
    ctx.fillStyle = 'rgba(0,0,0,.28)';
    rr(ctx, spot.x + spot.w - 46, spot.y + 10, 32, 22, 6);
    ctx.fill();
    label(ctx, spot.hint, spot.x + spot.w - 30, spot.y + 22, 12, BRASS, 800, 'center');

    const cx = spot.x + spot.w / 2;
    const cy = spot.y + spot.h / 2 + 10;

    if (spot.key === 'chop') {
      // cutting board
      ctx.fillStyle = '#d9b47e';
      rr(ctx, cx - 84, cy - 34, 168, 86, 12);
      ctx.fill();
      ctx.strokeStyle = 'rgba(120,80,40,.35)';
      ctx.lineWidth = 2;
      for (let i = 0; i < 4; i++) {
        ctx.beginPath();
        ctx.moveTo(cx - 74, cy - 20 + i * 18);
        ctx.lineTo(cx + 74, cy - 24 + i * 18);
        ctx.stroke();
      }
      if (held) {
        drawIngredient(ctx, s.item, cx, cy - 2, 58, s.ready);
        if (!s.ready) drawChopKnife(ctx, cx + 58, cy - 34, t, s.progress / s.need);
      }
      if (!s.ready && held) {
        drawPips(ctx, cx, spot.y + spot.h - 18, 3, s.progress, '#7fd0a8');
      }
    } else if (spot.key === 'grill') {
      ctx.fillStyle = '#1d2124';
      rr(ctx, cx - 86, cy - 38, 172, 88, 10);
      ctx.fill();
      // hot bars
      for (let i = 0; i < 5; i++) {
        const heat = 0.25 + 0.2 * Math.sin(t * 2 + i);
        ctx.strokeStyle = held ? `rgba(240,110,60,${0.35 + heat * 0.4})` : 'rgba(120,130,138,.55)';
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(cx - 72, cy - 26 + i * 17);
        ctx.lineTo(cx + 72, cy - 26 + i * 17);
        ctx.stroke();
      }
      if (held) {
        patty(ctx, cx, cy - 10, 60, s.ready || s.progress > s.need * 0.5);
        if (!s.ready) drawPips(ctx, cx, spot.y + spot.h - 18, 1, s.progress / s.need, '#ffa06a');
      }
      if (held && !s.ready) steam(ctx, cx, cy - 34, t, 0.7);
    } else {
      ctx.fillStyle = '#20272c';
      ctx.beginPath();
      ctx.ellipse(cx, cy - 2, 82, 40, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = held ? '#c9a86a' : '#3c474e';
      ctx.beginPath();
      ctx.ellipse(cx, cy - 6, 72, 32, 0, 0, Math.PI * 2);
      ctx.fill();
      if (held) {
        ctx.fillStyle = 'rgba(255,235,190,.5)';
        for (let i = 0; i < 5; i++) {
          const a = t * 1.4 + i * 1.3;
          ctx.beginPath();
          ctx.arc(cx + Math.cos(a) * 34, cy - 9 + Math.sin(a * 1.3) * 13, 4, 0, Math.PI * 2);
          ctx.fill();
        }
        pasta(ctx, cx, cy - 12, 54);
        if (!s.ready) drawPips(ctx, cx, spot.y + spot.h - 18, 1, s.progress / s.need, '#ffd98a');
        if (!s.ready) steam(ctx, cx, cy - 34, t, 0.8);
      }
      // handle
      ctx.strokeStyle = '#8b939a';
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.arc(cx + 86, cy - 4, 16, -1.2, 1.2);
      ctx.stroke();
    }

    // ready glow
    if (s.ready) {
      const pulse = 0.5 + 0.5 * Math.sin(t * 6);
      ctx.strokeStyle = `rgba(127,208,168,${0.35 + pulse * 0.35})`;
      ctx.lineWidth = 4;
      rr(ctx, spot.x + 3, spot.y + 3, spot.w - 6, spot.h - 6, 16);
      ctx.stroke();
      badge(ctx, spot.x + spot.w / 2, spot.y + spot.h - 10, 'READY - CLICK', MINT);
    }
    ctx.restore();
  }
}

function drawChopKnife(ctx, x, y, t, prog) {
  const swing = Math.sin(t * 3.2) * 0.22;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-0.9 + swing);
  ctx.fillStyle = '#d7dde2';
  rr(ctx, -8, -34, 16, 62, 4);
  ctx.fill();
  ctx.fillStyle = '#8a9299';
  rr(ctx, -6, 26, 12, 26, 4);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.5)';
  rr(ctx, -6, -30, 4, 50, 2);
  ctx.fill();
  ctx.restore();
}

function drawPips(ctx, cx, y, count, value, color) {
  for (let i = 0; i < count; i++) {
    const w = count === 1 ? 112 : 26;
    const x = count === 1 ? cx - 56 + i * 112 : cx - (count * 30) / 2 + i * 30;
    rr(ctx, x, y - 4, w, 8, 4);
    ctx.fillStyle = 'rgba(0,0,0,.35)';
    ctx.fill();
    const fill = count === 1 ? Math.max(0, Math.min(1, value)) : (i < value ? 1 : 0);
    if (fill > 0) {
      rr(ctx, x, y - 4, w * fill, 8, 4);
      ctx.fillStyle = color;
      ctx.fill();
    }
  }
}

function badge(ctx, x, y, text, color) {
  ctx.font = `800 9px ${FONT}`;
  const w = ctx.measureText(text).width + 16;
  ctx.fillStyle = 'rgba(16,20,18,.86)';
  rr(ctx, x - w / 2, y - 9, w, 18, 9);
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.stroke();
  label(ctx, text, x, y + 0.5, 9, color, 800, 'center', 0.8);
}

export function steam(ctx, x, y, t, strength = 1) {
  ctx.save();
  for (let i = 0; i < 3; i++) {
    const p = ((t * 0.35 + i * 0.33) % 1);
    const yy = y - p * 48;
    const a = Math.sin(p * Math.PI) * 0.22 * strength;
    ctx.fillStyle = `rgba(255,250,240,${a})`;
    ctx.beginPath();
    ctx.ellipse(x + Math.sin(t * 1.4 + i * 2) * 10, yy, 10 + p * 12, 6 + p * 7, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawCrates(ctx, st, t) {
  for (const c of CRATES) {
    const ing = INGREDIENTS[c.id];
    const hovered = st.hoverCrate === c.id;
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,.26)';
    rr(ctx, c.x + 3, c.y + 6, c.w, c.h, 12);
    ctx.fill();
    ctx.fillStyle = hovered ? '#7a5236' : '#64432c';
    rr(ctx, c.x, c.y, c.w, c.h, 12);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,220,170,.14)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    // little crate slats
    ctx.strokeStyle = 'rgba(0,0,0,.18)';
    for (let i = 1; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(c.x + 10, c.y + (c.h / 3) * i);
      ctx.lineTo(c.x + c.w - 10, c.y + (c.h / 3) * i);
      ctx.stroke();
    }
    drawIngredient(ctx, c.id, c.x + c.w / 2, c.y + 38, 44, false);
    label(ctx, ing.name, c.x + c.w / 2, c.y + c.h - 20, 10, 'rgba(247,234,210,.72)', 600, 'center');
    ctx.fillStyle = 'rgba(0,0,0,.4)';
    rr(ctx, c.x + c.w - 24, c.y + 6, 18, 18, 5);
    ctx.fill();
    label(ctx, c.hint, c.x + c.w - 15, c.y + 15.5, 10, BRASS, 800, 'center');
    ctx.restore();
  }
}

function drawHand(ctx, st, t) {
  const { x, y, w, h } = HAND;
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,.25)';
  rr(ctx, x + 3, y + 6, w, h, 14);
  ctx.fill();
  ctx.fillStyle = 'rgba(24,29,33,.72)';
  rr(ctx, x, y, w, h, 14);
  ctx.fill();
  ctx.strokeStyle = st.hand ? 'rgba(226,180,103,.5)' : 'rgba(255,255,255,.08)';
  ctx.setLineDash(st.hand ? [] : [6, 6]);
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.setLineDash([]);
  label(ctx, 'IN HAND', x + 14, y + 18, 9, 'rgba(247,234,210,.5)', 700, 'left', 1.3);
  if (st.hand) {
    const ing = INGREDIENTS[st.hand.id];
    drawIngredient(ctx, st.hand.id, x + 44, y + 74, 56, st.hand.processed);
    label(ctx, st.hand.processed ? ing.sliced : ing.name, x + 82, y + 60, 14, CREAM, 700);
    label(ctx, st.hand.processed ? 'ready to plate' : ing.process ? `${PROCESS_LABEL[ing.process]} next` : 'ready to plate', x + 82, y + 80, 10, st.hand.processed ? MINT : BRASS, 600);
    label(ctx, 'X  bin', x + 82, y + 102, 9, 'rgba(247,234,210,.45)', 600, 'left', 0.8);
  } else {
    label(ctx, 'empty', x + 78, y + 62, 14, 'rgba(247,234,210,.35)', 600);
    label(ctx, 'click a crate', x + 78, y + 82, 10, 'rgba(247,234,210,.3)', 500);
    label(ctx, 'or press 1-7', x + 78, y + 98, 10, 'rgba(247,234,210,.3)', 500);
  }
  ctx.restore();
}

function drawPlate(ctx, st, t) {
  const { cx, cy, rx, ry } = PLATE;
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,.35)';
  ctx.beginPath();
  ctx.ellipse(cx + 4, cy + 10, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
  const plate = ctx.createRadialGradient(cx - 40, cy - 24, 20, cx, cy, rx);
  plate.addColorStop(0, '#fbf7ee');
  plate.addColorStop(0.7, '#e7e0d2');
  plate.addColorStop(1, '#c7bfae');
  ctx.fillStyle = plate;
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(120,140,150,.5)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx - 6, ry - 5, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,.75)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(cx, cy - 3, rx * 0.45, ry * 0.42, 0, Math.PI * 1.05, Math.PI * 1.75);
  ctx.stroke();

  label(ctx, 'PLATE', cx - rx + 22, cy + ry - 20, 9, 'rgba(40,45,50,.35)', 800, 'left', 1.3);
  label(ctx, 'click to load  ·  right-click to scrap', cx + rx - 22, cy + ry - 20, 9, 'rgba(40,45,50,.35)', 600, 'right');

  if (st.plate.dish) {
    const dish = dishById(st.plate.dish);
    const pulse = 0.5 + 0.5 * Math.sin(t * 4);
    ctx.save();
    ctx.shadowColor = `rgba(127,208,168,${0.4 + pulse * 0.3})`;
    ctx.shadowBlur = 26;
    ctx.fillStyle = '#fdfaf3';
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx * 0.8, ry * 0.8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    drawDish(ctx, st.plate.dish, cx - 34, cy - 30, 118);
    // garnish beside the dish
    herb(ctx, cx + 84, cy - 12, 34);
    tomato(ctx, cx + 104, cy + 16, 30);
    steam(ctx, cx - 34, cy - 78, t, 1.25);
    label(ctx, dish.name.toUpperCase(), cx + 12, cy + ry - 40, 12, '#2b3a32', 800, 'center', 1.4);
    badge(ctx, cx + rx - 48, cy - ry + 26, 'READY', MINT);
  } else {
    const n = st.plate.items.length;
    if (n === 0) {
      ctx.setLineDash([7, 7]);
      ctx.strokeStyle = 'rgba(70,80,86,.3)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx * 0.56, ry * 0.56, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      label(ctx, 'empty plate', cx, cy + 4, 13, 'rgba(60,68,74,.45)', 600, 'center');
    } else {
      st.plate.items.forEach((it, i) => {
        const ang = i * 1.15 - 0.4;
        const px = cx + Math.cos(ang) * (18 + i * 6);
        const py = cy - 12 + Math.sin(ang) * 12 - i * 3;
        drawIngredient(ctx, it.id, px, py, 62, it.processed);
      });
      label(ctx, `${n}/5 on plate`, cx + rx - 22, cy - ry + 26, 10, 'rgba(60,68,74,.6)', 700, 'right');
    }
  }
  ctx.restore();
}

function drawPass(ctx, st, t) {
  const { x, y, w, h } = SERVE;
  ctx.save();
  const ready = !!st.plate.dish;
  ctx.fillStyle = 'rgba(0,0,0,.3)';
  rr(ctx, x + 4, y + 8, w, h, 16);
  ctx.fill();
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, ready ? '#2d453a' : '#242c31');
  g.addColorStop(1, ready ? '#1f322b' : '#1a2024');
  ctx.fillStyle = g;
  rr(ctx, x, y, w, h, 16);
  ctx.fill();
  ctx.strokeStyle = ready ? `rgba(127,208,168,${0.5 + 0.4 * Math.sin(t * 5)})` : 'rgba(255,255,255,.09)';
  ctx.lineWidth = ready ? 3 : 1.5;
  ctx.stroke();

  label(ctx, 'THE PASS', x + 20, y + 24, 13, CREAM, 800, 'left', 2);
  label(ctx, ready ? 'SEND IT' : 'waiting for a plate', x + 20, y + 46, 10, ready ? MINT : 'rgba(247,234,210,.4)', 600);

  // bell
  const bx = x + w - 52;
  const by = y + 38;
  ctx.fillStyle = ready ? BRASS : '#59636a';
  ctx.beginPath();
  ctx.arc(bx, by, 20, Math.PI, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(bx - 24, by - 1, 48, 5);
  ctx.fillStyle = ready ? '#f0cf8d' : '#7c858b';
  ctx.beginPath();
  ctx.arc(bx, by - 22, 4, 0, Math.PI * 2);
  ctx.fill();
  if (ready) {
    ctx.strokeStyle = `rgba(226,180,103,${0.3 + 0.5 * Math.sin(t * 6)})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(bx, by, 27 + Math.sin(t * 3) * 3, Math.PI * 1.05, Math.PI * 1.95);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(bx, by, 34 + Math.sin(t * 3) * 3, Math.PI * 1.1, Math.PI * 1.9);
    ctx.stroke();
  }

  // tray with served dish preview
  ctx.fillStyle = 'rgba(0,0,0,.28)';
  rr(ctx, x + 20, y + 74, w - 40, h - 92, 12);
  ctx.fill();
  if (st.lastServedDish) {
    drawDish(ctx, st.lastServedDish, x + 62, y + h - 62, 62);
    label(ctx, `last: ${dishById(st.lastServedDish).short}`, x + 108, y + 96, 10, 'rgba(247,234,210,.5)', 600);
  } else {
    label(ctx, 'nothing sent yet', x + 40, y + 102, 10, 'rgba(247,234,210,.3)', 600);
  }
  if (ready) {
    const dish = dishById(st.plate.dish);
    label(ctx, dish.short, x + 150, y + h - 90, 14, CREAM, 700);
    label(ctx, `$${dish.price}`, x + 150, y + h - 70, 12, BRASS, 700);
    rr(ctx, x + 150, y + h - 52, 150, 30, 8);
    ctx.fillStyle = 'rgba(127,208,168,.92)';
    ctx.fill();
    label(ctx, 'SPACE  serve', x + 225, y + h - 36, 11, '#10251d', 800, 'center');
  } else {
    label(ctx, 'build a dish on the plate', x + w / 2, y + h - 56, 11, 'rgba(247,234,210,.35)', 500, 'center');
    label(ctx, 'then click here', x + w / 2, y + h - 40, 11, 'rgba(247,234,210,.35)', 500, 'center');
  }
  ctx.restore();
}

function patienceColor(frac) {
  if (frac > 0.55) return '#6fbf8f';
  if (frac > 0.3) return '#e0b062';
  return '#e15a44';
}

function drawTicket(ctx, order, x, y, w, h, t, rank) {
  const dish = dishById(order.dishId);
  const frac = Math.max(0, order.patience / order.patienceMax);
  const col = patienceColor(frac);
  const urgent = frac < 0.3;
  ctx.save();
  const lift = (1 - order.fresh) * 10;
  ctx.translate(0, lift);

  ctx.fillStyle = 'rgba(0,0,0,.3)';
  rr(ctx, x + 2, y + 4, w, h, 10);
  ctx.fill();
  ctx.fillStyle = urgent ? '#fbe6d6' : '#f8efdc';
  rr(ctx, x, y, w, h, 10);
  ctx.fill();
  // torn top strip
  ctx.fillStyle = col;
  rr(ctx, x, y, 6, h, 10);
  ctx.fill();
  if (rank === 0) {
    ctx.strokeStyle = 'rgba(226,180,103,.85)';
    ctx.lineWidth = 2;
    rr(ctx, x + 1, y + 1, w - 2, h - 2, 10);
    ctx.stroke();
  }

  // dish icon in a little well
  ctx.fillStyle = 'rgba(60,50,40,.08)';
  ctx.beginPath();
  ctx.arc(x + 38, y + h / 2, 21, 0, Math.PI * 2);
  ctx.fill();
  drawDish(ctx, dish.id, x + 38, y + h / 2 + 1, 30);

  label(ctx, dish.name, x + 66, y + 17, 12, '#2b241c', 800);
  label(ctx, dish.parts.map((p) => INGREDIENTS[p].key).join('·'), x + 66, y + 31, 9, 'rgba(60,50,40,.5)', 600, 'left', 1.2);

  const barW = w - 128;
  rr(ctx, x + 66, y + 40, barW, 7, 4);
  ctx.fillStyle = 'rgba(60,50,40,.14)';
  ctx.fill();
  rr(ctx, x + 66, y + 40, Math.max(2, barW * frac), 7, 4);
  ctx.fillStyle = col;
  ctx.fill();

  label(ctx, `${Math.ceil(order.patience)}s`, x + 66 + barW, y + 31, 9, col, 800, 'right');
  label(ctx, `$${order.reward}`, x + w - 12, y + 17, 12, '#7a5a28', 800, 'right');
  ctx.restore();
}

function drawBoard(ctx, st, t) {
  const { x, y, w, h } = BOARD;
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,.35)';
  rr(ctx, x + 5, y + 8, w, h, 16);
  ctx.fill();
  ctx.fillStyle = '#2b2118';
  rr(ctx, x, y, w, h, 16);
  ctx.fill();
  // cork inner
  ctx.fillStyle = '#3a2c20';
  rr(ctx, x + 10, y + 10, w - 20, h - 20, 12);
  ctx.fill();
  ctx.strokeStyle = 'rgba(226,180,103,.5)';
  ctx.lineWidth = 2;
  rr(ctx, x + 10, y + 10, w - 20, h - 20, 12);
  ctx.stroke();

  label(ctx, 'ORDER BOARD', x + 26, y + 34, 14, CREAM, 800, 'left', 2.4);
  ctx.fillStyle = st.rushLevel >= 2 ? '#e0573f' : BRASS;
  rr(ctx, x + w - 122, y + 22, 96, 24, 12);
  ctx.fill();
  label(ctx, st.rushLevel >= 2 ? 'RUSH HOUR' : 'SERVICE', x + w - 74, y + 34, 9, '#231a10', 800, 'center', 1.1);

  const innerX = x + 20;
  const innerY = y + 52;
  const slotH = 60;
  const gap = 6;
  if (st.orders.length === 0) {
    label(ctx, 'no tickets right now', x + w / 2, y + h / 2 + 6, 12, 'rgba(247,234,210,.35)', 600, 'center');
  }
  const sorted = st.orders.slice().sort((a, b) => a.patience - b.patience);
  sorted.forEach((order, i) => {
    const ty = innerY + i * (slotH + gap);
    if (ty + slotH > y + h - 8) return;
    drawTicket(ctx, order, innerX, ty, w - 40, slotH, t, i);
  });

  // legend at the bottom of the board
  label(ctx, 'ORDER  ·  INGREDIENT KEYS  ·  CLICK A TICKET DISH ON THE PLATE', x + w / 2, y + h - 14, 8, 'rgba(247,234,210,.3)', 600, 'center', 0.9);
  ctx.restore();
}

// ---- overlays ------------------------------------------------------------

function drawToast(ctx, st) {
  if (!st.toast.text || st.toast.age > 2.4) return;
  const a = Math.min(1, (2.4 - st.toast.age) / 0.35);
  ctx.save();
  ctx.globalAlpha = a;
  ctx.font = `700 13px ${FONT}`;
  const tw = ctx.measureText(st.toast.text).width + 34;
  const x = 30;
  const y = 508;
  ctx.fillStyle = st.toast.tone === 'bad' ? 'rgba(120,38,28,.95)' : st.toast.tone === 'warn' ? 'rgba(105,74,20,.95)' : 'rgba(30,74,56,.95)';
  rr(ctx, x, y, tw, 30, 8);
  ctx.fill();
  label(ctx, st.toast.text, x + 16, y + 16, 13, CREAM, 700);
  ctx.restore();
}

function drawBanner(ctx, st) {
  if (!st.banner.text || st.banner.age > 2.6) return;
  const a = st.banner.age < 0.25 ? st.banner.age / 0.25 : Math.min(1, (2.6 - st.banner.age) / 0.5);
  ctx.save();
  ctx.globalAlpha = Math.max(0, a);
  ctx.textAlign = 'center';
  const big = st.banner.text;
  ctx.font = `900 62px ${FONT}`;
  const tw = ctx.measureText(big).width;
  ctx.fillStyle = 'rgba(12,16,18,.55)';
  rr(ctx, W / 2 - tw / 2 - 34, 250, tw + 68, 92, 18);
  ctx.fill();
  label(ctx, big, W / 2, 290, 58, CREAM, 900, 'center', 3);
  if (st.banner.sub) label(ctx, st.banner.sub, W / 2, 326, 13, BRASS, 600, 'center', 1.2);
  ctx.restore();
}

export function drawTitle(ctx, st, t) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, 'rgba(12,15,18,.72)');
  g.addColorStop(1, 'rgba(12,15,18,.9)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  label(ctx, 'SIZZLE SHIFT', W / 2, 176, 88, CREAM, 900, 'center', 4);
  label(ctx, 'a four-table diner, one hot plate, and one very short evening', W / 2, 236, 15, BRASS, 600, 'center', 1);

  const cardX = 236;
  const cardY = 292;
  for (let i = 0; i < 3; i++) {
    const x = cardX + i * 276;
    ctx.fillStyle = 'rgba(247,234,210,.07)';
    rr(ctx, x, cardY, 248, 150, 14);
    ctx.fill();
    ctx.strokeStyle = 'rgba(247,234,210,.14)';
    ctx.stroke();
    const heads = ['1. GRAB', '2. COOK', '3. PLATE'];
    const body = ['Click a crate or press 1-7.', 'Q chop, W griddle, E boiler.', 'Click the plate, then the pass.'];
    if (i === 0) drawIngredient(ctx, 'tomato', x + 34, cardY + 96, 60, true);
    if (i === 1) drawIngredient(ctx, 'patty', x + 34, cardY + 96, 72, true);
    if (i === 2) drawDish(ctx, 'sunset', x + 34, cardY + 96, 58);
    label(ctx, heads[i], x + 74, cardY + 34, 16, CREAM, 800, 'left', 1.6);
    label(ctx, body[i], x + 74, cardY + 64, 11, 'rgba(247,234,210,.62)', 600);
    label(ctx, ['Press 1-7, or click', 'click the machine to load', 'SPACE sends the plate'][i], x + 74, cardY + 86, 10, 'rgba(247,234,210,.4)', 500);
  }

  const dishes = DISHES.map((d) => d.short).join('  ·  ');
  label(ctx, `MENU  ${dishes}`, W / 2, 474, 11, 'rgba(247,234,210,.55)', 700, 'center', 1.4);

  const pulse = 0.5 + 0.5 * Math.sin(t * 3);
  ctx.fillStyle = `rgba(226,180,103,${0.85 + pulse * 0.15})`;
  rr(ctx, START_BTN.x, START_BTN.y, START_BTN.w, START_BTN.h, 14);
  ctx.fill();
  label(ctx, 'START THE SHIFT', W / 2, START_BTN.y + 30, 20, '#241a0e', 900, 'center', 2.4);
  label(ctx, 'or press SPACE', W / 2, START_BTN.y + 53, 11, 'rgba(36,26,14,.7)', 700, 'center');
  label(ctx, '4 minutes  ·  tickets burn  ·  combo pays', W / 2, 668, 11, 'rgba(247,234,210,.4)', 500, 'center');
}

export function drawOver(ctx, st, t) {
  ctx.fillStyle = 'rgba(10,13,15,.78)';
  ctx.fillRect(0, 0, W, H);
  const s = st.endSummary || { score: 0, coins: 0, served: 0, expired: 0, bestCombo: 0 };
  label(ctx, st.endTitle || 'SHIFT OVER', W / 2, 142, 58, CREAM, 900, 'center', 3);
  label(ctx, 'the pass is closed', W / 2, 190, 13, BRASS, 600, 'center', 1.2);

  const cards = [
    ['SERVED', String(s.served)],
    ['TICKETS LOST', String(s.expired)],
    ['BEST COMBO', `x${(1 + Math.min(10, s.bestCombo) * 0.1).toFixed(1)}`],
    ['TAKINGS', `$${s.score}`],
  ];
  const cw = 208;
  const gap = 20;
  const total = cards.length * cw + (cards.length - 1) * gap;
  cards.forEach(([k, v], i) => {
    const x = (W - total) / 2 + i * (cw + gap);
    ctx.fillStyle = 'rgba(247,234,210,.07)';
    rr(ctx, x, 236, cw, 100, 12);
    ctx.fill();
    label(ctx, k, x + cw / 2, 264, 9, 'rgba(247,234,210,.5)', 700, 'center', 1.4);
    label(ctx, v, x + cw / 2, 300, 30, CREAM, 800, 'center');
  });

  label(ctx, 'R  another shift', W / 2, 392, 14, BRASS, 700, 'center', 1.2);
  label(ctx, 'same kitchen, faster hands', W / 2, 414, 10, 'rgba(247,234,210,.4)', 500, 'center');
}

// ---- frame ---------------------------------------------------------------

export function render(ctx, st, t) {
  ctx.clearRect(0, 0, W, H);
  drawRoom(ctx, st, t);
  drawStations(ctx, st, t);
  drawCrates(ctx, st, t);
  drawPlate(ctx, st, t);
  drawHand(ctx, st, t);
  drawPass(ctx, st, t);
  drawBoard(ctx, st, t);
  drawToast(ctx, st);
  drawHeader(ctx, st);
  drawBanner(ctx, st);

  if (st.serveGlow > 0) {
    ctx.save();
    ctx.globalAlpha = Math.min(1, st.serveGlow);
    ctx.strokeStyle = MINT;
    ctx.lineWidth = 6;
    rr(ctx, SERVE.x - 4, SERVE.y - 4, SERVE.w + 8, SERVE.h + 8, 18);
    ctx.stroke();
    ctx.restore();
  }

  if (st.shake > 0) {
    // applied by main through a canvas translate; nothing needed here
  }

  if (st.phase === 'title') drawTitle(ctx, st, t);
  else if (st.phase === 'over') drawOver(ctx, st, t);

  if (st.paused) {
    ctx.fillStyle = 'rgba(8,10,12,.6)';
    ctx.fillRect(0, 0, W, H);
    label(ctx, 'PAUSED', W / 2, H / 2 - 8, 44, CREAM, 900, 'center', 3);
    label(ctx, 'P to resume', W / 2, H / 2 + 34, 12, BRASS, 600, 'center', 1.2);
  }
}

export function flashServe(dishId) {
  glowDish = dishId;
  glowUntil = 1;
}

export function frameFlash(st) {
  return st.flash || 0;
}
