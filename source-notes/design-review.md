# Cow & Aliens — assignment review and implementation record

## Assignment coverage

The supplied Redcore brief asks for an idea and theme, intended audience, visual style, principles and differentiation; a moodboard and main game screen; and a production plan covering tasks, milestones, workloads, timeline and risks. Its requested submission is a Figma presentation and matching PDF. The website is supporting review material.

## Findings and response

| Finding | Response |
| --- | --- |
| Eleven primary/resource routes obscure the review order | Six presentation chapters, with technical resources secondary |
| Borrowed references appear before the project result | Own approved art and concise concept first; reference attribution retained |
| Final UI chapter is a placeholder | Actual desktop/mobile screenshots and working preview links |
| Production plan has no estimates, dependencies or risks | Four milestones over a provisional 15-day art cycle; role workloads and risk owners |
| Old upper-right-only rules conflict with approved launch | Five-second lower-left setup, followed by flight toward the upper-right |
| Tall mobile scene pushes cashout controls below the viewport | Compact aspect-preserving scene crop with both betting actions visible |
| Desktop setup repeats the background and moon | One left-anchored crop from each approved storyboard panel |
| Shared flight crosses the live number | Curved flight travels below the reading area before rising on the right |
| No verified Figma/PDF submission links | Explicit pending status; no fabricated download links |

## Review structure

1. Concept: vintage farm-comedy crash game, intended audience and differentiation.
2. Art direction: credited references, original cast, environment and drawing principles.
3. Game screens: desktop/mobile result, hierarchy and interactive controls.
4. Motion: approved storyboard, exact five-second setup and production handoff.
5. Production: ownership, dependencies, estimates, milestones and mitigations.
6. Deliverables: available materials and outstanding submission requirements.

## Design reference rationale

- Pentagram, Harry Potter: Quidditch Champions: large project images, short rationale and application examples. https://www.pentagram.com/work/harry-potter-quidditch-champions
- ustwo, Monument Valley: connect visual inspiration to the intended player experience. https://ustwo.com/work/monument-valley/

These inform presentation structure; neither project's artwork nor claims are reused.

## Plugin outcome

12ui authenticated successfully and generated four actual design candidates. Direction A was selected for its strong image-led opening and quiet editorial body. The full-page branch failed at the provider and its resume retained that terminal failure. The selected image was therefore sent through 12ui's direct conversion workflow, with the existing chapter content and approved project assets retained during integration.

Notion is installed and enabled according to Plugin Management, but this session exposes no Notion search, fetch, create or update operations. No Notion page was read or written, and this record does not claim otherwise.

## Production assumption

15 working days in parallel: UI Designer 12 person-days, 2D Artist 13, Spine Animator 11, Art Lead 5. Total 41 person-days. Scope excludes backend, game math, audio and certification. Re-estimate after early mobile layout and rig feasibility review.

## Implementation and verification

The converted 12ui component tree is the home-page baseline. Its sidebar, hero, action links and reference cards are retained. Geometry is adapted to natural document flow so text can wrap and grow. The generated 390 px export used very small text; mobile now uses readable type and an accessible chapter toggle. The original approved farm, flight group and original supplied reference images replace the conversion's altered sample art. The extracted Saturn decoration and button icons are retained. The hero uses at most a 35% dark overlay to support text contrast.

A target-based 12ui closeout ran against the actual desktop screenshot with the original unchanged LayerDoc. Screenshot input produces an unanchored specification, not a numerical DOM-fidelity score. The selected target and rendered page were compared visually; content additions, original artwork and legible responsive typography are intentional differences. The failed full-page branch generated no additional approved lower-page targets.

Verified: six chapter links, mobile menu open/close, no page overflow at 360/390/430 iframe widths, intact detail routes and local asset paths, both mobile actions inside 844 px height, a shared five-second clock without second-bet restart, independent cashout, and reset. The later results table scrolls below the mobile controls.

### 12ui purchase record

| purchase | stage | invocation | price ceiling |
| --- | --- | --- | --- |
| `crt-6834250fd21ba0171280beb397b6a2e9e1700716` | draft | `improve` pid 2, started 2026-09-19T18:21:40.474Z | $0.12 (stage ceiling) |
| `29b8cfa8-d32d-4872-b339-a67734b163b6` | convert | `improve` pid 2, started 2026-09-19T18:25:25.885Z | $0.55 (stage ceiling, shared by 2 purchases) |
| `eb5601f7-5ab7-4516-8e2e-2c387bc51e73` | convert | `improve` pid 2, started 2026-09-19T18:25:25.885Z | $0.55 (stage ceiling, shared by 2 purchases) |

The distinct above ceilings total $0.67; actual prices settle server-side. The separate branch run `crt-d184a1e51dd5b3e3a6e3e9389a9a6ccb03e5bb16` failed with a provider error before producing a screen; its actual charge is not established by the local record. Closeout purchased nothing.
