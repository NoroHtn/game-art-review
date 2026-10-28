// Presentation-only PixiJS reel strips. The unchanged mock RGS owns all outcomes.
// Stop scheduling, Hermite approach and damped spring preserve the reviewed motion.
import { CRUISE, SPEED } from '../game/config.js';

export const easeOut = k => 1 - (1 - k) ** 3;
export const smoothstep = k => k * k * (3 - 2 * k);
export const MOTION_SPEED = Object.freeze({
  normal: {...SPEED.normal},
  quick: {...SPEED.quick, stopGap:55},
  turbo: {...SPEED.turbo, stopGap:30},
});
const clamp = (n,a,b) => Math.max(a,Math.min(b,n));

export class FrameClock {
  constructor({manual=false,maxDelta=34}={}) {
    this.manual=manual; this.maxDelta=maxDelta; this.now=0; this.listeners=new Set();
    this.jobs=new Set(); this.running=true; this.last=null; this.raf=null;
    this.visibility=()=>{this.last=null;};
    document.addEventListener('visibilitychange',this.visibility);
    this.frame=t=>{
      if(!this.running)return;
      if(!document.hidden){const dt=this.last===null?0:Math.max(0,t-this.last);this.step(dt);}
      this.last=t;this.raf=requestAnimationFrame(this.frame);
    };
    if(!manual)this.raf=requestAnimationFrame(this.frame);
  }
  // The live game binds this clock to Pixi's ticker before starting the app.
  // Manual clocks remain available to deterministic QA, with no browser or GPU.
  bindTicker(ticker) {
    if(this.manual)throw new Error('MANUAL_CLOCK_CANNOT_BIND_TICKER');
    if(this.raf!==null){cancelAnimationFrame(this.raf);this.raf=null;}
    if(this.ticker&&this.tickerTick)this.ticker.remove(this.tickerTick);
    this.ticker=ticker;this.last=null;
    this.tickerTick=()=>{
      if(!this.running)return;
      const now=performance.now();
      if(!document.hidden)this.step(this.last===null?0:Math.max(0,now-this.last));
      this.last=now;
    };
    ticker.add(this.tickerTick,undefined,50);
    return this;
  }
  onTick(fn) {this.listeners.add(fn);return ()=>this.listeners.delete(fn);}
  step(dt) {
    if(!this.running)return;dt=Math.max(0,dt);this.now+=dt;
    // Preserve visible elapsed time; cap only the physics integration step.
    for(const fn of [...this.listeners])fn(Math.min(dt,this.maxDelta),this.now);
    for(const job of [...this.jobs]){
      const k=job.duration<=0?1:clamp((this.now-job.start)/job.duration,0,1);
      try {job.update(job.ease(k),k,this.now);} catch(e){this.jobs.delete(job);job.reject(e);continue;}
      if(k>=1){this.jobs.delete(job);job.resolve();}
    }
  }
  tween(duration,update,ease=k=>k) {
    if(!this.running)return Promise.reject(new Error('CLOCK_DESTROYED'));
    return new Promise((resolve,reject)=>{
      const job={start:this.now,duration:Math.max(0,duration),update,ease,resolve,reject};
      try {update(duration<=0?1:0,duration<=0?1:0,this.now);}catch(e){reject(e);return;}
      if(duration<=0){resolve();return;}this.jobs.add(job);
    });
  }
  wait(ms) {return this.tween(ms,()=>{});}
  async advance(ms,{step=1000/120}={}) {
    if(!this.manual)throw new Error('MANUAL_CLOCK_REQUIRED');
    if(ms<0)throw new Error('CLOCK_CANNOT_REWIND; reset the scenario before another capture');
    let left=ms;while(left>1e-7){const dt=Math.min(left,step,this.maxDelta);this.step(dt);left-=dt;await Promise.resolve();}
    await Promise.resolve();return this.now;
  }
  async seek(time,options) {return this.advance(time-this.now,options);}
  destroy() {
    this.running=false;if(this.raf!==null)cancelAnimationFrame(this.raf);
    if(this.ticker&&this.tickerTick)this.ticker.remove(this.tickerTick);
    document.removeEventListener('visibilitychange',this.visibility);
    this.listeners.clear();for(const job of this.jobs)job.reject(new Error('CLOCK_DESTROYED'));this.jobs.clear();
  }
}

const FILLER=[1,2,3,4,5,6,7,8,1,2,3,4,14,9];
const tall = id => id>=15&&id<=19;

// Bake the reviewed vertical streak once per approved source; moving strips
// then crossfade two GPU textures instead of applying a filter every frame.
function makeBlurTexture(PIXI,texture) {
  const image=texture?.source?.resource;
  if(!image||typeof document.createElement!=='function')return texture;
  const sourceW=image.naturalWidth||image.width,sourceH=image.naturalHeight||image.height;
  if(!sourceW||!sourceH)return texture;
  const scale=Math.min(1,192/Math.max(sourceW,sourceH));
  const w=Math.max(1,Math.round(sourceW*scale)),h=Math.max(1,Math.round(sourceH*scale)),pad=Math.ceil(h*.22);
  const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h+pad*2;
  const g=canvas.getContext?.('2d');if(!g)return texture;
  g.filter=`blur(${Math.max(1,Math.round(w/160))}px)`;g.globalAlpha=2.4/16;
  for(let i=0;i<16;i++)g.drawImage(image,0,pad*2*i/15,w,h);
  return PIXI.Texture.from(canvas);
}

export class ReelMotion {
  constructor({scene,artResolver,fmt,clock,reducedMotion=false,onEvent}={}) {
    if(!scene)throw new Error('ReelMotion requires a Pixi scene');
    this.scene=scene;this.PIXI=scene.PIXI;this.artResolver=artResolver;
    this.fmt=fmt||(v=>(v/100).toFixed(2));this.clock=clock||new FrameClock();this.ownClock=!clock;
    this.reducedMotion=reducedMotion;this.onEvent=onEvent;this.textures=new Map();this.trace=[];
    this.active=false;this.pending=null;this.phase='IDLE';this.overlay=null;this.hidden=[];this.ownedTextures=new Set();
    this.offResize=scene.onResize?.(()=>{if(this.overlay)this.measure();});
    this.visibility=()=>{if(!document.hidden&&this.watchdogExpired)this.forceComplete('wall-watchdog');};
    document.addEventListener('visibilitychange',this.visibility);
  }
  emit(name,data={}) {
    const event={name,time:this.clock.now,...data};this.trace.push(event);if(this.trace.length>1000)this.trace.shift();
    this.onEvent?.(event);
    this.scene.boardAnchor?.dispatchEvent(new CustomEvent('motion:phase',{detail:event}));
  }
  async preload() {
    const blurs=new Map();
    for(let id=1;id<=19;id++){
      const texture=this.scene.texture(id),base=tall(id)?9:id;
      if(!texture)throw new Error('REEL_TEXTURE_FAILED: '+id);
      if(!blurs.has(base)){
        const source=this.scene.texture(base),blur=makeBlurTexture(this.PIXI,source);
        blurs.set(base,blur);if(blur!==source)this.ownedTextures.add(blur);
      }
      const value=this.artResolver?.(id),src=typeof value==='string'?value:value?.src;
      this.textures.set(id,{texture,blurTexture:blurs.get(base),src,w:texture.width,h:texture.height,base});
    }
    this.emit('textures-ready',{count:this.textures.size});return this;
  }
  measure() {
    const {board,cellW,cellH,gap,rowGap,pitch}=this.scene.geometry;
    this.gap=gap;this.rowGap=rowGap;this.cellW=cellW;this.cellH=cellH;this.pitch=pitch;
    this.overlay.position.set(board.x,board.y);
    if(this.columns)this.columns.forEach((r,c)=>{
      r.container.x=c*(cellW+gap);
      r.mask.clear().rect(0,0,cellW,board.height).fill(0xffffff);
      r.views.forEach(v=>{v.id=null;});this.render(r);
    });
  }
  makeView(host) {
    const container=new this.PIXI.Container();container.eventMode='none';host.addChild(container);
    return {container,element:container,sharp:null,blur:null,id:null,coin:null};
  }
  start(grid,{mode='normal',coins=this.coinResult||{}}={}) {
    if(this.active)throw new Error('REEL_MOTION_ALREADY_ACTIVE');
    if(!this.textures.size)throw new Error('AWAIT_REEL_PRELOAD_FIRST');
    this.finish();this.grid=grid.map(c=>c.slice());this.result=null;this.active=true;this.phase='SPIN_UP';
    this.startAt=this.clock.now;this.speed={...MOTION_SPEED[mode]};this.quickStopRequested=false;this.quickStopUsed=false;this.watchdogExpired=false;this.pending=null;
    this.overlay=new this.PIXI.Container();this.overlay.label='active-reel-strips';this.overlay.eventMode='none';
    (this.scene.columnsLayer||this.scene.layers.reels).addChild(this.overlay);
    this.columns=Array.from({length:5},(_,col)=>{
      const container=new this.PIXI.Container(),mask=new this.PIXI.Graphics();this.overlay.addChild(container);container.addChild(mask);container.mask=mask;
      const r={col,container,element:container,mask,views:[],q:0,p:0,start:0,v:0,phase:'spin',finals:new Map(),coins:new Map(),stopAt:null,speed:0,stopEmitted:false};
      for(let i=0;i<5;i++)r.views.push(this.makeView(container));
      grid[col].forEach((id,row)=>{r.finals.set(row,id);if(coins[col*3+row]!==undefined)r.coins.set(row,coins[col*3+row]);});return r;
    });
    this.measure();
    for(const cell of this.scene.cells){this.hidden.push([cell.content,cell.content.visible]);cell.content.visible=false;}
    this.offTick=this.clock.onTick((dt,now)=>this.tick(dt,now));this.emit('spin-start');
    this.watchdog=setTimeout(()=>{if(document.hidden)this.watchdogExpired=true;else this.forceComplete('wall-watchdog');},25000);
    return this;
  }
  stop(resultGrid,coins={},options={}) {
    if(!this.active)return Promise.reject(new Error('START_REELS_FIRST'));
    if(this.pending)return this.pending;
    this.result=resultGrid.map(c=>c.slice());this.coinResult={...coins};this.options=options;
    this.speed={...MOTION_SPEED[options.mode||'normal']};this.phase='SPINNING';
    const first=Math.max(this.clock.now,this.startAt+this.speed.minSpin);let extra=0;
    this.columns.forEach((r,c)=>{
      const before=resultGrid.slice(0,c).flat().filter(id=>id===14).length;
      r.tease=this.speed.teaseGap>0&&before>=4&&before<6&&before+3*(5-c)>=6;
      if(r.tease)extra+=this.speed.teaseGap*.6;
      r.stopAt=first+c*this.speed.stopGap+extra;r.teased=false;
    });
    this.emit('outcome-ready',{mode:options.mode||'normal',stopSchedule:this.columns.map(r=>r.stopAt)});
    if(options.quickStop===true)this.requestQuickStop();
    this.pending=new Promise(resolve=>{this.resolve=resolve;});return this.pending;
  }
  requestQuickStop() {if(!this.active||this.quickStopUsed)return false;this.quickStopRequested=true;return true;}
  applyQuickStop(now) {
    if(!this.result||!this.quickStopRequested||this.quickStopUsed)return;
    this.quickStopUsed=true;const gap=this.options.mode==='turbo'?30:55;
    let n=0;for(const r of this.columns)if(r.phase==='spin'){r.stopAt=Math.min(r.stopAt,now+n*gap);r.tease=false;n++;}
    this.emit('quick-stop',{gap});
  }
  setView(v,id,coin) {
    if(v.id===id&&v.coin===coin)return;
    v.id=id;v.coin=coin;
    if(v.sharp)this.scene.destroyNode(v.sharp);
    if(v.blur)this.scene.destroyNode(v.blur);
    const t=this.textures.get(id)||this.textures.get(1);
    v.sharp=this.scene.createSymbol(id,coin,{width:this.cellW,height:this.cellH});
    v.blur=new this.PIXI.Sprite(t.blurTexture||t.texture);
    v.blur.anchor.set(.5);v.blur.position.set(this.cellW/2,this.cellH/2);
    v.blur.width=this.cellW*.9;v.blur.height=this.cellH*.9*1.44;v.blur.alpha=0;
    v.container.addChild(v.sharp,v.blur);
  }
  render(r) {
    const base=Math.floor(r.q)-1;
    for(let idx=base;idx<base+5;idx++){
      const v=r.views[((idx%5)+5)%5],id=r.finals.get(idx)??FILLER[((idx*2654435761+r.col*97)>>>0)%FILLER.length];
      this.setView(v,id,r.coins.get(idx));v.container.y=(idx-r.q)*this.pitch;
      const k=this.reducedMotion?0:clamp(r.speed,0,1);v.sharp.alpha=1-k;v.blur.alpha=k;
    }
  }
  beginStop(r,now) {
    const speed=this.speed,w=19.6*250/Math.max(40,speed.settle),z=.45,wd=w*Math.sqrt(1-z*z),tp=Math.atan2(wd,z*w)/wd;
    r.sw={w,z,wd,v1:speed.bounce/(Math.sin(wd*tp)*Math.exp(-z*w*tp)/wd)/1000};
    r.L=Math.ceil(r.p)+3;r.ps=r.p;r.ts=now;r.v0=r.v||CRUISE;
    r.D=clamp(3*(r.L-r.p)/(r.v0+2*r.sw.v1),80,1600);
    // Quick/turbo are a minimum distance between visible impacts, not just between
    // requests to decelerate. Different strip fractions otherwise bunch the stops.
    const previous=this.columns[r.col-1],floor=this.options.mode==='turbo'?30:this.options.mode==='quick'||this.quickStopUsed?55:0;
    if(floor&&previous?.impactAt!==undefined)r.D=Math.max(r.D,previous.impactAt+floor+this.clock.maxDelta-now);
    r.impactAt=now+r.D;r.phase='decel';this.phase='STOPPING';
    this.result[r.col].forEach((id,row)=>{const idx=r.start-r.L+row;r.finals.set(idx,id);const value=this.coinResult[r.col*3+row];if(value!==undefined)r.coins.set(idx,value);});
    this.emit('reel-decelerate',{col:r.col,duration:r.D});
  }
  tick(dt,now) {
    if(!this.active)return;
    const sp=this.speed||MOTION_SPEED.normal;
    if(typeof this.options?.quickStop==='function'&&this.options.quickStop())this.requestQuickStop();this.applyQuickStop(now);
    if(this.reducedMotion){
      if(!this.result)return;
      const elapsed=now-this.startAt;
      if(elapsed>=Math.min(350,sp.minSpin)){for(const r of this.columns){r.q=0;r.p=0;r.speed=0;r.finals=new Map(this.result[r.col].map((id,row)=>[row,id]));r.coins=new Map(this.result[r.col].map((_,row)=>[row,this.coinResult[r.col*3+row]]));this.render(r);if(!r.stopEmitted){this.emitImpact(r);r.phase='idle';}}this.complete();}
      else this.overlay.alpha=1-clamp(elapsed/350,0,.25);return;
    }
    for(const r of this.columns){
      if(r.phase==='spin'){
        const el0=now-this.startAt-r.col*(sp.stagger||0),kick=sp.kick||0,el=el0-kick;
        if(el0<0){r.speed=0;}
        else if(el<0&&kick){const u=el0/kick,V0=.15*CRUISE;r.p=-.04*(1-Math.cos(2*Math.PI*u))+V0*kick*(u*u*u-u*u);r.speed=0;}
        else {const u=clamp(el/sp.accel,0,1),V0=.15*CRUISE;let velocity=V0+(CRUISE-V0)*smoothstep(u);
          if(r.tease&&r.stopAt!==null&&now>=r.stopAt-sp.teaseGap*.6){if(!r.teased){r.teased=true;this.emit('reel-anticipation',{col:r.col});}velocity*=.45;}
          r.v=r.v===0?velocity:r.v+(velocity-r.v)*(1-Math.exp(-dt/70));r.p=Math.max(0,r.p)+r.v*Math.min(dt,Math.max(0,el));r.speed=r.v/CRUISE;
        }
        if(this.result&&r.stopAt!==null&&now>=r.stopAt)this.beginStop(r,now);
      }else if(r.phase==='decel'){
        const k=clamp((now-r.ts)/r.D,0,1),k2=k*k,k3=k2*k;
        r.p=(2*k3-3*k2+1)*r.ps+(k3-2*k2+k)*r.D*r.v0+(-2*k3+3*k2)*r.L+(k3-k2)*r.D*r.sw.v1;
        r.speed=Math.max(0,1-k*1.25);
        if(k>=1){r.phase='bounce';r.tb=now;r.p=r.L;r.speed=0;r.q=r.start-r.p;this.render(r);this.emitImpact(r);}
      }else if(r.phase==='bounce'){
        const {w,z,wd,v1}=r.sw,t=(now-r.tb)/1000,env=Math.exp(-z*w*t);r.p=r.L+v1*1000/wd*env*Math.sin(wd*t);
        if(env<.01){r.p=r.L;r.phase='idle';this.emit('reel-settled',{col:r.col});}
      }
      r.q=r.start-r.p;this.render(r);
    }
    if(this.result&&this.columns.every(r=>r.phase==='idle'))this.complete();
    else if(this.result&&now-this.startAt>20000)this.forceComplete('clock-watchdog');
  }
  emitImpact(r) {
    if(r.stopEmitted)return;r.stopEmitted=true;this.emit('reel-impact',{col:r.col});this.options?.onReelStop?.(r.col,{time:this.clock.now,grid:this.result[r.col]});
  }
  complete() {
    if(!this.active)return;this.active=false;this.phase='LANDED';this.offTick?.();this.offTick=null;clearTimeout(this.watchdog);
    this.emit('spin-settled');const resolve=this.resolve;this.resolve=null;resolve?.({grid:this.result,coins:this.coinResult,trace:this.trace});
  }
  forceComplete(reason) {
    if(!this.active||!this.result)return;this.emit('motion-watchdog',{reason});
    for(const r of this.columns){r.q=0;r.p=0;r.phase='idle';r.speed=0;r.finals=new Map(this.result[r.col].map((id,row)=>[row,id]));r.coins=new Map(this.result[r.col].map((_,row)=>[row,this.coinResult[r.col*3+row]]));this.render(r);this.emitImpact(r);}
    this.complete();
  }
  finish() {
    this.offTick?.();this.offTick=null;clearTimeout(this.watchdog);
    for(const [node,visible]of this.hidden)if(!node.destroyed)node.visible=visible;this.hidden=[];
    if(this.overlay)this.scene.destroyNode(this.overlay);
    this.overlay=null;this.columns=null;this.active=false;this.pending=null;this.phase='IDLE';
  }
  reset() {
    if(this.active&&this.result)this.forceComplete('reset');else if(this.resolve){this.resolve({cancelled:true});this.resolve=null;}
    this.finish();
  }
  destroy(){
    this.reset();this.offResize?.();document.removeEventListener('visibilitychange',this.visibility);
    for(const texture of this.ownedTextures)texture.destroy(true);this.ownedTextures.clear();
    if(this.ownClock)this.clock.destroy();
  }
}
