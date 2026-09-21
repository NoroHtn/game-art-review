import {PiratePreview,MULTIPLIERS} from './preview-state.js';
const game=new PiratePreview();
const $=id=>document.getElementById(id);
const root=$('game'),route=$('route'),hero=$('hero'),stake=$('stake'),go=$('go'),cash=$('cashout'),status=$('status');
const fmt=cents=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(cents/100);
let timer,scenarioTimer,sound=false,audio;
const reduce=matchMedia('(prefers-reduced-motion: reduce)');
const targetNodes=MULTIPLIERS.map((m,i)=>{
 const node=document.createElement('div');node.className='barrel-target';node.dataset.step=i;
 node.innerHTML=`<img src="/game-art-review/assets/instant/barrel.png" alt="" draggable="false"><span class="multiplier">${m.toFixed(2)}<span>×</span></span>`;
 node.setAttribute('aria-label',`Step ${i+1}: ${m.toFixed(2)} times total stake`);route.append(node);return node;
});
function tone(kind='hop'){
 if(!sound)return;
 try{audio??=new AudioContext();audio.resume();const o=audio.createOscillator(),g=audio.createGain();o.type='triangle';o.frequency.setValueAtTime(kind==='cash'?660:330,audio.currentTime);o.frequency.exponentialRampToValueAtTime(kind==='cash'?990:520,audio.currentTime+.12);g.gain.setValueAtTime(.06,audio.currentTime);g.gain.exponentialRampToValueAtTime(.001,audio.currentTime+.2);o.connect(g);g.connect(audio.destination);o.start();o.stop(audio.currentTime+.22);}catch{}
}
function layout(){
 const h=$('world').clientHeight, mobile=innerWidth<700;
 const visualIndex=game.phase==='loss'?Math.min(game.index+1,MULTIPLIERS.length-1):game.index;
 const afloat=visualIndex>=0;
 const origin=afloat?visualIndex+1:0;
 const remain=MULTIPLIERS.length-origin;
 const top=mobile?79:45;
 const near=h*(afloat?.555:(mobile?.64:.63));
 targetNodes.forEach((node,i)=>{
  const completed=i<visualIndex,current=i===visualIndex,slot=i-origin;
  node.hidden=completed;
  node.classList.toggle('current',current);
  node.classList.toggle('next',i===visualIndex+1);
  const width=current?(mobile?211:246):(mobile?134:170)-Math.max(0,slot)*(mobile?7:10);
  const bh=current?width*.63:width*.60;
  // Keep the next target at one consistent distance; later targets occupy the available depth.
  const y=current?h*.90-bh*.34:near-slot*(near-top)/Math.max(5-(afloat?1:0),1);
  node.style.setProperty('--target-width',`${width}px`);node.style.setProperty('--target-height',`${bh}px`);node.style.setProperty('--target-y',`${y}px`);node.style.zIndex=String(20-i);
 });
 const heroSize=Math.min(mobile?149:160,h*.26);hero.style.width=heroSize+'px';hero.style.height=heroSize+'px';
 hero.style.setProperty('--hero-foot',`${h*(afloat?.90:.956)}px`);
 hero.style.setProperty('--hop-height',`${Math.min(h*.25,160)}px`);
 root.classList.toggle('afloat',afloat);
}
function render(){
 const locked=!['ready','funds'].includes(game.phase);
 root.dataset.phase=game.phase;root.dataset.loss=game.loss||'';
 stake.disabled=locked;stake.value=(game.stake/100).toFixed(2);
 stake.setAttribute('aria-invalid',String(!!game.error));
 $('stake-lock').textContent=locked?'Locked':'USD';
 $('balance').textContent=fmt(game.balance);
 $('cash-value').textContent=game.phase==='cashout'?fmt(game.returned):game.phase==='active'?fmt(game.cashValue):'—';
 cash.disabled=game.phase!=='active';
 const ended=['loss','cashout'].includes(game.phase),complete=game.phase==='active'&&game.next===null;
 go.disabled=['jump','funds','reconnecting'].includes(game.phase)||complete;
 $('go-label').textContent=ended?'PLAY AGAIN':game.phase==='jump'?'JUMPING…':complete?'FINISH':'GO';
 $('go-arrow').hidden=ended||complete||game.phase==='jump';
 document.querySelectorAll('[data-difficulty]').forEach(b=>{b.disabled=locked;b.setAttribute('aria-pressed',String(b.dataset.difficulty===game.difficulty));});
 $('current-hud').hidden=!locked||game.index<0;
 $('current-hud').querySelector('span').textContent=game.phase==='loss'?'LAST SAFE':'CURRENT';
 $('current-value').textContent=game.current?`${game.current.toFixed(2)}×`:'—';
 let message='Choose your stake, then GO to the first barrel.';
 if(game.phase==='active')message=complete?'End of this preview route. Cash out your return.':`Next ${game.next.toFixed(2)}× · GO or cash out ${fmt(game.cashValue)}.`;
 if(game.phase==='jump')message='Jump in progress…';
 if(game.phase==='cashout')message=`Cashed out ${fmt(game.returned)} · round complete.`;
 if(game.phase==='loss')message=({sink:'Barrel sank',shark:'Shark strike',tentacle:'Tentacle grab'}[game.loss]||'Round lost')+' · return $0.00.';
 if(game.phase==='funds')message=game.error;
 if(game.phase==='reconnecting')message='Reconnecting… Your current round is paused.';
 status.textContent=message;
 $('result').hidden=!['loss','cashout','reconnecting'].includes(game.phase);
 $('result-title').textContent=game.phase==='cashout'?'TREASURE SECURED':game.phase==='reconnecting'?'RECONNECTING':'ROUND OVER';
 $('result-value').textContent=game.phase==='cashout'?fmt(game.returned):game.phase==='reconnecting'?'Your round is paused':'$0.00 return';
 $('result-note').textContent=game.phase==='cashout'?`${game.current.toFixed(2)}× total return`:game.phase==='reconnecting'?'Controls resume after connection is restored.':`${({sink:'Barrel sank.',shark:'Shark strike.',tentacle:'Tentacle grab.'}[game.loss]||'')} Attempted ${(game.next??game.current??1.5).toFixed(2)}×.`;
 $('start-marker').hidden=game.index>=0;
 layout();
}
function clearPending(){clearTimeout(timer);clearTimeout(scenarioTimer);}
function jump(){
 if(['loss','cashout'].includes(game.phase)){clearPending();game.nextRound();render();return;}
 const token=game.advance();if(token===null)return;
 render();tone();
 timer=setTimeout(()=>{if(game.resolve(token)){render();}},reduce.matches?100:700);
}
function showScenario(name){
 clearPending();const allowed=['ready','jump','active','cashout','sink','shark','tentacle','funds','reconnecting'];
 if(!allowed.includes(name))return;
 game.scenario(name);render();
 if(name==='jump'){
  const token=game.stepToken;
  scenarioTimer=setTimeout(()=>{if(game.resolve(token))render();},reduce.matches?100:1600);
 }
}
function updateStake(){const raw=stake.value,valid=game.setStake(raw);if(valid)tone();render();if(!valid)stake.value=raw;}
go.addEventListener('click',jump);
cash.addEventListener('click',()=>{if(game.cashout()){clearPending();tone('cash');render();}});
stake.addEventListener('change',updateStake);
stake.addEventListener('input',()=>{const valid=game.setStake(stake.value);root.dataset.phase=game.phase;go.disabled=!valid;stake.setAttribute('aria-invalid',String(!valid));status.textContent=game.error||'Choose your stake, then GO to the first barrel.';});
stake.addEventListener('keydown',e=>{if(e.key==='Enter'){updateStake();go.focus();}});
document.querySelectorAll('[data-difficulty]').forEach(b=>b.addEventListener('click',()=>{if(game.setDifficulty(b.dataset.difficulty))render();}));
$('sound').addEventListener('click',()=>{sound=!sound;$('sound').setAttribute('aria-pressed',String(sound));$('sound').setAttribute('aria-label',sound?'Mute sound':'Enable sound');$('sound-off').hidden=sound;$('sound-on').hidden=!sound;tone();});
const menu=$('menu-dialog');$('menu').addEventListener('click',()=>menu.showModal());$('close-menu').addEventListener('click',()=>menu.close());
menu.addEventListener('click',e=>{if(e.target===menu)menu.close();});
$('review-state').addEventListener('change',e=>{showScenario(e.target.value);menu.close();});
$('reset-demo').addEventListener('click',()=>{showScenario('ready');menu.close();});
window.addEventListener('message',e=>{if(e.origin===location.origin&&e.data?.type==='pirate-review-state')showScenario(e.data.state);});
window.addEventListener('resize',layout);
window.addEventListener('pagehide',clearPending);
new ResizeObserver(layout).observe($('world'));
showScenario(new URLSearchParams(location.search).get('state')||'ready');
