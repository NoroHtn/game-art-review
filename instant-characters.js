// Approved character boards, displayed in the exact supplied order.
const ROOT = '/game-art-review/assets/instant-final/characters/';
const BOARDS = [
  {name: 'Pirate', file: '01-pirate.png', width: 1802, height: 739},
  {name: 'Siren', file: '02-siren.png', width: 1672, height: 941},
  {name: 'Kraken', file: '03-kraken.png', width: 1672, height: 941},
  {name: 'Shark', file: '04-shark.png', width: 1672, height: 941}
];
export function renderCharacterBoards(heading) {
  document.body.classList.add('instant-characters-page');
  if (!document.getElementById('instant-characters-style')) {
    const style = document.createElement('link');
    style.id = 'instant-characters-style';
    style.rel = 'stylesheet';
    style.href = '/game-art-review/instant-characters.css?v=20260921-boards4';
    document.head.append(style);
  }
  return heading('03 / INSTANT GAME', 'Characters of the crossing.', 'Pirate, Siren, Kraken and Shark. Full-body front, back and three-quarter views.') +
    '<div class="instant-character-boards">' + BOARDS.map((board, index) => `
      <figure class="character-board" id="character-${board.name.toLowerCase()}">
        <a class="character-board-art" href="${ROOT + board.file}" data-character-open="${index}" target="_blank" rel="noopener" aria-label="View ${board.name} board full screen">
          <img src="${ROOT + board.file}" alt="${board.name}: full-body front, back and three-quarter character views" width="${board.width}" height="${board.height}" loading="${index === 0 ? 'eager' : 'lazy'}" decoding="async">
        </a>
        <figcaption><div><h2>${String(index + 1).padStart(2, '0')} · ${board.name}</h2><p>Front / Back / Three-quarter</p></div><button type="button" data-character-open="${index}" class="link-button">View full screen ↗</button></figcaption>
      </figure>`).join('') + '</div>';
}
export function wireCharacterBoards(content) {
  // Create the viewer on demand: the page initially contains only the four boards.
  let dialog, current = 0, opener, priorOverflow = '';
  function show(index) {
    current = (index + BOARDS.length) % BOARDS.length;
    const board = BOARDS[current];
    const image = dialog.querySelector('img');
    image.src = ROOT + board.file;
    image.alt = `${board.name}: full-body front, back and three-quarter character views`;
    image.width = board.width;
    image.height = board.height;
    dialog.querySelector('#character-viewer-title').textContent = `${String(current + 1).padStart(2, '0')} / 04 · ${board.name}`;
    dialog.querySelector('[data-original]').href = ROOT + board.file;
  }
  function createViewer() {
    dialog = document.createElement('dialog');
    dialog.className = 'character-fullscreen';
    dialog.setAttribute('aria-labelledby', 'character-viewer-title');
    dialog.innerHTML = '<header class="character-viewer-toolbar"><strong id="character-viewer-title" aria-live="polite"></strong><div><a data-original target="_blank" rel="noopener">Open original ↗</a><button type="button" data-close aria-label="Close full-screen character board">Close ×</button></div></header><div class="character-viewer-stage"><img alt="" decoding="async"></div><nav class="character-viewer-nav" aria-label="Character boards"><button type="button" data-prev aria-label="Previous character board">← Previous</button><span>Front / Back / Three-quarter</span><button type="button" data-next aria-label="Next character board">Next →</button></nav>';
    document.body.append(dialog);
    dialog.querySelector('[data-close]').onclick = () => dialog.close();
    dialog.querySelector('[data-prev]').onclick = () => show(current - 1);
    dialog.querySelector('[data-next]').onclick = () => show(current + 1);
    dialog.addEventListener('keydown', event => {
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault();
        show(current + (event.key === 'ArrowRight' ? 1 : -1));
      }
    });
    dialog.addEventListener('close', () => {
      document.documentElement.style.overflow = priorOverflow;
      if (opener && opener.isConnected) opener.focus({preventScroll: true});
    });
  }
  content.querySelectorAll('[data-character-open]').forEach(control => {
    control.addEventListener('click', event => {
      // Preserve standard link behavior for new-tab and modifier-click actions.
      if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      if (!window.HTMLDialogElement || !HTMLDialogElement.prototype.showModal) {
        if (control.tagName === 'BUTTON') window.open(ROOT + BOARDS[Number(control.dataset.characterOpen)].file, '_blank', 'noopener');
        return;
      }
      event.preventDefault();
      opener = control;
      if (!dialog) createViewer();
      show(Number(control.dataset.characterOpen));
      priorOverflow = document.documentElement.style.overflow;
      document.documentElement.style.overflow = 'hidden';
      dialog.showModal();
    });
  });
}
