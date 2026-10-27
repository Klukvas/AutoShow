# Current approved camera: stationary

The user chose “да, давай неподвижно”. Camera scale stays1 throughout entry, stop and hold; added push is removed. BMW rate1.3, physical motion, card reveal, skeletons and timing remain unchanged. Earlier push variants below are preserved history. Current checks: STATIC_CAMERA.md.

# Latest tiny timing refinement — same approved scene

Rate1.3: arrival0–1.385s, braking1.385–1.923s, hold1.923–3.846s. Smooth3.5% push finishes exactly at the stop and stays fixed. Native cards keep .16s/.40s source timing after source2.5s; all are visible by about2.477 real seconds. Same BMW, clean street and media; reduced motion remains static/scale1. No new effects, audio or render. Prior timings below are preserved history.

# Latest minor dynamics timing

Same approved BMW/clean street and source5s animation; native playback1.15×, duration4.348s in real playback.0–1.565s arrival;1.565–2.174s braking;2.174–4.348s stationary hold. Subtle2.5% camera push ends exactly at2.174s, then stays fixed. Native cards reveal after stop and finish byabout2.80s (.16/.40source-second stagger/reveal). Ukrainian copy/CTA remain immediate. Reduced motion is static withnozoom. No new media, camera scene or audio; this is the user's requested modest timing refinement. Preserved approved source storyboard follows.

# Current approved V5 street arrival preview

The user approved the V5 static and this existing five-second arrival plan with “давай”. Moving preview is now built; final user preview approval and delivery rendering remain pending.

- 0–1.8s: actual graphite BMW M4 enters from the right, wheels roll by distance/radius, body-bound calipers. Ukrainian headline and CTA already visible and usable.
- 1.8–2.5s: continuous analytic braking, no reversal/overshoot. Fixed approved low street camera, same V5 geometry/materials.
- 2.5–3.4s: stopped car and wheels; three native demo cards stagger in with restrained16px/opacity treatment.
- 3.4–5s: exact pose hold and all cards visible.

No narration/audio. Local preview896×504/24fps/32CPU Cycles samples. Render61unique poses and reuse the stopped frame through120outputframes. No higher-quality final delivery export yet. Street homepage uses the prerendered MP4 with first-frame poster; reduced-motion/error/blocked-autoplay use settled fallback. HyperFrames video composition is street-preview/index.html; normal website cards remain native HTML.

Preserved earlier studio study follows for history; no source changes to that composition.

# Approved 3D arrival study

Duration: 5 seconds. Format: 1280×720. No screen copy or narration inside the movie.

## Frame 1

status: built — final moving preview pending approval
src: index.html
runtime: Three.js / HyperFrames hf-seek, one paused GSAP timeline

0–1.8s: real BMW M4 enters from the right under the accepted studio light. Actual tyres and rims roll according to the car's translation; brake calipers stay fixed to the body. Purpose: prove volume and physical arrival.

1.8–2.5s: continuous smooth braking to the accepted low front three-quarter hero position. Purpose: make the stop feel grounded.

2.5–5s: hold the accepted static view, body and wheels fully stationary. Purpose: let the viewer read the wheel, paint and final shape.

Implementation uses the Three.js adapter's deterministic renderAt(time) contract and explicit poses at 0, 1.8, 2.5 and 5 seconds. No added orbit, disassembly, listings or site interface.
