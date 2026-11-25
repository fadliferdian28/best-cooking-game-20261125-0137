// The kitchen itself: hands, stations, the plate, tickets and the shift clock.
// No drawing happens here, and no DOM either, so it can be driven headlessly.
import { DISHES, DISH_BY_ID, INGREDIENTS, dishById } from './recipes.js';

export const SHIFT_SECONDS = 240;
const CHOP_TAPS = 3;
const COOK_SECONDS = { grill: 2.4, boil: 2.8 };
const MAX_HEARTS = 3;
const SLOTS = 6;

let nextOrderId = 1;

function shuffled(list, rng) {
  const copy = list.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function emptyPlate() {
  return { items: [], dish: null };
}

export class Kitchen {
  constructor({ rng = Math.random, audio = null } = {}) {
    this.rng = rng;
    this.audio = audio;
    this.phase = 'title';
    this.listeners = [];
    this.reset();
  }

  reset() {
    this.time = 0;
    this.score = 0;
    this.coins = 0;
    this.combo = 0;
    this.bestCombo = 0;
    this.served = 0;
    this.expired = 0;
    this.hearts = MAX_HEARTS;
    this.hand = null;
    this.plate = emptyPlate();
    this.orders = [];
    this.ticketSeq = 0;
    this.spawnClock = 0;
    this.spawnEvery = 9;
    this.rushLevel = 0;
    this.banner = { text: '', sub: '', age: 99 };
    this.toast = { text: '', age: 99, tone: 'good' };
    this.shake = 0;
    this.flash = 0;
    this.sizzleOn = false;
    this.boilOn = false;
    this.lastServedDish = null;
    this.bestServe = null;
    this.stations = {
      chop: { key: 'chop', item: null, progress: 0, need: CHOP_TAPS, ready: false },
      grill: { key: 'grill', item: null, progress: 0, need: COOK_SECONDS.grill, ready: false },
      boil: { key: 'boil', item: null, progress: 0, need: COOK_SECONDS.boil, ready: false },
    };
  }

  on(fn) {
    this.listeners.push(fn);
  }

  emit(event, extra = {}) {
    this.audio?.handle(event, this);
    for (const fn of this.listeners) fn(event, extra);
  }

  start() {
    this.reset();
    this.phase = 'play';
    this.spawnEvery = 8;
    this.announce('SHIFT START', 'Tickets are up. Build the plate.');
    this.spawnOrder();
    this.emit('start');
  }

  announce(text, sub = '') {
    this.banner = { text, sub, age: 0 };
  }

  say(text, tone = 'good') {
    this.toast = { text, age: 0, tone };
  }

  get comboMult() {
    return 1 + Math.min(this.combo, 10) * 0.1;
  }

  get shiftLeft() {
    return Math.max(0, SHIFT_SECONDS - this.time);
  }

  get maxOrders() {
    if (this.rushLevel >= 3) return 5;
    if (this.rushLevel >= 1) return 4;
    return 3;
  }

  // ---- tickets -----------------------------------------------------------

  spawnOrder(forceDish = null) {
    if (this.phase !== 'play') return null;
    if (!forceDish && this.orders.length >= this.maxOrders) return null;
    const open = this.orders.map((o) => o.dishId);
    const pool = DISHES.filter((d) => {
      if (open.filter((id) => id === d.id).length >= 2) return false;
      if (this.rushLevel === 0 && d.tier > 0) return false;
      return true;
    });
    const dish = forceDish ? dishById(forceDish) : pool[Math.floor(this.rng() * pool.length)] || DISHES[0];
    const patience = Math.max(13, 27 - this.rushLevel * 3.2 + (dish.tier === 0 ? 3 : 0) - this.served * 0.18);
    const slot = forceDish ? 0 : this.freeSlot();
    const order = {
      id: nextOrderId++,
      seq: ++this.ticketSeq,
      dishId: dish.id,
      patience,
      patienceMax: patience,
      reward: dish.price + Math.round(patience * 1.5),
      slot,
      fresh: 0,
    };
    if (forceDish) {
      this.orders = [order, ...this.orders.filter((o) => o.slot !== 0)].slice(0, SLOTS);
    } else {
      this.orders.push(order);
    }
    this.emit('order', { dishId: dish.id });
    return order;
  }

  freeSlot() {
    const used = new Set(this.orders.map((o) => o.slot));
    for (let i = 0; i < SLOTS; i++) if (!used.has(i)) return i;
    return this.orders.length % SLOTS;
  }

  // ---- hands and stations ------------------------------------------------

  takeCrate(ingredientId) {
    if (this.phase !== 'play') return this.reject();
    const ing = INGREDIENTS[ingredientId];
    if (!ing) return this.reject();
    if (this.hand) {
      this.say('Hands full - plate it or bin it (X)', 'warn');
      return this.emit('nope');
    }
    this.hand = { id: ingredientId, processed: false };
    this.emit('pick');
    return true;
  }

  station(key) {
    if (this.phase !== 'play') return this.reject();
    const st = this.stations[key];
    if (!st) return this.reject();
    const ing = st.item ? INGREDIENTS[st.item] : null;

    if (st.item && st.ready) {
      if (this.hand) {
        this.say('Hands full', 'warn');
        return this.emit('nope');
      }
      this.hand = { id: st.item, processed: true };
      st.item = null;
      st.progress = 0;
      st.ready = false;
      this.updateLoops();
      this.emit('collect');
      return true;
    }

    if (st.item && !st.ready) {
      if (key === 'chop') {
        st.progress += 1;
        this.emit('chop');
        this.spawnCrumbs?.(ing);
        if (st.progress >= st.need) this.finishStation(st);
        return true;
      }
      this.say('Still cooking', 'warn');
      return this.emit('nope');
    }

    if (!this.hand) {
      this.say('Grab an ingredient first', 'warn');
      return this.emit('nope');
    }
    if (!ing) {
      // station empty: check the held ingredient
      const held = INGREDIENTS[this.hand.id];
      if (held.process !== key) {
        this.say(`${held.name} does not belong on the ${key === 'chop' ? 'block' : key === 'grill' ? 'griddle' : 'boiler'}`, 'warn');
        return this.emit('nope');
      }
      if (this.hand.processed) {
        st.item = this.hand.id;
        st.progress = st.need;
        st.ready = true;
        this.hand = null;
        this.updateLoops();
        return this.emit('collect');
      }
      st.item = this.hand.id;
      st.progress = key === 'chop' ? 1 : 0;
      st.ready = false;
      this.hand = null;
      this.updateLoops();
      if (key === 'chop') this.emit('chop');
      else this.emit('start');
      return true;
    }
    return false;
  }

  finishStation(st) {
    st.ready = true;
    st.progress = st.need;
    this.emit('ready', { station: st.key });
    this.updateLoops();
  }

  updateLoops() {
    const sizzle = !!(this.stations.grill.item && !this.stations.grill.ready);
    const boil = !!(this.stations.boil.item && !this.stations.boil.ready);
    if (sizzle !== this.sizzleOn) {
      this.sizzleOn = sizzle;
      this.audio?.loopNoise('sizzle', sizzle);
    }
    if (boil !== this.boilOn) {
      this.boilOn = boil;
      this.audio?.loopNoise('boil', boil);
    }
  }

  // ---- plate and pass ----------------------------------------------------

  plateClick() {
    if (this.phase !== 'play') return this.reject();
    if (this.plate.dish) {
      this.say('Plate is ready - send it to the pass', 'warn');
      return this.emit('nope');
    }
    if (!this.hand) {
      if (this.plate.items.length) this.say('Right-click the plate to scrap it', 'warn');
      return this.emit('nope');
    }
    const ing = INGREDIENTS[this.hand.id];
    if (ing.process && !this.hand.processed) {
      this.say(`${ing.name} needs the ${ing.process === 'chop' ? 'chop block' : ing.process === 'grill' ? 'griddle' : 'boiler'} first`, 'warn');
      return this.emit('nope');
    }
    if (this.plate.items.length >= 5) {
      this.say('Plate is stacked too high', 'warn');
      return this.emit('nope');
    }
    this.plate.items.push({ id: this.hand.id, processed: this.hand.processed });
    this.hand = null;
    this.matchPlate();
    this.emit('plate');
    return true;
  }

  scrapPlate() {
    if (this.plate.items.length === 0) return;
    this.plate = emptyPlate();
    this.say('Plate scrapped', 'warn');
    this.emit('nope');
  }

  discardHand() {
    if (!this.hand) return;
    this.hand = null;
    this.emit('nope');
  }

  matchPlate() {
    const have = this.plate.items.map((i) => i.id).sort().join(',');
    const hit = DISHES.find((d) => d.parts.slice().sort().join(',') === have);
    if (hit) {
      this.plate.dish = hit.id;
      this.say(`${hit.name} plated!`, 'good');
      this.emit('plate');
    } else {
      this.plate.dish = null;
    }
  }

  serveClick() {
    if (this.phase !== 'play') return this.reject();
    if (!this.plate.dish) {
      this.say('Nothing ready on the plate', 'warn');
      return this.emit('nope');
    }
    const dish = dishById(this.plate.dish);
    const matches = this.orders.filter((o) => o.dishId === dish.id).sort((a, b) => a.patience - b.patience);
    if (matches.length === 0) {
      this.combo = 0;
      this.coins = Math.max(0, this.coins - 15);
      this.say(`No ticket wants ${dish.name} (-15)`, 'bad');
      this.shake = 0.35;
      this.emit('mistake');
      this.plate = emptyPlate();
      return false;
    }
    const order = matches[0];
    const speed = Math.round(order.patience * 2);
    const gain = Math.round(dish.price * this.comboMult) + speed;
    this.score += gain;
    this.coins += gain;
    this.combo += 1;
    this.bestCombo = Math.max(this.bestCombo, this.combo);
    this.served += 1;
    this.lastServedDish = dish.id;
    this.bestServe = { dish: dish.id, gain, combo: this.combo };
    this.orders = this.orders.filter((o) => o.id !== order.id);
    this.plate = emptyPlate();
    this.flash = 0.5;
    this.say(`+${gain}  ${dish.name}`, 'good');
    this.emit('serve', { dish: dish.id, gain });
    if (this.combo > 1) this.emit('combo');
    if (this.served % 4 === 0) this.spawnOrder();
    return true;
  }

  // ---- clock -------------------------------------------------------------

  update(dt) {
    if (this.phase !== 'play') {
      this.banner.age += dt;
      this.toast.age += dt;
      this.shake = Math.max(0, this.shake - dt);
      this.flash = Math.max(0, this.flash - dt);
      return;
    }
    this.time += dt;
    this.banner.age += dt;
    this.toast.age += dt;
    this.shake = Math.max(0, this.shake - dt * 1.8);
    this.flash = Math.max(0, this.flash - dt * 2);

    for (const st of Object.values(this.stations)) {
      if (!st.item || st.ready) continue;
      if (st.key === 'chop') continue;
      st.progress += dt;
      if (st.progress >= st.need) this.finishStation(st);
    }

    this.spawnClock += dt;
    if (this.spawnClock >= this.spawnEvery) {
      this.spawnClock = 0;
      this.spawnOrder();
    }

    const level = Math.min(3, Math.floor(this.time / 58));
    if (level > this.rushLevel) {
      this.rushLevel = level;
      this.announce(level >= 3 ? 'DINNER RUSH' : level === 2 ? 'RUSH HOUR' : 'LUNCH RUSH', 'Tickets come faster. Keep the pass moving.');
      this.spawnEvery = Math.max(4.2, 7.4 - level * 0.8);
      this.spawnOrder();
    }

    for (const order of this.orders) {
      order.patience -= dt;
      order.fresh = Math.min(1, order.fresh + dt * 4);
    }
    const dead = this.orders.filter((o) => o.patience <= 0);
    if (dead.length) {
      for (const order of dead) {
        this.expired += 1;
        this.hearts -= 1;
        this.combo = 0;
        const dish = dishById(order.dishId);
        this.say(`${dish.short} ticket burned`, 'bad');
        this.shake = 0.5;
        this.emit('expire');
      }
      this.orders = this.orders.filter((o) => o.patience > 0);
    }

    if (this.shiftLeft <= 0) {
      this.end('SHIFT COMPLETE');
    } else if (this.hearts <= 0) {
      this.end('KITCHEN CLOSED');
    }
  }

  end(title) {
    if (this.phase !== 'play') return;
    this.phase = 'over';
    this.endTitle = title;
    this.endSummary = {
      score: this.score,
      coins: this.coins,
      served: this.served,
      expired: this.expired,
      bestCombo: this.bestCombo,
    };
    this.banner = { text: title, sub: '', age: 0 };
    this.updateLoops();
    this.emit('gameover');
  }

  // ---- debug staging -----------------------------------------------------

  pushTickets(ids, patience) {
    this.orders = [];
    ids.forEach((id, i) => {
      const dish = dishById(id);
      this.orders.push({
        id: nextOrderId++,
        seq: ++this.ticketSeq,
        dishId: id,
        patience: patience[i],
        patienceMax: Math.max(patience[i], 20),
        reward: dish.price + Math.round(patience[i] * 1.5),
        slot: i,
        fresh: 1,
      });
    });
  }

  stage(scene) {
    this.reset();
    this.phase = 'play';
    this.time = 63;
    this.rushLevel = 0;
    this.spawnEvery = 7;
    this.score = 680;
    this.coins = 680;
    this.combo = 3;
    this.bestCombo = 3;
    this.served = 5;
    this.orders = [];

    if (scene === 'cover') {
      this.time = 74;
      this.pushTickets(['sunset', 'pasta', 'melt'], [18.4, 11.6, 22.1]);
      this.hand = { id: 'tomato', processed: true };
      this.plate.items = [
        { id: 'bun', processed: false },
        { id: 'patty', processed: true },
        { id: 'cheese', processed: false },
      ];
      this.stations.grill.item = 'patty';
      this.stations.grill.progress = 2.4;
      this.stations.grill.ready = true;
      this.stations.chop.item = 'onion';
      this.stations.chop.progress = 2;
      this.stations.chop.ready = false;
      this.matchPlate();
      this.say('Sunset Burger almost there', 'good');
      this.toast.age = 0.2;
    } else if (scene === 'rush') {
      this.time = 157;
      this.rushLevel = 2;
      this.score = 2410;
      this.coins = 2410;
      this.combo = 6;
      this.bestCombo = 6;
      this.served = 14;
      this.hearts = 2;
      this.spawnEvery = 5;
      this.pushTickets(['sunset', 'melt', 'pasta', 'toast', 'sunset'], [16.2, 7.2, 21.4, 4.1, 11.6]);
      this.hand = { id: 'onion', processed: false };
      this.plate.items = [{ id: 'pasta', processed: true }, { id: 'herb', processed: true }];
      this.stations.boil.item = 'pasta';
      this.stations.boil.progress = 2.8;
      this.stations.boil.ready = true;
      this.stations.grill.item = 'patty';
      this.stations.grill.progress = 1.1;
      this.stations.chop.item = 'tomato';
      this.stations.chop.progress = 1;
      this.matchPlate();
      this.announce('RUSH HOUR', 'Tickets come faster. Keep the pass moving.');
      this.banner.age = 1.2;
      this.say('Two tickets close to burning', 'bad');
      this.toast.age = 0.2;
    } else if (scene === 'serve') {
      this.time = 118;
      this.score = 1680;
      this.coins = 1680;
      this.combo = 4;
      this.bestCombo = 4;
      this.served = 9;
      this.pushTickets(['sunset', 'toast', 'pasta'], [16.2, 9.4, 20.7]);
      this.plate.items = ['bun', 'patty', 'tomato', 'cheese'].map((id) => ({ id, processed: id !== 'bun' && id !== 'cheese' }));
      this.matchPlate();
      this.stations.chop.item = 'herb';
      this.stations.chop.progress = 3;
      this.stations.chop.ready = true;
      this.stations.grill.item = 'patty';
      this.stations.grill.progress = 0.8;
      this.say('Sunset Burger ready', 'good');
      this.toast.age = 0.2;
    } else if (scene === 'title') {
      this.orders = [];
    }
  }
}
