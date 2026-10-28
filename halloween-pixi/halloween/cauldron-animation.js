// Approved-art cauldron presentation. This module owns no outcomes, amounts,
// progress rules or timers: the controller supplies confirmed counts and the
// shared FrameClock supplies visible elapsed time.
export const CAULDRON_DURATIONS = Object.freeze({collect: 450, grow: 700});
export const CAULDRON_FRONT_NAMES = Object.freeze(['multi', 'collect', 'mystery']);
export const CAULDRON_NAMES = Object.freeze([...CAULDRON_FRONT_NAMES, 'super']);
const COLORS = Object.freeze({
 multi: {light: 0xc956ff, bright: 0xf5caff},
 collect: {light: 0x32b9ff, bright: 0xd0f4ff},
 mystery: {light: 0xff4132, bright: 0xffddd0},
 super: {light: 0xbcdcff, bright: 0xffffff},
});
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const countValue = (value, name = 'multi') => clamp(Math.floor(Number.isFinite(Number(value)) ? Number(value) : 0), 0, name === 'super' ? 27 : 9);
export const cauldronTier = (count, name = 'multi') => countValue(count, name) < (name === 'super' ? 9 : 4) ? 0 : countValue(count, name) < (name === 'super' ? 18 : 7) ? 1 : 2;
const smooth = k => k * k * (3 - 2 * k);
// A weighted intake and one unhurried settle. Both ends have zero slope, so
// Collect can be added to the continuously running Idle without a pose snap.
const intake = k => k <= .32 ? smooth(k / .32) : 1 - smooth((k - .32) / .68);
const round = value => Math.round(value * 1000) / 1000;

export class CauldronAnimator {
 constructor({scene, clock, trace = () => {}, reducedMotion = false} = {}) {
  if (!scene?.PIXI || !clock?.onTick) throw new Error('CAULDRON_ANIMATOR_REQUIRES_PIXI_SCENE_AND_CLOCK');
  if (scene.cauldronAnimator && !scene.cauldronAnimator.destroyed) throw new Error('CAULDRON_ANIMATOR_ALREADY_ATTACHED');
  Object.assign(this, {scene, clock, trace, reducedMotion: !!reducedMotion});
  this.destroyed = false;
  this.events = [];
  this.sequence = 0;
  this.pots = {};
  const {Container, Graphics} = scene.PIXI;
  for (const [index, name] of CAULDRON_NAMES.entries()) {
   const view = scene.pots[name];
   if (!view?.sprite || !(view.motionBody || view.animationContainer)) throw new Error(`CAULDRON_ANIMATION_ANCHOR_MISSING: ${name}`);
   const body = view.motionBody || view.animationContainer;
   const host = new Container(), liquid = new Graphics(), rim = new Graphics(), particles = new Graphics();
   host.label = `cauldron-fx-${name}`; host.eventMode = 'none';
   host.addChild(liquid, rim, particles);
   (view.effectsContainer || view.fx || view.container).addChild(host);
   view.animationManaged = true;
   this.pots[name] = {name, index, view, body, host, liquid, rim, particles,
    base: {x: body.x, y: body.y, scaleX: body.scale.x, scaleY: body.scale.y, rotation: body.rotation || 0},
    state: 'Idle', clip: 'idle_0', tier: 0, count: 0, displayCount: 0, targetCount: 0,
    current: null, queue: [], received: 0, completed: 0, cancelled: 0, events: [],
    smokeUpdates: 0, renderState: {reaction: 0, grow: 0, intensity: 0, time: 0}};
  }
  scene.cauldronAnimator = this;
  this.sync(scene.potLevels || {}, {immediate: true});
  this.offTick = clock.onTick((dt, now) => this.update(now));
  this.offResize = scene.onResize?.(() => this.rebase());
 }

 record(pot, type, data = {}) {
  const event = {type, pot: pot.name, state: pot.state, tier: pot.tier, count: pot.count,
   displayCount: pot.displayCount, targetCount: pot.targetCount, time: round(this.clock.now), ...data};
  this.events.push(event); if (this.events.length > 240) this.events.shift();
  pot.events.push(event); if (pot.events.length > 80) pot.events.shift();
  this.trace(type, event);
 }
 setState(pot, state, details = {}) {
  pot.state = state;
  pot.clip = state === 'Grow' ? `grow_${pot.tier}_to_${details.toTier}` : `${state.toLowerCase()}_${pot.tier}`;
  this.record(pot, 'cauldron-state', {clip: pot.clip, ...details});
 }
 applyTier(pot, tier) {
  const next = clamp(tier, 0, 2), texture = this.scene.texture(this.scene.url(`cauldron_${pot.name}_${next}`));
  pot.tier = next; pot.view.level = next; pot.view.sprite.texture = texture;
  pot.view.smokeRig?.setTexture?.(texture, next);
  this.scene.layoutPot(pot.view);
 }

 // Default sync only records authoritative desired counts. It intentionally
 // cannot consume a collect event or jump a front texture before its impact.
 // Initial load, reset and explicit recovery use immediate:true.
 sync(levels = {}, {immediate = false} = {}) {
  if (this.destroyed) return this;
  const supplied = {...levels};
  if (CAULDRON_FRONT_NAMES.some(name => name in levels)) {
   supplied.super = CAULDRON_FRONT_NAMES.reduce((sum, name) => sum + countValue(levels[name] ?? this.pots[name].targetCount, name), 0);
  }
  for (const name of CAULDRON_NAMES) {
   if (!(name in supplied)) continue;
   const pot = this.pots[name], count = countValue(supplied[name], name);
   pot.targetCount = count;
   if (!immediate) continue;
   this.cancelPending(pot, 'sync');
   pot.count = pot.displayCount = count;
   this.applyTier(pot, cauldronTier(count, name));
   this.resetPose(pot);
   this.setState(pot, 'Idle', {reason: 'sync'});
  }
  this.update(this.clock.now);
  return this;
 }

 collect(name, confirmedCount) {
  const pot = this.pots[name];
  if (!pot) return Promise.reject(new Error(`INVALID_CAULDRON: ${name}`));
  if (this.destroyed) return Promise.resolve({cancelled: true, reason: 'destroyed'});
  const latest = pot.queue.at(-1)?.count ?? pot.current?.count ?? pot.displayCount;
  const count = countValue(confirmedCount === undefined ? latest + 1 : confirmedCount, name);
  pot.targetCount = Math.max(pot.targetCount, count); pot.received++;
  const event = {id: ++this.sequence, count, receivedAt: this.clock.now};
  if (this.reducedMotion) {
   pot.count = Math.max(pot.displayCount, count);
   this.setState(pot, 'Collect', {eventId: event.id, immediate: true});
   const tier = cauldronTier(pot.count, name);
   for (let next = pot.tier + 1; next <= tier; next++) {
    this.setState(pot, 'Grow', {eventId: event.id, toTier: next, immediate: true});
    this.applyTier(pot, next);
    this.setState(pot, 'Idle', {eventId: event.id, immediate: true});
   }
   pot.displayCount = pot.count; pot.completed++;
   this.resetPose(pot); this.clearEffects(pot);
   this.setState(pot, 'Idle', {eventId: event.id, immediate: true});
   return Promise.resolve({pot: name, count: pot.count, tier: pot.tier, state: 'Idle'});
  }
  const promise = new Promise(resolve => {event.resolve = resolve;});
  pot.queue.push(event);
  this.record(pot, 'cauldron-queued', {eventId: event.id, pending: pot.queue.length + (pot.current ? 1 : 0)});
  if (!pot.current) this.beginNext(pot, this.clock.now);
  this.render(pot, this.clock.now);
  return promise;
 }
 beginNext(pot, now) {
  const event = pot.queue.shift();
  if (!event) return;
  event.count = Math.max(pot.displayCount, event.count);
  event.targetTier = cauldronTier(event.count, pot.name);
  event.started = now; event.phase = 'Collect'; event.swapped = false;
  pot.current = event; pot.count = event.count;
  this.setState(pot, 'Collect', {eventId: event.id});
 }
 beginGrow(pot, now) {
  const event = pot.current;
  event.phase = 'Grow'; event.started = now; event.swapped = false; event.fromTier = pot.tier; event.toTier = pot.tier + 1;
  this.setState(pot, 'Grow', {eventId: event.id, toTier: event.toTier});
 }
 finishPhase(pot, now) {
  const event = pot.current;
  if (event.phase === 'Collect') {
   pot.displayCount = event.count;
   this.setState(pot, 'Idle', {eventId: event.id, reason: 'collect-complete'});
   if (event.targetTier > pot.tier) {this.beginGrow(pot, now); return;}
  } else {
   if (!event.swapped) this.applyTier(pot, event.toTier);
   this.setState(pot, 'Idle', {eventId: event.id, reason: 'grow-complete'});
   if (event.targetTier > pot.tier) {this.beginGrow(pot, now); return;}
  }
  pot.completed++; pot.current = null;
  this.record(pot, 'cauldron-complete', {eventId: event.id});
  event.resolve?.({pot: pot.name, count: pot.count, tier: pot.tier, state: 'Idle'});
  this.beginNext(pot, now);
 }
 update(now = this.clock.now) {
  if (this.destroyed) return;
  for (const pot of Object.values(this.pots)) {
   // Preserve elapsed time at a low frame rate, including multiple queued
   // events; no setTimeout or independent requestAnimationFrame loop exists.
   let transitions = 0;
   while (pot.current && transitions++ < 100) {
    const event = pot.current, duration = event.phase === 'Collect' ? CAULDRON_DURATIONS.collect : CAULDRON_DURATIONS.grow;
    const progress = clamp((now - event.started) / duration, 0, 1);
    if (event.phase === 'Grow' && !event.swapped && progress >= .48) {
     this.applyTier(pot, event.toTier); event.swapped = true;
     this.record(pot, 'cauldron-tier', {eventId: event.id, toTier: event.toTier});
    }
    if (progress < 1) break;
    this.finishPhase(pot, event.started + duration);
   }
   this.render(pot, now);
  }
 }

 dimensions(pot) {
  const view = pot.view, texture = view.sprite.texture;
  const width = view.base?.artWidth || texture.width * Math.abs(view.sprite.scale.x);
  const height = view.base?.artHeight || texture.height * Math.abs(view.sprite.scale.y);
  const superPot = pot.name === 'super';
  return {width, height, mouthX: 0, mouthY: -height * (superPot ? .35 : .155), rx: width * (superPot ? .30 : .32), ry: height * (superPot ? .08 : .045)};
 }
 resetPose(pot) {
  const {body, base, host} = pot;
  if (!body.destroyed) {
   body.position.set(base.x, base.y); body.scale.set(base.scaleX, base.scaleY); body.rotation = base.rotation;
  }
  if (!host.destroyed) {host.position.set(0); host.scale.set(1); host.rotation = 0;}
 }
 pose(pot, x, y, scaleX, scaleY, rotation) {
  const {body, base, host} = pot;
  body.position.set(base.x + x, base.y + y);
  body.scale.set(base.scaleX * scaleX, base.scaleY * scaleY); body.rotation = base.rotation + rotation;
  // Rim, light and bubbles remain registered to the actual moving artwork.
  host.position.set(x, y); host.scale.set(scaleX, scaleY); host.rotation = rotation;
 }
 clearEffects(pot) {pot.liquid.clear(); pot.rim.clear(); pot.particles.clear(); pot.host.visible = false;}
 driveSmoke(pot, now, values) {
  const rig = pot.view.smokeRig;
  if (!rig?.update) return;
  const {body} = pot;
  rig.update({time: now, tier: pot.tier, phase: pot.state, ...values,
   bodyPose: {x: body.x, y: body.y, scaleX: body.scale.x, scaleY: body.scale.y, rotation: body.rotation}});
  pot.smokeUpdates++;
 }
 render(pot, now) {
  if (pot.body.destroyed || pot.host.destroyed) return;
  if (this.reducedMotion) {
   this.resetPose(pot); this.clearEffects(pot);
   this.driveSmoke(pot, now, {reaction: 0, grow: 0, intensity: pot.tier, reducedMotion: true});
   pot.renderState = {reaction: 0, grow: 0, intensity: pot.tier, time: now};
   return;
  }
  const d = this.dimensions(pot), phase = now / 1900 + pot.index * 1.67;
  const event = pot.current;
  let intensity = pot.tier, reaction = 0, grow = 0;
  if (event?.phase === 'Collect') {
   reaction = intake(clamp((now - event.started) / CAULDRON_DURATIONS.collect, 0, 1));
  } else if (event?.phase === 'Grow') {
   const k = clamp((now - event.started) / CAULDRON_DURATIONS.grow, 0, 1);
   grow = Math.sin(k * Math.PI) ** 2;
   intensity = event.fromTier + (event.toTier - event.fromTier) * smooth(k);
  }
  // Idle never stops underneath a reaction. Only a single smooth weighted
  // intake/swell is layered over it: no angular oscillation or rapid shake.
  const breath = Math.sin(phase) * (.0016 + intensity * .0008);
  const scaleX = 1 + breath + reaction * .018 + grow * .034;
  const scaleY = 1 - breath * .55 - reaction * .021 + grow * .029;
  const y = Math.sin(phase * .83) * d.height * (.0012 + intensity * .0005)
   + d.height * (.009 * reaction - .014 * grow);
  this.pose(pot, 0, y, scaleX, scaleY, 0);
  this.driveSmoke(pot, now, {reaction, grow, intensity, reducedMotion: false});
  pot.renderState = {reaction: round(reaction), grow: round(grow), intensity: round(intensity), time: round(now)};
  const color = COLORS[pot.name]; pot.host.visible = true;
  const liquid = pot.liquid.clear(), rim = pot.rim.clear(), particles = pot.particles.clear();
  const light = .055 + intensity * .025 + Math.sin(phase * 1.3) * .015 + reaction * .14 + grow * .19;
  // These restrained mouth accents complement the actual moving approved
  // smoke pixels supplied by the scene rig; they do not replace the smoke.
  liquid.ellipse(d.mouthX, d.mouthY, d.rx, d.ry).fill({color: color.light, alpha: clamp(light, 0, .32)});
  rim.ellipse(0, d.mouthY, d.rx * (1 + reaction * .018 + grow * .025), d.ry * (1 + reaction * .065 + grow * .08))
   .stroke({color: color.bright, width: Math.max(.55, d.height * .004), alpha: .07 + reaction * .22 + grow * .29});
  const bubbles = 2 + Math.floor(intensity), bubbleBoost = reaction * .16 + grow * .24;
  for (let i = 0; i < bubbles; i++) {
   const t = ((now / 2700 + i * .273 + pot.index * .173) % 1 + 1) % 1;
   const x = Math.sin(i * 9.7 + pot.index * 2.1) * d.rx * .72;
   const cy = d.mouthY - d.height * (.035 + .095 * t);
   const radius = d.height * (.006 + (i % 2) * .002) * (.65 + Math.sin(t * Math.PI) * .35);
   const alpha = Math.sin(t * Math.PI) * (.13 + intensity * .04 + bubbleBoost);
   particles.circle(x, cy, radius).stroke({color: color.bright, width: Math.max(.45, d.height * .003), alpha});
  }
  const wave = reaction > 0 ? reaction : grow;
  if (wave > 0) for (let i = 0; i < 5; i++) {
   const angle = Math.PI * (.16 + i * .17), distance = d.height * (.06 + (i % 3) * .012) * wave;
   const x = Math.cos(angle) * distance, cy = d.mouthY - Math.sin(angle) * distance;
   particles.circle(x, cy, Math.max(.55, d.height * .0045)).fill({color: i % 3 === 0 ? 0xffe5a2 : color.bright, alpha: wave * .4});
  }
 }

 rebase() {
  if (!this.destroyed) this.update(this.clock.now);
 }
 mouthRect(name) {
  const pot = this.pots[name]; if (!pot) throw new Error(`INVALID_CAULDRON: ${name}`);
  const d = this.dimensions(pot), body = pot.body, origin = pot.view.container;
  const sx = body.scale.x, sy = body.scale.y, angle = body.rotation;
  const cx = origin.x + body.x - Math.sin(angle) * d.mouthY * sy;
  const cy = origin.y + body.y + Math.cos(angle) * d.mouthY * sy;
  const width = d.rx * 2 * Math.abs(sx), height = d.ry * 2 * Math.abs(sy);
  return {x: cx - width / 2, y: cy - height / 2, width, height};
 }
 cancelPending(pot, reason) {
  const pending = [...(pot.current ? [pot.current] : []), ...pot.queue];
  pot.current = null; pot.queue = [];
  for (const event of pending) {
   pot.cancelled++; event.resolve?.({cancelled: true, reason, pot: pot.name, eventId: event.id});
   this.record(pot, 'cauldron-cancel', {reason, eventId: event.id});
  }
 }
 stop() {
  if (this.destroyed) return;
  for (const pot of Object.values(this.pots)) {
   this.cancelPending(pot, 'stop');
   pot.count = pot.displayCount = pot.targetCount;
   this.applyTier(pot, cauldronTier(pot.count, pot.name)); this.resetPose(pot); this.clearEffects(pot);
   this.driveSmoke(pot, this.clock.now, {reaction: 0, grow: 0, intensity: pot.tier, reducedMotion: true});
   this.setState(pot, 'Idle', {reason: 'stop'});
  }
 }
 snapshot() {
  return {destroyed: this.destroyed, reducedMotion: this.reducedMotion, clock: round(this.clock.now),
   pots: Object.fromEntries(Object.values(this.pots).map(pot => [pot.name, {
    state: pot.state, clip: pot.clip, tier: pot.tier, count: pot.count, displayCount: pot.displayCount,
    targetCount: pot.targetCount, pending: pot.queue.length + (pot.current ? 1 : 0),
    received: pot.received, completed: pot.completed, cancelled: pot.cancelled, maxCount: pot.name === 'super' ? 27 : 9,
    smokeUpdates: pot.smokeUpdates, smoke: pot.view.smokeRig?.snapshot?.() || null, render: {...pot.renderState},
    current: pot.current ? {id: pot.current.id, phase: pot.current.phase, count: pot.current.count,
     started: round(pot.current.started), toTier: pot.current.toTier ?? null} : null,
    pose: {x: round(pot.body.x), y: round(pot.body.y), scaleX: round(pot.body.scale.x), scaleY: round(pot.body.scale.y), rotation: round(pot.body.rotation)},
    events: pot.events.map(event => ({...event})),
   }])), events: this.events.map(event => ({...event}))};
 }
 destroy() {
  if (this.destroyed) return;
  this.stop(); this.destroyed = true; this.offTick?.(); this.offResize?.();
  for (const pot of Object.values(this.pots)) {
   pot.view.animationManaged = false; this.resetPose(pot);
   this.scene.destroyNode(pot.host);
  }
  if (this.scene.cauldronAnimator === this) delete this.scene.cauldronAnimator;
 }
}
