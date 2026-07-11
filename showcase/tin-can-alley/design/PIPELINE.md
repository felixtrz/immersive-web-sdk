# Tin Can Alley — Pipeline State

| Phase          | Status      | Artifact                                                                     | Notes                                                         |
| -------------- | ----------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------- |
| 0 Preflight    | done        | (this file, Capabilities below)                                              |                                                               |
| 1 Ideation     | done        | design/GAME_SPEC.md                                                          | autonomous — all axes `[ASSUMED]`, appendix in spec           |
| 2 Design       | done        | design/deck.html, design/concept/{key-moment,environment,ui-mock,layout}.svg | 3 parallel agents; delivered to user; unreviewed (autonomous) |
| 3 Grounding    | done        | design/TECH_PLAN.md                                                          | 6 agents; 2 version-drift caught vs 0.4.2                     |
| 4 Architecture | done        | design/ARCHITECTURE.md                                                       | [ASSUMED] approved (autonomous)                               |
| 5 Build        | in-progress | src/, milestone log below                                                    | [ASSUMED] auto-commit milestones                              |
| 6 Verify       | pending     | design/VERIFICATION.md                                                       |                                                               |
| 7 Ship         | pending     | review report, build, deploy                                                 |                                                               |

## Capabilities (Phase 0 findings)

- interactive questions: **autonomous** (developer instructed "answer your own questions"; AskUserQuestion exists but is intentionally unused)
- sub-agents: **yes** (Agent tool + Workflow orchestration; sub-agents cannot hold background processes — main agent owns dev servers)
- slide/HTML preview: **artifact tool** (publish) + file-send; deck also kept on disk
- image generation: **none** → hand-authored SVG fallback
- iwsdk CLI: **v0.4.2** (app scaffolded at showcase/tin-can-alley via @iwsdk/create@0.4.2 + locally-served recipes with the upgraded skill)
- reference: **warm** — user-level cache already populated (~210 MB corpus+model downloaded earlier in session); expect instant readiness post-scaffold
- runtime verify: **headless browser OK** (managed Playwright Chromium, SwiftShader auto-fallback)
- environment note: `onnxruntime-node` postinstall needs `npm_config_onnxruntime_node_install_cuda=skip` in this proxied environment

## Milestone Log

- M0 2026-07-11: untouched scaffold verified — tsc clean; dev server up (port 8081, browser commandReady); 15 systems via `ecs systems`; renders (design/verify/m0-browser.png); XR enters cleanly (design/verify/m0-xr.png); 0 console errors.
- M1 2026-07-11: night booth world — dome/IBL night palette, booth, string lights, floor; starter content removed (design/verify/m1-browser.png).
- M2 2026-07-11: pyramid + balls + grab/throw — after fixing delta-spike tunneling (solid colliders, spawn gate, physics-on-demand cans) and the unclamped pull lerp; throw knocks 6/6 (m2-pyramid3.png, m2-throw.png).
- M3 2026-07-11: scoring + round systems — [GAME] score/sfx/round logs verified live.
- M4 2026-07-11: scoreboard + reset + clear sting — verified after deferring reset out of event dispatch and fixing live-Set iteration (m4-after-reset.png).
- M5 2026-07-11: full verification pass — design/VERIFICATION.md, S1–S6 PASS.

## Close-out & Retro (Phase 7)

**Built vs spec:** all MVP mechanics (M1–M6) shipped and verified (S1–S6
PASS, design/VERIFICATION.md). Spec deviations, both `[ASSUMED]`-documented:
M1 near-grab uses trigger (not squeeze) due to the one-Handle-per-entity
conflict; hit/clear audio share the starter chime (no pitch API exists —
volume/stagger differentiation instead).

**Review:** iwsdk-project-code-reviewer found 0 critical, 1 warning
(per-frame Array.from in the recovery loop — fixed with a scratch-array
detect/mutate split), and confirmed all three version-drift adaptations as
correct against the installed 0.4.2 dist.

**Ship state:** production build in dist/ (game code verified in bundle).
Deploy options: static host of dist/ (e.g. npx gh-pages -d dist) or zip.

**Retro — what to do differently next time:**

1. Treat headless physics as hostile from M1: solid colliders, spawn gates,
   physics-on-demand for precarious stacks (cost a debugging day here; now
   baked into the skill's build-milestones playbook).
2. Verify layout diagrams for physical support before coding them (pyramid
   spacing was designer-pretty, physically unstable).
3. Never run heavy CLI ops (snapshot/screenshot) mid-interaction — they
   stall the tab and corrupt the physics step.
4. Prefer set-select-value / set-gamepad-state over xr select (wedges the
   0.4.2 headless runtime); UIKit buttons need pointerup listeners.
5. Check connectedClientCount when observations contradict each other
   (multi-tab relay races).
6. The grounding phase's installed-source verification caught two doc-drift
   errors before they cost anything — keep that step mandatory.
