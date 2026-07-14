import { Container } from "@cloudflare/containers";
import { env } from "cloudflare:workers";

export class VladinatorContainer extends Container {
  defaultPort = 4173;
  sleepAfter = "15m";
  envVars = {
    OPENAI_API_KEY: env.OPENAI_API_KEY,
    OPENAI_MODEL: env.OPENAI_MODEL,
    ELEVENLABS_API_KEY: env.ELEVENLABS_API_KEY,
    ELEVENLABS_VOICE_ID: env.ELEVENLABS_VOICE_ID,
    ELEVENLABS_MODEL_ID: env.ELEVENLABS_MODEL_ID,
    ROBINHOODCHAIN_RPC_URL: env.ROBINHOODCHAIN_RPC_URL,
    X_API_KEY: env.X_API_KEY,
    X_API_SECRET: env.X_API_SECRET,
    X_BEARER_TOKEN: env.X_BEARER_TOKEN,
    X_CLIENT_ID: env.X_CLIENT_ID,
    X_CLIENT_SECRET: env.X_CLIENT_SECRET,
    X_ACCESS_TOKEN: env.X_ACCESS_TOKEN,
    X_ACCESS_TOKEN_SECRET: env.X_ACCESS_TOKEN_SECRET,
    X_USER_ID: env.X_USER_ID,
    X_AUTOMATION_ENABLED: env.X_AUTOMATION_ENABLED,
    X_RESEARCH_ENABLED: env.X_RESEARCH_ENABLED,
    X_RESEARCH_DRY_RUN: env.X_RESEARCH_DRY_RUN,
    X_AUTO_REPLY_ENABLED: env.X_AUTO_REPLY_ENABLED,
    X_AUTO_QUOTE_ENABLED: env.X_AUTO_QUOTE_ENABLED,
    X_ACCOUNT_POLL_INTERVAL_MS: env.X_ACCOUNT_POLL_INTERVAL_MS,
    X_TOPIC_SEARCH_INTERVAL_MS: env.X_TOPIC_SEARCH_INTERVAL_MS,
    X_MAX_RESULTS_PER_QUERY: env.X_MAX_RESULTS_PER_QUERY,
    X_MIND_SYNC_URL: env.X_MIND_SYNC_URL || "https://vladinator.ceo/api/_internal/x-mind",
    X_MIND_SYNC_TOKEN: env.CONTAINER_CONTROL_TOKEN,
    BACKEND_PAUSED: env.BACKEND_PAUSED,
    PORT: "4173"
  };

  async fetch(request) {
    if (new URL(request.url).pathname === "/__vladinator/restart") {
      const expected = env.CONTAINER_CONTROL_TOKEN;
      const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
      if (!expected || supplied !== expected) return new Response("Not found", { status: 404 });
      await this.destroy();
      return new Response("Container restart requested", { status: 202 });
    }
    return this.containerFetch(request);
  }
}

async function ensureShillsDb(db) {
  await db.prepare(`CREATE TABLE IF NOT EXISTS shills (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    pfp TEXT NOT NULL DEFAULT '',
    message TEXT NOT NULL,
    kind TEXT NOT NULL,
    created_at TEXT NOT NULL,
    response TEXT,
    responded_at TEXT
  )`).run();
}

async function ensureXPostsDb(db) {
  await db.prepare(`CREATE TABLE IF NOT EXISTS x_posts (
    id TEXT PRIMARY KEY,
    text TEXT NOT NULL,
    type TEXT NOT NULL,
    posted_at TEXT NOT NULL,
    reply_to TEXT NOT NULL DEFAULT '',
    quote_tweet_id TEXT NOT NULL DEFAULT '',
    context_author TEXT NOT NULL DEFAULT '',
    media_url TEXT NOT NULL DEFAULT '',
    media_type TEXT NOT NULL DEFAULT ''
  )`).run();
}

async function ensureXMindDb(db) {
  await db.prepare(`CREATE TABLE IF NOT EXISTS x_mind_state (
    id TEXT PRIMARY KEY,
    payload TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`).run();
}

async function durableXMindState(request, env) {
  const expected = env.CONTAINER_CONTROL_TOKEN;
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!expected || supplied !== expected) return new Response("Not found", { status: 404 });
  await ensureXMindDb(env.SHILLS_DB);
  if (request.method === "PUT") {
    const body = await request.json().catch(() => null);
    if (!body?.state || typeof body.state !== "object") return Response.json({ ok: false, error: "state object required" }, { status: 400 });
    const updatedAt = body.state.updatedAt || new Date().toISOString();
    await env.SHILLS_DB.prepare(`INSERT INTO x_mind_state (id, payload, updated_at)
      VALUES ('primary', ?, ?)
      ON CONFLICT(id) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at`)
      .bind(JSON.stringify(body.state), updatedAt).run();
    return Response.json({ ok: true, updatedAt }, { headers: { "cache-control": "no-store" } });
  }
  if (request.method === "GET") {
    const row = await env.SHILLS_DB.prepare("SELECT payload, updated_at FROM x_mind_state WHERE id = 'primary'").first();
    if (!row) return Response.json({ state: null }, { headers: { "cache-control": "no-store" } });
    let state = null;
    try { state = JSON.parse(row.payload); } catch {}
    return Response.json({ state, updatedAt: row.updated_at }, { headers: { "cache-control": "no-store" } });
  }
  return new Response("Method not allowed", { status: 405 });
}

async function storeXPosts(db, items) {
  for (const item of items || []) {
    if (!item?.id || !item?.text) continue;
    await db.prepare(`INSERT INTO x_posts (id, text, type, posted_at, reply_to, quote_tweet_id, context_author, media_url, media_type)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        text = excluded.text,
        type = excluded.type,
        posted_at = excluded.posted_at,
        reply_to = excluded.reply_to,
        quote_tweet_id = excluded.quote_tweet_id,
        context_author = excluded.context_author,
        media_url = excluded.media_url,
        media_type = excluded.media_type`)
      .bind(item.id, item.text, item.type || "routine", item.postedAt || new Date().toISOString(), item.replyTo || "", item.quoteTweetId || "", item.contextAuthor || "", item.mediaUrl || "", item.mediaType || "").run();
  }
}

function xPostFromRow(row) {
  return {
    id: row.id,
    text: row.text,
    type: row.type,
    postedAt: row.posted_at,
    replyTo: row.reply_to,
    quoteTweetId: row.quote_tweet_id,
    contextAuthor: row.context_author,
    mediaUrl: row.media_url,
    mediaType: row.media_type
  };
}

async function storeShill(db, item) {
  await db.prepare(`INSERT INTO shills (id, name, pfp, message, kind, created_at, response, responded_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      pfp = CASE WHEN excluded.pfp <> '' THEN excluded.pfp ELSE shills.pfp END,
      message = excluded.message,
      kind = excluded.kind,
      response = excluded.response,
      responded_at = excluded.responded_at`)
    .bind(item.id, item.name, item.pfp || "", item.message, item.kind, item.createdAt, item.response || null, item.respondedAt || null).run();
}

async function durableShillFeed(request, env, container) {
  await ensureShillsDb(env.SHILLS_DB);
  if (request.method === "POST") {
    const response = await container.fetch(request);
    if (response.ok) {
      const data = await response.clone().json();
      if (data.item) await storeShill(env.SHILLS_DB, data.item);
    }
    return response;
  }
  try {
    const live = await container.fetch(request);
    if (live.ok) {
      const data = await live.json();
      for (const item of data.items || []) await storeShill(env.SHILLS_DB, item);
    }
  } catch {}
  const result = await env.SHILLS_DB.prepare("SELECT id, name, pfp, message, kind, created_at, response, responded_at FROM shills ORDER BY created_at DESC LIMIT 100").all();
  const items = (result.results || []).map((row) => ({ id: row.id, name: row.name, pfp: row.pfp, message: row.message, kind: row.kind, createdAt: row.created_at, response: row.response, respondedAt: row.responded_at }));
  const unanswered = items.find((item) => !item.response);
  if (unanswered) {
    await container.fetch(new Request(new URL("/api/shills", request.url), {
      method: "POST",
      headers: { "content-type": "application/json", "x-vladinator-replay": "1" },
      body: JSON.stringify(unanswered)
    })).catch(() => {});
  }
  return Response.json({ items, count: items.length }, { headers: { "cache-control": "no-store" } });
}

async function xTimelineBackfill(request, env) {
  if (!env.X_BEARER_TOKEN || !env.X_USER_ID) return [];
  const cacheKey = new Request(new URL("/__vladinator/x-timeline", request.url).toString());
  const cached = await caches.default.match(cacheKey);
  if (cached) return cached.json().catch(() => []);
  try {
    const timelineUrl = new URL(`https://api.x.com/2/users/${encodeURIComponent(env.X_USER_ID)}/tweets`);
    timelineUrl.searchParams.set("max_results", "25");
    timelineUrl.searchParams.set("exclude", "retweets");
    timelineUrl.searchParams.set("tweet.fields", "created_at,attachments,referenced_tweets");
    timelineUrl.searchParams.set("expansions", "attachments.media_keys");
    timelineUrl.searchParams.set("media.fields", "type,url,preview_image_url");
    const response = await fetch(timelineUrl, { headers: { authorization: `Bearer ${env.X_BEARER_TOKEN}` } });
    if (!response.ok) return [];
    const payload = await response.json();
    const mediaByKey = new Map((payload.includes?.media || []).map((media) => [media.media_key, media]));
    const items = (payload.data || []).map((tweet) => {
      const references = tweet.referenced_tweets || [];
      const replyTo = references.find((reference) => reference.type === "replied_to")?.id || "";
      const quoteTweetId = references.find((reference) => reference.type === "quoted")?.id || "";
      const media = (tweet.attachments?.media_keys || []).map((key) => mediaByKey.get(key)).find(Boolean);
      return {
        id: tweet.id,
        text: tweet.text,
        type: quoteTweetId ? "quote_mention" : replyTo ? "reply_mention" : "timeline",
        postedAt: tweet.created_at || new Date().toISOString(),
        replyTo,
        quoteTweetId,
        contextAuthor: "",
        mediaUrl: media?.url || media?.preview_image_url || "",
        mediaType: media?.url ? (media.type === "photo" ? "image/jpeg" : "") : (media?.preview_image_url ? "image/jpeg" : "")
      };
    }).filter((item) => item.id && item.text);
    await caches.default.put(cacheKey, new Response(JSON.stringify(items), { headers: { "content-type": "application/json", "cache-control": "public, max-age=60" } }));
    return items;
  } catch {
    return [];
  }
}

async function durableXFeed(request, env, container) {
  await ensureXPostsDb(env.SHILLS_DB);
  let liveItems = [];
  try {
    const live = await container.fetch(request);
    if (live.ok) {
      const data = await live.json();
      liveItems = data.items || [];
      await storeXPosts(env.SHILLS_DB, liveItems);
    }
  } catch {}
  const timelineItems = await xTimelineBackfill(request, env);
  if (timelineItems.length) await storeXPosts(env.SHILLS_DB, timelineItems);
  const result = await env.SHILLS_DB.prepare("SELECT id, text, type, posted_at, reply_to, quote_tweet_id, context_author, media_url, media_type FROM x_posts ORDER BY posted_at DESC LIMIT 100").all();
  const storedItems = (result.results || []).map(xPostFromRow);
  const merged = new Map();
  for (const item of [...liveItems, ...timelineItems, ...storedItems]) if (item?.id && item?.text) merged.set(item.id, item);
  const items = [...merged.values()].sort((a, b) => new Date(b.postedAt || 0) - new Date(a.postedAt || 0)).slice(0, 80);
  return Response.json({ items, count: items.length, updatedAt: new Date().toISOString() }, { headers: { "cache-control": "no-store" } });
}

async function serveRangedVideo(request, container) {
  const rangeHeader = request.headers.get("range");
  if (!rangeHeader || request.method !== "GET") return container.fetch(request);
  const match = rangeHeader.match(/bytes=(\d*)-(\d*)/i);
  if (!match) return container.fetch(request);
  const upstreamHeaders = new Headers(request.headers);
  upstreamHeaders.delete("range");
  const origin = await container.fetch(new Request(request.url, { method: "GET", headers: upstreamHeaders }));
  if (!origin.ok) return origin;
  const bytes = new Uint8Array(await origin.arrayBuffer());
  const size = bytes.byteLength;
  let start = match[1] ? Number(match[1]) : 0;
  let end = match[2] ? Math.min(Number(match[2]), size - 1) : size - 1;
  if (!match[1] && match[2]) {
    const suffix = Math.min(Number(match[2]), size);
    start = Math.max(0, size - suffix);
    end = size - 1;
  }
  if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || start >= size || end < start) {
    return new Response(null, { status: 416, headers: { "content-range": `bytes */${size}`, "accept-ranges": "bytes" } });
  }
  const headers = new Headers(origin.headers);
  headers.set("accept-ranges", "bytes");
  headers.set("content-range", `bytes ${start}-${end}/${size}`);
  headers.set("content-length", String(end - start + 1));
  headers.set("cache-control", "public, max-age=3600");
  return new Response(bytes.slice(start, end + 1), { status: 206, headers });
}
export default {
  async fetch(request, env) {
    const container = env.VLADINATOR_CONTAINER.getByName("production");
    const url = new URL(request.url);
    if (url.pathname === "/api/_internal/x-mind" && (request.method === "GET" || request.method === "PUT")) return durableXMindState(request, env);
    if (url.pathname === "/api/_internal/restart" && request.method === "POST") {
      const expected = env.CONTAINER_CONTROL_TOKEN;
      const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
      if (!expected || supplied !== expected) return new Response("Not found", { status: 404 });
      await container.fetch(new Request(new URL("/__vladinator/restart", request.url), {
        method: "POST",
        headers: { authorization: `Bearer ${expected}` }
      }));
      return Response.json({ restarting: true }, { headers: { "cache-control": "no-store" } });
    }
    if (url.pathname === "/api/shills" && (request.method === "GET" || request.method === "POST")) return durableShillFeed(request, env, container);
    if (url.pathname === "/api/x/feed" && request.method === "GET") return durableXFeed(request, env, container);
    if (/^\/(?:vladvideos|vladmemes)\/.+\.(?:mp4|webm|mov)$/i.test(url.pathname) && request.headers.get("range")) return serveRangedVideo(request, container);
    const upstreamUrl = new URL(request.url);
    if (upstreamUrl.pathname === "/") upstreamUrl.pathname = "/index.html";
    const response = await container.fetch(new Request(upstreamUrl, request));
    if (upstreamUrl.pathname === "/index.html" || /\.(?:css|js)$/i.test(upstreamUrl.pathname)) {
      const headers = new Headers(response.headers);
      headers.set("cache-control", "no-store");
      return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
    }
    return response;
  }
};
