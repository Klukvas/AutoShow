# Street hero visibility correction

User reported “не появляется машина вообще”. Root reproduced a fully blank dark hero at natural982px viewport: valid source, readyState4, source time5, paused, video not hidden, no console/media error; cards were visible. Replay also stayed black. CTA switched to the same-stage JPEG and showed the car, so general stage positioning/mask/clip was not sufficient to explain the failure. A fresh page load recovered the video. Later resize/reset did not reproduce it consistently; no specific GPU/browser root cause is claimed.

The verified application fault was reliance on a native video retaining and painting its last frame, with no independent visible-image handoff and no new decoder on Replay. The correction removes that dependency:

- First-frame JPEG remains over the video until a presented-frame callback. Metadata/readiness alone cannot uncover a possibly unpainted surface.
- Settled JPEG is preloaded. On natural end or an exact final-time seek, the controller hides native video and shows the matching image at the same1.035scale. The camera/card timing is preserved.
- Replay reloads the existing lightweight media decoder and keeps the opening JPEG until fresh frame presentation. Rate stays1.3; there is no rerender or asset change.
- A paused fixed-time seek releases the overlay at seeked with readyState≥2: WebKit can already have presented that frame before a later video-frame callback is registered. Playing media still uses its presented-frame callback. This preserves `?time=1.25` proof views.
- Returning to an already ended page restores the terminal JPEG. Stale play promises cannot override a newer Replay/CTA state. Late loadeddata after CTA cannot restart autoplay.
- Reduced motion remains static scale1 and does not load the video.

## Red/green evidence

Diagnosing-bugs workflow used an actual visual signal and the real controller's lifecycle seam, not a fake claim to emulate browser GPU rendering.

Root's actual screenshot `evidence/dynamics-v2/missing-car-before.png` failed the fixed hero crop(600,120,950,400): RGB standard deviations0/0/0. `evidence/video-visibility/after-natural.png` passes the identical crop:51.38/51.57/53.51. Both actual full images were viewed by the developer. Root CUA confirmed entry visible, natural end showing the complete JPEG, and Replay visible at natural982px after the fix.

Before the fix, `node --test tests/street-video.test.mjs` ran the real createStreetVideo with stateful event/media surfaces:3FAIL/1PASS. Missing opening-image handoff, terminal-image handoff and fresh Replay decoder were the failing assertions (`evidence/video-visibility/lifecycle-red.log`). These assertions guard application state when native video paint is unavailable; they do not reproduce the browser renderer itself.

After correction, the lifecycle cases plus paused fixed-time seek, late readiness after catalog, stale play rejection, reduced motion and previous physics/dynamics pass13/13:

```sh
node --test tests/motion.test.mjs tests/street-dynamics.test.mjs tests/street-video.test.mjs
node --check street-video.js
node --check homepage.js
```

Actual source before/diff and protected hashes are in `evidence/video-visibility/`. Source MP4/posters, V5/GLB/rig/motion/dynamics constants, default studio/viewer and HF composition are unchanged. HF check was not repeated for untouched composition/media. Homepage script cache is visibility-3; stylesheet cache visibility-1. No temporary debug logs were added. A separate real HTTP test proved the old local server ignored Range: bytes0–1023 returned200/full749701bytes. It now returns206/1024bytes, correct Content-Range/Accept-Ranges, and416 for unsatisfiable requests. Prefix/suffix/open-end/HEAD/whole-file tests pass5/5 after failing before the fix. Root WebKit confirmed source time advanced0→1.25 after this server correction; the remaining paused overlay issue was fixed separately using seeked readiness. Range is not claimed as the proven cause of the original intermittent blank video surface.

Instruction sources: canonical Projects/AGENTS.md, AutoFlow AGENTS.md/CLAUDE.md, applicable common/Python/TypeScript rules, diagnosing-bugs and previously loaded updated HyperFrames contracts. Root CUA provided runtime checks; no custom browser automation was used. No next task, commit, push, deploy, provider call, global/outside authored write, new render or final delivery export.

Paused-seek regression was also run RED without any subsequent video-frame callback, then GREEN. Final commands include `python3 tests/test_preview_http.py` (5/5), `python3 -m py_compile scripts/serve.py tests/test_preview_http.py`, and the13-test Node suite. The local4317server was restarted on the same owned preview script; no external service or server dependency was added.

Root's final WebKit paused proof passed after both corrections: source time1.25, pausedtrue, openingHidden=true and actual mid-arrival BMW visible. Normal playback/end/Replay had already passed the original natural982px visual loop; fresh independent QA reviews the combined controller/server correction. The lack of screenshot-based lifecycle checks and a guaranteed terminal image allowed readyState/source validity to be mistaken for visible paint; the new visual evidence and controller regressions address that gap without a broader architecture change.
