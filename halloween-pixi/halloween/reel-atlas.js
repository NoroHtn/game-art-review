import {FrameClock,ReelMotion} from './reel-motion.js';
import {createScene} from './pixi-scene.js?v=cauldrons-r1-20261028';

const FPS=32,PER_PAGE=16,REPLY_AT=300;
const CLIPS={normal:{mode:'normal',duration:2.5},quick:{mode:'quick',duration:2},turbo:{mode:'turbo',duration:1.5},quickstop:{mode:'normal',duration:2,quickAt:500},reduced:{mode:'normal',duration:.5,reduced:true}};
const ART={1:'low_j',2:'low_q',3:'low_k',4:'low_a',5:'book_latest',6:'lantern_latest',7:'potion_latest',8:'hat_latest',9:'wild_1cell',10:'bat_mystery',11:'bat_multi',12:'bat_collect',13:'bat_pearl',14:'value_coin_blank',15:'wild_2cell',16:'wild_2cell',17:'wild_3cell',18:'wild_3cell',19:'wild_3cell'};
const INITIAL=[[1,5,4],[6,2,7],[3,8,1],[7,4,6],[2,5,3]],FINAL=[[5,1,14],[6,15,16],[7,2,10],[8,3,12],[4,9,13]],COINS={2:400};
const APPROVED_ART_REVISION={book_latest:'514172a64299',bat_pearl:'5e1ddc236aa6'};
const url=name=>/^low_[jqka]$/.test(name)?`assets/${name}_authority.png`:`assets/${name}.webp${APPROVED_ART_REVISION[name]?`?v=${APPROVED_ART_REVISION[name]}`:''}`;
const src=id=>url(ART[id]),fmt=value=>(value/100).toFixed(2),$=id=>document.getElementById(id);
const params=new URLSearchParams(location.search),clip=CLIPS[params.get('clip')]?params.get('clip'):'normal',settings=CLIPS[clip];
const count=Math.ceil(settings.duration*FPS),pages=Math.ceil(count/PER_PAGE),page=Math.max(0,Math.min(pages-1,Number.parseInt(params.get('page')||'0',10)||0));
const navigate=(name,next)=>location.assign(`reel-atlas.html?${new URLSearchParams({clip:name,page:String(next)})}`);
$('clip').value=clip;$('clip').onchange=()=>navigate($('clip').value,0);$('previous').disabled=page===0;$('next').disabled=page===pages-1;
$('previous').onclick=()=>navigate(clip,page-1);$('next').onclick=()=>navigate(clip,page+1);$('page-label').textContent=`${page+1} / ${pages}`;
const samples=[];window.__atlas={ready:false,engine:'PixiJS',clip,page,fps:FPS,pages,duration:settings.duration,samples};

function makeSample(frame){
 const article=document.createElement('article');article.className='atlas-sample';const caption=document.createElement('div');caption.className='atlas-caption';
 const left=document.createElement('span'),phase=document.createElement('span');left.textContent=`F${String(frame).padStart(3,'0')} · ${(frame/FPS).toFixed(5)}s`;caption.append(left,phase);
 const detail=document.createElement('div');detail.className='sample-detail';article.append(caption,detail);$('atlas').append(article);
 return {article,phase,detail,frame,time:frame*1000/FPS};
}
function capture(scene,sample){
 scene.app.render();
 const canvas=scene.app.renderer.extract.canvas({target:scene.app.stage,frame:new scene.PIXI.Rectangle(0,0,320,200),resolution:1,antialias:true});
 canvas.className='atlas-capture';canvas.setAttribute('role','img');canvas.setAttribute('aria-label',`PixiJS frame capture of frame ${sample.frame}`);
 sample.article.insertBefore(canvas,sample.detail);
}
async function build(){
 // One PixiJS renderer captures all sixteen independent samples. Each thumbnail is
 // extracted from the real stage, avoiding multiple contexts and DOM reels.
 const scene=await createScene({mount:$('atlas-workspace'),boardAnchor:$('atlas-board'),potsAnchor:$('atlas-pots'),url,fmt,artResolver:src});
 scene.app.stop();scene.observer.disconnect();scene.layers.background.visible=false;scene.layers.pots.visible=false;
 const loaderClock=new FrameClock({manual:true}),loader=new ReelMotion({scene,clock:loaderClock,artResolver:src,fmt});await loader.preload();
 try{
  for(let slot=0;slot<PER_PAGE;slot++){
   const frame=page*PER_PAGE+slot;
   if(frame>=count){const empty=document.createElement('article');empty.className='atlas-sample empty';empty.textContent='End of clip';$('atlas').append(empty);continue;}
   const sample=makeSample(frame);scene.renderGrid(INITIAL);
   const clock=new FrameClock({manual:true}),motion=new ReelMotion({scene,clock,artResolver:src,fmt,reducedMotion:!!settings.reduced});motion.textures=loader.textures;
   motion.start(INITIAL,{mode:settings.mode});let completed=false;
   if(sample.time>=REPLY_AT){
    await clock.seek(REPLY_AT);void motion.stop(FINAL,COINS,{mode:settings.mode}).then(()=>{completed=true;});
    if(settings.quickAt!==undefined&&sample.time>=settings.quickAt){await clock.seek(settings.quickAt);motion.requestQuickStop();}
    await clock.seek(sample.time);
   }else await clock.seek(sample.time);
   const capturedPhase=motion.phase,trace=motion.trace.map(event=>({...event}));clearTimeout(motion.watchdog);motion.watchdog=null;
   if(completed){scene.renderGrid(FINAL,COINS);motion.finish();}
   capture(scene,sample);const impacts=trace.filter(event=>event.name==='reel-impact');sample.phase.textContent=capturedPhase;
   sample.detail.textContent=completed?'Settled result · exact confirmed grid':`Impacts: ${impacts.map(event=>event.col+1).join(', ')||'none'} · outcome ${sample.time<REPLY_AT?'not received':'confirmed'}`;
   Object.assign(sample.article.dataset,{frame:String(frame),time:String(sample.time),phase:capturedPhase});
   samples.push({frame,time:sample.time,phase:capturedPhase,completed,impacts,trace,scene:scene.snapshot()});
   // The captured thumbnail is independent from the live scene and its clock now.
   motion.finish();motion.destroy();clock.destroy();
   $('atlas-status').textContent=`Rendering ${clip}: ${slot+1} / ${Math.min(PER_PAGE,count-page*PER_PAGE)} frames…`;
  }
  window.__atlas.renderer=scene.snapshot();window.__atlas.ready=true;document.body.dataset.ready='true';
  $('atlas-status').textContent=`READY · PixiJS ${scene.PIXI.VERSION} · ${clip} · frames ${page*PER_PAGE}–${Math.min(count-1,(page+1)*PER_PAGE-1)} · 32fps · sheet ${page+1}/${pages}`;
 }finally{loader.destroy();loaderClock.destroy();scene.destroy();}
}
build().catch(error=>{$('atlas-status').classList.add('atlas-error');$('atlas-status').textContent=`ATLAS ERROR: ${error.message}`;window.__atlas.error=String(error);console.error(error);});
