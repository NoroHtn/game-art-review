import {FrameClock,ReelMotion} from './reel-motion.js?v=edgar-ui-r5-20261029';
import {BonusMotion} from './presentation.js';
import {createScene} from './pixi-scene.js?v=edgar-ui-r5-20261029';
import {REDUCED} from '../game/config.js';

const FPS=32,PER_PAGE=16,REPLY_AT=300;
const CLIPS={normal:{mode:'normal',duration:2.5},quick:{mode:'quick',duration:2},turbo:{mode:'turbo',duration:1.5},miss:{mode:'normal',duration:2.5,miss:true},nearfull:{mode:'normal',duration:3.25,nearfull:true},reduced:{mode:'normal',duration:1.75,reduced:true}};
const ART={1:'low_j',2:'low_q',3:'low_k',4:'low_a',5:'book_latest',6:'lantern_latest',7:'potion_latest',8:'hat_latest',9:'wild_3cell',10:'bat_mystery',11:'bat_multi',12:'bat_collect',13:'bat_pearl',14:'value_coin_blank',15:'wild_3cell',16:'wild_3cell',17:'wild_3cell',18:'wild_3cell',19:'wild_3cell'};
const APPROVED_ART_REVISION={book_latest:'514172a64299',bat_pearl:'5e1ddc236aa6'};
const url=name=>/^low_[jqka]$/.test(name)?`assets/${name}_authority.png`:`assets/${name}.webp${APPROVED_ART_REVISION[name]?`?v=${APPROVED_ART_REVISION[name]}`:''}`;
const src=id=>url(ART[id]),fmt=value=>(value/100).toFixed(2),$=id=>document.getElementById(id);
const params=new URLSearchParams(location.search),clip=CLIPS[params.get('clip')]?params.get('clip'):'normal',settings=CLIPS[clip];
const count=Math.ceil(settings.duration*FPS),pages=Math.ceil(count/PER_PAGE),page=Math.max(0,Math.min(pages-1,Number.parseInt(params.get('page')||'0',10)||0));
const navigate=(name,next)=>{const query=new URLSearchParams({clip:name,page:String(next)});if(CLIPS[name].reduced)query.set('reduced','1');location.assign(`bonus-atlas.html?${query}`);};
$('clip').value=clip;$('clip').onchange=()=>navigate($('clip').value,0);$('previous').disabled=page===0;$('next').disabled=page===pages-1;
$('previous').onclick=()=>navigate(clip,page-1);$('next').onclick=()=>navigate(clip,page+1);$('page-label').textContent=`${page+1} / ${pages}`;
const samples=[];window.__bonusAtlas={ready:false,engine:'PixiJS',clip,page,fps:FPS,pages,duration:settings.duration,reduced:REDUCED,replyAt:REPLY_AT,coverage:'BonusMotion only; not tally/flight/transition',samples};window.__atlas=window.__bonusAtlas;
function scenario(){
 const initial=settings.nearfull?Object.fromEntries(Array.from({length:12},(_,index)=>[index,{value:(index+1)*100}])):{0:{value:100},2:{value:200},5:{value:300},7:{value:400},10:{value:500},14:{value:600}};
 const landed=settings.miss?{}:settings.nearfull?{13:{value:2000}}:{1:{value:700},9:{value:800}};
 return {initial,result:{board:{...initial,...landed},landed,respins:Object.keys(landed).length?3:2,done:false,total:0,grand:0}};
}
function makeSample(frame){
 const article=document.createElement('article');article.className='atlas-sample';const caption=document.createElement('div');caption.className='atlas-caption';
 const left=document.createElement('span'),phase=document.createElement('span');left.textContent=`F${String(frame).padStart(3,'0')} · ${(frame/FPS).toFixed(5)}s`;caption.append(left,phase);
 const detail=document.createElement('div');detail.className='sample-detail';article.append(caption,detail);$('atlas').append(article);
 return {article,phase,detail,frame,time:frame*1000/FPS};
}
function observedPhase(motion,completed){if(completed)return'DONE';const phases=motion.active.map(reel=>reel.phase);return phases.includes('settle')?'SETTLING':phases.includes('decelerate')?'STOPPING':'CRUISE';}
function capture(scene,sample){
 scene.app.render();const canvas=scene.app.renderer.extract.canvas({target:scene.app.stage,frame:new scene.PIXI.Rectangle(0,0,320,200),resolution:1,antialias:true});
 canvas.className='atlas-capture';canvas.setAttribute('role','img');canvas.setAttribute('aria-label',`PixiJS frame capture of bonus frame ${sample.frame}`);sample.article.insertBefore(canvas,sample.detail);
}
async function build(){
 const scene=await createScene({mount:$('atlas-workspace'),boardAnchor:$('atlas-board'),potsAnchor:$('atlas-pots'),url,fmt,artResolver:src});
 scene.app.stop();scene.observer.disconnect();scene.layers.background.visible=false;scene.layers.pots.visible=false;
 const loaderClock=new FrameClock({manual:true}),loader=new ReelMotion({scene,clock:loaderClock,artResolver:src,fmt});await loader.preload();
 try{
  for(let slot=0;slot<PER_PAGE;slot++){
   const frame=page*PER_PAGE+slot;if(frame>=count){const empty=document.createElement('article');empty.className='atlas-sample empty';empty.textContent='End of clip';$('atlas').append(empty);continue;}
   const sample=makeSample(frame),{initial,result}=scenario();scene.renderBonus(initial);const clock=new FrameClock({manual:true}),events=[];
   const trace=(name,data={})=>events.push({name,time:clock.now,...data}),motion=new BonusMotion({clock,scene,url,fmt,trace});motion.blurTexture=loader.textures.get(14).blurTexture;
   let completed=false,failure=null,respins=2;const stopped=[],visible={...initial};motion.start(initial);
   if(sample.time>=REPLY_AT){
    await clock.seek(REPLY_AT);void motion.stop(result,{mode:settings.mode,onStop:(position,coin)=>{
     if(coin){scene.setCell(position,14,coin.jp||coin.value,{locked:true});visible[position]=coin;}else scene.clearCell(position);
     stopped.push(position);if(result.landed[position])respins=3;
    }}).then(()=>{completed=true;}).catch(error=>{if(error.message!=='CLOCK_DESTROYED')failure=error;});await clock.seek(sample.time);
   }else await clock.seek(sample.time);
   if(failure)throw failure;
   const phase=observedPhase(motion,completed),active=motion.active.map(reel=>({cell:reel.i,phase:reel.phase,position:reel.q,finalIndex:reel.L??null,coin:reel.coin?.value??null}));
   const landed=events.filter(event=>event.name==='bonus-cell-stop'&&event.landed).map(event=>event.cell);
   const lockedStable=Object.keys(initial).every(position=>{const cell=scene.cells[Number(position)];return cell.locked&&cell.value===(initial[position].jp||initial[position].value)&&cell.content.y===0;});
   capture(scene,sample);sample.phase.textContent=phase;sample.detail.textContent=`Locks ${Object.keys(visible).length}/15 · RESPINS ${respins} · new: ${landed.join(', ')||'none'}\nStops: ${stopped.join(', ')||'none'} · original locks ${lockedStable?'stable':'CHANGED'}`;
   Object.assign(sample.article.dataset,{frame:String(frame),time:String(sample.time),phase,respins:String(respins),lockedStable:String(lockedStable)});
   samples.push({frame,time:sample.time,phase,completed,respins,initialLocked:Object.keys(initial).map(Number),visibleLocked:Object.keys(visible).map(Number),lockedStable,stopped,landed,active,trace:events.map(event=>({...event})),scene:scene.snapshot()});
   motion.cleanup();clock.destroy();
   $('atlas-status').textContent=`Rendering ${clip}: ${slot+1} / ${Math.min(PER_PAGE,count-page*PER_PAGE)} frames…`;
  }
  if(samples.some(sample=>!sample.lockedStable))throw new Error('A pre-existing locked coin changed during sampling');
  window.__bonusAtlas.renderer=scene.snapshot();document.body.dataset.ready='true';window.__bonusAtlas.ready=true;
  $('atlas-status').textContent=`READY · PixiJS ${scene.PIXI.VERSION} · ${clip} · frames ${page*PER_PAGE}–${Math.min(count-1,(page+1)*PER_PAGE-1)} · 32fps · sheet ${page+1}/${pages}`;
 }finally{loader.destroy();loaderClock.destroy();scene.destroy();}
}
if(settings.reduced&&!REDUCED)navigate(clip,page);else build().catch(error=>{$('atlas-status').classList.add('atlas-error');$('atlas-status').textContent=`ATLAS ERROR: ${error.message}`;window.__bonusAtlas.error=String(error);console.error(error);});
