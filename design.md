# Vladinator AI Design System

## Design read

An experimental system dashboard centered on Vladinator, a crypto-native autonomous persona. The interface should feel like a private green-phosphor observer system that narrates its own state. It is not a chat application and never presents a text input for a person to direct the terminal.

## Direction

- **Aesthetic:** Robinhood-green deep-space terminal, neon chartreuse on near-black. The site is an autonomous system monitor, not an imitation of any supplied image.
- **Design dials:** variance 8, motion 6, density 8.
- **Accent lock:** `#c8ff00` is the bright brand accent. Supporting tones are derived green and deep green-black.
- **Type:** system monospace stack. Uppercase labels are compact; narrative thoughts remain readable in sentence case.
- **Shape language:** square panels with a 2px signal border and 0px radius. Thin rules, corner markers, scan lines, and faint grid texture communicate the system state.

## Layout

1. **Vladinator header** - brand logo, section navigation, and an awake system control establish the machine state.
2. **Inner monologue terminal** - the largest left panel, built as a dense cognitive observatory rather than a plain transcript. Process telemetry, a command trace, animated cognition waveform, memory-sector map, active-room state, and an append-only thought buffer surround the central narrative. There is deliberately no prompt, send button, text field, or human action.
3. **Vlad identity observer** - the supplied square Vlad videos occupy the right-side observer position. Each six-second clip advances to the next on completion, with no manual clip controls. A compact statement below the footage identifies Vladinator and the active visual process.
4. **Memory rooms** - six persistent AI memory partitions: Favorites, Avoid List, Token Encounters, Trade Theses, Unresolved Questions, and Recent Outcomes. Each room opens a read-only trace and gives the narrator a specific category for structured memory.
5. **Ambient diagnostic rail** - a narrow separator carries sparse system data and a small ASCII dinosaur process. It adds personality without competing with wallet information.
6. **Wallet vault** - placed beneath the thought system with one dominant live USD portfolio value, larger holdings, current token prices, 24-hour movement, and high-resolution token artwork. The information placement borrows from mobile portfolio apps while preserving the sharp green Vladinator language.
7. **Activity and fee ledgers** - transactions use larger token visuals, prominent current USD values, and clear green buy or red sell rails. They inspect ERC-20 `Transfer` logs plus internal native transfers. ETH out plus token in is a buy; token out plus internally returned ETH is a sell; plain native ETH movements become transfer in or transfer out. The fee view finds recognized claim or collect methods. This is a read-only activity classifier, not financial advice or a trade execution surface.

## Behavior

- The thought generator runs entirely locally in the browser and periodically appends a new self-directed observation. New thoughts arrive with a short signal-in animation.
- The identity observer, universe void, access-granted boot sequence, room board, and new transaction rows animate passively. `prefers-reduced-motion` disables decorative movement.
- Room pulse values are stable process heartbeats. They advance on a timer and never regenerate because a room was clicked. Entering a room opens a focused trace with its current state, pulse, and internal log.
- The identity channel is muted and autoplay-safe. Each video advances through the seven-file sequence on `ended`, then returns to the beginning.
- The wallet scanner polls server endpoints. The server talks to Robinhood Chain's public RPC and Blockscout explorer, with optional `ROBINHOODCHAIN_RPC_URL`, `ROBINHOODCHAIN_EXPLORER_URL`, and `ROBINHOODCHAIN_API_KEY` overrides. Confirmed indexed token holdings are cached server-side so an explorer delay does not remove them from the visual inventory. Keys are never shipped to the browser.
- Token artwork comes from the chain indexer when available. When a small-cap has no published icon, the interface draws a distinct local token glyph, including a cat glyph for cat-named assets, instead of leaving an empty placeholder.
- Current USD prices, 24-hour token movement, and imagery are enriched from Dexscreener's Robinhood Chain pairs. Transaction USD values use the current market mark, not historical execution price.
- Empty and error states remain inside the instrument panels so the experience stays legible when an indexer is delayed.

## Accessibility

The chartreuse foreground has intentionally high contrast against the black surface. Motion is reduced when requested. The terminal stream uses a live region, while decorative scan-line and observer effects are hidden from assistive technology.
