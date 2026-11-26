# TelePulse HUD

**Heads-Up Telegram Sentinel, AI Voice Responder & Testnet DeFi Terminal for Even Realities G2 smart glasses.**

Track 01 — **Messaging & News** (Telegram, live Bot API)
Track 02 — **Crypto & DeFi** (Hyperliquid · Polymarket · Gram Wallet)
Also entered for **Best Telegram integration** and the Grand Prize.

Built by **Kushagra Gupta** — Heads Up: Even Realities Hackathon (Nov 23–29, 2026).

---

## The problem it solves

Crypto-native founders and operators live on Telegram alpha channels, signal
groups and founder DMs — but every raw notification is noise, and signal chats
are full of drainer links. Meanwhile the *actionable* part of those messages
(odds moves, perp breakouts, quick confirmations) dies on the phone screen.

**TelePulse HUD** is a read-and-write ambient layer on G2:

1. **Glance** — one thing that matters: a sieved Telegram card, a Polymarket
   odds move, or your paper PnL. 576×288 monochrome, one glance card at a time.
2. **Write in seconds** — tap to send an AI-drafted reply or execute the
   signal's linked **testnet** trade; long-press to dictate a voice command;
   R1 ring cycles reply drafts. No phone, no dashboard.

## Read & write on G2 (the demo loop)

| Gesture | Action |
|---|---|
| Swipe ▲▼ | Move through the glance queue / desks |
| **Tap** | Smart action — send drafted Telegram reply *or* execute the linked paper trade (Hyperliquid testnet / Polymarket paper) |
| **R1 ring tap** | Cycle AI reply drafts (hands stay on the wheel) |
| **Long-press → release** | Push-to-talk voice: *"paper long ETH 250"* → parsed → executed; or a plain sentence → sent as a Telegram reply |
| **Contextual menu** (OS) | Switch desks: Telegram · HL Perps · Polymarket · Gram Wallet · Activity · Refresh |
| **Double-tap** | System exit-confirmation dialog (required `shutDownPageContainer(1)` QA path) |

## Architecture

```
G2 glasses  ◄─BLE─►  Even App WebView (this app, Even Hub SDK)
                        │
                        ├─ HudEngine        → container layout, event routing, voice FSM
                        ├─ BrowserEvenAdapter → dev/demo: renders the REAL containers on screen
                        │
                        ▼  /api/* (whitelisted in app.json, CORS-clean)
              Backend proxy (server/api.ts — secrets NEVER in the .ehpk)
                ├─ Telegram Bot API   → live poll + sendMessage (optional token)
                ├─ Hyperliquid /info  → live allMids marks + funding
                ├─ Polymarket Gamma   → event odds (live)
                ├─ Paper engine       → positions, PnL, margin (testnet-only, no custody)
                ├─ Threat sieve       → drainer/phishing URLs blocked before the lens
                └─ Voice intent       → transcript → REPLY | PAPER_TRADE | SWITCH_MODE
```

Display engine uses: `createStartUpPageContainer` → `textContainerUpgrade`
(flicker-free live text) → `updateImageRawData` (serialized grey4 sparkline
frames) → `rebuildPageContainer` on desk switch → `menuObject` contextual menu →
`audioControl` + `audioEvent` PCM capture → `shutDownPageContainer(1)` exit.
All 5 containers set `zOrderIndex` (all-or-nothing rule), `textColor` levels
0–4 for hierarchy, exactly one `isEventCapture: 1`.

## Run it (no glasses needed)

```bash
npm install
npm run dev          # Vite + backend middleware on http://localhost:5173
```

Open the page — the browser adapter renders the **actual container objects**
the app pushes into a 576×288 green lens, and the deck below it injects the
same OS events the firmware emits (tap, swipe, ring, long-press, double-tap,
contextual menu, PCM audio frames).

**Official simulator:**

```bash
npm run simulate     # evenhub-simulator http://localhost:5173
```

**Real G2:** `npm run dev -- --host`, then `npx evenhub qr --url http://<your-ip>:5173`
and scan with the Even app.

**Package:** `npm run pack` → `telepulse.ehpk`

### Optional live Telegram bridge

```bash
cp .env.example .env
# set TELEGRAM_BOT_TOKEN + TELEGRAM_DEFAULT_CHAT_ID
npm run server       # standalone backend on :8787 (or keep middleware mode)
```

Without a token the app runs in sim bridge mode — replies are logged
server-side and receipts still land in the feed. Trade execution is **paper /
testnet only**; Gram Wallet is **read-only watch**; nothing holds user funds
and nothing gives financial advice.

## Why it fits the rubric

- **Usefulness on G2 (30%)** — a real daily loop for the exact audience
  (Telegram signal groups → instant action) that works phone-locked.
- **Read & write (25%)** — tap/ring/voice writes in <3s, AI drafts instead of
  dictation, linked signal→trade is one tap end-to-end.
- **Technical (20%)** — live Hyperliquid marks, real Telegram Bot bridge,
  serialized image pipeline, debounced BLE-safe render queue, 11 unit tests.
- **UX for display/voice (15%)** — 5 containers, brightness hierarchy,
  threat-sieve dimming, sparkline on the image pipeline.
- **Business/safety (10%)** — testnet/paper/read-only only, threat sieve,
  secrets on the proxy, DoraHacks + Even QA rules respected.

## What existed before Nov 23

All application code was written during build week. Used existing public
services/libraries only: `@evenrealities/even_hub_sdk`, `evenhub-cli`,
`evenhub-simulator`, Vite/TypeScript/Vitest, the public Hyperliquid `info`
API, Polymarket Gamma API, Telegram Bot API. The 576×288 layout, threat
sieve, voice-intent router, paper engine and lens adapter are new.

## API feature requests (≤5)

1. `Even Hub SDK` — first-party STT hook: host-side Whisper streaming instead
   of raw PCM plumbing would collapse the hardest part of voice UX.
2. `Telegram Bot API` — a scoped "glance token" for channel-digest reads
   (read-only, per-chat TTL) for wearable surfaces.
3. `Hyperliquid info` — websocket mid-price channel whitelisted for WebView
   origins (polling works, but a push channel halves latency).
4. `Polymarket Gamma` — a lightweight `/top-movers` endpoint (single call
   digest for glance cards instead of full event objects).
5. `Even Hub SDK` — `textContainerUpgrade` partial-region flags so a single
   field (e.g. PnL) can re-render without a full-content send.

## Repo layout

```
app.json                     Even Hub manifest (edition 202601)
server/api.ts                Backend proxy + paper engine + sieve + intents
server/standalone.ts         Standalone backend (:8787)
src/main.ts                  Companion UI + bridge selection + demo mode
src/display/HudEngine.ts     G2 screen engine (containers, events, voice FSM)
src/display/BrowserEvenAdapter.ts  Browser twin of the SDK bridge + lens DOM
src/display/sparkline.ts     grey4 sparkline encoder for image containers
tests/api.test.ts            11 tests — sieve, paper engine, voice intents
?v=…                         append ?demo=1 for the scripted video scenario
```
