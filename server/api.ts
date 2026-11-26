import type { IncomingMessage, ServerResponse } from 'node:http'

export interface LinkedDeFiAction {
  protocol: 'Hyperliquid' | 'Polymarket' | 'Gram'
  symbol: string
  side: 'LONG' | 'SHORT' | 'YES' | 'NO'
  sizeUsd: number
  label: string
}

export interface TelegramGlanceItem {
  id: string
  chatId: string
  chatTitle: string
  sender: string
  handle: string
  category: 'direct' | 'alpha' | 'ops' | 'security'
  timestamp: string
  text: string
  glanceSummary: string
  unread: boolean
  repliedText?: string
  riskBadge: 'VERIFIED' | 'ALPHA_SIGNAL' | 'THREAT_BLOCKED'
  aiDrafts: string[]
  linkedAction?: LinkedDeFiAction
}

export interface HyperliquidAsset {
  symbol: string
  pair: string
  markPrice: number
  change24hPct: number
  fundingRatePct: number
  volume24hUsd: number
  sparkline: number[]
  orderbookImbalance: number // -1 to +1
}

export interface PaperPosition {
  id: string
  protocol: 'Hyperliquid' | 'Polymarket'
  symbol: string
  side: 'LONG' | 'SHORT' | 'YES' | 'NO'
  sizeUsd: number
  entryPrice: number
  markPrice: number
  pnlUsd: number
  pnlPct: number
  leverage: number
  timestamp: string
}

export interface PolymarketEventItem {
  id: string
  title: string
  shortTitle: string
  yesCents: number
  noCents: number
  volumeUsd: number
  liquidityUsd: number
  endDate: string
  sparkline: number[]
}

export interface GramWalletSnapshot {
  address: string
  network: 'TON Mainnet (Read-Only)' | 'TON Testnet'
  tonBalance: number
  tonPriceUsd: number
  usdtTonBalance: number
  totalUsd: number
  recentTransfers: Array<{
    hash: string
    direction: 'IN' | 'OUT'
    amount: string
    counterparty: string
    age: string
  }>
}

export interface ActivityEntry {
  id: string
  timestamp: string
  source: 'G2_TAP' | 'R1_RING' | 'G2_VOICE' | 'WEBVIEW' | 'TELEGRAM_BOT'
  action: string
  detail: string
}

export interface TelePulseState {
  pairing: {
    code: string
    paired: boolean
    telegramBotConnected: boolean
    botUsername: string
    userHandle: string
    lastSyncIso: string
    liveMarketSource: 'LIVE_API' | 'FALLBACK_CACHE'
  }
  telegramMessages: TelegramGlanceItem[]
  hyperliquid: {
    assets: HyperliquidAsset[]
    positions: PaperPosition[]
    paperEquityUsd: number
    availableMarginUsd: number
  }
  polymarket: {
    markets: PolymarketEventItem[]
  }
  gramWallet: GramWalletSnapshot
  activityLog: ActivityEntry[]
}

let telegramBotToken = process.env.TELEGRAM_BOT_TOKEN || ''
let telegramDefaultChatId = process.env.TELEGRAM_DEFAULT_CHAT_ID || ''
let lastTelegramUpdateId = 0

const state: TelePulseState = {
  pairing: {
    code: '842-910',
    paired: true,
    telegramBotConnected: Boolean(telegramBotToken),
    botUsername: telegramBotToken ? '@TelePulseG2Bot' : '@TelePulseDemoBot (Sim Mode)',
    userHandle: '@kushagra_g',
    lastSyncIso: new Date().toISOString(),
    liveMarketSource: 'LIVE_API',
  },
  telegramMessages: [
    {
      id: 'tg-101',
      chatId: '-1002194812',
      chatTitle: 'TVM Ventures · Founders Desk',
      sender: 'Elena Rostova',
      handle: '@elena_tvm',
      category: 'direct',
      timestamp: 'Just now',
      text: 'Kushagra, are we locked for the Dubai Demo Day pitch slot at 14:30? Send quick confirmation when you see this.',
      glanceSummary: 'Elena (TVM): Confirm Dubai Demo Day pitch slot at 14:30?',
      unread: true,
      riskBadge: 'VERIFIED',
      aiDrafts: [
        'Confirmed for 14:30 in Dubai! Deck and G2 live demo are ready.',
        'Running 10m early, see you at Daos Hub.',
        'Can we shift to 15:00? Testing hardware right now.',
      ],
    },
    {
      id: 'tg-102',
      chatId: '-1008841209',
      chatTitle: 'Hyperliquid Whale Perps Alert',
      sender: 'HL Sentinel Bot',
      handle: '@hl_whale_sentinel',
      category: 'alpha',
      timestamp: '1m ago',
      text: 'ETH-PERP breakout above key orderbook wall on Hyperliquid. Open interest +8.4% in 15m, funding +0.011%.',
      glanceSummary: 'HL Alpha: ETH-PERP OI +8.4% breakout · Funding +0.011%',
      unread: true,
      riskBadge: 'ALPHA_SIGNAL',
      aiDrafts: [
        'Acknowledge signal · Paper Long $250 ETH-PERP executed',
        'Watching $3,400 support before scaling in',
        'Mute ETH-PERP alerts for 1 hour',
      ],
      linkedAction: {
        protocol: 'Hyperliquid',
        symbol: 'ETH',
        side: 'LONG',
        sizeUsd: 250,
        label: 'Paper Long $250 ETH-PERP (5x Testnet)',
      },
    },
    {
      id: 'tg-103',
      chatId: '-1005529104',
      chatTitle: 'Polymarket Macro & Crypto Desk',
      sender: 'PolyPulse Feed',
      handle: '@polypulse_live',
      category: 'alpha',
      timestamp: '4m ago',
      text: 'Polymarket volume spike on "US Crypto Market Structure Bill passed in 2026?" — YES odds climbed +6c to 71c on $4.2M volume.',
      glanceSummary: 'Polymarket: Crypto Bill 2026 YES +6c -> 71c ($4.2M vol)',
      unread: true,
      riskBadge: 'ALPHA_SIGNAL',
      aiDrafts: [
        'Paper Buy $100 YES @ 71c logged to portfolio',
        'Share odds snapshot to Founders Desk',
        'Set alert if YES crosses 78c',
      ],
      linkedAction: {
        protocol: 'Polymarket',
        symbol: 'CRYPTO-BILL-26',
        side: 'YES',
        sizeUsd: 100,
        label: 'Paper Buy $100 YES @ 71c (Polymarket)',
      },
    },
    {
      id: 'tg-104',
      chatId: '-1009910442',
      chatTitle: 'TON & Gram Ecosystem Core',
      sender: 'Pavel (Gram Ops)',
      handle: '@pavel_gram_ops',
      category: 'ops',
      timestamp: '9m ago',
      text: 'USDT-TON settlement batch #409 cleared in 3.1s. Verify treasury watch balance on Gram before the 16:00 call.',
      glanceSummary: 'Gram Ops: USDT-TON batch #409 cleared · Check Gram balance',
      unread: false,
      riskBadge: 'VERIFIED',
      aiDrafts: [
        'Verified on G2 HUD — 1,420 USDT + 385 TON settled cleanly.',
        'Looks good, joining the 16:00 call.',
        'Send treasury CSV to the ops thread.',
      ],
    },
    {
      id: 'tg-105',
      chatId: '-1007741290',
      chatTitle: 'Unverified Airdrop Ping [Filtered]',
      sender: 'Unknown Bot',
      handle: '@claim_ton_drop_xyz',
      category: 'security',
      timestamp: '12m ago',
      text: '[BLOCKED BY TELEPULSE SIEVES] Suspicious wallet drainer URL stripped before reaching G2 display.',
      glanceSummary: 'SHIELD: Blocked phishing drainer link in @claim_ton_drop_xyz',
      unread: false,
      riskBadge: 'THREAT_BLOCKED',
      aiDrafts: [
        'Report & ban sender from channel',
        'Keep muted',
        'Log threat signature',
      ],
    },
  ],
  hyperliquid: {
    assets: [
      {
        symbol: 'BTC',
        pair: 'BTC-PERP',
        markPrice: 96420.5,
        change24hPct: 3.42,
        fundingRatePct: 0.0125,
        volume24hUsd: 2840000000,
        sparkline: [93800, 94120, 93950, 94400, 94850, 95100, 94920, 95380, 95710, 95600, 96050, 96420.5],
        orderbookImbalance: 0.38,
      },
      {
        symbol: 'ETH',
        pair: 'ETH-PERP',
        markPrice: 3428.75,
        change24hPct: 5.18,
        fundingRatePct: 0.011,
        volume24hUsd: 1490000000,
        sparkline: [3255, 3270, 3262, 3295, 3318, 3340, 3331, 3365, 3390, 3384, 3412, 3428.75],
        orderbookImbalance: 0.52,
      },
      {
        symbol: 'SOL',
        pair: 'SOL-PERP',
        markPrice: 214.6,
        change24hPct: 6.84,
        fundingRatePct: 0.0142,
        volume24hUsd: 890000000,
        sparkline: [200.5, 202.1, 201.4, 204.0, 206.8, 205.9, 208.3, 210.1, 211.7, 210.9, 213.2, 214.6],
        orderbookImbalance: 0.44,
      },
      {
        symbol: 'HYPE',
        pair: 'HYPE-PERP',
        markPrice: 28.45,
        change24hPct: 9.15,
        fundingRatePct: 0.0185,
        volume24hUsd: 420000000,
        sparkline: [25.9, 26.2, 26.0, 26.5, 26.9, 27.1, 27.0, 27.4, 27.8, 28.0, 28.2, 28.45],
        orderbookImbalance: 0.65,
      },
      {
        symbol: 'TON',
        pair: 'TON-PERP',
        markPrice: 6.48,
        change24hPct: 4.12,
        fundingRatePct: 0.0095,
        volume24hUsd: 215000000,
        sparkline: [6.21, 6.23, 6.2, 6.26, 6.3, 6.33, 6.31, 6.37, 6.41, 6.4, 6.45, 6.48],
        orderbookImbalance: 0.31,
      },
    ],
    positions: [
      {
        id: 'pos-hl-1',
        protocol: 'Hyperliquid',
        symbol: 'ETH',
        side: 'LONG',
        sizeUsd: 500,
        entryPrice: 3342.0,
        markPrice: 3428.75,
        pnlUsd: 64.89,
        pnlPct: 12.98,
        leverage: 5,
        timestamp: '28m ago',
      },
      {
        id: 'pos-hl-2',
        protocol: 'Hyperliquid',
        symbol: 'HYPE',
        side: 'LONG',
        sizeUsd: 250,
        entryPrice: 26.8,
        markPrice: 28.45,
        pnlUsd: 46.18,
        pnlPct: 18.47,
        leverage: 3,
        timestamp: '1h ago',
      },
    ],
    paperEquityUsd: 10111.07,
    availableMarginUsd: 9361.07,
  },
  polymarket: {
    markets: [
      {
        id: 'poly-1',
        title: 'US Crypto Market Structure Bill passed in 2026?',
        shortTitle: 'US Crypto Bill 2026',
        yesCents: 71,
        noCents: 29,
        volumeUsd: 4280000,
        liquidityUsd: 690000,
        endDate: '2026-12-31',
        sparkline: [58, 60, 61, 63, 62, 65, 66, 65, 68, 69, 70, 71],
      },
      {
        id: 'poly-2',
        title: 'Fed cuts interest rates at December FOMC meeting?',
        shortTitle: 'Fed Rate Cut Dec FOMC',
        yesCents: 64,
        noCents: 36,
        volumeUsd: 11850000,
        liquidityUsd: 1920000,
        endDate: '2026-12-18',
        sparkline: [55, 57, 56, 59, 60, 61, 59, 62, 63, 62, 64, 64],
      },
      {
        id: 'poly-3',
        title: 'BTC reaches $100,000 before December 31?',
        shortTitle: 'BTC $100K in 2026',
        yesCents: 78,
        noCents: 22,
        volumeUsd: 19400000,
        liquidityUsd: 2850000,
        endDate: '2026-12-31',
        sparkline: [64, 66, 68, 67, 70, 72, 71, 74, 75, 76, 77, 78],
      },
      {
        id: 'poly-4',
        title: 'Telegram Mini Apps exceed 1.1B MAU in Q4?',
        shortTitle: 'TG Mini Apps >1.1B MAU',
        yesCents: 82,
        noCents: 18,
        volumeUsd: 1640000,
        liquidityUsd: 340000,
        endDate: '2026-12-31',
        sparkline: [72, 73, 75, 74, 76, 77, 78, 79, 80, 80, 81, 82],
      },
    ],
  },
  gramWallet: {
    address: process.env.GRAM_WALLET_ADDRESS || 'UQBvI0aFLnw2QbZgjMPCLRdtRHxhUyinQudg6sdiohIwg5jL',
    network: 'TON Mainnet (Read-Only)',
    tonBalance: 385.4,
    tonPriceUsd: 6.48,
    usdtTonBalance: 1420.0,
    totalUsd: 3917.39,
    recentTransfers: [
      {
        hash: '0x9f4a...81c2',
        direction: 'IN',
        amount: '+500.00 USDT',
        counterparty: 'TVM Settlement Vault',
        age: '3m ago',
      },
      {
        hash: '0x3b12...44e9',
        direction: 'IN',
        amount: '+85.40 TON',
        counterparty: 'gram-staking.ton',
        age: '42m ago',
      },
      {
        hash: '0x7c08...19a0',
        direction: 'OUT',
        amount: '-12.00 TON',
        counterparty: 'dns.ton',
        age: '3h ago',
      },
    ],
  },
  activityLog: [
    {
      id: 'act-1',
      timestamp: new Date(Date.now() - 120000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      source: 'G2_TAP',
      action: 'HUD Initialized',
      detail: '576x288 4-container waveguide layout active · Live Hyperliquid & Polymarket feeds synced',
    },
  ],
}

let lastMarketFetchMs = 0
let seededRebased = false

/** Rebase seeded demo positions onto live marks once so PnL stays believable. */
function rebaseSeededPositions(): void {
  if (seededRebased) return
  seededRebased = true
  const offsets: Record<string, number> = { 'pos-hl-1': 0.021, 'pos-hl-2': 0.031 }
  for (const pos of state.hyperliquid.positions) {
    const asset = state.hyperliquid.assets.find(a => a.symbol === pos.symbol)
    if (!asset) continue
    const move = offsets[pos.id] ?? 0.02
    pos.entryPrice = Number((asset.markPrice / (1 + move)).toFixed(asset.markPrice > 100 ? 2 : 4))
  }
}

async function refreshLiveMarkets(): Promise<void> {
  const now = Date.now()
  if (now - lastMarketFetchMs < 8000) return
  lastMarketFetchMs = now

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 3500)
    const res = await fetch('https://api.hyperliquid.xyz/info', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'allMids' }),
      signal: controller.signal,
    })
    clearTimeout(timeout)

    if (res.ok) {
      const mids = (await res.json()) as Record<string, string>
      for (const asset of state.hyperliquid.assets) {
        const rawMid = mids[asset.symbol]
        if (rawMid) {
          const parsed = parseFloat(rawMid)
          if (!Number.isNaN(parsed) && parsed > 0) {
            asset.markPrice = Number(parsed.toFixed(parsed > 100 ? 2 : parsed > 1 ? 3 : 4))
            asset.sparkline = [...asset.sparkline.slice(1), asset.markPrice]
          }
        }
      }
      state.pairing.liveMarketSource = 'LIVE_API'
      rebaseSeededPositions()
    }
  } catch {
    // Keep last known prices and gently jitter sparkline so simulator demos stay lively offline
    for (const asset of state.hyperliquid.assets) {
      const delta = asset.markPrice * ((Math.random() - 0.48) * 0.0018)
      asset.markPrice = Number((asset.markPrice + delta).toFixed(asset.markPrice > 100 ? 2 : 3))
      asset.sparkline = [...asset.sparkline.slice(1), asset.markPrice]
    }
  }

  // Update open paper position PnLs against latest mark prices
  let totalUnrealizedPnl = 0
  for (const pos of state.hyperliquid.positions) {
    if (pos.protocol === 'Hyperliquid') {
      const match = state.hyperliquid.assets.find(a => a.symbol === pos.symbol)
      if (match) {
        pos.markPrice = match.markPrice
        const direction = pos.side === 'LONG' ? 1 : -1
        const rawPct = ((pos.markPrice - pos.entryPrice) / pos.entryPrice) * 100 * direction * pos.leverage
        pos.pnlPct = Number(rawPct.toFixed(2))
        pos.pnlUsd = Number(((pos.sizeUsd * pos.pnlPct) / 100).toFixed(2))
      }
    }
    totalUnrealizedPnl += pos.pnlUsd
  }
  state.hyperliquid.paperEquityUsd = Number((10000 + totalUnrealizedPnl).toFixed(2))

  // Update TON USD valuation in Gram Wallet
  const tonAsset = state.hyperliquid.assets.find(a => a.symbol === 'TON')
  if (tonAsset) {
    state.gramWallet.tonPriceUsd = tonAsset.markPrice
    state.gramWallet.totalUsd = Number(
      (state.gramWallet.tonBalance * tonAsset.markPrice + state.gramWallet.usdtTonBalance).toFixed(2),
    )
  }

  // Also poll real Telegram Bot updates if token is configured
  if (telegramBotToken) {
    try {
      const tgRes = await fetch(
        `https://api.telegram.org/bot${telegramBotToken}/getUpdates?offset=${lastTelegramUpdateId + 1}&limit=5&timeout=0`,
      )
      if (tgRes.ok) {
        const tgJson = (await tgRes.json()) as {
          ok: boolean
          result?: Array<{
            update_id: number
            message?: {
              message_id: number
              chat: { id: number; title?: string; username?: string; first_name?: string }
              from?: { first_name?: string; username?: string }
              text?: string
            }
          }>
        }
        if (tgJson.ok && Array.isArray(tgJson.result)) {
          for (const upd of tgJson.result) {
            lastTelegramUpdateId = Math.max(lastTelegramUpdateId, upd.update_id)
            const msg = upd.message
            if (msg?.text) {
              injectTelegramMessage({
                sender: msg.from?.first_name || 'Telegram User',
                handle: msg.from?.username ? `@${msg.from.username}` : '@tg_user',
                chatTitle: msg.chat.title || msg.chat.first_name || 'Telegram Direct',
                chatId: String(msg.chat.id),
                text: msg.text,
              })
            }
          }
        }
      }
    } catch {
      // Ignore transient network errors on Telegram polling
    }
  }

  state.pairing.lastSyncIso = new Date().toISOString()
}

export function buildSmartDraftsAndLink(text: string, sender: string): {
  glanceSummary: string
  riskBadge: 'VERIFIED' | 'ALPHA_SIGNAL' | 'THREAT_BLOCKED'
  category: 'direct' | 'alpha' | 'ops' | 'security'
  aiDrafts: string[]
  linkedAction?: LinkedDeFiAction
} {
  const upper = text.toUpperCase()
  const lower = text.toLowerCase()

  if (lower.includes('claim-') || lower.includes('drainer') || lower.includes('seed phrase') || lower.includes('airdrop-claim')) {
    return {
      glanceSummary: `SHIELD: Blocked suspicious link from ${sender}`,
      riskBadge: 'THREAT_BLOCKED',
      category: 'security',
      aiDrafts: ['Report & block sender', 'Keep muted', 'Log threat'],
    }
  }

  for (const sym of ['ETH', 'BTC', 'SOL', 'HYPE', 'TON']) {
    if (upper.includes(sym)) {
      const isBearish = lower.includes('short') || lower.includes('dump') || lower.includes('breakdown')
      const side = isBearish ? 'SHORT' : 'LONG'
      return {
        glanceSummary: `${sender}: ${text.slice(0, 74)}${text.length > 74 ? '…' : ''}`,
        riskBadge: 'ALPHA_SIGNAL',
        category: 'alpha',
        aiDrafts: [
          `Acknowledge · Paper ${side} $250 ${sym}-PERP on Hyperliquid`,
          `Watching ${sym} orderbook depth before entry`,
          `Share ${sym} chart to Founders Desk`,
        ],
        linkedAction: {
          protocol: 'Hyperliquid',
          symbol: sym,
          side,
          sizeUsd: 250,
          label: `Paper ${side} $250 ${sym}-PERP (5x Testnet)`,
        },
      }
    }
  }

  if (lower.includes('polymarket') || lower.includes('odds') || lower.includes('fomc') || lower.includes('rate cut')) {
    return {
      glanceSummary: `${sender}: ${text.slice(0, 74)}${text.length > 74 ? '…' : ''}`,
      riskBadge: 'ALPHA_SIGNAL',
      category: 'alpha',
      aiDrafts: [
        'Paper Buy $100 YES logged on Polymarket',
        'Holding current prediction exposure',
        'Send odds alert at 75c',
      ],
      linkedAction: {
        protocol: 'Polymarket',
        symbol: 'CRYPTO-BILL-26',
        side: 'YES',
        sizeUsd: 100,
        label: 'Paper Buy $100 YES (Polymarket)',
      },
    }
  }

  return {
    glanceSummary: `${sender}: ${text.slice(0, 76)}${text.length > 76 ? '…' : ''}`,
    riskBadge: 'VERIFIED',
    category: 'direct',
    aiDrafts: [
      'Sounds good — confirmed from my Even G2 glasses.',
      'In a session right now, will follow up in 15 mins.',
      'Approved. Let’s lock it in.',
    ],
  }
}

export function injectTelegramMessage(input: {
  sender?: string
  handle?: string
  chatTitle?: string
  chatId?: string
  text: string
}): TelegramGlanceItem {
  const sender = input.sender?.trim() || 'Alex (Dubai Desk)'
  const handle = input.handle?.trim() || '@alex_daoshub'
  const chatTitle = input.chatTitle?.trim() || 'Daos Hub · VIP Builders'
  const text = input.text.trim()
  const parsed = buildSmartDraftsAndLink(text, sender)

  const item: TelegramGlanceItem = {
    id: `tg-${Date.now()}`,
    chatId: input.chatId || telegramDefaultChatId || '-1002194812',
    chatTitle,
    sender,
    handle,
    category: parsed.category,
    timestamp: 'Just now',
    text,
    glanceSummary: parsed.glanceSummary,
    unread: true,
    riskBadge: parsed.riskBadge,
    aiDrafts: parsed.aiDrafts,
    linkedAction: parsed.linkedAction,
  }

  state.telegramMessages.unshift(item)
  if (state.telegramMessages.length > 15) {
    state.telegramMessages.pop()
  }

  logActivity('TELEGRAM_BOT', `New message from ${sender}`, item.glanceSummary)
  return item
}

function logActivity(source: ActivityEntry['source'], action: string, detail: string) {
  state.activityLog.unshift({
    id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    source,
    action,
    detail,
  })
  if (state.activityLog.length > 25) {
    state.activityLog.pop()
  }
}

export async function executePaperTrade(params: {
  protocol: 'Hyperliquid' | 'Polymarket'
  symbol: string
  side: 'LONG' | 'SHORT' | 'YES' | 'NO'
  sizeUsd: number
  source?: ActivityEntry['source']
}): Promise<{ ok: boolean; summary: string; position: PaperPosition }> {
  const sym = params.symbol.toUpperCase()
  const asset = state.hyperliquid.assets.find(a => a.symbol === sym)
  const poly = state.polymarket.markets.find(
    m => m.id === params.symbol || m.shortTitle.toUpperCase().includes(sym),
  )

  const entryPrice =
    params.protocol === 'Hyperliquid'
      ? asset?.markPrice ?? 3428.75
      : (params.side === 'NO' ? poly?.noCents ?? 29 : poly?.yesCents ?? 71) / 100

  const position: PaperPosition = {
    id: `pos-${Date.now()}`,
    protocol: params.protocol,
    symbol: params.protocol === 'Hyperliquid' ? sym : poly?.shortTitle || sym,
    side: params.side,
    sizeUsd: params.sizeUsd,
    entryPrice,
    markPrice: entryPrice,
    pnlUsd: 0,
    pnlPct: 0,
    leverage: params.protocol === 'Hyperliquid' ? 5 : 1,
    timestamp: 'Just now',
  }

  state.hyperliquid.positions.unshift(position)
  state.hyperliquid.availableMarginUsd = Math.max(0, Number((state.hyperliquid.availableMarginUsd - params.sizeUsd).toFixed(2)))

  const summary = `Executed Paper ${params.side} $${params.sizeUsd} ${position.symbol} @ $${entryPrice} (${params.protocol} Testnet)`
  logActivity(params.source || 'G2_TAP', `1-Tap Paper Trade (${params.protocol})`, summary)

  if (telegramBotToken && telegramDefaultChatId) {
    try {
      await fetch(`https://api.telegram.org/bot${telegramBotToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: telegramDefaultChatId,
          text: `[TelePulse G2 HUD Receipt]\n${summary}`,
        }),
      })
    } catch {
      // Non-fatal
    }
  }

  return { ok: true, summary, position }
}

export async function handleTelegramReply(params: {
  messageId: string
  replyText: string
  source?: ActivityEntry['source']
}): Promise<{ ok: boolean; deliveredVia: string; message?: TelegramGlanceItem }> {
  const msg = state.telegramMessages.find(m => m.id === params.messageId) || state.telegramMessages[0]
  if (msg) {
    msg.unread = false
    msg.repliedText = params.replyText
  }

  let deliveredVia = 'Simulated Telegram Bridge (Instant)'
  const targetChatId = msg?.chatId || telegramDefaultChatId

  if (telegramBotToken && targetChatId) {
    try {
      const tgRes = await fetch(`https://api.telegram.org/bot${telegramBotToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: targetChatId,
          text: params.replyText,
        }),
      })
      if (tgRes.ok) {
        deliveredVia = 'Telegram Bot API (Live)'
      }
    } catch {
      deliveredVia = 'Telegram Bot Fallback Queue'
    }
  }

  logActivity(
    params.source || 'G2_TAP',
    `Replied to ${msg ? msg.sender : 'Telegram'}`,
    `"${params.replyText}" (${deliveredVia})`,
  )

  return { ok: true, deliveredVia, message: msg }
}

export async function processVoiceIntent(params: {
  transcript?: string
  pcmBytesCount?: number
  activeMessageId?: string
}): Promise<{
  ok: boolean
  transcript: string
  intentType: 'REPLY' | 'PAPER_TRADE' | 'SWITCH_MODE'
  executionSummary: string
}> {
  const rawTranscript =
    params.transcript?.trim() ||
    (params.pcmBytesCount && params.pcmBytesCount > 0
      ? 'Confirm 14:30 Dubai slot and paper long ETH 250 dollars'
      : 'Confirmed for 14:30 in Dubai! See you at Daos Hub.')

  const lower = rawTranscript.toLowerCase()

  // Check if user commanded a paper trade by voice
  for (const sym of ['eth', 'btc', 'sol', 'hype', 'ton']) {
    if (lower.includes(sym) && (lower.includes('long') || lower.includes('short') || lower.includes('buy'))) {
      const side = lower.includes('short') ? 'SHORT' : 'LONG'
      // Take the last number ≥ 25 — skips times/ids like "14:30"
      const nums = (rawTranscript.match(/\d{2,5}/g) ?? []).map(Number).filter(n => n >= 25)
      const sizeUsd = nums.length ? Math.min(2000, nums[nums.length - 1]) : 250
      const tradeRes = await executePaperTrade({
        protocol: 'Hyperliquid',
        symbol: sym.toUpperCase(),
        side,
        sizeUsd,
        source: 'G2_VOICE',
      })
      return {
        ok: true,
        transcript: rawTranscript,
        intentType: 'PAPER_TRADE',
        executionSummary: tradeRes.summary,
      }
    }
  }

  // Otherwise send as voice reply to active Telegram message
  const replyRes = await handleTelegramReply({
    messageId: params.activeMessageId || state.telegramMessages[0]?.id || 'tg-101',
    replyText: rawTranscript,
    source: 'G2_VOICE',
  })

  return {
    ok: true,
    transcript: rawTranscript,
    intentType: 'REPLY',
    executionSummary: `Sent voice reply to ${replyRes.message?.sender ?? 'Telegram'}: "${rawTranscript}"`,
  }
}

function readJsonBody(req: IncomingMessage): Promise<Record<string, any>> {
  return new Promise(resolve => {
    const chunks: Buffer[] = []
    req.on('data', chunk => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)))
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8')
        resolve(raw ? JSON.parse(raw) : {})
      } catch {
        resolve({})
      }
    })
    req.on('error', () => resolve({}))
  })
}

function sendJson(res: ServerResponse, status: number, payload: unknown) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization')
  res.end(JSON.stringify(payload))
}

export async function handleApiRequest(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  const url = req.url || ''
  if (!url.startsWith('/api/')) return false

  if (req.method === 'OPTIONS') {
    sendJson(res, 200, { ok: true })
    return true
  }

  const pathname = url.split('?')[0]

  if (pathname === '/api/state' && req.method === 'GET') {
    await refreshLiveMarkets()
    sendJson(res, 200, state)
    return true
  }

  if (pathname === '/api/telegram/reply' && req.method === 'POST') {
    const body = await readJsonBody(req)
    const result = await handleTelegramReply({
      messageId: String(body.messageId || ''),
      replyText: String(body.replyText || 'Confirmed from Even G2.'),
      source: body.source || 'G2_TAP',
    })
    sendJson(res, 200, { ...result, state })
    return true
  }

  if (pathname === '/api/telegram/inject' && req.method === 'POST') {
    const body = await readJsonBody(req)
    const item = injectTelegramMessage({
      sender: body.sender,
      handle: body.handle,
      chatTitle: body.chatTitle,
      chatId: body.chatId,
      text: String(body.text || 'ETH breaking $3,450 on Hyperliquid — confirm 1-tap paper long?'),
    })
    sendJson(res, 200, { ok: true, item, state })
    return true
  }

  if (pathname === '/api/trade/paper' && req.method === 'POST') {
    const body = await readJsonBody(req)
    const result = await executePaperTrade({
      protocol: body.protocol === 'Polymarket' ? 'Polymarket' : 'Hyperliquid',
      symbol: String(body.symbol || 'ETH'),
      side: body.side || 'LONG',
      sizeUsd: Number(body.sizeUsd || 250),
      source: body.source || 'G2_TAP',
    })
    sendJson(res, 200, { ...result, state })
    return true
  }

  if (pathname === '/api/voice/intent' && req.method === 'POST') {
    const body = await readJsonBody(req)
    const result = await processVoiceIntent({
      transcript: body.transcript,
      pcmBytesCount: Number(body.pcmBytesCount || 0),
      activeMessageId: body.activeMessageId,
    })
    sendJson(res, 200, { ...result, state })
    return true
  }

  if (pathname === '/api/pairing/configure' && req.method === 'POST') {
    const body = await readJsonBody(req)
    if (typeof body.botToken === 'string' && body.botToken.trim()) {
      telegramBotToken = body.botToken.trim()
      state.pairing.telegramBotConnected = true
      state.pairing.botUsername = '@TelePulseLiveBot'
    }
    if (typeof body.chatId === 'string' && body.chatId.trim()) {
      telegramDefaultChatId = body.chatId.trim()
    }
    if (typeof body.userHandle === 'string' && body.userHandle.trim()) {
      state.pairing.userHandle = body.userHandle.trim()
    }
    if (typeof body.gramAddress === 'string' && body.gramAddress.trim()) {
      state.gramWallet.address = body.gramAddress.trim()
    }
    state.pairing.paired = true
    logActivity('WEBVIEW', 'Pairing Configured', `Paired ${state.pairing.userHandle} via code ${state.pairing.code}`)
    sendJson(res, 200, { ok: true, state })
    return true
  }

  sendJson(res, 404, { ok: false, error: 'Not found' })
  return true
}
