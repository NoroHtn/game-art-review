// House values for Diamond Princess. Every timing cites the knowledge pack:
// docs/GDD-spin-and-bonus.md §2–§7 and reference/4pots-game-config.json.
export const DESIGN = { w: 1920, h: 1080 };

export const GRID = { cols: 5, rows: 3, cell: 168, gap: 8, x: 524, y: 372 }; // reel window top-left in design px

export const LINES = [[2,2,2,2,2],[1,1,1,1,1],[3,3,3,3,3],[1,2,3,2,1],[3,2,1,2,3],[2,1,1,1,2],[2,3,3,3,2],[1,1,2,3,3],[3,3,2,1,1],[2,3,2,1,2],
  [2,1,2,3,2],[1,2,2,2,1],[3,2,2,2,3],[1,2,1,2,1],[3,2,3,2,3],[2,2,1,2,2],[2,2,3,2,2],[1,1,3,1,1],[3,3,1,3,3],[1,3,3,3,1],
  [3,1,1,1,3],[2,3,1,3,2],[2,1,3,1,2],[1,3,1,3,1],[3,1,3,1,3]]; // 25 fixed lines, row 1 = top

// id → art key, pays (× total bet for 5/4/3 of a kind). Pays mirror the reference ladder; the real math is the RGS's job.
export const SYMBOLS = {
  1: { key: 'sym-low-j-emerald', label: 'J', color: 0x36d6a8, pay: [2, 0.4, 0.2] },
  2: { key: 'sym-low-q-amethyst', label: 'Q', color: 0xa45cff, pay: [2, 0.4, 0.2] },
  3: { key: 'sym-low-k-sapphire', label: 'K', color: 0x3fa0ff, pay: [2, 0.4, 0.2] },
  4: { key: 'sym-low-a-ruby', label: 'A', color: 0xff3b5c, pay: [2, 0.4, 0.2] },
  5: { key: 'sym-perfume', label: '♥', color: 0xff8fc4, pay: [4, 1, 0.3] },
  6: { key: 'sym-magic-wand', label: '★', color: 0xffc94a, pay: [6, 1.5, 0.4] },
  7: { key: 'sym-glass-slipper', label: '◆', color: 0x9fd8ff, pay: [8, 2, 0.5] },
  8: { key: 'sym-tiara', label: '♛', color: 0xffc94a, pay: [10, 3, 0.6] },
  9: { key: 'sym-wild-princess-v2', // the layered rig's own composite, so idle sprite and Spine rig match pixel for pixel
        label: 'WILD', color: 0xff5fa2, wild: true },
  10: { key: 'gem-ruby-star', label: 'R', color: 0xff3b5c, gem: 'mystery' },
  11: { key: 'gem-amethyst-heart', label: 'M', color: 0xff3f8e, gem: 'multi' }, // rubellite (2026-10-22): no longer the violet of the Q
  12: { key: 'gem-sapphire-drop', label: 'C', color: 0x3fa0ff, gem: 'collect' },
  13: { key: 'gem-rainbow-star-diamond', label: '✦', color: 0xffffff, gem: 'royal' },
  14: { key: 'coin-diamond', label: '', color: 0xffc94a, coin: true },
  // tall WILD block parts (2 and 3 cells), composed at runtime by wild-tall.js — keys only give the loader something to fetch
  15: { key: 'sym-wild-princess-v2', wild: true, tall: true }, 16: { key: 'sym-wild-princess-v2', wild: true, tall: true },
  17: { key: 'sym-wild-princess-v2', wild: true, tall: true }, 18: { key: 'sym-wild-princess-v2', wild: true, tall: true }, 19: { key: 'sym-wild-princess-v2', wild: true, tall: true },
};

// Reduced motion (OS setting, or ?reduced=1 for QA): symbols keep their calm idle loops but never accent, kick on landing or celebrate; a win is
// shown by the lit cell frames, the line and the plaque alone. The outcome and amounts are the controller's and never change
export const REDUCED = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches || /[?&]reduced=1\b/.test(globalThis.location?.search ?? '');
export const SPEED = { // GDD §2, three modes
  normal: { kick: 120, stagger: 70, stopGap: 173, bounce: 0.2, settle: 250, accel: 200, minSpin: 600, lineCycle: 2000, cellGap: 220, teaseGap: 1500, flyGap: 400, fly: 700 },
  quick:  { kick: 80,  stagger: 40, stopGap: 0,   bounce: 0.15, settle: 188, accel: 200, minSpin: 300, lineCycle: 2000, cellGap: 110, teaseGap: 750,  flyGap: 250, fly: 450 },
  turbo:  { kick: 0,   stagger: 0,  stopGap: 0,   bounce: 0.1, settle: 100, accel: 100, minSpin: 120, lineCycle: 0,    cellGap: 0,   teaseGap: 0,    flyGap: 120, fly: 300 },
};
export const CRUISE = 65 / 150 / 16.67; // cells per ms (measured 65 px/frame at a 150 px cell)

export const WIN = { dimTint: 0xc4b4d8, dimAlpha: 0.72, /* losers recede into the pale window (muted lilac, partly see-through, still legible), never toward black: the winners stay the brightest, highest-contrast pixels (arena F2) */ dimMs: 220, restoreMs: 200, popMs: 250, popScale: 1.12, hopMs: 180, glowAlpha: 0.47, pulseScale: 1.09, countTick: 75, skipLock: 800, tiers: { big: 15, super: 30, mega: 50, epic: 100 } };

export const BET_LADDER = [20, 40, 60, 80, 100, 120, 140, 160, 200, 400, 600, 800, 1000, 1500, 2000, 4000, 5000]; // minor units

export const JACKPOTS = [ // × bet
  { id: 'royal', label: 'ROYAL', mult: 10000, color: 0xb98cff },
  { id: 'grand', label: 'GRAND', mult: 3000, color: 0xff5fa2 },
  { id: 'major', label: 'MAJOR', mult: 100, color: 0xffc94a },
  { id: 'minor', label: 'MINOR', mult: 30, color: 0x3fa0ff },
  { id: 'mini', label: 'MINI', mult: 15, color: 0x36d6a8 },
];

export const PALETTE = { pink: 0xff5fa2, lilac: 0xb98cff, cream: 0xfff1f6, gold: 0xffc94a, goldDeep: 0xc98a12, ink: 0x4b1f4f, white: 0xffffff, night: 0x2a1240 };
