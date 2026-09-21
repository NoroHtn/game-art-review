// Instant submission chapter: the same layout and section hierarchy as Crash.
const A = '/game-art-review/assets/instant-final/';
const H = section => '/game-art-review/instant/?section=' + section;
const esc = value => String(value).replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;');
const PDF = A + 'downloads/Pirate_Sea_Hop_Test_Presentation.pdf?v=20260922-matched-25';
const evidence = [
  ['brief', 'Concept &amp; brief', 'Idea, theme, audience and differentiation'],
  ['art-direction', 'Art direction', 'Nine approved references and visual principles'],
  ['character-concept', 'Character boards', 'Pirate, Siren, Kraken and Shark'],
  ['environment', 'Environment', 'Complete route, ship, platforms and treasure island'],
  ['final-ui', 'Game screens', 'Final mobile and desktop Figma screens'],
  ['states', 'UI state library', 'Ten named states for each device'],
  ['animation', 'Motion direction', 'Combined tentacles and three losing-state references'],
  ['production', 'Production plan', 'Workload, milestones, timeline and risks']
];
export function renderInstantDeliverables(manifest) {
  const figma = esc(manifest.figma);
  return `<article class="case-chapter instant-deliverables">
    <p class="art-kicker">09 / DELIVERABLES</p>
    <h1>What is ready. What remains.</h1>
    <p class="intro">Review evidence is available in this website. The assignment’s final submission format is a Figma presentation and a matching PDF.</p>
    <div class="submission-grid">
      <section class="submission-card" id="figma">
        <span class="status">Available</span>
        <h2>Figma presentation</h2>
        <p>Instant game presentation. This link opens the specific game section supplied with the final screen exports.</p>
        <div class="preview-actions">
          <a class="link-button primary" href="${figma}" target="_blank" rel="noopener noreferrer">Open Instant game in Figma ↗</a>
          <button class="link-button" type="button" id="copy-figma">Copy Figma link</button>
        </div>
        <p id="copy-status" class="notice" role="status" aria-live="polite"></p>
        <input id="figma-url" aria-label="Figma section link" type="url" readonly value="${figma}" spellcheck="false" hidden>
      </section>
      <section class="submission-card" id="pdf">
        <span class="status">Available</span>
        <h2>Presentation PDF</h2>
        <p>25-page presentation covering the concept, grayscale moodboard, all four character boards, all 20 final screens and production plan, including the updated motion references.</p>
        <div class="preview-actions">
          <a class="link-button primary" href="${PDF}" target="_blank" rel="noopener">Open PDF</a>
          <a class="link-button" href="${PDF}" download="Instant_Game_Test_Presentation.pdf">Download PDF</a>
        </div>
      </section>
    </div>
    <section id="figma-exports">
      <h2>Final Figma screen exports</h2>
      <div class="delivery-links">
        <a href="${A}downloads/Instant_Mobile.pdf" target="_blank" rel="noopener"><strong>Mobile · all game states ↗</strong><span>Original Figma export · 10 screens</span></a>
        <a href="${A}downloads/Instant_Web.pdf" target="_blank" rel="noopener"><strong>Desktop · all game states ↗</strong><span>Original Figma export · 10 screens</span></a>
      </div>
      <div class="next-links"><a class="link-button" href="${H('final-ui')}">Browse all 20 screens</a></div>
    </section>
    <section>
      <h2>Available review evidence</h2>
      <div class="delivery-links">${evidence.map(([section,title,detail]) => `<a href="${H(section)}"><strong>${title}</strong><span>${detail}</span></a>`).join('')}</div>
    </section>
    <section id="source-assets">
      <h2>Source files</h2>
      <div class="delivery-links">
        <a href="${A}downloads/Instant_Game_Assets.zip" download><strong>Original game assets ↓</strong><span>21 supplied PNG assets · original ZIP preserved</span></a>
        <a href="${A}downloads/Instant_References.zip" download><strong>Original reference pack ↓</strong><span>15 supplied references · the approved moodboard uses nine</span></a>
        <a href="${A}downloads/Assignment_Brief.pdf" target="_blank" rel="noopener"><strong>Original assignment PDF ↗</strong><span>Test requirements and submission format</span></a>
        <a href="${H('character-concept')}"><strong>Approved character boards ↗</strong><span>Latest Pirate, Siren, Kraken and Shark boards</span></a>
      </div>
    </section>
    <section>
      <h2>Production handoff still required</h2>
      <div class="table-wrap"><table><thead><tr><th>Package</th><th>Current evidence</th><th>Remaining work</th></tr></thead><tbody>
        <tr><td>Source illustration</td><td>Approved character boards, environment and encounter poses</td><td>Editable sources, separated layers and reconstructed hidden areas</td></tr>
        <tr><td>Spine animation</td><td>Jump and encounter poses, combined tentacles and proposed timings</td><td>Continuous rigs, landing pivots, motion events, reset and runtime exports</td></tr>
        <tr><td>Interface handoff</td><td>20 final mobile/desktop screens and written state behavior</td><td>Native components, confirmed values, pending/error states and reconnect behavior</td></tr>
        <tr><td>Submission</td><td>This review website, 25-page presentation and production plan</td><td>Verify reviewer access to the supplied Figma section; Figma content is unchanged</td></tr>
      </tbody></table></div>
    </section>
    <section class="review-note">
      <h2>Before submitting</h2>
      <ul><li>Keep the PDF and Figma aligned in story and state order.</li><li>Review the main mobile and desktop screens at readable scale.</li><li>Keep reference sources separate from original project artwork.</li><li>Label estimates and unfinished production work honestly.</li><li>Check Figma access from a reviewer’s account.</li></ul>
    </section>
    <div class="next-links"><a class="link-button" href="#source-assets">Inspect source files</a><a href="${H('states')}">Read UI state requirements</a></div>
  </article>`;
}
