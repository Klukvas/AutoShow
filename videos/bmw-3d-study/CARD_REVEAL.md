# Native listing entrance

User: “добавь еще красивіе анимации прогрузки карточек”. This is a native HTML entrance refinement after the approved BMW stop; it does not alter the video composition or car.

| Before | After | Why |
| --- | --- | --- |
| Fade and16px lift | Fade,24px lift and .975→1 scale,420ms | More visible arrival with a restrained, non-bouncing landing |
| Static photo crop | Cropped viewport scales1.04→1 and clears a10% bottom inset over480ms | Adds depth without scaling the entire atlas around the wrong centre |
| All copy moves together | Title/spec/footer fade and6px lift with60/100/140ms offsets,260ms each | Small ordered detail, complete before the photo settles |

All durations above are **real playback time**. The75ms card stagger becomes .0975source seconds at the unchanged1.3× playback rate. Each card begins after source2.5s plus its stagger. The final photo completes630ms after the physical stop (source3.319s). Car rate1.3, push3.5%, clean street, media bytes, final image visibility handoff and HTTP Range are unchanged.

The state is a pure function of video.currentTime, index and forced visibility. Replay, pause, buffer and backward/random seek reconstruct the same card/photo/text pose; no independent timer, CSS entrance animation or scroll gate was introduced. Cards are hidden/inert at zero progress and become interactive once outer progress reaches.2 (84ms after each card starts); decoration does not block interaction until the last inner part finishes. Reduced motion, CTA/catalog and error fallback force **all** outer/photo/text parts to their final accessible states immediately. Mobile cards are fully ready on the same timeline even when later scrolled into view.

The photos remain the same existing atlas. A viewport-sized `car-photo-viewport` wrapper contains each original crop; the original337.7778% image width, negative left/top offsets, alt text and source URL are unchanged. Photo zoom acts on that viewport. No image load/decode gate or new asset was added. Transforms, opacity and a small local photo clip do not change grid geometry. Default studio keeps the previous simple card entrance; its new photo wrapper is neutral at scale1.

## Verification

- `node --check homepage.js` and `node --check street-dynamics.js`: PASS.
- `node --test tests/motion.test.mjs tests/street-dynamics.test.mjs tests/street-video.test.mjs`:15/15 PASS. Checks include unchanged car dynamics/controller regressions, physical-stop start, real-time stagger,630ms bound, bounded transforms, deterministic reversal and forced complete photo/text/accessibility state.
- `evidence/card-reveal/protected-check.json`:37 protected hashes match, including street-video.js, server, MP4/posters, V5/GLB/rig, HF composition and default studio/viewer. Actual before sources and source.diff are retained beside it. Car constants remain explicitly tested at1.3/1.035.
- Root CUA observed actual source time2.85: ordered partial card/text states, stable atlas crop and visible BMW. Further partial/final, CTA/mobile and independent QA checks are recorded by root; no developer CUA claim is made.
- HF CLI checks were not repeated for untouched HF composition/media; these cards are native webpage HTML. No new registry effect, provider, image, video or dependency.

Instruction sources: canonical Projects/AGENTS.md; AutoFlow AGENTS.md/CLAUDE.md; applicable common/TypeScript rules; full emil-design-eng skill and updated HyperFrames entry/native-vs-composition contracts. Existing user approval remains in force for this same-scene entrance refinement. No next task, commit, push, deploy, external/global authored write, rerender or final delivery export.

Final root CUA: source2.65/2.85 show ordered partial poses with stable crops; CTA during a partial reveal forces all card/photo/text opacity1, scale1, clip0 and aria-hidden=false, and the BMW dialog opens/closes. At actual375px viewport scrollWidth is375. Natural autoplay ends with every subpart final and the settled BMW JPEG visible. Replay resets outer opacity0, photo scale1.04/inset10% and text opacity0. Fresh independent QA returned PASS with0 findings. These runtime observations are root/QA evidence, not developer browser automation.
