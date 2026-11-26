// ---------------------------------------------------------------------------
// TelePulse HUD — companion WebView entry.
// Inside the Even App WebView / evenhub-simulator → uses the real SDK bridge.
// In a plain browser → BrowserEvenAdapter renders the REAL 576x288 containers
// into an on-screen G2 lens and synthesizes the same OS events.
// ---------------------------------------------------------------------------

import './styles.css'
import {
  waitForEvenAppBridge,
  CreateStartUpPageContainer,
  RebuildPageContainer,
  TextContainerUpgrade,
  ImageRawDataUpdate,
  AudioInputSource,
  type EvenAppBridge,
} from '@evenrealities/even_hub_sdk'
import { HudEngine } from './display/HudEngine'
import { BrowserEvenAdapter } from './display/BrowserEvenAdapter'
import type { BridgeLike, TelePulseState } from './types'

const EV = {
  CLICK: 0,
  SCROLL_TOP: 1,
  SCROLL_BOTTOM: 2,
  DOUBLE_CLICK: 3,
  LONG_PRESS: 9,
  LONG_PRESS_RELEASE: 10,
}
const SRC = { GLASSES_R: 1, RING: 2, GLASSES_L: 3 }

const IS_DEMO = new URLSearchParams(location.search).has('demo')

// ---------------------------------------------------------------------------
async function postJson(path: string, body: unknown): Promise<Record<string, any>> {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  })
  return res.json()
}

const stateCache: { current: TelePulseState | null } = { current: null }
async function fetchState(): Promise<TelePulseState> {
  const res = await fetch('/api/state')
  const s = (await res.json()) as TelePulseState
  stateCache.current = s
  return s
}

function hasNativeBridge(): boolean {
  const w = window as any
  return Boolean(w?.flutter_inappwebview?.callHandler)
}

function wrapSdkBridge(bridge: EvenAppBridge): BridgeLike {
  return {
    createStartUpPageContainer: c => bridge.createStartUpPageContainer(new CreateStartUpPageContainer(c as any)),
    rebuildPageContainer: c => bridge.rebuildPageContainer(new RebuildPageContainer(c as any)),
    textContainerUpgrade: c => bridge.textContainerUpgrade(new TextContainerUpgrade(c)),
    updateImageRawData: d => bridge.updateImageRawData(new ImageRawDataUpdate(d)),
    audioControl: (open, src) => bridge.audioControl(open, (src as AudioInputSource) ?? AudioInputSource.Glasses),
    shutDownPageContainer: m => bridge.shutDownPageContainer(m),
    onEvenHubEvent: cb => bridge.onEvenHubEvent(cb as any),
    setLocalStorage: (k, v) => bridge.setLocalStorage(k, v),
    getLocalStorage: k => bridge.getLocalStorage(k),
  }
}

// ---------------------------------------------------------------------------
function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  cls?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag)
  if (cls) e.className = cls
  if (text !== undefined) e.textContent = text
  return e
}

const app = document.querySelector<HTMLDivElement>('#app')!

// ---------------------------------------------------------------------------
// Layout
const header = el('header', 'hdr')
header.innerHTML = `
  <div class="brand"><span class="logo">▙▚</span> TELEPULSE <span class="sub">G2 HUD</span></div>
  <div class="badges">
    <span class="badge" id="bd-link">LINK …</span>
    <span class="badge" id="bd-mkt">MKT …</span>
    <span class="badge" id="bd-eq">EQ $—</span>
  </div>`
app.appendChild(header)

const main = el('main', 'layout')
app.appendChild(main)

// Left column — glasses lens + input deck
const left = el('section', 'col-lens')
const frame = el('div', 'g2-frame')
const lensLabel = el('div', 'lens-label', 'G2 WAVEGUIDE · 576 × 288 · MONO GREEN')
const lens = el('div', 'g2-lens')
lens.id = 'lens'
frame.append(lensLabel, lens)
left.appendChild(frame)

const deck = el('div', 'deck')
deck.id = 'deck'
left.appendChild(deck)

const recBar = el('div', 'recbar hidden')
recBar.id = 'recbar'
recBar.innerHTML = '<span class="rec-dot"></span> G2 MIC LIVE — speak a command, release to send'
left.appendChild(recBar)

const menuRow = el('div', 'menurow')
menuRow.id = 'menurow'
left.appendChild(menuRow)
main.appendChild(left)

// Right column — live data panels
const right = el('section', 'col-panels')
right.innerHTML = `
  <div class="panel">
    <div class="panel-h">TELEGRAM FEED <button class="mini" id="btn-inject">+ inject msg</button></div>
    <div id="feed" class="feed"></div>
    <form id="inject-form" class="inject hidden">
      <input id="inj-sender" placeholder="Sender" value="HL Sentinel Bot"/>
      <input id="inj-chat" placeholder="Chat" value="Hyperliquid Whale Perps Alert"/>
      <textarea id="inj-text" rows="2">ETH-PERP breakout on Hyperliquid — OI +9% in 20m, funding positive.</textarea>
      <button type="submit">Broadcast to G2</button>
    </form>
  </div>
  <div class="panel">
    <div class="panel-h">PAPER POSITIONS · HYPERLIQUID TESTNET</div>
    <div id="positions" class="table"></div>
  </div>
  <div class="panel">
    <div class="panel-h">POLYMARKET ODDS</div>
    <div id="poly" class="table"></div>
  </div>
  <div class="panel">
    <div class="panel-h">ACTIVITY</div>
    <div id="activity" class="activity"></div>
  </div>`
main.appendChild(right)

// Demo caption bar (recording mode)
const caption = el('div', 'caption hidden')
caption.id = 'caption'
app.appendChild(caption)
function setCaption(t: string) {
  if (!IS_DEMO) return
  caption.classList.remove('hidden')
  caption.textContent = t
}

// ---------------------------------------------------------------------------
// Bridge selection
let adapter: BrowserEvenAdapter | null = null
let bridge: BridgeLike

if (hasNativeBridge()) {
  bridge = wrapSdkBridge(await waitForEvenAppBridge())
  lensLabel.textContent = 'G2 LINKED — HUD is live on glasses'
  lens.classList.add('linked')
  lens.innerHTML = '<div class="linked-msg">HUD ACTIVE ON G2<br/>Controls on the glasses temple / R1 ring</div>'
} else {
  adapter = new BrowserEvenAdapter(lens)
  bridge = adapter
}

const engine = new HudEngine({
  bridge,
  fetchState,
  postJson,
  onVoice: rec => recBar.classList.toggle('hidden', !rec),
})
await engine.start()

// mark paired on first load for local demo (device storage persists it)
if (!hasNativeBridge()) await engine.markPaired(true)

// ---------------------------------------------------------------------------
// Gesture deck (browser mode only)
if (adapter) {
  const mk = (label: string, cls: string, fn: () => void): HTMLButtonElement => {
    const b = el('button', `gbtn ${cls}`, label)
    b.addEventListener('click', fn)
    return b
  }

  deck.append(
    mk('▲ SWIPE UP', '', () => adapter!.injectEvent('text', { eventType: EV.SCROLL_TOP, containerID: 2 })),
    mk('● TAP — ACTION', 'primary', () => adapter!.injectEvent('sys', { eventType: EV.CLICK, eventSource: SRC.GLASSES_R })),
    mk('▼ SWIPE DOWN', '', () => adapter!.injectEvent('text', { eventType: EV.SCROLL_BOTTOM, containerID: 2 })),
    mk('◉ R1 RING — NEXT DRAFT', '', () => adapter!.injectEvent('sys', { eventType: EV.CLICK, eventSource: SRC.RING })),
    mk('✕ DOUBLE-TAP — EXIT', 'danger', () => adapter!.injectEvent('sys', { eventType: EV.DOUBLE_CLICK, eventSource: SRC.GLASSES_R })),
  )

  const hold = el('button', 'gbtn voice', '◉ HOLD TO TALK')
  const down = (e: Event) => {
    e.preventDefault()
    adapter!.injectEvent('sys', { eventType: EV.LONG_PRESS, eventSource: SRC.GLASSES_R })
  }
  const up = () => adapter!.injectEvent('sys', { eventType: EV.LONG_PRESS_RELEASE, eventSource: SRC.GLASSES_R })
  hold.addEventListener('mousedown', down)
  hold.addEventListener('touchstart', down, { passive: false })
  hold.addEventListener('mouseup', up)
  hold.addEventListener('mouseleave', () => { if (!recBar.classList.contains('hidden')) up() })
  hold.addEventListener('touchend', up)
  deck.appendChild(hold)

  // Contextual menu items mirror what the glasses OS renders
  adapter.onPageChange = () => {
    menuRow.innerHTML = ''
    const lbl = el('span', 'menurow-lbl', 'GLASSES MENU ▸')
    menuRow.appendChild(lbl)
    for (const it of adapter!.menu) {
      const b = el('button', 'menu-btn', it.itemName ?? '')
      b.addEventListener('click', () => adapter!.injectEvent('menu', { itemID: it.itemID }))
      menuRow.appendChild(b)
    }
  }

  // Keyboard shortcuts for demo recording
  window.addEventListener('keydown', e => {
    if (e.key === 'ArrowUp') adapter!.injectEvent('text', { eventType: EV.SCROLL_TOP, containerID: 2 })
    if (e.key === 'ArrowDown') adapter!.injectEvent('text', { eventType: EV.SCROLL_BOTTOM, containerID: 2 })
    if (e.key === 'Enter') adapter!.injectEvent('sys', { eventType: EV.CLICK, eventSource: SRC.GLASSES_R })
    if (e.key === 'r') adapter!.injectEvent('sys', { eventType: EV.CLICK, eventSource: SRC.RING })
  })
} else {
  deck.innerHTML = '<div class="note">On-glasses controls active — tap / swipe / hold on the G2 temple or R1 ring.</div>'
}

// ---------------------------------------------------------------------------
// Inject form
const injectForm = document.querySelector<HTMLFormElement>('#inject-form')!
document.querySelector('#btn-inject')!.addEventListener('click', () => {
  injectForm.classList.toggle('hidden')
})
injectForm.addEventListener('submit', async e => {
  e.preventDefault()
  await postJson('/api/telegram/inject', {
    sender: (document.querySelector('#inj-sender') as HTMLInputElement).value,
    chatTitle: (document.querySelector('#inj-chat') as HTMLInputElement).value,
    text: (document.querySelector('#inj-text') as HTMLTextAreaElement).value,
  })
  await fetchState()
  injectForm.classList.add('hidden')
})

// ---------------------------------------------------------------------------
// Panel rendering
const feed = document.querySelector<HTMLDivElement>('#feed')!
const positions = document.querySelector<HTMLDivElement>('#positions')!
const poly = document.querySelector<HTMLDivElement>('#poly')!
const activity = document.querySelector<HTMLDivElement>('#activity')!
const bdLink = document.querySelector<HTMLSpanElement>('#bd-link')!
const bdMkt = document.querySelector<HTMLSpanElement>('#bd-mkt')!
const bdEq = document.querySelector<HTMLSpanElement>('#bd-eq')!

function esc(s: string): string {
  return s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)
}

function renderPanels(s: TelePulseState): void {
  bdLink.textContent = s.pairing.telegramBotConnected ? 'TG LIVE' : 'TG SIM'
  bdLink.className = `badge ${s.pairing.telegramBotConnected ? 'ok' : 'warn'}`
  bdMkt.textContent = s.pairing.liveMarketSource === 'LIVE_API' ? 'MKT LIVE' : 'MKT CACHE'
  bdMkt.className = `badge ${s.pairing.liveMarketSource === 'LIVE_API' ? 'ok' : 'warn'}`
  bdEq.textContent = `EQ $${s.hyperliquid.paperEquityUsd.toLocaleString('en-US', { maximumFractionDigits: 0 })}`

  feed.innerHTML = s.telegramMessages
    .map(
      m => `
    <div class="msg ${m.unread ? 'unread' : ''} ${m.riskBadge === 'THREAT_BLOCKED' ? 'blocked' : ''}">
      <div class="msg-top"><b>${esc(m.sender)}</b> <span>${esc(m.handle)}</span> <i>${esc(m.timestamp)}</i>
        ${m.linkedAction ? '<em class="tag">◆ SIGNAL</em>' : m.riskBadge === 'THREAT_BLOCKED' ? '<em class="tag danger">BLOCKED</em>' : ''}
      </div>
      <div class="msg-sum">${esc(m.glanceSummary)}</div>
      ${m.repliedText ? `<div class="msg-rep">√ replied: ${esc(m.repliedText)}</div>` : ''}
    </div>`,
    )
    .join('')

  positions.innerHTML = s.hyperliquid.positions.length
    ? `<table><tr><th>SIDE</th><th>SYM</th><th>SIZE</th><th>ENTRY</th><th>MARK</th><th>PNL</th></tr>${s.hyperliquid.positions
        .map(
          p => `<tr class="${p.pnlUsd >= 0 ? 'up' : 'down'}"><td>${p.side}</td><td>${p.symbol}</td><td>$${p.sizeUsd}</td><td>${p.entryPrice}</td><td>${p.markPrice}</td><td>${p.pnlUsd >= 0 ? '+' : ''}$${p.pnlUsd.toFixed(2)} (${p.pnlPct}%)</td></tr>`,
        )
        .join('')}</table>`
    : '<div class="empty">No open paper positions</div>'

  poly.innerHTML = `<table><tr><th>MARKET</th><th>YES</th><th>NO</th><th>VOL</th></tr>${s.polymarket.markets
    .map(
      m => `<tr><td>${esc(m.shortTitle)}</td><td class="up">${m.yesCents}c</td><td class="down">${m.noCents}c</td><td>$${(m.volumeUsd / 1e6).toFixed(1)}M</td></tr>`,
    )
    .join('')}</table>`

  activity.innerHTML = s.activityLog
    .slice(0, 10)
    .map(a => `<div class="act"><span>${a.timestamp}</span> <b>${a.source}</b> ${esc(a.action)} <i>${esc(a.detail)}</i></div>`)
    .join('')
}

setInterval(async () => {
  try {
    renderPanels(await fetchState())
  } catch {
    /* offline */
  }
}, 2500)
fetchState().then(renderPanels).catch(() => {})

// ---------------------------------------------------------------------------
// DEMO AUTO-PLAY — scripted scenario used for the ≤3 min submission video.
// Drives the same events the firmware emits, through the same code path.
// ---------------------------------------------------------------------------
if (IS_DEMO && adapter) {
  const a = adapter
  const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
  const tap = () => a.injectEvent('sys', { eventType: EV.CLICK, eventSource: SRC.GLASSES_R })
  const ring = () => a.injectEvent('sys', { eventType: EV.CLICK, eventSource: SRC.RING })
  const swipe = (dir: 'up' | 'down') =>
    a.injectEvent('text', { eventType: dir === 'up' ? EV.SCROLL_TOP : EV.SCROLL_BOTTOM, containerID: 2 })
  const menu = (id: number) => a.injectEvent('menu', { itemID: id })

  ;(async () => {
    await sleep(1600)
    setCaption('TELEPULSE HUD — Telegram × DeFi at a glance, on Even G2')
    await sleep(2600)

    setCaption('An alpha signal lands on Telegram — sieved, summarized, linked to a live market')
    await postJson('/api/telegram/inject', {
      sender: 'HL Sentinel Bot',
      handle: '@hl_whale_sentinel',
      chatTitle: 'Hyperliquid Whale Perps Alert',
      text: 'ETH-PERP breakout on Hyperliquid — open interest +11% in 20m, funding positive.',
    })
    await sleep(3200)

    setCaption('ONE TAP — executes the linked paper trade on Hyperliquid testnet')
    tap()
    await sleep(3400)

    setCaption('Position opened — receipt logged, PnL tracked live on the HUD')
    await sleep(2400)

    setCaption('SWIPE — move through the glance queue, hands-free')
    swipe('down')
    await sleep(1800)
    swipe('down')
    await sleep(2000)

    setCaption('R1 RING — cycle AI-drafted replies without touching the phone')
    ring()
    await sleep(1600)
    ring()
    await sleep(1800)

    setCaption('TAP — sends the drafted Telegram reply via the bot bridge')
    tap()
    await sleep(3000)

    setCaption('LONG-PRESS — push-to-talk voice: "paper long SOL $250"')
    a.injectEvent('sys', { eventType: EV.LONG_PRESS, eventSource: SRC.GLASSES_R })
    await sleep(2600)
    a.injectEvent('sys', { eventType: EV.LONG_PRESS_RELEASE, eventSource: SRC.GLASSES_R })
    setCaption('Voice intent parsed → paper LONG SOL-PERP executed on testnet')
    await sleep(3600)

    setCaption('GLASSES MENU — switch desks without leaving the HUD')
    menu(2)
    await sleep(3000)
    setCaption('HL PERPS DESK — live marks, funding, sparkline, 1-tap entries')
    await sleep(2200)
    menu(3)
    await sleep(2600)
    setCaption('POLYMARKET ODDS — prediction markets at a glance')
    await sleep(2400)
    menu(4)
    await sleep(2600)
    setCaption('GRAM WALLET — read-only TON treasury, zero custody')
    await sleep(2400)
    menu(1)
    await sleep(2000)

    setCaption('DOUBLE-TAP — system exit dialog (Even Hub QA spec)')
    a.injectEvent('sys', { eventType: EV.DOUBLE_CLICK, eventSource: SRC.GLASSES_R })
    await sleep(2200)
    setCaption('TelePulse HUD — read & write in seconds. Kushagra Gupta · Heads Up Hackathon')
    await sleep(3200)
    caption.classList.add('hidden')
  })()
}
