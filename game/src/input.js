// Turns raw browser events into kitchen actions. It owns the pointer mapping
// (canvas pixels, not CSS pixels) and the keyboard shortcuts, nothing else.
import { W, H, stationAt, crateAt, onPlate, onServe, onStart } from './layout.js';

const ING_KEYS = { Digit1: 'tomato', Digit2: 'onion', Digit3: 'herb', Digit4: 'bun', Digit5: 'patty', Digit6: 'cheese', Digit7: 'pasta' };

export function attachInput(canvas, kitchen, hooks) {
  const state = { hover: { station: null, crate: null, plate: false, serve: false, start: false } };
  let scaleX = W;
  let scaleY = H;

  function measure() {
    const r = canvas.getBoundingClientRect();
    scaleX = r.width || W;
    scaleY = r.height || H;
  }
  measure();
  window.addEventListener('resize', measure);

  function point(ev) {
    const r = canvas.getBoundingClientRect();
    return {
      x: ((ev.clientX - r.left) / (r.width || W)) * W,
      y: ((ev.clientY - r.top) / (r.height || H)) * H,
    };
  }

  function refreshHover(p) {
    state.hover.station = stationAt(p);
    state.hover.crate = crateAt(p);
    state.hover.plate = onPlate(p);
    state.hover.serve = onServe(p);
    state.hover.start = onStart(p);
    canvas.style.cursor = (state.hover.station || state.hover.crate || state.hover.start || (state.hover.plate && kitchen.plate.items.length) || (state.hover.serve && kitchen.plate.dish)) ? 'pointer' : 'default';
  }

  canvas.addEventListener('pointermove', (ev) => refreshHover(point(ev)));
  canvas.addEventListener('pointerleave', () => {
    state.hover = { station: null, crate: null, plate: false, serve: false, start: false };
    canvas.style.cursor = 'default';
  });

  function act(p, button) {
    refreshHover(p);
    if (button === 2) {
      if (onPlate(p)) kitchen.scrapPlate();
      return;
    }
    if (kitchen.phase === 'title') {
      if (onStart(p)) hooks.start();
      return;
    }
    if (kitchen.phase === 'over') {
      hooks.restart();
      return;
    }
    if (kitchen.paused) {
      hooks.togglePause();
      return;
    }
    const st = state.hover.station;
    if (st) return void kitchen.station(st);
    const c = state.hover.crate;
    if (c) return void kitchen.takeCrate(c);
    if (state.hover.plate) return void kitchen.plateClick();
    if (state.hover.serve) return void kitchen.serveClick();
  }

  canvas.addEventListener('pointerdown', (ev) => {
    ev.preventDefault();
    act(point(ev), ev.button);
  });
  canvas.addEventListener('contextmenu', (ev) => ev.preventDefault());

  window.addEventListener('keydown', (ev) => {
    if (ev.metaKey || ev.ctrlKey || ev.altKey) return;
    const k = ev.code;
    if (k === 'KeyM') { hooks.toggleSound(); return; }
    if (k === 'KeyP' || k === 'Escape') { hooks.togglePause(); return; }
    if (k === 'KeyR') { if (kitchen.phase === 'over') hooks.restart(); return; }

    if (kitchen.phase === 'title') {
      if (k === 'Space' || k === 'Enter') { ev.preventDefault(); hooks.start(); }
      return;
    }
    if (kitchen.phase !== 'play' || kitchen.paused) return;

    if (k === 'KeyQ') { ev.preventDefault(); kitchen.station('chop'); return; }
    if (k === 'KeyW') { ev.preventDefault(); kitchen.station('grill'); return; }
    if (k === 'KeyE') { ev.preventDefault(); kitchen.station('boil'); return; }
    if (ING_KEYS[k]) { ev.preventDefault(); kitchen.takeCrate(ING_KEYS[k]); return; }
    if (k === 'Space') { ev.preventDefault(); kitchen.serveClick(); return; }
    if (k === 'KeyX' || k === 'Delete' || k === 'Backspace') { ev.preventDefault(); kitchen.discardHand(); return; }
  });

  return state;
}
