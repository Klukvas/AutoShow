# Deferred card placeholders

User: “а скелетоны ?”. Three presentation-only skeletons now occupy the native listing slots during the already approved BMW arrival. They indicate the deferred reveal; no data request, artificial delay or new loading framework was added.

Each `card-slot` retains its real article in normal layout, even while that article is transparent/hidden. The skeleton is an absolute sibling with matching thumbnail aspect, border/radius and shared copy padding. Its name/price/spec/action bars follow the actual card rows. It adds no layout height and does not move the catalog when removed. There are still only three semantic/focusable vehicle articles.

| Before | After | Why |
| --- | --- | --- |
| Empty deferred card areas | Quiet thumbnail and text placeholders | Shows the reserved content during arrival |
| Entire article faded from0 | Independent skeleton sibling crossfades into that article | The card's opacity cannot hide its placeholder |
| No placeholder state | Skeleton opacity is1 minus existing card opacity | Replay, seeks and buffering stay on the same media clock |

Skeletons are static, restrained CSS blocks (no shimmer clock, loops, assets or dependencies). They show at source0/1/2.5s and fade away over the first220ms of each existing card entrance, staggered75ms in real playback. Once the actual card is fully opaque, the skeleton has opacity0 and visibility hidden. The current photo/text refinement, real1.3× timing and630ms full reveal are unchanged.

Skeletons always have aria-hidden, inert and pointer-events:none. They contain no buttons, links, duplicated vehicle labels or fake interaction. Existing card interaction becomes available at the previous84ms per-card threshold. CTA/catalog, error fallback and reduced motion force complete content immediately with skeleton opacity0. Replay restores the placeholders; mobile has no new scroll gating. The default studio hides skeletons through the street-only CSS selector.

Verification: JS syntax PASS; `node --test tests/motion.test.mjs tests/street-dynamics.test.mjs tests/street-video.test.mjs`17/17 PASS. Existing15 regressions remain, with added skeleton initial/transition/final/forced/replay/backward-seek assertions. `evidence/card-skeletons/protected-check.json` records37 unchanged protected hashes, including street-video.js, Range server, media/posters, car/V5/GLB/rig, HF composition and default viewer. Before sources and actual diff are beside it. HF checks were not rerun for untouched composition/media; these are native HTML placeholders.

Instruction sources: canonical Projects/AGENTS.md; AutoFlow AGENTS.md/CLAUDE.md; applicable common/TypeScript rules; full Emil design engineering guidance and the existing HyperFrames native/composition boundary. No registry effect or provider was needed. No next task, commit, push, deploy, external/global authored write, render, encode, dependency or final delivery export.

Root CUA initial proof passed at source1s/desktop1440: three visible skeleton slots, each299.96875px high, BMW mid-arrival visible, and no duplicate cards/placeholders in the accessibility tree. Actual screenshot: `evidence/card-skeletons/skeletons-desktop.png`; developer also viewed the saved artifact. Final transition/CTA/mobile and fresh QA observations follow from root.
