# Mobile shared hero

The current request is limited to placing the homepage BMW at the same vertical level as the text on mobile. At widths up to 900px, the media stage is now absolute inside a shared hero canvas. A dark gradient protects the compact heading and subtitle on the left while the enlarged BMW nose and front wheel remain visible on the right. The 621–900px range uses a wider two-part composition. All native video/opening/settled surfaces retain the same stage framing.

| Before | After | Why |
| --- | --- | --- |
| Text followed by a separate 16:9 media block | Text and cropped BMW share one hero | Keep the car at the same vertical level as the message |
| Large heading used most mobile width | Compact heading with a readable left gradient | Leave room for the BMW front and wheel |
| CTA and Replay could intersect at 320px | An extra 40px bottom reserve below 360px | Keep both touch targets separate |

Desktop CSS remains unchanged. There is no new media, provider, render, camera motion, dependency, playback/lifecycle change, catalog reveal change, skeleton change or server change. The only HTML change is the stylesheet cache key, mobile-hero-1. The primary CTA remains at least 50px high and Replay 44px.

Verification: `node --test tests/motion.test.mjs tests/street-dynamics.test.mjs tests/street-video.test.mjs` passes 17/17. No JavaScript changed. Before sources, the actual diff and test output are under `evidence/mobile-hero/`. The protected hash report compares all existing project artifacts captured before editing; only homepage.css and homepage.html changed among source/media files. The existing HyperFrames watcher also updated its local .hyperframes/video-state.json history cache; no HyperFrames command was run for this CSS task, and that runtime file was not authored or restored.

Root native CUA inspected the settled composition at 320/390/430px, tablet 768px and desktop 1280px. The mobile BMW is visible beside the heading; desktop composition remains preserved. After the narrow fix, 320px CTA bottom 398.19px and Replay top 418.19px leave 20px between buttons, with no horizontal overflow (clientWidth and scrollWidth 305px). These observations are from root CUA, not developer browser claims. Independent QA and root acceptance remain separate.

Instruction sources checked: canonical Projects/AGENTS.md, AutoFlow/AGENTS.md and CLAUDE.md, applicable ~/.claude/rules/common/* and TypeScript rules, and the complete emil-design-eng skill. No nested project-owned instruction file exists under bmw-3d-study. The canonical Codex developer/independent-QA pipeline overrides optional-delegation wording in common rules. Existing dirty work was preserved. No next task, commit, push, deploy or authored external write.
