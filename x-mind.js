const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, Number(value) || 0));
const clean = (value, max = 500) => String(value || "").replace(/\s+/g, " ").trim().slice(0, max);
const nowIso = (now = Date.now()) => new Date(now).toISOString();
const hash = (value) => crypto.createHash("sha256").update(String(value)).digest("hex").slice(0, 18);
const uniq = (items, limit = 100) => [...new Set((items || []).filter(Boolean))].slice(-limit);
const words = (value) => clean(value, 2000).toLowerCase().match(/[a-z0-9$@']+/g) || [];

function weightedChoice(entries, random = Math.random) {
  const rows = Object.entries(entries || {}).filter(([, weight]) => Number(weight) > 0);
  if (!rows.length) return null;
  const total = rows.reduce((sum, [, weight]) => sum + Number(weight), 0);
  let cursor = random() * total;
  for (const [value, weight] of rows) {
    cursor -= Number(weight);
    if (cursor <= 0) return value;
  }
  return rows[rows.length - 1][0];
}

function similarity(a, b) {
  const left = new Set(words(a));
  const right = new Set(words(b));
  if (!left.size || !right.size) return 0;
  let intersection = 0;
  for (const token of left) if (right.has(token)) intersection += 1;
  return intersection / Math.max(left.size, right.size);
}

function defaultMood() {
  return { curiosity: 0.62, confidence: 0.68, amusement: 0.55, skepticism: 0.48, frustration: 0.18 };
}

function defaultStyleState() {
  return { sarcasm: 0.62, curiosity: 0.4, energy: 0.48, dryness: 0.72, positivity: 0.32 };
}

function watcherRows(config) {
  const accounts = (config.research?.watchedAccounts || []).map((entry) => ({
    id: `account:${String(entry.handle || "").toLowerCase()}`,
    type: "ACCOUNT",
    name: `@${entry.handle}`,
    query: String(entry.handle || "").replace(/^@/, ""),
    priority: Number(entry.priority || 50),
    enabled: entry.enabled !== false,
    lastPolledAt: null,
    lastSeenId: null,
    backoffUntil: null,
    lastError: null
  }));
  const topics = (config.research?.topicQueries || []).map((entry) => ({
    id: `topic:${String(entry.name || hash(entry.query)).toLowerCase()}`,
    type: "TOPIC",
    name: entry.name || entry.query,
    query: entry.query,
    priority: Number(entry.priority || 50),
    enabled: entry.enabled !== false,
    lastPolledAt: null,
    lastSeenId: null,
    backoffUntil: null,
    lastError: null
  }));
  return [...accounts, ...topics];
}

function defaultState(config, now = Date.now()) {
  return {
    version: 1,
    updatedAt: nowIso(now),
    mood: defaultMood(),
    styleState: defaultStyleState(),
    activeThoughts: [],
    unresolvedQuestions: [],
    recentSurprises: [],
    currentPriorities: ["wallet receipts", "open positions", "Robinhood Chain", "live conversations"],
    changedBeliefs: [],
    observations: [],
    processedSourceIds: [],
    expressionHistory: [],
    discoveries: [],
    engagementCandidates: [],
    watchers: watcherRows(config)
  };
}

class XMind {
  constructor({ statePath, configPath, config, now = () => Date.now(), random = Math.random, onChange = null } = {}) {
    this.statePath = statePath || null;
    this.configPath = configPath || null;
    this.now = now;
    this.random = random;
    this.onChange = onChange;
    this.config = config || this.readConfig();
    this.state = this.loadState();
    this.ensureBackgroundThoughts();
  }

  readConfig() {
    try { return JSON.parse(fs.readFileSync(this.configPath, "utf8")); } catch { return { thoughts: {}, expression: {}, research: {}, backgroundThoughts: [] }; }
  }

  loadState() {
    const base = defaultState(this.config, this.now());
    try {
      const stored = JSON.parse(fs.readFileSync(this.statePath, "utf8"));
      return this.normalizeState({ ...base, ...stored });
    } catch {
      return base;
    }
  }

  normalizeState(value) {
    const base = defaultState(this.config, this.now());
    const storedWatchers = new Map((value.watchers || []).map((entry) => [entry.id, entry]));
    const watchers = watcherRows(this.config).map((entry) => ({ ...entry, ...(storedWatchers.get(entry.id) || {}) }));
    for (const entry of value.watchers || []) if (!watchers.some((watcher) => watcher.id === entry.id)) watchers.push(entry);
    return {
      ...base,
      ...value,
      mood: { ...base.mood, ...(value.mood || {}) },
      styleState: { ...base.styleState, ...(value.styleState || {}) },
      activeThoughts: Array.isArray(value.activeThoughts) ? value.activeThoughts : [],
      unresolvedQuestions: Array.isArray(value.unresolvedQuestions) ? value.unresolvedQuestions : [],
      recentSurprises: Array.isArray(value.recentSurprises) ? value.recentSurprises : [],
      currentPriorities: Array.isArray(value.currentPriorities) ? value.currentPriorities : base.currentPriorities,
      changedBeliefs: Array.isArray(value.changedBeliefs) ? value.changedBeliefs : [],
      observations: Array.isArray(value.observations) ? value.observations : [],
      processedSourceIds: Array.isArray(value.processedSourceIds) ? value.processedSourceIds : [],
      expressionHistory: Array.isArray(value.expressionHistory) ? value.expressionHistory : [],
      discoveries: Array.isArray(value.discoveries) ? value.discoveries : [],
      engagementCandidates: Array.isArray(value.engagementCandidates) ? value.engagementCandidates : [],
      watchers
    };
  }

  save() {
    this.state.updatedAt = nowIso(this.now());
    if (this.statePath) {
      try {
        fs.mkdirSync(path.dirname(this.statePath), { recursive: true });
        fs.writeFileSync(this.statePath, JSON.stringify(this.state, null, 2));
      } catch (error) {
        console.error("x_mind_save_error", error.message);
      }
    }
    if (typeof this.onChange === "function") this.onChange(this.exportState());
  }

  exportState() {
    return JSON.parse(JSON.stringify(this.state));
  }

  importState(value, { force = false } = {}) {
    if (!value || typeof value !== "object") return false;
    const incomingTime = new Date(value.updatedAt || 0).getTime();
    const currentTime = new Date(this.state.updatedAt || 0).getTime();
    if (!force && Number.isFinite(currentTime) && Number.isFinite(incomingTime) && incomingTime <= currentTime) return false;
    this.state = this.normalizeState(value);
    this.ensureBackgroundThoughts(false);
    this.save();
    return true;
  }

  reset() {
    this.state = defaultState(this.config, this.now());
    this.ensureBackgroundThoughts(false);
    this.save();
    return this.exportState();
  }

  ensureBackgroundThoughts(save = true) {
    let changed = false;
    for (const seed of this.config.backgroundThoughts || []) {
      if (this.state.activeThoughts.some((thought) => thought.topic === seed.topic)) continue;
      const createdAt = nowIso(this.now());
      this.state.activeThoughts.push({
        id: `thought-${hash(seed.topic)}`,
        topic: seed.topic,
        belief: seed.belief,
        tension: seed.tension || "",
        unresolvedQuestion: seed.unresolvedQuestion || "",
        confidence: clamp(seed.confidence ?? 0.6),
        importance: clamp(seed.importance ?? 0.5),
        novelty: 0.24,
        relevance: clamp(seed.importance ?? 0.5),
        evidenceFor: [],
        evidenceAgainst: [],
        observationIds: [],
        expressionPressure: clamp(seed.expressionPressure ?? 0.3),
        routineEligible: seed.routineEligible !== false,
        priority: seed.priority || "culture",
        expressionCount: 0,
        cognitionVersion: 0,
        developedAt: null,
        lastExpressedAt: null,
        createdAt,
        updatedAt: createdAt
      });
      if (seed.unresolvedQuestion) this.state.unresolvedQuestions.push({ id: `question-${hash(seed.topic)}`, thoughtId: `thought-${hash(seed.topic)}`, question: seed.unresolvedQuestion, status: "open", createdAt, updatedAt: createdAt });
      changed = true;
    }
    if (changed && save) this.save();
  }

  sourceKey(input) {
    return `${String(input.sourceType || "UNKNOWN").toUpperCase()}:${clean(input.sourceId || input.id || input.summary, 220)}`;
  }

  topicFor(input) {
    if (input.topic) return clean(input.topic, 120).toLowerCase();
    const entities = Array.isArray(input.entities) ? input.entities : [];
    const token = entities.find((entity) => String(entity.type || "").toLowerCase() === "token");
    if (token?.value) return `token:${clean(token.value, 32).toUpperCase()}`;
    const account = entities.find((entity) => String(entity.type || "").toLowerCase() === "account");
    if (account?.value) return `account:${clean(account.value, 60).replace(/^@/, "").toLowerCase()}`;
    const subject = entities.find((entity) => String(entity.type || "").toLowerCase() === "subject");
    if (subject?.value) return `subject:${clean(subject.value, 80).toLowerCase()}`;
    return `observation:${hash(input.summary || input.sourceId)}`;
  }

  beliefFor(input, topic) {
    if (input.belief) return clean(input.belief, 560);
    const metadata = input.metadata || {};
    const token = (input.entities || []).find((entity) => String(entity.type || "").toLowerCase() === "token")?.value || "this token";
    if (metadata.eventType === "buy") return `I chose to buy ${token}; the confirmed receipt makes it an active wallet thesis.`;
    if (metadata.eventType === "sell") return `I chose to ${metadata.isFullExit ? "exit" : "trim"} ${token}; the confirmed receipt changes the position.`;
    if (String(input.sourceType).toUpperCase() === "MARKET") return `The live wallet or market state changed around ${token}.`;
    if (String(input.sourceType).toUpperCase() === "MENTION") return `Someone entered the conversation about ${topic.replace(/^[^:]+:/, "")}.`;
    if (String(input.sourceType).toUpperCase() === "X_POST") return `A post claims: ${clean(input.summary, 240)}`;
    return clean(input.summary, 560);
  }

  ingestObservation(input = {}) {
    const sourceKey = this.sourceKey(input);
    const existing = this.state.observations.find((observation) => observation.sourceKey === sourceKey);
    if (existing) {
      const thought = this.state.activeThoughts.find((entry) => entry.observationIds?.includes(existing.id)) || null;
      return { created: false, observation: existing, thought };
    }
    const timestamp = input.createdAt || nowIso(this.now());
    const topic = this.topicFor(input);
    const significance = clamp(input.significance ?? 0.5);
    const novelty = clamp(input.novelty ?? 0.5);
    const relevance = clamp(input.relevance ?? significance);
    const observation = {
      id: input.id || `obs-${hash(sourceKey)}`,
      sourceKey,
      sourceType: String(input.sourceType || "UNKNOWN").toUpperCase(),
      sourceId: clean(input.sourceId || input.id || sourceKey, 220),
      summary: clean(input.summary, 800),
      entities: Array.isArray(input.entities) ? input.entities.slice(0, 12) : [],
      topic,
      significance,
      novelty,
      relevance,
      stance: ["SUPPORTS", "CONTRADICTS", "INSPIRES"].includes(input.stance) ? input.stance : "INSPIRES",
      factualStatus: input.factualStatus || "DIRECT_OBSERVATION",
      metadata: input.metadata && typeof input.metadata === "object" ? input.metadata : {},
      routineEligible: input.routineEligible !== false,
      createdAt: timestamp
    };
    this.state.observations.unshift(observation);
    this.state.processedSourceIds.push(sourceKey);
    const limits = this.config.thoughts || {};
    this.state.observations = this.state.observations.slice(0, limits.maxObservations || 600);
    this.state.processedSourceIds = uniq(this.state.processedSourceIds, (limits.maxObservations || 600) * 2);

    let thought = this.state.activeThoughts.find((entry) => entry.topic === topic);
    const oldBelief = thought?.belief || null;
    if (!thought) {
      thought = {
        id: `thought-${hash(topic)}`,
        topic,
        belief: this.beliefFor(input, topic),
        tension: clean(input.tension, 560),
        unresolvedQuestion: clean(input.unresolvedQuestion, 420),
        confidence: clamp(input.confidence ?? (observation.factualStatus === "DIRECT_OBSERVATION" ? 0.82 : 0.48)),
        importance: significance,
        novelty,
        relevance,
        evidenceFor: [],
        evidenceAgainst: [],
        observationIds: [],
        expressionPressure: 0,
        routineEligible: observation.routineEligible,
        priority: input.priority || (observation.sourceType === "WALLET" ? "wallet" : "research"),
        expressionCount: 0,
        cognitionVersion: 0,
        developedAt: null,
        lastExpressedAt: null,
        createdAt: timestamp,
        updatedAt: timestamp
      };
      this.state.activeThoughts.push(thought);
    }
    thought.observationIds = uniq([...(thought.observationIds || []), observation.id], 40);
    if (observation.stance === "CONTRADICTS") {
      thought.evidenceAgainst = uniq([...(thought.evidenceAgainst || []), observation.id], 30);
      thought.confidence = clamp(thought.confidence - 0.05 - significance * 0.08);
    } else {
      thought.evidenceFor = uniq([...(thought.evidenceFor || []), observation.id], 30);
      if (observation.stance === "SUPPORTS") thought.confidence = clamp(thought.confidence + 0.03 + significance * 0.04);
    }
    if (input.belief && observation.stance !== "CONTRADICTS") thought.belief = clean(input.belief, 560);
    if (input.tension) thought.tension = clean(input.tension, 560);
    if (input.unresolvedQuestion) thought.unresolvedQuestion = clean(input.unresolvedQuestion, 420);
    thought.importance = clamp(Math.max(thought.importance || 0, significance));
    thought.novelty = clamp((thought.novelty || 0) * 0.55 + novelty * 0.45);
    thought.relevance = clamp(Math.max(thought.relevance || 0, relevance));
    thought.routineEligible = Boolean(thought.routineEligible && observation.routineEligible);
    thought.expressionPressure = clamp(Math.max(thought.expressionPressure || 0, significance * 0.4 + novelty * 0.35 + relevance * 0.25));
    thought.updatedAt = timestamp;
    thought.cognitionVersion = Math.min(Number(thought.cognitionVersion || 0), Math.max(0, thought.observationIds.length - 1));
    if (thought.unresolvedQuestion) {
      const existingQuestion = this.state.unresolvedQuestions.find((entry) => entry.thoughtId === thought.id && entry.status === "open");
      if (existingQuestion) {
        existingQuestion.question = thought.unresolvedQuestion;
        existingQuestion.updatedAt = timestamp;
      } else {
        this.state.unresolvedQuestions.unshift({ id: `question-${hash(`${thought.id}:${thought.unresolvedQuestion}`)}`, thoughtId: thought.id, question: thought.unresolvedQuestion, status: "open", createdAt: timestamp, updatedAt: timestamp });
      }
    }
    if (oldBelief && thought.belief !== oldBelief) this.state.changedBeliefs.unshift({ thoughtId: thought.id, topic, from: oldBelief, to: thought.belief, reasonObservationId: observation.id, changedAt: timestamp });
    if (novelty >= 0.78) this.state.recentSurprises.unshift({ observationId: observation.id, topic, summary: observation.summary, createdAt: timestamp });
    this.state.changedBeliefs = this.state.changedBeliefs.slice(0, 40);
    this.state.recentSurprises = this.state.recentSurprises.slice(0, 40);
    this.state.activeThoughts = this.state.activeThoughts.sort((a, b) => this.expressionPressure(b) - this.expressionPressure(a)).slice(0, limits.maxThoughts || 80);
    this.updateMood(observation);
    this.save();
    return { created: true, observation, thought };
  }

  updateMood(observation) {
    const mood = this.state.mood;
    if (observation.sourceType === "WALLET") {
      mood.confidence = clamp(mood.confidence + (observation.metadata?.eventType === "buy" ? 0.025 : 0.01));
      mood.curiosity = clamp(mood.curiosity + 0.015);
      const pnl = Number(observation.metadata?.realizedPnlUsd);
      if (Number.isFinite(pnl) && pnl > 0) mood.amusement = clamp(mood.amusement + 0.04);
      if (Number.isFinite(pnl) && pnl < 0) mood.frustration = clamp(mood.frustration + 0.035);
    } else if (observation.sourceType === "MENTION") {
      mood.curiosity = clamp(mood.curiosity + 0.02);
    } else if (observation.sourceType === "X_POST") {
      mood.skepticism = clamp(mood.skepticism + (observation.factualStatus === "UNVERIFIED_REPORT" ? 0.025 : 0.005));
    }
  }

  evidenceForThought(thought) {
    const byId = new Map(this.state.observations.map((entry) => [entry.id, entry]));
    return (thought.observationIds || []).map((id) => byId.get(id)).filter(Boolean);
  }

  expressionPressure(thought, at = this.now()) {
    if (!thought) return 0;
    const evidenceCount = (thought.evidenceFor?.length || 0) + (thought.evidenceAgainst?.length || 0);
    const evidence = Math.min(1, evidenceCount / 4);
    const unresolved = thought.unresolvedQuestion ? 0.08 : 0;
    const base = clamp(thought.expressionPressure || 0) * 0.34
      + clamp(thought.importance || 0) * 0.22
      + clamp(thought.novelty || 0) * 0.13
      + clamp(thought.confidence || 0) * 0.1
      + clamp(thought.relevance || 0) * 0.11
      + evidence * 0.1
      + unresolved;
    const sinceUpdateMinutes = Math.max(0, at - new Date(thought.updatedAt || at).getTime()) / 60000;
    const ageBoost = Math.min(0.18, sinceUpdateMinutes * 0.012);
    const sinceExpression = thought.lastExpressedAt ? at - new Date(thought.lastExpressedAt).getTime() : Infinity;
    const cooldown = Number(this.config.thoughts?.thoughtCooldownMs || 1200000);
    const recencyPenalty = sinceExpression < cooldown ? (1 - sinceExpression / cooldown) * 0.46 : 0;
    const recentTopics = this.state.expressionHistory.slice(0, this.config.thoughts?.recentTopicWindow || 6).map((entry) => entry.topic);
    const topicPenalty = recentTopics.includes(thought.topic) ? 0.12 : 0;
    return clamp(base + ageBoost - recencyPenalty - topicPenalty);
  }

  selectThoughtForExpression({ minimumPressure, now = this.now(), includeReceiptThoughts = false } = {}) {
    const threshold = Number(minimumPressure ?? this.config.thoughts?.expressionThreshold ?? 0.64);
    const candidates = this.state.activeThoughts
      .filter((thought) => thought.routineEligible !== false)
      .filter((thought) => includeReceiptThoughts || thought.priority !== "receipt")
      .map((thought) => ({ thought, pressure: this.expressionPressure(thought, now) }))
      .sort((a, b) => b.pressure - a.pressure);
    if (!candidates.length || candidates[0].pressure < threshold) return null;
    return { ...JSON.parse(JSON.stringify(candidates[0].thought)), currentPressure: candidates[0].pressure, evidence: this.evidenceForThought(candidates[0].thought).slice(0, 8) };
  }

  thoughtNeedsDevelopment(thought) {
    if (!thought) return false;
    return Number(thought.cognitionVersion || 0) < Number(thought.observationIds?.length || 0);
  }

  updateThoughtCognition(thoughtId, patch = {}) {
    const thought = this.state.activeThoughts.find((entry) => entry.id === thoughtId);
    if (!thought) return null;
    const oldBelief = thought.belief;
    if (patch.belief) thought.belief = clean(patch.belief, 560);
    if (patch.tension !== undefined) thought.tension = clean(patch.tension, 560);
    if (patch.unresolvedQuestion !== undefined) thought.unresolvedQuestion = clean(patch.unresolvedQuestion, 420);
    if (Number.isFinite(Number(patch.confidence))) thought.confidence = clamp(patch.confidence);
    thought.cognitionVersion = Number(thought.observationIds?.length || 0);
    thought.developedAt = nowIso(this.now());
    thought.updatedAt = thought.developedAt;
    thought.expressionPressure = clamp(Math.max(thought.expressionPressure || 0, Number(patch.expressionPressure || 0)));
    if (oldBelief && oldBelief !== thought.belief) this.state.changedBeliefs.unshift({ thoughtId, topic: thought.topic, from: oldBelief, to: thought.belief, reason: clean(patch.changeReason, 320), changedAt: thought.developedAt });
    this.state.changedBeliefs = this.state.changedBeliefs.slice(0, 40);
    this.save();
    return JSON.parse(JSON.stringify(thought));
  }

  planExpression({ eventType = "routine", thought = null, directAddress = false, replyIntent = null } = {}) {
    const family = ["buy", "sell", "take_profit", "stop_loss"].includes(eventType) ? "trade" : eventType === "reply" ? "reply" : "routine";
    const expression = this.config.expression || {};
    const recentModes = new Set(this.state.expressionHistory.slice(0, 2).map((entry) => entry.mode));
    const modeWeights = { ...(expression.modeWeights?.[family] || expression.modeWeights?.routine || {}) };
    for (const mode of recentModes) if (modeWeights[mode]) modeWeights[mode] *= 0.35;
    if (replyIntent?.isQuestion) {
      modeWeights.question = Math.max(1, (modeWeights.question || 0) * 0.45);
      modeWeights.reaction = (modeWeights.reaction || 0) + 12;
    }
    const mode = weightedChoice(modeWeights, this.random) || "observation";
    const recentCadences = new Set(this.state.expressionHistory.slice(0, 2).map((entry) => entry.cadence));
    const cadenceWeights = { ...(expression.cadenceWeights?.[family] || expression.cadenceWeights?.routine || {}) };
    for (const cadence of recentCadences) if (cadenceWeights[cadence]) cadenceWeights[cadence] *= 0.38;
    const cadence = weightedChoice(cadenceWeights, this.random) || "short";
    const energyBase = family === "trade" ? 2 : family === "reply" ? 2 : this.state.styleState.energy >= 0.65 ? 2 : 1;
    const energy = Math.max(0, Math.min(3, energyBase + (this.state.mood.amusement > 0.72 && this.random() < 0.3 ? 1 : 0)));
    const slangLevel = mode === "reaction" || mode === "teasing" ? (this.random() < 0.42 ? 2 : 1) : this.random() < 0.28 ? 1 : 0;
    const emojiBudget = this.random() < Number(expression.emojiChance || 0) ? 1 : 0;
    const recentOpenings = new Set(this.state.expressionHistory.slice(0, 5).map((entry) => entry.opening).filter(Boolean));
    const openingPool = (expression.openings?.[mode] || []).filter((entry) => !recentOpenings.has(entry));
    const opening = openingPool.length && this.random() < Number(expression.openingChance ?? 0.36)
      ? openingPool[Math.floor(this.random() * openingPool.length)]
      : null;
    const ending = expression.endings?.length && this.random() < Number(expression.endingChance ?? 0.14)
      ? expression.endings[Math.floor(this.random() * expression.endings.length)]
      : null;
    const slangPool = uniq([
      ...(expression.slang?.[mode] || []),
      ...(mode === "deadpan" ? expression.slang?.understatement || [] : []),
      ...(expression.slang?.general || [])
    ], 80);
    const shuffledSlang = slangPool.map((entry) => [this.random(), entry]).sort((a, b) => a[0] - b[0]).slice(0, 6).map(([, entry]) => entry);
    return {
      mode,
      energy,
      slangLevel,
      emojiBudget,
      lowercase: true,
      sentenceCount: cadence === "expanded" ? 2 : 1,
      directAddress: Boolean(directAddress),
      cadence,
      allowFragments: cadence === "fragment",
      allowOneWordReply: family === "reply" && cadence === "fragment",
      opening,
      ending,
      slangPalette: shuffledSlang,
      slangBudget: { maxPhrases: slangLevel, maxEmoji: emojiBudget, maxInternetWords: slangLevel + 1 },
      purpose: thought ? { belief: thought.belief, tension: thought.tension, unresolvedQuestion: thought.unresolvedQuestion, confidence: thought.confidence } : null,
      avoid: {
        recentOpenings: [...recentOpenings],
        recentCadences: [...recentCadences],
        recentTopics: this.state.expressionHistory.slice(0, 6).map((entry) => entry.topic).filter(Boolean)
      }
    };
  }

  validateDraft(text, plan = {}) {
    const value = clean(text, 1000);
    const lower = value.toLowerCase();
    if (!value) return "empty draft";
    if (value.length > 280) return "draft exceeds 280 characters";
    for (const combination of this.config.expression?.tooAiCombinations || []) {
      if (combination.every((term) => lower.includes(String(term).toLowerCase()))) return `too-AI phrase combination: ${combination.join(" + ")}`;
    }
    const recent = this.state.expressionHistory.slice(0, 10);
    if (recent.some((entry) => clean(entry.text, 1000).toLowerCase() === lower)) return "exact recent draft repetition";
    if (words(value).length >= 7 && recent.some((entry) => similarity(entry.text, value) >= 0.72)) return "draft is too similar to a recent expression";
    const firstTwo = words(value).slice(0, 2).join(" ");
    if (firstTwo && recent.slice(0, 5).filter((entry) => entry.firstWords === firstTwo).length >= 1) return "opening cadence repeats a recent post";
    const emojiCount = (value.match(/[\u{1F300}-\u{1FAFF}]/gu) || []).length;
    if (emojiCount > Number(plan.slangBudget?.maxEmoji ?? plan.emojiBudget ?? 1)) return "emoji budget exceeded";
    const allSlang = Object.values(this.config.expression?.slang || {}).flat();
    const usedSlang = allSlang.filter((phrase) => lower.includes(String(phrase).toLowerCase()));
    if (usedSlang.length > Number(plan.slangBudget?.maxPhrases ?? 2)) return "slang budget exceeded";
    const count = words(value).length;
    if (plan.cadence === "fragment" && count > 9) return "fragment cadence exceeded 9 words";
    if (plan.cadence === "short" && (count < 3 || count > 22)) return "short cadence should be 3 to 22 words";
    if (plan.cadence === "expanded" && count > 52) return "expanded cadence exceeded 52 words";
    return "";
  }

  registerExpression({ thoughtId = null, topic = null, text, plan = {}, postId = null, engagement = null } = {}) {
    const timestamp = nowIso(this.now());
    const value = clean(text, 320);
    const firstWords = words(value).slice(0, 2).join(" ");
    this.state.expressionHistory.unshift({
      id: postId || `expression-${hash(`${timestamp}:${value}`)}`,
      thoughtId,
      topic: topic || null,
      text: value,
      mode: plan.mode || null,
      cadence: plan.cadence || null,
      opening: plan.opening || null,
      firstWords,
      wordCount: words(value).length,
      lineBreaks: (String(text || "").match(/\n/g) || []).length,
      slangLevel: plan.slangLevel ?? null,
      engagement,
      createdAt: timestamp
    });
    this.state.expressionHistory = this.state.expressionHistory.slice(0, 200);
    const thought = this.state.activeThoughts.find((entry) => entry.id === thoughtId);
    if (thought) {
      thought.lastExpressedAt = timestamp;
      thought.expressionCount = Number(thought.expressionCount || 0) + 1;
      thought.expressionPressure = clamp((thought.expressionPressure || 0) * 0.2);
    }
    this.save();
  }

  deterministicFilter(post = {}) {
    const text = clean(post.text, 1000);
    const lower = text.toLowerCase();
    if (!text) return { accepted: false, reason: "empty" };
    if (/^https?:\/\/\S+$/i.test(text)) return { accepted: false, reason: "link_only" };
    if ((text.match(/\$[a-z0-9_]+/gi) || []).length >= 4) return { accepted: false, reason: "cashtag_spam" };
    if ((text.match(/#[a-z0-9_]+/gi) || []).length >= 5) return { accepted: false, reason: "hashtag_spam" };
    if ((text.match(/@[a-z0-9_]+/gi) || []).length >= 6) return { accepted: false, reason: "mention_spam" };
    const spamTerms = [...(this.config.research?.spamTerms || []), ...(this.config.research?.promotionalPatterns || [])];
    if (spamTerms.some((term) => lower.includes(String(term).toLowerCase()))) return { accepted: false, reason: "promotional_spam" };
    const semantic = lower.replace(/https?:\/\/\S+/g, "").replace(/[@#$][a-z0-9_]+/g, "").replace(/[^a-z0-9?]+/g, "").trim();
    if (semantic.length < 5 && !text.includes("?")) return { accepted: false, reason: "isolated_keyword" };
    if (text.length < 10 && !text.includes("?")) return { accepted: false, reason: "low_content" };
    return { accepted: true, reason: "accepted" };
  }

  recordDiscovery(post = {}) {
    const xPostId = clean(post.xPostId || post.id, 120);
    if (!xPostId) throw new Error("discovered post needs an X post id");
    const existing = this.state.discoveries.find((entry) => entry.xPostId === xPostId);
    if (existing) return { created: false, discovery: existing };
    const timestamp = nowIso(this.now());
    const discovery = {
      id: `discovery-${hash(xPostId)}`,
      xPostId,
      conversationId: clean(post.conversationId, 120) || null,
      parentPostId: clean(post.parentPostId, 120) || null,
      quotedPostId: clean(post.quotedPostId, 120) || null,
      authorHandle: clean(post.authorHandle, 80),
      text: clean(post.text, 1200),
      metrics: post.metrics && typeof post.metrics === "object" ? post.metrics : {},
      watcherId: clean(post.watcherId, 140),
      context: Array.isArray(post.context) ? post.context.slice(0, 8) : [],
      analysis: null,
      decision: "PENDING",
      filterReason: null,
      postedAt: post.postedAt || null,
      discoveredAt: timestamp,
      processedAt: null
    };
    this.state.discoveries.unshift(discovery);
    this.state.discoveries = this.state.discoveries.slice(0, this.config.thoughts?.maxDiscoveries || 400);
    this.save();
    return { created: true, discovery };
  }

  updateDiscovery(id, patch = {}) {
    const discovery = this.state.discoveries.find((entry) => entry.id === id || entry.xPostId === id);
    if (!discovery) return null;
    Object.assign(discovery, patch, { processedAt: patch.processedAt || nowIso(this.now()) });
    this.save();
    return JSON.parse(JSON.stringify(discovery));
  }

  addEngagementCandidate(input = {}) {
    if (this.state.engagementCandidates.some((entry) => entry.discoveredPostId === input.discoveredPostId)) return null;
    const timestamp = nowIso(this.now());
    const candidate = {
      id: `candidate-${hash(`${input.discoveredPostId}:${input.action}`)}`,
      discoveredPostId: input.discoveredPostId,
      thoughtId: input.thoughtId || null,
      action: input.action || "OBSERVE_ONLY",
      reason: clean(input.reason, 500),
      draftText: clean(input.draftText, 320) || null,
      scores: input.scores && typeof input.scores === "object" ? input.scores : {},
      status: input.status || "PENDING",
      createdAt: timestamp,
      updatedAt: timestamp
    };
    this.state.engagementCandidates.unshift(candidate);
    this.state.engagementCandidates = this.state.engagementCandidates.slice(0, this.config.thoughts?.maxCandidates || 160);
    this.save();
    return candidate;
  }

  updateCandidate(id, patch = {}) {
    const candidate = this.state.engagementCandidates.find((entry) => entry.id === id);
    if (!candidate) return null;
    Object.assign(candidate, patch, { updatedAt: nowIso(this.now()) });
    this.save();
    return JSON.parse(JSON.stringify(candidate));
  }

  dueWatcher(type, at = this.now()) {
    return this.state.watchers
      .filter((entry) => entry.enabled !== false && (!type || entry.type === type))
      .filter((entry) => !entry.backoffUntil || new Date(entry.backoffUntil).getTime() <= at)
      .sort((a, b) => {
        const aTime = new Date(a.lastPolledAt || 0).getTime();
        const bTime = new Date(b.lastPolledAt || 0).getTime();
        if (aTime !== bTime) return aTime - bTime;
        return Number(b.priority || 0) - Number(a.priority || 0);
      })[0] || null;
  }

  markWatcher(id, patch = {}) {
    const watcher = this.state.watchers.find((entry) => entry.id === id);
    if (!watcher) return null;
    Object.assign(watcher, patch, { lastPolledAt: patch.lastPolledAt || nowIso(this.now()) });
    this.save();
    return JSON.parse(JSON.stringify(watcher));
  }

  cleanup() {
    const now = this.now();
    const staleObservation = now - 14 * 24 * 60 * 60 * 1000;
    this.state.observations = this.state.observations.filter((entry) => new Date(entry.createdAt || 0).getTime() >= staleObservation);
    for (const thought of this.state.activeThoughts) {
      const ageDays = Math.max(0, now - new Date(thought.updatedAt || now).getTime()) / 86400000;
      if (ageDays > 3 && !(thought.evidenceFor?.length || thought.evidenceAgainst?.length)) thought.confidence = clamp(thought.confidence - 0.02);
    }
    this.save();
  }

  publicSnapshot() {
    return {
      version: this.state.version,
      updatedAt: this.state.updatedAt,
      mood: this.state.mood,
      styleState: this.state.styleState,
      currentPriorities: this.state.currentPriorities,
      activeThoughts: this.state.activeThoughts.slice(0, 24).map((thought) => ({ ...thought, currentPressure: this.expressionPressure(thought), evidence: this.evidenceForThought(thought).slice(0, 5) })),
      unresolvedQuestions: this.state.unresolvedQuestions.slice(0, 24),
      recentSurprises: this.state.recentSurprises.slice(0, 20),
      changedBeliefs: this.state.changedBeliefs.slice(0, 20),
      expressionHistory: this.state.expressionHistory.slice(0, 30),
      watchers: this.state.watchers,
      discoveries: this.state.discoveries.slice(0, 60),
      engagementCandidates: this.state.engagementCandidates.slice(0, 60)
    };
  }
}

module.exports = { XMind, similarity, weightedChoice };
