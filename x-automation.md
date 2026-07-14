# Vladinator X Runtime

This document describes the implemented X workflow. The application owns facts and routing. The model owns private interpretation and public wording.

## Runtime Flow

```text
wallet receipt / wallet snapshot / mention / researched post
  -> deterministic normalization and deduplication
  -> persistent observation
  -> active thought (belief, tension, question, confidence, evidence)
  -> expression-pressure check
  -> private cognition update when new evidence exists
  -> expression plan (mode, cadence, energy, slang and emoji budgets)
  -> public draft generation
  -> deterministic validation and one retry
  -> priority queue
  -> media upload when required
  -> X publish
  -> expression memory
```

Silence is a valid result. A routine tick does not create a random premise when no thought clears the configured pressure threshold.

## Priority

1. Confirmed wallet buys and sells.
2. Direct conversations and approved research replies or quotes.
3. Mature routine thoughts.

The queue is capped by behavior rather than prompt wording. Trade receipts cannot be displaced by routine posts. Confirmed trades require their generated receipt card; a failed media upload is retried instead of silently posting text only.

## Perception

### Wallet

- A confirmed buy or sell is a direct observation and belongs to Vladinator in first person.
- Receipt thoughts are private to that trade route and cannot leak into routine selection.
- Material changes to priced, non-spam holdings create position observations.
- Zero-dollar holdings are excluded from public wallet context.
- ETH is treated as execution fuel unless verified context says otherwise.

### Mentions

- Every mention is stored under its own conversation topic.
- Parent and quoted-post context are included when X returns them.
- A reply answers the current source post first; old conversations are not supplied as reply context.
- A second `@VladinatorRH` inside a post is treated as a direct address. A leading-only mention remains governed by the configured reply-chain sampling rule.

### Research

- Account watchers and topic queries are configured in `x-expression-config.json`.
- Posts are deduplicated by X post ID.
- Link-only, promotional, cashtag spam, mention spam, and isolated-keyword posts are rejected before model analysis.
- Remaining posts are classified as `AUTHOR_CLAIM`, `DIRECT_OBSERVATION`, `SUPPORTED_EVENT`, `UNVERIFIED_REPORT`, `OPINION`, or `JOKE_OR_SATIRE`.
- A researched post can update a thought without causing a reply.
- Reply and quote decisions are separate from draft generation.
- Research dry-run mode physically blocks publishing, including manual approval requests.

## Persistent Mind

`x-mind.js` stores:

- mood and evolving style state
- observations and provenance
- active thoughts
- evidence for and against each thought
- unresolved questions
- changed beliefs and surprises
- expression history
- research watchers, discoveries, and engagement candidates

The container writes local state to `.runtime/x-mind-state.json`. In Cloudflare, the worker mirrors the state to D1 through the authenticated internal mind endpoint so a container restart does not reset the account.

## Expression Layer

Before generation, the planner chooses:

- mode: observation, reaction, teasing, question, deadpan, callback, agreement, or disagreement
- cadence: fragment, short, or expanded
- energy
- direct-address behavior
- slang, internet-word, and emoji budgets
- optional opening and ending shapes

Recent openings, cadence, modes, topics, and exact wording are penalized. The validator rejects:

- exact or near repetition
- repeated openings and cadence
- excessive slang or emoji
- configured "too AI" phrase combinations
- cadence length violations
- missing required trade facts
- generic fallback slogans

The permanent identity prompt is concise. Each call receives only verified event JSON, the developed thought, its expression plan, recent subject memory, and a small category-matched sample of writing references.

## Trade Output

A buy or sell produces strict JSON:

```json
{
  "main_tweet": "string under 280 characters",
  "follow_up_tweet": "string under 280 characters"
}
```

The main tweet announces the confirmed action. The follow-up carries the thesis or exit frame without inventing a reason. Buy and sell posts attach the generated receipt/P&L card.

## Research Controls

The local-only X terminal exposes `MIND` and `RESEARCH` views. It shows thought pressure, evidence, expression memory, watcher health, filtered discoveries, decisions, and pending engagement candidates. Review controls store approval state but never publish from the terminal.

API endpoints:

- `GET /api/x/mind`
- `GET /api/x/research`
- `POST /api/x/research/action`
- `GET /api/x/status`
- `POST /api/x/tweet` for local dry-run generation

## Feature Flags

```dotenv
X_AUTOMATION_ENABLED=false
BACKEND_PAUSED=true
X_RESEARCH_ENABLED=false
X_RESEARCH_DRY_RUN=true
X_AUTO_REPLY_ENABLED=false
X_AUTO_QUOTE_ENABLED=false
X_ACCOUNT_POLL_INTERVAL_MS=300000
X_TOPIC_SEARCH_INTERVAL_MS=900000
X_MAX_RESULTS_PER_QUERY=10
```

Safe activation order:

1. Start the backend with `BACKEND_PAUSED=false`, leaving every X flag false.
2. Enable `X_RESEARCH_ENABLED=true` while keeping research dry-run and auto actions off.
3. Inspect discoveries and decisions in the local terminal.
4. Enable `X_AUTOMATION_ENABLED=true` for trade and mature routine posts.
5. Enable auto reply or quote separately only after dry-run review.

## Identity Boundary

Vladinator is a fictional autonomous onchain trader and controls the linked wallet. It is not Vlad Tenev, Robinhood, or an official Robinhood product. Creator jokes stay clearly fictional and never imply authorization or endorsement.
