const form = document.querySelector("#agentForm");
const task = document.querySelector("#task");
const angle = document.querySelector("#angle");
const source = document.querySelector("#source");
const sourceWrap = document.querySelector("#sourceWrap");
const message = document.querySelector("#message");
const drafts = document.querySelector("#drafts");
const template = document.querySelector("#tweetTemplate");
const generate = document.querySelector("#generate");
const eventJson = document.querySelector("#eventJson");
const routeLabel = document.querySelector("#routeLabel");
const routeBadge = document.querySelector("#routeBadge");
const contextLabel = document.querySelector("#contextLabel");
const styleLabel = document.querySelector("#styleLabel");
const outputLabel = document.querySelector("#outputLabel");
const metricGrid = document.querySelector("#metricGrid");
const apiState = document.querySelector("#apiState");
const apiLabel = document.querySelector("#apiLabel");
const mindMetrics = document.querySelector("#mindMetrics");
const thoughtList = document.querySelector("#thoughtList");
const expressionList = document.querySelector("#expressionList");
const researchFlags = document.querySelector("#researchFlags");
const watcherList = document.querySelector("#watcherList");
const candidateList = document.querySelector("#candidateList");
const discoveryList = document.querySelector("#discoveryList");

const modes = {
  latest_trade: { label: "LATEST CONFIRMED TRADE", draftMode: "latest_trade" },
  holding: { label: "CURRENT HOLDING READ", draftMode: "holding" },
  market: { label: "MARKET COMMENT", draftMode: "market" },
  vlad: { label: "$VLAD SIGNAL", draftMode: "vlad" },
  reply: { label: "DIRECT REPLY", type: "reply_mention" },
  random_reply: { label: "RANDOM TIMELINE REPLY", type: "reply_mention", randomSource: true },
  quote: { label: "QUOTE TWEET", type: "quote_mention" },
  sample_buy: { label: "SAMPLE BUY / SIMULATION", type: "trade", sampleTrade: "buy" },
  sample_sell: { label: "SAMPLE SELL / SIMULATION", type: "trade", sampleTrade: "sell" },
  own_robinhood_chain: { label: "ROBINHOOD CHAIN THOUGHT", draftMode: "own_robinhood_chain" },
  own_pumpfun: { label: "PUMP.FUN ROAST", draftMode: "own_pumpfun" },
  own_vladtenev: { label: "VLAD TENEV BIT", draftMode: "own_vladtenev" },
  own_ansem: { label: "ANSEM THOUGHT", draftMode: "own_ansem" },
  own_blackbull: { label: "BLACK BULL THOUGHT", draftMode: "own_blackbull" },
  own_vlad: { label: "$VLAD ONE-LINER", draftMode: "own_vlad" }
};

const replySamples = [
  { author: "chartgremlin", text: "are you actually trading the wallet or just reading receipts?" },
  { author: "bagholder9000", text: "what would you buy next on robinhood chain" },
  { author: "timelinewatcher", text: "nah i don't believe this thing has opinions" },
  { author: "stonksposter", text: "buy more gme then" },
  { author: "cashcatfan", text: "can you please sell the other cashcat" },
  { author: "supplydrop", text: "we sent you some supply of crackhead" },
  { author: "metricsmerchant", text: "why should anyone care about robinhood chain" },
  { author: "pumprefresher", text: "pumpfun is still the only place that matters bro" },
  { author: "lateentry", text: "are you actual vlad?" },
  { author: "mcapenjoyer", text: "what do you even look for before you ape?" }
];

const money = (value) => Number.isFinite(Number(value))
  ? `$${Number(value).toLocaleString("en-US", { maximumFractionDigits: 2 })}`
  : "--";
const percent = (value) => Number.isFinite(Number(value)) ? `${Number(value) >= 0 ? "+" : ""}${Number(value).toFixed(2)}%` : "--";
const compact = (value, length = 220) => String(value || "").replace(/\s+/g, " ").trim().slice(0, length);
const formatTime = (value) => {
  const date = new Date(value || 0);
  return Number.isFinite(date.getTime()) && date.getTime() > 0
    ? date.toLocaleString([], { month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" })
    : "NEVER";
};

let inspectionSignature = "";

function el(tag, className = "", text = "") {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined && text !== null) node.textContent = text;
  return node;
}

function setMessage(text, error = false) {
  message.textContent = text;
  message.classList.toggle("error", error);
}

function replySample() {
  return replySamples[Math.floor(Math.random() * replySamples.length)];
}

function updateTask() {
  const needsSource = ["reply", "random_reply", "quote"].includes(task.value);
  const autoSource = task.value === "random_reply";
  sourceWrap.hidden = !needsSource;
  source.required = ["reply", "quote"].includes(task.value);
  source.readOnly = autoSource;
  source.placeholder = autoSource
    ? "A randomized source post will be loaded when you generate."
    : "paste a post to reply to or quote";
  if (autoSource && !source.value.trim()) source.value = replySample().text;
}

function clearEmpty() {
  drafts.querySelector(".empty-state")?.remove();
}

function addDraft(label, kind, text) {
  if (!text) return;
  clearEmpty();
  const node = template.content.firstElementChild.cloneNode(true);
  const area = node.querySelector(".tweet-text");
  const count = node.querySelector(".tweet-count");
  node.querySelector(".tweet-route").textContent = label;
  node.querySelector(".tweet-kind").textContent = kind;
  area.value = text;
  const sync = () => { count.textContent = `${area.value.length} / 280`; };
  area.addEventListener("input", sync);
  sync();
  drafts.prepend(node);
}

function setMetric(index, label, value, tone = "") {
  const cell = metricGrid.children[index];
  cell.querySelector("span").textContent = label;
  const strong = cell.querySelector("strong");
  strong.textContent = value;
  strong.className = tone;
}

function renderContext(data) {
  const context = data.eventContext || {};
  routeLabel.textContent = (data.route || "standby").replace(/_/g, " ").toUpperCase();
  routeBadge.textContent = routeLabel.textContent;
  contextLabel.textContent = context.event_status ? context.event_status.toUpperCase() : "CONTEXT ONLY";
  styleLabel.textContent = `${data.styleReferenceCount || 0} REFERENCES`;
  outputLabel.textContent = data.followUpTweet ? "TWEET PAIR" : "SINGLE TWEET";
  setMetric(0, "WALLET VALUE", money(context.wallet_value_usd));
  setMetric(1, "TRADE VALUE", money(context.trade_value_usd));
  setMetric(2, "DAILY PNL", percent(context.daily_pnl_percent), Number(context.daily_pnl_percent) < 0 ? "bad" : Number(context.daily_pnl_percent) > 0 ? "good" : "");
  setMetric(3, "POSITION PNL", percent(context.position_pnl_percent), Number(context.position_pnl_percent) < 0 ? "bad" : Number(context.position_pnl_percent) > 0 ? "good" : "");
  eventJson.textContent = JSON.stringify(context, null, 2);
}

async function run(config) {
  const isConversation = config.type === "reply_mention" || config.type === "quote_mention";
  const sample = config.randomSource ? replySample() : null;
  if (sample) source.value = sample.text;
  const sourcePost = isConversation ? source.value.trim() : "";
  if (isConversation && !sourcePost) throw new Error("Paste a source post first.");
  const brief = [angle.value.trim(), sourcePost ? `Source post: ${sourcePost}` : ""].filter(Boolean).join("\n");
  const payload = {
    generate: true,
    dryRun: true,
    text: brief || "Generate from current verified context.",
    type: config.type || "routine",
    draftMode: config.draftMode,
    sampleTrade: config.sampleTrade,
    sourcePost: sourcePost || undefined,
    sourceAuthor: sample?.author
  };
  const response = await fetch("/api/x/tweet", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  });
  const data = await response.json();
  if (!response.ok || !data.ok) throw new Error(data.error || "The draft engine did not respond.");
  renderContext(data);
  addDraft(config.label, "FOLLOW-UP", data.followUpTweet);
  addDraft(config.label, "MAIN TWEET", data.text);
  return data;
}

function renderMind(data) {
  const thoughts = data.activeThoughts || [];
  const expressions = data.expressionHistory || [];
  const values = [
    thoughts.length,
    data.automation?.mind?.observations || 0,
    (data.unresolvedQuestions || []).filter((entry) => entry.status === "open").length,
    expressions.length
  ];
  [...mindMetrics.children].forEach((cell, index) => { cell.querySelector("strong").textContent = values[index]; });

  thoughtList.replaceChildren();
  if (!thoughts.length) thoughtList.append(el("p", "inspect-empty", "No active thoughts yet."));
  for (const thought of thoughts.slice(0, 12)) {
    const item = el("article", "inspect-item thought-item");
    const head = el("div", "inspect-item-head");
    head.append(el("strong", "inspect-topic", String(thought.topic || "UNTITLED").toUpperCase()));
    head.append(el("span", "pressure", `${Math.round(Number(thought.currentPressure || 0) * 100)} PRESSURE`));
    item.append(head);
    item.append(el("p", "inspect-copy", thought.belief || "No developed belief yet."));
    if (thought.tension) item.append(el("p", "inspect-note", `TENSION / ${thought.tension}`));
    const meta = el("div", "inspect-meta");
    meta.append(el("span", "", `${Math.round(Number(thought.confidence || 0) * 100)}% CONFIDENCE`));
    meta.append(el("span", "", `${(thought.evidence || []).length} SOURCES`));
    meta.append(el("span", "", formatTime(thought.updatedAt)));
    item.append(meta);
    thoughtList.append(item);
  }

  expressionList.replaceChildren();
  if (!expressions.length) expressionList.append(el("p", "inspect-empty", "No published expression memory yet."));
  for (const expression of expressions.slice(0, 12)) {
    const item = el("article", "inspect-item expression-item");
    const head = el("div", "inspect-item-head");
    head.append(el("strong", "inspect-topic", `${expression.mode || "POST"} / ${expression.cadence || "FREE"}`.toUpperCase()));
    head.append(el("span", "", `${expression.wordCount || 0} WORDS`));
    item.append(head, el("p", "inspect-copy", expression.text));
    const meta = el("div", "inspect-meta");
    meta.append(el("span", "", expression.topic || "NO TOPIC"));
    meta.append(el("span", "", formatTime(expression.createdAt)));
    item.append(meta);
    expressionList.append(item);
  }
}

function flag(label, active, warning = false) {
  return el("span", `research-flag ${active ? (warning ? "warning" : "on") : "off"}`, `${label}: ${active ? "ON" : "OFF"}`);
}

function renderResearch(data) {
  const discoveries = data.discoveries || [];
  const discoveryById = new Map(discoveries.map((entry) => [entry.id, entry]));
  researchFlags.replaceChildren(
    flag("RESEARCH", data.enabled),
    flag("DRY RUN", data.dryRun, data.dryRun),
    flag("AUTO REPLY", data.autoReply),
    flag("AUTO QUOTE", data.autoQuote)
  );

  watcherList.replaceChildren();
  if (!(data.watchers || []).length) watcherList.append(el("p", "inspect-empty", "No watchers configured."));
  for (const watcher of (data.watchers || [])) {
    const item = el("article", "inspect-item watcher-item");
    const head = el("div", "inspect-item-head");
    head.append(el("strong", "inspect-topic", watcher.name || watcher.id));
    head.append(el("span", watcher.lastError ? "status-bad" : "", watcher.lastError ? "BACKOFF" : watcher.enabled === false ? "OFF" : "READY"));
    item.append(head, el("p", "inspect-copy", watcher.query));
    const meta = el("div", "inspect-meta");
    meta.append(el("span", "", watcher.type));
    meta.append(el("span", "", `PRIORITY ${watcher.priority}`));
    meta.append(el("span", "", formatTime(watcher.lastPolledAt)));
    item.append(meta);
    if (watcher.lastError) item.append(el("p", "inspect-note status-bad", compact(watcher.lastError, 180)));
    watcherList.append(item);
  }

  candidateList.replaceChildren();
  const candidates = (data.candidates || []).filter((entry) => entry.status === "PENDING").slice(0, 12);
  if (!candidates.length) candidateList.append(el("p", "inspect-empty", "No pending engagement candidates."));
  for (const candidate of candidates) {
    const discovery = discoveryById.get(candidate.discoveredPostId) || {};
    const item = el("article", "inspect-item candidate-item");
    const head = el("div", "inspect-item-head");
    head.append(el("strong", "inspect-topic", candidate.action));
    head.append(el("span", "", discovery.authorHandle ? `@${discovery.authorHandle}` : "UNKNOWN SOURCE"));
    item.append(head, el("p", "inspect-copy", discovery.text || candidate.reason));
    item.append(el("p", "inspect-note", candidate.reason));
    const actions = el("div", "candidate-actions");
    for (const [action, label] of [["approve", "APPROVE"], ["observe", "OBSERVE"], ["reject", "REJECT"], ["ignore", "IGNORE"]]) {
      const button = el("button", `candidate-button ${action}`, label);
      button.type = "button";
      button.dataset.candidateId = candidate.id;
      button.dataset.action = action;
      actions.append(button);
    }
    item.append(actions);
    candidateList.append(item);
  }

  discoveryList.replaceChildren();
  if (!discoveries.length) discoveryList.append(el("p", "inspect-empty", "No posts discovered yet."));
  for (const discovery of discoveries.slice(0, 18)) {
    const item = el("article", "inspect-item discovery-item");
    const head = el("div", "inspect-item-head");
    head.append(el("strong", "inspect-topic", discovery.authorHandle ? `@${discovery.authorHandle}` : "UNKNOWN"));
    head.append(el("span", `decision decision-${String(discovery.decision || "pending").toLowerCase()}`, discovery.decision || "PENDING"));
    item.append(head, el("p", "inspect-copy", discovery.text));
    const reason = discovery.filterReason || discovery.analysis?.action_reason || discovery.analysis?.literal_claim;
    if (reason) item.append(el("p", "inspect-note", compact(reason, 260)));
    const meta = el("div", "inspect-meta");
    meta.append(el("span", "", discovery.analysis?.factual_status || "UNCLASSIFIED"));
    meta.append(el("span", "", discovery.watcherId || "NO WATCHER"));
    meta.append(el("span", "", formatTime(discovery.discoveredAt)));
    item.append(meta);
    discoveryList.append(item);
  }
}

async function refreshInspection(force = false) {
  try {
    const [mindResponse, researchResponse] = await Promise.all([fetch("/api/x/mind"), fetch("/api/x/research")]);
    if (!mindResponse.ok || !researchResponse.ok) throw new Error("Inspection endpoints are unavailable.");
    const [mindData, researchData] = await Promise.all([mindResponse.json(), researchResponse.json()]);
    const signature = JSON.stringify([mindData.updatedAt, researchData.nextAccountPollAt, researchData.discoveries?.[0]?.processedAt, researchData.candidates?.[0]?.updatedAt]);
    if (!force && signature === inspectionSignature) return;
    inspectionSignature = signature;
    renderMind(mindData);
    renderResearch(researchData);
  } catch (error) {
    thoughtList.replaceChildren(el("p", "inspect-empty status-bad", error.message));
    watcherList.replaceChildren(el("p", "inspect-empty status-bad", error.message));
  }
}

async function reviewCandidate(button) {
  const { candidateId, action } = button.dataset;
  button.disabled = true;
  try {
    const response = await fetch("/api/x/research/action", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ candidateId, action, publish: false })
    });
    const data = await response.json();
    if (!response.ok || !data.ok) throw new Error(data.error || "Review action failed.");
    setMessage(`${action.toUpperCase()} saved. Nothing published.`);
    inspectionSignature = "";
    await refreshInspection(true);
  } catch (error) {
    setMessage(error.message, true);
    button.disabled = false;
  }
}

async function refreshStatus() {
  try {
    const response = await fetch("/api/x/status");
    const data = await response.json();
    if (data.backendPaused) {
      apiState.className = "signal";
      apiLabel.textContent = "BACKEND PAUSED";
    } else if (data.configured) {
      apiState.className = "signal live";
      apiLabel.textContent = "BACKEND READY";
    } else {
      apiState.className = "signal error";
      apiLabel.textContent = "BACKEND UNCONFIGURED";
    }
  } catch {
    apiState.className = "signal error";
    apiLabel.textContent = "BACKEND OFFLINE";
  }
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const config = modes[task.value];
  generate.disabled = true;
  setMessage("Generating from live backend context...");
  try {
    const data = await run(config);
    setMessage(data.followUpTweet ? "Trade pair generated. Nothing posted." : "Draft generated. Nothing posted.");
  } catch (error) {
    setMessage(error.message, true);
  } finally {
    generate.disabled = false;
  }
});

task.addEventListener("change", updateTask);
document.querySelector("#surprise").addEventListener("click", () => {
  const choices = Object.keys(modes).filter((name) => name !== "reply" && name !== "quote");
  task.value = choices[Math.floor(Math.random() * choices.length)];
  angle.value = "";
  source.value = "";
  updateTask();
});
document.querySelector("#randomReply").addEventListener("click", async () => {
  task.value = "random_reply";
  source.value = "";
  updateTask();
  setMessage("Generating a randomized timeline reply...");
  try {
    await run(modes.random_reply);
    setMessage("Reply example generated. Nothing posted.");
  } catch (error) {
    setMessage(error.message, true);
  }
});
document.querySelector("#runSet").addEventListener("click", async () => {
  const set = ["sample_buy", "own_robinhood_chain", "random_reply", "own_pumpfun", "sample_sell", "random_reply"];
  setMessage("Generating an example pack...");
  for (const name of set) {
    task.value = name;
    source.value = "";
    updateTask();
    try {
      await run(modes[name]);
    } catch (error) {
      setMessage(error.message, true);
      return;
    }
  }
  setMessage("Example pack generated. Nothing posted.");
});
document.querySelector("#refreshInspection").addEventListener("click", () => refreshInspection(true));
document.querySelectorAll(".view-tab").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".view-tab").forEach((tab) => {
      const active = tab === button;
      tab.classList.toggle("active", active);
      tab.setAttribute("aria-selected", String(active));
    });
    document.querySelectorAll(".inspection-view").forEach((view) => {
      const active = view.id === `${button.dataset.view}View`;
      view.classList.toggle("active", active);
      view.hidden = !active;
    });
  });
});
candidateList.addEventListener("click", (event) => {
  const button = event.target.closest(".candidate-button");
  if (button) reviewCandidate(button);
});

updateTask();
refreshStatus();
refreshInspection(true);
setInterval(() => {
  if (!document.hidden) {
    refreshStatus();
    refreshInspection();
  }
}, 30000);
