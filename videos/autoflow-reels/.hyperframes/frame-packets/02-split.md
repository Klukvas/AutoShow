# Frame packet: 02-split

## Project inputs

- Project: /Users/andreypavlenko/Desktop/Projects/AutoFlow/videos/autoflow-reels
- Design tokens: /Users/andreypavlenko/Desktop/Projects/AutoFlow/videos/autoflow-reels/frame.md
- RULES_DIR: /Users/andreypavlenko/.claude/skills/hyperframes-animation/rules

## Assigned storyboard block

## Frame 2 — Директ проти посилання

- scene: Split screen, two iPhones. Left: Direct-style chat (dark) floods with buyer questions, unread counter 12 → 87 → 243, shakes and dims. Right: one calm chat — the lot sends a site link, the buyer taps it, catalog "21 авто", taps Toyota chip, "2 авто", opens Toyota Camry $33 900, back in chat the buyer writes "Беру"
- voiceover: ""
- duration: 13s
- transition_in: crossfade
- status: outline
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

## Selected blueprint: comparison-split

# comparison-split — Comparison Split-Cards

**intent**: Two paired items of equal weight shown side-by-side with mirrored 3D "book-open" tilts — the eye reads them as a balanced comparison, then a pill badge lands at each card's inner edge to punctuate. The motion IS the symmetry: two cards arriving from opposite wings into a held spread.

**roles served**

- Key_Feature (from `comparison-split-cards`): when two complementary features / capabilities of equal weight should be presented **simultaneously, not sequentially** — an A/B, a "X + Y together," paired concepts the viewer must weigh side-by-side. Not for >2 items (use `grid-card-assemble`) or sequential steps.

**duration**: 4–6s

**shot structure** (a `[bg]` canvas carrying two faint ambient glow blooms — `[accent A]` near 30%, `[accent B]` near 70% — so each side owns a color identity across a 50% symmetry axis; equal-width cards under one shared perspective parent)

- **Scene 1 (0.0–~0.8s) — title sets the concept.** A centered `[title line]` with an `[accent keyword]` slides DOWN into place from just above (a short smooth settle). The downward arrival is deliberate: it forms a non-conflicting T-shape against the cards, which arrive from the sides next.
- **Scene 2 (~0.4–1.9s) — the split-tilt entry (signature move).** Two equal-width feature cards arrive from opposite wings — `[left card]` from the left, `[right card]` from the right ~0.2s behind — each carrying a **mirrored 3D `rotateY` tilt** (left faces right, right faces left, opening like a book) and scaling ~0.85→1 as it lands. The entry overlaps the title's tail so the whole thing reads as ONE arrival, not two beats. Each card holds `[image / label / subtitle]`; box-shadows fall **outward** from the tilt (left shadow right, right shadow left).
- **Scene 3 (~1.9–end) — badges punctuate, then hold.** A pill `[badge]` lands at each card's **inner edge** (left then right, ~0.3s apart), overlapping its card ~15% so it reads as attached, not orbiting. This is the lone overshoot in the shot — it earns the punctuation. Settles and holds.

**motion vocabulary**: title slide-down from above; mirrored opposite-wing card entry; static book-open `rotateY` tilt (`+tilt` left, `−tilt` right); tilt-matched outward box-shadow; inner-edge badge spring-pop; gentle phase-opposed idle float (left vs right, never synchronized) registered as subtle jitter; dual side-glow ambient.

**rule mapping**

- two cards entering from opposite wings with mirrored `rotateY` tilts + tilt-matched shadow → `split-tilt-cards` (the signature; keep the two-layer split so the entry `x`/`scale` and the idle never collide on one alias)
- title slide-down settle → `gsap-effects` (translate + opacity on a long-tail `power3`)
- inner-edge pill badge pop (the one overshoot) → `spring-pop-entrance` (overshoot register — earns the punctuation)
- phase-opposed idle float on the pair → `sine-wave-loop` (low-amplitude register — subtle jitter, NOT lazy breathing; left `sin(t)`, right `sin(t+π)` so they never conveyor-belt)
- the two faint side glows behind the cards → `ambient-glow-bloom` (un-triggered soft bloom, one per accent)

**camera modifier**: camera-static by default — the symmetry is the subject and a move would break the balance.
