// PixiJS Halloween game. Outcomes and wallet come from the Halloween demo RGS; Wild is always full reel.
// Choreography sources: Edgar main 34a20e39, slot-motion-secrets and observed reference timeline.
import {LINES,SYMBOLS,BET_LADDER,REDUCED} from '../game/config.js';
import {createServer} from '../game/halloween-server.js?v=reference-r4-20261029';
import {FrameClock,ReelMotion} from './reel-motion.js?v=reference-r4-20261029';
import {Presentation,BonusMotion} from './presentation.js?v=reference-r4-20261029';
import {createScene} from './pixi-scene.js?v=reference-r4-20261029';
import {CauldronAnimator} from './cauldron-animation.js?v=reference-r4-20261029';
const $=id=>document.getElementById(id),fmt=n=>(n/100).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
const ART={1:'low_j',2:'low_q',3:'low_k',4:'low_a',5:'book_latest',6:'lantern_latest',7:'potion_latest',8:'hat_latest',9:'wild_3cell',10:'bat_mystery',11:'bat_multi',12:'bat_collect',13:'bat_pearl',14:'value_coin_blank',15:'wild_3cell',16:'wild_3cell',17:'wild_3cell',18:'wild_3cell',19:'wild_3cell'};
const NAMES={1:'J',2:'Q',3:'K',4:'A',5:'Sun spellbook',6:'Amber lantern',7:'Green potion',8:'Crescent witch hat',9:'WILD',10:'Mystery bat coin',11:'Multi bat coin',12:'Collect bat coin',13:'Pearl bat coin',14:'Value coin'};
const APPROVED_ART_REVISION={book_latest:'514172a64299',bat_pearl:'5e1ddc236aa6'};
const url=name=>/^low_[jqka]$/.test(name)?`assets/${name}_authority.png`:`assets/${name}.webp${APPROVED_ART_REVISION[name]?`?v=${APPROVED_ART_REVISION[name]}`:''}`;
const clock=new FrameClock();let server=createServer();
const state={phase:'LOADING',busy:true,betIdx:4,mode:'normal',auto:false,balance:server.balance,lastWin:0,bonus:null,visibleCoins:{},respins:3,pots:{multi:0,collect:0,mystery:0},grid:[[1,5,4],[6,2,7],[3,8,1],[7,4,6],[2,5,3]],coins:{},sound:false,skipLevel:0};
const isQA=new URLSearchParams(location.search).has('qa');
const bet=()=>BET_LADDER[state.betIdx],events=[];let epoch=0,autoAt=Infinity,audio=null;
const speedModes=['normal','quick','turbo'],roundHistory=[];
const turboHold={pointerId:null,timer:null,active:false,restoreMode:null,suppressClick:false};
let pendingHistory=null,lastTimeMinute=-1,graphicsAvailable=true;
let confirmedPots={...state.pots};
function trace(name,data={}){events.push({name,time:Math.round(clock.now),wall:Math.round(performance.now()),...data});if(events.length>1200)events.shift();const output=$('motion-trace');if(output)output.textContent=JSON.stringify(events.slice(-200));}
function phase(name){state.phase=name;trace('phase',{phase:name});controls();}
const scene=await createScene({mount:$('game'),boardAnchor:$('board'),potsAnchor:document.querySelector('.pots-scene'),url,fmt,artResolver:id=>url(ART[id]),onContextChange:available=>{graphicsAvailable=available;clock.last=null;if(window.__game){stopAuto();controls();status(available?'GRAPHICS RESTORED · READY TO CONTINUE':'GRAPHICS INTERRUPTED · WAITING TO RESTORE');}},onError:error=>{trace('renderer-error',{message:error.message});graphicsAvailable=false;if(window.__game){stopAuto();controls();}status('GRAPHICS INTERRUPTED · RELOAD TO CONTINUE');}}).catch(error=>{
 $('boot').querySelector('p').textContent='The graphics engine could not start. Reload to retry with WebGL enabled.';console.error(error);throw error;
});
clock.bindTicker(scene.app.ticker);scene.app.start();
function normalize(){scene.normalize();}
function renderGrid(grid=state.grid,coins=state.coins){scene.renderGrid(grid,coins);$('board').setAttribute('aria-label',grid.map((col,c)=>`Reel ${c+1}: ${col.map(id=>NAMES[id]||'Tall WILD').join(', ')}`).join('; '));}
function renderBonus(board){scene.renderBonus(board);$('board').setAttribute('aria-label',`Hold and Win: ${Object.keys(board).length} locked coins of 15 cells`);}
function status(text,winning=false){$('status').textContent=text;$('status').classList.toggle('win',winning);}
function controls(){
 $('balance').textContent=fmt(state.balance);$('bet').textContent=fmt(bet());
 const collecting=state.bonus&&!['BONUS_TALLY','BONUS_RESULT'].includes(state.phase);
 $('win-label').textContent=collecting?'COLLECTED':'LAST WIN';$('win').textContent=fmt(collecting?Object.values(state.visibleCoins).reduce((s,c)=>s+c.value,0):state.lastWin);
 const spinning=['SPIN_UP','SPINNING','STOPPING'].includes(state.phase),skip=['WIN_PRESENT','BIG_WIN','BONUS_TALLY','BONUS_RESULT'].includes(state.phase);
 const autoStop=!state.busy&&(state.auto||turboHold.active);
 $('spin').disabled=!graphicsAvailable||state.phase==='LOADING'||(state.busy&&!spinning&&!skip);
 $('spin-label').textContent=spinning?'STOP':skip?(state.skipLevel?'CONTINUE':'TOTAL'):autoStop?'STOP AUTO':state.bonus?'RESUME':'SPIN';
 $('spin').dataset.action=spinning||skip?'skip':autoStop?'auto-stop':state.bonus?'resume':'spin';
 $('spin').dataset.holding=String(turboHold.active);
 $('spin').setAttribute('aria-label',spinning?'Stop reels':skip?'Skip win presentation':autoStop?'Stop automatic spins':state.bonus?'Resume bonus':'Spin reels. Hold for turbo.');
 $('auto').setAttribute('aria-pressed',String(state.auto));$('auto-label').textContent=state.auto?'STOP':'AUTO';$('auto').setAttribute('aria-label',state.auto?'Stop autoplay':'Start autoplay');$('auto').disabled=!graphicsAvailable||!!state.bonus;
 $('speed').disabled=state.busy||turboHold.active;$('speed').dataset.mode=state.mode;
 $('speed-label').textContent=['1×','2×','3×'][speedModes.indexOf(state.mode)];$('speed').setAttribute('aria-label',`Speed: ${state.mode} (${$('speed-label').textContent})`);
 $('buy').disabled=!graphicsAvailable||state.busy||!!state.bonus||state.balance<bet()*70;$('buy').setAttribute('aria-label',`Buy bonus for ${fmt(bet()*70)} demo credits (70× bet)`);
 for(const id of ['bet-down','bet-up','reset'])$(id).disabled=state.busy||!!state.bonus||state.auto||turboHold.active;
 $('bet-down').disabled||=state.betIdx===0;$('bet-up').disabled||=state.betIdx===BET_LADDER.length-1;
 $('respins').textContent=`${state.respins} RESPINS`;$('bonus-banner').hidden=!state.bonus;
 document.body.classList.toggle('bonus-mode',!!state.bonus);$('game').dataset.phase=state.phase;
 if(state.bonus)$('board').setAttribute('aria-label',`Hold and Win: ${Object.keys(state.visibleCoins).length} locked coins of 15 cells`);
 for(const[pot,n]of Object.entries(state.pots))document.querySelector(`[data-pot="${pot}"]`).setAttribute('aria-label',`${pot}: ${n} of 9`);
 $('super-cauldron').setAttribute('aria-label',`Large pearlescent SUPER cauldron: ${Object.values(state.pots).reduce((sum,count)=>sum+count,0)} of 27`);
 scene.setPots(state.pots);scene.setBonus(!!state.bonus);
}
function tone(freq=440,ms=70){if(!state.sound)return;try{audio||=new(window.AudioContext||window.webkitAudioContext)();audio.resume();const o=audio.createOscillator(),g=audio.createGain();o.frequency.value=freq;g.gain.setValueAtTime(.025,audio.currentTime);g.gain.exponentialRampToValueAtTime(.001,audio.currentTime+ms/1000);o.connect(g);g.connect(audio.destination);o.start();o.stop(audio.currentTime+ms/1000);}catch{}}
const cauldrons=new CauldronAnimator({scene,clock,trace,reducedMotion:REDUCED});
cauldrons.sync(state.pots,{immediate:true});
const presentation=new Presentation({clock,scene,url,fmt,trace});
const reels=new ReelMotion({clock,scene,artResolver:id=>url(ART[id]),fmt,reducedMotion:REDUCED,onEvent:e=>{trace(e.name,e);if(e.name==='outcome-ready')phase('SPINNING');if(e.name==='reel-decelerate'&&state.phase!=='STOPPING')phase('STOPPING');if(e.name==='reel-stop')tone(250+(e.col||0)*45,35);}});
const bonusMotion=new BonusMotion({clock,scene,url,fmt,trace});
const skip=()=>state.skipLevel>0;
function restoreHeldSpeed(){if(!turboHold.active&&!state.busy&&turboHold.restoreMode!==null){state.mode=turboHold.restoreMode;turboHold.restoreMode=null;}}
function endTurboHold(){
 clearTimeout(turboHold.timer);turboHold.timer=null;
 const pointerId=turboHold.pointerId;turboHold.pointerId=null;
 if(turboHold.active){turboHold.active=false;turboHold.suppressClick=true;autoAt=Infinity;trace('turbo-hold-end');}
 // A round reads its mode again when its outcome arrives; restore only after it settles.
 restoreHeldSpeed();
 if(pointerId!==null&&$('spin').hasPointerCapture(pointerId))$('spin').releasePointerCapture(pointerId);
 controls();
}
function stopAuto(){state.auto=false;autoAt=Infinity;endTurboHold();}
function showDialog(id){stopAuto();if($('game-menu').open)$('game-menu').close();$(id).showModal();}
function renderHistory(){
 $('history-list').replaceChildren();$('history-empty').hidden=roundHistory.length>0;
 for(const entry of roundHistory){const row=document.createElement('tr');for(const value of [entry.kind==='bonus'?`Bonus ${entry.round}`:`${entry.round}`,fmt(entry.stake),fmt(entry.returned)]){const cell=document.createElement('td');cell.textContent=value;row.append(cell);}$('history-list').append(row);}
}
function completeRoundHistory(){
 if(!pendingHistory)return;
 roundHistory.unshift({...pendingHistory,returned:state.balance-pendingHistory.openingBalance+pendingHistory.stake});
 if(roundHistory.length>20)roundHistory.length=20;pendingHistory=null;renderHistory();
}
function updateSessionTime(){
 const now=new Date(),minute=Math.floor(now.getTime()/60000);if(minute===lastTimeMinute)return;lastTimeMinute=minute;
 $('session-time').textContent=`${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;$('session-time').dateTime=now.toISOString();
}
function skipAction(){if(!state.busy)return;state.skipLevel=Math.min(2,state.skipLevel+1);trace('skip',{stage:state.skipLevel});controls();}
async function ceremony(amount,{title='TOTAL WIN',stake=bet(),bonus=false,onValue=()=>{}}={}){
 state.skipLevel=0;phase(bonus?'BONUS_RESULT':'BIG_WIN');const dialog=$('celebrate');$('celebrate-title').textContent=title;$('celebrate-value').textContent=fmt(0);$('continue').textContent='SHOW TOTAL';dialog.classList.toggle('neutral',amount<=stake);dialog.showModal();
 const target=amount/stake;let previous='';
 await presentation.count($('celebrate-value'),0,amount,REDUCED?150:Math.min(9500,3500+Math.max(0,Math.log2(Math.max(1,target)))*550),{skip,onValue:value=>{
  onValue(value);if(bonus)return;const multiple=value/stake,tier=multiple>=100?'EPIC WIN':multiple>=50?'MEGA WIN':multiple>=30?'SUPER WIN':'BIG WIN';if(tier!==previous){$('celebrate-title').textContent=tier;previous=tier;}
 }});
 $('continue').textContent='CONTINUE';await presentation.animate(1600,()=>{},()=>state.skipLevel>=2);dialog.close();state.skipLevel=0;
}
async function baseWin(reply){
 if(!reply.total){status('6 COINS TRIGGER HOLD & WIN');return;}
 const neutral=reply.total<=reply.bet;state.skipLevel=0;phase('WIN_PRESENT');status(`${neutral?'RETURN':'WIN'} ${fmt(reply.total)}`,!neutral);
 const creditBefore=reply.balance-reply.total;
 if(reply.total>=15*reply.bet&&!neutral){
  presentation.focus(reply.grid,reply.wins);await ceremony(reply.total,{stake:reply.bet,onValue:value=>{state.lastWin=value;state.balance=creditBefore+value;$('win').textContent=fmt(value);$('balance').textContent=fmt(state.balance);}});
 }else await Promise.all([
  presentation.winTake(reply.grid,reply.wins,{neutral,ms:neutral?450:900,skip}),
  presentation.count($('win'),0,reply.total,neutral?350:1100,{skip,onValue:v=>{state.lastWin=v;state.balance=creditBefore+v;$('balance').textContent=fmt(state.balance);}})
 ]);
 state.lastWin=reply.total;state.balance=reply.balance;controls();
 state.skipLevel=0;
}
async function lineCycle(reply,token){
 if(!reply.wins.length||reply.total<=reply.bet||state.mode==='turbo'||REDUCED)return;
 for(const win of reply.wins.slice(0,10)){if(token!==epoch||state.busy||state.bonus)return;phase('LINE_LOOP');status(`LINE ${win.line} · ${fmt(win.amount)}`,true);await presentation.winTake(reply.grid,[win],{ms:2000,skip:()=>token!==epoch});}
 if(token===epoch&&!state.busy){presentation.focus(reply.grid,reply.wins);phase('IDLE');status(`WIN ${fmt(reply.total)} · 25 PAYLINES`,true);}
}
async function enterBonus(seed,{purchased=false}={}){
 if(turboHold.active||turboHold.pointerId!==null)endTurboHold();
 phase('FEATURE_TRIGGER');if(!purchased)await presentation.trigger(state.coins);
 phase('FEATURE_TRANSITION');await presentation.transition(async()=>{state.bonus={...seed,purchased,cost:purchased?bet()*70:bet()};state.visibleCoins={...seed.board};state.respins=3;state.lastWin=0;renderBonus(seed.board);controls();});
 phase('BONUS_INTRO');status('HOLD & WIN · COINS LOCK · NEW COINS RESET TO 3',true);await presentation.pulse(scene.boardContainer,.012,600);await clock.wait(500);
 await runBonus();
}
async function runBonus(){
 while(state.bonus&&!state.bonus.done){
  phase('BONUS_READY');status(`${state.respins} RESPINS · ONLY EMPTY CELLS SPIN`);await clock.wait(state.mode==='turbo'?180:650);
  const before={...state.bonus.board};bonusMotion.start(before);phase('BONUS_SPIN');
  const reply=await server.respin();state.bonus={...state.bonus,...reply};trace('bonus-outcome',{respins:reply.respins,done:reply.done,total:reply.total,balance:reply.balance});
  state.respins=Math.max(0,state.respins-1);controls();
  await bonusMotion.stop(reply,{mode:state.mode,onStop:(pos,coin)=>{
   if(coin){scene.setCell(pos,14,coin.jp||coin.value,{locked:true});state.visibleCoins[pos]=coin;}else scene.clearCell(pos);
   if(reply.landed[pos]){state.respins=3;tone(650,60);status('NEW COIN · RESPINS RESET TO 3',true);}controls();
  }});
  state.respins=reply.respins;state.visibleCoins={...reply.board};phase('BONUS_SETTLE');controls();await clock.wait(300);
 }
 if(!state.bonus)return;
 const result=state.bonus;phase('BONUS_TALLY');state.lastWin=0;state.skipLevel=0;controls();status('COLLECTING TOTAL',true);
 const beforeCredit=result.balance-result.total;
 await presentation.tally(result.board,result.total,value=>{state.lastWin=value;state.balance=beforeCredit+value;controls();},skip);
 state.lastWin=result.total;state.balance=result.balance;controls();await clock.wait(350);
 await ceremony(result.total,{title:result.total>result.cost?'TOTAL WIN':'TOTAL RETURN',stake:result.cost,bonus:true});
 phase('FEATURE_RETURN');await presentation.transition(async()=>{state.bonus=null;state.visibleCoins={};renderGrid();controls();},true);status(`BONUS RETURN ${fmt(result.total)} · READY TO SPIN`,result.total>result.cost);
}
async function perform(task){
 state.busy=true;state.skipLevel=0;autoAt=Infinity;const token=++epoch;presentation.clearFocus();controls();
 try{await task();}catch(error){stopAuto();trace('error',{message:error.message});console.error(error);bonusMotion.cleanup();reels.reset();presentation.cleanup();state.pots={...confirmedPots};cauldrons.stop();cauldrons.sync(state.pots,{immediate:true});state.balance=server.balance;
  if(state.bonus){renderBonus(state.bonus.board);state.visibleCoins={...state.bonus.board};status('PRESENTATION INTERRUPTED · TAP RESUME');}else{pendingHistory=null;renderGrid();status(error.message==='INSUFFICIENT_FUNDS'?'INSUFFICIENT DEMO CREDITS':'ROUND INTERRUPTED · READY TO CONTINUE');}
 }finally{state.busy=false;restoreHeldSpeed();phase('IDLE');controls();if((state.auto||turboHold.active)&&!state.bonus)autoAt=clock.now+(state.lastWin?state.mode==='turbo'?250:1400:150);}
 return token;
}
async function play(force){
 if(!graphicsAvailable)return;
 if(state.busy){if(['SPIN_UP','SPINNING','STOPPING'].includes(state.phase))reels.requestQuickStop();else if(['WIN_PRESENT','BIG_WIN','BONUS_TALLY','BONUS_RESULT'].includes(state.phase))skipAction();return;}
 if(document.querySelector('dialog[open]'))return;
 if(state.bonus){await perform(async()=>{await runBonus();completeRoundHistory();});return;}
 if(state.balance<bet()){stopAuto();status('INSUFFICIENT DEMO CREDITS · RESET TO PLAY');return;}
 let reply;const openingBalance=state.balance,stake=bet();
 const token=await perform(async()=>{
  phase('SPIN_UP');status('GOOD LUCK');state.lastWin=0;normalize();controls();reels.start(state.grid,{mode:state.mode,coins:state.coins});
  const injected=force||window.__force;delete window.__force;reply=await server.spin(bet(),{force:injected});confirmedPots={...reply.pots};trace('spin-outcome',{round:reply.round,total:reply.total,balance:reply.balance});
  pendingHistory={kind:'spin',round:reply.round,stake,openingBalance};
  state.balance=reply.balance-reply.total;controls();phase('STOPPING');await reels.stop(reply.grid,reply.coins,{mode:state.mode,onReelStop:()=>tone(300,35)});
  state.grid=reply.grid;state.coins=reply.coins;renderGrid();reels.finish();phase('LANDED');
  if(reply.gems.length){phase('FEATURE_COLLECT');await presentation.collect(reply.gems,gem=>{
   state.pots[gem.pot]=Math.min(9,state.pots[gem.pot]+1);
   const total=Object.values(state.pots).reduce((sum,count)=>sum+count,0);
   // The rear vessel mirrors confirmed presentation progress. It never adds a
   // collection, value, payout or server-side feature of its own.
   const reactions=Promise.all([cauldrons.collect(gem.pot,state.pots[gem.pot]),cauldrons.collect('super',total)]);
   controls();return reactions;
  });state.pots={...reply.pots};controls();}
  await baseWin(reply);if(reply.trigger)await enterBonus(reply.trigger);completeRoundHistory();
 });
 if(reply&&!reply.trigger&&!state.bonus)void lineCycle(reply,token);
}
function activateSpin(){if(!state.busy&&(state.auto||turboHold.active)){stopAuto();return;}void play();}
$('spin').onclick=e=>{if(turboHold.suppressClick&&e.detail!==0){turboHold.suppressClick=false;return;}activateSpin();};$('continue').onclick=skipAction;
$('spin').addEventListener('pointerdown',e=>{
 if(e.button!==0||turboHold.pointerId!==null)return;
 turboHold.suppressClick=false;
 if(state.busy||state.bonus||state.auto||state.phase==='LOADING'||document.querySelector('dialog[open]'))return;
 turboHold.pointerId=e.pointerId;$('spin').setPointerCapture(e.pointerId);
 turboHold.timer=setTimeout(()=>{
  turboHold.timer=null;
  if(turboHold.pointerId!==e.pointerId||state.busy||state.bonus||state.auto||document.querySelector('dialog[open]'))return;
  turboHold.active=true;turboHold.suppressClick=true;turboHold.restoreMode=state.mode;state.mode='turbo';trace('turbo-hold-start');controls();void play();
 },350);
});
for(const event of ['pointerup','pointercancel','lostpointercapture'])$('spin').addEventListener(event,e=>{if(e.pointerId===turboHold.pointerId)endTurboHold();});
$('spin').addEventListener('contextmenu',e=>e.preventDefault());
window.addEventListener('blur',endTurboHold);
$('celebrate').addEventListener('cancel',e=>{e.preventDefault();skipAction();});
$('auto').onclick=()=>{if(state.bonus)return;endTurboHold();state.auto=!state.auto;autoAt=state.auto?clock.now:Infinity;controls();};
$('speed').onclick=()=>{if(state.busy||turboHold.active)return;state.mode=speedModes[(speedModes.indexOf(state.mode)+1)%3];controls();};
for(const[id,delta]of[['bet-down',-1],['bet-up',1]])$(id).onclick=()=>{if(state.busy||state.bonus||state.auto||turboHold.active)return;++epoch;state.betIdx=Math.max(0,Math.min(BET_LADDER.length-1,state.betIdx+delta));presentation.clearFocus();state.lastWin=0;controls();};
$('reset').onclick=()=>{if(state.busy||state.bonus)return;stopAuto();++epoch;server=createServer();state.balance=server.balance;state.lastWin=0;state.pots={multi:0,collect:0,mystery:0};confirmedPots={...state.pots};cauldrons.stop();cauldrons.sync(state.pots,{immediate:true});roundHistory.length=0;pendingHistory=null;renderHistory();presentation.cleanup();renderGrid();controls();$('game-menu').close();status('DEMO BALANCE RESET');};
$('buy').onclick=()=>{if(state.busy||state.bonus)return;$('buy-cost').textContent=fmt(bet()*70);showDialog('purchase');};
$('confirm-buy').onclick=async()=>{if(!graphicsAvailable||state.busy||state.bonus)return;$('purchase').close();const openingBalance=state.balance,stake=bet()*70;await perform(async()=>{phase('FEATURE_REQUEST');const seed=await server.buyBonus(bet(),70);pendingHistory={kind:'bonus',round:seed.round,stake,openingBalance};state.balance=seed.balance;controls();await enterBonus(seed,{purchased:true});completeRoundHistory();});};
$('info').onclick=$('menu-rules').onclick=()=>showDialog('rules');$('menu').onclick=()=>showDialog('game-menu');$('history').onclick=()=>{renderHistory();showDialog('round-history');};document.querySelectorAll('dialog .close,dialog .cancel').forEach(b=>b.onclick=()=>b.closest('dialog').close());
$('sound').onclick=()=>{state.sound=!state.sound;$('sound').setAttribute('aria-pressed',String(state.sound));$('sound').setAttribute('aria-label',state.sound?'Mute sound':'Enable sound');tone();};
document.addEventListener('keydown',e=>{if(e.code==='Space'&&!e.repeat&&!/BUTTON|INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)){e.preventDefault();activateSpin();}});
document.addEventListener('visibilitychange',()=>{if(document.hidden)stopAuto();});
clock.onTick(()=>{updateSessionTime();if((state.auto||turboHold.active)&&!state.busy&&!state.bonus&&clock.now>=autoAt&&!document.querySelector('dialog[open]')){autoAt=Infinity;void play();}
 scene.updateIdle(clock.now,state.phase==='IDLE'&&!REDUCED&&!state.bonus);
});
for(let id=1;id<=8;id++){const item=document.createElement('div'),im=new Image();im.src=url(ART[id]);im.alt=NAMES[id];item.append(im);const text=document.createElement('p');text.textContent=`3 / 4 / 5: ${[...SYMBOLS[id].pay].reverse().join(' / ')}×`;item.append(text);$('paytable').append(item);}
window.__game={state,clock,reels,scene,cauldrons,events,server:()=>server,play,ready:false,renderer:`pixi-${scene.app.renderer.name}`,snapshot:()=>({phase:state.phase,balance:state.balance,grid:state.grid,scene:scene.snapshot()})};window.__app=scene.app;window.__buyBonus=()=>$('buy').click();
renderGrid();controls();renderHistory();updateSessionTime();
try{
 await reels.preload();
 bonusMotion.blurTexture=reels.textures.get(14)?.blurTexture;$('boot').hidden=true;state.busy=false;phase('IDLE');window.__game.ready=true;$('game').dataset.ready='true';
}catch(error){$('boot').querySelector('p').textContent='Artwork could not load. Reload to retry.';console.error(error);trace('boot-error',{message:error.message});}

// Explicit review-only controls use the original mock server's supported force hook.
if(isQA){
 const log=document.createElement('output');log.id='motion-trace';log.hidden=true;document.body.append(log);
 const diagnostics=document.createElement('output');diagnostics.id='pixi-diagnostics';diagnostics.hidden=true;document.body.append(diagnostics);let previous=-Infinity;
 clock.onTick(()=>{if(clock.now-previous<150)return;previous=clock.now;const gl=scene.app.renderer.gl;
  diagnostics.textContent=JSON.stringify({ready:window.__game.ready,phase:state.phase,busy:state.busy,balance:state.balance,lastWin:state.lastWin,bet:bet(),mode:state.mode,grid:state.grid,coins:state.coins,bonus:state.bonus,visibleCoins:state.visibleCoins,respins:state.respins,graphicsAvailable,
   graphics:{type:scene.app.renderer.type,webgl:!!gl,version:gl&&!gl.isContextLost()?gl.getParameter(gl.VERSION):null,contextLost:gl?.isContextLost()||false},scene:scene.snapshot(),cauldrons:cauldrons.snapshot(),
   reels:{active:reels.active,phase:reels.phase,columns:reels.columns?.map(c=>({col:c.col,q:c.q,phase:c.phase,views:c.views.map(v=>({id:v.id,y:v.container.y,sharpAlpha:v.sharp?.alpha,blurAlpha:v.blur?.alpha}))}))||[]},
   events:events.slice(-35)});
 });
 const panel=document.createElement('nav');panel.className='qa-controls';panel.style.flexWrap='wrap';panel.style.maxWidth='calc(100vw - 8px)';panel.setAttribute('aria-label','Presentation review');
 for(const[label,force]of[['Review return',[[1,2,3],[1,4,5],[1,6,7],[2,3,4],[3,4,5]]],['Review win',Array.from({length:5},()=>[1,1,1])],['Review bonus',[[14,14,14],[14,14,14],[1,2,3],[2,3,4],[3,4,1]]],['Review Wild',[[1,2,3],[9,4,5],[2,15,16],[17,18,19],[10,11,12]]],['Review artwork',[[5,13,1],[6,7,8],[9,15,16],[17,18,19],[10,11,12]]],['Review cauldrons',[[13,13,13],[1,2,3],[2,3,4],[3,4,5],[4,5,6]]]]){const b=document.createElement('button');b.textContent=label;b.onclick=()=>play(force);panel.append(b);}document.body.append(panel);
 // A review-only recording captures actual rendered frames, so a moving
 // transform or passing state test cannot stand in for visible animation.
 if(scene.app.canvas.captureStream&&typeof MediaRecorder!=='undefined'){
  const record=document.createElement('button');record.textContent='Record 12s animation';panel.append(record);
  record.onclick=async()=>{
   record.disabled=true;record.textContent='Recording animation…';let stream,recorder,offCapture;
   try{
    const board=scene.geometry.board,pots=Object.values(scene.pots),left=Math.max(0,Math.min(board.x-12,...pots.map(p=>p.x))),top=Math.max(0,Math.min(...pots.map(p=>p.y))-12);
    const right=Math.min(scene.width,Math.max(board.x+board.width+12,...pots.map(p=>p.x+p.width))),bottom=Math.min(scene.height,board.y+board.height+12);
    const preview=document.createElement('canvas');preview.width=640;preview.height=Math.round((bottom-top)*640/(right-left)/2)*2;
    const context=preview.getContext('2d'),capture=()=>{const source=scene.app.canvas,sx=source.width/scene.width,sy=source.height/scene.height;
     context.clearRect(0,0,preview.width,preview.height);context.drawImage(source,left*sx,top*sy,(right-left)*sx,(bottom-top)*sy,0,0,preview.width,preview.height);};
    capture();offCapture=clock.onTick(capture);stream=preview.captureStream(30);
    const mime=['video/webm;codecs=vp8','video/webm','video/mp4'].find(type=>MediaRecorder.isTypeSupported(type));
    recorder=new MediaRecorder(stream,{...(mime?{mimeType:mime}:{}),videoBitsPerSecond:1800000});
    const chunks=[];recorder.ondataavailable=event=>{if(event.data.size)chunks.push(event.data);};
    const stopped=new Promise((resolve,reject)=>{recorder.onstop=resolve;recorder.onerror=reject;});
    recorder.start(250);await clock.wait(12000);recorder.stop();await stopped;
    const blob=new Blob(chunks,{type:recorder.mimeType}),link=document.createElement('a'),objectURL=URL.createObjectURL(blob);
    link.href=objectURL;link.download=`halloween-cauldron-r3.${blob.type.includes('mp4')?'mp4':'webm'}`;link.textContent='Save animation review';panel.append(link);
    link.addEventListener('click',()=>{link.hidden=true;setTimeout(()=>URL.revokeObjectURL(objectURL),1000);},{once:true});
   }catch(error){trace('qa-recording-error',{message:error.message});}
   finally{offCapture?.();if(recorder?.state==='recording')recorder.stop();stream?.getTracks().forEach(track=>track.stop());record.disabled=false;record.textContent='Record 12s animation';}
  };
 }
}
