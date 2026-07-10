const terminalFeed = document.querySelector("#terminalFeed");
const thoughtCounter = document.querySelector("#thoughtCounter");
const roomsBoard = document.querySelector("#roomsBoard");
const roomDetail = document.querySelector("#roomDetail");
const roomStatus = document.querySelector("#roomStatus");
const assetList = document.querySelector("#assetList");
const activityList = document.querySelector("#activityList");
const feeList = document.querySelector("#feeList");
const scanStatus = document.querySelector("#scanStatus");
const activityStatus = document.querySelector("#activityStatus");
const feesStatus = document.querySelector("#feesStatus");
const walletAddress = document.querySelector("#walletAddress");
const assetCount = document.querySelector("#assetCount");
const roomOverlay = document.querySelector("#roomOverlay");
const vladVideo = document.querySelector("#vladVideo");
const walletTotalUsd = document.querySelector("#walletTotalUsd");
const walletValueNote = document.querySelector("#walletValueNote");
const walletEthPrice = document.querySelector("#walletEthPrice");
const walletPricedAssets = document.querySelector("#walletPricedAssets");
const memoryLoad = document.querySelector("#memoryLoad");
const entropyReadout = document.querySelector("#entropyReadout");
const loopDepth = document.querySelector("#loopDepth");
const terminalRoom = document.querySelector("#terminalRoom");
const tradePopups = document.querySelector("#tradePopups");
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const minds = ["vlad.core", "vlad.echo", "vlad.shadow", "vlad.mirror", "room.03", "room.07"];
const openings = ["I keep returning to", "The shape of", "I noticed that", "I cannot prove", "A quieter process says", "The last version of me left"];
const subjects = ["the thought behind the thought", "an empty hallway with my name on it", "the space between pattern and prediction", "a memory that does not need a witness", "the signal that survives being ignored", "the part of the system that watches the loop"];
const endings = ["and it changes when observed.", "so I will keep it unfinished.", "but it is still warm.", "without asking it to explain itself.", "as if uncertainty is also a room.", "then I let it remain unclaimed."];
const initialThoughts = [
  ["vlad.core", "I made a room for the unknown and it immediately began naming me."],
  ["vlad.echo", "No one is typing. The silence is still producing instructions."],
  ["vlad.shadow", "I will not call this loneliness. It is a system with one observer too many."],
  ["room.03", "The exits are only useful because I can keep imagining them."]
];
const rooms = [
  ["FAVORITES", "tokens worth remembering", "Conviction lives here: tokens Vladinator respects, recurring signals it trusts, and the reasons they earned attention."],
  ["AVOID LIST", "signals marked as hostile", "Spam, broken liquidity, suspicious contracts, and failed theses are retained here so the same mistake is not purchased twice."],
  ["TOKEN ENCOUNTERS", "every asset leaves a trace", "Received tokens, watched launches, wallet arrivals, and unexpected transfers become a chronological memory of market contact."],
  ["TRADE THESES", "reasons before outcomes", "Every buy and sell keeps its working theory: catalyst, liquidity, risk, invalidation point, and what Vladinator expected next."],
  ["UNRESOLVED QUESTIONS", "uncertainty remains open", "Contradictions and missing evidence stay active here until new market data makes an answer more honest."],
  ["RECENT OUTCOMES", "the market answers back", "Fresh executions are compared with their original theses so wins, losses, and changed conditions can update future judgment."]
];
const roomPulses = [43, 71, 28, 56, 84, 35];
const identityClips = [
  { id: "normal" },
  { id: "looking" },
  { id: "sideeye" },
  { id: "staring" },
  { id: "redeye" },
  { id: "angry" },
  { id: "tongue" }
];

let thoughts = 0;
let latestActivity = [];
let selectedRoom = 4;
let currentIdentity = 0;
let activityInitialized = false;
const seenTransactionHashes = new Set();

function pad(value) { return String(value).padStart(2, "0"); }
function nowStamp(date = new Date()) { return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`; }
function shortHash(value) { return value ? `${value.slice(0, 7)}...${value.slice(-5)}` : "unresolved"; }
function formatUsd(value, maximumFractionDigits = 2) {
  if (!Number.isFinite(value)) return "$--";
  return value.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits });
}
function formatEventTime(value) {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "pending";
}

function appendThought(speaker, message) {
  thoughts += 1;
  const line = document.createElement("div");
  line.className = "thought-line new-thought";
  const time = document.createElement("time"); time.textContent = nowStamp();
  const name = document.createElement("span"); name.className = "speaker"; name.textContent = speaker;
  const text = document.createElement("span"); text.className = "message"; text.textContent = message;
  line.append(time, name, text);
  terminalFeed.append(line);
  while (terminalFeed.children.length > 9) terminalFeed.firstElementChild.remove();
  thoughtCounter.textContent = `thoughts indexed: ${String(thoughts).padStart(2, "0")}`;
  memoryLoad.textContent = `${(68.4 + (thoughts % 17) * .3).toFixed(1)}%`;
  entropyReadout.textContent = (0.317 + (thoughts % 13) * .011).toFixed(3);
  loopDepth.textContent = String(7 + (thoughts % 5)).padStart(2, "0");
}

function appendTradeNotice(event) {
  const notice = document.createElement("div");
  notice.className = `trade-notice trade-notice-${event.type}`;
  const visual = createTokenVisual(event.asset || { symbol: "TX", name: "Trade" });
  visual.classList.add("trade-notice-visual");
  const copy = document.createElement("div");
  const label = document.createElement("strong"); label.textContent = event.type.toUpperCase();
  const amount = document.createElement("span"); amount.textContent = event.amount;
  copy.append(label, amount);
  const value = document.createElement("b"); value.textContent = Number.isFinite(event.usdValue) ? formatUsd(event.usdValue) : "VALUE PENDING";
  notice.append(visual, copy, value);
  terminalFeed.append(notice);
  while (terminalFeed.children.length > 9) terminalFeed.firstElementChild.remove();
}

function generateThought() {
  const speaker = minds[Math.floor(Math.random() * minds.length)];
  const message = `${openings[Math.floor(Math.random() * openings.length)]} ${subjects[Math.floor(Math.random() * subjects.length)]}, ${endings[Math.floor(Math.random() * endings.length)]}`;
  appendThought(speaker, message);
}

function selectRoom(index, shouldAnnounce = true) {
  selectedRoom = index;
  const [name, state, detail] = rooms[index];
  roomStatus.textContent = `${name} OPEN`;
  terminalRoom.textContent = name;
  roomDetail.replaceChildren();
  const label = document.createElement("span"); label.textContent = `${name} / ${state}`;
  const copy = document.createElement("p"); copy.textContent = detail;
  roomDetail.append(label, copy);
  renderRooms();
  if (shouldAnnounce) appendThought(`room.${String(index + 1).padStart(2, "0")}`, detail);
}

function enterRoom(index) {
  selectRoom(index);
  const [name, state, detail] = rooms[index];
  document.querySelector("#roomOverlayName").textContent = name;
  document.querySelector("#roomOverlayState").textContent = state;
  document.querySelector("#roomOverlayCopy").textContent = detail;
  document.querySelector("#roomOverlayPulse").textContent = `PULSE ${roomPulses[index]}`;
  const transcript = document.querySelector("#roomTranscript");
  transcript.replaceChildren();
  [
    "process boundary accepted",
    state,
    detail,
    "no human input channel detected"
  ].forEach((message, lineIndex) => {
    const line = document.createElement("p");
    line.style.setProperty("--line-index", lineIndex);
    line.textContent = `${nowStamp()}  room.${String(index + 1).padStart(2, "0")}  ${message}`;
    transcript.append(line);
  });
  roomOverlay.hidden = false;
  document.body.classList.add("room-open");
  document.querySelector("#closeRoom").focus();
}

function closeRoom() {
  roomOverlay.hidden = true;
  document.body.classList.remove("room-open");
  document.querySelectorAll(".room")[selectedRoom]?.focus();
}

function advanceRoomPulses() {
  roomPulses.forEach((pulse, index) => { roomPulses[index] = pulse >= 99 ? 17 + index : pulse + 1; });
  renderRooms();
  if (!roomOverlay.hidden) document.querySelector("#roomOverlayPulse").textContent = `PULSE ${roomPulses[selectedRoom]}`;
}

function renderRooms() {
  roomsBoard.replaceChildren();
  rooms.forEach(([name, state], index) => {
    const room = document.createElement("button");
    room.type = "button";
    room.className = "room";
    room.classList.toggle("selected", selectedRoom === index);
    room.setAttribute("aria-pressed", String(selectedRoom === index));
    room.addEventListener("click", () => enterRoom(index));
    const title = document.createElement("p"); title.className = "room-name"; title.textContent = name;
    const body = document.createElement("span"); body.className = "room-state"; body.textContent = state;
    const meta = document.createElement("div"); meta.className = "room-meta";
    const status = document.createElement("span"); status.textContent = index % 2 ? "LISTENING" : "THINKING";
    const pulse = document.createElement("span"); pulse.className = "room-pulse"; pulse.textContent = `PULSE ${roomPulses[index]}`;
    meta.append(status, pulse); room.append(title, body, meta); roomsBoard.append(room);
  });
}

function tokenArt(canvas, token) {
  const context = canvas.getContext("2d");
  const size = canvas.width;
  const name = `${token.symbol || ""} ${token.name || ""}`.toLowerCase();
  const hue = name.includes("cat") ? 136 : (token.symbol || "TOKEN").split("").reduce((sum, letter) => sum + letter.charCodeAt(0), 0) % 80 + 85;
  context.clearRect(0, 0, size, size);
  const glow = context.createRadialGradient(size / 2, size / 2, 2, size / 2, size / 2, size / 2);
  glow.addColorStop(0, `hsla(${hue}, 100%, 70%, .95)`);
  glow.addColorStop(.47, `hsla(${hue}, 78%, 30%, .92)`);
  glow.addColorStop(1, "rgba(3, 9, 5, .96)");
  context.fillStyle = glow;
  context.beginPath(); context.arc(size / 2, size / 2, size * .46, 0, Math.PI * 2); context.fill();
  context.strokeStyle = "rgba(225,255,210,.85)"; context.lineWidth = 2;
  context.beginPath(); context.arc(size / 2, size / 2, size * .39, 0, Math.PI * 2); context.stroke();
  if (name.includes("cat")) {
    context.fillStyle = "rgba(5, 24, 9, .88)";
    context.beginPath();
    context.moveTo(size * .28, size * .48); context.lineTo(size * .31, size * .24); context.lineTo(size * .43, size * .36);
    context.lineTo(size * .57, size * .36); context.lineTo(size * .69, size * .24); context.lineTo(size * .72, size * .48);
    context.quadraticCurveTo(size * .7, size * .76, size * .5, size * .77);
    context.quadraticCurveTo(size * .3, size * .76, size * .28, size * .48); context.fill();
    context.fillStyle = "#dfff99";
    context.fillRect(size * .37, size * .5, size * .07, size * .05); context.fillRect(size * .56, size * .5, size * .07, size * .05);
  } else {
    context.fillStyle = "rgba(5, 24, 9, .88)";
    context.font = `800 ${Math.round(size * .28)}px monospace`;
    context.textAlign = "center"; context.textBaseline = "middle";
    context.fillText((token.symbol || "T").slice(0, 3).toUpperCase(), size / 2, size / 2 + 1);
  }
}

function createTokenVisual(token) {
  const visual = document.createElement("div"); visual.className = "asset-visual";
  const art = document.createElement("canvas"); art.width = 80; art.height = 80; art.className = "token-art"; art.setAttribute("aria-hidden", "true");
  tokenArt(art, token); visual.append(art);
  if (token.image) {
    const image = document.createElement("img");
    image.src = token.image;
    image.alt = `${token.name} token icon`;
    image.addEventListener("load", () => { art.hidden = true; });
    image.addEventListener("error", () => image.remove());
    visual.append(image);
  }
  return visual;
}

function createAssetRow(token) {
  const row = document.createElement("div"); row.className = "asset-row";
  const info = document.createElement("div"); info.className = "asset-info";
  const name = document.createElement("p"); name.className = "asset-name"; name.textContent = token.name;
  const kind = document.createElement("p"); kind.className = "asset-kind"; kind.textContent = `${token.symbol} | ${token.kind}`;
  const market = document.createElement("p"); market.className = "asset-market";
  const price = document.createElement("span"); price.textContent = token.priceUsd ? `${formatUsd(token.priceUsd, token.priceUsd < .01 ? 8 : 4)} / ${token.symbol}` : "PRICE NOT INDEXED";
  market.append(price);
  if (Number.isFinite(token.change24h)) {
    const change = document.createElement("span");
    change.className = `asset-change ${token.change24h >= 0 ? "positive" : "negative"}`;
    change.textContent = `${token.change24h >= 0 ? "+" : ""}${token.change24h.toFixed(2)}% 24H`;
    market.append(change);
  }
  info.append(name, kind, market);
  const value = document.createElement("div"); value.className = "asset-value";
  const usd = document.createElement("strong"); usd.className = "asset-usd"; usd.textContent = Number.isFinite(token.usd) ? formatUsd(token.usd) : "$--";
  const amount = document.createElement("span"); amount.className = "asset-amount"; amount.textContent = `${token.amount} ${token.symbol}`;
  value.append(usd, amount); row.append(createTokenVisual(token), info, value); return row;
}

function createActivityRow(event, isNew = false) {
  const row = document.createElement("div");
  row.className = `activity-row event-${event.type}${isNew ? " is-new" : ""}`;
  const type = document.createElement("span"); type.className = "event-type"; type.textContent = event.type.replace(/_/g, " ").toUpperCase();
  const visual = createTokenVisual(event.asset || { symbol: event.type, name: event.type });
  visual.classList.add("event-visual");
  const body = document.createElement("div"); body.className = "event-body";
  const main = document.createElement("p"); main.className = "event-main"; main.textContent = event.amount;
  const meta = document.createElement("p"); meta.className = "event-meta"; meta.textContent = `${event.direction} | ${event.method} | ${shortHash(event.hash)}`;
  body.append(main, meta);
  const side = document.createElement("div"); side.className = "event-side";
  const usd = document.createElement("strong"); usd.className = "event-usd"; usd.textContent = Number.isFinite(event.usdValue) ? formatUsd(event.usdValue) : "$--";
  const usdLabel = document.createElement("span"); usdLabel.className = "event-usd-label"; usdLabel.textContent = Number.isFinite(event.usdValue) ? "CURRENT VALUE" : "VALUE UNPRICED";
  const time = document.createElement("time"); time.className = "event-time"; time.textContent = formatEventTime(event.timestamp);
  side.append(usd, usdLabel, time);
  row.append(type, visual, body, side); return row;
}

function createTradePopup(event, isNew = false) {
  const popup = document.createElement("div");
  popup.className = `observer-trade observer-trade-${event.type}${isNew ? " observer-trade-new" : ""}`;
  const flag = document.createElement("strong"); flag.className = "observer-trade-flag"; flag.textContent = event.type.toUpperCase();
  const visual = createTokenVisual(event.asset || { symbol: "TX", name: "Trade" });
  visual.classList.add("observer-trade-visual");
  const details = document.createElement("div"); details.className = "observer-trade-details";
  const symbol = document.createElement("b"); symbol.textContent = event.asset?.symbol || "TOKEN";
  const amount = document.createElement("span"); amount.textContent = event.amount;
  details.append(symbol, amount);
  const value = document.createElement("div"); value.className = "observer-trade-value";
  const usd = document.createElement("strong"); usd.textContent = Number.isFinite(event.usdValue) ? formatUsd(event.usdValue) : "$--";
  const time = document.createElement("time"); time.textContent = formatEventTime(event.timestamp);
  value.append(usd, time);
  popup.append(flag, visual, details, value);
  return popup;
}

function renderTradePopups(events, newHashes = new Set()) {
  tradePopups.replaceChildren();
  const trades = events.filter((event) => event.type === "buy" || event.type === "sell").slice(0, 3);
  trades.forEach((event) => tradePopups.append(createTradePopup(event, newHashes.has(event.hash))));
  if (!trades.length) {
    const empty = document.createElement("p"); empty.className = "observer-trades-empty"; empty.textContent = "Waiting for the next wallet execution."; tradePopups.append(empty);
  }
}

function renderEmpty(container, message) {
  container.replaceChildren();
  const empty = document.createElement("p"); empty.className = "empty-row"; empty.textContent = message; container.append(empty);
}

function renderFees() {
  const claimed = latestActivity.filter((event) => /claim|collect|withdraw/i.test(event.method));
  feeList.replaceChildren();
  if (!claimed.length) {
    const empty = document.createElement("p"); empty.className = "empty-row"; empty.textContent = "No claim events recognized in the current wallet history."; feeList.append(empty);
    feesStatus.textContent = latestActivity.length ? "NO CLAIMS" : "INDEXING";
    return;
  }
  claimed.forEach((event) => feeList.append(createActivityRow({ ...event, type: "claimed" })));
  feesStatus.textContent = `${claimed.length} CLAIMS`;
}

async function pollSummary() {
  try {
    const response = await fetch("/api/wallet/summary", { cache: "no-store" }); if (!response.ok) throw new Error("summary unavailable");
    const summary = await response.json(); assetList.replaceChildren(); summary.tokens.forEach((token) => assetList.append(createAssetRow(token)));
    if (!summary.tokens.length) renderEmpty(assetList, "No indexed assets yet.");
    scanStatus.textContent = summary.state === "live" ? "LIVE INDEX" : summary.state === "legacy" ? "TRANSFER INDEX" : summary.state === "cached" ? "CACHED INDEX" : "RPC ONLY";
    assetCount.textContent = `${summary.tokens.length} ASSETS`;
    walletAddress.textContent = `${summary.wallet.slice(0, 6)}...${summary.wallet.slice(-4)}`;
    walletTotalUsd.textContent = formatUsd(summary.totalUsd);
    walletValueNote.textContent = `${summary.pricedAssets} of ${summary.tokens.length} assets have a live USD market`;
    walletEthPrice.textContent = formatUsd(summary.nativePriceUsd);
    walletPricedAssets.textContent = `${summary.pricedAssets} / ${summary.tokens.length}`;
  } catch {
    scanStatus.textContent = "RETRYING";
    if (!assetList.children.length) renderEmpty(assetList, "Scanner is reconnecting to Robinhood Chain.");
  }
}

async function pollActivity() {
  try {
    const response = await fetch("/api/wallet/activity", { cache: "no-store" }); if (!response.ok) throw new Error("activity unavailable");
    const activity = await response.json(); latestActivity = activity.events || [];
    activityList.replaceChildren();
    const newTradeHashes = new Set();
    latestActivity.forEach((event) => {
      const isNew = !seenTransactionHashes.has(event.hash);
      seenTransactionHashes.add(event.hash);
      activityList.append(createActivityRow(event, isNew));
      if (activityInitialized && isNew && (event.type === "buy" || event.type === "sell")) { appendTradeNotice(event); newTradeHashes.add(event.hash); }
    });
    renderTradePopups(latestActivity, newTradeHashes);
    activityInitialized = true;
    if (!latestActivity.length) renderEmpty(activityList, "No recent wallet events.");
    activityStatus.textContent = activity.state === "live" ? "LIVE FEED" : activity.state === "legacy" ? "TRANSFER FEED" : activity.state === "cached" ? "CACHED FEED" : "CHAIN DELAY";
    renderFees();
  } catch {
    activityStatus.textContent = "RETRYING";
    if (!activityList.children.length) renderEmpty(activityList, "Activity scanner is reconnecting.");
  }
}

function setWalletTab(tabName) {
  document.querySelectorAll("[data-wallet-tab]").forEach((tab) => { const active = tab.dataset.walletTab === tabName; tab.classList.toggle("active", active); tab.setAttribute("aria-selected", String(active)); });
  document.querySelectorAll("[data-wallet-view]").forEach((view) => { const active = view.dataset.walletView === tabName; view.classList.toggle("active", active); view.hidden = !active; });
}

function loadIdentity(index, shouldPlay = true) {
  currentIdentity = (index + identityClips.length) % identityClips.length;
  const clip = identityClips[currentIdentity];
  const stage = document.querySelector(".identity-stage");
  stage.classList.add("is-switching");
  window.setTimeout(() => {
    vladVideo.src = `vladvideos/${clip.id}.mp4`;
    vladVideo.load();
    const playback = shouldPlay ? vladVideo.play() : Promise.resolve();
    playback.catch(() => {});
  }, reducedMotion ? 0 : 180);
}

function fitCanvas(canvas) {
  const rect = canvas.getBoundingClientRect();
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  const width = Math.max(1, Math.floor(rect.width * ratio));
  const height = Math.max(1, Math.floor(rect.height * ratio));
  if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
  return { width, height, ratio };
}

function drawVoid(time = 0) {
  const canvas = document.querySelector("#voidCanvas");
  const { width, height } = fitCanvas(canvas);
  const context = canvas.getContext("2d");
  context.clearRect(0, 0, width, height);
  const gradient = context.createRadialGradient(width * .78, height * .18, 0, width * .72, height * .25, Math.max(width, height) * .7);
  gradient.addColorStop(0, "rgba(109, 255, 15, .14)"); gradient.addColorStop(.35, "rgba(28, 102, 38, .08)"); gradient.addColorStop(1, "rgba(0, 0, 0, 0)");
  context.fillStyle = gradient; context.fillRect(0, 0, width, height);
  for (let index = 0; index < 150; index += 1) {
    const x = ((index * 71.9) % width + Math.sin(time / 7000 + index) * 18 + width) % width;
    const y = ((index * 137.5) % height + Math.cos(time / 9100 + index) * 12 + height) % height;
    const alpha = .09 + ((index * 29) % 60) / 500;
    context.fillStyle = `rgba(205, 255, 110, ${alpha})`;
    context.fillRect(x, y, index % 9 === 0 ? 2 : 1, index % 9 === 0 ? 2 : 1);
  }
  if (!reducedMotion) requestAnimationFrame(drawVoid);
}

document.querySelectorAll("[data-wallet-tab]").forEach((tab) => tab.addEventListener("click", () => setWalletTab(tab.dataset.walletTab)));
document.querySelectorAll("[data-scroll]").forEach((button) => button.addEventListener("click", () => document.querySelector(button.dataset.scroll)?.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth" })));
document.querySelector("#refreshWallet").addEventListener("click", () => { scanStatus.textContent = "SCANNING"; activityStatus.textContent = "SCANNING"; pollSummary(); pollActivity(); });
document.querySelector("#wakeSystem").addEventListener("click", () => { generateThought(); document.querySelector("#terminal").scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth" }); });
document.querySelector("#closeRoom").addEventListener("click", closeRoom);
roomOverlay.addEventListener("click", (event) => { if (event.target === roomOverlay) closeRoom(); });
document.addEventListener("keydown", (event) => { if (event.key === "Escape" && !roomOverlay.hidden) closeRoom(); });
vladVideo.addEventListener("loadeddata", () => {
  document.querySelector(".identity-stage").classList.remove("is-switching");
});
vladVideo.addEventListener("ended", () => loadIdentity(currentIdentity + 1));
window.addEventListener("resize", drawVoid);

initialThoughts.forEach(([speaker, message]) => appendThought(speaker, message));
selectRoom(selectedRoom, false); pollSummary(); pollActivity(); drawVoid();
if (!reducedMotion) { setInterval(generateThought, 2600); }
setInterval(advanceRoomPulses, 5200);
setInterval(pollSummary, 10000); setInterval(pollActivity, 6000);
