const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { spawn } = require("child_process");

const ROOT = __dirname;
const ENV_PATH = path.join(ROOT, ".env");
const RUNTIME_DIR = path.join(ROOT, ".runtime");
const PID_PATH = path.join(RUNTIME_DIR, "vladinator.pid");
const STDOUT_PATH = path.join(RUNTIME_DIR, "vladinator.stdout.log");
const STDERR_PATH = path.join(RUNTIME_DIR, "vladinator.stderr.log");
const DEFAULT_WALLET = "0x5fdb24bcd0b3b7a0a7c1ce17cc6b10a1441147b7";
const X_OFF = {
  X_AUTOMATION_ENABLED: "false",
  X_RESEARCH_ENABLED: "false",
  X_RESEARCH_DRY_RUN: "true",
  X_AUTO_REPLY_ENABLED: "false",
  X_AUTO_QUOTE_ENABLED: "false"
};
const X_ON = {
  X_AUTOMATION_ENABLED: "true",
  X_RESEARCH_ENABLED: "true",
  X_RESEARCH_DRY_RUN: "false",
  X_AUTO_REPLY_ENABLED: "true",
  X_AUTO_QUOTE_ENABLED: "true"
};

function parseEnv(text = "") {
  const values = {};
  for (const line of String(text).split(/\r?\n/)) {
    const match = line.match(/^\s*(?:\$env:)?([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (match) values[match[1]] = match[2].replace(/^["']|["']$/g, "");
  }
  return values;
}

function applyEnvUpdates(text = "", updates = {}) {
  const newline = String(text).includes("\r\n") ? "\r\n" : "\n";
  const lines = String(text).split(/\r?\n/);
  const pending = new Map(Object.entries(updates).map(([key, value]) => [key, String(value)]));
  const next = lines.map((line) => {
    const match = line.match(/^\s*(?:\$env:)?([A-Z0-9_]+)\s*=/);
    if (!match || !pending.has(match[1])) return line;
    const value = pending.get(match[1]);
    pending.delete(match[1]);
    return `${match[1]}=${value}`;
  });
  if (next.length === 1 && next[0] === "") next.pop();
  for (const [key, value] of pending) next.push(`${key}=${value}`);
  return `${next.join(newline).replace(/(?:\r?\n)+$/, "")}${newline}`;
}

function readEnv() {
  return parseEnv(fs.existsSync(ENV_PATH) ? fs.readFileSync(ENV_PATH, "utf8") : "");
}

function updateEnv(updates) {
  const current = fs.existsSync(ENV_PATH) ? fs.readFileSync(ENV_PATH, "utf8") : "";
  fs.writeFileSync(ENV_PATH, applyEnvUpdates(current, updates));
  return readEnv();
}

function ensureControlToken() {
  const current = readEnv();
  if (current.CONTAINER_CONTROL_TOKEN) return current.CONTAINER_CONTROL_TOKEN;
  const token = crypto.randomBytes(32).toString("hex");
  updateEnv({ CONTAINER_CONTROL_TOKEN: token });
  return token;
}

function pidFromFile() {
  try {
    const pid = Number(fs.readFileSync(PID_PATH, "utf8").trim());
    return Number.isInteger(pid) && pid > 0 ? pid : null;
  } catch {
    return null;
  }
}

function processRunning(pid) {
  if (!pid) return false;
  try { process.kill(pid, 0); return true; } catch { return false; }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function api(pathname, options = {}, baseUrl = null) {
  const env = readEnv();
  const base = baseUrl || `http://127.0.0.1:${Number(env.PORT || 4173)}`;
  const response = await fetch(new URL(pathname, base), options);
  const text = await response.text();
  let body;
  try { body = JSON.parse(text); } catch { body = { raw: text }; }
  if (!response.ok) throw new Error(body.error || body.raw || `${response.status} ${response.statusText}`);
  return body;
}

async function serverStatus() {
  try {
    const [x, wallet] = await Promise.all([api("/api/x/status"), api("/api/wallet/summary")]);
    return { reachable: true, x, wallet };
  } catch (error) {
    return { reachable: false, error: error.message };
  }
}

async function stopManagedServer() {
  const pid = pidFromFile();
  if (!pid || !processRunning(pid)) {
    try { fs.unlinkSync(PID_PATH); } catch {}
    return false;
  }
  process.kill(pid, "SIGTERM");
  for (let attempt = 0; attempt < 25 && processRunning(pid); attempt += 1) await sleep(200);
  if (processRunning(pid)) process.kill(pid, "SIGKILL");
  try { fs.unlinkSync(PID_PATH); } catch {}
  return true;
}

async function startManagedServer({ restart = false } = {}) {
  fs.mkdirSync(RUNTIME_DIR, { recursive: true });
  const existingPid = pidFromFile();
  if (existingPid && processRunning(existingPid)) {
    if (!restart) return existingPid;
    await stopManagedServer();
  } else {
    const status = await serverStatus();
    if (status.reachable) throw new Error("Port is already served by an unmanaged Vladinator process. Stop that process before using vladctl.");
  }
  ensureControlToken();
  const env = { ...process.env, ...readEnv() };
  const stdout = fs.openSync(STDOUT_PATH, "a");
  const stderr = fs.openSync(STDERR_PATH, "a");
  const child = spawn(process.execPath, [path.join(ROOT, "server.js")], {
    cwd: ROOT,
    detached: true,
    windowsHide: true,
    env,
    stdio: ["ignore", stdout, stderr]
  });
  child.unref();
  fs.closeSync(stdout);
  fs.closeSync(stderr);
  fs.writeFileSync(PID_PATH, String(child.pid));
  for (let attempt = 0; attempt < 40; attempt += 1) {
    if ((await serverStatus()).reachable) return child.pid;
    if (!processRunning(child.pid)) break;
    await sleep(250);
  }
  throw new Error(`Vladinator did not start. Check ${STDERR_PATH}`);
}

async function restartAfterConfig() {
  const pid = pidFromFile();
  const managed = processRunning(pid);
  const status = await serverStatus();
  if (status.reachable && !managed) throw new Error("A Vladinator server is running outside vladctl. Stop it before changing live modes.");
  return startManagedServer({ restart: managed });
}

async function setMode(action, target) {
  let updates = {};
  if (action === "on" && target === "backend") updates = { BACKEND_PAUSED: "false" };
  else if (action === "on" && (target === "x" || target === "all")) updates = { BACKEND_PAUSED: "false", ...X_ON };
  else if (action === "off" && target === "x") updates = X_OFF;
  else if (action === "off" && (target === "backend" || target === "all")) updates = { BACKEND_PAUSED: "true", ...X_OFF };
  else throw new Error("Use `on backend`, `on x`, `on all`, `off x`, `off backend`, or `off all`.");
  updateEnv({ VLADINATOR_WALLET_ADDRESS: readEnv().VLADINATOR_WALLET_ADDRESS || DEFAULT_WALLET, ...updates });
  const pid = await restartAfterConfig();
  const status = await serverStatus();
  console.log(`${target} ${action === "on" ? "enabled" : "disabled"} (pid ${pid})`);
  printStatus(status);
}

function assertInside(parent, candidate) {
  const root = path.resolve(parent);
  const target = path.resolve(candidate);
  if (target === root || !target.startsWith(`${root}${path.sep}`)) throw new Error(`Refusing to remove path outside ${root}`);
}

function clearLocalStateFiles() {
  const legacy = ["narrator-state.json", "x-state.json", "x-mind-state.json", "shills.json"]
    .map((name) => path.join(RUNTIME_DIR, name));
  for (const file of legacy) {
    assertInside(RUNTIME_DIR, file);
    try { fs.unlinkSync(file); } catch (error) { if (error.code !== "ENOENT") throw error; }
  }
  const wallets = path.join(RUNTIME_DIR, "wallets");
  assertInside(RUNTIME_DIR, wallets);
  if (fs.existsSync(wallets)) fs.rmSync(wallets, { recursive: true, force: true });
}

async function resetLocal() {
  ensureControlToken();
  const pid = pidFromFile();
  const wasManaged = processRunning(pid);
  const status = await serverStatus();
  if (status.reachable) {
    await api("/api/_internal/reset", {
      method: "POST",
      headers: { authorization: `Bearer ${readEnv().CONTAINER_CONTROL_TOKEN}` }
    });
  }
  if (wasManaged) await stopManagedServer();
  clearLocalStateFiles();
  if (wasManaged) await startManagedServer();
  console.log("local narrator, rooms, shills, X feed, and X mind cleared");
}

async function resetCloud() {
  const token = ensureControlToken();
  const result = await api("/api/_internal/reset", {
    method: "POST",
    headers: { authorization: `Bearer ${token}` }
  }, "https://vladinator.ceo");
  console.log(`cloud data cleared for ${result.durable?.wallet || DEFAULT_WALLET}`);
}

async function inject(target, args) {
  const flags = new Set(args.filter((value) => value.startsWith("--")));
  const modeIndex = args.indexOf("--mode");
  const mode = modeIndex >= 0 ? args[modeIndex + 1] : "reply";
  const message = args.filter((value, index) => !value.startsWith("--") && index !== modeIndex + 1).join(" ").trim();
  if (!message) throw new Error("Add a message after the target.");
  const token = ensureControlToken();
  const result = await api("/api/_internal/inject", {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({ target, message, mode, publish: flags.has("--post"), name: "operator" })
  });
  if (target === "web") {
    console.log(`queued in the website terminal as ${result.item.id}`);
    return;
  }
  console.log(result.generated.mainTweet);
  if (result.generated.followUpTweet) console.log(`\nfollow-up:\n${result.generated.followUpTweet}`);
  console.log(result.dryRun ? "\ndraft only" : `\nposted as ${result.tweet?.id || "tweet"}`);
}

function printStatus(status, pid = pidFromFile()) {
  const managed = processRunning(pid);
  const env = readEnv();
  console.log(`process: ${managed ? `running (pid ${pid})` : "not managed"}`);
  console.log(`server: ${status.reachable ? "reachable" : "offline"}`);
  console.log(`wallet: ${status.wallet?.wallet || env.VLADINATOR_WALLET_ADDRESS || DEFAULT_WALLET}`);
  console.log(`vlad backend: ${status.x ? (status.x.backendPaused ? "off" : "on") : env.BACKEND_PAUSED === "true" ? "off (configured)" : "on (configured)"}`);
  console.log(`x ai: ${status.x ? (status.x.automationEnabled && !status.x.backendPaused ? "on" : "off") : env.X_AUTOMATION_ENABLED === "true" ? "on (configured)" : "off (configured)"}`);
}

function help() {
  console.log(`Vladinator local control

  npm run vlad -- status
  npm run vlad -- on backend
  npm run vlad -- on x
  npm run vlad -- on all
  npm run vlad -- off x
  npm run vlad -- off all
  npm run vlad -- start | stop | restart
  npm run vlad -- inject web "what are you watching?"
  npm run vlad -- inject x "are you actually trading?"
  npm run vlad -- inject x "post about the wallet" --mode post
  npm run vlad -- inject x "post about the wallet" --mode post --post
  npm run vlad -- reset local | cloud | all

X injection is a draft unless --post is present. Turning on X also starts the wallet backend because live receipts are its primary input.`);
}

async function main(argv = process.argv.slice(2)) {
  const [command = "help", target, ...rest] = argv;
  if (command === "help" || command === "--help" || command === "-h") return help();
  if (command === "status") return printStatus(await serverStatus());
  if (command === "on" || command === "off") return setMode(command, target);
  if (command === "start") { const pid = await startManagedServer(); console.log(`started pid ${pid}`); return printStatus(await serverStatus(), pid); }
  if (command === "stop") { console.log((await stopManagedServer()) ? "local server stopped" : "no managed local server was running"); return; }
  if (command === "restart") { const pid = await startManagedServer({ restart: true }); console.log(`restarted pid ${pid}`); return printStatus(await serverStatus(), pid); }
  if (command === "inject" && (target === "web" || target === "x")) return inject(target, rest);
  if (command === "reset") {
    if (target === "local" || target === "all") await resetLocal();
    if (target === "cloud" || target === "all") await resetCloud();
    if (!["local", "cloud", "all"].includes(target)) throw new Error("Use `reset local`, `reset cloud`, or `reset all`.");
    return;
  }
  throw new Error("Unknown command. Run `npm run vlad -- help`.");
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`vladctl: ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = { parseEnv, applyEnvUpdates };
