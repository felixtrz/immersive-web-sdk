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
