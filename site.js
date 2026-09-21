/* Reviewer workspace, adapted from the selected 12ui root and Instant exports.
   Native links and flow layout replace image-export positioning; evidence stays factual. */
(async function () {
  const {sections, references} = await import('/game-art-review/review-data.js');
  const path = location.pathname.replace(/^\/game-art-review(?:\/|$)/, '/').split('/').filter(Boolean)[0] || 'brief';
  const instant = path === 'instant';
  const query = new URLSearchParams(location.search);
  const known = sections.map(s => s[0]).concat(['desktop','mobile','components','specification']);
  const selected = instant ? query.get('section') || 'brief' : path === 'crash' ? 'brief' : path;
  const active = known.includes(selected) ? selected : 'brief';
  const extra = {desktop:['Desktop prototype','Two positions. One shared round.'],mobile:['Mobile prototype','Inspect the compact layout at three mobile widths.'],components:['Asset inventory','Every object, its evidence and remaining production work.'],specification:['Interaction specification','Rules, controls, geometry and review notes.']};
  const current = sections.find(s => s[0] === active);
  const title = current ? current[1] : extra[active][0];
  const desc = current ? current[2] : extra[active][1];
  const instantDescriptions = {'character-concept':'Characters, objects and pose studies',states:'Interaction and feedback states',animation:'Sequence, timing and transitions'};
  const href = key => instant ? '/game-art-review/instant/?section=' + key : '/game-art-review/' + key + '/';
  const icons = ['document','compass','users','mountain','image','grid','play','gear','cube'];
  const icon = (name) => '<img class="nav-icon" src="/game-art-review/assets/ui/' + name + '.svg" alt="" aria-hidden="true">';
  document.title = (instant ? 'Pirate Sea Hop' : 'Crash Game') + ' · ' + title + ' | Game Art Review';
  document.querySelector('#app').innerHTML =
    '<a class="skip-link" href="#content">Skip to content</a><div class="shell" id="page-flow">' +
    '<aside class="sidebar" id="nav"><a class="workspace-brand" id="nav-brand" href="/game-art-review/"><img src="/game-art-review/assets/ui/orbit.png" alt="" width="42" height="24"><span>Game Art Review<small>Art Lead · test assignment</small></span></a>' +
    '<nav class="game-switch" aria-label="Choose game"><a href="/game-art-review/" ' + (!instant ? 'aria-current="true"' : '') + '>01 · Crash</a><a href="/game-art-review/instant/" ' + (instant ? 'aria-current="true"' : '') + '>02 · Instant</a></nav>' +
    '<div class="project-caption">' + (instant ? 'PIRATE SEA HOP · INSTANT' : 'CRASH GAME') + '</div>' +
    '<nav class="chapter-nav" aria-label="Review sections">' + sections.map((s,i) => '<a id="nav-item-' + s[0] + '" href="' + href(s[0]) + '" ' + (active === s[0] || s[0] === 'final-ui' && ['desktop','mobile'].includes(active) ? 'aria-current="page"' : '') + '><span class="navnum">' + String(i+1).padStart(2,'0') + '</span>' + icon(icons[i]) + '<span>' + s[1] + '</span></a>').join('') + '</nav>' +
    (!instant ? '<div class="nav-resources"><p>INSPECT DIRECTLY</p><nav aria-label="Review resources"><a href="/game-art-review/desktop/">Desktop demo ↗</a><a href="/game-art-review/mobile/">Mobile demo ↗</a><a href="/game-art-review/components/">All assets & objects ↗</a><a href="/game-art-review/specification/">Interaction specification ↗</a></nav></div>' : '<div class="nav-resources"><p>PROJECT STATUS</p><nav aria-label="Instant resources"><a href="/game-art-review/instant/?section=final-ui">Desktop & mobile screens ↗</a><a href="/game-art-review/instant/?section=deliverables">Assets & deliverables ↗</a></nav></div>') +
    '<a class="assignment-link" href="'+(instant?'/game-art-review/assets/instant/assignment-brief.pdf':'/game-art-review/assets/assignment-brief.pdf')+'" target="_blank" rel="noopener">Original assignment PDF ↗</a></aside>' +
    '<main><header class="topline"><span>Game Art Review <span class="crumb-divider">/</span> ' + (instant ? 'Instant' : 'Crash') + ' <span class="crumb-divider">/</span> ' + title + '</span><span class="pill">' + (instant ? 'Final artwork · desktop & mobile' : 'Interactive art prototype') + '</span></header><section id="content" tabindex="-1"></section>' +
    '<footer class="page-footer"><span>Game Art Review · ' + (instant ? 'Pirate Sea Hop' : 'Crash Game') + '</span><a href="#content">Back to top ↑</a></footer></main></div>';
  const content = document.querySelector('#content');
  const heading = (k,t,d) => '<header class="page-heading"><p class="art-kicker">' + k + '</p><h1>' + t + '</h1><p class="intro">' + d + '</p></header>';
  const status = s => '<span class="status ' + (s === 'Pending' ? 'pending' : '') + '">' + s + '</span>';
  const displayControls = '<div class="segmented" role="group" aria-label="Game display mode"><button data-display="color" aria-pressed="true">Color</button><button data-display="grayscale" aria-pressed="false">Grayscale</button></div>';
  function artDirection() {
    content.innerHTML = heading('02 / ART DIRECTION', 'Ink, character & a little chaos.', 'Six supplied references. One consistent visual language for the crash game.') +
      '<div class="board-jumps"><a href="#reference-board">References</a><a href="#principles">Visual principles</a><a href="#palette">Game palette</a><a href="#typography">Typography</a></div>' +
      '<section id="reference-board"><div class="section-heading"><div><h2>The reference board</h2><p class="caption">Full compositions, consistent framing, no cropped signatures.</p></div><div class="segmented" role="group" aria-label="Reference treatment"><button data-treatment="harmonized" aria-pressed="true">Harmonized</button><button data-treatment="original" aria-pressed="false">Originals</button></div></div>' +
      '<div class="reference-grid harmonized">' + references.map((r,i) => '<figure class="reference-card"><a class="reference-art" href="/game-art-review/assets/references/' + r.file + '" target="_blank" rel="noopener" aria-label="Open original: ' + r.title + '"><img src="/game-art-review/assets/references/' + r.file + '" alt="' + r.alt + '" loading="' + (i < 2 ? 'eager' : 'lazy') + '"></a><figcaption><span class="ref-index">REFERENCE ' + String(i+1).padStart(2,'0') + '</span><h3>' + r.title + '</h3><p>' + r.note + '</p><a href="/game-art-review/assets/references/' + r.file + '" target="_blank" rel="noopener">Original · ' + r.source + ' ↗</a></figcaption></figure>').join('') + '</div><p class="board-note" id="treatment-note" aria-live="polite">Harmonized view: a reversible monochrome/soft-contrast display treatment. Original files and visible signatures are unchanged. References are not original project artwork; authorship is not asserted.</p></section>' +
      '<section id="principles"><h2>What we take into the game</h2><div class="principles"><section><span class="section-number">01</span><h3>Silhouette first</h3><p>Bold contours, separated limbs and a readable hand-to-leg grip. Test the connected cast at mobile size.</p></section><section><span class="section-number">02</span><h3>Stage the story</h3><p>Keep the five-second setup at bottom-left. Leave the center clear for the multiplier and the upper-right open for flight.</p></section><section><span class="section-number">03</span><h3>Texture with restraint</h3><p>Print character belongs in the art, not across UI labels. Amounts, primary actions and receipts stay crisp.</p></section></div></section>' +
      '<section id="palette"><h2>A quiet field. Warm light.</h2><p>These colors belong to the game. The neutral review website gives the artwork room to speak.</p><div class="palette-grid">' + [['#083848','Night sky'],['#193A35','Pasture'],['#F9E6B4','Cream light'],['#D8D790','Tractor beam'],['#BF7652','Barn & leather'],['#10151A','Ink']].map(c => '<div class="swatch"><div style="background:' + c[0] + '"></div><strong>' + c[1] + '</strong><code>' + c[0] + '</code></div>').join('') + '</div></section>' +
      '<section id="typography"><h2>Big numbers. Clear decisions.</h2><div class="type-direction"><div class="type-specimen"><div class="type-number">2.48×</div><div class="type-round">ROUND LIVE</div><small>Live type · Caprasimo</small></div><div><h3>A rounded, heavy display voice</h3><p>Caprasimo brings the broad curves and weight of your supplied reference into editable live text. Cream fill, a dark outline and a short offset shadow keep it readable.</p><p>This is a close stylistic match, not a claim to have identified the exact reference font. Controls keep their simpler interface type.</p><a class="text-link" href="/game-art-review/assets/references/07-type-reference.jpg" target="_blank" rel="noopener">Inspect your supplied type reference ↗</a><div class="next-links"><a class="link-button" href="/game-art-review/desktop/">Test color / grayscale</a></div></div></div></section>';
    content.querySelectorAll('[data-treatment]').forEach(b => b.onclick = () => {
      const tone = b.dataset.treatment === 'harmonized';
      content.querySelector('.reference-grid').classList.toggle('harmonized',tone);
      content.querySelectorAll('[data-treatment]').forEach(x => x.setAttribute('aria-pressed',String(x === b)));
      content.querySelector('#treatment-note').textContent = tone ? 'Harmonized view: reversible monochrome/soft-contrast treatment. Original files and signatures are unchanged. These are supplied references, not original project artwork.' : 'Original view: the six images in their supplied colors. Open any image to inspect its full resolution and visible signature.';
    });
  }
  async function instantPage() {
    const {renderInstant} = await import('/game-art-review/instant-review.js?v=20260922-motion-tentacles-v1');
    await renderInstant({content,active,heading,wireDisplay});
  }
  function wireDisplay() {
    const get = () => { try {return localStorage.getItem('game-art-display') || 'color'} catch {return 'color'} };
    const apply = mode => {
      content.querySelectorAll('[data-study]').forEach(e => e.classList.toggle('is-grayscale',mode === 'grayscale'));
      content.querySelectorAll('[data-display]').forEach(b => b.setAttribute('aria-pressed',String(b.dataset.display === mode)));
    };
    content.querySelectorAll('[data-display]').forEach(b => b.onclick = () => {try {localStorage.setItem('game-art-display',b.dataset.display)} catch {} apply(b.dataset.display)});
    apply(get());
    window.addEventListener('storage',e => {if(e.key === 'game-art-display')apply(get())});
  }
  function prototype() {
    const mobile = active === 'mobile', states = active === 'states';
    let width = mobile ? 390 : states ? 1024 : 1440;
    content.innerHTML = heading(states ? '06 / UI & STATES' : '05 / GAME SCREENS', title, desc) +
      '<nav class="board-jumps" aria-label="Screen views"><a href="/game-art-review/desktop/" ' + (!mobile && !states ? 'aria-current="page"' : '') + '>Desktop</a><a href="/game-art-review/mobile/" ' + (mobile ? 'aria-current="page"' : '') + '>Mobile</a><a href="/game-art-review/states/" ' + (states ? 'aria-current="page"' : '') + '>Final Figma states</a><a href="/game-art-review/specification/">Interaction rules</a></nav>' +
      (!states ? '<div class="controls"><label>Show state <select id="scenario"><option value="ready">Ready to bet</option><option value="live">Both cashouts active</option><option value="placed">Accepted / cancel</option><option value="locked">Betting closed</option><option value="mixed">A collected / B active</option><option value="queued">Next bet queued</option><option value="lost">Round ended</option><option value="funds">Insufficient balance</option></select></label><button data-command="start">Start 5-second setup</button><button data-command="tick">+0.25×</button><button data-command="crash">End round</button><button data-command="next">Next round</button><button data-command="reset">Reset demo</button></div>' : '<p class="review-note">All twelve states are visible below, including pending, queued, lost and reconnecting. These are component studies, not live wagers.</p>') +
      '<div class="viewbar"><span>' + (states ? 'Component library' : mobile ? 'Mobile viewport' : 'Desktop viewport · 1440 px') + '</span>' + (mobile ? '<label>Width <select id="width" aria-label="Mobile viewport width"><option>360</option><option selected>390</option><option>430</option></select></label>' : '') + '<a href="/game-art-review/previews/' + active + '/?standalone&state=ready" target="_blank" rel="noopener">Open full view ↗</a></div><div class="canvas ' + (mobile ? 'mobile' : '') + (states ? ' state-canvas' : '') + '"><div class="frame-holder"><iframe title="' + title + '" src="/game-art-review/previews/' + active + '/?standalone&state=ready"></iframe></div></div><p id="notice" class="notice" aria-live="polite"></p><p class="caption">' + (states ? 'Inspect at full size using “Open full view”.' : 'Started rounds rise automatically and crash randomly at 1.00–5.00×. State-menu examples stay fixed for inspection. Use B&W in the game header for a grayscale study. A cashout affects its own bet only; the shared round continues.') + '</p>';
    const frame = content.querySelector('iframe'), holder = content.querySelector('.frame-holder');
    let ready = false;
    function resize() {
      const available = content.querySelector('.canvas').clientWidth - (states ? 0 : 24);
      if(states)width = available;
      const scale = Math.min(1,available/width);
      const base = mobile ? 844 : 900;
      frame.style.width = width + 'px'; frame.style.height = base + 'px';
      const height = ready ? Math.max(base,frame.contentDocument.documentElement.scrollHeight) : base;
      holder.style.width = width*scale + 'px'; holder.style.height = height*scale + 'px';
      frame.style.height = height + 'px'; frame.style.transform = 'scale(' + scale + ')';
    }
    frame.onload = () => {
      ready = true; resize();
      if(!states) {
        content.querySelector('#notice').textContent = 'Place a bet or press Start 5-second setup. The round becomes live after five seconds.';
        if(query.get('state') === 'lost') frame.contentWindow.demo.scenario('lost');
        else if(query.get('play') === '1') frame.contentWindow.demo.start();
      }
      frame.contentDocument.addEventListener('click',() => setTimeout(resize,100));
    };
    window.addEventListener('resize',resize); resize();
    if(!states) {
      content.querySelector('#scenario').onchange = e => {if(!ready)return;frame.contentWindow.demo.scenario(e.target.value);content.querySelector('#notice').textContent = 'Showing: ' + e.target.selectedOptions[0].text + '.';resize()};
      content.querySelectorAll('[data-command]').forEach(b => b.onclick = () => {
        if(!ready)return; frame.contentWindow.demo[b.dataset.command]();
        const s = frame.contentWindow.demo.get();
        content.querySelector('#notice').textContent = b.dataset.command === 'start' ? 'Five-second setup started. Watch the bottom-left of the scene.' : 'Round ' + s.round + ' · ' + s.phase + ' · balance ' + s.balance.toFixed(2) + '.';
        if(b.dataset.command === 'reset')content.querySelector('#scenario').value = 'ready';
        resize();
      });
    }
    if(mobile)content.querySelector('#width').onchange = e => {width = Number(e.target.value);resize()};
  }
  function inventory() {
    const rows = [
      ['Cow','/game-art-review/assets/approved/cow.png','Model, poses and expression board','2D Artist','Design approved','Separate limbs; reconstruct hidden areas; test the gripped leg.'],
      ['Farmer','/game-art-review/assets/approved/farmer.png','Model, poses and expression board','2D Artist','Design approved','Run, jump and contact poses; separated hands and limbs.'],
      ['Alien','/game-art-review/assets/approved/alien.png','Model, poses and expression board','2D Artist','Design approved','Separate cockpit layers and expressions for the rig.'],
      ['UFO & beam','/game-art-review/assets/approved/spaceship.png','Four views and tractor-beam design','2D Artist','Design approved','Layered ship, dome, lights and independent beam mask.'],
      ['Farm background','/game-art-review/assets/approved/background.png','Moonlit environment board','2D Artist','Design approved','Separated depth layers and final responsive crop guides.'],
      ['Connected flight','/game-art-review/assets/scenes/flight-group.png','Transparent connected group for the preview','2D / Spine','Preview','Replace flattened preview with a continuous, constrained rig.'],
      ['Setup sequence','/game-art-review/animation/','Six key poses; desktop and mobile','Spine Animator','Timed preview','Continuous motion, crash release, reset and export validation.'],
      ['Game interface','/game-art-review/final-ui/','Final desktop and mobile Figma screens','UI Designer','Available','Verify component structure and production measurements in the linked Figma file.'],
      ['Control states','/game-art-review/states/','29 final desktop and mobile screen exports','UI Designer','Available','Check final wallet/server events during integration.'],
      ['Submission','/game-art-review/deliverables/#figma','Linked Figma section, final screen PDFs and review presentation','Art Lead','Available','Align the full presentation PDF with the final Figma file and verify reviewer access.']
    ];
    content.innerHTML = heading('ASSETS & OBJECTS', 'Nothing hidden from review.', 'Inspect each object, its current evidence and the work still needed for production.') +
      '<div class="inventory-list">' + rows.map((r,i) => '<article class="inventory-row"><span class="evidence-number">' + String(i+1).padStart(2,'0') + '</span><div><h2><a href="' + r[1] + '">' + r[0] + ' ↗</a></h2><p>' + r[2] + '</p><p class="remaining"><strong>Next:</strong> ' + r[5] + '</p></div><div class="inventory-meta">' + status(r[4]) + '<small>' + r[3] + '</small></div></article>').join('') + '</div>';
  }
  if(instant)await instantPage();
  else if(active === 'art-direction')artDirection();
  else if(['desktop','mobile'].includes(active))prototype();
  else if(active === 'components')inventory();
  else {
    try {
      const response = await fetch('/game-art-review/' + active + '-content.html?v=20260922-crash-figma-new-tab-v2', {cache:'no-cache'});
      if(!response.ok)throw new Error('Page unavailable');
      content.innerHTML = await response.text();
      const kicker = content.querySelector('.art-kicker');
      if(kicker && current)kicker.textContent = String(sections.indexOf(current)+1).padStart(2,'0') + ' / ' + current[1].toUpperCase();
      if(active === 'final-ui') {
        const section = content.querySelector('article');
        section.insertAdjacentHTML('afterbegin','<nav class="board-jumps" aria-label="Game screen review"><a href="/game-art-review/states/">All 29 final screens</a><a href="https://www.figma.com/design/AsCxwtHPQaX1Ra1NKav1kq/Norair-Harutyunyan-Test-Task---CRASH-GAME--?node-id=8-10993&amp;t=yymlcTTt1zcWINbN-1" target="_blank" rel="noopener">Open Figma ↗</a><a href="/game-art-review/desktop/">Interactive desktop study ↗</a><a href="/game-art-review/mobile/">Interactive mobile study ↗</a></nav>');
      }
    } catch {
      content.innerHTML = heading('PAGE UNAVAILABLE', 'This section could not load.', 'Please reload the page or return to the brief.') + '<a class="link-button" href="/game-art-review/brief/">Back to concept & brief</a>';
    }
  }
  // Keep every Crash Figma link in a separate tab, including older cached fragments.
  // The Instant renderer and its links are intentionally unchanged.
  if(!instant)content.querySelectorAll('a[href]').forEach(link => {
    const url = new URL(link.href, location.href);
    if(url.hostname === 'www.figma.com' || url.hostname === 'figma.com') {
      link.target = '_blank';
      link.relList.add('noopener');
    }
  });
  const copyFigma = content.querySelector('#copy-figma-link');
  if(copyFigma)copyFigma.addEventListener('click',async () => {
    const input = content.querySelector('#figma-link-value');
    const message = content.querySelector('#figma-link-status');
    try {
      await navigator.clipboard.writeText(input.value);
      message.textContent = 'Figma link copied. Paste it into Safari or your browser.';
    } catch {
      content.querySelector('#figma-copy-fallback').hidden = false;
      input.focus();
      input.select();
      message.textContent = 'Select and copy this link, then open it in Safari or your browser.';
    }
  });
  content.insertAdjacentHTML('afterbegin','<a class="mobile-section-link" href="#nav">↑ All review sections</a>');
  if(location.hash)requestAnimationFrame(() => document.getElementById(location.hash.slice(1))?.scrollIntoView());
  else if(innerWidth <= 760)requestAnimationFrame(() => content.scrollIntoView({behavior:'instant'}));
})().catch(() => {document.querySelector('#app').innerHTML = '<main><h1>Game Art Review</h1><p>The workspace could not load. Please refresh.</p><a href="/game-art-review/previews/desktop/">Open the game prototype</a></main>'});
