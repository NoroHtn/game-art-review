// Halloween demo rules: Wild is always open across all three rows.
// Forked presentation-specific demo adapter; the original mock-server.js is unchanged.
// Demo-only stand-in for the RGS. The client never decides an outcome: it animates whatever this returns.
// Shape mirrors the reference protocol, translated to JSON (GDD §1, audit §2).
import { LINES, SYMBOLS } from './config.js';

const W = { 1: 14, 2: 14, 3: 13, 4: 13, 5: 9, 6: 8, 7: 7, 8: 6, 9: 4, 10: 1.2, 11: 1.2, 12: 1.2, 13: 0.4, 14: 3 };
const COIN_VALUES = [1, 1, 1, 2, 2, 3, 4, 5, 6, 8, 10, 12];
const pick = (col) => {
  const ids = Object.keys(W).map(Number).filter((id) => !(id === 9 && col === 0)); // wild on reels 2–5 only
  const tot = ids.reduce((s, id) => s + W[id], 0); let r = Math.random() * tot;
  for (const id of ids) { r -= W[id]; if (r <= 0) return id; } return 1;
};

function evaluate(grid, bet) {
  const wins = []; grid = grid.map((col) => col.map((id) => (id >= 15 && id <= 19 ? 9 : id))); // tall-WILD parts are wild
  LINES.forEach((ln, li) => {
    const ids = ln.map((row, c) => grid[c][row - 1]);
    let target = ids.find((id) => id !== 9);
    if (target === undefined) target = 8;
    if (!(target >= 1 && target <= 8)) return;
    let n = 0; while (n < 5 && (ids[n] === target || ids[n] === 9)) n++;
    if (n < 3) return;
    wins.push({ line: li + 1, symbol: target, count: n, amount: Math.round(bet * SYMBOLS[target].pay[5 - n]) });
  });
  return wins;
}

// Bonus coins: value in × bet, or a jackpot (GDD §5, rules §3). Grand pays when all 15 cells are full.
function bonusCoin(bet) {
  const r = Math.random();
  if (r < 0.004) return { jp: 'MAJOR', value: 100 * bet };
  if (r < 0.02) return { jp: 'MINOR', value: 30 * bet };
  if (r < 0.05) return { jp: 'MINI', value: 15 * bet };
  return { value: COIN_VALUES[Math.floor(Math.random() * COIN_VALUES.length)] * bet };
}

export function createServer({ balance = 100000 } = {}) {
  let bal = balance, round = 0, bonus = null;
  const pots = { multi: 0, collect: 0, mystery: 0 }; // reference: progress_level 0–9 per pot, persisted across spins
  const GEM_POT = { 11: ['multi'], 12: ['collect'], 10: ['mystery'], 13: ['multi', 'collect', 'mystery'] };
  const wait = () => new Promise((r) => setTimeout(r, 220 + Math.random() * 160));
  return {
    get balance() { return bal; },
    async buyBonus(bet, mult = 70) { // one request per step, as in the reference protocol
      await wait();
      const cost = bet * mult; if (cost > bal) throw new Error('INSUFFICIENT_FUNDS');
      bal -= cost; round++;
      const board = {}; const cells = [...Array(15).keys()].sort(() => Math.random() - 0.5).slice(0, 6);
      cells.forEach((p) => { board[p] = bonusCoin(bet); });
      bonus = { bet, board, respins: 3 };
      return { round, cost, board: { ...board }, respins: 3, balance: bal };
    },
    async respin() {
      await wait();
      const b = bonus, empty = [...Array(15).keys()].filter((p) => !b.board[p]), landed = {};
      const p = empty.length > 6 ? 0.1 : empty.length > 3 ? 0.13 : 0.16;
      empty.forEach((pos) => { if (Math.random() < p) landed[pos] = bonusCoin(b.bet); });
      Object.assign(b.board, landed);
      b.respins = Object.keys(landed).length ? 3 : b.respins - 1;
      const full = Object.keys(b.board).length === 15, done = full || b.respins === 0;
      let total = 0, grand = 0;
      if (done) { total = Object.values(b.board).reduce((s, c) => s + c.value, 0); if (full) { grand = 3000 * b.bet; total += grand; } bal += total; bonus = null; }
      return { landed, respins: b.respins, board: { ...b.board }, done, total, grand, balance: bal };
    },
    async spin(bet, { force } = {}) {
      await new Promise((r) => setTimeout(r, 220 + Math.random() * 160)); // round trip ≈300 ms (measured median)
      if (bet > bal) throw new Error('INSUFFICIENT_FUNDS');
      bal -= bet; round++;
      const grid = force ? force.map((c) => c.slice()) : Array.from({ length: 5 }, (_, c) => Array.from({ length: 3 }, () => pick(c)));
      // Resolve the open Wild before coins, gems and line evaluation. A rendered
      // full-height Wild must substitute on exactly the same three server rows.
      grid.forEach((col, c) => {
        if (c > 0 && col.some(id => id === 9 || (id >= 15 && id <= 19))) {
          col.splice(0, 3, 17, 18, 19);
        }
      });
      const coins = {}; grid.forEach((col, c) => col.forEach((id, r) => { if (id === 14) coins[c * 3 + r] = COIN_VALUES[Math.floor(Math.random() * COIN_VALUES.length)] * bet; }));
      const wins = evaluate(grid, bet), total = wins.reduce((s, w) => s + w.amount, 0);
      bal += total;
      const gems = []; grid.forEach((col, c) => col.forEach((id, r) => (GEM_POT[id] || []).forEach((pot) => { pots[pot] = Math.min(9, pots[pot] + 1); gems.push({ cell: c * 3 + r, id, pot, level: pots[pot] }); })));
      let trigger = null; const cs = Object.keys(coins);
      if (cs.length >= 6) { const board = {}; cs.forEach((k) => { const c = Math.floor(k / 3), r = k % 3; board[r * 5 + c] = { value: coins[k] }; }); bonus = { bet, board: { ...board }, respins: 3 }; trigger = { board, respins: 3, balance: bal }; }
      return { round, bet, grid, coins, wins, total, balance: bal, gems, pots: { ...pots }, trigger };
    },
  };
}
