import { createRequire } from 'node:module'
import { readdirSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import path from 'node:path'
const require = createRequire('/Users/andreypavlenko/Desktop/Projects/AutoFlow/frontend/package.json')
const { chromium } = require('playwright')
const dir = path.dirname(fileURLToPath(import.meta.url))
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } })
for (const f of readdirSync(dir).filter((f) => /^\d\d-.*\.html$/.test(f))) {
  await page.goto(pathToFileURL(path.join(dir, f)).href, { waitUntil: 'networkidle' })
  await page.evaluate(() => document.fonts.ready)
  await page.screenshot({ path: path.join(dir, f.replace('.html', '.png')) })
  console.log('rendered', f)
}
await browser.close()
