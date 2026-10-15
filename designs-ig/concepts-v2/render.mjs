// Renders every NN-*.html in this folder to a 2x PNG (1448x1086 viewport, same as designs-ig originals).
import { createRequire } from 'node:module'
import { readdirSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import path from 'node:path'

const require = createRequire('/Users/andreypavlenko/Desktop/Projects/AutoFlow/frontend/package.json')
const { chromium } = require('playwright')

const dir = path.dirname(fileURLToPath(import.meta.url))
const only = process.argv[2]
const files = readdirSync(dir).filter((f) => /^\d\d-.*\.html$/.test(f) && (!only || f.startsWith(only)))

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1448, height: 1086 }, deviceScaleFactor: 2 })
for (const file of files) {
  await page.goto(pathToFileURL(path.join(dir, file)).href, { waitUntil: 'networkidle' })
  await page.evaluate(() => document.fonts.ready)
  await page.screenshot({ path: path.join(dir, file.replace('.html', '.png')) })
  console.log('rendered', file)
}
await browser.close()
