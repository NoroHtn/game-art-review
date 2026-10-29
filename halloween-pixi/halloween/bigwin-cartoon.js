// PixiJS 8 / FrameClock port of Edgar main 9afbbfc, game/bigwin-cartoon.js.
// BIG / SUPER / MEGA / EPIC WIN and TOTAL WIN as a cartoon short (duel B, docs/research/duel-b-bigwin.md).
// One director on the shared ticker plays a building gag: the ribbon slams in on a smear, its letters pop up like popcorn,
// the counter's digits are little characters that hop when they change, and every tier-up is a bigger sign that kicks the old
// one off the screen. The princess is the audience's stand-in: she zips in and reacts to the number with a personality beat per
// tier (wink → double take → "ah!" → star rain), then takes her bow on the exact amount (the "ta-da" button) and a heart iris
// opens the board again. Only soft things squash (cloth ribbon, candy letters and digits, the princess); the gold counter plaque
// moves rigidly. One focal onset at a time; turbo is its own short cut; a tap slams to the final tier + amount, a second tap exits.
import { DESIGN, WIN } from '../game/config.js';
const fxTextures = () => ({'fx-star': globalThis.PIXI.Texture.WHITE});
import {coinFountain} from './win-fountain.js?v=edgar-ui-r5-20261029';
const makePrincessV2 = () => null; // No Diamond Princess character in the Halloween game.

const RIB_Y = 380, CNT_Y = 664, PR_X = 300, CX = DESIGN.w / 2, RW = 1250; // ribbon centre, counter centre, princess centre, unscaled ribbon width
const TIERS = [ // style per tier: each one is bigger and louder than the last (the building gag)
  { name: 'BIG WIN', x: WIN.tiers.big, art: 'big', scale: 0.7, tint: 0xffffff, sun: 0xffc94f, body: ['#fff2ad', '#ffbd31', '#db6814'], rim: '#6f3107', coins: 12, shake: 4, act: 'act_wink' },
  { name: 'SUPER WIN', x: WIN.tiers.super, art: 'mega', scale: 0.79, tint: 0xd6f3ff, sun: 0x48c9ff, body: ['#d8f8ff', '#53d4ee', '#2562c8'], rim: '#12346e', coins: 24, shake: 5, act: 'act_look' },
  { name: 'MEGA WIN', x: WIN.tiers.mega, art: 'mega', scale: 0.88, tint: 0xffffff, sun: 0xff624e, body: ['#ffe9a6', '#ff7a39', '#c92b42'], rim: '#68152e', coins: 40, shake: 7, act: 'act_ah' },
  { name: 'EPIC WIN', x: WIN.tiers.epic, art: 'epic', scale: 0.96, tint: 0xffffff, sun: 0x64d9bd, body: ['#ecfff0', '#4ae0b1', '#2878b7'], rim: '#123f50', coins: 64, shake: 9, act: 'act_rain' },
];
const TOTAL = { name: 'TOTAL WIN', body: ['#fff7cc', '#ffcf4f', '#ff9638'], rim: '#b8560e' };

// ---------- small motion kit: eases and a damped spring (the cartoon "boing") ----------
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const E = {
  out: (u) => 1 - (1 - u) ** 3, in: (u) => u * u * u, io: (u) => (u < 0.5 ? 4 * u * u * u : 1 - (-2 * u + 2) ** 3 / 2),
  back: (u) => 1 + 2.7 * (u - 1) ** 3 + 1.7 * (u - 1) ** 2, sine: (u) => -(Math.cos(Math.PI * u) - 1) / 2,
};
class Spring { // x → target; kick() adds velocity. ~4–5 Hz with light damping: two visible overshoots, then rest
  constructor(v = 0, k = 700, d = 15) { this.v = v; this.t = v; this.vel = 0; this.k = k; this.d = d; }
  step(dt) { for (let n = 0, h = dt / 2; n < 2; n++) { this.vel += (this.k * (this.t - this.v) - this.d * this.vel) * h; this.v += this.vel * h; } return this.v; }
  kick(vel) { this.vel += vel; return this; }
}

// ---------- textures painted here once: candy title glyphs, the cartoon sunburst, a speed streak ----------
const glyphs = new Map();
function glyphTex(ch, st) { // heavy display glyph: plum outline, simple jewel gradient, one broad key-light plane
  const key = st.name + '|' + ch; if (glyphs.has(key)) return glyphs.get(key);
  const FS = 150, font = `900 ${FS}px "Arial Black", Inter, sans-serif`, c = document.createElement('canvas'), g = c.getContext('2d');
  g.font = font; const w = Math.ceil(g.measureText(ch).width) + 64, h = FS + 84; c.width = w; c.height = h;
  const cx = w / 2, cy = h / 2 + 4, top = cy - FS * 0.42, bot = cy + FS * 0.42;
  g.font = font; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
  g.save(); g.shadowColor = 'rgba(30,4,36,0.5)'; g.shadowBlur = 14; g.shadowOffsetY = 9; g.lineWidth = 24; g.strokeStyle = '#3a0f3f'; g.strokeText(ch, cx, cy); g.restore();
  g.lineWidth = 24; g.strokeStyle = '#3a0f3f'; g.strokeText(ch, cx, cy);
  const l = document.createElement('canvas'); l.width = w; l.height = h; const b = l.getContext('2d'); b.font = font; b.textAlign = 'center'; b.textBaseline = 'middle'; b.lineJoin = 'round';
  let body; if (st.body === 'prism') { body = b.createLinearGradient(cx - FS * 0.45, top, cx + FS * 0.45, bot); ['#ff7ab0', '#ffd36a', '#8dff9a', '#6ad8ff', '#b28cff'].forEach((col, i, a) => body.addColorStop(i / (a.length - 1), col)); }
  else { body = b.createLinearGradient(0, top, 0, bot); body.addColorStop(0, st.body[0]); body.addColorStop(0.5, st.body[1]); body.addColorStop(1, st.body[2]); }
  b.fillStyle = body; b.fillText(ch, cx, cy); b.globalCompositeOperation = 'source-atop';
  b.lineWidth = 9; b.strokeStyle = st.rim; b.globalAlpha = 0.55; b.strokeText(ch, cx, cy + 3); b.globalAlpha = 1;
  const gl = b.createLinearGradient(0, top, 0, top + FS * 0.3); gl.addColorStop(0, 'rgba(255,255,255,0.34)'); gl.addColorStop(1, 'rgba(255,255,255,0)');
  b.fillStyle = gl; b.fillRect(cx - FS * 0.38, top, FS * 0.76, FS * 0.28);
  g.drawImage(l, 0, 0);
  const t = PIXI.Texture.from(c); t.adv = w - 64 - 6; glyphs.set(key, t); return t;
}
let SUN;
function sunTex() { // the cartoon backdrop: soft two-tone wedges (a painted pattern, not light), fading out toward the edge
  return SUN ??= (() => { const s = 1024, c = document.createElement('canvas'); c.width = c.height = s; const g = c.getContext('2d'), n = 18;
    for (let i = 0; i < n; i++) { const a0 = (i / n) * Math.PI * 2, a1 = ((i + 0.5) / n) * Math.PI * 2; g.beginPath(); g.moveTo(s / 2, s / 2); g.arc(s / 2, s / 2, s / 2, a0, a1); g.closePath(); g.fillStyle = '#fff'; g.fill(); }
    g.globalCompositeOperation = 'destination-in'; const r = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2); r.addColorStop(0, 'rgba(255,255,255,0)'); r.addColorStop(0.12, 'rgba(255,255,255,0.9)'); r.addColorStop(0.55, 'rgba(255,255,255,0.55)'); r.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = r; g.fillRect(0, 0, s, s); return PIXI.Texture.from(c); })();
}
const heartPts = (r, cx, cy) => { const p = []; for (let i = 0; i < 48; i++) { const a = (i / 48) * Math.PI * 2, x = 16 * Math.sin(a) ** 3, y = 13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a); p.push(cx + x * r / 16, cy - y * r / 16 - r * 0.1); } return p; };

/** Build every glyph and the sunburst while the player looks at the idle screen (no first-win hitch). Returns a container to warm-draw. */
export function warmCartoon() {
  const c = new PIXI.Container();
  for (const st of [...TIERS, TOTAL]) for (const ch of st.name.replace(' ', '')) c.addChild(new PIXI.Sprite(glyphTex(ch, st)));
  c.addChild(new PIXI.Sprite(sunTex())); return c;
}

// ---------- the ribbon: a soft cloth sign with candy letters; it drops on a smear, strains, gets kicked off, zips out ----------
class Ribbon {
  constructor(parent, st, art) {
    this.st = st; this.c = parent.addChild(new PIXI.Container()); this.c.position.set(CX, RIB_Y); this.base = st.scale ?? 0.7;
    const tex = art[st.art] ?? art.big; this.ghosts = [0.32, 0.16].map((a) => { const s = this.c.addChild(new PIXI.Sprite(tex)); s.anchor.set(0.5); s.alpha = 0; s.a0 = a; s.tint = st.tint ?? 0xffffff; return s; });
    this.art = tex ? this.c.addChild(new PIXI.Sprite(tex)) : null; if (this.art) { this.art.anchor.set(0.5); this.art.scale.set(RW / tex.width); this.art.tint = st.tint ?? 0xffffff; this.ghosts.forEach((g) => g.scale.set(RW / tex.width)); }
    const ch = [...st.name].filter((x) => x !== ' '), texs = ch.map((x) => glyphTex(x, st)), gap = -6, sp = 44;
    let x = 0; const xs = []; [...st.name].forEach((x0) => { if (x0 === ' ') { x += sp; return; } const t = texs[xs.length]; xs.push(x + t.adv / 2); x += t.adv + gap; });
    const W = x - gap, fit = Math.min(1, 900 / W); // the title always fits the ribbon's field
    this.title = this.c.addChild(new PIXI.Container()); this.title.y = -28; this.title.scale.set(fit);
    this.letters = texs.map((t, i) => { const s = this.title.addChild(new PIXI.Sprite(t)); s.anchor.set(0.5, 0.62); s.x = xs[i] - W / 2; s.visible = false; return { s, x: s.x, y: new Spring(0, 900, 16), sx: new Spring(1, 900, 13), t0: 0, ph: i * 0.55 }; });
    this.y = -700; this.vy = 0; this.sx = new Spring(1, 520, 11); this.sy = new Spring(1, 520, 11); this.rot = 0; this.hist = []; this.phase = 'wait'; this.pt = 0; this.age = 0;
    this.c.scale.set(this.base); this.c.visible = false;
  }
  drop(fast) { this.phase = 'drop'; this.pt = 0; this.dropT = fast ? 0.22 : 0.3; this.c.visible = true; }
  strain(d) { this.phase = 'strain'; this.pt = 0; this.strainT = d; }
  kick(dir) { this.phase = 'kick'; this.pt = 0; this.dir = dir; this.vy = -900; }
  bounce() { this.sy.kick(-2.2); this.sx.kick(1.6); this.letters.forEach((l, i) => { l.hopAt = this.age + 0.06 + i * 0.035; }); }
  exit() { this.phase = 'exit'; this.pt = 0; }
  update(dt, events) {
    this.pt += dt; this.age += dt; const p = this.pt; let y = this.y, rot = this.rot, bulge = 0;
    if (this.phase === 'drop') { // falls from above the screen, accelerating; the impact frame squashes the cloth and calls the shot
      const u = clamp(p / this.dropT); y = -620 + 620 * E.in(u);
      if (u >= 1) { this.phase = 'hold'; this.pt = 0; y = 0; this.sy.v = 0.8; this.sx.v = 1.17; this.sy.vel = 0; this.sx.vel = 0; events.push(['impact', this]);
        this.letters.forEach((l, i) => { l.t0 = this.age + 0.04 + i * (this.fastLetters ? 0.028 : 0.042); }); }
    } else if (this.phase === 'hold') { y = 4 * Math.sin(this.age * 2 * Math.PI / 1.9); rot = 0.9 * Math.sin(this.age * 2 * Math.PI / 2.7 + 0.6); } // moving hold: bob and sway on different periods
    else if (this.phase === 'strain') { // it can't hold the number: trembles and swells, then crouches for the kick (anticipation)
      const k = clamp(p / this.strainT), crouch = clamp((p - this.strainT + 0.09) / 0.09); rot = Math.sin(p * 2 * Math.PI * 21) * 1.8 * k; bulge = 0.08 * E.out(k); y = 2.5 * Math.sin(p * 2 * Math.PI * 17) * k + 14 * E.out(crouch);
      this.crouch = crouch; }
    else if (this.phase === 'kick') { this.vy -= 2600 * dt; y = this.y + this.vy * dt; rot = this.rot + this.dir * 60 * dt; if (y < -900) { this.c.visible = false; this.phase = 'gone'; } }
    else if (this.phase === 'exit') { if (p < 0.09) y = 16 * E.out(p / 0.09); else { const u = clamp((p - 0.09) / 0.28); y = 16 - 980 * E.in(u); if (u >= 1) { this.c.visible = false; this.phase = 'gone'; } } } // anticipation dip, then a zip up
    const speed = Math.abs(y - this.y) / Math.max(dt, 1e-3); this.y = y; this.rot = rot;
    this.hist.unshift(y); this.hist.length = 6;
    const smear = this.phase === 'hold' ? 0 : clamp(speed / 5000) * 0.3; // stretch along the motion while it travels fast
    const cr = this.phase === 'strain' ? this.crouch : 0; this.sx.t = 1 + bulge - smear * 0.35 + cr * 0.06; this.sy.t = 1 + bulge + smear - cr * 0.14; this.sx.step(dt); this.sy.step(dt);
    this.c.y = RIB_Y + y; this.c.rotation = rot * Math.PI / 180; this.c.scale.set(this.base * this.sx.v, this.base * this.sy.v);
    this.ghosts.forEach((g, i) => { const hy = this.hist[(i + 1) * 2] ?? y; g.y = (hy - y) / this.base; g.alpha = smear > 0.04 ? g.a0 * clamp(smear / 0.15) : Math.max(0, g.alpha - dt * 6); }); // motion trails: the sign's own art where it was 2 and 4 frames ago
    for (const [i, l] of this.letters.entries()) { // popcorn: each letter jumps out of the cloth, stretches up, lands squashed, wobbles
      if (!l.t0 || this.age < l.t0) continue; const a = this.age - l.t0;
      if (!l.s.visible) { l.s.visible = true; l.y.v = 46; l.y.vel = -1250; l.sx.v = 0.7; l.sx.vel = 0; }
      if (l.hopAt && this.age >= l.hopAt) { l.hopAt = 0; l.y.vel -= 520; l.sx.vel -= 4; }
      const yy = l.y.step(dt), sq = l.sx.step(dt), wave = this.phase === 'hold' && a > 0.5 ? 5 * Math.sin((this.age - l.t0) * 2 * Math.PI / 1.6 - l.ph) : 0, jit = this.phase === 'strain' ? Math.sin(this.age * 130 + i * 2) * 3 : 0;
      l.s.position.set(l.x + jit, yy + wave); l.s.scale.set(sq, 2 - sq);
    }
  }
  destroy() { this.c.destroy({ children: true }); }
}

// ---------- the counter: a rigid gold plaque; its digits are characters that hop when they change ----------
class Counter {
  constructor(parent, frameTex, digitsTex, h) {
    this.c = parent.addChild(new PIXI.Container()); this.c.position.set(CX, CNT_Y); this.c.visible = false; this.s = new Spring(0, 520, 17); this.r = new Spring(0, 260, 7); this.dy = new Spring(0, 420, 12);
    if (frameTex) { const f = this.c.addChild(new PIXI.Sprite(frameTex)); f.anchor.set(0.5); f.scale.set(0.58); }
    this.row = this.c.addChild(new PIXI.Container()); this.row.y = 2;
    this.h = h; this.cells = []; this.text = '';
    if (digitsTex) { const cw = digitsTex.width / 12; this.frames = [...Array(12)].map((_, i) => new PIXI.Texture({source:digitsTex.source,frame:new PIXI.Rectangle(digitsTex.frame.x+i*cw,digitsTex.frame.y,cw,digitsTex.height)})); this.k = h / digitsTex.height; this.adv = cw * this.k * 0.78; }
    this.punch = new Spring(1, 600, 12);
  }
  show() { this.c.visible = true; this.s.v = 0.55; this.s.t = 1; this.s.vel = 9; this.r.v = -3; }
  set(str, age, land = false) { // cells are keyed from the right, so a place value stays the same character while the number grows
    if (str === this.text) return; const old = this.text; this.text = str;
    const chars = [...str].reverse();
    chars.forEach((ch, i) => {
      let cell = this.cells[i];
      if (!cell) { const s = this.row.addChild(this.frames ? new PIXI.Sprite() : new PIXI.Text('', { fontFamily: 'Fredoka', fontSize: this.h, fill: 0xffe07a, stroke: 0x3a0f3f, strokeThickness: 10 })); s.anchor.set(0.5, 0.55);
        cell = this.cells[i] = { s, ch: '', at: -1, roll: 0, y: new Spring(0, 900, 15), sq: new Spring(1, 800, 12), x: new Spring(0, 420, 24), pop: new Spring(old ? 0 : 1, 700, 14) }; cell.pop.t = 1; } // a new place value pops in; the others slide over
      if (cell.ch !== ch) {
        const prev = cell.ch, slow = age - cell.at > 0.3; cell.ch = ch; cell.at = age;
        this.paint(cell.s, ch);
        if (prev && (slow || land) && ch !== ',' && ch !== '.') { cell.y.vel -= 420; cell.sq.vel -= 3.5; } // a slow place value changes: that digit hops and lands squashed
        else if (prev) cell.roll = age; // a fast place rolls: a smear frame (stretched tall and thin), never a second, ghost number
      }
    });
    for (let i = chars.length; i < this.cells.length; i++) this.cells[i].s.destroy(); this.cells.length = chars.length;
  }
  paint(s, ch) { if (!this.frames) { s.text = ch; return; } const i = ch === ',' ? 10 : ch === '.' ? 11 : '0123456789'.indexOf(ch); s.texture = this.frames[Math.max(0, i)]; s.scale.set(this.k); }
  wave(age) { [...this.cells].reverse().forEach((c, i) => { c.waveAt = age + i * 0.04; }); this.lastWave = age + this.cells.length * 0.04; } // the ta-da: digits hop left to right
  update(dt, age, jam) {
    if (!this.c.visible) return; const s = this.s.step(dt), r = this.r.step(dt), p = this.punch.step(dt);
    this.c.scale.set(s * p); this.c.rotation = r * Math.PI / 180; this.c.y = CNT_Y + this.dy.step(dt);
    let x = 0; const ws = this.cells.map((c) => (',.'.includes(c.ch) ? 0.42 : 1) * (this.adv ?? this.h * 0.6)); const W = ws.reduce((a, b) => a + b, 0);
    this.cells.forEach((c, i) => { // right to left
      const tx = W / 2 - x - ws[i] / 2; x += ws[i]; if (c.x.v === 0 && c.x.t === 0) c.x.v = tx; c.x.t = tx;
      if (c.waveAt && age >= c.waveAt) { c.waveAt = 0; c.y.vel -= 700; c.sq.vel -= 5; }
      const jit = jam ? Math.sin(age * 120 + i * 1.7) * 2.5 : 0;
      c.s.position.set(c.x.step(dt) + jit, c.y.step(dt)); const q = c.sq.step(dt), b = c.pop.step(dt) * (this.k ?? 1), sm = age - c.roll < 0.1 ? 0.09 : 0; c.s.scale.set(b * (2 - q) * (1 - sm * 0.5), b * q * (1 + sm)); // squash keeps the area
    });
  }
}

// ---------- the director ----------
/**
 * Play the ceremony. o: { layer, camera, art: { big, mega, epic, frame, digits, sparkle[], heart[] }, coinFrames, total, bet, turbo, label,
 * fmt, onValue(v), onSkipReady(fn) }. Resolves when the board is visible again.
 */
export function cartoonWin(o) {
  const { total, bet, turbo, label, fmt } = o, mult = total / bet;
  const reach = TIERS.filter((t) => mult >= t.x).length - 1; // highest tier this amount reaches (-1: under BIG)
  const plain = !!label && total <= bet; // a TOTAL WIN at or below the stake: no celebration, just the amount
  const small = !!label && reach < 0;
  const ladder = label ? [{ ...TIERS[Math.max(0, reach)], ...TOTAL, tint: 0xffffff, ...(small ? { coins: 6, shake: 3 } : {}) }] : turbo ? [TIERS[reach]] : TIERS.slice(0, reach + 1); // TOTAL WIN: gold letters on the sign of the tier it reaches
  const C = o.layer.addChild(new PIXI.Container()), FX = fxTextures();
  C.eventMode = 'static'; C.hitArea = new PIXI.Rectangle(0, 0, DESIGN.w, DESIGN.h); C.cursor = 'pointer';
  const dim = C.addChild(new PIXI.Graphics()), sun = C.addChild(new PIXI.Sprite(sunTex())); sun.anchor.set(0.5); sun.position.set(CX, RIB_Y + 40); sun.alpha = 0; sun.blendMode = 'normal';
  const fountain = plain ? null : coinFountain(o.coinFrames); if (fountain) { C.addChild(fountain); fountain.position.set(CX, 540); fountain.setCount(0); }
  const ribLayer = C.addChild(new PIXI.Container()), counter = new Counter(C, o.art.frame, o.art.digits, 140);
  const prLayer = C.addChild(new PIXI.Container()), fx = C.addChild(new PIXI.Container());
  const withPrincess = false;
  let pr = null, prBase = null; const prY = new Spring(0, 260, 19), prS = new Spring(1, 600, 12);
  if (withPrincess) { pr = makePrincessV2(); if (pr) { const b = pr.getLocalBounds(), s = 940 / b.height; prBase = { s, x: PR_X - (b.x + b.width / 2) * s, y: DESIGN.h + 230 - (b.y + b.height) * s }; pr.scale.set(s); pr.visible = false; prLayer.addChild(pr); } }
  const streaks = withPrincess ? [...Array(5)].map((_, i) => { const s = prLayer.addChildAt(new PIXI.Sprite(FX['fx-streak']), 0); s.anchor.set(0.5, 0); s.scale.set(0.5 + (i % 2) * 0.3, 2.4); s.x = PR_X + (i - 2) * 46; s.alpha = 0; s.tint = 0xfff1f6; return s; }) : [];
  const sparks = [];
  const puff = (x, y, n, spread, col) => { // cartoon impact puff: 4-point sparkles thrown out, slowing, spinning, shrinking
    for (let i = 0; i < n; i++) { const fr = o.art.sparkle?.length ? o.art.sparkle : [FX['fx-star']], s = fx.addChild(new PIXI.Sprite(fr[i % fr.length])); s.anchor.set(0.5); s.blendMode = 'add'; s.tint = col ?? 0xffffff;
      const a = -Math.PI / 2 + (i / Math.max(1, n - 1) - 0.5) * spread + (Math.random() - 0.5) * 0.3, v = 420 + Math.random() * 380; sparks.push({ s, fr, x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.5 + Math.random() * 0.25, age: 0, sc: 0.5 + Math.random() * 0.5 }); }
  };
  const ting = (x, y) => { const fr = o.art.heart?.length ? o.art.heart : null; if (fr) { const s = fx.addChild(new PIXI.Sprite(fr[0])); s.anchor.set(0.5); s.position.set(x, y); sparks.push({ s, fr, x, y, vx: 0, vy: -60, life: 0.55, age: 0, sc: 1.1, flip: true }); } puff(x, y, 6, Math.PI * 2, 0xfff3c4); };
  let shakeT = 0, shakeA = 0; const cam0 = o.camera ? { x: o.camera.x, y: o.camera.y } : null;
  const shake = (a) => { shakeA = a; shakeT = 0.32; };

  // count plan: one segment per tier crossed (accelerating into each threshold, braking into the final amount)
  const marks = label || turbo ? [] : ladder.slice(1).map((t) => t.x * bet);
  const segDur = (i, n, from) => (turbo ? 1.2 : label ? (plain ? 1.0 : small ? 1.8 : 2.4 + 0.3 * reach) : n === 1 ? 2.4 : i < n - 1 ? (i === 0 ? 1.8 : 1.6) : clamp(0.5 + 1.1 * (total - from) / from, 0.7, 1.6)); // the last run is as long as what is left to count
  let ribbon = null, nextTier = 0, seg = 0, segT = 0, segFrom = 0, value = 0, phase = 'intro', pt = 0, age = 0, skip = 0, pendingAct = null, holdT = 0, irisR = 0, sunSpin = 0;
  const newRibbon = (st, fast) => { o.onTier?.(st.name); const r = new Ribbon(ribLayer, st, o.art); r.fastLetters = fast; r.drop(fast); return r; };
  const act = (name, delay = 0.18) => { if (pr) pendingAct = { name, at: age + delay }; };
  const tierUp = () => { phase = 'gag'; pt = 0; ribbon.strain(skip ? 0.12 : 0.26); };
  const land = () => { phase = 'land'; pt = 0; value = total; skipAtLand = skip; o.onValue?.(total); counter.set(fmt(total), age, true); counter.wave(age); ribbon?.bounce(); counter.punch.kick(3.2);
    act(plain || small ? null : reach >= 2 ? 'act_curtsy' : 'act_kiss', 0.16 + counter.cells.length * 0.04); };
  o.onSkipReady?.(() => { if (age > WIN.skipLock / 1000) skip++; });
  C.on('pointertap', () => { if (age > WIN.skipLock / 1000) skip++; });
  let lastSkip = 0, skipAtLand = 0;

  return new Promise((done) => {
    const step = (stepMs) => {
      const dt = stepMs / 1000; age += dt; pt += dt; const events = []; o.onFrame?.({age,phase,value});
      const newSkip = skip > lastSkip; lastSkip = skip;
      // ---- phase logic ----
      if (phase === 'intro') {
        if (!ribbon && pt >= (plain ? 0 : 0.12)) { ribbon = newRibbon(ladder[0], turbo || plain); nextTier = 1; }
        if (pt >= (plain ? 0.45 : 0.62) && !counter.c.visible) { counter.show(); counter.set(fmt(0), age); }
        if (pt >= (plain ? 0.5 : turbo ? 0.62 : 0.75)) { phase = 'count'; pt = 0; seg = 0; segT = 0; segFrom = 0; }
      }
      if (pr && !pr.visible && age >= (label ? 0.9 : 1.05) && phase !== 'exit') { pr.visible = true; prY.v = 700; prY.t = 0; prY.vel = -3900; if (pr.skeleton.data.findAnimation('appear')) { pr.state.setAnimation(0, 'appear', false); pr.state.addAnimation(0, 'idle', true, 0).mixDuration = 0.3; } act(ladder[0].act ?? 'act_wink', 0.95); }
      if (phase === 'count') {
        const n = marks.length + 1, D = segDur(seg, n, segFrom), to = seg < marks.length ? marks[seg] : total; segT += dt;
        const u = clamp(segT / D), e = seg < marks.length ? 0.35 * u + 0.65 * u * u : 1 - (1 - u) ** 2.4;
        value = segFrom + (to - segFrom) * e;
        if (newSkip) { if (nextTier < ladder.length) { nextTier = ladder.length - 1; value = to; tierUp(); } else land(); }
        else if (u >= 1) { if (seg < marks.length) { value = to; tierUp(); } else land(); }
        if (phase === 'count' || phase === 'gag') { const v = Math.round(value); o.onValue?.(v); counter.set(fmt(v), age); }
      } else if (phase === 'gag') { // the counter jams at the threshold, the sign trembles, POP: the old sign is kicked off and a bigger one slams in
        const kickAt = skip ? 0.12 : 0.26;
        if (newSkip && ribbon.phase === 'strain') nextTier = ladder.length - 1; // a tap before the kick: the final tier's sign comes in
        if (pt >= kickAt && ribbon.phase === 'strain') { ribbon.kick(nextTier % 2 ? 1 : -1); puff(CX, RIB_Y + 60, 8, Math.PI * 0.9, 0xffffff); const old = ribbon; ribbon = newRibbon(ladder[nextTier], !!skip); ribbon.prev = old; }
        if (pt >= kickAt + (skip ? 0.26 : 0.32)) { // the new sign landed: count on from the threshold
          const t = nextTier; nextTier++;
          if (skip && t < ladder.length - 1) { nextTier = ladder.length - 1; tierUp(); } // a tap after the kick: one more quick sign, the final one
          else if (skip || (t === ladder.length - 1 && total - marks[seg] < total * 0.005)) land(); // nothing left to count: the new sign IS the landing
          else { phase = 'count'; pt = 0; segFrom = marks[seg]; seg = t; segT = 0; }
        }
      } else if (phase === 'land') {
        if (pt >= (turbo ? 0.25 : 0.45)) { phase = 'hold'; holdT = 0; }
      } else if (phase === 'hold') {
        holdT += dt; if (holdT >= (turbo ? 0.6 : plain ? 0.9 : 1.4) || skip > skipAtLand) { phase = 'exit'; pt = 0; ribbon?.exit(); } // a tap after the amount landed closes
      } else if (phase === 'exit') {
        if (pt >= 0.5) { finish(); return; }
      }
      // ---- actors ----
      const ribs = [ribbon, ribbon?.prev].filter(Boolean); ribs.forEach((r) => r.update(dt, events));
      if (ribbon?.prev?.phase === 'gone') { ribbon.prev.destroy(); ribbon.prev = null; }
      for (const [ev, r] of events) if (ev === 'impact') { // the one focal onset of this beat
        const st = r.st, w = RW * r.base;
        if (!plain) { shake(st.shake ?? 5); puff(CX - w * 0.42, RIB_Y + 70, 5, Math.PI * 0.7, 0xfff1f6); puff(CX + w * 0.42, RIB_Y + 70, 5, Math.PI * 0.7, 0xfff1f6); }
        sun.tint = st.sun ?? 0xffc36a; fountain?.setCount(st.coins ?? 24); if (counter.c.visible) { counter.dy.kick(260); counter.r.kick((r.base > 0.8 ? 1 : -1) * 40); } // the slam knocks the plaque: it dips and rocks (rigid, no squash)
        if (ladder.indexOf(st) > 0 && st.act) act(st.act, 0.3); // she reacts after the event: eyes first, then the body
      }
      fountain?.update(dt);
      counter.update(dt, age, phase === 'gag' && ribbon?.phase === 'strain');
      if (phase === 'land' && pt > 0 && !counter.tinged && age >= counter.lastWave) { counter.tinged = true; counter.punch.kick(2.5); ting(CX + counter.cells.length * (counter.adv ?? 50) * 0.5 + 30, CNT_Y - 40); }
      // princess: zips up out of the bottom edge on a stretch, lands with a squash, then lives through her acts
      if (pr?.visible) {
        if (pendingAct && age >= pendingAct.at) { const n = pendingAct.name; pendingAct = null; if (n && pr.skeleton.data.findAnimation(n)) { const e = pr.state.setAnimation(0, n, false); e.mixDuration = 0.12; pr.state.addAnimation(0, 'idle', true, 0).mixDuration = 0.35; } }
        const before = prY.v; prY.step(dt); const vy = (prY.v - before) / dt;
        if (phase === 'exit' && pt > 0.06) { prY.t = 900; if (!pr.ducked) { pr.ducked = true; prY.vel = -380; } }
        prS.t = 1 + clamp(Math.abs(vy) / 4000) * 0.14; prS.step(dt);
        if (!pr.landed && prY.v < 30 && vy > -50) { pr.landed = true; prS.v = 0.92; prS.vel = 0; }
        pr.position.set(prBase.x, prBase.y + prY.v); pr.scale.set(prBase.s * (2 - prS.v), prBase.s * prS.v);
        streaks.forEach((s, i) => { s.y = prBase.y + prY.v + 560 + i * 18; s.alpha = clamp(Math.abs(vy) / 3000) * 0.5; });
      }
      // dim, sunburst, heart iris (the exit opens the board through a heart)
      const dimA = plain ? 0.45 : 0.62, inA = clamp(age / 0.3) * dimA;
      if (phase === 'exit') irisR = 40 + 2200 * E.in(clamp(pt / 0.45));
      const vb=o.viewBounds?.()||{x:-60,y:-60,width:DESIGN.w+120,height:DESIGN.h+120};dim.clear().rect(vb.x,vb.y,vb.width,vb.height).fill(0x1a0826);dim.alpha=inA*(phase==='exit'?1-clamp(pt/.45):1);
      sunSpin += dt * (phase === 'gag' ? 40 : 7); sun.rotation = sunSpin * Math.PI / 180;
      const sunA = plain ? 0 : phase === 'exit' ? Math.max(0, 0.3 * (1 - pt / 0.3)) : 0.3 * E.out(clamp((age - 0.05) / 0.5)); sun.alpha = sunA; sun.scale.set((0.6 + 1.2 * E.back(clamp((age - 0.05) / 0.6))) * (1 + 0.04 * Math.sin(age * 2.1)));
      if (fountain && phase === 'exit') fountain.alpha = Math.max(0, 1 - pt / 0.3);
      if (phase === 'exit' && counter.c.visible && pt > 0.05) { counter.s.t = 0; counter.s.k = 900; if (counter.c.scale.x < 0.05) counter.c.visible = false; }
      for (let i = sparks.length - 1; i >= 0; i--) { const p = sparks[i]; p.age += dt; const k = p.age / p.life; if (k >= 1) { p.s.destroy(); sparks.splice(i, 1); continue; }
        p.vx *= 1 - 3 * dt; p.vy = p.vy * (1 - 3 * dt) + 500 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.s.position.set(p.x, p.y); p.s.rotation += dt * 3;
        if (p.flip) { p.s.texture = p.fr[Math.min(p.fr.length - 1, Math.floor(k * p.fr.length))]; p.s.scale.set(p.sc); } else { p.s.texture = p.fr[Math.floor(p.age * 24) % p.fr.length]; p.s.scale.set(p.sc * (1 - k * 0.7)); p.s.alpha = 1 - k * k; } }
      // camera nudge on impacts (decays in 0.32 s)
      if (shakeT > 0) { shakeT = Math.max(0, shakeT - dt); const a = shakeA * (shakeT / 0.32) ** 2, dx = Math.sin(age * 91) * a, dy = Math.cos(age * 77) * a * 0.7; C.position.set(dx, dy); if (o.camera) o.camera.position.set(cam0.x + dx * 0.5, cam0.y + dy * 0.5); }
      else if (C.x || C.y) { C.position.set(0, 0); if (o.camera) o.camera.position.set(cam0.x, cam0.y); }
    };
    let off,finished=false;
    const finish = () => {if(finished)return;finished=true;off?.();o.onCancelReady?.(null);if(o.camera)o.camera.position.set(cam0.x,cam0.y);C.destroy({children:true});counter.frames?.forEach(t=>t.destroy(false));done();};
    o.onCancelReady?.(finish);
    let last=o.clock.now;
    off=o.clock.onTick((dt,now)=>{let left=Math.max(0,now-last);last=now;
     // Substeps keep the source springs stable while phase time follows visible elapsed time.
     while(left>0&&!finished){const ms=Math.min(left,1000/120);step(ms);left-=ms;}
    });
  });
}
