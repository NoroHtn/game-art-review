// Deform only approved steam pixels. Solid vessel artwork and source files stay
// untouched; ordinary cropped sprites keep this rig compatible with Canvas.
const CUTS = Object.freeze({multi: [128, 118, 124], collect: [140, 118, 116], mystery: [116, 113, 100]});
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const round = v => Math.round(v * 1000) / 1000;

export class ApprovedSmokeRig {
  constructor({PIXI, view, texture, tier = 0}) {
    Object.assign(this, {PIXI, view});
    this.kind = view.name === 'super' ? 'approved-pearl-liquid' : 'approved-steam-strips';
    this.layer = new PIXI.Container();
    this.layer.label = `approved-smoke-${view.name}`;
    this.layer.eventMode = 'none';
    if (view.name === 'super') view.motionBody.addChild(this.layer);
    else view.motionBody.addChildAt(this.layer, 0);
    this.strips = []; this.derived = []; this.destroyed = false; this.last = null;
    this.setTexture(texture, tier);
  }

  crop(texture, x, y, width, height, body = false) {
    const {Texture, Rectangle} = this.PIXI, frame = texture.frame;
    const result = new Texture({source: texture.source,
      frame: new Rectangle(frame.x + x, frame.y + y, width, height),
      ...(body ? {orig: new Rectangle(0, 0, texture.width, texture.height), trim: new Rectangle(x, y, width, height)} : {})});
    this.derived.push(result); return result;
  }

  clearDerived() {
    this.layer.mask = null;
    if (this.view.sprite.texture === this.bodyTexture && this.sourceTexture) this.view.sprite.texture = this.sourceTexture;
    for (const node of this.layer.removeChildren()) node.destroy({children: true, texture: false, textureSource: false});
    for (const texture of this.derived) texture.destroy(false);
    this.derived = []; this.strips = []; this.bodyTexture = null; this.mask = null;
  }

  setTexture(texture, tier = 0) {
    if (this.destroyed || texture === this.bodyTexture) return;
    if (texture === this.sourceTexture && tier === this.tier) {
      // An actor can reassign its original texture on sync/reset without a
      // tier change. Restore the cached crop so it cannot cover the live rig.
      this.view.sprite.texture = this.bodyTexture || texture;
      return;
    }
    this.clearDerived();
    this.sourceTexture = texture; this.tier = tier;
    const {Sprite, Graphics} = this.PIXI;
    this.width = texture.width; this.height = texture.height;
    if (this.view.name === 'super') {
      // This region lies strictly inside the original gold rim: no rim, handles
      // or lower coins are included in the moving pearl-liquid overlay.
      this.region = {x: 122, y: 32, width: 268, height: 48};
      this.cutY = null;
      this.mask = new Graphics().ellipse(256, 55, 126, 17).fill(0xffffff);
      this.layer.addChild(this.mask); this.layer.mask = this.mask;
      this.view.sprite.texture = texture;
    } else {
      this.cutY = CUTS[this.view.name][clamp(tier, 0, 2)];
      this.region = {x: 0, y: 0, width: this.width, height: this.cutY};
      this.bodyTexture = this.crop(texture, 0, this.cutY, this.width, this.height - this.cutY, true);
      this.view.sprite.texture = this.bodyTexture;
    }
    const region = this.region;
    for (let y = region.y; y < region.y + region.height; y += 2) {
      const height = Math.min(2, region.y + region.height - y);
      const sprite = new Sprite(this.crop(texture, region.x, y, region.width, height));
      sprite.label = `approved-smoke-row-${y}`;
      this.layer.addChild(sprite);
      this.strips.push({sprite, x: region.x, y, width: region.width, height});
    }
    if (this.mask) this.layer.addChild(this.mask);
    this.resize(this.view.baseScale || 1);
    this.update(this.last || {time: 0, tier, reducedMotion: true});
  }

  resize(scale = this.view.baseScale || 1) {
    if (this.destroyed) return;
    this.layer.scale.set(scale);
    this.layer.position.set(-this.width * scale / 2, -this.height * scale / 2);
  }

  update(options = {}) {
    if (this.destroyed) return;
    this.last = {...options};
    const time = Number(options.time) || 0, tier = Number(options.intensity ?? options.tier ?? this.tier) || 0;
    const still = !!options.reducedMotion, reaction = clamp(Number(options.reaction) || 0, 0, 1), grow = clamp(Number(options.grow) || 0, 0, 1);
    const phase = ['multi', 'collect', 'mystery', 'super'].indexOf(this.view.name) * 1.73;
    const boost = 1 + reaction * .32 + grow * .38;
    const liquid = this.view.name === 'super';
    const deform = y => {
      if (still || liquid) return 0;
      const u = clamp(1 - y / this.cutY, 0, 1);
      return -this.cutY * .065 * u ** 1.4 * (.5 + .5 * Math.sin(time / 1070 + phase - y * .012)) * boost;
    };
    for (const strip of this.strips) {
      const y = strip.y, u = liquid ? Math.sin((y - this.region.y) / this.region.height * Math.PI) : clamp(1 - y / this.cutY, 0, 1);
      const amplitude = liquid ? 5.5 : this.width * (.029 + tier * .005) * u ** 1.45;
      const dx = still ? 0 : (Math.sin(time / 920 + phase - y * .026) + .32 * Math.sin(time / 1510 + phase + y * .019)) * amplitude * boost;
      const scaleX = still ? 1 : 1 + Math.sin(time / 1370 + phase + y * .017) * (liquid ? .012 : .027 * u ** 1.3) * boost;
      strip.sprite.x = strip.x + dx - strip.width * (scaleX - 1) / 2;
      strip.sprite.y = y + deform(y);
      strip.sprite.width = strip.width * scaleX;
      strip.sprite.height = strip.height + deform(y + strip.height) - deform(y);
      strip.sprite.alpha = liquid ? .72 + reaction * .12 : 1;
    }
  }

  reset() { this.update({time: 0, tier: this.tier, reducedMotion: true}); }
  clear() { this.reset(); }
  snapshot() {
    return {kind: this.kind, tier: this.tier, sourceWidth: this.width, sourceHeight: this.height,
      cutY: this.cutY, region: {...this.region}, strips: this.strips.length,
      time: this.last?.time || 0, reducedMotion: !!this.last?.reducedMotion,
      sample: this.strips.filter((_, i) => i % Math.max(1, Math.floor(this.strips.length / 4)) === 0).map(s => ({y: s.y, x: round(s.sprite.x), drawY: round(s.sprite.y), width: round(s.sprite.width), height: round(s.sprite.height)}))};
  }
  destroy() {
    if (this.destroyed) return;
    this.clearDerived(); this.layer.destroy({children: true}); this.destroyed = true;
  }
}
