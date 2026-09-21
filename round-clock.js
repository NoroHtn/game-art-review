/* Presentation-only local simulation. Not production game mathematics. */
(() => {
  let running=false, last=performance.now(), target=1, exact=1;
  const originalBegin=beginLive, originalReset=reset, originalCrash=crash;
  const stop=()=>{running=false};
  beginLive=function(){
    originalBegin();
    if(S.phase!=='live')return;
    target=(100+Math.floor(Math.random()*401))/100;
    for(const k of ['A','B'])if(S[k].state==='active')S[k].receipt='Cash out before the round ends.';
    render();
    exact=1;last=performance.now();running=true;
    advance(1);
  };
  reset=function(){stop();originalReset()};
  crash=function(){stop();originalCrash();sync()};
  function advance(value){
    const hit=value>=target;
    S.mult=Math.min(target,Math.floor(value*100)/100);
    for(const k of ['A','B']){
      const p=S[k];
      // A target equal to the crash point loses: settlement precedes cashout.
      if(p.state==='active'&&p.auto&&p.target<target&&S.mult>=p.target)cashout(k,p.target);
    }
    if(hit){crash();return}
    // Update amounts without replacing focused controls on every frame.
    $('#multiplier').textContent=S.mult.toFixed(2)+'×';
    for(const k of ['A','B'])if(S[k].state==='active'){
      const amount=document.querySelector('[data-main="'+k+'"] .value');
      if(amount)amount.textContent=fmt(money(S[k].amount*S.mult));
    }
  }
  tick=function(){if(!S.online||S.phase!=='live')return;if(running){exact+=.25;advance(exact)}else{S.mult=Math.min(5,money(S.mult+.25));for(const k of ['A','B']){const p=S[k];if(p.state==='active'&&p.auto&&S.mult>=p.target&&S.mult<5)cashout(k,p.target)}render();if(S.mult===5)crash()}};
  const bar=document.createElement('div');bar.className='round-demo-controls';
  bar.innerHTML='<span>Demo only · random crash 1.00–5.00×</span><button type="button">Start 5-second demo</button>';
  document.querySelector('.play').append(bar);
  const replay=bar.querySelector('button');
  replay.onclick=()=>{if(S.phase==='ended')next();start()};
  function sync(){
    document.querySelector('.stage').classList.toggle('round-ended',S.phase==='ended');
    replay.disabled=!S.online||S.phase==='live'||!!window.roundScene?.get().preparing;
    replay.textContent=S.phase==='ended'?'Replay round':S.phase==='live'?'Round live':window.roundScene?.get().preparing?'Preparing…':'Start 5-second demo';
    if(S.phase==='ended')$('#phase').textContent='ROUND OVER';
  }
  function loop(now){
    const dt=now-last;last=now;
    if(running&&S.phase==='live'&&S.online){exact+=dt*.0003;advance(exact)}
    if(S.phase!=='live')running=false;
    sync();requestAnimationFrame(loop);
  }
  // Keep fixed state studies inspectable; real started rounds run automatically.
  Object.assign(window.demo,{reset,tick,crash});
  requestAnimationFrame(loop);
})();
