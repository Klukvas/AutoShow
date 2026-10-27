# Current camera: fixed

The user explicitly chose a stationary camera (“да, давай неподвижно”). Added push is now0 and all native surfaces stay at scale1; HF camera tween is removed. Rate1.3, source media and cards/skeleton timing remain unchanged. Current evidence: STATIC_CAMERA.md and evidence/static-camera/. The earlier3.5% and2.5% pushes below are preserved history, not current behavior.

# Latest tiny tempo refinement — 1.3× / 3.5%

User asked “и еще чуть больше динамики”. Only playback rate 1.15→1.3 and push 2.5→3.5% changed. The same smoothstep finishes exactly at source 2.5s and holds. Five source seconds now play in 3.846154 real seconds; physical stop occurs at 1.923077s. Current card timing stays .16s stagger / .40s reveal after source 2.5s (all visible by about 2.477 real seconds).

Video and settled poster share final scale 1.035. Reduced motion remains static at scale 1. Clipping, BMW, tyres, clean street, MP4/poster bytes, UI and default studio/viewer are unchanged. HF root/clip duration is 5/1.3 and its media rate is 1.3; the non-timed camera wrapper finishes its push at 2.5/1.3, then holds. Cache version is dynamics-2.

Evidence: evidence/dynamics-v2/ contains frozen before sources, hash baseline, actual source diff and checks. JS syntax PASS; Node tests 6/6 PASS; HF check actually ran its browser with 0 findings. Individual stop1.923s and end3.846s PNGs were viewed separately: same BMW position/scale throughout the hold. Protected hashes all match, including original media/posters/V5/GLB/default studio. No new render, encode, generation, effect or architecture.

Root CUA confirmed rate1.3, ended source time5, scale1.035, all cards visible; Replay resets time0/scale1/cards hidden; early CTA uses matching poster/video scale1.035 and focuses catalog. Mobile widths375/375 and390/390 have no horizontal overflow. Root screenshot: evidence/dynamics-v2/homepage.png. Fresh independent QA reviews the final refinement. Reduced-motion runtime emulation remains unavailable; its static/no-zoom behavior is source/unit-tested.

Same canonical/project/common TS and updated HF instruction sources listed below apply. No next task, commit, push, deploy, provider call, global install, outside authored write or final delivery export. Earlier 1.15× iteration is preserved below for history.

# Minor dynamics refinement

User: “окей, но чуть больше динамики бы”. This continues the accepted BMW/clean-street scene. No new scene, render, generation, sound or video encode.

The original749,701-byte clean MP4 and both posters are unchanged. The street homepage now plays that media at1.15×. Its5source seconds therefore take4.347826real seconds; physical stop atsource2.5s occurs at2.173913real seconds. The four wheels remain in the original physical relationship to vehicle movement because the complete rendered motion is retimed together.

A restrained2.5% push affects only the video and settled poster, origin70%62%. Smoothstep progress uses actual video.currentTime from0 to2.5source seconds, then holds exactly at1.025. It never continues on the stationary hold. Poster and video use the identical transform, so CTA/error/blocked-autoplay settling has no mismatched end scale. Reduced-motion remains an instant settled poster withscale1 and all cards available.

Street-only cards still begin after actual physical stop atsource2.5s; stagger tightened.20→.16source seconds and reveal.50→.40. All cards complete bysource3.22s (about2.80real seconds). Existing cubic card ease and16px displacement are retained. Default studio and viewer timing/camera remain unchanged. Pausing, buffering and backward/random seeks cannot advance push/cards independently because both derive from video.currentTime, without a second clock.

HyperFrames uses data-playback-rate1.15 with4.347826s root/clip length and a non-timed camera wrapper. A paused GSAP tween completes the identical smoothstep push by2.173913s. The framework owns video playback/seeking; no composition media.play/pause/seek code or custom timer was introduced.

Before editing, project-local `hyperframes history --dir street-preview --since mine --who codex --json` was inspected: only prior clean-media/index changes, no unexpected user Studio edits. Baseline hashes and actual source snapshots are in evidence/dynamics/. The initial wrong positional history syntax failed harmlessly; the documented --dir command succeeded before implementation.

Verification: JS syntax PASS; `node --test tests/motion.test.mjs tests/street-dynamics.test.mjs`6/6PASS, including exact stop/hold/reduced scale and tighter media-driven card timing. Protected file hashes include unchanged MP4/posters/V5 scene/GLB/rig/default studio/viewer. Focused HF check/snapshots/keyframe evidence and fresh browser observations are stored in evidence/dynamics/. Runtime review is through root CUA, not custom headless automation.

Instruction sources: canonical Projects/AGENTS.md; AutoFlow AGENTS.md/CLAUDE.md; applicable ~/.claude/rules/common/* and typescript/*; updated HyperFrames entry/motion/core/keyframes/animation/CLI contracts. Canonical§7 overrides global skill-update and feedback suggestions: neither was performed. No next task, commit, push, deploy, purchase/provider call, global install, outside authored write or final delivery export.

Root CUA observed rate1.15, stopped scale1.025, Replay returning toscale1/cards hidden, and CTA using the settled poster withscale1.025/cards accessible. It caught a3px horizontal overhang at375px from the scaled video; the visual stage now clips its own surface overflow, without clipping Replay/text. Stylesheet cache key is refreshed. Reduced-motion emulation was unavailable in CUA; static scale1 is source/unit-tested. HF check ran its browser with0findings; focused keyframe shot and actual0/1.087/2.174/4.348s snapshots were visually inspected. Root CUA retest passed: clientWidth375/scrollWidth375 and390/390 at stoppedscale1.025; Replay/text/cards remain intact. Fresh independent QA reviews the combined refinement.
