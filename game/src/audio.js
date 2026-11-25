// Everything you hear is an oscillator or a burst of filtered noise made on the
// spot. No files, no network: the kitchen hums with maths.
export class KitchenAudio {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.sizzleSrc = null;
    this.sizzleGain = null;
    this.boilSrc = null;
    this.boilGain = null;
  }

  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return true;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.55;
    this.master.connect(this.ctx.destination);
    return true;
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.master) this.master.gain.value = muted ? 0 : 0.55;
  }

  blip(freq, dur, type = 'sine', gain = 0.15, slide = 0) {
    if (!this.ensure() || this.muted) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(this.master);
    osc.start(t);
    osc.stop(t + dur + 0.03);
  }

  noise(dur, gain, freq, q = 1) {
    if (!this.ensure() || this.muted) return;
    const t = this.ctx.currentTime;
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = freq;
    bp.Q.value = q;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(bp).connect(g).connect(this.master);
    src.start(t);
    src.stop(t + dur);
  }

  loopNoise(kind, on) {
    if (!this.ensure()) return;
    const key = kind === 'boil' ? 'boil' : 'sizzle';
    const cur = key === 'boil' ? this.boilSrc : this.sizzleSrc;
    if (on && !cur) {
      const t = this.ctx.currentTime;
      const len = Math.floor(this.ctx.sampleRate * 1.2);
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      const f = this.ctx.createBiquadFilter();
      f.type = 'bandpass';
      f.frequency.value = key === 'boil' ? 380 : 2200;
      f.Q.value = key === 'boil' ? 0.9 : 1.4;
      const g = this.ctx.createGain();
      g.gain.value = 0.0001;
      g.gain.exponentialRampToValueAtTime(key === 'boil' ? 0.035 : 0.05, t + 0.25);
      src.connect(f).connect(g).connect(this.master);
      src.start(t);
      if (key === 'boil') { this.boilSrc = src; this.boilGain = g; }
      else { this.sizzleSrc = src; this.sizzleGain = g; }
    } else if (!on && cur) {
      const t = this.ctx.currentTime;
      const g = key === 'boil' ? this.boilGain : this.sizzleGain;
      try {
        g.gain.cancelScheduledValues(t);
        g.gain.setValueAtTime(Math.max(0.0001, g.gain.value), t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.15);
        cur.stop(t + 0.2);
      } catch (err) { /* the node may already be stopped */ }
      if (key === 'boil') { this.boilSrc = null; this.boilGain = null; }
      else { this.sizzleSrc = null; this.sizzleGain = null; }
    }
  }

  handle(event, state) {
    switch (event) {
      case 'pick': this.blip(520, 0.06, 'triangle', 0.1, 120); break;
      case 'chop': this.noise(0.09, 0.32, 1600, 2.4); this.blip(190, 0.07, 'square', 0.05, -60); break;
      case 'start': this.blip(320, 0.12, 'sawtooth', 0.05, 90); break;
      case 'ready': this.blip(880, 0.1, 'sine', 0.12, 140); break;
      case 'collect': this.blip(640, 0.06, 'triangle', 0.1, 80); break;
      case 'plate': this.blip(440, 0.08, 'sine', 0.13, 160); this.noise(0.05, 0.12, 900, 1); break;
      case 'serve':
        this.blip(660, 0.14, 'sine', 0.16);
        setTimeout(() => this.blip(990, 0.2, 'sine', 0.14), 90);
        setTimeout(() => this.blip(1320, 0.24, 'triangle', 0.12), 180);
        break;
      case 'combo': this.blip(760 + Math.min(state.combo, 8) * 60, 0.12, 'square', 0.07, 120); break;
      case 'order': this.blip(1180, 0.09, 'sine', 0.08, 60); setTimeout(() => this.blip(1500, 0.12, 'sine', 0.06), 80); break;
      case 'expire': this.blip(180, 0.3, 'sawtooth', 0.12, -90); break;
      case 'mistake': this.blip(150, 0.18, 'square', 0.08, -40); break;
      case 'nope': this.blip(240, 0.05, 'sine', 0.05, -40); break;
      case 'gameover': this.blip(420, 0.5, 'triangle', 0.14, -220); break;
      default: break;
    }
  }
}
