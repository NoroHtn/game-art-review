// Approved-art presentation only. The controller supplies confirmed progress;
// a single FrameClock drives all plume, intake and growth choreography.
export const CAULDRON_DURATIONS = Object.freeze({collect: 650, grow: 700, anticipation: 120, growthLead: 110});
export const CAULDRON_FRONT_NAMES = Object.freeze(['multi', 'collect', 'mystery']);
export const CAULDRON_NAMES = Object.freeze([...CAULDRON_FRONT_NAMES, 'super']);
const clamp = (n, low, high) => Math.max(low, Math.min(high, n));
const countValue = (value, name = 'multi') => clamp(Math.floor(Number.isFinite(Number(value)) ? Number(value) : 0), 0, name === 'super' ? 27 : 9);
const thresholds = name => name === 'super' ? [9, 18] : [4, 7];
export const cauldronTier = (count, name = 'multi') => countValue(count, name) < thresholds(name)[0] ? 0 : countValue(count, name) < thresholds(name)[1] ? 1 : 2;
const smooth = k => {k = clamp(k, 0, 1); return k * k * (3 - 2 * k);};
const pulse = k => k <= 0 || k >= 1 ? 0 : Math.sin(k * Math.PI) ** 2;
const pressure = k => k <= .32 ? smooth(k / .32) : 1 - smooth((k - .32) / .68);
// Smooth saturation combines impacts instead of restarting an animation, and
// prevents a dense arrival run from producing a violent or oversized reaction.
const saturate = value => 1 - Math.exp(-Math.max(0, value) * 1.8);
const round = n => Math.round(n * 1000) / 1000;

export class CauldronAnimator {
 constructor({scene, clock, trace = () => {}, reducedMotion = false} = {}) {
  if (!scene?.PIXI || !clock?.onTick) throw new Error('CAULDRON_ANIMATOR_REQUIRES_PIXI_SCENE_AND_CLOCK');
  if (scene.cauldronAnimator && !scene.cauldronAnimator.destroyed) throw new Error('CAULDRON_ANIMATOR_ALREADY_ATTACHED');
  Object.assign(this, {scene, clock, trace, reducedMotion: !!reducedMotion});
  this.destroyed = false; this.events = []; this.sequence = 0; this.pots = {};
  for (const [index, name] of CAULDRON_NAMES.entries()) {
   const view = scene.pots[name], body = view?.motionBody || view?.animationContainer;
   if (!view?.sprite || !body) throw new Error(`CAULDRON_ANIMATION_ANCHOR_MISSING: ${name}`);
   const host = new scene.PIXI.Container(); host.label = `cauldron-fx-${name}`; host.eventMode = 'none';
   (view.effectsContainer || view.fx || view.container).addChild(host);
   view.animationManaged = true;
   this.pots[name] = {name, index, view, body, host,
    base: {x: body.x, y: body.y, scaleX: body.scale.x, scaleY: body.scale.y, rotation: body.rotation || 0},
    state: 'Idle', clip: 'idle_0', tier: 0, settledTier: 0, count: 0, displayCount: 0, targetCount: 0,
    impulses: [], anticipations: [], waiters: new Map(), growthTriggers: new Map(), growth: null,
    received: 0, completed: 0, cancelled: 0, events: [], smokeUpdates: 0,
    renderState: {reaction: 0, grow: 0, intensity: 0, anticipation: 0, inhale: 0, exhale: 0, energy: 0, time: 0}};
  }
  scene.cauldronAnimator = this;
  this.sync(scene.potLevels || {}, {immediate: true});
  this.offTick = clock.onTick((dt, now) => this.update(now));
  this.offResize = scene.onResize?.(() => this.rebase());
 }
 record(pot, type, data = {}) {
  const event = {type, pot: pot.name, state: pot.state, tier: pot.tier, count: pot.count,
   displayCount: pot.displayCount, targetCount: pot.targetCount, time: round(this.clock.now), ...data};
  this.events.push(event); if (this.events.length > 280) this.events.shift();
  pot.events.push(event); if (pot.events.length > 110) pot.events.shift();
  this.trace(type, event);
 }
 setState(pot, state, details = {}) {
  const clip = state === 'Grow' ? `grow_${details.fromTier ?? pot.growth?.fromTier ?? pot.tier}_to_${details.toTier ?? pot.growth?.toTier}` : `${state.toLowerCase()}_${pot.tier}`;
  if (state === pot.state && clip === pot.clip && !details.force) return;
  pot.state = state; pot.clip = clip;
  this.record(pot, 'cauldron-state', {clip, ...details});
 }
 applyTier(pot, tier) {
  const next = clamp(tier, 0, 2), texture = this.scene.texture(this.scene.url(`cauldron_${pot.name}_${next}`));
  pot.tier = next; pot.view.level = next; pot.view.sprite.texture = texture;
  pot.view.smokeRig?.setTexture?.(texture, next);
  this.scene.layoutPot(pot.view);
 }
 // A regular control refresh records desired counts only. Confirmed impacts
 // are the only animation trigger; initial load/reset use immediate:true.
 sync(levels = {}, {immediate = false} = {}) {
  if (this.destroyed) return this;
  const supplied = {...levels};
  if (CAULDRON_FRONT_NAMES.some(name => name in levels)) supplied.super = CAULDRON_FRONT_NAMES.reduce((sum, name) => sum + countValue(levels[name] ?? this.pots[name].targetCount, name), 0);
  for (const name of CAULDRON_NAMES) {
   if (!(name in supplied)) continue;
   const pot = this.pots[name], count = countValue(supplied[name], name); pot.targetCount = count;
   if (!immediate) continue;
   this.cancelPending(pot, 'sync'); pot.count = pot.displayCount = count;
   this.applyTier(pot, cauldronTier(count, name)); pot.settledTier = pot.tier;
   this.resetPose(pot); this.setState(pot, 'Idle', {reason: 'sync', force: true});
  }
  this.update(this.clock.now); return this;
 }
 anticipate(name, {impactIn = CAULDRON_DURATIONS.anticipation} = {}) {
  const pot = this.pots[name];
  if (!pot || this.destroyed || this.reducedMotion) return;
  const lead = clamp(Number(impactIn) || CAULDRON_DURATIONS.anticipation, 40, 400), now = this.clock.now;
  pot.anticipations.push({id: ++this.sequence, start: now, impactAt: now + lead, end: now + lead + 160});
  this.record(pot, 'cauldron-anticipate', {impactAt: round(now + lead)}); this.render(pot, now);
 }
 anticipationValue(event, now) {
  return now <= event.impactAt ? smooth((now - event.start) / Math.max(1, event.impactAt - event.start)) : 1 - smooth((now - event.impactAt) / 160);
 }
 collect(name, confirmedCount) {
  const pot = this.pots[name];
  if (!pot) return Promise.reject(new Error(`INVALID_CAULDRON: ${name}`));
  if (this.destroyed) return Promise.resolve({cancelled: true, reason: 'destroyed'});
  const previous = pot.displayCount, count = Math.max(previous, countValue(confirmedCount === undefined ? previous + 1 : confirmedCount, name)), now = this.clock.now;
  pot.count = pot.displayCount = count; pot.targetCount = Math.max(pot.targetCount, count); pot.received++;
  const event = {id: ++this.sequence, count, start: now, end: now + CAULDRON_DURATIONS.collect, requiredTier: cauldronTier(count, name), carry: 0};
  // Transfer the mouth's existing pre-intake pressure into the impact envelope
  // without a one-frame collapse when the approaching coin reaches the rim.
  if (pot.anticipations.length) {
   let index = 0;
   for (let i = 1; i < pot.anticipations.length; i++) if (Math.abs(pot.anticipations[i].impactAt - now) < Math.abs(pot.anticipations[index].impactAt - now)) index = i;
   event.carry = this.anticipationValue(pot.anticipations.splice(index, 1)[0], now);
  }
  this.record(pot, 'cauldron-impact', {eventId: event.id, previousCount: previous, requiredTier: event.requiredTier});
  if (this.reducedMotion) {
   this.setState(pot, 'Collect', {eventId: event.id, immediate: true, force: true});
   for (let next = pot.tier + 1; next <= event.requiredTier; next++) {
    this.setState(pot, 'Grow', {eventId: event.id, fromTier: pot.tier, toTier: next, immediate: true});
    this.applyTier(pot, next); pot.settledTier = next;
    this.setState(pot, 'Idle', {eventId: event.id, immediate: true});
   }
   pot.completed++; this.resetPose(pot); this.clearEffects(pot);
   this.setState(pot, 'Idle', {eventId: event.id, immediate: true}); this.render(pot, now);
   return Promise.resolve({pot: name, count, tier: pot.tier, state: 'Idle'});
  }
  const promise = new Promise(resolve => {event.resolve = resolve;});
  pot.impulses.push(event); pot.waiters.set(event.id, event);
  for (let tier = pot.settledTier + 1; tier <= event.requiredTier; tier++) {
   if (pot.growth?.toTier === tier || pot.growthTriggers.has(tier)) continue;
   pot.growthTriggers.set(tier, {eventId: event.id, count: thresholds(name)[tier - 1], threshold: thresholds(name)[tier - 1], due: now + CAULDRON_DURATIONS.growthLead});
  }
  this.update(now); return promise;
 }
 advanceGrowth(pot, now) {
  let transitions = 0;
  while (transitions++ < 8) {
   if (!pot.growth) {
    const next = pot.settledTier + 1, trigger = pot.growthTriggers.get(next);
    if (!trigger || now < trigger.due) break;
    pot.growthTriggers.delete(next);
    pot.growth = {fromTier: pot.settledTier, toTier: next, start: trigger.due, end: trigger.due + CAULDRON_DURATIONS.grow, swapped: false, ...trigger};
    this.setState(pot, 'Grow', {eventId: trigger.eventId, fromTier: pot.growth.fromTier, toTier: next, count: trigger.count, threshold: trigger.threshold});
   }
   const growth = pot.growth, k = clamp((now - growth.start) / CAULDRON_DURATIONS.grow, 0, 1);
   if (!growth.swapped && k >= .48) {this.applyTier(pot, growth.toTier); growth.swapped = true; this.record(pot, 'cauldron-tier', {eventId: growth.eventId, toTier: growth.toTier});}
   if (k < 1) break;
   if (!growth.swapped) this.applyTier(pot, growth.toTier);
   pot.settledTier = growth.toTier; pot.growth = null;
   this.setState(pot, 'Idle', {eventId: growth.eventId, reason: 'grow-complete'});
   const next = pot.growthTriggers.get(pot.settledTier + 1);
   if (next) next.due = Math.max(next.due, growth.end);
  }
 }
 activateSuper(duration = 3300) {
  if (this.destroyed) return;
  this.superActivation = {start: this.clock.now, end: this.clock.now + duration};
  this.record(this.pots.super, 'super-activation-start', {duration});
  this.update(this.clock.now);
 }
 update(now = this.clock.now) {
  if (this.destroyed) return;
  for (const pot of Object.values(this.pots)) {
   this.advanceGrowth(pot, now);
   pot.impulses = pot.impulses.filter(event => now < event.end);
   pot.anticipations = pot.anticipations.filter(event => now < event.end);
   for (const [id, event] of pot.waiters) {
    if (now < event.end || pot.settledTier < event.requiredTier) continue;
    pot.waiters.delete(id); pot.completed++;
    this.record(pot, 'cauldron-complete', {eventId: event.id, arrivalTime: round(event.start), visualTail: CAULDRON_DURATIONS.collect});
    event.resolve?.({pot: pot.name, count: event.count, tier: pot.tier, state: pot.growth ? 'Grow' : pot.impulses.length ? 'Collect' : 'Idle'});
   }
   if (!pot.growth) this.setState(pot, pot.name === 'super' && this.superActivation && now < this.superActivation.end ? 'Activate' : pot.impulses.length ? 'Collect' : 'Idle');
   this.render(pot, now);
  }
 }
 dimensions(pot) {
  const texture = pot.view.sprite.texture, width = pot.view.base?.artWidth || texture.width * Math.abs(pot.view.sprite.scale.x), height = pot.view.base?.artHeight || texture.height * Math.abs(pot.view.sprite.scale.y), rear = pot.name === 'super';
  return {width, height, mouthY: -height * (rear ? .35 : .155), rx: width * (rear ? .30 : .32), ry: height * (rear ? .08 : .045)};
 }
 resetPose(pot) {
  if (!pot.body.destroyed) {pot.body.position.set(pot.base.x, pot.base.y); pot.body.scale.set(pot.base.scaleX, pot.base.scaleY); pot.body.rotation = pot.base.rotation;}
  if (!pot.host.destroyed) {pot.host.position.set(0); pot.host.scale.set(1); pot.host.rotation = 0;}
 }
 pose(pot, y, scale) {
  pot.body.position.set(pot.base.x, pot.base.y + y); pot.body.scale.set(pot.base.scaleX * scale, pot.base.scaleY * scale); pot.body.rotation = pot.base.rotation;
  pot.host.position.set(0, y); pot.host.scale.set(scale); pot.host.rotation = 0;
 }
 clearEffects(pot) {pot.host.visible = false;}
 driveSmoke(pot, now, values) {
  if (!pot.view.smokeRig?.update) return;
  const {body} = pot;
  pot.view.smokeRig.update({time: now, tier: pot.tier, phase: pot.state, ...values, bodyPose: {x: body.x, y: body.y, scaleX: body.scale.x, scaleY: body.scale.y, rotation: body.rotation}}); pot.smokeUpdates++;
 }
 render(pot, now) {
  if (pot.body.destroyed || pot.host.destroyed) return;
  this.clearEffects(pot);
  if (this.reducedMotion) {
   this.resetPose(pot); const values = {reaction: 0, grow: 0, intensity: pot.tier, anticipation: 0, inhale: 0, exhale: 0, energy: 0, reducedMotion: true};
   this.driveSmoke(pot, now, values); pot.renderState = {...values, time: now}; return;
  }
  let intensity = pot.tier, grow = 0;
  if (pot.growth) {const k = clamp((now - pot.growth.start) / CAULDRON_DURATIONS.grow, 0, 1); grow = pulse(k); intensity = pot.growth.fromTier + (pot.growth.toTier - pot.growth.fromTier) * smooth(k);}
  let reactionRaw = 0, inhaleRaw = 0, exhaleRaw = 0, anticipationRaw = pot.anticipations.reduce((sum, event) => sum + this.anticipationValue(event, now), 0);
  for (const event of pot.impulses) {
   const age = now - event.start, k = clamp(age / CAULDRON_DURATIONS.collect, 0, 1);
   reactionRaw += pressure(k); inhaleRaw += pulse(age / 220); exhaleRaw += pulse((age - 140) / (CAULDRON_DURATIONS.collect - 140));
   anticipationRaw += event.carry * (1 - smooth(age / CAULDRON_DURATIONS.anticipation));
  }
  const activation = pot.name === 'super' && this.superActivation ? pulse((now-this.superActivation.start)/(this.superActivation.end-this.superActivation.start)) : 0;
  exhaleRaw += activation * 1.5;
  const reaction = saturate(reactionRaw), inhale = saturate(inhaleRaw), exhale = saturate(exhaleRaw), anticipation = saturate(anticipationRaw), energy = saturate(inhaleRaw + exhaleRaw + grow * .5 + activation);
  const d = this.dimensions(pot), phase = now / 1900 + pot.index * 1.67;
  const breath = Math.sin(phase) * (.001 + intensity * .0005);
  // The vessel's metal remains stable: uniform sub-0.5% weighting only. All
  // expressive anticipation, intake and release belongs to its actual plume.
  const scale = clamp(1 + breath - reaction * .0015 + grow * .0012, .995, 1.005);
  const y = Math.sin(phase * .83) * d.height * .0007 + d.height * (.0015 * reaction - .0015 * grow);
  this.pose(pot, y, scale);
  const values = {reaction, grow, intensity, anticipation, inhale, exhale, energy, activation, reducedMotion: false};
  this.driveSmoke(pot, now, values);
  pot.renderState = Object.fromEntries(Object.entries({...values, time: now}).map(([key, value]) => [key, typeof value === 'number' ? round(value) : value]));
 }
 rebase() {if (!this.destroyed) this.update(this.clock.now);}
 mouthRect(name) {
  const pot = this.pots[name]; if (!pot) throw new Error(`INVALID_CAULDRON: ${name}`);
  const d = this.dimensions(pot), body = pot.body, origin = pot.view.container, sx = body.scale.x, sy = body.scale.y, angle = body.rotation;
  const cx = origin.x + body.x - Math.sin(angle) * d.mouthY * sy, cy = origin.y + body.y + Math.cos(angle) * d.mouthY * sy;
  const width = d.rx * 2 * Math.abs(sx), height = d.ry * 2 * Math.abs(sy);
  return {x: cx - width / 2, y: cy - height / 2, width, height};
 }
 cancelPending(pot, reason) {
  const pending = [...pot.waiters.values()]; pot.impulses = []; pot.anticipations = []; pot.waiters.clear(); pot.growthTriggers.clear(); pot.growth = null;
  for (const event of pending) {pot.cancelled++; event.resolve?.({cancelled: true, reason, pot: pot.name, eventId: event.id}); this.record(pot, 'cauldron-cancel', {reason, eventId: event.id});}
 }
 stop() {
  if (this.destroyed) return;
  this.superActivation = null;
  for (const pot of Object.values(this.pots)) {
   this.cancelPending(pot, 'stop'); pot.count = pot.displayCount = pot.targetCount;
   this.applyTier(pot, cauldronTier(pot.count, pot.name)); pot.settledTier = pot.tier; this.resetPose(pot); this.clearEffects(pot);
   this.driveSmoke(pot, this.clock.now, {reaction: 0, grow: 0, intensity: pot.tier, anticipation: 0, inhale: 0, exhale: 0, energy: 0, reducedMotion: true});
   this.setState(pot, 'Idle', {reason: 'stop'});
  }
 }
 snapshot() {
  return {destroyed: this.destroyed, reducedMotion: this.reducedMotion, clock: round(this.clock.now),
   pots: Object.fromEntries(Object.values(this.pots).map(pot => [pot.name, {
    state: pot.state, clip: pot.clip, tier: pot.tier, settledTier: pot.settledTier, count: pot.count, displayCount: pot.displayCount, targetCount: pot.targetCount,
    pending: pot.waiters.size, received: pot.received, completed: pot.completed, cancelled: pot.cancelled, maxCount: pot.name === 'super' ? 27 : 9,
    activeImpulses: pot.impulses.map(event => ({id: event.id, count: event.count, start: round(event.start), end: round(event.end), requiredTier: event.requiredTier})),
    anticipation: pot.anticipations.length, growth: pot.growth ? {...pot.growth} : null,
    current: pot.growth ? {id: pot.growth.eventId, phase: 'Grow', started: round(pot.growth.start), toTier: pot.growth.toTier} : pot.impulses.length ? {id: pot.impulses[0].id, phase: 'Collect', started: round(pot.impulses[0].start), count: pot.impulses[0].count} : null,
    smokeUpdates: pot.smokeUpdates, smoke: pot.view.smokeRig?.snapshot?.() || null, render: {...pot.renderState},
    pose: {x: round(pot.body.x), y: round(pot.body.y), scaleX: round(pot.body.scale.x), scaleY: round(pot.body.scale.y), rotation: round(pot.body.rotation)}, events: pot.events.map(event => ({...event})),
   }])), events: this.events.map(event => ({...event}))};
 }
 destroy() {
  if (this.destroyed) return;
  this.stop(); this.destroyed = true; this.offTick?.(); this.offResize?.();
  for (const pot of Object.values(this.pots)) {pot.view.animationManaged = false; this.resetPose(pot); this.scene.destroyNode(pot.host);}
  if (this.scene.cauldronAnimator === this) delete this.scene.cauldronAnimator;
 }
}
