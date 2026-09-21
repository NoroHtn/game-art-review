/* Shared visual timeline. Financial state stays in the existing demo. */
/* The study preference changes presentation only; it never resets a round. */
(() => {
  const game=document.querySelector('.game'),head=document.querySelector('.game-head');
  const toggle=document.createElement('button');
  toggle.type='button';toggle.className='study-toggle';toggle.textContent='B&W';
  toggle.setAttribute('aria-label','Grayscale study mode');
  toggle.title='Toggle color and grayscale';head.insertBefore(toggle,head.querySelector('#help'));
  head.querySelector('.brand').textContent='MOO-NAPPED!';
  function set(mode,persist=true){
    const gray=mode==='grayscale';game.classList.toggle('is-grayscale',gray);
    toggle.setAttribute('aria-pressed',String(gray));
    if(persist)try{localStorage.setItem('game-art-display',gray?'grayscale':'color')}catch{}
    window.dispatchEvent(new CustomEvent('review-display-change',{detail:gray?'grayscale':'color'}));
  }
  toggle.onclick=()=>set(game.classList.contains('is-grayscale')?'color':'grayscale');
  window.reviewDisplay={set,get:()=>game.classList.contains('is-grayscale')?'grayscale':'color'};
  let initial='color';try{initial=localStorage.getItem('game-art-display')||'color'}catch{}
  set(initial,false);window.addEventListener('storage',e=>{if(e.key==='game-art-display')set(e.newValue,false)});
})();
(() => {
  const stage=document.querySelector('.stage');
  const canvas=document.createElement('canvas'); canvas.className='scene-canvas';
  canvas.setAttribute('role','img'); canvas.setAttribute('aria-label','Cow grazing in the bottom-left of a moonlit field');
  stage.prepend(canvas); const ctx=canvas.getContext('2d');
  const mobile=location.pathname.includes('/game-art-review/mobile/');
  const sources={sheet:'/game-art-review/assets/scenes/desktop-storyboard.jpg',bg:'/game-art-review/assets/approved/background.png',group:'/game-art-review/assets/scenes/flight-group.png',crash:'/game-art-review/assets/scenes/crash-clean.png'};
  const art={}; let loaded=false,elapsed=0,flying=0,last=performance.now(),preparing=false,previous='',frame=0;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  const descriptions=['Cow grazing','Alien approaches in the UFO','Tractor beam activates','Cow lifts; farmer runs','Farmer jumps toward the cow','Farmer grips the cow’s rear leg'];
  Promise.all(Object.entries(sources).map(([k,src])=>new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>{art[k]=im;resolve()};im.onerror=reject;im.src=src}))).then(()=>{loaded=true;draw()}).catch(()=>{stage.dataset.artError='true';canvas.setAttribute('aria-label','Scene artwork could not load. Please refresh.');});
  function size(){const d=Math.min(devicePixelRatio||1,2);canvas.width=Math.round(stage.clientWidth*d);canvas.height=Math.round(stage.clientHeight*d);draw()}
  new ResizeObserver(size).observe(stage);
  function draw(){if(!loaded)return;const w=canvas.width,h=canvas.height;ctx.clearRect(0,0,w,h);
    if(preparing || S.phase==='open' || S.phase==='locked'){
      // Source rectangles exclude the storyboard captions and borders.
      const rects=[[8,6,752,248],[775,6,752,248],[8,291,752,250],[775,291,752,250],[8,579,752,249],[775,579,752,249]];
      const r=rects[frame];
      // A single left-anchored crop preserves the approved scene and its proportions.
      const sw=Math.min(r[2],r[3]*w/h),sh=Math.min(r[3],r[2]*h/w);
      ctx.drawImage(art.sheet,r[0],r[1]+r[3]-sh,sw,sh,0,0,w,h);
    }else if(S.phase==='ended'){
      // Text-free crash artwork keeps the actual random result as live text.
      ctx.drawImage(art.crash,0,0,w,h);
    }else{
      if(mobile){const sw=art.bg.height*w/h;ctx.drawImage(art.bg,0,0,sw,art.bg.height,0,0,w,h)}else ctx.drawImage(art.bg,0,0,w,h);
      const t=reduced?0:Math.min((S.mult-1)/4,1);
      const gw=w*(mobile?.32:.22),gh=gw*art.group.height/art.group.width;
      // Sweep below the reading area, then rise into the upper-right.
      const tx=1-Math.pow(1-t,3),ty=Math.pow(t,3);
      const x=w*.045+tx*(w*.955-gw-w*.045),y=h-gh-h*.035-ty*(h-gh-h*.095);
      ctx.drawImage(art.group,x,y,gw,gh);
    }
  }
  window.roundScene={begin(){if(preparing)return;elapsed=0;frame=0;preparing=true;flying=0;stage.classList.add('preparing');},reset(){preparing=false;elapsed=0;flying=0;frame=0;stage.classList.remove('preparing');},get:()=>({elapsed,frame,preparing,flying,loaded})};
  function loop(now){const dt=now-last;last=now;
    if(S.phase!==previous){if(S.phase==='open'&&previous!==''&&!preparing)window.roundScene.reset();if(S.phase==='live'){preparing=false;stage.classList.remove('preparing');flying=0}previous=S.phase}
    if(preparing&&S.online){elapsed+=dt;frame=elapsed<1500?0:elapsed<2500?1:elapsed<3500?2:elapsed<4500?3:elapsed<4900?4:5;
      document.querySelector('#phase').textContent='ROUND STARTS IN '+Math.max(0,(5000-elapsed)/1000).toFixed(1)+'s';
      if(elapsed>=5000){preparing=false;stage.classList.remove('preparing');beginLive();}
    }else if(S.phase==='live'&&S.online)flying+=dt;
    if(S.phase==='open'&&!preparing)frame=0;
    canvas.setAttribute('aria-label',preparing?descriptions[frame]:S.phase==='live'?'UFO lifts the cow and farmer diagonally from bottom-left to top-right':S.phase==='ended'?'Round ended':descriptions[frame]);
    stage.classList.toggle('waiting',S.phase==='open'||S.phase==='locked');
    draw();requestAnimationFrame(loop);
  }
  size();requestAnimationFrame(loop);
})();
