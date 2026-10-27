---
workflow: general-video
flow: companion
storyboard: yes
status: v5-motion-preview-ready-user-review-pending
---

# BMW real 3D arrival — 5-second preview

## Latest homepage card behavior — listings reveal immediately, no wait

The user asked that the three listings stop waiting for the BMW arrival but still reveal beautifully. Card reveal is now driven from `t=0` via `CARD_START = 0` in `street-dynamics.js` (decoupled from `STREET_STOP`), so the existing stagger (75ms), lift/scale arrival (420ms), photo reveal (480ms) and text stagger play right at page load and finish well before the car stops (~0.6s real time). The studio-iframe path in `homepage.js` likewise starts its reveal at `t=0`. Reduced-motion and catalog-browsing still reveal cards instantly. The BMW arrival animation, street video and preserved history below are unchanged. Verified with `node --test` (17 pass) and live Playwright DOM checks.

## Current fixed camera — explicitly approved

The user chose “да, давай неподвижно”. Added camera push is now0/scale1 in native playback/posters and HF preview. BMW rate1.3, physical arrival, cards, skeletons, visibility fix and media remain unchanged. No new render/encode. Exact checks and current state: STATIC_CAMERA.md, evidence/static-camera/. Earlier push sections below are preserved history.

## Latest native card skeleton continuation

The user requested skeletons. Three presentation-only placeholders now fill the deferred card slots during BMW arrival, then crossfade on the same currentTime-driven card entrance. No new network request or artificial delay. CTA/error/reduced motion remove every skeleton immediately; Replay restores them. Details/checks: CARD_SKELETONS.md and evidence/card-skeletons/. Car/media/timing/visibility fix/Range server/HF remain unchanged.

## Latest native card entrance refinement

The user requested a more beautiful card reveal. After the unchanged BMW stop, cards now stagger75ms in real time, lift24px/scale.975→1 with a420ms arrival, reveal their cropped photos over480ms and lightly stagger text. Last visual part completes630ms after stop; accessible interaction starts after84ms per card. All states derive from actual video time; CTA/error/reduced motion reveal every subpart immediately. Car/media/visibility fix/server/HF are preserved. Parameters and checks: CARD_REVEAL.md, evidence/card-reveal/.

## Latest visibility bug correction

The user reported a blank car hero. The original media and1.3×/3.5% timing are preserved; the controller now uses first-frame/terminal JPEG handoffs and a fresh Replay decoder. Actual blank screenshot→visible screenshot and13/13 controller/physics tests are recorded in VIDEO_VISIBILITY.md. This is a lifecycle correction, not a new visual concept or render.

## Latest tiny tempo continuation — 1.3× / 3.5%

The user asked “и еще чуть больше динамики”. Same source media, rate1.3, push3.5% ending exactly at source2.5s stop and then holding. Actual playback3.846s, physical stop1.923s; current card source timing stays .16s/.40s. Reduced motion remains static/no zoom and the clipping fix is preserved. Actual checks and parameters: DYNAMICS.md and evidence/dynamics-v2/. The section below preserves the previous1.15× iteration.

## Current minor timing polish — “чуть больше динамики”

The existing clean-street media now plays at1.15× (unchanged5s source,4.348s actual playback). Actual stop is2.174s; video/poster push finishes at1.025scale exactly then and holds. Street-only card stagger/reveal tighten to.16/.40source seconds after the stop; complete byabout2.80s actual playback. Reduced-motion remains static/nozoom. No new concept/media/render; source V5 and all prior variants preserved. Implementation/verification: DYNAMICS.md. Earlier timing below records the approved source/baseline, superseded for this minor runtime polish only.

## Current narrow correction — foreground bollard removed

The user requested “столбик убери”. The large left foreground bollard is now removed throughout the existing approved arrival and both posters. A single car-free background was edited using built-in image_gen, then only its localROI was adopted through inverse/original AgX linear compositing. Actual BMW pixels, V5 source, rig, motion, camera and UI logic are preserved. New preview uses `assets/v5-motion-clean-street/arrival-preview.mp4` (749,701bytes,896×504,24fps,5seconds,noaudio); prior media remains archived in its original folder. Details/provenance/checks: lookdev/motion/clean-street/README.md. This narrow authorized correction does not introduce a new concept or final delivery export.

## Current approved V5 continuation — 26 October 2026

The user explicitly answered “давай” when asked to approve the latest V5 tyre-refined street still for the agreed arrival animation and lightweight homepage video. Concept, five-second storyboard and V5 static approval are recorded in the chat. The current deliverable is a review preview; approval of this moving preview and the final delivery render are still pending.

Current page: http://127.0.0.1:4317/homepage.html?environment=street . It uses a local 742,851-byte H264 MP4, 896×504, 24fps, 120frames, exactly5seconds, no audio. The street page never loads the GLB, Three renderer or HDR. The original studio homepage, index.html and viewer remain available. Native Ukrainian heading/CTA are usable immediately. Cards follow actual video.currentTime: reveal2.5–3.4s after physical stop, then hold. Replay resets both. Reduced motion, autoplay rejection, media error and catalog interaction use the settled poster and accessible native cards.

The car is rendered from the actual approved V5 scene, with source paint normals/carbon/U-shaped guides/tyres retained. Four rim, sidewall and tread groups roll analytically; calipers remain body-bound. A world-contact tread mask follows the ground rather than rotating a permanently smooth patch. Rendered61unique poses through2.5s; frame60 is reused for the full stopped hold. This is actual moving3D geometry, not a translated still. Preview uses32CPU Cycles samples/denoise, fixed approved camera, no motion blur. Temporal judgement at24fps remains part of user preview review.

HyperFrames composition: street-preview/index.html (896×504, duration5); the framework owns its video seeking. CLI check ran actual browser at0,1,1.8,2.5,5:0findings. Full evidence/reproduce/limits: lookdev/motion/README.md. Earlier sections below describe preserved historical studio and static stages; their pending gates are superseded only by the explicit approvals above.

The user explicitly accepted the real M4 coupe and low graphite static framing when asked whether this car and view suit the arrival animation (answer: “да”). That approval authorizes the already discussed 5-second car-and-camera trial. The earlier approved static is preserved in evidence/preview.jpg and evidence/approved-static-source/.

Original movement step: real car arrival, physically corresponding wheel rotation, braking and final hold. The user subsequently approved the full standalone homepage preview described below. No real frontend/backend integration, live inventory, audio, external publishing or final video render.

## Approved visual and motion

Graphite BMW M4 geometry, low front three-quarter camera, large front wheel, cropped rear body, procedural studio softbox reflections and dark grounded floor. The accepted hero camera stays fixed throughout; actual car translation changes perspective and occlusion. One mesh identity is maintained throughout. No photo overlay or replacement frame is used.

0–1.8s: the BMW approaches from the right. 1.8–2.5s: smooth braking. 2.5–5s: exact static hold. The final travel is 2.795m at 1.3m/s before braking, shortened after the first motion inspection so the nose is already entering at 0s and the front wheel enters before 1s. The original 6.45m trial spent too long outside frame.

## Review URLs

- User viewer: http://127.0.0.1:4317/viewer.html
- HyperFrames Studio: http://localhost:4318/#project/bmw-3d-study
- Composition: index.html, root bmw-arrival, 1280×720, duration 5 seconds.

The viewer opens on the accepted final still. Play starts at 0; Pause, Replay and scrubber seek the same deterministic renderAt(time). Initial-view reset restores the approved camera and final hold. Manual orbit is available only while paused. The movie remains 16:9 and fits inside narrow/portrait viewports; transport controls sit outside it. The player clock is confined to player.js outside the composition; the render scene uses only explicit timeline time. HyperFrames owns export seeking through one paused GSAP timeline plus hf-seek events. Build readiness is registered synchronously through model loading, geometry splitting and shader compilation.

## Wheel geometry and physical relationship

The source GLB is unchanged and matches the original hash in ATTRIBUTION.md. Four tyres and four rims are split from Object_34 and Object_33. All 18,668 source wheel triangles are conserved, and the combined source meshes are removed. Geometry is baked in vehicle-local coordinates before axle groups are built, so early HyperFrames seeks cannot misclassify corners. Wheel radii are measured from each tyre's Y/Z bounds, approximately 0.363m front and 0.371m rear. Wheel angle is minus remaining travel divided by radius; angle is exactly zero in the accepted final pose. The separate Caliper1Mtl mesh stays body-bound and never rotates with the wheels. Contact shadows translate with the car. Source body panels named Mesheslivery1Mtl remain intact and visible.

## Verification evidence

- npm install --save-exact hyperframes@0.8.203 gsap@3.14.2 --cache .npm-cache --no-audit --no-fund --ignore-scripts: installed local pinned dependencies. Existing Three.js 0.181.2 retained. The new composition uses current registry version 0.8.203; earlier unrelated preview pins were not modified.
- node --check stage.js / wheel-rig.js / player.js: exit 0.
- node --test tests/motion.test.mjs: 4 tests passed. Checks continuous non-reversing braking, distance derivative equals velocity, exact hold/random and backward seeks, and an actual-GLB geometry split regression with a vehicle already translated by an early seek. The latter also checks triangle conservation, four pivots/eight parts, radii, rolling relationship and stationary calipers.
- hyperframes check --json --timeout 45000 --at 0,0.5,1,1.8,2.5,5: exit 0; no lint/runtime/layout/contrast/craft findings, browser did run. Six seek samples and 40 craft samples; no text inside the movie, so 0 contrast text checks. Report: evidence/motion-check.json. No DOM motion sidecar was added because it cannot assert wheel state inside WebGL.
- hyperframes snapshot --at 0,0.5,1,1.8,2.5,5 --no-end --output evidence/motion-v3 --json: exit 0; actual hardware WebGL frames visually inspected. Latest contact sheet: evidence/motion-v3/contact-sheet.jpg. Exact 2.5s and 5s screenshots are byte-identical.
- hyperframes keyframes . --selector '#car' --ghost --shot evidence/motion-ghost.png --samples 6 --json: exit 0, rendered evidence saved. Limitation: the text diagnostic enumerates 0 DOM animation targets because actual subjects are Three.js objects. The time-specific movie snapshots and geometry tests provide the meaningful motion evidence; the ghost is not a complete motion trace.
- CUA native Chrome observed the actual final 16:9 viewer. Root additionally exercised actual Replay and scrubber backward to 1.3s after the input-value fix, and reviewed narrow-view letterboxing. Fresh QA remains independent of these checks.
- HyperFrames usage at start: known, weekly 12% used / 88% remaining, reset 2026-11-02T08:39:53Z; observation only.

The first bundled snapshot exposed a boot race and failed wheel split; it was fixed with vehicle-local geometry. The first slider handler read its value after pause rewrote it; the value is now captured before pause. These intermediate failures are retained as development evidence, not presented as final passes.

## Instructions and scope

Read canonical /Users/andreypavlenko/Desktop/Projects/AGENTS.md, AutoFlow/AGENTS.md, AutoFlow/CLAUDE.md and all eight ~/.claude/rules/common/*.md. Followed HyperFrames entry/core/Three adapter/CLI/keyframes and previously loaded general-video/media/creative guidance. Global skill-update suggestions were not executed because global writes are outside this task; no approval workflow was bypassed. Only this study directory was authored. Earlier homepage-bmw-preview and retention-reel were preserved. No next task, commit, push, deploy, paid calls or final video render. User approval of this actual moving preview is still required before final delivery rendering.


## Full homepage preview — approved continuation

The user accepted adding the full first screen (“давай”): headline and CTA visible immediately, real BMW approach and braking unchanged, then three demo cards reveal from 2.5 to 3.4 seconds and hold through 5 seconds. The existing static and movement approvals remain in force; no new concept or material was generated.

Review: http://127.0.0.1:4317/homepage.html . It autoplays once the existing 3D scene reports ready. Optional `?time=5` or `?time=1` holds an explicit proof time. Previous viewer.html and HyperFrames composition/physics are unchanged.

New UI files: homepage.html, homepage.css and homepage.js. The page uses local Onest Latin/Cyrillic, graphite/lime approved styling, desktop left copy with the stage shifted right, and mobile normal flow of copy → original 16:9 car → cards. Cards use native CSS crops from a whole copy of the approved image at assets/approved-homepage.png; all model names, prices and specifications are real HTML. They are visibly marked as demonstration offers, with no current inventory claims. Local detail/about/contact dialogs support native modal focus and Escape. CTA/catalog navigation reveals the cards and scrolls/focuses the catalog without depending on 3D readiness. Hidden cards are inert and cannot intercept clicks or keyboard focus. Reduced-motion code skips autoplay/reveal and settles the scene/cards immediately; replay respects that preference.

Readiness: 8s updates the loading notice only; 30s reveals a usable catalog fallback. An actual later ready event clears the cover/fallback and presents the settled scene. Scene errors retain access to copy, CTA and catalog. Native Chrome produced a concrete transient `OrbitControls.js ERR_CONNECTION_RESET`; the local server is now scripts/serve.py using ThreadingHTTPServer with backlog128, still bound only to127.0.0.1:4317. Run npm run dev. Current server session68555. This server adjustment does not modify the source scene or any live infrastructure.

Verification: node --check homepage.js exited0; existing node --test tests/motion.test.mjs returned4/4PASS. HTTP requests for homepage.html, homepage.css, homepage.js, approved-homepage.png and onest-cyrillic.woff2 all200. Root actually inspected the IAB525 layout with the car loaded and exercised CTA catalog scrolling/focus, card dialog+Escape/focus return and menu+Escape. No extra HyperFrames check was run because the valid composition/stage/physics were unchanged.

Visual verification limitations: evidence/homepage/desktop-native.jpg is an EARLY FAILED NETWORK CAPTURE, showing the loading fallback rather than the hero car. It must not be presented as successful final desktop evidence. Subagent IAB access was unavailable; native Chrome later returned noWindowsAvailable during viewport setup. Final actual desktop1440×1000,390×844, reduced-motion and combined early/final screenshot captures remain for root/freshQA. Those checks are not claimed as passed here. See evidence/homepage/README.md.

Instructions for this continuation: canonical Projects/AGENTS.md, AutoFlow/AGENTS.md, AutoFlow/CLAUDE.md, all common/*.md and all five typescript/*.md rules were checked. Frontend-design and tailwind-aesthetic skills were read; the explicit approved automotive graphite/lime/Onest direction takes precedence over generic developer-grid/code decorations and font defaults. Only the owned study directory was written; no source app integration, next task, commit, push, deploy or paid calls.

### Homepage independent review and fixes

Initial independent QA loaded the actual 3D at desktop1280/1440 and mobile390/525 with no horizontal overflow, and saved evidence/homepage/desktop-final.png and mobile-525-final.png. These are QA captures, not developer visual passes. Reduced-motion behavior and card timing were source-reviewed; runtime reduced-motion override was unavailable and remains explicitly unverified.

One mobile focus finding was fixed in homepage.js: modal close returns to the visible Menu button if its stored invoker is inside navigation that became hidden; other invokers, including card buttons, retain their original focus return. Node syntax check passed. Root's desktop floor-edge polish was applied in homepage.css: desktop stage moves up40px with left4–22% and35px bottom alpha fades, preserving the tyre, camera and physics. Mobile stage stays unchanged. Fresh final QA follows these fixes; evidence/homepage/README.md distinguishes successful screenshots from the earlier failed native capture.

Root subsequently inspected the loaded1440px page after the edge blend: no sharp stage boundary, tyre fully visible, no headline collision. Fresh QA handles final keyboard confirmation and the refreshed screenshot.


## Optional street background — static proposal awaiting approval

Current user request: “добавь еще бэкграунд улицы и дороги”. The agreed next step is a static street-and-road proposal with the already accepted BMW, headline, CTA and cards. New environment motion is intentionally held until that static proposal is approved.

Review URL: http://127.0.0.1:4317/homepage.html?environment=street . Normal http://127.0.0.1:4317/homepage.html remains the existing studio/autoplay version. Street mode fixes both car and cards at5s, keeps wheel angles0, hides Replay, and does not autoplay. Camera, vehicle geometry and rolling equations are unchanged.

The optional street.js module uses Poly Haven Urban Street01 by Andreas Mischok (CC0): a London street with asphalt, curb, pavement, trees and facades under soft overcast daylight. Official license/source and checksums are in assets/street/PROVENANCE.md; source bytes were not edited. The 8K panorama is rendered on Three.js GroundedSkybox with an estimated1.65m capture height and60m projection radius. Its lower geometry projects the photographed asphalt onto a ground surface; a true3D plane receives car shadows and existing contact shadows remain under the tyres. City illumination/reflections come from the2K HDRI; studio softboxes are omitted in street mode. There are no extra box buildings, duplicate procedural curbs or flattened car image. This is a fixed-camera panoramic environment, not a fully modeled navigable city.

Only the optional environment branch changes stage.js. Early seeking is safe while that async environment loads. The default studio still uses its original environment, floor, lights and motion; its HyperFrames regression check passed after integration. homepage.html defers iframe src selection to homepage.js, so the environment query reaches the existing composition. Versioned homepage CSS/JS URLs and no-store local-server headers avoid stale prototype assets. The source HTML copy/cards and their interactions are preserved.

Checks: node --check street.js, stage.js and homepage.js all exit0; existing4motion tests pass. HyperFrames check at0,1,2.5,5 passes with browser enabled and0findings, report evidence/street/studio-regression-check.json. Seven street/default/import/asset requests returned200 with no-store headers. Both downloaded street files match the MD5 values published by Poly Haven's official files API. No image-generation provider, paid calls, publishing or final render.

Actual visual evidence belongs to root/designer/QA because developer IAB was unavailable. Designer and root inspected a loaded desktop street variant: coherent single curb/road perspective, believable contact, readable graphite reflections and headline, no environment seam. The pale road marking below the bumper is part of the photographed street. Final desktop/mobile screenshot paths and independent findings are tracked in evidence/street/README.md. New environment motion remains unapproved and blocked by the project static-review gate, not by missing implementation.

Fresh QA subsequently passed actual loaded desktop1440 and mobile525/390 views. Replay computed display is none, scene time5.000, loading cover hidden, and every demo card visible with opacity1/aria-hidden=false. QA saved evidence/street/desktop-final.png and mobile-final.png; developer inspected those saved images. Root independently confirmed the desktop and525px mobile result. This coverage is attributed to QA/root rather than developer live CUA.

Instruction sources: canonical Projects/AGENTS.md, AutoFlow/AGENTS.md and CLAUDE.md, common and TypeScript rules, existing HyperFrames core/Three/media/creative guidance. The project video static-approval rule governs this environment change. Global media-cache/skill writes were avoided; assets were downloaded only into the owned study. No app integration, next task, commit, push, deploy or outside authored artifacts.
