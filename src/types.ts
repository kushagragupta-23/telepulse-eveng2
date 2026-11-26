// ---------------------------------------------------------------------------
// TelePulse HUD — shared type mirrors for the WebView companion + engine state.
// Server owns authoritative shape in server/api.ts; these are compile-time only.
// ---------------------------------------------------------------------------

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
  orderbookImbalance: number
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
  network: string
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

export type HudMode =
  | 'TELEGRAM'
  | 'HYPERLIQUID'
  | 'POLYMARKET'
  | 'GRAM_WALLET'
  | 'ACTIVITY'

export interface VoiceIntentResult {
  ok: boolean
  transcript: string
  intentType: 'REPLY' | 'PAPER_TRADE' | 'SWITCH_MODE'
  executionSummary: string
}

/** Minimal bridge surface the HUD engine depends on (SDK or browser adapter). */
export interface BridgeLike {
  createStartUpPageContainer(container: unknown): Promise<number>
  rebuildPageContainer(container: unknown): Promise<boolean>
  textContainerUpgrade(container: {
    containerID: number
    containerName: string
    content?: string
    textColor?: number
  }): Promise<boolean>
  updateImageRawData(data: {
    containerID: number
    containerName: string
    imageData: number[] | Uint8Array | string | ArrayBuffer
  }): Promise<string>
  audioControl(isOpen: boolean, source?: unknown): Promise<boolean>
  shutDownPageContainer(exitMode?: number): Promise<boolean>
  onEvenHubEvent(callback: (event: {
    textEvent?: { containerID?: number; eventType?: number }
    listEvent?: { containerID?: number; eventType?: number; currentSelectItemIndex?: number }
    sysEvent?: { eventType?: number; eventSource?: number }
    audioEvent?: { audioPcm?: Uint8Array; source?: unknown }
    menuItemClickEvent?: { itemID?: number }
  }) => void): () => void
  setLocalStorage(key: string, value: string): Promise<boolean>
  getLocalStorage(key: string): Promise<string>
}
