// ---------------------------------------------------------------------------
// HudEngine — TelePulse HUD for Even G2.
// Bridge-agnostic: drives the real Even Hub SDK bridge or BrowserEvenAdapter.
// 576×288 canvas, 4-bit green. Tap = smart write-action, swipe = glance feed,
// long-press = push-to-talk voice, double-tap = system exit (QA-required).
// ---------------------------------------------------------------------------

import type {
  BridgeLike,
  HudMode,
  TelePulseState,
  TelegramGlanceItem,
  VoiceIntentResult,
} from '../types'
import { renderSparklineGrey4 } from './sparkline'

// OsEventTypeList (protobuf ordinals)
const EV = {
  CLICK: 0,
  SCROLL_TOP: 1,
  SCROLL_BOTTOM: 2,
  DOUBLE_CLICK: 3,
  FOREGROUND_ENTER: 4,
  FOREGROUND_EXIT: 5,
  ABNORMAL_EXIT: 6,
  SYSTEM_EXIT: 7,
  IMU: 8,
  LONG_PRESS: 9,
  LONG_PRESS_RELEASE: 10,
} as const

// EventSourceType
const SRC = { GLASSES_R: 1, RING: 2, GLASSES_L: 3 } as const

const MENU = [
  { itemName: 'Telegram Feed', itemID: 1 },
  { itemName: 'HL Perps Desk', itemID: 2 },
  { itemName: 'Polymarket Odds', itemID: 3 },
  { itemName: 'Gram Wallet', itemID: 4 },
  { itemName: 'Activity Log', itemID: 5 },
  { itemName: 'Refresh Feeds', itemID: 6 },
]

const MODE_OF_MENU: Record<number, HudMode | 'REFRESH'> = {
  1: 'TELEGRAM',
  2: 'HYPERLIQUID',
  3: 'POLYMARKET',
  4: 'GRAM_WALLET',
  5: 'ACTIVITY',
  6: 'REFRESH',
}

const CID = { HDR: 1, MAIN: 2, SIDE: 3, SPARK: 4, ACT: 5 } as const

const G = {
  OK: '●',
  DIM: '○',
  SEL: '▸',
  UP: '▲',
  DN: '▼',
  BAR: '─',
  LINE: '│',
  CHECK: '√',
  DOT: '·',
} as const

function money(v: number, dp = 0): string {
  return v.toLocaleString('en-US', { maximumFractionDigits: dp, minimumFractionDigits: dp })
}

function pct(v: number): string {
  return `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`
}

function clock(): string {
  return new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

function clip(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s
}

export interface HudEngineOptions {
  bridge: BridgeLike
  fetchState: () => Promise<TelePulseState>
  postJson: (path: string, body: unknown) => Promise<Record<string, unknown>>
  onRender?: (mode: HudMode) => void
  onVoice?: (recording: boolean) => void
  pollMs?: number
}

export class HudEngine {
  private b: BridgeLike
  private opts: HudEngineOptions
  private state: TelePulseState | null = null
  private mode: HudMode = 'TELEGRAM'
  private msgIdx = 0
  private draftIdx = 0
  private pageIdx = 0
  private created = false
  private recording = false
  private pcmBytes = 0
  private lastContent = new Map<number, string>()
  private lastTextColor = new Map<number, number>()
  private renderTimer: ReturnType<typeof setTimeout> | null = null
  private pollTimer: ReturnType<typeof setInterval> | null = null
  private imageBusy: Promise<unknown> = Promise.resolve()
  private lastSparkSig = ''
  private toastUntil = 0
  private toastText = ''
  private unsub: (() => void) | null = null
  private stopped = false
  private paired = true

  constructor(opts: HudEngineOptions) {
    this.opts = opts
    this.b = opts.bridge
  }

  // ---------------------------------------------------------------------
  async start(): Promise<void> {
    const stored = await this.b.getLocalStorage('paired').catch(() => '')
    this.paired = stored !== '0'

    this.unsub = this.b.onEvenHubEvent(e => this.onEvent(e))
    await this.createPage()
    await this.poll()
    this.pollTimer = setInterval(() => this.poll().catch(() => {}), this.opts.pollMs ?? 2500)
  }

  stop(): void {
    this.stopped = true
    if (this.pollTimer) clearInterval(this.pollTimer)
    if (this.renderTimer) clearTimeout(this.renderTimer)
    this.unsub?.()
  }

  async markPaired(v: boolean): Promise<void> {
    this.paired = v
    await this.b.setLocalStorage('paired', v ? '1' : '0')
    this.renderSoon()
  }

  // ---------------------------------------------------------------------
  private async poll(): Promise<void> {
    if (this.stopped) return
    try {
      this.state = await this.opts.fetchState()
    } catch {
      // offline — keep last state, header shows DIM link
    }
    this.renderSoon()
  }

  // ---------------------------------------------------------------------
  private async createPage(): Promise<void> {
    const res = await this.b.createStartUpPageContainer({
      containerTotalNum: 5,
      textObject: [
        {
          xPosition: 0, yPosition: 0, width: 576, height: 30,
          borderWidth: 0, borderColor: 5, paddingLength: 4,
          containerID: CID.HDR, containerName: 'hdr',
          content: 'TELEPULSE STARTING…', isEventCapture: 0, zOrderIndex: 1, textColor: 4,
        },
        {
          xPosition: 0, yPosition: 34, width: 412, height: 190,
          borderWidth: 1, borderColor: 7, borderRadius: 5, paddingLength: 10,
          containerID: CID.MAIN, containerName: 'main',
          content: 'Syncing feeds…', isEventCapture: 1, zOrderIndex: 2, textColor: 4,
        },
        {
          xPosition: 420, yPosition: 34, width: 156, height: 112,
          borderWidth: 1, borderColor: 5, borderRadius: 5, paddingLength: 6,
          containerID: CID.SIDE, containerName: 'side',
          content: '', isEventCapture: 0, zOrderIndex: 3, textColor: 3,
        },
        {
          xPosition: 0, yPosition: 230, width: 576, height: 58,
          borderWidth: 0, borderColor: 5, paddingLength: 4,
          containerID: CID.ACT, containerName: 'act',
          content: '', isEventCapture: 0, zOrderIndex: 4, textColor: 2,
        },
      ],
      imageObject: [
        {
          xPosition: 420, yPosition: 152, width: 156, height: 72,
          containerID: CID.SPARK, containerName: 'spark', zOrderIndex: 5,
        },
      ],
      menuObject: { menuItems: MENU },
    })
    this.created = res === 0
    this.lastContent.clear()
    this.lastSparkSig = ''
  }

  private async rebuildPage(): Promise<void> {
    this.lastContent.clear()
    this.lastTextColor.clear()
    this.lastSparkSig = ''
    const res = await this.b.rebuildPageContainer({
      containerTotalNum: 5,
      textObject: [
        {
          xPosition: 0, yPosition: 0, width: 576, height: 30,
          borderWidth: 0, borderColor: 5, paddingLength: 4,
          containerID: CID.HDR, containerName: 'hdr',
          content: 'TELEPULSE', isEventCapture: 0, zOrderIndex: 1, textColor: 4,
        },
        {
          xPosition: 0, yPosition: 34, width: 412, height: 190,
          borderWidth: 1, borderColor: 7, borderRadius: 5, paddingLength: 10,
          containerID: CID.MAIN, containerName: 'main',
          content: '', isEventCapture: 1, zOrderIndex: 2, textColor: 4,
        },
        {
          xPosition: 420, yPosition: 34, width: 156, height: 112,
          borderWidth: 1, borderColor: 5, borderRadius: 5, paddingLength: 6,
          containerID: CID.SIDE, containerName: 'side',
          content: '', isEventCapture: 0, zOrderIndex: 3, textColor: 3,
        },
        {
          xPosition: 0, yPosition: 230, width: 576, height: 58,
          borderWidth: 0, borderColor: 5, paddingLength: 4,
          containerID: CID.ACT, containerName: 'act',
          content: '', isEventCapture: 0, zOrderIndex: 4, textColor: 2,
        },
      ],
      imageObject: [
        {
          xPosition: 420, yPosition: 152, width: 156, height: 72,
          containerID: CID.SPARK, containerName: 'spark', zOrderIndex: 5,
        },
      ],
      menuObject: { menuItems: MENU },
    })
    if (!res) console.warn('rebuildPageContainer failed')
    this.renderSoon()
  }

  // ---------------------------------------------------------------------
  private renderSoon(): void {
    if (this.renderTimer) return
    this.renderTimer = setTimeout(() => {
      this.renderTimer = null
      this.render().catch(err => console.warn('render', err))
    }, 140) // debounce — BLE render queue is slow
  }

  private async setText(cid: number, name: string, content: string, color = 4): Promise<void> {
    if (this.lastContent.get(cid) === content && this.lastTextColor.get(cid) === color) return
    this.lastContent.set(cid, content)
    this.lastTextColor.set(cid, color)
    await this.b.textContainerUpgrade({
      containerID: cid, containerName: name, content, textColor: color,
    })
  }

  private async pushSpark(values: number[], rising: boolean, sig: string): Promise<void> {
    if (sig === this.lastSparkSig) return
    this.lastSparkSig = sig
    const bytes = renderSparklineGrey4(values, { w: 156, h: 72, rising })
    this.imageBusy = this.imageBusy.then(() =>
      this.b.updateImageRawData({ containerID: CID.SPARK, containerName: 'spark', imageData: bytes }),
    )
    await this.imageBusy
  }

  // ---------------------------------------------------------------------
  private async render(): Promise<void> {
    if (!this.created || this.stopped) return
    const s = this.state

    if (!this.paired) {
      const code = s?.pairing.code ?? '———'
      await this.setText(CID.HDR, 'hdr', `TELEPULSE ${G.DOT} SETUP`, 4)
      await this.setText(
        CID.MAIN, 'main',
        `PAIR THIS DEVICE\n\nOpen TelePulse companion on your phone\nand enter pairing code:\n\n   ${code}\n\nDouble-tap to exit`,
        4,
      )
      await this.setText(CID.SIDE, 'side', 'PAIRING\nPENDING', 2)
      await this.setText(CID.ACT, 'act', `2x-tap: Exit ${G.DOT} Setup stored on-device`, 2)
      return
    }

    const linked = s?.pairing.liveMarketSource === 'LIVE_API' ? 'LIVE' : 'CACHE'
    const unread = s ? s.telegramMessages.filter(m => m.unread).length : 0
    await this.setText(
      CID.HDR, 'hdr',
      `TELEPULSE ${G.DOT} ${clock()} ${G.DOT} ${linked} ${G.DOT} TG:${unread}`,
      4,
    )

    switch (this.mode) {
      case 'TELEGRAM':
        await this.renderTelegram(s)
        break
      case 'HYPERLIQUID':
        await this.renderHyperliquid(s)
        break
      case 'POLYMARKET':
        await this.renderPolymarket(s)
        break
      case 'GRAM_WALLET':
        await this.renderGram(s)
        break
      case 'ACTIVITY':
        await this.renderActivity(s)
        break
    }
    this.opts.onRender?.(this.mode)
  }

  // ---------------------------------------------------------------------
  private toast(line: string, ms = 3800): void {
    this.toastText = line
    this.toastUntil = Date.now() + ms
    this.renderSoon()
  }

  private toastLine(): string | null {
    return Date.now() < this.toastUntil ? this.toastText : null
  }

  private async renderTelegram(s: TelePulseState | null): Promise<void> {
    const msgs = s?.telegramMessages ?? []
    const m = msgs[this.msgIdx] as TelegramGlanceItem | undefined

    if (!m) {
      await this.setText(CID.MAIN, 'main', 'NO MESSAGES\n\nWaiting for Telegram feed…', 4)
      await this.setText(CID.SIDE, 'side', '', 2)
      await this.setText(CID.ACT, 'act', this.actionBar('Nothing to act on'), 2)
      return
    }

    const badge =
      m.riskBadge === 'THREAT_BLOCKED' ? '!! SHIELD' : m.riskBadge === 'ALPHA_SIGNAL' ? '◆ ALPHA' : '● VERIFIED'
    const draft = m.aiDrafts[this.draftIdx % Math.max(1, m.aiDrafts.length)]
    const t = this.toastLine()

    const body = [
      `${clip(m.chatTitle, 38)}`,
      `${m.sender} ${m.handle} ${G.DOT} ${m.timestamp}`,
      ``,
      clip(m.glanceSummary, 132),
      ``,
      `${badge} ${G.LINE} draft ${(this.draftIdx % m.aiDrafts.length) + 1}/${m.aiDrafts.length}`,
      `${G.SEL} ${clip(draft ?? '—', 96)}`,
      m.repliedText ? `\nSENT: ${clip(m.repliedText, 60)}` : '',
    ].join('\n')
    await this.setText(CID.MAIN, 'main', body, m.riskBadge === 'THREAT_BLOCKED' ? 2 : 4)

    // side panel — linked market or queue meta
    const link = m.linkedAction
    if (link?.protocol === 'Hyperliquid' && s) {
      const a = s.hyperliquid.assets.find(x => x.symbol === link.symbol)
      await this.setText(
        CID.SIDE, 'side',
        `${a?.symbol ?? link.symbol}-PERP\n$${money(a?.markPrice ?? 0, a && a.markPrice > 100 ? 0 : 2)}\n${pct(a?.change24hPct ?? 0)}\n${G.DOT} ${clip(link.label, 40)}`,
        3,
      )
      if (a) await this.pushSpark(a.sparkline, a.change24hPct >= 0, `hl-${a.symbol}-${a.markPrice}`)
    } else if (link?.protocol === 'Polymarket' && s) {
      const mk = s.polymarket.markets[0]
      await this.setText(
        CID.SIDE, 'side',
        `POLYMARKET\nYES ${mk?.yesCents ?? 0}c ${G.LINE} NO ${mk?.noCents ?? 0}c\n$${money((mk?.volumeUsd ?? 0) / 1e6, 1)}M vol\n${G.DOT} ${clip(link.label, 38)}`,
        3,
      )
      if (mk) await this.pushSpark(mk.sparkline, true, `pm-${mk.id}-${mk.yesCents}`)
    } else {
      await this.setText(
        CID.SIDE, 'side',
        `QUEUE\n${this.msgIdx + 1}/${msgs.length}\nUNREAD ${msgs.filter(x => x.unread).length}`,
        3,
      )
      const a = s?.hyperliquid.assets[0]
      if (a) await this.pushSpark(a.sparkline, a.change24hPct >= 0, `q-${a.symbol}-${a.markPrice}`)
    }

    const primary = m.linkedAction ? 'Execute signal' : 'Send draft'
    await this.setText(
      CID.ACT, 'act',
      this.actionBar(primary, t ?? undefined),
      t ? 4 : 2,
    )
  }

  private async renderHyperliquid(s: TelePulseState | null): Promise<void> {
    const h = s?.hyperliquid
    if (!h) {
      await this.setText(CID.MAIN, 'main', 'HL feed offline…', 4)
      return
    }
    const eq = h.paperEquityUsd
    const open = h.positions.slice(0, 4)
    const top = h.assets.slice(0, 4)
    const pnlAll = h.positions.reduce((a, p) => a + p.pnlUsd, 0)

    const lines = [
      `PAPER EQUITY  $${money(eq, 2)}  (${pct((pnlAll / 10000) * 100)})`,
      `MARGIN FREE   $${money(h.availableMarginUsd, 0)}`,
      `${G.BAR.repeat(34)}`,
      ...open.map(
        p =>
          `${p.side === 'LONG' ? '▲L' : '▼S'} ${p.symbol} ${p.leverage}x  $${money(p.sizeUsd)}  ${pct(p.pnlPct)} ($${p.pnlUsd >= 0 ? '+' : ''}${money(p.pnlUsd, 0)})`,
      ),
      '',
      ...top.map(a => `${a.symbol.padEnd(5)} $${money(a.markPrice, a.markPrice > 100 ? 0 : 2).padStart(8)}  ${pct(a.change24hPct)}`),
    ]
    await this.setText(CID.MAIN, 'main', lines.join('\n'), 4)

    const focus = h.assets[this.pageIdx % h.assets.length]
    await this.setText(
      CID.SIDE, 'side',
      `${focus.symbol}-PERP\n$${money(focus.markPrice, focus.markPrice > 100 ? 0 : 3)}\nFUND ${(focus.fundingRatePct * 100).toFixed(3)}%\nVOL $${money(focus.volume24hUsd / 1e9, 2)}B`,
      3,
    )
    await this.pushSpark(focus.sparkline, focus.change24hPct >= 0, `deskh-${focus.symbol}-${focus.markPrice}`)

    await this.setText(
      CID.ACT, 'act',
      this.actionBar(`Paper LONG $250 ${focus.symbol}`, this.toastLine() ?? undefined),
      this.toastLine() ? 4 : 2,
    )
  }

  private async renderPolymarket(s: TelePulseState | null): Promise<void> {
    const mkts = s?.polymarket.markets ?? []
    const sel = mkts[this.pageIdx % Math.max(1, mkts.length)]
    if (!sel) {
      await this.setText(CID.MAIN, 'main', 'Polymarket feed offline…', 4)
      return
    }
    const lines = [
      `POLYMARKET ${G.DOT} ${this.pageIdx % mkts.length + 1}/${mkts.length}`,
      '',
      clip(sel.title, 78),
      '',
      `YES ${sel.yesCents}c  ${G.LINE}  NO ${sel.noCents}c`,
      `VOL $${money(sel.volumeUsd / 1e6, 1)}M  LIQ $${money(sel.liquidityUsd / 1e3, 0)}K`,
      `ENDS ${sel.endDate}`,
      '',
      'SWIPE: next market',
    ]
    await this.setText(CID.MAIN, 'main', lines.join('\n'), 4)

    const bar = sparkBar(sel.sparkline)
    await this.setText(CID.SIDE, 'side', `YES ${sel.yesCents}c\n${bar}\nΔ${trend(sel.sparkline)}c`, 3)
    await this.pushSpark(sel.sparkline, trend(sel.sparkline) >= 0, `pmk-${sel.id}-${sel.yesCents}`)

    await this.setText(
      CID.ACT, 'act',
      this.actionBar(`Paper BUY YES $100 @${sel.yesCents}c`, this.toastLine() ?? undefined),
      this.toastLine() ? 4 : 2,
    )
  }

  private async renderGram(s: TelePulseState | null): Promise<void> {
    const g = s?.gramWallet
    if (!g) {
      await this.setText(CID.MAIN, 'main', 'Gram wallet offline…', 4)
      return
    }
    const lines = [
      `GRAM WALLET ${G.DOT} READ-ONLY`,
      clip(g.address, 42),
      `${G.BAR.repeat(34)}`,
      `TON    ${money(g.tonBalance, 2)}  ~$${money(g.tonBalance * g.tonPriceUsd, 0)}`,
      `USDT·T ${money(g.usdtTonBalance, 2)}`,
      `TOTAL  $${money(g.totalUsd, 2)}`,
      '',
      ...g.recentTransfers.slice(0, 3).map(t => `${t.direction === 'IN' ? '←' : '→'} ${t.amount}  ${clip(t.counterparty, 18)} ${t.age}`),
    ]
    await this.setText(CID.MAIN, 'main', lines.join('\n'), 4)
    const ton = s?.hyperliquid.assets.find(a => a.symbol === 'TON')
    await this.setText(CID.SIDE, 'side', `TON/USD\n$${money(g.tonPriceUsd, 2)}\n${g.network.split(' ')[0]}`, 3)
    if (ton) await this.pushSpark(ton.sparkline, ton.change24hPct >= 0, `gram-${ton.markPrice}`)
    await this.setText(CID.ACT, 'act', this.actionBar('Watch-only (safe)', this.toastLine() ?? undefined), 2)
  }

  private async renderActivity(s: TelePulseState | null): Promise<void> {
    const acts = s?.activityLog ?? []
    const page = acts.slice(this.pageIdx * 8, this.pageIdx * 8 + 8)
    const lines = [
      `ACTIVITY ${G.DOT} p${this.pageIdx + 1}/${Math.max(1, Math.ceil(acts.length / 8))}`,
      '',
      ...page.map(a => `${a.timestamp.slice(0, 5)} ${a.source.slice(0, 3).padEnd(3)} ${clip(a.action, 22)} ${clip(a.detail, 22)}`),
    ]
    await this.setText(CID.MAIN, 'main', lines.join('\n') || 'empty', 4)
    await this.setText(CID.SIDE, 'side', `EVENTS\n${acts.length}`, 3)
    await this.setText(CID.ACT, 'act', this.actionBar('Swipe: page', this.toastLine() ?? undefined), 2)
  }

  private actionBar(primary: string, override?: string): string {
    if (override) return override
    return `${G.BAR.repeat(30)}\nTAP ${G.SEL} ${primary}\nSWIPE ${G.UP}${G.DN} feed ${G.DOT} HOLD: voice ${G.DOT} 2x: exit`
  }

  // ---------------------------------------------------------------------
  private async onEvent(e: {
    textEvent?: { containerID?: number; eventType?: number }
    listEvent?: { containerID?: number; eventType?: number; currentSelectItemIndex?: number }
    sysEvent?: { eventType?: number; eventSource?: number }
    audioEvent?: { audioPcm?: Uint8Array }
    menuItemClickEvent?: { itemID?: number }
  }): Promise<void> {
    if (this.stopped) return

    if (e.audioEvent?.audioPcm && this.recording) {
      this.pcmBytes += e.audioEvent.audioPcm.length
      return
    }

    const menuId = e.menuItemClickEvent?.itemID
    if (menuId !== undefined) {
      const target = MODE_OF_MENU[menuId]
      if (target === 'REFRESH') await this.poll()
      else if (target) {
        this.mode = target
        this.pageIdx = 0
        await this.rebuildPage()
      }
      return
    }

    const sysT = e.sysEvent?.eventType
    const textT = e.textEvent?.eventType
    const listT = e.listEvent?.eventType
    const source = e.sysEvent?.eventSource ?? 0

    // Double-tap = system exit dialog (QA requirement) — from ANY envelope.
    if (sysT === EV.DOUBLE_CLICK || textT === EV.DOUBLE_CLICK || listT === EV.DOUBLE_CLICK) {
      await this.b.shutDownPageContainer(1)
      return
    }
    if (sysT === EV.SYSTEM_EXIT || sysT === EV.ABNORMAL_EXIT) {
      this.stop()
      return
    }
    if (sysT === EV.FOREGROUND_EXIT) return
    if (sysT === EV.FOREGROUND_ENTER) {
      await this.poll()
      return
    }

    // Push-to-talk voice
    if (sysT === EV.LONG_PRESS) {
      this.recording = true
      this.pcmBytes = 0
      this.opts.onVoice?.(true)
      await this.b.audioControl(true)
      this.toast('● REC — speak, release to send', 30000)
      return
    }
    if (sysT === EV.LONG_PRESS_RELEASE) {
      this.recording = false
      this.opts.onVoice?.(false)
      await this.b.audioControl(false)
      this.toast('Transcribing…', 6000)
      const active = this.state?.telegramMessages[this.msgIdx]?.id
      const res = (await this.opts.postJson('/api/voice/intent', {
        pcmBytesCount: this.pcmBytes,
        activeMessageId: active,
      }).catch(() => null)) as (VoiceIntentResult & { state?: TelePulseState }) | null
      if (res?.state) this.state = res.state
      this.toast(res ? res.executionSummary : 'Voice failed — offline?', 5200)
      return
    }

    // Scroll / swipe = navigate
    if (textT === EV.SCROLL_TOP || listT === EV.SCROLL_TOP || sysT === EV.SCROLL_TOP) {
      this.nav(-1)
      return
    }
    if (textT === EV.SCROLL_BOTTOM || listT === EV.SCROLL_BOTTOM || sysT === EV.SCROLL_BOTTOM) {
      this.nav(1)
      return
    }

    // Click — glasses executes smart action; R1 ring cycles drafts
    if (sysT === EV.CLICK || textT === EV.CLICK) {
      if (source === SRC.RING) {
        this.draftIdx++
        this.renderSoon()
        return
      }
      await this.smartAction()
      return
    }
  }

  private nav(dir: number): void {
    const s = this.state
    if (this.mode === 'TELEGRAM') {
      const n = s?.telegramMessages.length ?? 0
      if (n > 0) {
        this.msgIdx = (this.msgIdx + dir + n) % n
        this.draftIdx = 0
      }
    } else {
      this.pageIdx = Math.max(0, this.pageIdx + dir)
      if (this.mode === 'HYPERLIQUID' && s) this.pageIdx %= s.hyperliquid.assets.length
      if (this.mode === 'POLYMARKET' && s) this.pageIdx %= s.polymarket.markets.length
      if (this.mode === 'ACTIVITY') this.pageIdx = dir > 0 ? this.pageIdx + 1 : Math.max(0, this.pageIdx - 1)
    }
    this.renderSoon()
  }

  /** The 1-tap "write" half of read-and-write. */
  private async smartAction(): Promise<void> {
    const s = this.state
    if (!s) return

    if (this.mode === 'TELEGRAM') {
      const m = s.telegramMessages[this.msgIdx]
      if (!m) return

      // Alpha signal with linked DeFi action → execute paper trade
      if (m.linkedAction && (m.linkedAction.protocol === 'Hyperliquid' || m.linkedAction.protocol === 'Polymarket')) {
        const res = (await this.opts.postJson('/api/trade/paper', {
          protocol: m.linkedAction.protocol,
          symbol: m.linkedAction.symbol,
          side: m.linkedAction.side,
          sizeUsd: m.linkedAction.sizeUsd,
          source: 'G2_TAP',
        }).catch(() => null)) as { summary?: string; state?: TelePulseState } | null
        if (res?.state) this.state = res.state
        this.toast(res?.summary ?? 'Trade failed')
        return
      }

      // Else: send selected AI draft reply
      const draft = m.aiDrafts[this.draftIdx % m.aiDrafts.length] ?? 'Confirmed from G2'
      const res = (await this.opts.postJson('/api/telegram/reply', {
        messageId: m.id,
        replyText: draft,
        source: 'G2_TAP',
      }).catch(() => null)) as { deliveredVia?: string; state?: TelePulseState } | null
      if (res?.state) this.state = res.state
      this.toast(`${G.CHECK} Reply sent → ${m.sender} (${res?.deliveredVia ?? 'queue'})`)
      return
    }

    if (this.mode === 'HYPERLIQUID') {
      const a = s.hyperliquid.assets[this.pageIdx % s.hyperliquid.assets.length]
      if (!a) return
      const res = (await this.opts.postJson('/api/trade/paper', {
        protocol: 'Hyperliquid', symbol: a.symbol, side: 'LONG', sizeUsd: 250, source: 'G2_TAP',
      }).catch(() => null)) as { summary?: string; state?: TelePulseState } | null
      if (res?.state) this.state = res.state
      this.toast(res?.summary ?? 'Trade failed')
      return
    }

    if (this.mode === 'POLYMARKET') {
      const mk = s.polymarket.markets[this.pageIdx % s.polymarket.markets.length]
      if (!mk) return
      const res = (await this.opts.postJson('/api/trade/paper', {
        protocol: 'Polymarket', symbol: mk.id, side: 'YES', sizeUsd: 100, source: 'G2_TAP',
      }).catch(() => null)) as { summary?: string; state?: TelePulseState } | null
      if (res?.state) this.state = res.state
      this.toast(res?.summary ?? 'Order failed')
      return
    }
  }
}

// ---------------------------------------------------------------------------
function trend(v: number[]): number {
  if (v.length < 2) return 0
  return Math.round(v[v.length - 1] - v[0])
}

function sparkBar(v: number[]): string {
  const chars = '▁▂▃▄▅▆▇█'
  const min = Math.min(...v)
  const max = Math.max(...v)
  const range = Math.max(1e-9, max - min)
  return v
    .slice(-10)
    .map(x => chars[Math.min(7, Math.floor(((x - min) / range) * 7.999))])
    .join('')
}
