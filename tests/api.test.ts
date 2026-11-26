import { describe, it, expect } from 'vitest'
import {
  buildSmartDraftsAndLink,
  injectTelegramMessage,
  executePaperTrade,
  processVoiceIntent,
  handleTelegramReply,
} from '../server/api'

describe('buildSmartDraftsAndLink — signal sieve', () => {
  it('links an ETH alpha message to a Hyperliquid LONG paper action', () => {
    const r = buildSmartDraftsAndLink('ETH-PERP breakout above orderbook wall, OI +8%', 'HL Bot')
    expect(r.riskBadge).toBe('ALPHA_SIGNAL')
    expect(r.category).toBe('alpha')
    expect(r.linkedAction?.protocol).toBe('Hyperliquid')
    expect(r.linkedAction?.symbol).toBe('ETH')
    expect(r.linkedAction?.side).toBe('LONG')
    expect(r.aiDrafts[0]).toContain('ETH')
  })

  it('flags bearish language as a SHORT action', () => {
    const r = buildSmartDraftsAndLink('BTC dump incoming, breakdown below support — short it', 'Desk')
    expect(r.linkedAction?.side).toBe('SHORT')
    expect(r.linkedAction?.symbol).toBe('BTC')
  })

  it('blocks drainer/phishing patterns before display', () => {
    const r = buildSmartDraftsAndLink('claim_ton_drop now — connect wallet at drainer.io', 'Scam Bot')
    expect(r.riskBadge).toBe('THREAT_BLOCKED')
    expect(r.category).toBe('security')
    expect(r.linkedAction).toBeUndefined()
  })

  it('routes prediction-market chatter to Polymarket', () => {
    const r = buildSmartDraftsAndLink('polymarket odds on rate cut spiking +6c', 'PolyFeed')
    expect(r.linkedAction?.protocol).toBe('Polymarket')
    expect(r.linkedAction?.side).toBe('YES')
  })

  it('treats plain direct messages as verified replies', () => {
    const r = buildSmartDraftsAndLink('are we locked for the 14:30 slot?', 'Elena')
    expect(r.riskBadge).toBe('VERIFIED')
    expect(r.linkedAction).toBeUndefined()
    expect(r.aiDrafts.length).toBe(3)
  })
})

describe('executePaperTrade — testnet-only engine', () => {
  it('opens a Hyperliquid paper position at live mark', async () => {
    const r = await executePaperTrade({ protocol: 'Hyperliquid', symbol: 'SOL', side: 'LONG', sizeUsd: 250 })
    expect(r.ok).toBe(true)
    expect(r.position.entryPrice).toBeGreaterThan(0)
    expect(r.summary).toContain('SOL')
    expect(r.summary).toContain('250')
  })

  it('opens a Polymarket YES position priced in cents', async () => {
    const r = await executePaperTrade({ protocol: 'Polymarket', symbol: 'poly-1', side: 'YES', sizeUsd: 100 })
    expect(r.ok).toBe(true)
    expect(r.position.entryPrice).toBeGreaterThan(0)
    expect(r.position.entryPrice).toBeLessThanOrEqual(1)
  })
})

describe('handleTelegramReply', () => {
  it('marks the message replied and records activity', async () => {
    const msg = injectTelegramMessage({ text: 'quick check-in for test' })
    const r = await handleTelegramReply({ messageId: msg.id, replyText: 'Confirmed from G2' })
    expect(r.ok).toBe(true)
    expect(r.message?.repliedText).toBe('Confirmed from G2')
    expect(r.message?.unread).toBe(false)
  })
})

describe('processVoiceIntent', () => {
  it('parses a paper-trade voice command', async () => {
    const r = await processVoiceIntent({ transcript: 'paper long eth 250 dollars' })
    expect(r.intentType).toBe('PAPER_TRADE')
    expect(r.executionSummary).toContain('ETH')
  })

  it('parses a short-side voice command', async () => {
    const r = await processVoiceIntent({ transcript: 'short BTC 500' })
    expect(r.intentType).toBe('PAPER_TRADE')
    expect(r.executionSummary).toContain('SHORT')
  })

  it('falls back to a Telegram reply for plain speech', async () => {
    const r = await processVoiceIntent({ transcript: 'confirmed, see you at Daos Hub' })
    expect(r.intentType).toBe('REPLY')
    expect(r.executionSummary).toContain('voice reply')
  })
})
