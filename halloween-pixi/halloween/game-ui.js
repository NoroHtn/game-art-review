// Existing Edgar UI art, adapted to the Halloween responsive scene (PixiJS 8).
import {logoText} from './logo-type.js?v=edgar-ui-r5-20261029';
import {cartoonWin,warmCartoon} from './bigwin-cartoon.js?v=edgar-ui-r5-20261029';
const names=['banner-big','banner-mega','banner-epic','digits-candy','total-frame','pip-on','pip-off','pip-flash','cell-empty','sparkle_03',...Array.from({length:8},(_,i)=>`coin-spin_0${i}`)];
const smooth=k=>{k=Math.max(0,Math.min(1,k));return k*k*(3-2*k);};
export class GameUI {
 constructor({scene,clock,fmt,trace=()=>{}}){Object.assign(this,{scene,clock,fmt,trace});this.lastPips=3;this.refillAt=-Infinity;this.art={};}
 async init(){
  const {PIXI}=this.scene;
  await Promise.all(names.map(async name=>{this.art[name]=await PIXI.Assets.load(new URL(`./assets/edgar/${name}.webp`,import.meta.url).href);}));
  this.art.counter=await PIXI.Assets.load(new URL('./assets/edgar/counter-frame.png',import.meta.url).href);
  this.root=new PIXI.Container();this.root.label='edgar-halloween-ui';this.root.eventMode='none';this.scene.root.addChildAt(this.root,this.scene.root.getChildIndex(this.scene.layers.effects));
  this.logo=logoText('HALLOWEEN',100,{tabular:false,tracking:1});this.root.addChild(this.logo);
  this.bonus=new PIXI.Container();this.bonus.label='hold-and-win-design';this.root.addChild(this.bonus);
  this.bonusTitle=logoText('HOLD & WIN',65,{tabular:false});this.bonus.addChild(this.bonusTitle);
  this.total=new PIXI.Container();this.bonus.addChild(this.total);
  this.totalFrame=new PIXI.Sprite(this.art['total-frame']);this.totalFrame.anchor.set(.5);this.total.addChild(this.totalFrame);
  this.totalLabel=logoText('TOTAL COLLECTED',25,{tabular:false});this.total.addChild(this.totalLabel);
  this.totalValue=logoText('0.00',55);this.total.addChild(this.totalValue);
  this.pipLabel=logoText('RESPINS',32,{tabular:false});this.bonus.addChild(this.pipLabel);
  this.pips=Array.from({length:3},()=>{const p=new PIXI.Sprite(this.art['pip-on']);p.anchor.set(.5);this.bonus.addChild(p);return p;});
  this.tiles=new PIXI.Container();this.tiles.label='bonus-approved-cell-art';this.scene.layers.board.addChild(this.tiles);
  this.cellTiles=Array.from({length:15},()=>{const s=new PIXI.Sprite(this.art['cell-empty']);this.tiles.addChild(s);return s;});
  // All source title glyph textures are created before the first paid moment.
  const warm=warmCartoon();warm.destroy({children:true});
  this.scene.mount.classList.add('edgar-ui-ready');this.offResize=this.scene.onResize(()=>this.layout());
  this.offTick=this.clock.onTick(()=>this.tick());this.layout();this.update({bonus:null,visibleCoins:{},respins:3});return this;
 }
 layout(){
  const {scene}=this,b=scene.geometry.board,h=scene.mount.querySelector('.wordmark h1'),r=scene.toSceneRect(h.getBoundingClientRect());
  this.logo.scale.set(1);const lb=this.logo.getLocalBounds();this.logo.scale.set(Math.min(r.width*.98/lb.width,r.height*1.15/lb.height));this.logo.position.set(r.x+r.width/2,r.y+r.height/2);
  const area=scene.toSceneRect(scene.potsAnchor.getBoundingClientRect()),cx=b.x+b.width/2;
  const titleSize=Math.min(b.width*.30,260);this.bonusTitle.scale.set(1);this.bonusTitle.width=titleSize;this.bonusTitle.scale.y=this.bonusTitle.scale.x;
  this.bonusTitle.position.set(cx,area.y+area.height*.16);
  const w=Math.min(b.width*.56,375),fit=w/this.art['total-frame'].width;
  this.totalFrame.scale.set(fit);this.total.position.set(b.x+b.width*.34,area.y+area.height*.65);
  this.totalLabel.scale.set(fit*2);this.totalValue.scale.set(fit*2);this.totalLabel.y=-this.art['total-frame'].height*fit*.23;this.totalValue.y=this.art['total-frame'].height*fit*.12;
  const x=b.x+b.width*.82,y=area.y+area.height*.65,pipSize=Math.min(55,b.width*.075);
  this.pipLabel.scale.set(Math.min(1,b.width/650));this.pipLabel.position.set(x,y-pipSize*.76);
  this.pips.forEach((p,i)=>{p.position.set(x+(i-1)*pipSize*.96,y+pipSize*.30);p.scale.set(pipSize/p.texture.width);p.baseScale=p.scale.x;});
  const {cellW,cellH,gap,rowGap}=scene.geometry;
  this.cellTiles.forEach((t,i)=>{t.position.set(b.x+(i%5)*(cellW+gap),b.y+Math.floor(i/5)*(cellH+rowGap));t.width=cellW;t.height=cellH;});
  this.layoutWin?.();
 }
 update(state){
  if(!this.root)return;this.state=state;const active=!!state.bonus;
  this.bonus.visible=this.tiles.visible=active;this.scene.layers.pots.visible=!active;
  this.totalValue.text=this.fmt(Object.values(state.visibleCoins||{}).reduce((n,c)=>n+c.value,0));
  if(state.respins>this.lastPips)this.refillAt=this.clock.now;
  this.lastPips=state.respins;this.pips.forEach((p,i)=>p.texture=this.art[i<state.respins?'pip-on':'pip-off']);this.tick();
 }
 tick(){
  if(!this.state?.bonus)return;
  for(const[p,i]of this.pips.map((p,i)=>[p,i])){const age=(this.clock.now-this.refillAt-i*65)/420,pulse=age>0&&age<1?Math.sin(age*Math.PI):0;
   p.scale.set(p.baseScale*(1+pulse*.13));p.alpha=i<this.lastPips?1:.75;
  }
 }
 async ceremony(total,{bet,turbo=false,label,fmt=this.fmt,onValue,onSkipReady,onTier,reducedMotion=false}={}){
  const {PIXI}=this.scene,host=new PIXI.Container();host.label='edgar-win-ceremony';this.scene.effectsLayer.addChild(host);
  const layout=()=>{const s=this.scene.app.screen,k=Math.min(s.width/1920,s.height/1080);host.scale.set(k);host.position.set((s.width-1920*k)/2,(s.height-1080*k)/2);};
  this.layoutWin=layout;layout();this.scene.mount.classList.add('ceremony-active');
  try{
   if(reducedMotion){
    const title=label||(total/bet>=100?'EPIC WIN':total/bet>=50?'MEGA WIN':total/bet>=30?'SUPER WIN':'BIG WIN');
    const ribbon=new PIXI.Sprite(this.art[total/bet>=100?'banner-epic':total/bet>=30?'banner-mega':'banner-big']);ribbon.anchor.set(.5);ribbon.width=960;ribbon.scale.y=ribbon.scale.x;ribbon.position.set(960,420);host.addChild(ribbon);
    const heading=logoText(title,110,{tabular:false});heading.position.set(960,420);host.addChild(heading);
    const amount=logoText(fmt(total),150);amount.position.set(960,700);host.addChild(amount);onTier?.(title);onValue?.(total);
    await new Promise(resolve=>{let off;const start=this.clock.now,finish=()=>{off?.();resolve();};this.cancelCeremony=finish;onSkipReady?.(finish);off=this.clock.onTick((dt,now)=>{if(now-start>=1000)finish();});});
    return;
   }
   await cartoonWin({layer:host,viewBounds:()=>{const s=this.scene.app.screen,k=host.scale.x;return{x:-host.x/k,y:-host.y/k,width:s.width/k,height:s.height/k};},clock:this.clock,total,bet,turbo:turbo||reducedMotion,label,fmt,onValue,onSkipReady,onTier:t=>{this.currentTier=t;onTier?.(t);},onFrame:state=>this.ceremonyState=state,reducedMotion,
   art:{big:this.art['banner-big'],mega:this.art['banner-mega'],epic:this.art['banner-epic'],frame:this.art.counter,digits:this.art['digits-candy'],sparkle:[this.art['sparkle_03']]},
   coinFrames:reducedMotion?[]:Array.from({length:8},(_,i)=>this.art[`coin-spin_0${i}`]),onCancelReady:fn=>this.cancelCeremony=fn});
  }finally{this.cancelCeremony=null;this.ceremonyState=null;this.layoutWin=null;host.destroy({children:true});this.scene.mount.classList.remove('ceremony-active');}
 }
 snapshot(){return{source:"Edgar 9afbbfc",logo:"HALLOWEEN",bonusVisible:!!this.bonus?.visible,respins:this.lastPips,activeTier:this.ceremonyState?this.currentTier:null,ceremony:this.ceremonyState||null};}
 destroy(){this.cancelCeremony?.();this.offTick?.();this.offResize?.();this.root.destroy({children:true});this.tiles.destroy({children:true});}
}
