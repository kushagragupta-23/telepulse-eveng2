# DoraHacks "Create a new Build" — paste-ready fields

**Name of your Build:**
```
TelePulse HUD
```

**Brief description:**
```
Read Telegram. Write back. Trade the signal — all without touching your phone. A heads-up Telegram sentinel, AI voice responder and testnet DeFi terminal for Even Realities G2.
```

**Tags (suggestions):**
```
smart-glasses, telegram, even-realities, hyperliquid, polymarket, defi, ai, typescript
```

**GitHub Repo link:**
```
https://github.com/kushagragupta-23/telepulse-eveng2
```

**Video link:** upload `docs/telepulse-demo.mp4` (1:26, narrated) or use the direct file:
```
https://github.com/kushagragupta-23/telepulse-eveng2/raw/main/docs/telepulse-demo.mp4
```

**Description (markdown — paste into the editor):**

```markdown
## The problem

We all live on Telegram — alpha groups, founder chats, trading bots. But every ping fights for your phone, half of them are scams, and the actionable ones die waiting for you to unlock a screen.

## How it works

TelePulse HUD moves that whole loop into Even G2. A whale alert lands on Telegram → the HUD shows one glance card → you tap once → the linked trade executes on Hyperliquid testnet → the receipt lands back in the same thread. Three seconds, phone never leaves your pocket.

- **Swipe** through the glance queue — Telegram cards, markets, positions
- **Tap** = smart action: send the AI-drafted reply, or execute the signal's linked paper trade
- **R1 ring** cycles reply drafts; **long-press** is push-to-talk voice ("paper long SOL, 250" → parsed → executed)
- **Contextual menu** switches desks: Telegram · HL Perps · Polymarket · Gram Wallet · Activity

## Key features

- Sieve + summarize: Telegram messages become 3-second glance cards; drainer/phishing URLs are blocked before they reach the lens
- Signal → trade linking: messages mentioning tickers get a linked paper-trade action (Hyperliquid testnet / Polymarket paper)
- Voice read-and-write: raw PCM from the G2 mic → intent parser → reply or execute
- Live integrations: real `allMids` marks, real Polymarket odds, real Telegram Bot bridge; Gram Wallet read-only
- Works glasses-free: the browser adapter renders the actual container objects and synthesizes real OS events — full demo without hardware

## Tech stack

TypeScript + Vite · @evenrealities/even_hub_sdk 0.0.16 (containers, zOrder, textColor hierarchy, contextual menu, PCM audio, serialized image pipeline) · Node backend proxy (secrets never ship in the .ehpk) · Hyperliquid `info` API · Polymarket Gamma · Telegram Bot API · Vitest (11 tests)

## Tracks & requirements

- Track 01 — Messaging & News (Telegram Bot API)
- Track 02 — Crypto & DeFi (Hyperliquid · Polymarket · Gram Wallet)
- Entered for Best Telegram integration + Grand Prize
- Paper/testnet/read-only only — no user funds, no financial advice
- Public repo: https://github.com/kushagragupta-23/telepulse-eveng2
- Demo video (1:26, narrated): docs/telepulse-demo.mp4
- 5 API feature requests included in the README
```

**Contact Info:** your DoraHacks-visible contact (organizers only).
