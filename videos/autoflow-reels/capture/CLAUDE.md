# AutoFlow

Source: https://autos-sale.com

To create a video from this capture, use the `product-launch-video` skill.

## What's in This Capture

| File | Contents |
|------|----------|
| `screenshots/contact-sheet.jpg` | **View this first.** All scroll screenshots in labeled grid — see the entire page at a glance |
| `screenshots/scroll-*.png` | Individual viewport screenshots if you need detail on a specific section. |
| `extracted/tokens.json` | Design tokens: 14 colors, 2 fonts, 20 headings, 5 CTAs |
| `extracted/design-styles.json` | Computed styles from live DOM: typography hierarchy, button/card/nav styles, spacing scale, border-radius, box shadows. Primary data source for DESIGN.md. |
| `extracted/asset-descriptions.md` | One-line description of every downloaded asset. Read this for asset selection — only open individual files for safe-zone checking. |
| `extracted/visible-text.txt` | Page text in DOM order, prefixed with HTML tag (`[h1]`, `[p]`, `[a]`). Use as context — rephrase freely. |
| `assets/contact-sheet.jpg` | Downloaded images in labeled grid — view before opening individual files |
| `assets/svgs/contact-sheet.jpg` | SVGs rendered as thumbnails in labeled grid |
| `assets/` | Individual downloaded images, SVGs, and font files. |

## Brand Summary

- **Colors**: #211D16 (surface-dark), #FBF8F1 (bg-light), #E5E7EB (bg-light), #F6F0E2 (bg-light), #F2EDE1 (bg-light), #F5F5F2 (bg-light), #E4DECF (surface-light), #6D6857 (neutral), #B4453C (accent), #D8D1BD (surface-light)
- **Fonts**: Onest (100-900 variable), Schibsted Grotesk (400-900 variable)
