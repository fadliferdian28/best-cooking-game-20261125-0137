// Boot and the frame loop: build the kitchen, attach input and sound, step the
// clock, draw. A ?scene= query stages a deterministic moment for screenshots.
import { Kitchen } from './kitchen.js';
import { KitchenAudio } from './audio.js';
import { attachInput } from './input.js';
import { render } from './render.js';
import { W, H } from './layout.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d', { alpha: false });

const audio = new KitchenAudio();
const kitchen = new Kitchen({ audio });

const params = new URLSearchParams(location.search);
const scene = params.get('scene');
const frozen = params.has('frozen');

let paused = false;
let shakeTime = 0;
let last = performance.now();
let clock = 0;

function startShift() {
  audio.ensure();
  kitchen.start();
  paused = false;
}

function restartShift() {
  audio.ensure();
  kitchen.start();
  paused = false;
}

const hooks = {
  start: startShift,
  restart: restartShift,
  togglePause: () => {
    if (kitchen.phase !== 'play') return;
    paused = !paused;
    kitchen.say(paused ? 'Paused' : 'Back on the line', 'warn');
  },
  toggleSound: () => {
    audio.ensure();
    audio.setMuted(!audio.muted);
    kitchen.say(audio.muted ? 'Sound off' : 'Sound on', 'warn');
  },
};

const pointer = attachInput(canvas, kitchen, hooks);
kitchen.on(() => {});

if (scene) {
  kitchen.stage(scene);
  paused = frozen || scene === 'cover';
  if (scene === 'title') kitchen.phase = 'title';
  if (scene === 'rush') kitchen.banner.age = 1.1;
  if (scene === 'cover' || scene === 'serve') kitchen.banner.age = 99;
}

// Debug handle for the screenshot harness and for poking at the game.
window.__kitchen = kitchen;
window.__game = {
  start: startShift,
  stage: (name) => kitchen.stage(name),
  step: (seconds) => {
    const dt = 1 / 60;
    for (let i = 0; i < Math.round(seconds * 60); i++) kitchen.update(dt);
  },
  renderOnce: () => paint(0),
  state: () => kitchen,
};

function paint(t) {
  const st = kitchen;
  st.hoverStation = pointer.hover.station;
  st.hoverCrate = pointer.hover.crate;
  st.hoverPlate = pointer.hover.plate;
  st.hoverServe = pointer.hover.serve;
  if (st.shake > 0) {
    const mag = st.shake * 9;
    ctx.save();
    ctx.translate((Math.random() - 0.5) * mag, (Math.random() - 0.5) * mag);
    render(ctx, st, t);
    ctx.restore();
  } else {
    render(ctx, st, t);
  }
}

function frame(now) {
  const dtRaw = (now - last) / 1000;
  last = now;
  const dt = Math.min(0.05, Math.max(0, dtRaw));
  if (!frozen) {
    clock += dt;
    if (!paused) kitchen.update(dt);
  } else {
    clock = 2.4;
  }
  paint(clock);
  requestAnimationFrame(frame);
}

if (scene) {
  // A couple of still frames settle any time-based art before a screenshot.
  paint(2.4);
  requestAnimationFrame(() => paint(2.4));
} else {
  requestAnimationFrame(frame);
}

window.addEventListener('blur', () => {
  if (kitchen.phase === 'play' && !frozen) paused = true;
});
