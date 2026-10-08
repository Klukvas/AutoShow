---
format: 1080x1920
duration: 20s
message: "Директ тоне в сотнях питань про авто; одне посилання з фільтрами закриває продаж"
arc: Hook → Problem vs Solution (split) → Proof + CTA
audience: власники автомайданчиків в Україні без власного сайту
mode: collaborative
music: none
---

## Video direction

- **Canvas & safe zone (Instagram Reels, 1080x1920):** all meaningful content inside x 48–948 (the right ~130px is covered by the Reels like/comment rail) and y 160–1560 (top bar, and the bottom ~360px caption/username band). Nothing important outside that box.
- **Palette (from frame.md):** ground = `navy` (#181515) full-bleed, with a faint warm vignette; headline type = `cream`; secondary type = cream @ 60%; the ONE voltage = `coral` (#B4453C) — used only for: the right phone's link bubble / "Беру" bubble glow, and "1 посилання" + CTA pill in Frame 3. Left phone (Direct) is cold neutral greys (#000 screen, #262626 bubbles, #FFFFFF @ 90% text, unread badge in a muted red #E0464E). Right phone screens are the real site screenshots (warm paper #F2EDE1).
- **Type:** display = Onest 800 (Cyrillic) sentence case, tight tracking; kicker/labels = JetBrains Mono uppercase. Cyrillic must render — Onest covers it; never fall back to a font without Cyrillic.
- **The two phones** are one consistent object across Frames 1–2: simple modern iPhone silhouettes (rounded rect ~56px radius, 10px dark bezel #0B0B0C, thin cream@14% outline, dynamic-island pill), each ~430px wide, screen aspect ~0.55 (w/h). Left phone centred at x≈270, right phone centred at x≈720, both top at y≈420. Under each phone a mono label: left "ДИРЕКТ", right "ПОСИЛАННЯ".
- **Motion grammar:** power3 long-tail settles, no bounce/overshoot (except a tiny spring on chat bubbles, ≤3%). LEFT side energy accelerates (faster message cadence, then a small shake); RIGHT side is deliberately slow and smooth — the contrast in tempo IS the message. Taps on the right are shown with a soft circular touch ripple (no arrow cursor — it's a phone).
- **Rhythm:** Frame 1 punchy, Frame 2 builds then resolves, Frame 3 is the held read (stillness after the CTA lands).
- **Negative list:** no Instagram logo or wordmark (generic Direct-style chat only), no emoji, no real people photos, no lazy breathing/drifting, no slideshow front-load-then-freeze, no screensaver floating, no purple/blue AI gradients, no English copy.

## Frame 1 — Два способи

- scene: Dark ground, headline "Два способи продати авто" lands word by word, two phone outlines rise into split positions
- voiceover: ""
- duration: 2.5s
- transition_in: cut
- status: animated
- src: compositions/frames/01-hook.html
- type: hook
- persuasion: Negative contrast (set up an A/B before showing either side)
- beat: curiosity
- blueprint: kinetic-type-beats
- focal: headline
- roles: headline = focal type · phone outlines = supporting
- asset_candidates:

Adapt: keep the per-word beat landing; instead of resolving on a logo, the words resolve upward and hand the canvas to the two phone silhouettes.

Scene 1 (0.0–1.3s): navy ground. "Два способи" lands word by word, then "продати авто" — large display, centred, upper-middle (y≈700–1000), ~80% of safe width, cream; "Два" in coral. Per-word staggered reveal, quick slide-up + fade, power3.
Scene 2 (1.3–2.5s): the headline shrinks and travels up to its Frame-2 position (top, y≈200–330, smaller display) while the two empty phone silhouettes (bezels only, dark screens) rise from below into their split positions with a slight stagger (left first). Ends exactly in the Frame-2 layout.

handoff_out: headline "Два способи продати авто" at top centre (y≈200–330), scale = Frame-2 size, opacity 1, static · left phone centre x 270, top y 420, opacity 1, static · right phone centre x 720, top y 420, opacity 1, static · both screens dark (#000).

## Frame 2 — Директ проти посилання

- scene: Split screen, two iPhones. Left: Direct-style chat (dark) floods with buyer questions, unread counter 12 → 87 → 243, shakes and dims. Right: one calm chat — the lot sends a site link, the buyer taps it, catalog "21 авто", taps Toyota chip, "2 авто", opens Toyota Camry $33 900, back in chat the buyer writes "Беру"
- voiceover: ""
- duration: 13s
- transition_in: cut
- status: animated
- src: compositions/frames/02-split.html
- type: pain_point
- persuasion: Negative contrast + Show-don't-tell proof (the same buyer intent, two outcomes, side by side)
- beat: overwhelm → relief + control
- blueprint: comparison-split
- focal: assets/mobile-cars-toyota.png
- roles: mobile-cars.png = right-phone screen (step 1) · mobile-cars-toyota.png = right-phone screen (step 2, focal) · mobile-camry.png = right-phone screen (step 3)
- asset_candidates: assets/mobile-cars.png — mobile catalog, 21 авто, make chips; assets/mobile-cars-toyota.png — catalog filtered to Toyota, 2 авто, Camry card; assets/mobile-camry.png — Toyota Camry 2022 page, $ 33 900

handoff_in: headline "Два способи продати авто" at top centre (y≈200–330), opacity 1, static · left phone centre x 270, top y 420 · right phone centre x 720, top y 420 · both screens dark.

Adapt: keep the side-by-side A/B; drop the mirrored book-open tilt (phones stay flat and frontal so the UI reads on a phone screen). Both surfaces run their own timeline in parallel.

Phone screen content specs:
- LEFT (Direct, dark): top bar with a back chevron, a grey circle avatar, handle "auto_maidan" and "Повідомлення"; incoming grey bubbles from different buyers, each with a tiny initial-avatar and a short handle (oleh.k, marina_lviv, vitya_auto, andrii.ua, sasha.kh …). Questions pool (repeat/shuffle deterministically): "Ціна?", "Ще актуально?", "А є дешевше?", "Який пробіг?", "Розмитнена?", "Скиньте фото салону", "Торг є?", "Яка комплектація?", "Ау?", "Чому не відповідаєте?", "Є щось до 15к?", "Кредит можна?". A red unread badge on the top bar shows the counter.
- RIGHT (chat, then site): same chat chrome but calm. One outgoing bubble from the lot: "Ось усі наші авто з фільтрами:" — followed by a link-preview card (coral left edge, title "AutoFlow — каталог авто", url "autos-sale.com"). Site steps show the real screenshots filling the phone screen width, top-aligned under a slim light status bar.

Scene 1 (0.0–1.0s): both screens light up (fade-in from black). Left: Direct chrome + first 2 bubbles ("Ціна?", "Ще актуально?"), badge "12". Right: chat chrome, empty. Mono labels "ДИРЕКТ" / "ПОСИЛАННЯ" fade in under each phone.
Scene 2 (1.0–4.0s): LEFT: bubbles keep arriving and push the thread up, cadence ~1 every 0.45s; badge counts 12 → 87. RIGHT: at 1.4s the single link bubble + preview card slides in (outgoing, right-aligned) and then nothing — stillness.
Scene 3 (4.0–5.0s): RIGHT: a soft touch ripple on the link card (tap #0, opening the link); the chat screen hands off to mobile-cars.png ("Каталог · 21 авто") with a quick upward sheet/scale-swap. LEFT: cadence speeds to ~1 every 0.25s, badge → 140.
Scene 4 (5.0–7.2s): RIGHT: touch ripple on the "Toyota" chip area (tap #1). Because the real list has Audi/BMW/Mercedes chips, show a small cream chip "Toyota" sliding into the chip row first, then tapping it; the screen swaps to mobile-cars-toyota.png ("Toyota ×", "2 авто"). A small coral-outlined callout pops beside the phone: "21 → 2 авто". LEFT keeps flooding, bubbles start to overlap slightly, badge → 198.
Scene 5 (7.2–9.4s): RIGHT: touch ripple on the Camry card (tap #2) → swap to mobile-camry.png (Toyota Camry 2022, $ 33 900). Small callout: "3 тапи". LEFT: the phone does a short low-amplitude shake; badge → 243 and stops; screen dims to ~45% under a dark overlay; one last bubble "Ау?" then "…" typing that never resolves.
Scene 6 (9.4–11.6s): RIGHT: the screen slides back to the chat (reverse scale-swap) and an incoming buyer bubble types in: "Беру. Коли можна подивитись?" — "Беру" in bold; a soft coral glow blooms behind the right phone. LEFT stays dim and still.
Scene 7 (11.6–13.0s): held read: right phone bright with "Беру", left phone dim with "243". No new motion (subtle jitter at most on the coral glow).

handoff_out: clean crossfade — no element continues (Frame 3 starts from bare navy).

## Frame 3 — 243 проти 1

- scene: Phones clear. Stat lockup "243 повідомлення" (struck, dim) over "1 посилання" (coral), then "Сайт для вашого автомайданчика" and CTA pill "Пишіть у директ"
- voiceover: ""
- duration: 4.5s
- transition_in: blur-crossfade
- status: animated
- src: compositions/frames/03-cta.html
- type: cta
- persuasion: Statistical contrast → Friction reduction (the ask is one DM)
- beat: clarity → urgency-to-act
- blueprint: titlecard-reveal
- focal: "1 посилання"
- roles: number lockups = focal type · CTA pill = coral-callout
- asset_candidates:

Adapt: keep the one-restrained-move-then-hold title card; the card carries a two-line number contrast and resolves into a CTA pill instead of a logo.

Scene 1 (0.0–1.2s): navy ground. "243 повідомлення" fades up (number-hero "243" + mono unit "ПОВІДОМЛЕННЯ"), cream @ 55%, centred at y≈620; a thin cream line strikes through it left-to-right.
Scene 2 (1.2–2.4s): below it, "1 посилання" slides up into place (number-hero "1" in coral + mono unit "ПОСИЛАННЯ"), centred at y≈900, full opacity — clearly dominant (larger than 243).
Scene 3 (2.4–3.4s): "Сайт для вашого автомайданчика" (headline, cream, 2 lines, centred, y≈1120–1260) fades up; then the coral CTA pill "Пишіть у директ" (cream text, generous padding, y≈1360) rises in with a single soft press.
Scene 4 (3.4–4.5s): held read, everything still; small mono "AUTOFLOW · AUTOS-SALE.COM" in cream @ 40% under the pill (y≈1480). This is the final frame: hold to the end, no exit animation.
