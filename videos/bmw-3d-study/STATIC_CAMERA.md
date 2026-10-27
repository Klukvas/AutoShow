# Fixed camera continuation

User explicitly chose “да, давай неподвижно”. The added camera push is removed: shared STREET_PUSH is0 and streetScale returns scale1 for entry, stop, hold, paused seeks, Replay, fallback and reduced motion. Native video/opening/settled images remain identically framed. The HF camera tween is removed; its neutral wrapper stays at identity.

The BMW still approaches at the approved1.3× rate with unchanged physical wheel motion. The original media/posters, street, source camera, card entrance, skeleton crossfade, visibility recovery and Range server are unchanged. Five source seconds still play in3.846154real seconds, stopping at1.923077s. This is a small runtime camera correction with no render or encode.

Verification:

- JS syntax PASS; `node --test tests/motion.test.mjs tests/street-dynamics.test.mjs tests/street-video.test.mjs`:17/17PASS. Camera assertions now require1 across every sampled time, Replay and reduced motion.
- Protected hashes:35unchanged files, including source media/posters, V5/GLB/rig/default studio/viewer and server. The native controller changed only its module cache key;36before/after card-pose cases are exactly equal. Evidence: `evidence/static-camera/protected-check.json` and `scope-invariants.json`.
- Project-local history was inspected before editing. Before sources and the actual small diff are in `evidence/static-camera/`.
- HF check actually ran its browser with0findings at0/1/1.923077/3.846153. Individual frames were captured; developer viewed1s and final at full size, confirming the fixed street/camera while the BMW changes position. No camera tween remains.

Homepage cache is static-camera-1. Instruction sources remain canonical Projects/AGENTS.md, AutoFlow AGENTS.md/CLAUDE.md, applicable common/TypeScript rules and the relevant updated HF contracts. No new media/provider, global/outside authored write, dependency, next task, commit, push, deploy or final delivery export.

Final root CUA confirmed source times1/2.85/5 and Replay keep every native surface at scale(1), with the settled JPEG visible at the end. Normal preview URL was restored. Fresh independent QA returned PASS with0findings; root reviewed the actual diff and confirmed scope. These are root/QA runtime observations, not developer CUA claims.
