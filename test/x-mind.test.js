const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { XMind } = require("../x-mind");

function config(overrides = {}) {
  return {
    thoughts: {
      expressionThreshold: 0.64,
      thoughtCooldownMs: 1200000,
      recentTopicWindow: 6,
      maxObservations: 100,
      maxThoughts: 40,
      maxDiscoveries: 40,
      maxCandidates: 20,
      ...(overrides.thoughts || {})
    },
    expression: {
      modeWeights: {
        routine: { observation: 35, teasing: 20, reaction: 15, question: 10, deadpan: 10, callback: 5, agreement: 3, disagreement: 2 },
        reply: { reaction: 25, teasing: 25, disagreement: 15, agreement: 10, deadpan: 10, question: 10, observation: 5 },
        trade: { observation: 50, reaction: 25, deadpan: 25 }
      },
      cadenceWeights: {
        routine: { fragment: 25, short: 45, expanded: 30 },
        reply: { fragment: 25, short: 55, expanded: 20 },
        trade: { short: 60, expanded: 40 }
      },
      openingChance: 0.36,
      endingChance: 0.14,
      emojiChance: 0,
      slang: { reaction: ["nah"], teasing: ["your bags are talking"], agreement: ["fair"], understatement: ["very normal"], general: ["bro"] },
      openings: { observation: ["funny how"], reaction: ["nah"], teasing: ["be serious"], question: ["be honest"], deadpan: ["interesting"], agreement: ["fair"], disagreement: ["absolutely not"], callback: ["still funny that"] },
      endings: ["lol"],
      tooAiCombinations: [["interesting", "dynamics"], ["signal", "noise"]],
      ...(overrides.expression || {})
    },
    research: {
      watchedAccounts: [{ handle: "vladtenev", priority: 90 }],
      topicQueries: [{ name: "robinhood", query: "Robinhood Chain", priority: 80 }],
      spamTerms: ["airdrop", "giveaway", "join telegram"],
      promotionalPatterns: ["drop your wallet"]
    },
    backgroundThoughts: overrides.backgroundThoughts || []
  };
}

function mind(options = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "vladinator-mind-"));
  let now = options.now || Date.now();
  const instance = new XMind({
    statePath: path.join(dir, "state.json"),
    config: config(options.config || {}),
    now: () => now,
    random: options.random || (() => 0.2)
  });
  return { instance, advance(ms) { now += ms; }, dir };
}

test("deduplicates observations by source type and source id", () => {
  const { instance } = mind();
  const input = { sourceType: "WALLET", sourceId: "0xabc", topic: "receipt:CAP", summary: "bought CAP", significance: 1, novelty: 1, routineEligible: false };
  assert.equal(instance.ingestObservation(input).created, true);
  assert.equal(instance.ingestObservation(input).created, false);
  assert.equal(instance.state.observations.length, 1);
});

test("confirmed receipt thoughts never leak into routine selection", () => {
  const { instance } = mind();
  instance.ingestObservation({ sourceType: "WALLET", sourceId: "0xtrade", topic: "receipt:CAP", summary: "bought CAP", significance: 1, novelty: 1, relevance: 1, routineEligible: false, priority: "receipt" });
  assert.equal(instance.selectThoughtForExpression({ minimumPressure: 0 }), null);
});

test("a mature position observation is eligible while weak input permits silence", () => {
  const { instance } = mind();
  instance.ingestObservation({ sourceType: "MARKET", sourceId: "weak", topic: "position:CAP", summary: "small move", significance: 0.1, novelty: 0.1, relevance: 0.2, routineEligible: true });
  assert.equal(instance.selectThoughtForExpression({ minimumPressure: 0.9 }), null);
  instance.ingestObservation({ sourceType: "MARKET", sourceId: "strong", topic: "position:GME", summary: "material move", significance: 1, novelty: 1, relevance: 1, confidence: 0.95, routineEligible: true, stance: "SUPPORTS" });
  assert.equal(instance.selectThoughtForExpression({ minimumPressure: 0.6 }).topic, "position:gme");
});

test("contradictory evidence lowers confidence", () => {
  const { instance } = mind();
  const first = instance.ingestObservation({ sourceType: "X_POST", sourceId: "1", topic: "research:pumpfun", summary: "first claim", confidence: 0.7, significance: 0.8, novelty: 0.8, stance: "SUPPORTS", factualStatus: "AUTHOR_CLAIM" });
  const before = first.thought.confidence;
  const second = instance.ingestObservation({ sourceType: "X_POST", sourceId: "2", topic: "research:pumpfun", summary: "contradictory claim", significance: 0.8, novelty: 0.8, stance: "CONTRADICTS", factualStatus: "AUTHOR_CLAIM" });
  assert.ok(second.thought.confidence < before);
  assert.equal(second.thought.evidenceAgainst.length, 1);
});

test("deterministic research filters reject promotion and isolated keywords", () => {
  const { instance } = mind();
  assert.deepEqual(instance.deterministicFilter({ text: "airdrop now drop your wallet" }), { accepted: false, reason: "promotional_spam" });
  assert.deepEqual(instance.deterministicFilter({ text: "$VLAD" }), { accepted: false, reason: "isolated_keyword" });
  assert.equal(instance.deterministicFilter({ text: "everybody found conviction after the green candle" }).accepted, true);
});

test("discovered posts and engagement candidates cannot be processed twice", () => {
  const { instance } = mind();
  const first = instance.recordDiscovery({ xPostId: "123", authorHandle: "someone", text: "a real claim with enough context" });
  assert.equal(first.created, true);
  assert.equal(instance.recordDiscovery({ xPostId: "123", authorHandle: "someone", text: "duplicate" }).created, false);
  const candidate = instance.addEngagementCandidate({ discoveredPostId: first.discovery.id, action: "REPLY", reason: "adds a distinct answer" });
  assert.ok(candidate);
  assert.equal(instance.addEngagementCandidate({ discoveredPostId: first.discovery.id, action: "QUOTE", reason: "duplicate engagement" }), null);
});

test("expression history rejects exact repetition and too-AI phrase pairs", () => {
  const { instance } = mind();
  const plan = instance.planExpression({ eventType: "routine" });
  instance.registerExpression({ topic: "culture:test", text: "everybody found conviction after the candle", plan, postId: "post-1" });
  assert.equal(instance.validateDraft("everybody found conviction after the candle", plan), "exact recent draft repetition");
  assert.match(instance.validateDraft("interesting dynamics are emerging", plan), /too-AI phrase combination/);
});

test("state survives a process-style reload", () => {
  const setup = mind();
  setup.instance.ingestObservation({ sourceType: "MARKET", sourceId: "persist", topic: "position:CAP", summary: "CAP moved", significance: 0.8, novelty: 0.8 });
  const reloaded = new XMind({ statePath: path.join(setup.dir, "state.json"), config: config(), now: () => Date.now(), random: () => 0.2 });
  assert.equal(reloaded.state.observations.length, 1);
  assert.equal(reloaded.state.activeThoughts[0].topic, "position:cap");
});

test("an authoritative remote snapshot can replace newer local defaults", () => {
  const setup = mind({ now: Date.parse("2026-07-14T12:00:00.000Z") });
  const remote = setup.instance.exportState();
  remote.updatedAt = "2026-07-14T11:00:00.000Z";
  remote.currentPriorities = ["restored remote priority"];
  setup.instance.state.updatedAt = "2026-07-14T12:00:00.000Z";
  assert.equal(setup.instance.importState(remote), false);
  assert.equal(setup.instance.importState(remote, { force: true }), true);
  assert.deepEqual(setup.instance.state.currentPriorities, ["restored remote priority"]);
});

test("reset removes learned state and restores only configured defaults", () => {
  const setup = mind({ config: { backgroundThoughts: [{ topic: "culture:home", belief: "Robinhood Chain is home" }] } });
  setup.instance.ingestObservation({ sourceType: "MARKET", sourceId: "old", topic: "position:OLD", summary: "old wallet memory", significance: 1, novelty: 1 });
  setup.instance.registerExpression({ topic: "position:old", text: "old expression", postId: "old-post" });
  const reset = setup.instance.reset();
  assert.equal(reset.observations.length, 0);
  assert.equal(reset.expressionHistory.length, 0);
  assert.deepEqual(reset.activeThoughts.map((thought) => thought.topic), ["culture:home"]);
});
