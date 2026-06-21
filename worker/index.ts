interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  SPRITES: R2Bucket;
  X_CLIENT_ID?: string;
  X_CLIENT_SECRET?: string;
  COOKIE_SECRET?: string;
  PUBLIC_BASE_URL?: string;
  X_REDIRECT_URI?: string;
  ADMIN_X_HANDLES?: string;
  CONTEST_ENDS_AT?: string;
  SOLANA_RPC_URL?: string;
  POT_WALLET_ADDRESS?: string;
  POT_SOL_USD_PRICE?: string;
  POT_PRICE_URL?: string;
}

type SessionUser = {
  id: string;
  xId: string;
  handle: string;
  name: string;
  avatarUrl?: string;
  walletAddress?: string;
  isAdmin: boolean;
  nominationsUsed: number;
};

type DbUser = {
  id: string;
  x_id: string;
  handle: string;
  name: string;
  avatar_url: string | null;
  wallet_address: string | null;
};

type SubmissionRow = {
  id: string;
  name: string;
  tweet_url: string;
  lore: string;
  powers: string;
  image_key: string;
  status: string;
  bonus_winner: number;
  created_at: string;
  creator_handle: string;
  creator_name: string;
  nominations: number;
  nominated_by_me: number;
};

type AdminSubmissionRow = SubmissionRow & {
  user_id: string;
  wallet_address: string | null;
  image_content_type: string;
};

const jsonHeaders = { "content-type": "application/json; charset=utf-8" };
const sessionCookie = "sprite_session";
const oauthCookie = "sprite_x_oauth";
const rankWeights = [20, 15, 12, 10, 8, 7, 6, 5, 4, 3];
const leaderboardPrizePoolShare = 0.7;

export default {
  async fetch(request, env, ctx): Promise<Response> {
    const url = new URL(request.url);

    try {
      if (url.pathname.startsWith("/api/")) {
        return await handleApi(request, env, ctx, url);
      }

      return env.ASSETS.fetch(request);
    } catch (error) {
      if (error instanceof HttpError) return json({ error: error.message }, error.status);
      console.error(JSON.stringify({ message: "request_failed", error: error instanceof Error ? error.message : error }));
      return json({ error: "Internal server error" }, 500);
    }
  },

  async scheduled(_event, env, ctx): Promise<void> {
    ctx.waitUntil(syncPotFromWallet(env));
  },
} satisfies ExportedHandler<Env>;

async function handleApi(request: Request, env: Env, ctx: ExecutionContext, url: URL): Promise<Response> {
  const { pathname } = url;

  if (request.method === "GET" && pathname === "/api/bootstrap") return bootstrap(request, env, ctx);
  if (request.method === "GET" && pathname === "/api/auth/x/start") return startXAuth(request, env);
  if (request.method === "GET" && pathname === "/api/auth/x/callback") return callbackXAuth(request, env, url);
  if (request.method === "POST" && pathname === "/api/auth/logout") return logout(request, env, ctx);
  if (request.method === "POST" && pathname === "/api/profile/wallet") return saveWallet(request, env);
  if (request.method === "POST" && pathname === "/api/submissions") return createSubmission(request, env);

  const nominationMatch = pathname.match(/^\/api\/submissions\/([^/]+)\/nominate$/);
  if (request.method === "POST" && nominationMatch) return nominate(request, env, nominationMatch[1]);

  const assetMatch = pathname.match(/^\/api\/assets\/(.+)$/);
  if (request.method === "GET" && assetMatch) return getAsset(env, assetMatch[1]);

  if (request.method === "POST" && pathname === "/api/admin/pot") return updatePot(request, env);
  if (request.method === "POST" && pathname === "/api/admin/sync-pot") return syncPot(request, env);
  if (request.method === "GET" && pathname === "/api/admin/submissions") return adminSubmissions(request, env);
  if (request.method === "GET" && pathname === "/api/admin/payouts.csv") return payoutsCsv(request, env);

  const statusMatch = pathname.match(/^\/api\/admin\/submissions\/([^/]+)\/status$/);
  if (request.method === "POST" && statusMatch) return updateSubmissionStatus(request, env, statusMatch[1]);

  return json({ error: "Not found" }, 404);
}

async function bootstrap(request: Request, env: Env, ctx: ExecutionContext) {
  const user = await currentUser(request, env);
  const pot = await getPot(env);
  if (shouldRefreshPot(env, pot.lastSyncedAt)) ctx.waitUntil(syncPotFromWallet(env));
  const submissions = await listSubmissions(env, user?.id);
  return json({
    user,
    pot,
    submissions,
    nominationsRemaining: user ? Math.max(0, 3 - user.nominationsUsed) : 3,
    contestEndsAt: env.CONTEST_ENDS_AT || "2026-07-01T21:59:59.000Z",
  });
}

async function startXAuth(request: Request, env: Env) {
  if (!env.X_CLIENT_ID || !env.COOKIE_SECRET) {
    return json({ error: "X OAuth is not configured yet. Add X_CLIENT_ID, X_CLIENT_SECRET, and COOKIE_SECRET." }, 501);
  }

  const redirectUri = env.X_REDIRECT_URI || new URL("/api/auth/x/callback", env.PUBLIC_BASE_URL || request.url).toString();
  const verifier = base64Url(crypto.getRandomValues(new Uint8Array(32)));
  const state = crypto.randomUUID();
  const challenge = await sha256Base64Url(verifier);
  const oauthState = await seal(env, JSON.stringify({ state, verifier, redirectUri, createdAt: Date.now() }));
  const authUrl = new URL("https://x.com/i/oauth2/authorize");
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("client_id", env.X_CLIENT_ID);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("scope", "users.read tweet.read offline.access");
  authUrl.searchParams.set("state", state);
  authUrl.searchParams.set("code_challenge", challenge);
  authUrl.searchParams.set("code_challenge_method", "S256");

  return new Response(null, {
    status: 302,
    headers: {
      location: authUrl.toString(),
      "set-cookie": cookie(oauthCookie, oauthState, 10 * 60, request),
    },
  });
}

async function callbackXAuth(request: Request, env: Env, url: URL) {
  if (!env.X_CLIENT_ID || !env.COOKIE_SECRET) return redirect("/", ["X OAuth missing"]);
  const sealedState = readCookie(request.headers.get("cookie"), oauthCookie);
  if (!sealedState) return redirect("/", ["OAuth state missing"]);

  const statePayload = await unseal(env, sealedState);
  if (!statePayload) return redirect("/", ["OAuth state invalid"]);

  const saved = JSON.parse(statePayload) as { state: string; verifier: string; redirectUri: string; createdAt: number };
  if (Date.now() - saved.createdAt > 10 * 60 * 1000 || saved.state !== url.searchParams.get("state")) {
    return redirect("/", ["OAuth state expired"]);
  }

  const code = url.searchParams.get("code");
  if (!code) return redirect("/", ["OAuth code missing"]);

  const tokenResponse = await fetch("https://api.x.com/2/oauth2/token", {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      ...(env.X_CLIENT_SECRET
        ? { authorization: `Basic ${btoa(`${env.X_CLIENT_ID}:${env.X_CLIENT_SECRET}`)}` }
        : {}),
    },
    body: new URLSearchParams({
      code,
      grant_type: "authorization_code",
      client_id: env.X_CLIENT_ID,
      redirect_uri: saved.redirectUri,
      code_verifier: saved.verifier,
    }),
  });
  if (!tokenResponse.ok) return redirect("/", ["X token exchange failed"]);
  const token = (await tokenResponse.json()) as { access_token: string };

  const meResponse = await fetch("https://api.x.com/2/users/me?user.fields=profile_image_url,username,name", {
    headers: { authorization: `Bearer ${token.access_token}` },
  });
  if (!meResponse.ok) return redirect("/", ["X profile read failed"]);
  const profile = (await meResponse.json()) as {
    data: { id: string; username: string; name: string; profile_image_url?: string };
  };

  const now = new Date().toISOString();
  const existing = await env.DB.prepare("SELECT * FROM users WHERE x_id = ? LIMIT 1").bind(profile.data.id).first<DbUser>();
  const userId = existing?.id || crypto.randomUUID();

  await env.DB.prepare(
    `INSERT INTO users (id, x_id, handle, name, avatar_url, wallet_address, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(x_id) DO UPDATE SET handle = excluded.handle, name = excluded.name, avatar_url = excluded.avatar_url, updated_at = excluded.updated_at`,
  )
    .bind(
      userId,
      profile.data.id,
      profile.data.username,
      profile.data.name,
      profile.data.profile_image_url || null,
      existing?.wallet_address || null,
      now,
      now,
    )
    .run();

  const sessionId = crypto.randomUUID();
  const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  await env.DB.prepare("INSERT INTO sessions (id, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)")
    .bind(sessionId, userId, expires, now)
    .run();
  const sealedSession = await seal(env, sessionId);

  const headers = new Headers({ location: "/" });
  headers.append("set-cookie", cookie(sessionCookie, sealedSession, 30 * 24 * 60 * 60, request));
  headers.append("set-cookie", expireCookie(oauthCookie, request));
  return new Response(null, {
    status: 302,
    headers,
  });
}

async function logout(request: Request, env: Env, ctx: ExecutionContext) {
  const sessionId = await readSessionId(request, env);
  if (sessionId) {
    ctx.waitUntil(env.DB.prepare("DELETE FROM sessions WHERE id = ?").bind(sessionId).run());
  }
  return new Response(null, { status: 204, headers: { "set-cookie": expireCookie(sessionCookie, request) } });
}

async function saveWallet(request: Request, env: Env) {
  const user = await requireUser(request, env);
  const payload = (await request.json()) as { walletAddress?: string };
  if (!payload.walletAddress || !/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(payload.walletAddress)) {
    return json({ error: "Invalid Solana wallet address" }, 400);
  }
  await env.DB.prepare("UPDATE users SET wallet_address = ?, updated_at = ? WHERE id = ?")
    .bind(payload.walletAddress, new Date().toISOString(), user.id)
    .run();
  return json({ ok: true });
}

async function createSubmission(request: Request, env: Env) {
  const user = await requireUser(request, env);
  if (Date.now() > new Date(env.CONTEST_ENDS_AT || "2026-07-01T21:59:59.000Z").getTime()) {
    return json({ error: "The submission window has closed" }, 403);
  }

  const form = await request.formData();
  const file = form.get("sprite");
  if (!(file instanceof File)) return json({ error: "Sprite PNG or GIF is required" }, 400);
  if (!["image/png", "image/gif"].includes(file.type)) return json({ error: "Only PNG and GIF uploads are allowed" }, 400);
  if (file.size > 8 * 1024 * 1024) return json({ error: "Max upload size is 8MB" }, 400);
  if (!(await hasValidSpriteSignature(file))) return json({ error: "Uploaded file content does not match PNG or GIF" }, 400);

  const name = cleanText(form.get("name"), 42);
  const tweetUrl = cleanText(form.get("tweetUrl"), 240);
  const lore = cleanText(form.get("lore"), 500);
  const powers = cleanText(form.get("powers"), 140);
  if (!name || !lore || !powers || !isXUrl(tweetUrl)) return json({ error: "Missing sprite details or invalid X tweet URL" }, 400);

  const id = crypto.randomUUID();
  const extension = file.type === "image/gif" ? "gif" : "png";
  const imageKey = `submissions/${id}.${extension}`;
  await env.SPRITES.put(imageKey, file.stream(), {
    httpMetadata: { contentType: file.type },
    customMetadata: { owner: user.id },
  });

  const now = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO submissions (id, user_id, name, tweet_url, lore, powers, image_key, image_content_type, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`,
  )
    .bind(id, user.id, name, tweetUrl, lore, powers, imageKey, file.type, now, now)
    .run();

  return json({ ok: true, id }, 201);
}

async function nominate(request: Request, env: Env, submissionId: string) {
  const user = await requireUser(request, env);
  const alreadyNominated = await env.DB.prepare("SELECT 1 FROM nominations WHERE user_id = ? AND submission_id = ? LIMIT 1")
    .bind(user.id, submissionId)
    .first();
  if (alreadyNominated) return json({ error: "Already nominated" }, 409);

  const existingCount = await env.DB.prepare("SELECT COUNT(*) AS count FROM nominations WHERE user_id = ?")
    .bind(user.id)
    .first<{ count: number }>();
  if ((existingCount?.count || 0) >= 3) return json({ error: "Nomination limit reached" }, 409);

  const submission = await env.DB.prepare("SELECT user_id, status FROM submissions WHERE id = ? LIMIT 1")
    .bind(submissionId)
    .first<{ user_id: string; status: string }>();
  if (!submission || submission.status !== "approved") return json({ error: "Submission is not open for nominations" }, 404);
  if (submission.user_id === user.id) return json({ error: "You cannot nominate your own sprite" }, 409);

  try {
    await env.DB.prepare("INSERT INTO nominations (user_id, submission_id, created_at) VALUES (?, ?, ?)")
      .bind(user.id, submissionId, new Date().toISOString())
      .run();
  } catch {
    return json({ error: "Already nominated" }, 409);
  }

  return json({ ok: true });
}

async function updatePot(request: Request, env: Env) {
  await requireAdmin(request, env);
  const payload = (await request.json()) as { totalUsd?: number; totalSol?: number };
  const totalUsd = typeof payload.totalUsd === "number" ? payload.totalUsd : payload.totalSol;
  if (typeof totalUsd !== "number" || !Number.isFinite(totalUsd) || totalUsd < 0) {
    return json({ error: "Invalid pot" }, 400);
  }
  await setSetting(env, "pot_total_usd", String(totalUsd));
  await setSetting(env, "pot_source", "manual");
  return json({ ok: true });
}

async function syncPot(request: Request, env: Env) {
  await requireAdmin(request, env);
  const result = await syncPotFromWallet(env);
  return json(result);
}

async function syncPotFromWallet(env: Env) {
  if (!env.POT_WALLET_ADDRESS) {
    return { ok: false, message: "Pot wallet is not configured yet. Add POT_WALLET_ADDRESS when ready." };
  }

  const rpc = env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";
  const response = await fetch(rpc, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: "sprite-pot",
      method: "getBalance",
      params: [env.POT_WALLET_ADDRESS],
    }),
  });
  if (!response.ok) throw new HttpError("Solana RPC request failed", 502);
  const payload = (await response.json()) as { result?: { value?: number } };
  const totalSol = (payload.result?.value || 0) / 1_000_000_000;
  const solUsd = await getSolUsdPrice(env);
  const totalUsd = Number((totalSol * solUsd).toFixed(2));

  await setSetting(env, "pot_total_sol", String(totalSol));
  await setSetting(env, "pot_total_usd", String(totalUsd));
  await setSetting(env, "pot_sol_usd", String(solUsd));
  await setSetting(env, "pot_source", "solana");
  await setSetting(env, "pot_last_synced_at", new Date().toISOString());
  return { ok: true, totalUsd, totalSol, solUsd };
}

async function updateSubmissionStatus(request: Request, env: Env, submissionId: string) {
  await requireAdmin(request, env);
  const payload = (await request.json()) as { status?: string; bonusWinner?: boolean };
  if (!["pending", "approved", "rejected"].includes(payload.status || "")) return json({ error: "Invalid status" }, 400);
  await env.DB.prepare("UPDATE submissions SET status = ?, bonus_winner = ?, updated_at = ? WHERE id = ?")
    .bind(payload.status, payload.bonusWinner ? 1 : 0, new Date().toISOString(), submissionId)
    .run();
  return json({ ok: true });
}

async function adminSubmissions(request: Request, env: Env) {
  await requireAdmin(request, env);
  const url = new URL(request.url);
  const status = url.searchParams.get("status") || "pending";
  if (!["pending", "approved", "rejected", "all"].includes(status)) return json({ error: "Invalid status filter" }, 400);

  const whereClause = status === "all" ? "" : "WHERE s.status = ?";
  const statement = env.DB.prepare(
    `SELECT
      s.id, s.user_id, s.name, s.tweet_url, s.lore, s.powers, s.image_key, s.image_content_type,
      s.status, s.bonus_winner, s.created_at,
      u.handle AS creator_handle, u.name AS creator_name, u.wallet_address,
      COUNT(n.submission_id) AS nominations,
      0 AS nominated_by_me
     FROM submissions s
     JOIN users u ON u.id = s.user_id
     LEFT JOIN nominations n ON n.submission_id = s.id
     ${whereClause}
     GROUP BY s.id
     ORDER BY s.created_at DESC
     LIMIT 200`,
  );
  const rows =
    status === "all"
      ? await statement.all<AdminSubmissionRow>()
      : await statement.bind(status).all<AdminSubmissionRow>();

  return json({
    submissions: (rows.results || []).map((row) => ({
      id: row.id,
      name: row.name,
      creatorHandle: row.creator_handle,
      creatorName: row.creator_name,
      creatorWallet: row.wallet_address || undefined,
      imageUrl: `/api/assets/${encodeURIComponent(row.image_key)}`,
      tweetUrl: row.tweet_url,
      lore: row.lore,
      powers: row.powers,
      status: row.bonus_winner ? "bonus" : row.status,
      bonusWinner: Boolean(row.bonus_winner),
      nominations: Number(row.nominations || 0),
      createdAt: row.created_at,
    })),
  });
}

async function payoutsCsv(request: Request, env: Env) {
  await requireAdmin(request, env);
  const pot = await getPot(env);
  const rows = await listPayoutRows(env);
  const header = "rank,name,handle,wallet,nominations,payout_usd,tweet_url\n";
  const body = rows
    .map((row, index) => {
      const rank = index + 1;
      return [
        rank,
        csvCell(row.name),
        csvCell(row.creator_handle),
        csvCell(row.wallet_address || ""),
        row.nominations,
        payoutForRank(rank, pot.totalUsd).toFixed(2),
        csvCell(row.tweet_url),
      ].join(",");
    })
    .join("\n");
  return new Response(header + body, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": "attachment; filename=sprite-payouts.csv",
    },
  });
}

async function getAsset(env: Env, key: string) {
  const object = await env.SPRITES.get(decodeURIComponent(key));
  if (!object) return new Response("Not found", { status: 404 });
  return new Response(object.body, {
    headers: {
      "content-type": object.httpMetadata?.contentType || "application/octet-stream",
      "cache-control": "public, max-age=31536000, immutable",
      etag: object.httpEtag,
    },
  });
}

async function listSubmissions(env: Env, userId?: string) {
  const rows = await env.DB.prepare(
    `SELECT
      s.id, s.name, s.tweet_url, s.lore, s.powers, s.image_key, s.status, s.bonus_winner, s.created_at,
      u.handle AS creator_handle, u.name AS creator_name,
      COUNT(n.submission_id) AS nominations,
      MAX(CASE WHEN n.user_id = ? THEN 1 ELSE 0 END) AS nominated_by_me
     FROM submissions s
     JOIN users u ON u.id = s.user_id
     LEFT JOIN nominations n ON n.submission_id = s.id
     WHERE s.status = 'approved' OR s.bonus_winner = 1
     GROUP BY s.id
     ORDER BY nominations DESC, s.created_at ASC
     LIMIT 500`,
  )
    .bind(userId || "")
    .all<SubmissionRow>();
  const pot = await getPot(env);
  return (rows.results || []).map((row, index) => ({
    id: row.id,
    name: row.name,
    creatorHandle: row.creator_handle,
    creatorName: row.creator_name,
    imageUrl: `/api/assets/${encodeURIComponent(row.image_key)}`,
    tweetUrl: row.tweet_url,
    lore: row.lore,
    powers: row.powers,
    status: row.bonus_winner ? "bonus" : row.status,
    nominations: Number(row.nominations || 0),
    rank: index + 1,
    payoutUsd: payoutForRank(index + 1, pot.totalUsd),
    createdAt: row.created_at,
    nominatedByMe: Boolean(row.nominated_by_me),
  }));
}

async function listPayoutRows(env: Env) {
  const rows = await env.DB.prepare(
    `SELECT s.name, s.tweet_url, u.handle AS creator_handle, u.wallet_address, COUNT(n.submission_id) AS nominations
     FROM submissions s
     JOIN users u ON u.id = s.user_id
     LEFT JOIN nominations n ON n.submission_id = s.id
     WHERE s.status = 'approved'
     GROUP BY s.id
     ORDER BY nominations DESC, s.created_at ASC
     LIMIT 40`,
  ).all<{ name: string; tweet_url: string; creator_handle: string; wallet_address: string | null; nominations: number }>();
  return rows.results || [];
}

async function getPot(env: Env) {
  const [totalUsd, totalSol, solUsd, source, lastSynced] = await Promise.all([
    getSetting(env, "pot_total_usd"),
    getSetting(env, "pot_total_sol"),
    getSetting(env, "pot_sol_usd"),
    getSetting(env, "pot_source"),
    getSetting(env, "pot_last_synced_at"),
  ]);
  return {
    totalUsd: Number(totalUsd || "42"),
    totalSol: totalSol ? Number(totalSol) : undefined,
    solUsd: solUsd ? Number(solUsd) : undefined,
    walletAddress: env.POT_WALLET_ADDRESS || undefined,
    lastSyncedAt: lastSynced || undefined,
    source: source === "solana" ? "solana" : "manual",
  };
}

async function currentUser(request: Request, env: Env): Promise<SessionUser | null> {
  const sessionId = await readSessionId(request, env);
  if (!sessionId) return null;
  const row = await env.DB.prepare(
    `SELECT u.*,
      (SELECT COUNT(*) FROM nominations WHERE user_id = u.id) AS nominations_used
     FROM sessions s
     JOIN users u ON u.id = s.user_id
     WHERE s.id = ? AND s.expires_at > ?
     LIMIT 1`,
  )
    .bind(sessionId, new Date().toISOString())
    .first<DbUser & { nominations_used: number }>();
  if (!row) return null;
  return {
    id: row.id,
    xId: row.x_id,
    handle: row.handle,
    name: row.name,
    avatarUrl: row.avatar_url || undefined,
    walletAddress: row.wallet_address || undefined,
    isAdmin: adminHandles(env).includes(row.handle.toLowerCase()),
    nominationsUsed: Number(row.nominations_used || 0),
  };
}

async function requireUser(request: Request, env: Env) {
  const user = await currentUser(request, env);
  if (!user) throw new HttpError("Authentication required", 401);
  return user;
}

async function requireAdmin(request: Request, env: Env) {
  const user = await requireUser(request, env);
  if (!user.isAdmin) throw new HttpError("Admin required", 403);
  return user;
}

async function readSessionId(request: Request, env: Env) {
  const sealed = readCookie(request.headers.get("cookie"), sessionCookie);
  return sealed ? unseal(env, sealed) : null;
}

async function getSetting(env: Env, key: string) {
  const row = await env.DB.prepare("SELECT value FROM settings WHERE key = ? LIMIT 1").bind(key).first<{ value: string }>();
  return row?.value;
}

async function setSetting(env: Env, key: string, value: string) {
  await env.DB.prepare("INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at")
    .bind(key, value, new Date().toISOString())
    .run();
}

function payoutForRank(rank: number, pot: number) {
  const leaderboardPool = pot * leaderboardPrizePoolShare;
  if (rank <= 10) return leaderboardPool * (rankWeights[rank - 1] / 100);
  if (rank <= 40) return (leaderboardPool * 0.1) / 30;
  return 0;
}

function shouldRefreshPot(env: Env, lastSyncedAt?: string) {
  if (!env.POT_WALLET_ADDRESS) return false;
  if (!lastSyncedAt) return true;
  return Date.now() - new Date(lastSyncedAt).getTime() > 5 * 60 * 1000;
}

async function getSolUsdPrice(env: Env) {
  const override = Number(env.POT_SOL_USD_PRICE || "");
  if (Number.isFinite(override) && override > 0) return override;

  const response = await fetch(env.POT_PRICE_URL || "https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd", {
    headers: { accept: "application/json" },
  });
  if (!response.ok) throw new HttpError("SOL/USD price request failed", 502);
  const payload = (await response.json()) as { solana?: { usd?: number } };
  const price = payload.solana?.usd;
  if (!price || !Number.isFinite(price) || price <= 0) throw new HttpError("SOL/USD price missing", 502);
  return price;
}

async function seal(env: Env, value: string) {
  const secret = env.COOKIE_SECRET || "dev-only-change-me";
  const signature = await hmac(secret, value);
  return `${base64Url(new TextEncoder().encode(value))}.${signature}`;
}

async function unseal(env: Env, sealed: string) {
  const [payload, signature] = sealed.split(".");
  if (!payload || !signature) return null;
  const value = new TextDecoder().decode(base64UrlDecode(payload));
  const expected = await hmac(env.COOKIE_SECRET || "dev-only-change-me", value);
  return constantTimeEqual(signature, expected) ? value : null;
}

async function hmac(secret: string, value: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
  ]);
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return base64Url(new Uint8Array(signature));
}

async function sha256Base64Url(value: string) {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return base64Url(new Uint8Array(hash));
}

function base64Url(bytes: Uint8Array) {
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function base64UrlDecode(value: string) {
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(normalized);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function constantTimeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let index = 0; index < a.length; index += 1) result |= a.charCodeAt(index) ^ b.charCodeAt(index);
  return result === 0;
}

function readCookie(cookieHeader: string | null, name: string) {
  const match = cookieHeader?.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : null;
}

function cookie(name: string, value: string, maxAge: number, request: Request) {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `${name}=${encodeURIComponent(value)}; Max-Age=${maxAge}; Path=/; HttpOnly${secure}; SameSite=Lax`;
}

function expireCookie(name: string, request: Request) {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `${name}=; Max-Age=0; Path=/; HttpOnly${secure}; SameSite=Lax`;
}

function adminHandles(env: Env) {
  return (env.ADMIN_X_HANDLES || "monarchofct").split(",").map((handle) => handle.trim().replace(/^@/, "").toLowerCase());
}

function cleanText(value: FormDataEntryValue | null, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function isXUrl(value: string) {
  try {
    const url = new URL(value);
    return ["x.com", "twitter.com", "www.x.com", "www.twitter.com"].includes(url.hostname.toLowerCase()) && url.pathname.includes("/status/");
  } catch {
    return false;
  }
}

async function hasValidSpriteSignature(file: File) {
  const signature = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  if (file.type === "image/png") {
    return (
      signature[0] === 0x89 &&
      signature[1] === 0x50 &&
      signature[2] === 0x4e &&
      signature[3] === 0x47 &&
      signature[4] === 0x0d &&
      signature[5] === 0x0a &&
      signature[6] === 0x1a &&
      signature[7] === 0x0a
    );
  }

  if (file.type === "image/gif") {
    const header = new TextDecoder().decode(signature.slice(0, 6));
    return header === "GIF87a" || header === "GIF89a";
  }

  return false;
}

function csvCell(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders });
}

function redirect(path: string, messages: string[]) {
  const url = new URL(path, "https://sprite.local");
  if (messages.length) url.searchParams.set("notice", messages.join(", "));
  return new Response(null, { status: 302, headers: { location: `${url.pathname}${url.search}` } });
}

class HttpError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}
