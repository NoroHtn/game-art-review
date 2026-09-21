# Crash correction pass - 20 September 2026

User authorization: correct automatic gameplay, show the crash composition in the main presentation and PDF. Six new loading frames are approval-only and must not be published yet.

## Changes

- Shared clock used by desktop and mobile: five-second setup, 0.30x/second progression, discrete uniformly sampled 1.00-5.00x final multiplier. Demo only; not production game math.
- Crash freezes actual multiplier, converts active wagers to lost and leaves accepted cashouts intact. Result remains visible until replay.
- Fixed menu scenarios remain paused for inspection; manually started rounds run automatically. Offline state pauses progression.
- Reused user crash composition as presentation evidence. Generated a text-free adaptation for canvas so baked 3.72x never conflicts with the actual result.
- Added crash slide after mobile screen in the existing presentation PDF; other slides preserved, following pages renumbered. Total 16 pages.
- Retained existing loading images. New loading drafts are not in this repository or deployment.

## Verification

- Browser: desktop observed live 1.39x progressing to crash 4.03x; both active wagers lost.
- Browser: mobile cashout A paid 24.80 at 2.48x, B subsequently lost. Replay passed the full setup and ended at a random 2.05x.
- Mobile loss layout inspected at 360 and 430px; 390px interaction tests passed.
- Corrected replay transition so scene reset does not cancel a newly started countdown.
- Node checks: 1x/5x bounds, growth, offline pause, auto cashout strictly before crash, crash wins equal target, reset cancels progression.
- PDF new crash page and following renumbered page rendered and inspected. Embedded fonts used for additions.
- Local asset references and JavaScript syntax checked.

Notion tracking: https://app.notion.com/p/3e049f0e94c88184a728c514d7d75205
Remaining approval gate: six loading drafts. Continuous Spine animation remains outside this prototype.
