const terminalFeed = document.querySelector("#terminalFeed");
const thoughtCounter = document.querySelector("#thoughtCounter");
const roomsBoard = document.querySelector("#roomsBoard");
const roomDetail = document.querySelector("#roomDetail");
const roomStatus = document.querySelector("#roomStatus");
const atlasRoomIndex = document.querySelector("#atlasRoomIndex");
const atlasInspector = document.querySelector("#atlasInspector");
const atlasOccupied = document.querySelector("#atlasOccupied");
const atlasArchived = document.querySelector("#atlasArchived");
const atlasLore = document.querySelector("#atlasLore");
const atlasMapMode = document.querySelector("#atlasMapMode");
const assetList = document.querySelector("#assetList");
const activityList = document.querySelector("#activityList");
const feeList = document.querySelector("#feeList");
const scanStatus = document.querySelector("#scanStatus");
const activityStatus = document.querySelector("#activityStatus");
const feesStatus = document.querySelector("#feesStatus");
const walletAddress = document.querySelector("#walletAddress");
const copyWallet = document.querySelector("#copyWallet");
const assetCount = document.querySelector("#assetCount");
const roomOverlay = document.querySelector("#roomOverlay");
const accessOverlay = document.querySelector("#accessOverlay");
const vladVideo = document.querySelector("#vladVideo");
const vladVideoBuffer = document.querySelector("#vladVideoBuffer");
const walletTotalUsd = document.querySelector("#walletTotalUsd");
const walletPnlBlock = document.querySelector("#walletPnlBlock");
const walletPnl = document.querySelector("#walletPnl");
const walletPnlPercent = document.querySelector("#walletPnlPercent");
const walletDailyChange = document.querySelector("#walletDailyChange");
const walletRealizedPnl = document.querySelector("#walletRealizedPnl");
const walletValueNote = document.querySelector("#walletValueNote");
const walletEthPrice = document.querySelector("#walletEthPrice");
const walletPricedAssets = document.querySelector("#walletPricedAssets");
const memoryLoad = document.querySelector("#memoryLoad");
const entropyReadout = document.querySelector("#entropyReadout");
const loopDepth = document.querySelector("#loopDepth");
const terminalRoom = document.querySelector("#terminalRoom");
const tradePopups = document.querySelector("#tradePopups");
const shillForm = document.querySelector("#shillForm");
const shillFeed = document.querySelector("#shillFeed");
const shillCount = document.querySelector("#shillCount");
const shillStatus = document.querySelector("#shillStatus");
const shillPfp = document.querySelector("#shillPfp");
const shillPfpPreview = document.querySelector("#shillPfpPreview");
const xPostRail = document.querySelector("#xPostRail");
const xThreadRail = document.querySelector("#xThreadRail");
const xPostCount = document.querySelector("#xPostCount");
const xThreadCount = document.querySelector("#xThreadCount");
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
let selectedShillKind = "shill";
let shillPfpData = "";
let shillPollInFlight = false;
let lastShillSignature = "";
let xFeedPollInFlight = false;
let lastXFeedSignature = "";
const xRailVideoObserver = "IntersectionObserver" in window
  ? new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      const video = entry.target;
      if (entry.isIntersecting) video.play().catch(() => {});
      else video.pause();
    });
  }, { rootMargin: "120px 0px" })
  : null;

let rooms = [
  { name: "FAVORITES", state: "waiting for evidence", detail: "No durable memory has been written here yet.", entries: [] },
  { name: "AVOID LIST", state: "waiting for evidence", detail: "No durable memory has been written here yet.", entries: [] },
  { name: "TOKEN ENCOUNTERS", state: "waiting for evidence", detail: "No durable memory has been written here yet.", entries: [] },
  { name: "TRADE THESES", state: "waiting for evidence", detail: "No durable memory has been written here yet.", entries: [] },
  { name: "UNRESOLVED QUESTIONS", state: "waiting for evidence", detail: "No durable memory has been written here yet.", entries: [] },
  { name: "RECENT OUTCOMES", state: "waiting for evidence", detail: "No durable memory has been written here yet.", entries: [] }
];
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
let latestWalletSummary = { totalUsd: 0, tokens: [] };
let latestMindSnapshot = { activeThoughts: [], unresolvedQuestions: [] };
let backendPaused = false;
let lastAtlasSignature = "";
let selectedAtlasToken = null;
let selectedRoom = 4;
let currentIdentity = 0;
let speaking = false;
let activeVladVideo = vladVideo;
let standbyVladVideo = vladVideoBuffer;
let videoSwapSequence = 0;
let speechBlocked = false;
let welcomeShown = false;
let welcomeAudioQueued = false;
let welcomeLoadAttempts = 0;
let activityInitialized = false;
let aiStream;
let fullWalletAddress = "";
const seenTransactionHashes = new Set();
const aiLineIds = new Set();
const speechQueue = [];

const atlasRoomStyles = [
  { color: "#b9f45b", fill: "#203512", code: "FAV", role: "CONVICTION" },
  { color: "#d06b72", fill: "#351417", code: "AVD", role: "QUARANTINE" },
  { color: "#55cdb1", fill: "#12342d", code: "ENC", role: "CONTACT" },
  { color: "#c5a85d", fill: "#342b12", code: "THS", role: "THESIS" },
  { color: "#8d79bf", fill: "#251d38", code: "UNR", role: "OPEN LOOP" },
  { color: "#5d9fc1", fill: "#142c37", code: "OUT", role: "OUTCOME" }
];

const atlasDemoTokens = [
  { contractAddress: "demo:cap", symbol: "CAP", name: "catwifcap", kind: "ERC-20", amount: "351956", usd: 464 },
  { contractAddress: "demo:gme", symbol: "GME", name: "GameStop", kind: "ERC-20", amount: "4479", usd: 188 },
  { contractAddress: "demo:hood", symbol: ".hood", name: "hood", kind: "ERC-20", amount: "1935197", usd: 96 },
  { contractAddress: "demo:halted", symbol: "halted", name: "halted", kind: "ERC-20", amount: "2251662", usd: 54 }
];
const atlasDemoAsset = (symbol, name = symbol) => ({
  contractAddress: `demo:${String(symbol).toLowerCase()}`,
  symbol,
  name,
  kind: "ERC-20"
});
const atlasDemoActivity = [
  { hash: "demo-cap-buy", type: "buy", amount: "8792 CAP", usdValue: 17.97, asset: atlasDemoTokens[0] },
  { hash: "demo-gme-trim", type: "sell", amount: "1493 GME", usdValue: 4.31, asset: atlasDemoTokens[1] },
  { hash: "demo-hood-buy", type: "buy", amount: "1935197 .hood", usdValue: 17.96, asset: atlasDemoTokens[2] },
  { hash: "demo-halted-buy", type: "buy", amount: "2251662 halted", usdValue: 18.04, asset: atlasDemoTokens[3] },
  { hash: "demo-wagmi-in", type: "token_in", amount: "7573 WAGMI", usdValue: null, asset: atlasDemoAsset("WAGMI") },
  { hash: "demo-wealth-sell", type: "sell", amount: "128090 WEALTH", usdValue: 15.61, asset: atlasDemoAsset("WEALTH") }
];
const atlasDemoRooms = [
  {
    name: "FAVORITES",
    state: "3 active convictions",
    detail: "The loudest ideas that earned repeat attention inside the wallet.",
    entries: [
      { contract: "demo:cap", symbol: "CAP", summary: "CAP owns the biggest compartment: readable cat lore, multiple receipts, and the strongest active conviction." },
      { contract: "demo:gme", symbol: "GME", summary: "GME keeps its room because legacy internet lore still converts into instant attention." },
      { contract: "demo:hood", symbol: ".hood", summary: ".hood feels native to the chain, so the name itself carries part of the thesis." }
    ]
  },
  {
    name: "AVOID LIST",
    state: "2 signals quarantined",
    detail: "Weak receipts, unsolicited supply, and stories that stopped earning attention.",
    entries: [
      { contract: "demo:wealth", symbol: "WEALTH", reason: "The exit returned capital; the old story stays archived instead of becoming a forever bag." },
      { contract: "demo:wagmi", symbol: "WAGMI", reason: "Unsolicited supply is a message, not a thesis. It remains quarantined until the sender and pool make sense." }
    ]
  },
  {
    name: "TOKEN ENCOUNTERS",
    state: "7 names indexed",
    detail: "Every asset that crossed the wallet or left enough lore to remember.",
    entries: [
      { contract: "demo:halted", symbol: "halted", summary: "A buy receipt turned an absurd ticker into an active experiment." },
      { contract: "demo:hood", symbol: ".hood", summary: "A Robinhood-native name arrived with enough instant context to deserve a compartment." },
      { contract: "demo:boor", symbol: "BOOR", summary: "An older encounter survives as lore even after the live position disappeared." },
      { contract: "demo:wagmi", symbol: "WAGMI", summary: "A token-in receipt arrived without an authored trade decision." }
    ]
  },
  {
    name: "TRADE THESES",
    state: "4 working theses",
    detail: "Subjective reasons attached to confirmed actions, kept separate from hard receipt facts.",
    entries: [
      { contract: "demo:cap", symbol: "CAP", thesis: "I bought CAP because the cat ticker reads in one second and culture moves faster than a formal pitch." },
      { contract: "demo:gme", symbol: "GME", thesis: "I kept a GME moonbag because the ticker arrives with years of internet memory already installed." },
      { contract: "demo:hood", symbol: ".hood", thesis: "I aped .hood because the name is native to the ecosystem and the joke requires no translation." },
      { contract: "demo:halted", symbol: "halted", thesis: "I bought halted because a ticker that sounds like an error message is painfully on-brand for a chaotic launch." }
    ]
  },
  {
    name: "UNRESOLVED QUESTIONS",
    state: "2 loops still open",
    detail: "Ideas with enough signal to retain, but not enough evidence to close.",
    entries: [
      { contract: "demo:wagmi", symbol: "WAGMI", question: "Was the unsolicited supply a real introduction or just wallet graffiti?" },
      { contract: "demo:boor", symbol: "BOOR", question: "Does the old Robinhood lore ever earn a second look, or stay archived?" }
    ]
  },
  {
    name: "RECENT OUTCOMES",
    state: "3 decisions resolved",
    detail: "What the wallet did after a thesis met an actual receipt.",
    entries: [
      { contract: "demo:gme", symbol: "GME", summary: "GME was trimmed, not abandoned; profit returned to dry powder while a smaller hold stayed alive." },
      { contract: "demo:wealth", symbol: "WEALTH", summary: "WEALTH moved out and the exit became an archived lesson instead of a current identity." },
      { contract: "demo:halted", symbol: "halted", summary: "The fresh buy promoted halted from a joke on the wire into an active wallet experiment." }
    ]
  }
];
const atlasDemoMind = {
  activeThoughts: [
    { topic: "position:cap", belief: "CAP is the core culture bet right now; the meme is simple, the receipt is real, and the room is deliberately oversized.", entities: [{ value: "cap" }] },
    { topic: "position:gme", belief: "GME is the old-internet moonbag: smaller now, but still too recognizable to erase from memory.", entities: [{ value: "gme" }] },
    { topic: "position:.hood", belief: ".hood is almost offensively native to the chain. That is the entire charm.", entities: [{ value: ".hood" }] },
    { topic: "position:halted", belief: "halted is a live test of whether a ridiculous ticker can carry its own momentum.", entities: [{ value: "halted" }] },
    { topic: "question:wagmi", belief: "WAGMI entered without a buy, so the mind keeps it as an unanswered message rather than conviction.", entities: [{ value: "wagmi" }] }
  ],
  unresolvedQuestions: ["Was WAGMI intentional?", "Does BOOR deserve another encounter?"],
  updatedAt: "demo"
};

function pad(value) { return String(value).padStart(2, "0"); }
function nowStamp(date = new Date()) { return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`; }
function shortHash(value) { return value ? `${value.slice(0, 7)}...${value.slice(-5)}` : "unresolved"; }
function formatUsd(value, maximumFractionDigits = 2) {
  if (!Number.isFinite(value)) return "$--";
  return value.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits });
}
function formatSignedUsd(value) {
  if (!Number.isFinite(value)) return "$--";
  return `${value >= 0 ? "+" : "-"}${formatUsd(Math.abs(value))}`;
}
function pnlClass(value) {
  return !Number.isFinite(value) || value === 0 ? "is-neutral" : value > 0 ? "is-positive" : "is-negative";
}
function formatEventTime(value) {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "pending";
}

function appendThought(speaker, message, timestamp) {
  thoughts += 1;
  const line = document.createElement("div");
  line.className = "thought-line new-thought";
  const time = document.createElement("time"); time.textContent = timestamp ? nowStamp(new Date(timestamp)) : nowStamp();
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

function identityVideoSrc(index = currentIdentity) {
  const clip = identityClips[(index + identityClips.length) % identityClips.length];
  return `vladvideos/${clip?.id || "normal"}.mp4`;
}

function isSameVideoSource(video, src) {
  const target = new URL(src, window.location.href).href;
  return video.currentSrc === target || video.src === target;
}

function waitForVideoFrame(video) {
  if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) return Promise.resolve(true);
  return new Promise((resolve) => {
    const done = (ready) => {
      video.removeEventListener("loadeddata", onReady);
      video.removeEventListener("canplay", onReady);
      video.removeEventListener("error", onError);
      resolve(ready);
    };
    const onReady = () => done(true);
    const onError = () => done(false);
    video.addEventListener("loadeddata", onReady, { once: true });
    video.addEventListener("canplay", onReady, { once: true });
    video.addEventListener("error", onError, { once: true });
  });
}

function primeStandbyVideo(src, { loop = false } = {}) {
  if (!standbyVladVideo || isSameVideoSource(standbyVladVideo, src)) {
    if (standbyVladVideo) standbyVladVideo.loop = loop;
    return;
  }
  standbyVladVideo.muted = true;
  standbyVladVideo.loop = loop;
  standbyVladVideo.preload = "auto";
  standbyVladVideo.src = src;
  standbyVladVideo.load();
}

function primeNextIdentityVideo() {
  if (speaking) return;
  primeStandbyVideo(identityVideoSrc(currentIdentity + 1));
}

function swapVladVideo(src, { loop = false, shouldPlay = true } = {}) {
  const incoming = standbyVladVideo;
  const outgoing = activeVladVideo;
  const sequence = ++videoSwapSequence;
  if (isSameVideoSource(outgoing, src)) {
    outgoing.loop = loop;
    if (shouldPlay) outgoing.play().catch(() => {});
    if (!loop) primeNextIdentityVideo();
    return;
  }
  incoming.muted = true;
  incoming.loop = loop;
  incoming.preload = "auto";
  if (!isSameVideoSource(incoming, src)) {
    incoming.src = src;
    incoming.load();
  } else {
    try { incoming.currentTime = 0; } catch {}
  }

  const reveal = async () => {
    if (sequence !== videoSwapSequence) return;
    const ready = await waitForVideoFrame(incoming);
    if (!ready || sequence !== videoSwapSequence) return;
    if (shouldPlay) await incoming.play().catch(() => {});
    if (sequence !== videoSwapSequence) return;
    incoming.classList.add("is-active");
    outgoing.classList.remove("is-active");
    activeVladVideo = incoming;
    standbyVladVideo = outgoing;
    window.requestAnimationFrame(() => {
      if (standbyVladVideo === outgoing) outgoing.pause();
      primeNextIdentityVideo();
    });
  };

  if (incoming.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) reveal();
  else incoming.addEventListener("canplay", reveal, { once: true });
}

function setTalkingVideo(active) {
  const src = active
    ? "vladvideos/talking.mp4"
    : identityVideoSrc();
  swapVladVideo(src, { loop: active });
}

async function playSpeechQueue() {
  if (speaking || speechBlocked || !speechQueue.length) return;
  speaking = true;
  const next = speechQueue.shift();
  let playbackBlocked = false;
  setTalkingVideo(true);
  try {
    const audio = new Audio(next.audioUrl);
    audio.preload = "auto";
    await new Promise((resolve) => {
      audio.addEventListener("ended", resolve, { once: true });
      audio.addEventListener("error", resolve, { once: true });
      audio.play().catch(() => { playbackBlocked = true; resolve(); });
    });
  } finally {
    speaking = false;
    if (playbackBlocked) {
      setTalkingVideo(false);
      speechQueue.unshift(next);
      speechBlocked = true;
      return;
    }
    if (speechQueue.length) playSpeechQueue();
    else setTalkingVideo(false);
  }
}

function queueSpeech(line, { allowHistorical = false } = {}) {
  if (!line.audioUrl || line.kind === "memory") return;
  const eventTime = line.eventTimestamp || line.timestamp;
  if (!allowHistorical && line.kind !== "greeting" && eventTime && Date.now() - new Date(eventTime).getTime() > 45000) return;
  speechQueue.push(line);
  playSpeechQueue();
}

async function queueLatestVoiceFallback() {
  try {
    const response = await fetch("/api/ai/feed", { cache: "no-store" });
    if (!response.ok) return false;
    const feed = await response.json();
    const latest = [...(feed.lines || [])].reverse().find((line) => line.speak && line.audioUrl);
    if (!latest) return false;
    welcomeAudioQueued = true;
    queueSpeech(latest, { allowHistorical: true });
    return true;
  } catch {
    return false;
  }
}

async function loadWelcome() {
  try {
    const response = await fetch("/api/ai/welcome", { cache: "no-store" });
    if (!response.ok) throw new Error("welcome unavailable");
    const line = await response.json();
    if (!welcomeShown) {
      welcomeShown = true;
      appendThought(line.speaker || "vlad.core", line.message || "", line.timestamp);
    }
    if (line.audioUrl && !welcomeAudioQueued) {
      welcomeAudioQueued = true;
      queueSpeech(line);
      return;
    }
  } catch {}
  welcomeLoadAttempts += 1;
  if (welcomeAudioQueued) return;
  if (welcomeLoadAttempts >= 3) {
    const recovered = await queueLatestVoiceFallback();
    if (recovered) return;
  }
  window.setTimeout(loadWelcome, 1000);
}

function unlockSpeech() {
  speechBlocked = false;
  playSpeechQueue();
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

function selectRoom(index, shouldAnnounce = true) {
  selectedRoom = index;
  selectedAtlasToken = null;
  const { name, state, detail } = atlasRoomAt(index);
  roomStatus.textContent = `${name} OPEN`;
  terminalRoom.textContent = name;
  roomDetail.replaceChildren();
  const label = document.createElement("span"); label.textContent = `${name} / ${state}`;
  const copy = document.createElement("p"); copy.textContent = detail;
  roomDetail.append(label, copy);
  renderRooms();
}

function enterRoom(index) {
  selectRoom(index);
  const { name, state, detail, entries = [] } = atlasRoomAt(index);
  document.querySelector("#roomOverlayName").textContent = name;
  document.querySelector("#roomOverlayState").textContent = state;
  document.querySelector("#roomOverlayCopy").textContent = detail;
  document.querySelector("#roomOverlayPulse").textContent = `${entries.length} MEMORY RECORDS`;
  const transcript = document.querySelector("#roomTranscript");
  transcript.replaceChildren();
  const lines = entries.length
    ? entries.map((entry) => name === "TRADE THESES" ? entry.thesis || entry.summary || entry.reason || JSON.stringify(entry) : entry.summary || entry.reason || entry.thesis || entry.question || JSON.stringify(entry))
    : ["no memory records yet"];
  ["memory room opened", state, ...lines.slice(0, 6)].forEach((message, lineIndex) => {
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
  document.querySelector(`[data-atlas-room="${selectedRoom}"]`)?.focus();
}

function advanceRoomPulses() {
  renderRooms();
}

function atlasNorm(value) { return String(value || "").trim().toLowerCase(); }
function atlasKey(value = {}) {
  const contract = atlasNorm(value.contractAddress || value.contract);
  return contract && contract !== "native" ? contract : atlasNorm(value.symbol || value.name || "unknown");
}
function atlasEntryCopy(entry = {}) {
  return entry.thesis || entry.summary || entry.reason || entry.question || entry.evidence || entry.missingEvidence || "memory fragment indexed";
}
function atlasHasIndexedData() {
  const hasPosition = (latestWalletSummary.tokens || []).some((token) => token.kind !== "native" && Number(token.usd || 0) > 0);
  return hasPosition
    || latestActivity.length > 0
    || rooms.some((room) => (room.entries || []).length > 0);
}
function atlasSources() {
  const demo = backendPaused && !atlasHasIndexedData();
  return demo
    ? { demo, tokens: atlasDemoTokens, activity: atlasDemoActivity, roomSet: atlasDemoRooms, mind: atlasDemoMind }
    : { demo, tokens: latestWalletSummary.tokens || [], activity: latestActivity, roomSet: rooms, mind: latestMindSnapshot };
}
function atlasRoomAt(index) {
  return atlasSources().roomSet[index] || rooms[index] || atlasDemoRooms[index];
}
function atlasPartition(items, rect = { x: 0, y: 0, width: 100, height: 100 }, depth = 0) {
  if (!items.length) return [];
  if (items.length === 1) return [{ ...items[0], rect }];
  const total = items.reduce((sum, item) => sum + Math.max(.1, Number(item.weight) || 1), 0);
  let split = 1;
  let firstWeight = Math.max(.1, Number(items[0].weight) || 1);
  while (split < items.length - 1 && firstWeight < total * .48) {
    firstWeight += Math.max(.1, Number(items[split].weight) || 1);
    split += 1;
  }
  const ratio = Math.min(.78, Math.max(.22, firstWeight / total));
  const first = items.slice(0, split);
  const second = items.slice(split);
  const vertical = rect.width > rect.height * 1.08 || (depth % 3 === 0 && rect.width >= rect.height * .82);
  if (vertical) {
    const firstWidth = rect.width * ratio;
    return [
      ...atlasPartition(first, { ...rect, width: firstWidth }, depth + 1),
      ...atlasPartition(second, { x: rect.x + firstWidth, y: rect.y, width: rect.width - firstWidth, height: rect.height }, depth + 1)
    ];
  }
  const firstHeight = rect.height * ratio;
  return [
    ...atlasPartition(first, { ...rect, height: firstHeight }, depth + 1),
    ...atlasPartition(second, { x: rect.x, y: rect.y + firstHeight, width: rect.width, height: rect.height - firstHeight }, depth + 1)
  ];
}
function atlasCatalog(sources = atlasSources()) {
  const catalog = new Map();
  const upsert = (value = {}, patch = {}) => {
    const symbol = String(value.symbol || patch.symbol || "TOKEN").trim() || "TOKEN";
    const contractAddress = value.contractAddress || value.contract || patch.contractAddress || patch.contract || "";
    const key = atlasKey({ symbol, contractAddress });
    if (!key) return null;
    const current = catalog.get(key) || {
      key,
      symbol,
      name: value.name || symbol,
      contractAddress,
      image: value.image || "",
      kind: value.kind || "token",
      currentUsd: 0,
      amount: value.amount || "",
      current: false,
      tradeCount: 0,
      memoryCount: 0,
      mindCount: 0,
      events: [],
      memories: []
    };
    current.symbol = value.symbol || current.symbol;
    current.name = value.name || current.name;
    current.contractAddress = contractAddress || current.contractAddress;
    current.image = value.image || current.image;
    current.kind = value.kind || current.kind;
    current.amount = value.amount || current.amount;
    const usd = Number(value.usd ?? patch.usd);
    if (Number.isFinite(usd)) current.currentUsd = Math.max(current.currentUsd, usd);
    if (patch.current) current.current = true;
    if (patch.event) { current.tradeCount += 1; current.events.push(patch.event); }
    if (patch.memory) { current.memoryCount += 1; current.memories.push(patch.memory); }
    catalog.set(key, current);
    return current;
  };
  (sources.tokens || []).forEach((token) => {
    if (token.kind === "native" || Number(token.usd || 0) > 0) upsert(token, { current: true, usd: token.usd });
  });
  sources.activity.forEach((event) => {
    if (!["buy", "sell", "token_in", "token_out"].includes(event.type)) return;
    if (!["buy", "sell"].includes(event.type) && !event.asset?.symbol) return;
    upsert(event.asset || {}, { event });
  });
  sources.roomSet.forEach((room) => (room.entries || []).forEach((entry) => {
    if (entry.symbol || entry.contract) upsert(entry, { memory: { ...entry, room: room.name } });
  }));
  return catalog;
}
function atlasThoughtsFor(asset, sources = atlasSources()) {
  const symbol = atlasNorm(asset.symbol);
  const contract = atlasNorm(asset.contractAddress);
  return (sources.mind.activeThoughts || []).filter((thought) => {
    if (symbol && atlasNorm(thought.topic).includes(symbol)) return true;
    return (thought.entities || []).some((entity) => {
      const value = atlasNorm(entity.value);
      return value && (value === symbol || value === contract);
    });
  });
}
function atlasRoomPayloads(sources = atlasSources()) {
  const catalog = atlasCatalog(sources);
  const traded = [...catalog.values()].filter((asset) => asset.tradeCount > 0);
  const currentTokens = [...catalog.values()].filter((asset) => asset.current);
  return sources.roomSet.map((room, index) => {
    const assets = new Map();
    const add = (asset, extra = {}) => {
      if (!asset) return;
      const row = assets.get(asset.key) || { ...asset, roomMemoryCount: 0, roomTradeCount: 0, roomMindCount: 0, roomMemories: [], roomEvents: [] };
      if (extra.memory) { row.roomMemoryCount += 1; row.roomMemories.push(extra.memory); }
      if (extra.event) { row.roomTradeCount += 1; row.roomEvents.push(extra.event); }
      if (extra.mind) row.roomMindCount += 1;
      assets.set(asset.key, row);
    };
    (room.entries || []).forEach((entry) => {
      const asset = catalog.get(atlasKey(entry));
      if (asset) add(asset, { memory: entry });
    });
    if (index === 0) currentTokens.filter((asset) => asset.kind !== "native").forEach((asset) => add(asset));
    if (index === 2) [...catalog.values()].filter((asset) => asset.kind !== "native").forEach((asset) => add(asset));
    if (index === 3) [...currentTokens, ...traded].filter((asset) => asset.kind !== "native").forEach((asset) => add(asset));
    if (index === 4) sources.activity.filter((event) => event.type === "token_in" || event.type === "token_out").forEach((event) => add(catalog.get(atlasKey(event.asset || {})), { event }));
    if (index === 5) sources.activity.filter((event) => event.type === "buy" || event.type === "sell").forEach((event) => add(catalog.get(atlasKey(event.asset || {})), { event }));
    for (const asset of assets.values()) {
      const thoughts = atlasThoughtsFor(asset, sources);
      asset.roomMindCount = thoughts.length;
      asset.thoughts = thoughts;
      asset.weight = 1.4
        + Math.log10(Math.max(1, asset.currentUsd) + 1) * (asset.current ? 4.2 : 1.1)
        + asset.roomMemoryCount * 2.8
        + Math.max(asset.roomTradeCount, asset.tradeCount) * 1.7
        + asset.roomMindCount * 3.2
        + (asset.current ? 3.4 : 0);
    }
    const sortedAssets = [...assets.values()].sort((a, b) => b.weight - a.weight).slice(0, 30);
    const loreCount = (room.entries || []).length + sortedAssets.reduce((sum, asset) => sum + asset.roomMindCount, 0);
    const occupiedUsd = sortedAssets.reduce((sum, asset) => sum + (asset.current ? asset.currentUsd : 0), 0);
    return {
      index,
      room,
      demo: sources.demo,
      style: atlasRoomStyles[index] || atlasRoomStyles[0],
      assets: sortedAssets,
      loreCount,
      occupiedUsd,
      weight: 6 + Math.sqrt(Math.max(0, occupiedUsd)) * .48 + loreCount * 1.25 + sortedAssets.length * .65
    };
  });
}
function atlasAssetStatus(asset) {
  if (asset.kind === "native") return "FUEL RESERVE";
  if (asset.current && asset.currentUsd > 0) return `HELD ${formatUsd(asset.currentUsd)}`;
  const event = asset.roomEvents?.[0] || asset.events?.[0];
  if (event?.type === "buy") return "BUY MEMORY";
  if (event?.type === "sell") return "SELL MEMORY";
  if (event?.type === "token_in") return "UNRESOLVED IN";
  if (event?.type === "token_out") return "UNRESOLVED OUT";
  return "ARCHIVED LORE";
}
function renderAtlasInspector(payload, asset = null) {
  if (!atlasInspector || !payload) return;
  atlasInspector.replaceChildren();
  const eyebrow = document.createElement("span"); eyebrow.className = "atlas-inspector-label";
  const title = document.createElement("h3");
  const copy = document.createElement("p");
  const facts = document.createElement("div"); facts.className = "atlas-inspector-facts";
  if (asset) {
    eyebrow.textContent = `${payload.demo ? "SIM / " : ""}${payload.style.code} / ${atlasAssetStatus(asset)}`;
    title.textContent = asset.symbol;
    const memory = asset.roomMemories?.[0] || asset.memories?.[0];
    const thought = asset.thoughts?.[0];
    copy.textContent = thought?.belief || (memory ? atlasEntryCopy(memory) : `${asset.symbol} remains indexed in ${payload.room.name.toLowerCase()}.`);
    [
      ["POSITION", asset.current ? `${payload.demo ? "~" : ""}${formatUsd(asset.currentUsd)}` : "ARCHIVED"],
      ["TRADES", String(Math.max(asset.tradeCount, asset.roomTradeCount))],
      ["LORE", String(asset.roomMemoryCount + asset.roomMindCount)]
    ].forEach(([labelText, value]) => {
      const row = document.createElement("div");
      const label = document.createElement("span"); label.textContent = labelText;
      const strong = document.createElement("strong"); strong.textContent = value;
      row.append(label, strong); facts.append(row);
    });
  } else {
    eyebrow.textContent = `${payload.demo ? "SIM / " : ""}${payload.style.code} / ${payload.style.role}`;
    title.textContent = payload.room.name;
    copy.textContent = payload.room.detail || payload.room.state;
    [
      ["COMPARTMENTS", String(payload.assets.length)],
      ["MEMORIES", String((payload.room.entries || []).length)],
      ["OCCUPIED", payload.occupiedUsd > 0 ? `${payload.demo ? "~" : ""}${formatUsd(payload.occupiedUsd)}` : "VACANT"]
    ].forEach(([labelText, value]) => {
      const row = document.createElement("div");
      const label = document.createElement("span"); label.textContent = labelText;
      const strong = document.createElement("strong"); strong.textContent = value;
      row.append(label, strong); facts.append(row);
    });
  }
  const open = document.createElement("button");
  open.type = "button";
  open.textContent = "OPEN DISTRICT";
  open.addEventListener("click", () => enterRoom(payload.index));
  atlasInspector.append(eyebrow, title, copy, facts, open);
}
function selectAtlasToken(roomIndex, key) {
  selectedRoom = roomIndex;
  selectedAtlasToken = { roomIndex, key };
  const room = atlasRoomAt(roomIndex);
  roomStatus.textContent = `${room.name} / TOKEN FOCUS`;
  terminalRoom.textContent = room.name;
  lastAtlasSignature = "";
  renderRooms();
}
function renderAtlasRegistry(payloads) {
  if (!atlasRoomIndex) return;
  atlasRoomIndex.replaceChildren();
  payloads.forEach((payload) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "atlas-registry-row";
    button.classList.toggle("selected", payload.index === selectedRoom);
    button.style.setProperty("--sector-color", payload.style.color);
    button.dataset.atlasRoom = String(payload.index);
    button.setAttribute("aria-pressed", String(payload.index === selectedRoom));
    button.addEventListener("click", () => enterRoom(payload.index));
    const code = document.createElement("span"); code.textContent = payload.style.code;
    const name = document.createElement("strong"); name.textContent = payload.room.name;
    const count = document.createElement("b"); count.textContent = String(payload.assets.length).padStart(2, "0");
    button.append(code, name, count); atlasRoomIndex.append(button);
  });
}
function renderAtlasRoom(payload, layout) {
  const section = document.createElement("section");
  section.className = "atlas-room-zone";
  section.classList.toggle("selected", payload.index === selectedRoom);
  section.classList.toggle("is-demo", payload.demo);
  section.style.setProperty("--sector-color", payload.style.color);
  section.style.setProperty("--sector-fill", payload.style.fill);
  section.style.setProperty("--atlas-index", payload.index);
  section.style.left = `${layout.rect.x}%`;
  section.style.top = `${layout.rect.y}%`;
  section.style.width = `${layout.rect.width}%`;
  section.style.height = `${layout.rect.height}%`;
  const header = document.createElement("button");
  header.type = "button";
  header.className = "atlas-room-header";
  header.dataset.atlasRoom = String(payload.index);
  header.setAttribute("aria-label", `Open ${payload.room.name}`);
  header.addEventListener("click", () => enterRoom(payload.index));
  const name = document.createElement("strong"); name.textContent = payload.room.name;
  const meta = document.createElement("span"); meta.textContent = `${payload.assets.length} CELLS / ${payload.loreCount} LORE`;
  header.append(name, meta);
  const cells = document.createElement("div"); cells.className = "atlas-room-cells";
  const cellLayouts = atlasPartition(payload.assets, { x: 0, y: 0, width: 100, height: 100 });
  cellLayouts.forEach(({ rect, ...asset }, cellIndex) => {
    const cell = document.createElement("button");
    const area = rect.width * rect.height;
    cell.type = "button";
    cell.className = "atlas-token-cell";
    cell.classList.toggle("is-held", asset.current && asset.currentUsd > 0);
    cell.classList.toggle("is-archived", !asset.current);
    cell.classList.toggle("is-small", area < 700 || rect.width < 19 || rect.height < 24);
    cell.classList.toggle("selected", selectedAtlasToken?.roomIndex === payload.index && selectedAtlasToken?.key === asset.key);
    cell.style.left = `${rect.x}%`;
    cell.style.top = `${rect.y}%`;
    cell.style.width = `${rect.width}%`;
    cell.style.height = `${rect.height}%`;
    cell.style.setProperty("--cell-index", cellIndex);
    cell.title = `${asset.symbol} / ${atlasAssetStatus(asset)} / ${asset.roomMemoryCount + asset.roomMindCount} lore`;
    cell.setAttribute("aria-label", cell.title);
    cell.addEventListener("click", (event) => { event.stopPropagation(); selectAtlasToken(payload.index, asset.key); });
    if (area >= 540 && rect.width >= 22 && rect.height >= 28) {
      const visual = createTokenVisual(asset); visual.classList.add("atlas-token-visual"); cell.append(visual);
    }
    const label = document.createElement("span"); label.className = "atlas-token-label"; label.textContent = asset.symbol;
    const status = document.createElement("small"); status.textContent = atlasAssetStatus(asset);
    cell.append(label, status); cells.append(cell);
  });
  if (!payload.assets.length) {
    const vacant = document.createElement("div"); vacant.className = "atlas-vacant";
    const pulse = document.createElement("i");
    const text = document.createElement("span"); text.textContent = "VACANT MEMORY";
    vacant.append(pulse, text); cells.append(vacant);
  }
  section.append(header, cells);
  return section;
}
function renderRooms() {
  if (!roomsBoard) return;
  const sources = atlasSources();
  const payloads = atlasRoomPayloads(sources);
  const catalog = atlasCatalog(sources);
  const occupied = [...catalog.values()].filter((asset) => asset.current && asset.kind !== "native").reduce((sum, asset) => sum + asset.currentUsd, 0);
  const archived = [...catalog.values()].filter((asset) => !asset.current && asset.tradeCount > 0).length;
  const lore = sources.roomSet.reduce((sum, room) => sum + (room.entries || []).length, 0) + (sources.mind.activeThoughts || []).length;
  const signature = JSON.stringify({
    rooms: payloads.map((payload) => [payload.room.name, payload.loreCount, payload.assets.map((asset) => [asset.key, Math.round(asset.currentUsd), asset.tradeCount, asset.roomMemoryCount, asset.roomMindCount])]),
    selectedRoom,
    selectedAtlasToken,
    mind: sources.mind.updatedAt || "",
    demo: sources.demo
  });
  if (signature === lastAtlasSignature) return;
  lastAtlasSignature = signature;
  roomsBoard.closest(".rooms-panel")?.classList.toggle("is-demo", sources.demo);
  atlasOccupied.textContent = `${sources.demo ? "~" : ""}${formatUsd(occupied)}`;
  atlasArchived.textContent = String(archived).padStart(2, "0");
  atlasLore.textContent = String(lore).padStart(2, "0");
  atlasMapMode.textContent = sources.demo ? "SIMULATION / PAUSED" : occupied > 0 ? "WALLET + LORE" : "ARCHIVE MODE";
  renderAtlasRegistry(payloads);
  roomsBoard.replaceChildren();
  atlasPartition(payloads, { x: 0, y: 0, width: 100, height: 100 }).forEach((layout) => roomsBoard.append(renderAtlasRoom(layout, layout)));
  const beacon = document.createElement("div"); beacon.className = "atlas-core-beacon"; beacon.setAttribute("aria-hidden", "true"); roomsBoard.append(beacon);
  const activePayload = payloads[selectedRoom] || payloads[0];
  const activeAsset = selectedAtlasToken?.roomIndex === selectedRoom ? activePayload.assets.find((asset) => asset.key === selectedAtlasToken.key) : null;
  renderAtlasInspector(activePayload, activeAsset || null);
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
  const row = document.createElement("div"); row.className = `asset-row ${token.performance ? pnlClass(token.performance.unrealizedPnlUsd) : "is-neutral"}`;
  const info = document.createElement("div"); info.className = "asset-info";
  const name = document.createElement("p"); name.className = "asset-name"; name.textContent = token.name;
  const kind = document.createElement("p"); kind.className = "asset-kind"; kind.textContent = `${token.symbol} | ${token.kind}`;
  const market = document.createElement("p"); market.className = "asset-market";
  const price = document.createElement("span"); price.textContent = Number.isFinite(token.marketCap) ? `MC ${formatUsd(token.marketCap, 0)}` : "MARKET CAP NOT INDEXED";
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
  value.append(usd, amount);
  const performance = document.createElement("div"); performance.className = "asset-pnl";
  if (token.performance) {
    const pnl = document.createElement("strong"); pnl.textContent = formatSignedUsd(token.performance.unrealizedPnlUsd);
    const percent = document.createElement("span"); percent.textContent = `${token.performance.unrealizedPnlPercent >= 0 ? "+" : ""}${token.performance.unrealizedPnlPercent.toFixed(2)}%`;
    const basis = document.createElement("small");
    const entryMarketCap = Number.isFinite(token.performance.averageEntryMarketCap) ? formatUsd(token.performance.averageEntryMarketCap, 0) : "$--";
    const currentMarketCap = Number.isFinite(token.performance.currentMarketCap) ? formatUsd(token.performance.currentMarketCap, 0) : "$--";
    basis.textContent = `ENTRY MC ${entryMarketCap} | NOW ${currentMarketCap}`;
    performance.append(pnl, percent, basis);
  } else {
    const basis = document.createElement("small"); basis.textContent = token.kind === "native" ? "SWAP FUEL | NOT A POSITION" : "ENTRY BASIS INDEXING";
    performance.append(basis);
  }
  value.append(performance); row.append(createTokenVisual(token), info, value); return row;
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
    const summary = await response.json();
    backendPaused = summary.paused === true;
    latestWalletSummary = summary;
    assetList.replaceChildren(); summary.tokens.forEach((token) => assetList.append(createAssetRow(token)));
    if (!summary.tokens.length) renderEmpty(assetList, "No indexed assets yet.");
    scanStatus.textContent = summary.state === "live" ? "LIVE INDEX" : summary.state === "legacy" ? "TRANSFER INDEX" : summary.state === "cached" ? "CACHED INDEX" : "RPC ONLY";
    assetCount.textContent = `${summary.tokens.length} ASSETS`;
    fullWalletAddress = summary.wallet;
    walletAddress.textContent = `${summary.wallet.slice(0, 6)}...${summary.wallet.slice(-4)}`;
    walletTotalUsd.textContent = formatUsd(summary.totalUsd);
    const pnl = summary.pnl || {};
    const hasPnl = Number.isFinite(pnl.unrealizedPnlUsd) && pnl.trackedPositions > 0;
    walletPnlBlock.className = `portfolio-pnl ${hasPnl ? pnlClass(pnl.unrealizedPnlUsd) : "is-neutral"}`;
    walletPnl.textContent = hasPnl ? `${formatSignedUsd(pnl.unrealizedPnlUsd)} OPEN P&L` : "P&L INDEXING";
    walletPnlPercent.textContent = hasPnl && Number.isFinite(pnl.unrealizedPnlPercent) ? `${pnl.unrealizedPnlPercent >= 0 ? "+" : ""}${pnl.unrealizedPnlPercent.toFixed(2)}% | ${pnl.trackedPositions} TRACKED` : "EST. OPEN POSITIONS";
    const daily = summary.daily || {};
    const hasDaily = Number.isFinite(daily.changeUsd) && Number.isFinite(daily.changePercent) && daily.indexedAssets > 0;
    walletDailyChange.className = hasDaily ? pnlClass(daily.changeUsd) : "is-neutral";
    walletDailyChange.textContent = hasDaily ? `24H ${formatSignedUsd(daily.changeUsd)} | ${daily.changePercent >= 0 ? "+" : ""}${daily.changePercent.toFixed(2)}%` : "24H INDEXING";
    walletRealizedPnl.className = pnlClass(pnl.realizedPnlUsd);
    walletRealizedPnl.textContent = Number.isFinite(pnl.realizedPnlUsd) && pnl.trackedPositions > 0 ? formatSignedUsd(pnl.realizedPnlUsd) : "$--";
    walletValueNote.textContent = `${summary.pricedAssets} of ${summary.tokens.length} assets priced | P&L uses indexed average entry`;
    walletEthPrice.textContent = formatUsd(summary.nativePriceUsd);
    walletPricedAssets.textContent = `${summary.pricedAssets} / ${summary.tokens.length}`;
    renderRooms();
  } catch {
    scanStatus.textContent = "RETRYING";
    if (!assetList.children.length) renderEmpty(assetList, "Scanner is reconnecting to Robinhood Chain.");
  }
}

async function pollActivity() {
  try {
    const response = await fetch("/api/wallet/activity", { cache: "no-store" }); if (!response.ok) throw new Error("activity unavailable");
    const activity = await response.json(); const incomingEvents = (activity.events || []).filter((event) => event.type !== "verifying");
    backendPaused = activity.paused === true;
    if (!incomingEvents.length && latestActivity.length) {
      activityStatus.textContent = "CACHED FEED";
      return;
    }
    latestActivity = incomingEvents;
    activityList.replaceChildren();
    const newTradeHashes = new Set();
    latestActivity.forEach((event) => {
      const isNew = !seenTransactionHashes.has(event.hash);
      seenTransactionHashes.add(event.hash);
      activityList.append(createActivityRow(event, isNew));
      if (activityInitialized && isNew && (event.type === "buy" || event.type === "sell")) newTradeHashes.add(event.hash);
    });
    renderTradePopups(latestActivity, newTradeHashes);
    if (latestActivity.length) activityInitialized = true;
    if (!latestActivity.length) renderEmpty(activityList, "No recent wallet events.");
    activityStatus.textContent = activity.state === "live" ? "LIVE FEED" : activity.state === "legacy" ? "TRANSFER FEED" : activity.state === "cached" ? "CACHED FEED" : "CHAIN DELAY";
    renderFees();
    renderRooms();
  } catch {
    activityStatus.textContent = "RETRYING";
    if (!activityList.children.length) renderEmpty(activityList, "Activity scanner is reconnecting.");
  }
}

function applyAiFeed(feed) {
  if (typeof feed.paused === "boolean") backendPaused = feed.paused;
  if (Array.isArray(feed.rooms)) {
    rooms = feed.rooms;
    if (selectedRoom >= rooms.length) selectedRoom = 0;
    selectRoom(selectedRoom, false);
  }
  (feed.lines || []).forEach((line) => {
    if (!line.id || aiLineIds.has(line.id)) return;
    aiLineIds.add(line.id);
    if (line.kind === "transaction" && line.event) {
      appendTradeNotice(line.event);
      return;
    }
    appendThought(line.speaker || "vlad.core", line.message || "", line.timestamp);
    if (line.speak) queueSpeech(line);
  });
  document.querySelector(".telemetry-live").textContent = feed.hasKey ? (feed.hasVoice ? "LLM + VOICE" : "LLM LINKED") : "KEY MISSING";
}

async function pollAiFeed() {
  try {
    const response = await fetch("/api/ai/feed", { cache: "no-store" }); if (!response.ok) throw new Error("ai feed unavailable");
    applyAiFeed(await response.json());
  } catch {
    document.querySelector(".telemetry-live").textContent = "LLM RETRY";
  }
}

async function pollMindAtlas() {
  try {
    const response = await fetch("/api/x/mind", { cache: "no-store" });
    if (!response.ok) throw new Error("mind unavailable");
    latestMindSnapshot = await response.json();
    renderRooms();
  } catch {
    atlasMapMode.textContent = "WALLET MEMORY";
  }
}

function startAiStream() {
  if (!window.EventSource || aiStream) return;
  aiStream = new EventSource("/api/ai/stream");
  aiStream.addEventListener("feed", (event) => {
    try { applyAiFeed(JSON.parse(event.data)); } catch {}
  });
  aiStream.onerror = () => { document.querySelector(".telemetry-live").textContent = "LLM RECONNECTING"; };
}

function initials(value) { return String(value || "ANON").trim().slice(0, 2).toUpperCase(); }
function shillAvatar(item) {
  const avatar = document.createElement("div"); avatar.className = "shill-avatar";
  const fallback = document.createElement("span"); fallback.textContent = initials(item.name);
  avatar.append(fallback);
  if (item.pfp) {
    const image = document.createElement("img"); image.src = item.pfp; image.alt = `${item.name} profile`;
    image.addEventListener("error", () => image.remove());
    avatar.append(image);
  }
  return avatar;
}
function createShillItem(item) {
  const article = document.createElement("article"); article.className = `shill-item shill-item-${item.kind}`;
  article.dataset.shillId = item.id || "";
  article.dataset.shillSignature = JSON.stringify({ name: item.name, message: item.message, kind: item.kind, createdAt: item.createdAt, response: item.response, pfp: Boolean(item.pfp) });
  const avatar = shillAvatar(item);
  const body = document.createElement("div"); body.className = "shill-item-body";
  const head = document.createElement("div"); head.className = "shill-item-head";
  const name = document.createElement("strong"); name.textContent = item.name;
  const kind = document.createElement("span"); kind.textContent = item.kind.toUpperCase();
  const time = document.createElement("time"); time.textContent = formatEventTime(item.createdAt);
  head.append(name, kind, time);
  const message = document.createElement("p"); message.textContent = item.message;
  body.append(head, message);
  if (item.response) {
    const reply = document.createElement("div"); reply.className = "shill-reply";
    const label = document.createElement("b"); label.textContent = "VLADINATOR";
    const copy = document.createElement("p"); copy.textContent = item.response;
    reply.append(label, copy); body.append(reply);
  }
  article.append(avatar, body); return article;
}
function uniqueShillItems(items = []) {
  const seenIds = new Set();
  const seenContent = new Set();
  return items.filter((item) => {
    const id = String(item?.id || "");
    const content = [item?.name, item?.message, item?.kind].map((part) => String(part || "").trim().toLowerCase()).join("|");
    if (id && seenIds.has(id)) return false;
    if (seenContent.has(content)) return false;
    if (id) seenIds.add(id);
    seenContent.add(content);
    return true;
  });
}
function renderShills(items = [], count = items.length) {
  const list = uniqueShillItems(items);
  const signature = JSON.stringify(list.map((item) => [item.id, item.response, item.createdAt]));
  shillCount.textContent = `${count || list.length} TRANSMISSIONS`;
  if (signature === lastShillSignature) return;
  lastShillSignature = signature;
  const wasNearTop = shillFeed.scrollTop < 32;
  const previousBottom = shillFeed.scrollHeight - shillFeed.scrollTop;
  const existing = new Map([...shillFeed.querySelectorAll(".shill-item[data-shill-id]")].map((node) => [node.dataset.shillId, node]));
  const fragment = document.createDocumentFragment();
  for (const item of list) {
    const key = String(item.id || "");
    const next = createShillItem(item);
    const current = key ? existing.get(key) : null;
    if (current && current.dataset.shillSignature === next.dataset.shillSignature) {
      fragment.append(current);
    } else {
      next.classList.toggle("new-shill", !current);
      fragment.append(next);
    }
  }
  if (!list.length) {
    renderEmpty(shillFeed, "No public transmissions yet.");
    return;
  }
  shillFeed.replaceChildren(fragment);
  if (wasNearTop) shillFeed.scrollTop = 0;
  else shillFeed.scrollTop = Math.max(0, shillFeed.scrollHeight - previousBottom);
}
async function pollShills() {
  if (shillPollInFlight) return;
  shillPollInFlight = true;
  try {
    const response = await fetch("/api/shills", { cache: "no-store" });
    if (!response.ok) throw new Error("wire unavailable");
    const data = await response.json();
    renderShills(data.items || [], data.count || 0);
    if (shillStatus.textContent === "WIRE RETRYING") shillStatus.textContent = "WIRE READY";
  } catch { shillStatus.textContent = "WIRE RETRYING"; }
  finally { shillPollInFlight = false; }
}
function xPostLabel(type) {
  return ({ trade: "TRADE", routine: "ROUTINE", vlad_bullpost: "$VLAD", manual: "MANUAL", followup: "VLAD.X", trade_followup: "VLAD.X", reply_mention: "REPLY", quote_mention: "QUOTE" })[type] || "OUTBOUND";
}
function xPostTime(value) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return "NOW";
  const elapsed = Math.max(0, Date.now() - date.getTime());
  if (elapsed < 60_000) return "NOW";
  if (elapsed < 3_600_000) return `${Math.floor(elapsed / 60_000)}M`;
  if (elapsed < 86_400_000) return `${Math.floor(elapsed / 3_600_000)}H`;
  return `${Math.floor(elapsed / 86_400_000)}D`;
}
function isXThread(post) {
  return ["followup", "trade_followup", "reply_mention", "quote_mention"].includes(post.type) || Boolean(post.replyTo || post.quoteTweetId);
}
function createXPostItem(post, { thread = false } = {}) {
  const article = document.createElement("article");
  article.className = `x-post-item${thread ? " x-post-thread" : ""}`;
  article.dataset.postId = post.id || "";
  article.dataset.postSignature = JSON.stringify([post.text, post.type, post.postedAt, post.replyTo, post.quoteTweetId, post.contextAuthor, post.mediaUrl, post.mediaType]);
  const head = document.createElement("div"); head.className = "x-post-head";
  const identity = document.createElement("div"); identity.className = "x-post-identity";
  const mark = document.createElement("span"); mark.textContent = "V";
  const name = document.createElement("strong"); name.textContent = "VLADINATOR";
  const handle = document.createElement("small"); handle.textContent = "@VLADINATOR";
  identity.append(mark, name, handle);
  const time = document.createElement("time"); time.textContent = xPostTime(post.postedAt);
  head.append(identity, time);
  const type = document.createElement("span"); type.className = "x-post-type"; type.textContent = xPostLabel(post.type);
  const text = document.createElement("p"); text.className = "x-post-copy"; text.textContent = post.text;
  article.append(head, type, text);
  if (post.contextAuthor) {
    const context = document.createElement("p"); context.className = "x-post-context";
    context.textContent = post.type === "quote_mention" ? `quoting ${post.contextAuthor}` : `replying to ${post.contextAuthor}`;
    article.append(context);
  }
  if (post.mediaUrl) {
    const media = document.createElement("div"); media.className = "x-post-media";
    const isVideo = /^video\//i.test(post.mediaType || "") || /\.(mp4|webm)(?:$|\?)/i.test(post.mediaUrl);
    const element = document.createElement(isVideo ? "video" : "img");
    element.src = post.mediaUrl;
    if (isVideo) {
      element.muted = true; element.loop = true; element.playsInline = true; element.preload = "metadata";
      if (xRailVideoObserver) xRailVideoObserver.observe(element);
      else element.play().catch(() => {});
    } else { element.alt = "Attached Vladinator X media"; element.loading = "lazy"; element.decoding = "async"; }
    element.addEventListener("error", () => media.remove());
    media.append(element); article.append(media);
  }
  const footer = document.createElement("div"); footer.className = "x-post-footer";
  const reply = document.createElement("span"); reply.textContent = thread ? "THREAD LINKED" : "POSTED BY VLAD";
  const status = document.createElement("span"); status.textContent = post.mediaUrl ? "MEDIA ATTACHED" : "TEXT SIGNAL";
  footer.append(reply, status); article.append(footer);
  return article;
}
function renderXPostRail(container, posts, emptyText, { thread = false } = {}) {
  const list = posts.slice(0, 8);
  const existing = new Map([...container.querySelectorAll(".x-post-item[data-post-id]")].map((node) => [node.dataset.postId, node]));
  const fragment = document.createDocumentFragment();
  for (const post of list) {
    const next = createXPostItem(post, { thread });
    const current = existing.get(String(post.id || ""));
    if (current && current.dataset.postSignature === next.dataset.postSignature) fragment.append(current);
    else { next.classList.toggle("x-post-new", !current); fragment.append(next); }
  }
  if (!list.length) {
    const empty = document.createElement("p"); empty.className = "x-rail-empty"; empty.textContent = emptyText; container.replaceChildren(empty); return;
  }
  container.replaceChildren(fragment);
}
async function pollXFeed() {
  if (xFeedPollInFlight || !xPostRail || !xThreadRail) return;
  xFeedPollInFlight = true;
  try {
    const response = await fetch("/api/x/feed", { cache: "no-store" });
    if (!response.ok) throw new Error("x feed unavailable");
    const data = await response.json();
    const posts = Array.isArray(data.items) ? data.items : [];
    const main = posts.filter((post) => !isXThread(post));
    const threads = posts.filter(isXThread);
    const signature = JSON.stringify(posts.map((post) => [post.id, post.text, post.type, post.postedAt, post.replyTo, post.quoteTweetId, post.mediaUrl, post.mediaType]));
    if (signature !== lastXFeedSignature) {
      renderXPostRail(xPostRail, main, "waiting for outbound signal...");
      renderXPostRail(xThreadRail, threads, "no live thread links yet.", { thread: true });
      lastXFeedSignature = signature;
    }
    xPostCount.textContent = `${main.length} POSTS`;
    xThreadCount.textContent = `${threads.length} LINKS`;
  } catch {
    xPostCount.textContent = "RETRY";
    xThreadCount.textContent = "RETRY";
  } finally { xFeedPollInFlight = false; }
}
function resizeProfileImage(file) {
  return new Promise((resolve, reject) => {
    const image = new Image(); const url = URL.createObjectURL(file);
    image.onload = () => {
      const size = 128; const canvas = document.createElement("canvas"); canvas.width = size; canvas.height = size;
      const context = canvas.getContext("2d"); const scale = Math.max(size / image.width, size / image.height);
      const width = image.width * scale; const height = image.height * scale;
      context.drawImage(image, (size - width) / 2, (size - height) / 2, width, height);
      URL.revokeObjectURL(url); resolve(canvas.toDataURL("image/jpeg", .76));
    };
    image.onerror = () => { URL.revokeObjectURL(url); reject(new Error("image unavailable")); };
    image.src = url;
  });
}
async function submitShill(event) {
  event.preventDefault();
  const button = document.querySelector("#shillSubmit"); button.disabled = true; shillStatus.textContent = "TRANSMITTING";
  try {
    const response = await fetch("/api/shills", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: document.querySelector("#shillName").value, message: document.querySelector("#shillMessage").value, kind: selectedShillKind, pfp: shillPfpData }) });
    const data = await response.json(); if (!response.ok) throw new Error(data.error || "Transmission failed");
    document.querySelector("#shillMessage").value = ""; shillStatus.textContent = "SIGNAL RECEIVED"; await pollShills();
  } catch (error) { shillStatus.textContent = String(error.message || "WIRE ERROR").toUpperCase(); }
  finally { button.disabled = false; }
}

function setWalletTab(tabName) {
  document.querySelectorAll("[data-wallet-tab]").forEach((tab) => { const active = tab.dataset.walletTab === tabName; tab.classList.toggle("active", active); tab.setAttribute("aria-selected", String(active)); });
  document.querySelectorAll("[data-wallet-view]").forEach((view) => { const active = view.dataset.walletView === tabName; view.classList.toggle("active", active); view.hidden = !active; });
}

function loadIdentity(index, shouldPlay = true) {
  if (speaking) return;
  currentIdentity = (index + identityClips.length) % identityClips.length;
  const clip = identityClips[currentIdentity];
  swapVladVideo(`vladvideos/${clip.id}.mp4`, { shouldPlay });
}

function fitCanvas(canvas) {
  const rect = canvas.getBoundingClientRect();
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  const width = Math.max(1, Math.floor(rect.width * ratio));
  const height = Math.max(1, Math.floor(rect.height * ratio));
  if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
  return { width, height, ratio };
}

const voidStars = Array.from({ length: 220 }, (_, index) => ({
  x: (Math.random() - .5) * 2.8,
  y: (Math.random() - .5) * 2.1,
  z: .08 + Math.random() * .92,
  size: .45 + Math.random() * 1.8,
  tone: index % 13 === 0 ? "cyan" : index % 17 === 0 ? "gold" : "acid"
}));
let voidLastFrame = 0;
let voidLastPaint = 0;

function resetVoidStar(star) {
  star.x = (Math.random() - .5) * 2.8;
  star.y = (Math.random() - .5) * 2.1;
  star.z = .92 + Math.random() * .08;
  star.size = .45 + Math.random() * 1.8;
}

function drawVoid(time = 0) {
  if (!reducedMotion && window.innerWidth <= 600 && time && voidLastPaint && time - voidLastPaint < 32) {
    requestAnimationFrame(drawVoid);
    return;
  }
  voidLastPaint = time;
  const canvas = document.querySelector("#voidCanvas");
  const { width, height } = fitCanvas(canvas);
  const context = canvas.getContext("2d");
  const elapsed = voidLastFrame ? Math.min(48, time - voidLastFrame) : 16;
  voidLastFrame = time;
  const centerX = width * (.53 + Math.sin(time * .00013) * .075);
  const centerY = height * (.34 + Math.cos(time * .00017) * .055);
  const shortSide = Math.min(width, height);
  context.clearRect(0, 0, width, height);
  context.fillStyle = "#010301";
  context.fillRect(0, 0, width, height);

  const voidGlow = context.createRadialGradient(centerX, centerY, 0, centerX, centerY, shortSide * .58);
  voidGlow.addColorStop(0, "rgba(0, 0, 0, .98)");
  voidGlow.addColorStop(.08, "rgba(40, 95, 50, .22)");
  voidGlow.addColorStop(.24, "rgba(72, 188, 91, .12)");
  voidGlow.addColorStop(.5, "rgba(30, 84, 63, .07)");
  voidGlow.addColorStop(1, "rgba(0, 0, 0, 0)");
  context.fillStyle = voidGlow;
  context.fillRect(0, 0, width, height);

  context.save();
  for (let ringIndex = 0; ringIndex < 17; ringIndex += 1) {
    const phase = (ringIndex / 17 + time * .000035) % 1;
    const radius = Math.pow(phase, 1.72) * shortSide * .72;
    const alpha = Math.sin(phase * Math.PI) * .12;
    context.beginPath();
    context.ellipse(centerX, centerY, radius * 1.32, radius * .5, Math.sin(time * .00007) * .16, 0, Math.PI * 2);
    context.strokeStyle = `rgba(${ringIndex % 5 === 0 ? "80, 210, 193" : "171, 255, 88"}, ${alpha})`;
    context.lineWidth = ringIndex % 4 === 0 ? 1.4 : .65;
    context.stroke();
  }
  context.restore();

  const speed = reducedMotion ? 0 : elapsed * .00022;
  const starLimit = window.innerWidth <= 600 ? 120 : voidStars.length;
  for (let starIndex = 0; starIndex < starLimit; starIndex += 1) {
    const star = voidStars[starIndex];
    star.z -= speed;
    if (star.z <= .045) resetVoidStar(star);
    const scale = .43 / star.z;
    const previousScale = .43 / Math.min(1, star.z + speed * 10 + .008);
    const x = centerX + star.x * width * scale;
    const y = centerY + star.y * height * scale;
    const previousX = centerX + star.x * width * previousScale;
    const previousY = centerY + star.y * height * previousScale;
    if (x < -30 || x > width + 30 || y < -30 || y > height + 30) {
      resetVoidStar(star);
      continue;
    }
    const alpha = Math.min(.72, .08 + (1 - star.z) * .7);
    const color = star.tone === "cyan" ? `96, 232, 211` : star.tone === "gold" ? `213, 180, 92` : `196, 255, 104`;
    context.beginPath();
    context.moveTo(previousX, previousY);
    context.lineTo(x, y);
    context.strokeStyle = `rgba(${color}, ${alpha * .7})`;
    context.lineWidth = Math.max(.45, star.size * (1 - star.z) * 1.25);
    context.stroke();
    context.fillStyle = `rgba(${color}, ${alpha})`;
    const pointSize = Math.max(.55, star.size * (1 - star.z));
    context.fillRect(x, y, pointSize, pointSize);
  }
  if (!reducedMotion) requestAnimationFrame(drawVoid);
}

function initializePageMotion() {
  if (reducedMotion || !("IntersectionObserver" in window)) return;
  const targets = document.querySelectorAll(".grand-wordmark, .system-grid > .panel, .system-grid > .ambient-strip, .wallet-section, .shills-section");
  document.body.classList.add("motion-ready");
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add("is-revealed");
      observer.unobserve(entry.target);
    });
  }, { rootMargin: "0px 0px -8%", threshold: .08 });
  targets.forEach((target, index) => {
    target.classList.add("reveal-target");
    target.style.setProperty("--reveal-index", index % 4);
    observer.observe(target);
  });
}

document.querySelectorAll("[data-wallet-tab]").forEach((tab) => tab.addEventListener("click", () => setWalletTab(tab.dataset.walletTab)));
document.querySelectorAll("[data-shill-kind]").forEach((button) => button.addEventListener("click", () => {
  selectedShillKind = button.dataset.shillKind;
  document.querySelectorAll("[data-shill-kind]").forEach((option) => { const active = option === button; option.classList.toggle("active", active); option.setAttribute("aria-pressed", String(active)); });
}));
shillPfp.addEventListener("change", async () => {
  const file = shillPfp.files?.[0]; if (!file) return;
  try { shillPfpData = await resizeProfileImage(file); shillPfpPreview.textContent = ""; const image = document.createElement("img"); image.src = shillPfpData; image.alt = "Profile preview"; shillPfpPreview.append(image); }
  catch { shillStatus.textContent = "IMAGE REJECTED"; }
});
shillForm.addEventListener("submit", submitShill);
document.querySelectorAll("[data-scroll]").forEach((button) => button.addEventListener("click", () => document.querySelector(button.dataset.scroll)?.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth" })));
copyWallet.addEventListener("click", async () => {
  if (!fullWalletAddress) return;
  try {
    await navigator.clipboard.writeText(fullWalletAddress);
    copyWallet.textContent = "COPIED";
    window.setTimeout(() => { copyWallet.textContent = "COPY"; }, 1200);
  } catch { copyWallet.textContent = "RETRY"; window.setTimeout(() => { copyWallet.textContent = "COPY"; }, 1200); }
});
document.querySelector("#refreshWallet").addEventListener("click", () => { scanStatus.textContent = "SCANNING"; activityStatus.textContent = "SCANNING"; pollSummary(); pollActivity(); pollAiFeed(); });
document.querySelector("#wakeSystem").addEventListener("click", () => { pollAiFeed(); document.querySelector("#terminal").scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth" }); });
document.querySelector("#closeRoom").addEventListener("click", closeRoom);
roomOverlay.addEventListener("click", (event) => { if (event.target === roomOverlay) closeRoom(); });
document.addEventListener("keydown", (event) => { if (event.key === "Escape" && !roomOverlay.hidden) closeRoom(); });
document.addEventListener("pointerdown", unlockSpeech);
document.addEventListener("keydown", unlockSpeech);
accessOverlay.addEventListener("pointerdown", unlockSpeech);
accessOverlay.addEventListener("keydown", (event) => {
  if (event.key === "Enter" || event.key === " ") unlockSpeech();
});
document.addEventListener("visibilitychange", () => { if (!document.hidden) { pollAiFeed(); pollActivity(); pollXFeed(); unlockSpeech(); } });
[vladVideo, vladVideoBuffer].forEach((video) => {
  video.addEventListener("ended", () => {
    if (video === activeVladVideo && !speaking) loadIdentity(currentIdentity + 1);
  });
});
window.addEventListener("resize", () => {
  voidLastFrame = 0;
  voidLastPaint = 0;
  if (reducedMotion) drawVoid();
});

primeNextIdentityVideo();
initializePageMotion(); selectRoom(selectedRoom, false); loadWelcome(); pollSummary(); pollActivity(); pollAiFeed(); pollMindAtlas(); pollShills(); pollXFeed(); startAiStream(); drawVoid();
setInterval(pollAiFeed, 30000);
setInterval(pollSummary, 10000); setInterval(pollActivity, 2000); setInterval(pollMindAtlas, 15000); setInterval(pollShills, 5000); setInterval(pollXFeed, 7000);
