// PixiJS presentation only. Amounts, symbol outcomes and locked coins are supplied
// by the unchanged mock RGS; sprites never decide or change a payout.
import {LINES, REDUCED} from '../game/config.js';
const out=k=>1-(1-k)**3, smooth=k=>k*k*(3-2*k);
const destroyed=node=>!node||node.destroyed;

export class Presentation {
 constructor({clock,scene,url,fmt,trace=()=>{}}){
  Object.assign(this,{clock,scene,url,fmt,trace});
  this.nodes=new Set();this.animations=new Set();this.generation=0;
 }
 animate(ms,fn,skip=()=>false){
  ms=REDUCED?Math.min(ms,120):ms;
  const start=this.clock.now,generation=this.generation;fn(0);
  return new Promise((resolve,reject)=>{
   let off;const finish=error=>{off?.();this.animations.delete(cancel);error?reject(error):resolve();};
   const cancel=()=>finish();this.animations.add(cancel);
   off=this.clock.onTick(()=>{
    if(generation!==this.generation){finish();return;}
    const k=skip()?1:Math.min(1,(this.clock.now-start)/Math.max(1,ms));
    try{fn(k);}catch(error){finish(error);return;}if(k===1)finish();
   });
  });
 }
 async pulse(node,amount=.045,ms=420){
  if(node===this.scene.boardContainer){
   await Promise.all(['board','cells','reels','lines'].map(name=>this.pulseNode(this.scene.layers[name],amount,ms)));return;
  }
  return this.pulseNode(node,amount,ms);
 }
 async pulseNode(node,amount,ms){
  if(destroyed(node)||!node.scale)return;
  const x=node.scale.x,y=node.scale.y,px=node.x,py=node.y,bounds=node.getLocalBounds?.();
  const cx=bounds?bounds.x+bounds.width/2:0,cy=bounds?bounds.y+bounds.height/2:0;
  try{await this.animate(ms,k=>{if(!destroyed(node)){
   const factor=1+Math.sin(k*Math.PI)*amount;node.scale.set(x*factor,y*factor);
   node.position.set(px+(1-factor)*cx*x,py+(1-factor)*cy*y);
  }});}finally{if(!destroyed(node)){node.scale.set(x,y);node.position.set(px,py);}}
 }
 async count(el,from,to,ms=900,{skip=()=>false,onValue=()=>{}}={}){
  const generation=this.generation,set=value=>{'textContent'in el?el.textContent=this.fmt(value):el.text=this.fmt(value);};
  let last=-1;await this.animate(ms,k=>{
   const t=.62*smooth(k)+.38*k,v=k===1?to:Math.round(from+(to-from)*t);
   if(v!==last){set(v);onValue(v);last=v;}
  },skip);
  if(generation===this.generation){set(to);onValue(to);}
 }
 async flight(src,from,to,ms=480,skip=()=>false,{harmonic=false}={}){
  if(REDUCED||skip())return;
  const {PIXI}=this.scene,node=new PIXI.Sprite(this.scene.texture(src));
  const size=Math.min(64,Math.max(30,from.width*.64));
  const fit=Math.min(size/node.texture.width,size/node.texture.height);
  node.anchor.set(.5);node.scale.set(fit);node.eventMode='none';
  const x0=from.x+from.width/2,y0=from.y+from.height/2;
  const destination=()=>typeof to==='function'?to():to;
  node.position.set(x0,y0);(this.scene.effectsLayer||this.scene.layers.effects).addChild(node);this.nodes.add(node);
  try{await this.animate(ms,k=>{
   if(destroyed(node))return;
   const target=destination(),dx=target.x+target.width/2-x0,dy=target.y+target.height/2-y0;
   // Collection glides into the mouth with zero endpoint velocity, then the
   // vessel absorbs the arrival. Other presentation flights retain their pace.
   const t=harmonic?k*k*k*(10+k*(-15+6*k)):k;
   const arc=harmonic?Math.min(90,Math.max(38,Math.abs(dy)*.35)):110;
   node.position.set(x0+dx*t,y0+dy*t-arc*4*t*(1-t));
   node.scale.set(fit*(harmonic?1-.9*smooth(k):.9*(1-k)**.65+.06));
   if(harmonic){node.rotation=Math.sin(k*Math.PI)*.13;node.alpha=1-smooth(Math.max(0,(k-.84)/.16));}
  },skip);}finally{this.removeNode(node);}
 }
 removeNode(node){this.nodes.delete(node);if(!destroyed(node))this.scene.destroyNode(node);}
 async collect(gems,onArrival){
  const generation=this.generation;
  const ordered=[...gems].sort((a,b)=>(a.cell%3)*5+Math.floor(a.cell/3)-(b.cell%3)*5-Math.floor(b.cell/3));
  await Promise.all(ordered.map(async(gem,i)=>{
   await this.clock.wait(i*(ordered.length>8?230:320));if(generation!==this.generation)return;
   const index=(gem.cell%3)*5+Math.floor(gem.cell/3),cell=this.scene.cells[index];
   const source=this.scene.cellRect(index),potRect=this.scene.potRect(gem.pot);
   const target=()=>this.scene.cauldronAnimator?.mouthRect(gem.pot)||{...potRect,height:potRect.height*.4};
   await this.pulse(cell.content,.04,130);if(generation!==this.generation)return;
   await this.flight(cell.id,this.scene.cellRect(index),target,560,()=>false,{harmonic:true});
   if(generation!==this.generation)return;
   const reaction=onArrival(gem);this.trace('pot-arrival',{pot:gem.pot,level:gem.level});await reaction;
   const pot=this.scene.pots?.[gem.pot]||this.scene.potViews?.[gem.pot];
   if(pot&&!this.scene.cauldronAnimator)await this.pulse(pot.sprite||pot.container||pot,.045,300);
  }));
 }
 clearFocus(){this.scene.clearFocus();}
 focus(grid,wins,{neutral=false}={}){
  this.scene.focus(grid,wins,{neutral});
  const lit=new Set();for(const win of wins)for(let col=0;col<win.count;col++)lit.add((LINES[win.line-1][col]-1)*5+col);
  for(let col=0;col<5;col++)for(let row=0;row<3;row++){
   const count=grid[col][row]===15?2:grid[col][row]===17?3:0;
   if(count&&Array.from({length:count},(_,k)=>(row+k)*5+col).some(i=>lit.has(i)))lit.add(row*5+col);
  }
  return [...lit].map(index=>this.scene.cells[index].content).filter(node=>!destroyed(node)&&node.visible);
 }
 async winTake(grid,wins,{neutral=false,ms=900,skip=()=>false}={}){
  const nodes=this.focus(grid,wins,{neutral}),initial=nodes.map(node=>{const bounds=node.getLocalBounds();return {node,x:node.scale.x,y:node.scale.y,px:node.x,py:node.y,cx:bounds.x+bounds.width/2,cy:bounds.y+bounds.height/2};});
  try{await this.animate(ms,k=>{
   if(neutral||REDUCED)return;
   const p=k<.4?out(k/.4):1-out((k-.4)/.6);
   for(const {node,x,y,px,py,cx,cy}of initial)if(!destroyed(node)){node.scale.set(x*(1+p*.045),y*(1+p*.045));node.position.set(px-p*.045*cx*x,py-p*2-p*.045*cy*y);}
  },skip);}finally{for(const {node,x,y,px,py}of initial)if(!destroyed(node)){node.scale.set(x,y);node.position.set(px,py);}}
 }
 async transition(swap,reverse=false){
  const generation=this.generation,{PIXI}=this.scene,cover=new PIXI.Container(),background=new PIXI.Graphics();
  cover.label=reverse?'return-transition':'feature-transition';cover.eventMode='none';cover.alpha=0;
  const symbol=new PIXI.Sprite(this.scene.texture(this.url('cauldron_super_2')));symbol.anchor.set(.5);
  const title=new PIXI.Text({text:'HOLD & WIN',style:{fontFamily:'Georgia, serif',fontSize:36,fontWeight:'bold',fill:0xffdda2,letterSpacing:2}});title.anchor.set(.5);
  const note=new PIXI.Text({text:reverse?'RETURNING TO BASE GAME':'COINS LOCK · NEW COINS RESET TO 3',style:{fontFamily:'Arial, sans-serif',fontSize:11,fill:0xd8c0e5,letterSpacing:1.4}});note.anchor.set(.5);
  cover.addChild(background,symbol,title,note);(this.scene.effectsLayer||this.scene.layers.effects).addChild(cover);this.nodes.add(cover);
  const layout=()=>{
   const screen=this.scene.app.screen||this.scene.app.renderer.screen,width=screen.width,height=screen.height;
   background.clear().rect(0,0,width,height).fill({color:0x170d29,alpha:.985});
   const artWidth=Math.min(360,width*.65),artHeight=Math.min(240,height*.5),fit=Math.min(artWidth/symbol.texture.width,artHeight/symbol.texture.height);
   symbol.scale.set(fit);symbol.position.set(width/2,height*.42);symbol.baseScale=fit;
   title.style.fontSize=Math.min(36,width*.065);title.position.set(width/2,height*.42+artHeight/2+35);
   note.style.fontSize=Math.min(11,width*.025);note.position.set(width/2,height*.42+artHeight/2+66);
  };layout();const offResize=this.scene.onResize?.(layout);
  try{
   await this.animate(420,k=>{if(!destroyed(cover)){cover.alpha=smooth(k);symbol.scale.set(symbol.baseScale*(.94+.06*smooth(k)));}});
   if(generation!==this.generation)return;
   await swap();this.trace('transition-swap',{reverse});await this.clock.wait(180);
   if(generation!==this.generation)return;
   await this.animate(360,k=>{if(!destroyed(cover))cover.alpha=1-smooth(k);});
  }finally{offResize?.();this.removeNode(cover);}
 }
 async trigger(coins){
  const list=Object.keys(coins).map(Number).sort((a,b)=>(a%3)*5+Math.floor(a/3)-(b%3)*5-Math.floor(b/3)),generation=this.generation;
  await Promise.all(list.map(async(pos,i)=>{
   await this.clock.wait(i*70);if(generation===this.generation)await this.pulse(this.scene.cells[(pos%3)*5+Math.floor(pos/3)].content,.08,450);
  }));
 }
 async tally(board,total,onArrival,skip=()=>false){
  const generation=this.generation,entries=Object.entries(board).sort(([a],[b])=>Number(a)-Number(b));let sum=0;
  const destination=()=>this.scene.toLocalRect(document.getElementById('win').getBoundingClientRect());
  await Promise.all(entries.map(async([pos,coin],i)=>{
   await this.animate(i*Math.min(210,2300/Math.max(1,entries.length-1)),()=>{},skip);if(generation!==this.generation)return;
   await this.flight(this.url('value_coin_blank'),this.scene.cellRect(Number(pos)),destination(),450,skip);
   if(generation!==this.generation)return;
   sum+=coin.value;this.scene.setCellState(Number(pos),{spent:true});onArrival(sum);this.trace('tally-arrival',{cell:Number(pos),sum});
  }));
  if(generation!==this.generation)return;
  if(total>sum){await this.clock.wait(180);if(generation!==this.generation)return;onArrival(total);this.trace('grand-added',{amount:total-sum});}onArrival(total);
 }
 cleanup(){
  this.generation++;for(const cancel of [...this.animations])cancel();this.animations.clear();
  this.clearFocus();for(const node of [...this.nodes])this.removeNode(node);
 }
}

// Fifteen independent Pixi cell reels. Confirmed locked coins stay in their
// original cell containers while only empty masks receive moving faces.
export class BonusMotion {
 constructor({clock,scene,url,fmt,trace=()=>{}}){Object.assign(this,{clock,scene,url,fmt,trace});this.active=[];this.generation=0;}
 start(board){
  this.cleanup();this.started=this.clock.now;const {PIXI}=this.scene;
  for(let index=0;index<15;index++)if(!board[index]){
   const cell=this.scene.cells[index],host=new PIXI.Container(),mask=new PIXI.Graphics();host.label=`bonus-reel-${index}`;host.eventMode='none';
   host.addChild(mask);host.mask=mask;(this.scene.columnsLayer||this.scene.layers.reels).addChild(host);
   const views=Array.from({length:3},()=>{const box=new PIXI.Container();host.addChild(box);return {box,symbol:null,blur:null};});
   const reel={i:index,cell,host,mask,views,q:0,phase:'cruise',height:cell.height,coin:null};this.active.push(reel);
  }
  this.measure();this.offResize=this.scene.onResize?.(()=>this.measure());
  this.off=this.clock.onTick(dt=>{for(const reel of this.active){if(reel.phase==='cruise'&&!REDUCED)reel.q+=dt*.02;this.render(reel);}});
  this.trace('bonus-spin-start',{empty:this.active.length});
 }
 measure(){
  for(const reel of this.active){
   if(destroyed(reel.host)||reel.phase==='done')continue;
   const rect=this.scene.cellRect(reel.i);reel.height=rect.height;reel.host.position.set(rect.x,rect.y);
   reel.mask.clear().rect(0,0,rect.width,rect.height).fill(0xffffff);
   for(const view of reel.views){
    if(view.symbol)this.scene.destroyNode(view.symbol);if(view.blur)this.scene.destroyNode(view.blur);
    view.symbol=this.scene.createSymbol(14,undefined,{width:rect.width,height:rect.height});view.box.addChild(view.symbol);
    if(this.blurTexture){view.blur=new this.scene.PIXI.Sprite(this.blurTexture);view.blur.anchor.set(.5);view.blur.position.set(rect.width/2,rect.height/2);view.blur.width=rect.width*.88;view.blur.height=rect.height*.9*1.44;view.box.addChild(view.blur);}
   }
   this.render(reel);
  }
 }
 render(reel){
  if(destroyed(reel.host)||reel.phase==='done')return;
  if(REDUCED){reel.host.visible=false;return;}
  const floor=Math.floor(reel.q),fraction=reel.q-floor;
  reel.views.forEach((view,j)=>{
   const index=floor+j,final=index===reel.L,show=final?!!reel.coin:((index*13+reel.i*7)%9<3);
   view.box.y=(fraction-j)*reel.height;view.box.alpha=show?1:0;
   if(view.blur){const moving=reel.phase==='cruise'||reel.phase==='decelerate';view.blur.visible=moving;view.symbol.visible=!moving;}
  });
 }
 async stop(result,{mode,onStop}={}){
  const generation=this.generation,floor=mode==='turbo'?160:mode==='quick'?300:600;
  await this.clock.wait(Math.max(0,floor-(this.clock.now-this.started)));if(generation!==this.generation)return;
  const gap=mode==='turbo'?30:mode==='quick'?55:85,tease=this.active.length<=3&&mode==='normal'?1100:0;
  await Promise.all(this.active.map(async(reel,i)=>{
   await this.clock.wait(i*gap+(i===this.active.length-1?tease:0));if(generation!==this.generation)return;
   reel.phase='decelerate';reel.coin=result.board[reel.i]||null;const q0=reel.q;reel.L=Math.ceil(q0)+5;const target=reel.L+.2,d=400,v0=.02;
   await this.clock.tween(REDUCED?100:d,k=>{if(generation!==this.generation)return;const k2=k*k,k3=k2*k;reel.q=(2*k3-3*k2+1)*q0+(k3-2*k2+k)*v0*d+(-2*k3+3*k2)*target;this.render(reel);});
   if(generation!==this.generation)return;
   reel.phase='settle';onStop?.(reel.i,reel.coin);this.trace('bonus-cell-stop',{cell:reel.i,landed:!!result.landed[reel.i],reset:!!result.landed[reel.i]});
   reel.host.visible=false;
   const content=this.scene.cells[reel.i].content,y=content.y;
   if(reel.coin)await this.clock.tween(REDUCED?80:250,k=>{if(!destroyed(content)&&generation===this.generation)content.y=y+.2*reel.height*(1-out(k));});
   if(!destroyed(content))content.y=y;reel.phase='done';
   if(!destroyed(reel.host))this.scene.destroyNode(reel.host);
  }));
  if(generation===this.generation)this.cleanup();
 }
 cleanup(){
  this.generation++;this.off?.();this.off=null;this.offResize?.();this.offResize=null;
  for(const reel of this.active)if(!destroyed(reel.host))this.scene.destroyNode(reel.host);this.active=[];
 }
}
