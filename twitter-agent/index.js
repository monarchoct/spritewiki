const fs = require("fs");
const path = require("path");

function clean(value, max = 280) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, max);
}

function responseText(data) {
  if (typeof data?.output_text === "string") return data.output_text.trim();
  const parts = [];
  for (const item of data?.output || []) for (const content of item.content || []) {
    if (typeof content.text === "string") parts.push(content.text);
    if (typeof content.output_text === "string") parts.push(content.output_text);
  }
  return parts.join("\n").trim();
}

function taskFor(input = {}) {
  if (input.type === "trade") return input.event?.type === "sell" ? "confirmed_sell" : "confirmed_buy";
  if (input.type === "quote_mention") return "quote_tweet";
  if (input.type === "reply_mention") return "direct_reply";
  return "routine_post";
}

function fallback(input = {}) {
  if (input.type === "trade" && input.event?.type === "buy") return `${input.event.asset?.symbol || "TOKEN"} bought${Number.isFinite(Number(input.event.usdValue)) ? ` $${Number(input.event.usdValue).toFixed(2)}` : ""}.`;
  if (input.type === "trade" && input.event?.type === "sell") return `${input.event.asset?.symbol || "TOKEN"} sold${Number.isFinite(Number(input.event.usdValue)) ? ` $${Number(input.event.usdValue).toFixed(2)}` : ""}.`;
  if (input.type === "reply_mention") return "counterpoint: no";
  return "the chart looked at me first.";
}

function createTwitterAgent({ promptPath, memoryPath, getApiKey, getModel }) {
  const memory = { recentPosts: [], recentReplies: [], topics: [], tags: [] };
  try {
    const stored = JSON.parse(fs.readFileSync(memoryPath, "utf8"));
    for (const key of Object.keys(memory)) if (Array.isArray(stored[key])) memory[key].push(...stored[key].slice(-40));
  } catch {}

  function saveMemory() {
    try {
      fs.mkdirSync(path.dirname(memoryPath), { recursive: true });
      fs.writeFileSync(memoryPath, JSON.stringify(Object.fromEntries(Object.entries(memory).map(([key, value]) => [key, value.slice(-40)]))));
    } catch {}
  }

  function prompt() {
    try { return fs.readFileSync(promptPath, "utf8").trim(); }
    catch { return "Write one short, fictional Crypto Twitter post. Never claim affiliation or impersonate a real person."; }
  }

  function memoryContext() {
    return {
      recentPosts: memory.recentPosts.slice(-8),
      recentReplies: memory.recentReplies.slice(-8),
      recentTopics: memory.topics.slice(-8),
      recentTags: memory.tags.slice(-8)
    };
  }

  function qualityIssue(text, input) {
    const value = clean(text);
    if (!value) return "The response is empty.";
    if (memory.recentPosts.slice(-6).some((item) => item.text.toLowerCase() === value.toLowerCase())) return "This repeats a recent post.";
    if (input.type === "trade" && input.event?.asset?.symbol && !value.toLowerCase().includes(String(input.event.asset.symbol).toLowerCase())) return "The confirmed trade token must be named.";
    if (/\bas an ai\b|\bi am vlad tenev\b|\bofficial robinhood\b/i.test(value)) return "The response broke the fictional and unaffiliated identity boundary.";
    return "";
  }

  function remember(task, input, text) {
    const item = { text, task, topic: input.brainTopic || task, at: new Date().toISOString() };
    const bucket = task === "direct_reply" || task === "quote_tweet" ? memory.recentReplies : memory.recentPosts;
    bucket.push(item);
    memory.topics.push(item.topic);
    memory.tags.push(...(text.match(/(?:@[a-z0-9_]+|\$vlad)\b/gi) || []).map((tag) => tag.toLowerCase()));
    for (const value of Object.values(memory)) while (value.length > 40) value.shift();
    saveMemory();
  }

  async function request(body, apiKey) {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(body)
    });
    if (!response.ok) throw new Error(`${response.status} ${(await response.text()).slice(0, 180)}`);
    return response.json();
  }

  async function generate({ input = {}, backend = {} }) {
    const apiKey = getApiKey();
    const task = taskFor(input);
    const draftFallback = fallback(input);
    if (!apiKey) return draftFallback;
    const buildBody = (retry = "") => ({
      model: getModel(),
      input: [
        { role: "developer", content: prompt() },
        { role: "developer", content: "You are the standalone Twitter agent. The website-terminal narrator is a separate system; do not mention, imitate, or alter it. You receive its backend snapshot as read-only context. Use it only for factual claims. Never invent trades, balances, PnL, prices, external statistics, endorsements, or interactions. Never claim to be the real Vlad Tenev or an official Robinhood account." },
        { role: "developer", content: `BACKEND SNAPSHOT: ${JSON.stringify(backend)}` },
        { role: "developer", content: `TWITTER MEMORY: ${JSON.stringify(memoryContext())}` },
        { role: "developer", content: `TASK: ${task}. Produce one post only, under 240 characters. ${task === "confirmed_buy" || task === "confirmed_sell" ? "Use the confirmed receipt supplied in INPUT." : "For a direct reply or quote, react to the supplied source post."}` },
        ...(retry ? [{ role: "developer", content: `Rewrite the draft. ${retry} Return only the replacement post.` }] : []),
        { role: "user", content: JSON.stringify({ input }) }
      ],
      max_output_tokens: 180
    });
    try {
      let data = await request(buildBody(), apiKey);
      let text = clean(responseText(data));
      const issue = qualityIssue(text, input);
      if (issue) {
        data = await request(buildBody(issue), apiKey);
        text = clean(responseText(data));
      }
      const output = text || draftFallback;
      remember(task, input, output);
      return output;
    } catch (error) {
      console.error("twitter_agent_text_error", error.message);
      return draftFallback;
    }
  }

  return { generate };
}

module.exports = { createTwitterAgent };
