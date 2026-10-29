// PixiJS 8 adapter of Edgar main 9afbbfc, game/logo-type.js. Source lettering is preserved.
// Logo-style lettering: every big-win word, win popup and win number is set in the logo's own crystal lettering
// (art/type/logo-type.png + .json, cut by art/type/type_kit.py from a Codex edit of the logo). Glyphs missing from the atlas
// are drawn once, at atlas size, in the closest web font to the logo (Yeseva One) with the same crystal fill, gold rim and
// plum outline, and cached, so nothing re-rasterises per frame.
//   logoText(str, size, opts) -> PIXI.Container with a `.text` setter (same call shape as T()/PIXI.Text)
//     size: font size in px like PIXI.Text (cap height = 0.7 × size). opts: { tabular = true, tracking = 0 (px at size),
//     anchor = 0.5 | {x, y} (y 0.5 = middle of the caps), tint }
//   logoGlyph(ch) -> { texture, w, h, top, adv, cap } in atlas px (top is relative to the baseline), for per-letter rigs
//   LOGO_FONT -> PIXI.TextStyle fields for small UI text in the logo's family
const ATLAS = new URL('./assets/edgar/logo-type.png', import.meta.url).href;
const METRICS = new URL('./assets/edgar/logo-type.json', import.meta.url).href;
export const LOGO_FAMILY = '"Yeseva One", Georgia, "Times New Roman", serif';
const CAP_EM = 0.7; // cap height / font size: the same ratio the fallback font has, so atlas and fallback glyphs line up
const INK = '#52011f', GOLD = ['#fff3b0', '#ffc94a', '#c98a12'], CRYSTAL = ['#ffffff', '#d9c8ff', '#aedcff', '#e4d2ff', '#f4f0ff'];

export const LOGO_FONT = { // small UI text: the logo family, crystal fill, plum outline (PIXI.Text has one stroke; the rim is the atlas's job)
  fontFamily: LOGO_FAMILY, fontWeight: '400', fill: [0xffffff, 0xe9dcff, 0xbfe3ff], fillGradientStops: [0, 0.55, 1],
  stroke: 0x52011f, strokeThickness: 6, lineJoin: 'round', letterSpacing: 1,
};

function withTimeout(p, ms) { return Promise.race([p, new Promise((r) => setTimeout(() => r(null), ms))]); }

async function loadFont() {
  if (!document.querySelector('link[data-logo-font]')) {
    const l = document.createElement('link'); l.rel = 'stylesheet'; l.dataset.logoFont = '1';
    l.href = 'https://fonts.googleapis.com/css2?family=Yeseva+One&display=swap';
    const css = new Promise((r) => { l.onload = l.onerror = r; }); document.head.appendChild(l);
    await withTimeout(css, 4000); // fonts.load() resolves empty until the @font-face rules exist
  }
  await withTimeout(document.fonts.load('400 64px "Yeseva One"').catch(() => null), 4000);
}

async function loadAtlas() {
  try {
    const res = await fetch(METRICS); if (!res.ok) return null;
    const m = await res.json();
    const base = await withTimeout(PIXI.Assets.load(ATLAS).catch(() => null), 6000); if (!base) return null;
    const glyphs = {};
    for (const [ch, g] of Object.entries(m.glyphs)) {
      glyphs[ch] = { texture: new PIXI.Texture({source:base.source,frame:new PIXI.Rectangle(g.x,g.y,g.w,g.h)}), w: g.w, h: g.h, top: g.top, adv: g.adv };
    }
    return { ...m, glyphs };
  } catch { return null; }
}

const atlas = await loadAtlas();
const CAP = atlas?.cap ?? 128, OVERLAP = atlas?.overlap ?? Math.round(CAP * 0.07);
const GLYPHS = atlas?.glyphs ?? {}, KERN = atlas?.kern ?? {}, SPACE = atlas?.space ?? Math.round(CAP * 0.34);
let tabular = atlas?.tabular ?? null; // the web-font fallback gets its own digit cell, measured on first use
const digitCell = () => tabular ?? (tabular = Math.max(...[...'0123456789'].map((d) => logoGlyph(d).adv)));

function fallbackGlyph(ch) { // drawn once per character at atlas size, then cached in GLYPHS
  const fs = CAP / CAP_EM, out = Math.round(CAP * 0.06), rim = Math.round(CAP * 0.07), pad = out + 4;
  const font = `400 ${fs}px ${LOGO_FAMILY}`, c = document.createElement('canvas'), g = c.getContext('2d');
  g.font = font; const mt = g.measureText(ch);
  const asc = Math.ceil(mt.actualBoundingBoxAscent), desc = Math.ceil(mt.actualBoundingBoxDescent);
  const l = Math.ceil(mt.actualBoundingBoxLeft), r = Math.ceil(mt.actualBoundingBoxRight);
  c.width = Math.max(1, l + r + pad * 2); c.height = Math.max(1, asc + desc + pad * 2);
  const x = pad + l, y = pad + asc;
  g.font = font; g.lineJoin = 'round'; g.miterLimit = 2;
  g.lineWidth = (out + rim) * 2; g.strokeStyle = INK; g.strokeText(ch, x, y); // plum outline outside the gold
  const gold = g.createLinearGradient(0, y - asc - out, 0, y + desc + out); GOLD.forEach((col, i) => gold.addColorStop(i / (GOLD.length - 1), col));
  g.lineWidth = rim * 2; g.strokeStyle = gold; g.strokeText(ch, x, y); // gold bevel rim
  const body = document.createElement('canvas'); body.width = c.width; body.height = c.height; const b = body.getContext('2d');
  b.font = font; const cr = b.createLinearGradient(x - l, y - asc, x + r, y + desc); CRYSTAL.forEach((col, i) => cr.addColorStop(i / (CRYSTAL.length - 1), col));
  b.fillStyle = cr; b.fillText(ch, x, y);
  b.globalCompositeOperation = 'source-atop'; // facets: a fixed triangle lattice, each cut a little lighter or bluer, like cut stone
  const f = CAP * 0.2, tints = ['rgba(255,255,255,0.55)', 'rgba(150,170,255,0.28)', 'rgba(200,160,255,0.3)', 'rgba(255,255,255,0.15)', 'rgba(120,200,255,0.25)'];
  for (let j = -1, n = ch.charCodeAt(0); j * f < c.height; j++) for (let i = -1; i * f < c.width + f; i++) for (const up of [0, 1]) {
    const x0 = i * f + (j % 2) * f / 2, y0 = j * f; b.beginPath();
    if (up) { b.moveTo(x0, y0 + f); b.lineTo(x0 + f / 2, y0); b.lineTo(x0 + f, y0 + f); } else { b.moveTo(x0 + f / 2, y0); b.lineTo(x0 + f * 1.5, y0); b.lineTo(x0 + f, y0 + f); }
    b.closePath(); b.fillStyle = tints[(i * 7 + j * 13 + up * 3 + n) % tints.length]; b.fill();
  }
  const top = b.createLinearGradient(0, y - asc, 0, y); top.addColorStop(0, 'rgba(255,255,255,0.55)'); top.addColorStop(0.5, 'rgba(255,255,255,0)'); // the top light
  b.fillStyle = top; b.fillRect(0, 0, c.width, c.height);
  g.drawImage(body, 0, 0);
  const t = PIXI.Texture.from(c);
  return (GLYPHS[ch] = { texture: t, w: c.width, h: c.height, top: -y, adv: c.width - pad * 2 + out * 2 - OVERLAP, fallback: true });
}

export function logoGlyph(ch) {
  const g = GLYPHS[ch] ?? fallbackGlyph(ch);
  return { ...g, cap: CAP };
}

export function logoText(str = '', size = 48, opts = {}) {
  const { tabular = true, tracking = 0 } = opts; let tint = opts.tint ?? 0xffffff;
  const an = typeof opts.anchor === 'object' ? { ...opts.anchor } : { x: opts.anchor ?? 0.5, y: opts.anchor ?? 0.5 };
  const k = (size * CAP_EM) / CAP, c = new PIXI.Container(), body = c.addChild(new PIXI.Container()), pool = [];
  body.scale.set(k);
  let cur = null;
  const layout = (v) => {
    const items = []; let x = 0, prev = null;
    for (const ch of v.replace(/x(?=\d)|(?<=\d)x/g, '×')) { // "x5" is set as the multiplication cross
      if (ch === ' ') { x += SPACE + tracking / k; prev = null; continue; }
      const g = logoGlyph(ch);
      if (prev) x += KERN[prev + ch] ?? 0;
      const adv = tabular && ch >= '0' && ch <= '9' && (!g.fallback || !atlas?.tabular) ? digitCell() : g.adv;
      items.push({ g, x: x + (adv - g.adv) / 2 }); x += adv + tracking / k; prev = ch;
    }
    return { items, w: Math.max(0, x - tracking / k) + OVERLAP };
  };
  Object.defineProperty(c, 'text', { get: () => cur, set(v) {
    v = String(v ?? ''); if (v === cur) return; cur = v;
    const { items, w } = layout(v);
    while (pool.length < items.length) pool.push(new PIXI.Sprite());
    body.removeChildren();
    for (let i = items.length - 1; i >= 0; i--) { // right to left: each left neighbour's rim lands on top, as in the logo
      const { g, x } = items[i], s = pool[i];
      s.texture = g.texture; s.position.set(x, g.top); s.tint = tint; body.addChild(s);
    }
    c._w = w; place();
  } });
  const place = () => body.position.set(-an.x * c._w * k, CAP * k * (1 - an.y)); // anchor y: 0 = cap top, 0.5 = cap middle, 1 = baseline
  c.anchor = { get x() { return an.x; }, get y() { return an.y; }, set(x, y = x) { an.x = x; an.y = y; place(); } }; // PIXI.Text-style anchor.set()
  Object.defineProperty(c, 'tint', { get: () => tint, set(v) { tint = v; body.children.forEach((s) => { s.tint = v; }); } }); // replaces style.fill swaps
  c.text = String(str);
  return c;
}
