// The active Halloween scene graph. All game artwork is drawn by PixiJS;
// the surrounding HTML supplies layout anchors and accessible controls only.
import { LINES } from '../game/config.js';
import { ApprovedSmokeRig } from './approved-smoke.js?v=plumes-r31-20261028';

const POT_NAMES = ['multi', 'collect', 'mystery', 'super'];
const FRONT_POT_SCALE = 1.3;
const POT_SIDE_OVERSCAN = 6;
const TALL = {15: [2, 0], 16: [2, 1], 17: [3, 0], 18: [3, 1], 19: [3, 2]};
const copy = value => JSON.parse(JSON.stringify(value));
const round = n => Math.round(n * 1000) / 1000;

export async function createScene(options) {
  const scene = new HalloweenScene(options);
  try {
    await scene.init();
    return scene;
  } catch (error) {
    scene.destroy();
    throw error;
  }
}

export class HalloweenScene {
  constructor({mount, boardAnchor, potsAnchor, url, fmt, artResolver, onError, onContextChange} = {}) {
    if (!mount || !boardAnchor || !potsAnchor || !url || !artResolver) {
      throw new Error('PIXI_SCENE_REQUIRES_LAYOUT_ANCHORS_AND_ART_RESOLVER');
    }
    this.PIXI = globalThis.PIXI;
    if (!this.PIXI?.Application) throw new Error('LOCAL_PIXI_RUNTIME_NOT_LOADED');
    Object.assign(this, {mount, boardAnchor, potsAnchor, url, artResolver, onError, onContextChange});
    this.fmt = fmt || (value => (value / 100).toFixed(2));
    this.textures = new Map();
    this.textureURLs = new Map();
    this.sourceTextures = new Map();
    this.ownedTextures = new Set();
    this.listeners = new Set();
    this.layers = {};
    this.cells = [];
    this.cellViews = this.cells;
    this.geometry = {board: {x: 0, y: 0, width: 0, height: 0}, cellW: 0, cellH: 0, gap: 0, rowGap: 0, pitch: 0};
    this.pots = {};
    this.potViews = this.pots;
    this.potLevels = {multi: 0, collect: 0, mystery: 0};
    this.bonus = false;
    this.ready = false;
    this.destroyed = false;
    this.grid = null;
    this.coins = {};
    this.focusWins = [];
    this.neutralFocus = false;
    this.resizeFrame = null;
  }

  async init() {
    const {Application, Container, Graphics, Assets, Sprite, Texture} = this.PIXI;
    this.app = new Application();
    this.resolution = Math.min(2, Math.max(1, window.devicePixelRatio || 1));
    await this.app.init({
      width: Math.max(1, this.mount.clientWidth), height: Math.max(1, this.mount.clientHeight),
      preference: 'webgl', preferWebGLVersion: 2, antialias: true,
      backgroundAlpha: 0, resolution: this.resolution, autoDensity: true,
      autoStart: false, sharedTicker: false,
    });
    this.host = document.createElement('div');
    this.host.className = 'pixi-stage';
    this.host.setAttribute('aria-hidden', 'true');
    this.backend = String(this.app.renderer.name || this.app.renderer.constructor.name).toLowerCase().replace(/renderer$/, '');
    this.app.canvas.dataset.renderer = `pixi-${this.backend}`;
    this.app.canvas.dataset.pixiVersion = this.PIXI.VERSION;
    this.app.canvas.setAttribute('aria-hidden', 'true');
    this.app.canvas.tabIndex = -1;
    this.host.append(this.app.canvas);
    this.mount.prepend(this.host);
    this.mount.classList.add('pixi-game');
    this.root = this.app.stage;
    this.root.label = 'Halloween';
    this.root.eventMode = 'none';
    for (const name of ['background', 'board', 'cells', 'reels', 'pots', 'lines', 'effects']) {
      const layer = new Container();
      layer.label = name;
      layer.eventMode = 'none';
      this.layers[name] = layer;
    }
    this.boardContainer = new Container();
    this.boardContainer.label = 'board-scene';
    this.boardContainer.eventMode = 'none';
    this.boardContainer.addChild(this.layers.board, this.layers.cells, this.layers.reels, this.layers.lines);
    this.root.addChild(this.layers.background, this.boardContainer, this.layers.pots, this.layers.effects);
    this.columnsLayer = this.layers.reels;
    this.effectsLayer = this.layers.effects;
    const sources = new Set();
    for (let id = 1; id <= 19; id++) {
      const art = this.artResolver(id);
      const src = typeof art === 'string' ? art : art.src;
      this.textureURLs.set(id, src);
      sources.add(src);
    }
    for (const name of POT_NAMES) for (let level = 0; level < 3; level++) sources.add(this.url(`cauldron_${name}_${level}`));
    for (const name of ['bg_base', 'bg_bonus']) sources.add(this.url(name));
    await Promise.all([...sources].map(async src => {
      const texture = await Assets.load(src);
      if (!(texture instanceof Texture)) throw new Error(`PIXI_TEXTURE_FAILED: ${src}`);
      this.sourceTextures.set(src, texture);
    }));
    for (const [id, src] of this.textureURLs) this.textures.set(id, this.sourceTextures.get(src));
    this.backgroundSprite = new Sprite(this.texture(this.url('bg_base')));
    this.backgroundSprite.label = 'approved-background';
    this.backgroundShade = new Sprite(this.makeGradientTexture('page'));
    this.layers.background.addChild(this.backgroundSprite, this.backgroundShade);
    this.frame = new Graphics();
    this.frame.label = 'reel-frame';
    this.layers.board.addChild(this.frame);
    this.boardMask = new Graphics();
    this.boardMask.label = 'reel-board-mask';
    this.boardContainer.addChild(this.boardMask);
    this.layers.reels.mask = this.boardMask;
    this.cellTexture = this.makeGradientTexture('cell');
    this.tallTexture = this.makeGradientTexture('tall');
    this.lockedTexture = this.makeGradientTexture('locked');
    for (let index = 0; index < 15; index++) {
      const container = new Container(), background = new Sprite(this.cellTexture), content = new Container();
      const highlight = new Graphics(), mask = new Graphics();
      container.label = `cell-${index}`;
      content.label = `symbol-${index}`;
      mask.label = `cell-mask-${index}`;
      container.addChild(background, content, highlight, mask);
      background.mask = mask;
      content.mask = mask;
      this.layers.cells.addChild(container);
      this.cells.push({index, col: index % 5, row: Math.floor(index / 5), container, background, content,
        highlight, mask, sprite: null, label: null, symbol: null, id: null, value: undefined,
        x: 0, y: 0, width: 0, height: 0, span: 1, locked: false, covered: false,
        state: {dim: false, winner: false, neutral: false, spent: false}});
    }
    // Rear vessel first, then the front trio, preserving the approved composition.
    for (const name of ['super', 'multi', 'collect', 'mystery']) {
      const container = new Container(), motionBody = new Container(), effectsContainer = new Container();
      const sprite = new Sprite(this.texture(this.url(`cauldron_${name}_0`)));
      container.label = `cauldron-${name}`;
      motionBody.label = `cauldron-${name}-motion`;
      effectsContainer.label = `cauldron-${name}-effects`;
      sprite.anchor.set(.5);
      motionBody.addChild(sprite);
      container.addChild(motionBody, effectsContainer);
      this.layers.pots.addChild(container);
      this.pots[name] = {name, container, motionBody, animationContainer: motionBody,
        effectsContainer, fx: effectsContainer, sprite, level: 0, base: {}, baseScale: 1,
        enlargement: name === 'super' ? 1 : FRONT_POT_SCALE, x: 0, y: 0, width: 0, height: 0};
      this.pots[name].smokeRig = new ApprovedSmokeRig({PIXI: this.PIXI, view: this.pots[name], texture: sprite.texture});
    }
    this.lineGraphics = new Graphics();
    this.lineGraphics.label = 'winning-paylines';
    this.layers.lines.addChild(this.lineGraphics);
    this.contextLost = false;
    this.lostHandler = event => {
      event.preventDefault();
      this.contextLost = true;
      this.app.stop();
      this.onContextChange?.(false);
      const error = new Error('WEBGL_CONTEXT_LOST');
      error.recoverable = true;
      this.onError?.(error);
    };
    this.restoredHandler = () => {
      this.contextLost = false;
      this.resize();
      this.app.start();
      this.onContextChange?.(true);
      this.mount.dispatchEvent(new CustomEvent('pixi:context-restored'));
    };
    this.app.canvas.addEventListener('webglcontextlost', this.lostHandler);
    this.app.canvas.addEventListener('webglcontextrestored', this.restoredHandler);
    this.queueResize = () => {
      if (this.resizeFrame !== null || this.destroyed) return;
      this.resizeFrame = requestAnimationFrame(() => {this.resizeFrame = null; this.resize();});
    };
    this.observer = new ResizeObserver(this.queueResize);
    for (const anchor of [this.mount, this.boardAnchor, this.potsAnchor]) this.observer.observe(anchor);
    window.addEventListener('resize', this.queueResize);
    window.visualViewport?.addEventListener('resize', this.queueResize);
    this.ready = true;
    this.resize();
    return this;
  }

  makeGradientTexture(kind) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = kind === 'page' ? 256 : 96;
    const ctx = canvas.getContext('2d');
    let gradient;
    if (kind === 'page') {
      gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
      gradient.addColorStop(0, '#08051c25'); gradient.addColorStop(1, '#0b051ec9');
    } else {
      gradient = ctx.createRadialGradient(48, 36, 2, 48, 36, 74);
      const colors = kind === 'locked' ? ['#70502b60', '#251332'] : kind === 'tall' ? ['#482358', '#1c1031'] : ['#37204b90', '#180f2bd9'];
      gradient.addColorStop(0, colors[0]); gradient.addColorStop(1, colors[1]);
    }
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, canvas.width, canvas.height);
    const texture = this.PIXI.Texture.from(canvas);
    this.ownedTextures.add(texture);
    return texture;
  }

  texture(srcOrId) {
    if (typeof srcOrId === 'number') return this.textures.get(srcOrId) || this.textures.get(1);
    if (this.sourceTextures.has(srcOrId)) return this.sourceTextures.get(srcOrId);
    const src = this.url(srcOrId);
    return this.sourceTextures.get(src) || this.PIXI.Texture.EMPTY;
  }

  createSymbol(id, value, {width = this.geometry.cellW, height = this.geometry.cellH, piece} = {}) {
    const {Container, Sprite, Text, Graphics} = this.PIXI;
    const box = new Container();
    const tall = TALL[id];
    const isPiece = !!tall && piece !== false;
    const span = isPiece ? tall[0] : 1;
    const index = isPiece ? tall[1] : 0;
    const totalHeight = isPiece ? span * height + (span - 1) * this.geometry.rowGap : height;
    const sprite = new Sprite(this.texture(id));
    sprite.anchor.set(.5);
    const share = id <= 4 ? .8 : id === 9 || tall ? 1 : .9;
    const scale = Math.min(width * share / sprite.texture.width, totalHeight * share / sprite.texture.height);
    sprite.scale.set(scale);
    sprite.position.set(width / 2, totalHeight / 2 - index * (height + this.geometry.rowGap));
    sprite.label = `approved-symbol-${id}`;
    box.addChild(sprite);
    box.sprite = sprite;
    box.label = `symbol-view-${id}`;
    box.amountLabel = null;
    box.symbolId = id;
    box.coinValue = value;
    box.symbolWidth = width;
    box.symbolHeight = height;
    box.symbolSpan = isPiece ? tall[0] : 1;
    if (isPiece) {
      const mask = new Graphics().rect(0, 0, width, height + this.geometry.rowGap).fill(0xffffff);
      box.addChild(mask); box.mask = mask; box.pieceMask = mask;
    }
    if (value !== undefined && value !== null) {
      const text = typeof value === 'string' ? value : this.fmt(value);
      const label = new Text({text, style: {
        fontFamily: 'Georgia, Times New Roman, serif', fontWeight: 'bold',
        fontSize: Math.max(12, Math.min(height * .3, width / Math.max(1, text.length * .65))),
        fill: 0x4f2303, stroke: {color: 0xfff7bb, width: .7},
        align: 'center', padding: 2,
      }});
      label.anchor.set(.5);
      label.position.set(width / 2, height / 2);
      label.label = 'coin-value';
      box.addChild(label); box.amountLabel = label;
    }
    return box;
  }

  setCell(index, id, value, {locked = false, tall = 1} = {}) {
    const cell = this.cells[index];
    if (!cell) throw new Error(`INVALID_PIXI_CELL: ${index}`);
    this.clearCell(index);
    cell.id = id; cell.value = value; cell.span = tall; cell.locked = locked; cell.covered = false;
    cell.height = tall * this.geometry.cellH + (tall - 1) * this.geometry.rowGap;
    if (id !== null && id !== undefined) {
      const symbol = this.createSymbol(id, value, {width: cell.width, height: cell.height, piece: false});
      cell.content.addChild(symbol);
      cell.symbol = symbol; cell.sprite = symbol.sprite; cell.label = symbol.amountLabel;
    }
    this.layoutCell(cell);
    return cell;
  }

  clearCell(index) {
    const cell = this.cells[index];
    if (!cell) return;
    for (const node of cell.content.removeChildren()) this.destroyNode(node);
    cell.sprite = null; cell.label = null; cell.symbol = null; cell.id = null; cell.value = undefined;
    cell.span = 1; cell.locked = false; cell.covered = false;
    cell.content.visible = true; cell.container.visible = true;
    cell.content.position.set(0); cell.content.scale.set(1); cell.content.alpha = 1;
    cell.container.alpha = 1;
    cell.state = {dim: false, winner: false, neutral: false, spent: false};
  }

  resetCells() {
    this.focusWins = [];
    this.lineGraphics?.clear();
    for (const cell of this.cells) {
      this.clearCell(cell.index);
      this.layoutCell(cell);
    }
  }

  normalize() {
    this.clearFocus();
    for (const cell of this.cells) {
      cell.span = 1; cell.covered = false; cell.locked = false;
      cell.content.visible = true;
      cell.container.visible = true;
      cell.content.position.set(0);
      cell.content.scale.set(1);
      this.layoutCell(cell);
    }
  }
  getCell(index) { return this.cells[index]; }
  setCellVisible(index, visible) { if (this.cells[index]) this.cells[index].content.visible = visible; }

  renderGrid(grid, coins = {}) {
    this.grid = grid.map(column => column.slice()); this.coins = {...coins}; this.bonusBoard = null;
    this.resetCells();
    for (let row = 0; row < 3; row++) for (let col = 0; col < 5; col++) {
      const index = row * 5 + col;
      this.setCell(index, grid[col][row], coins[col * 3 + row]);
    }
    for (let col = 0; col < 5; col++) for (let row = 0; row < 3; row++) {
      const span = grid[col][row] === 15 ? 2 : grid[col][row] === 17 ? 3 : 0;
      if (!span) continue;
      const index = row * 5 + col;
      this.setCell(index, grid[col][row], coins[col * 3 + row], {tall: span});
      this.layers.cells.addChild(this.cells[index].container);
      for (let covered = 1; covered < span && row + covered < 3; covered++) {
        const cell = this.cells[(row + covered) * 5 + col];
        cell.covered = true; cell.container.visible = false;
      }
    }
    return this;
  }

  renderBonus(board) {
    this.bonusBoard = copy(board); this.grid = null; this.coins = {};
    this.resetCells();
    for (let index = 0; index < 15; index++) {
      if (board[index]) this.setCell(index, 14, board[index].jp || board[index].value, {locked: true});
      else this.setCell(index, null);
    }
    return this;
  }

  setPots(levels = {}) {
    this.potLevels = {...this.potLevels, ...levels};
    // The animator queues front-vessel state changes behind their confirmed
    // collection reactions. A routine control refresh must not skip that queue.
    this.cauldronAnimator?.sync({...this.potLevels});
    const total = Object.values(this.potLevels).reduce((sum, n) => sum + n, 0);
    for (const name of POT_NAMES) {
      if (this.cauldronAnimator || this.pots[name]?.animationManaged) continue;
      const value = name === 'super' ? total : this.potLevels[name] || 0;
      const level = name === 'super' ? value < 9 ? 0 : value < 18 ? 1 : 2 : value < 4 ? 0 : value < 7 ? 1 : 2;
      const pot = this.pots[name];
      if (!pot) continue;
      const texture = this.texture(this.url(`cauldron_${name}_${level}`));
      if (pot.level === level && pot.artTexture === texture) continue;
      pot.level = level;
      pot.sprite.texture = texture;
      this.layoutPot(pot);
    }
  }

  setBonus(bonus) {
    if (this.bonus === !!bonus) return;
    this.bonus = !!bonus;
    if (this.backgroundSprite) this.backgroundSprite.texture = this.texture(this.url(this.bonus ? 'bg_bonus' : 'bg_base'));
    this.layoutBackground();
  }

  updateIdle(now, enabled = true) {
    for (const [index, name] of ['multi', 'collect', 'mystery'].entries()) {
      const pot = this.pots[name];
      if (pot && !this.cauldronAnimator && !pot.animationManaged) {
        pot.motionBody.y = enabled ? Math.sin(now / 1700 + index * 1.8) * .65 : 0;
      }
    }
  }

  setCellState(index, updates = {}) {
    const cell = this.cells[index]; if (!cell) return;
    Object.assign(cell.state, updates);
    if ('neutralWin' in updates) cell.state.neutral = updates.neutralWin;
    this.layoutCell(cell);
  }

  clearFocus() {
    this.focusWins = [];
    this.lineGraphics?.clear();
    for (const cell of this.cells) {
      cell.state = {dim: false, winner: false, neutral: false, spent: false};
      cell.content.position.set(0); cell.content.scale.set(1);
      if (cell.sprite) {cell.sprite.rotation = 0;}
      this.layoutCell(cell);
    }
  }

  focus(grid, wins, {neutral = false} = {}) {
    this.clearFocus(); this.focusWins = wins.map(win => ({...win})); this.neutralFocus = neutral;
    const lit = new Set();
    for (const win of wins) for (let col = 0; col < win.count; col++) lit.add((LINES[win.line - 1][col] - 1) * 5 + col);
    for (let col = 0; col < 5; col++) for (let row = 0; row < 3; row++) {
      const span = grid[col][row] === 15 ? 2 : grid[col][row] === 17 ? 3 : 0;
      if (span && Array.from({length: span}, (_, i) => (row + i) * 5 + col).some(index => lit.has(index))) lit.add(row * 5 + col);
    }
    for (const cell of this.cells) this.setCellState(cell.index, {dim: !lit.has(cell.index), winner: lit.has(cell.index) && !neutral, neutral: lit.has(cell.index) && neutral});
    this.drawLines(wins);
    return [...lit].map(index => this.cells[index].sprite).filter(Boolean);
  }

  drawLines(wins = this.focusWins) {
    const g = this.lineGraphics;
    g.clear();
    for (const win of wins) {
      const points = LINES[win.line - 1]?.slice(0, win.count) || [];
      points.forEach((row, col) => {
        const cell = this.cells[(row - 1) * 5 + col];
        const x = cell.x + this.geometry.cellW / 2, y = cell.y + this.geometry.cellH / 2;
        if (col === 0) g.moveTo(x, y); else g.lineTo(x, y);
      });
      g.stroke({color: 0xffe697, width: 2.5, alpha: .85, join: 'round'});
    }
  }

  layoutCell(cell) {
    if (!this.ready) return;
    const {board, cellW, cellH, gap, rowGap} = this.geometry;
    cell.x = board.x + cell.col * (cellW + gap); cell.y = board.y + cell.row * (cellH + rowGap);
    cell.width = cellW; cell.height = cell.span * cellH + (cell.span - 1) * rowGap;
    cell.container.position.set(cell.x, cell.y);
    // Keep registration and masks per cell, but the resting reel well is one
    // uninterrupted surface: no permanent tiles, gutters or square outlines.
    cell.background.visible = false;
    cell.mask.clear().roundRect(0, 0, cellW, cell.height, cellW < 70 ? 3 : 5).fill(0xffffff);
    const g = cell.highlight;
    g.clear();
    g.visible = !!(cell.state.winner || cell.state.neutral || cell.locked);
    if (g.visible) {
      g.roundRect(.5, .5, Math.max(0, cellW - 1), Math.max(0, cell.height - 1), cellW < 70 ? 3 : 5)
        .stroke({color: cell.state.winner ? 0xffda7b : cell.state.neutral ? 0xb8a6b5 : 0xf9c555,
          width: cell.state.winner ? 2 : 1, alpha: cell.state.winner || cell.state.neutral ? 1 : .4});
    }
    cell.container.alpha = cell.state.spent ? .35 : cell.state.dim ? .46 : 1;
  }

  layoutPot(pot) {
    if (!pot?.sprite) return;
    const incoming = pot.sprite.texture;
    const texture = incoming === pot.smokeRig?.bodyTexture ? pot.smokeRig.sourceTexture : incoming;
    pot.smokeRig?.setTexture(texture, pot.level);
    pot.artTexture = texture;
    const scale = Math.min(pot.width / texture.width, pot.height / texture.height);
    pot.sprite.scale.set(scale);
    pot.sprite.position.set(0);
    pot.baseScale = scale;
    const artWidth = texture.width * scale, artHeight = texture.height * scale;
    Object.assign(pot.base, {x: pot.x + pot.width / 2, y: pot.y + pot.height / 2,
      width: pot.width, height: pot.height, scale, artWidth, artHeight,
      mouth: {x: 0, y: (pot.name === 'super' ? -.35 : -.155) * artHeight,
        width: (pot.name === 'super' ? .6 : .64) * artWidth, height: (pot.name === 'super' ? .16 : .09) * artHeight}});
    // Layout owns this parent only. Squash, rock, smoke and grow transforms
    // live on motionBody/effectsContainer and survive a normal control update.
    pot.container.position.set(pot.base.x, pot.base.y);
    pot.smokeRig?.resize(scale);
  }

  layoutBackground() {
    if (!this.backgroundSprite) return;
    const rect = this.mount.getBoundingClientRect();
    const width = Math.max(window.innerWidth, document.documentElement.clientWidth), height = Math.max(window.innerHeight, 1);
    const texture = this.backgroundSprite.texture;
    const scale = Math.max(width / texture.width, height / texture.height);
    this.backgroundSprite.scale.set(scale);
    this.backgroundSprite.position.set((width - texture.width * scale) / 2 - rect.x, (height - texture.height * scale) / 2 - rect.y);
    this.backgroundShade.position.set(-rect.x, -rect.y);
    this.backgroundShade.width = width; this.backgroundShade.height = height;
  }

  resize() {
    if (!this.ready || this.destroyed) return;
    const width = Math.max(1, this.mount.clientWidth), height = Math.max(1, this.mount.clientHeight);
    this.width = width; this.height = height;
    this.resolution = Math.min(2, Math.max(1, window.devicePixelRatio || 1));
    this.app.renderer.resize(width, height, this.resolution);
    this.layoutBackground();
    Object.assign(this.geometry.board, this.toSceneRect(this.boardAnchor.getBoundingClientRect()));
    const style = getComputedStyle(this.boardAnchor), gap = parseFloat(style.columnGap) || 0, rowGap = parseFloat(style.rowGap) || gap;
    Object.assign(this.geometry, {gap, rowGap, cellW: (this.geometry.board.width - gap * 4) / 5, cellH: (this.geometry.board.height - rowGap * 2) / 3});
    this.geometry.pitch = this.geometry.cellH + rowGap;
    const b = this.geometry.board;
    // Board-only presentation pulses share one pivot, keeping cells, strips,
    // frame and paylines registered rather than scaling from the page origin.
    this.boardContainer.pivot.set(b.x + b.width / 2, b.y + b.height / 2);
    this.boardContainer.position.copyFrom(this.boardContainer.pivot);
    this.boardMask.clear().roundRect(b.x, b.y, b.width, b.height, 5).fill(0xffffff);
    const wrapper = this.boardAnchor.closest('.board-wrap');
    const wrapperRect = wrapper ? this.toSceneRect(wrapper.getBoundingClientRect()) : null;
    const wrapperStyle = wrapper ? getComputedStyle(wrapper) : null;
    const framePad = window.matchMedia('(max-width: 620px)').matches ? 6 : 10;
    const frame = wrapperRect || {x: b.x - framePad, y: b.y - framePad, width: b.width + framePad * 2, height: b.height + framePad * 2};
    const radius = parseFloat(wrapperStyle?.borderTopLeftRadius) || (framePad === 6 ? 8 : 13);
    const border = parseFloat(wrapperStyle?.borderLeftWidth) || (framePad === 6 ? 2 : 3);
    this.frame.clear()
      .roundRect(frame.x - 5, frame.y - 5, frame.width + 10, frame.height + 10, radius + 5).fill(0x805124)
      .roundRect(frame.x - 3, frame.y - 3, frame.width + 6, frame.height + 6, radius + 3).fill(0x522778)
      .roundRect(frame.x, frame.y, frame.width, frame.height, radius).fill(0xe3ad52)
      .roundRect(frame.x + border, frame.y + border, frame.width - 2 * border, frame.height - 2 * border, Math.max(0, radius - border)).fill(0x160b2c);
    for (const cell of this.cells) {
      const {id, value, span, locked, covered, state} = cell;
      const visible = cell.content.visible;
      this.setCell(cell.index, id, value, {locked, tall: span});
      cell.covered = covered; cell.container.visible = !covered; cell.content.visible = visible; cell.state = state;
      this.layoutCell(cell);
    }
    const potsRect = this.toSceneRect(this.potsAnchor.getBoundingClientRect());
    for (const name of POT_NAMES) {
      const anchor = name === 'super' ? this.potsAnchor.querySelector('.super-pot') : this.potsAnchor.querySelector(`[data-pot="${name}"] .pot-art, [data-pot="${name}"] img`);
      const rect = anchor?.getBoundingClientRect();
      const pot = this.pots[name];
      if (rect?.width && rect?.height) Object.assign(pot, this.toSceneRect(rect));
      else {
        const portrait = window.matchMedia('(max-width:620px), (orientation:portrait) and (max-width:1000px)').matches;
        const frontH = portrait ? 115 : 145;
        if (name === 'super') Object.assign(pot, {x: potsRect.x + potsRect.width * .245, y: potsRect.y, width: potsRect.width * .51, height: portrait ? 140 : 160});
        else Object.assign(pot, {x: potsRect.x + POT_NAMES.indexOf(name) * potsRect.width / 3, y: potsRect.y + potsRect.height - frontH, width: potsRect.width / 3, height: frontH});
      }
      pot.anchorRect = {x: pot.x, y: pot.y, width: pot.width, height: pot.height};
      if (name !== 'super') {
        const anchor = pot.anchorRect;
        pot.width = anchor.width * FRONT_POT_SCALE;
        pot.height = anchor.height * FRONT_POT_SCALE;
        const texture = pot.sprite.texture;
        const fit = Math.min(pot.width / texture.width, pot.height / texture.height);
        const artHalfWidth = texture.width * fit / 2;
        const center = Math.max(artHalfWidth + POT_SIDE_OVERSCAN,
          Math.min(this.width - artHalfWidth - POT_SIDE_OVERSCAN, anchor.x + anchor.width / 2));
        pot.x = center - pot.width / 2;
        pot.y = anchor.y + anchor.height - pot.height;
      } else {
        const texture = pot.artTexture || pot.smokeRig?.sourceTexture || pot.sprite.texture;
        const fronts = ['multi', 'collect', 'mystery'].map(front => this.pots[front]);
        const frontWidth = Math.max(...fronts.map(front => front.base.artWidth));
        const frontHeight = Math.max(...fronts.map(front => front.base.artHeight));
        const targetWidth = Math.max(frontWidth * 1.7, frontHeight * 1.12 * texture.width / texture.height);
        let targetHeight = targetWidth * texture.height / texture.width;
        const subtitle = this.mount.querySelector('.wordmark span');
        const subtitleRect = subtitle ? this.toSceneRect(subtitle.getBoundingClientRect()) : null;
        let topGuard = subtitleRect ? subtitleRect.y + subtitleRect.height + 3 : 0;
        const portrait = window.matchMedia('(max-width:620px), (orientation:portrait) and (max-width:1000px)').matches;
        const jackpots = this.mount.querySelector('.jackpots');
        if (portrait && jackpots) {
          const jp = this.toSceneRect(jackpots.getBoundingClientRect());
          topGuard = Math.max(topGuard, jp.y + jp.height + 3);
        }
        targetHeight = Math.min(targetHeight, Math.max(1, b.y - topGuard - 2));
        pot.height = targetHeight; pot.width = targetHeight * texture.width / texture.height;
        const floor = Math.min(...fronts.map(front => front.y + front.height));
        pot.y = Math.max(topGuard, Math.min(pot.anchorRect.y, floor - pot.height));
        pot.x = Math.max(POT_SIDE_OVERSCAN, Math.min(this.width - POT_SIDE_OVERSCAN - pot.width,
          pot.anchorRect.x + pot.anchorRect.width / 2 - pot.width / 2));
        const originalScale = Math.min(pot.anchorRect.width / texture.width, pot.anchorRect.height / texture.height);
        pot.enlargement = pot.width / (texture.width * originalScale);
      }
      this.layoutPot(pot);
    }
    if (this.focusWins.length) this.drawLines(this.focusWins);
    for (const listener of [...this.listeners]) listener(this.geometry);
    this.app.render();
  }

  onResize(listener) { this.listeners.add(listener); return () => this.listeners.delete(listener); }
  toSceneRect(rect) {
    const mount = this.mount.getBoundingClientRect();
    return {x: rect.x - mount.x, y: rect.y - mount.y, width: rect.width, height: rect.height};
  }
  toLocalRect(rect) { return this.toSceneRect(rect); }
  cellRect(index, {global = false} = {}) {
    const cell = this.cells[index];
    const rect = {x: cell.x, y: cell.y, width: cell.width, height: cell.height};
    if (global) {const origin = this.mount.getBoundingClientRect(); rect.x += origin.x; rect.y += origin.y;}
    return rect;
  }
  potRect(name, {global = false} = {}) {
    const pot = this.pots[name], rect = {x: pot.x, y: pot.y, width: pot.width, height: pot.height};
    if (global) {const origin = this.mount.getBoundingClientRect(); rect.x += origin.x; rect.y += origin.y;}
    return rect;
  }

  snapshot() {
    let containers = 0, sprites = 0, masks = 0;
    const visit = node => {containers++; if (node instanceof this.PIXI.Sprite) sprites++; if (node.mask) masks++; for (const child of node.children || []) visit(child);};
    visit(this.root);
    return {engine: 'PixiJS', version: this.PIXI.VERSION, renderer: this.app.renderer.name || this.app.renderer.constructor.name,
      rendererPreference: 'webgl', backend: this.backend, rendererType: this.app.renderer.type,
      ready: this.ready, contextLost: this.contextLost, width: this.width, height: this.height, resolution: this.app.renderer.resolution,
      canvas: {width: this.app.canvas.width, height: this.app.canvas.height}, geometry: copy(this.geometry),
      grid: this.grid ? copy(this.grid) : null, bonus: this.bonus,
      boardStyle: 'seamless-well', idleCellPanels: false,
      textures: [...this.textures].map(([id, texture]) => ({id, src: this.textureURLs.get(id), width: texture.width, height: texture.height})),
      cells: this.cells.map(cell => ({index: cell.index, col: cell.col, row: cell.row, id: cell.id, value: cell.value ?? null, span: cell.span,
        visible: cell.container.visible && cell.content.visible, covered: cell.covered, locked: cell.locked,
        backgroundVisible: cell.background.visible, highlightVisible: cell.highlight.visible,
        x: round(cell.x), y: round(cell.y), width: round(cell.width), height: round(cell.height), alpha: cell.container.alpha})),
      pots: Object.fromEntries(Object.entries(this.pots).map(([name, pot]) => [name, {level: pot.level,
        x: round(pot.x), y: round(pot.y), width: round(pot.width), height: round(pot.height),
        enlargement: pot.enlargement, anchorRect: copy(pot.anchorRect), baseScale: pot.baseScale,
        artWidth: round(pot.base.artWidth), artHeight: round(pot.base.artHeight), smoke: pot.smokeRig?.snapshot()}])),
      sceneGraph: {containers, sprites, masks, layers: Object.fromEntries(Object.entries(this.layers).map(([name, layer]) => [name, layer.children.length]))}};
  }

  destroyNode(node) { if (!node?.destroyed) node?.destroy({children: true, texture: false, textureSource: false}); }
  destroy() {
    if (this.destroyed) return; this.destroyed = true; this.ready = false;
    this.cauldronAnimator?.destroy();
    for (const pot of Object.values(this.pots)) pot.smokeRig?.destroy();
    if (this.resizeFrame !== null) cancelAnimationFrame(this.resizeFrame);
    this.observer?.disconnect(); this.listeners.clear();
    window.removeEventListener('resize', this.queueResize);
    window.visualViewport?.removeEventListener('resize', this.queueResize);
    const canvas = this.app?.renderer ? this.app.canvas : null;
    canvas?.removeEventListener('webglcontextlost', this.lostHandler);
    canvas?.removeEventListener('webglcontextrestored', this.restoredHandler);
    if (this.app?.renderer) this.app.destroy({removeView: true}, {children: true, texture: false, textureSource: false});
    this.host?.remove();
    for (const texture of this.ownedTextures) texture.destroy(true);
    this.ownedTextures.clear();
    this.mount.classList.remove('pixi-game');
  }
}
