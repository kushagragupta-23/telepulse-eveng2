// Records the ?demo=1 auto-play scenario into docs/telepulse-demo.mp4.
// Usage: node scripts/record-demo.mjs  (dev server must be running on :5173)
import { chromium } from 'playwright'
import { execFileSync } from 'node:child_process'
import { mkdirSync, readdirSync, renameSync } from 'node:fs'
import ffmpegPath from '@ffmpeg-installer/ffmpeg'

const URL = 'http://localhost:5173/?demo=1'
const OUT_DIR = 'videos'
const FINAL = 'docs/telepulse-demo.mp4'
const RUN_MS = 82_000 // demo timeline ≈ 70s + margin

mkdirSync(OUT_DIR, { recursive: true })
mkdirSync('docs', { recursive: true })

const browser = await chromium.launch()
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  recordVideo: { dir: OUT_DIR, size: { width: 1440, height: 900 } },
})
const page = await context.newPage()
await page.goto(URL, { waitUntil: 'networkidle' })
await page.waitForTimeout(RUN_MS)
await context.close() // flushes the .webm
await browser.close()

const webm = readdirSync(OUT_DIR).find(f => f.endsWith('.webm'))
if (!webm) throw new Error('no video produced')
renameSync(`${OUT_DIR}/${webm}`, `${OUT_DIR}/raw.webm`)

execFileSync(ffmpegPath.path, [
  '-y', '-i', `${OUT_DIR}/raw.webm`,
  '-c:v', 'libx264', '-preset', 'fast', '-crf', '22',
  '-pix_fmt', 'yuv420p', FINAL,
])
console.log(`✔ ${FINAL}`)
