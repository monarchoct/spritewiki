const http = require("http");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");
const PORT = Number(process.env.PORT || 4173);
const ROOT = __dirname;
const WALLET = "0x98e915932c3ca47ae57050aabc39aece92aa9e82";
const RPC = process.env.ROBINHOODCHAIN_RPC_URL || "https://rpc.mainnet.chain.robinhood.com";
const V2 = "https://robinhoodchain.blockscout.com/api/v2";
const V1 = "https://robinhoodchain.blockscout.com/api";
const WETH = "0x0bd7d308f8e1639fab988df18a8011f41eacad73";
let summary = { wallet: WALLET, state: "warming", totalUsd: 0, pricedAssets: 0, tokens: [] };
let activity = { wallet: WALLET, state: "warming", events: [] };
let summaryJob;
let activityJob;
let latestTransfers = [];
const markets = new Map();
const norm = (value) => String(value || "").toLowerCase();
const bigint = (value) => { try { return BigInt(value || 0); } catch { return 0n; } };
const symbol = (value) => String(value || "TOKEN").replace(/[^a-z0-9_$.-]/gi, "").slice(0, 14) || "TOKEN";
function display(value, decimals = 18, places = 5) {
  const amount = bigint(value); const digits = Math.max(0, Math.min(Number(decimals) || 18, 36)); const base = 10n ** BigInt(digits);
  const fraction = (amount % base).toString().padStart(digits, "0").slice(0, places).replace(/0+$/, "");
  return `${amount / base}${fraction ? `.${fraction}` : ""}`;
}
async function getJson(url, options = {}, timeout = 7000) {
  const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), timeout);
  try { const response = await fetch(url, { ...options, signal: controller.signal }); if (!response.ok) throw new Error(String(response.status)); return await response.json(); }
  finally { clearTimeout(timer); }
}
const rpc = (method, params) => getJson(RPC, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) });
async function getMarket(address) {
  const key = norm(address); const cached = markets.get(key); if (cached && Date.now() - cached.at < 60000) return cached;
  try {
    const response = await getJson(`https://api.dexscreener.com/token-pairs/v1/robinhood/${key}`, {}, 5000); const pairs = Array.isArray(response) ? response : [];
    const bases = pairs.filter((pair) => norm(pair.baseToken?.address) === key); const pool = bases.length ? bases : pairs; const pair = pool.sort((a, b) => Number(b.liquidity?.usd || 0) - Number(a.liquidity?.usd || 0))[0];
    let priceUsd = Number(pair?.priceUsd || 0) || null; if (!bases.length && pair?.priceNative) priceUsd = Number(pair.priceUsd || 0) / Number(pair.priceNative || 1) || null;
    const result = { image: pair?.info?.imageUrl || null, priceUsd, change24h: bases.length ? Number(pair?.priceChange?.h24 ?? 0) : null, liquidityUsd: Number(pair?.liquidity?.usd || 0) || null, at: Date.now() }; markets.set(key, result); return result;
  } catch { return { image: null, priceUsd: null, change24h: null, liquidityUsd: null, at: Date.now() }; }
}
const spam = (asset) => norm(asset.symbol) === "cashbull" || norm(asset.name) === "cash bull" || norm(asset.name).includes("feather");
function legacyInventory(transfers) {
  const balances = new Map();
  for (const row of transfers) {
    const address = norm(row.contractAddress); if (!address) continue;
    const current = balances.get(address) || { value: 0n, token: { address, symbol: row.tokenSymbol, name: row.tokenName, decimals: Number(row.tokenDecimal || 18), type: "ERC-20" } };
    if (norm(row.to) === WALLET) current.value += bigint(row.value); if (norm(row.from) === WALLET) current.value -= bigint(row.value); balances.set(address, current);
  }
  return [...balances.values()].filter((item) => item.value > 0n).map((item) => ({ token: item.token, value: item.value.toString() }));
}
async function scanSummary() {
  const [balance, inventory, ethQuote] = await Promise.allSettled([rpc("eth_getBalance", [WALLET, "latest"]), getJson(`${V2}/addresses/${WALLET}/token-balances`), getMarket(WETH)]);
  const ethPrice = ethQuote.status === "fulfilled" ? ethQuote.value.priceUsd : null; const ethAmount = balance.status === "fulfilled" ? display(balance.value.result, 18) : "0";
  const native = { contractAddress: "native", symbol: "ETH", name: "Ether", amount: ethAmount, kind: "native", image: "https://assets.coingecko.com/coins/images/279/small/ethereum.png", priceUsd: ethPrice, change24h: null, usd: ethPrice ? Number(ethAmount) * ethPrice : null };
  const items = inventory.status === "fulfilled" ? (inventory.value.items || inventory.value || []) : legacyInventory(latestTransfers);
  const assets = await Promise.all(items.map(async (item) => { const token = item.token || item; const decimals = Number(token.decimals ?? 18); const amount = display(item.value || item.balance, decimals); const quote = await getMarket(token.address_hash || token.address); return { contractAddress: norm(token.address_hash || token.address), symbol: symbol(token.symbol), name: token.name || "Indexed asset", amount, decimals, kind: token.type || "ERC-20", image: token.icon_url || quote.image, priceUsd: quote.priceUsd, change24h: quote.change24h, liquidityUsd: quote.liquidityUsd, usd: quote.priceUsd ? Number(amount) * quote.priceUsd : null }; }));
  const tokens = [native, ...assets.filter((asset) => Number(asset.amount) > 0 && !spam(asset))]; const priced = tokens.filter((asset) => Number.isFinite(asset.usd));
  return { wallet: WALLET, chain: "Robinhood Chain", chainId: 4663, updatedAt: new Date().toISOString(), state: inventory.status === "fulfilled" ? "live" : latestTransfers.length ? "legacy" : "cached", indexed: inventory.status === "fulfilled" || latestTransfers.length > 0, totalUsd: priced.reduce((sum, asset) => sum + asset.usd, 0), pricedAssets: priced.length, nativePriceUsd: ethPrice, tokens };
}
async function internalEth(hash) {
  try { const result = await getJson(`${V1}?module=account&action=txlistinternal&txhash=${hash}`, {}, 5000); return (Array.isArray(result.result) ? result.result : []).filter((row) => norm(row.to) === WALLET && row.isError !== "1").reduce((sum, row) => sum + bigint(row.value), 0n); } catch { return 0n; }
}
async function scanActivity() {
  const response = await getJson(`${V1}?module=account&action=tokentx&address=${WALLET}&sort=desc`, {}, 8500); const transfers = Array.isArray(response.result) ? response.result : []; latestTransfers = transfers; const grouped = new Map(); for (const row of transfers) { if (!grouped.has(row.hash)) grouped.set(row.hash, []); grouped.get(row.hash).push(row); }
  const ethPrice = summary.nativePriceUsd || (await getMarket(WETH)).priceUsd;
  const events = await Promise.all([...grouped.entries()].slice(0, 12).map(async ([hash, rows]) => {
    const incoming = rows.filter((row) => norm(row.to) === WALLET); const outgoing = rows.filter((row) => norm(row.from) === WALLET); let tx; try { tx = (await rpc("eth_getTransactionByHash", [hash])).result; } catch {}
    const nativeOut = bigint(tx?.value); const nativeIn = outgoing.length && nativeOut === 0n ? await internalEth(hash) : 0n; let type = "token_in"; let chosen = incoming[0] || outgoing[0];
    if (incoming.length && nativeOut > 0n) { type = "buy"; chosen = incoming[0]; } else if (outgoing.length && nativeIn > 0n) { type = "sell"; chosen = outgoing[0]; } else if (outgoing.length) { type = "token_out"; chosen = outgoing[0]; }
    const asset = { contractAddress: norm(chosen.contractAddress), symbol: symbol(chosen.tokenSymbol), name: chosen.tokenName || "Token", decimals: Number(chosen.tokenDecimal || 18), kind: "ERC-20" }; const quote = await getMarket(asset.contractAddress); asset.image = quote.image;
    const tokenAmount = display(chosen.value, asset.decimals); const nativeAmount = type === "buy" ? display(nativeOut, 18) : type === "sell" ? display(nativeIn, 18) : null; const usdValue = nativeAmount && ethPrice ? Number(nativeAmount) * ethPrice : quote.priceUsd ? Number(tokenAmount) * quote.priceUsd : null;
    return { hash, timestamp: rows[0].timeStamp ? new Date(Number(rows[0].timeStamp) * 1000).toISOString() : null, type, direction: type === "buy" ? "ETH OUT / TOKEN IN" : type === "sell" ? "TOKEN OUT / ETH IN" : type.replace("_", " ").toUpperCase(), method: type === "buy" || type === "sell" ? "swap contract" : "contract interaction", amount: `${tokenAmount} ${asset.symbol}${nativeAmount ? ` for ${nativeAmount} ETH` : ""}`, asset, usdValue, nativeAmount, status: "ok" };
  })); return { wallet: WALLET, updatedAt: new Date().toISOString(), state: "live", events };
}
function refreshSummary() { if (summaryJob) return; summaryJob = scanSummary().then((data) => { summary = data; }).catch(() => {}).finally(() => { summaryJob = null; }); }
function refreshActivity() { if (activityJob) return; activityJob = scanActivity().then((data) => { activity = data; }).catch(() => {}).finally(() => { activityJob = null; }); }
function sendJson(res, body) { res.writeHead(200, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }); res.end(JSON.stringify(body)); }
function serve(req, res) { const requestPath = req.url === "/" ? "/index.html" : req.url.split("?")[0]; const file = path.join(ROOT, path.normalize(requestPath).replace(/^([.][.][\\/])+/, "")); if (!file.startsWith(ROOT)) return sendJson(res, { error: "forbidden" }); const types = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "application/javascript; charset=utf-8", ".png": "image/png", ".mp4": "video/mp4", ".md": "text/markdown; charset=utf-8" }; fs.readFile(file, (error, data) => { if (error) { res.writeHead(404); return res.end(); } res.writeHead(200, { "content-type": types[path.extname(file)] || "application/octet-stream" }); res.end(data); }); }
http.createServer((req, res) => { const url = new URL(req.url, `http://${req.headers.host}`); if (url.pathname === "/api/wallet/summary") return sendJson(res, summary); if (url.pathname === "/api/wallet/activity") return sendJson(res, activity); serve(req, res); }).listen(PORT, () => { console.log(`Vladinator backend listening on http://localhost:${PORT}`); refreshSummary(); refreshActivity(); setInterval(refreshSummary, 10000); setInterval(refreshActivity, 6000); });
