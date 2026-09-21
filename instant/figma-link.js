/* Supplied link only. No Figma API, embed, prefetch, or document access. */
(() => {
  'use strict';
  if (new URLSearchParams(location.search).get('section') !== 'deliverables') return;
  const url = 'https://www.figma.com/design/L7QrdpDcaaWx9GkEgHsWWj/Norair-Harutyunyan-Test-Task---INSTANT-GAME--?node-id=8-10993&p=f&t=Iio8oZWtIOWxkWzD-0';
  function install() {
    const content = document.getElementById('content');
    const existingLinks = content && content.querySelector('.delivery-links');
    if (!existingLinks) return false;
    if (content.querySelector('#instant-figma-link-card')) return true;
    const grid = document.createElement('div');
    grid.className = 'submission-grid';
    const card = document.createElement('section');
    card.className = 'submission-card';
    card.id = 'instant-figma-link-card';
    card.innerHTML = '<span class="status">Link supplied</span><h2>Figma design</h2><p>Open the Instant game design file supplied for this project.</p><div class="preview-actions"><a class="link-button primary" target="_blank" rel="noopener noreferrer">Open Instant game in Figma ↗</a><button class="link-button" type="button">Copy Figma link</button></div><div class="figma-copy-fallback" hidden><label for="instant-figma-url">Figma link</label><input id="instant-figma-url" type="url" readonly spellcheck="false" style="width:100%;box-sizing:border-box"></div><p class="notice" role="status" aria-live="polite"></p>';
    card.querySelector('a').href = url;
    const input = card.querySelector('input');
    input.value = url;
    card.querySelector('button').addEventListener('click', async () => {
      const status = card.querySelector('[role="status"]');
      try {
        if (!navigator.clipboard || !window.isSecureContext) throw new Error('Clipboard unavailable');
        await navigator.clipboard.writeText(url);
        status.textContent = 'Figma link copied.';
      } catch (_) {
        card.querySelector('.figma-copy-fallback').hidden = false;
        input.focus();
        input.select();
        status.textContent = 'Select and copy the link above.';
      }
    });
    grid.appendChild(card);
    existingLinks.before(grid);
    for (const row of content.querySelectorAll('tr')) {
      if (row.cells.length === 2 && row.cells[0].textContent.trim() === 'Native Figma file and matching PDF') {
        row.cells[1].textContent = 'Figma design link supplied above. Matching presentation PDF remains pending.';
      }
    }
    return true;
  }
  if (install()) return;
  const observer = new MutationObserver(() => {
    if (install()) observer.disconnect();
  });
  observer.observe(document.body, {childList: true, subtree: true});
  window.setTimeout(() => observer.disconnect(), 30000);
})();
