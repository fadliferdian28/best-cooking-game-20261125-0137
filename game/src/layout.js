// Where everything sits on the 1280x720 board. Rendering and hit-testing both
// read these rectangles so the picture and the clicks never drift apart.
export const W = 1280;
export const H = 720;
export const HEADER = 64;

export const BOARD = { x: 868, y: 76, w: 400, h: 394 };
export const SERVE = { x: 884, y: 494, w: 368, h: 198 };
export const PLATE = { cx: 430, cy: 618, rx: 198, ry: 84 };
export const HAND = { x: 24, y: 566, w: 192, h: 128 };

export const STATIONS = [
  { key: 'chop', name: 'Chop Block', hint: 'Q', x: 32, y: 150, w: 232, h: 182 },
  { key: 'grill', name: 'Griddle', hint: 'W', x: 292, y: 150, w: 232, h: 182 },
  { key: 'boil', name: 'Boiler', hint: 'E', x: 552, y: 150, w: 232, h: 182 },
];

export const CRATES = [
  { id: 'tomato', hint: '1', x: 34, y: 396, w: 104, h: 100 },
  { id: 'onion', hint: '2', x: 148, y: 396, w: 104, h: 100 },
  { id: 'herb', hint: '3', x: 262, y: 396, w: 104, h: 100 },
  { id: 'bun', hint: '4', x: 376, y: 396, w: 104, h: 100 },
  { id: 'patty', hint: '5', x: 490, y: 396, w: 104, h: 100 },
  { id: 'cheese', hint: '6', x: 604, y: 396, w: 104, h: 100 },
  { id: 'pasta', hint: '7', x: 718, y: 396, w: 104, h: 100 },
];

export const START_BTN = { x: 440, y: 560, w: 400, h: 74 };

function inRect(p, r) {
  return p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
}

export function stationAt(p) {
  for (const s of STATIONS) if (inRect(p, s)) return s.key;
  return null;
}

export function crateAt(p) {
  for (const c of CRATES) if (inRect(p, c)) return c.id;
  return null;
}

export function onPlate(p) {
  const dx = (p.x - PLATE.cx) / (PLATE.rx + 16);
  const dy = (p.y - PLATE.cy) / (PLATE.ry + 20);
  return dx * dx + dy * dy <= 1;
}

export function onServe(p) {
  return inRect(p, SERVE);
}

export function onStart(p) {
  return inRect(p, START_BTN);
}
