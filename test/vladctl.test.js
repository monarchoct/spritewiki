const test = require("node:test");
const assert = require("node:assert/strict");
const { parseEnv, applyEnvUpdates } = require("../vladctl");

test("vladctl updates mode values without exposing or replacing unrelated secrets", () => {
  const source = "OPENAI_API_KEY=secret\nBACKEND_PAUSED=true\nX_AUTOMATION_ENABLED=false\n";
  const next = applyEnvUpdates(source, { BACKEND_PAUSED: "false", X_AUTOMATION_ENABLED: "true", VLADINATOR_WALLET_ADDRESS: "0xabc" });
  const parsed = parseEnv(next);
  assert.equal(parsed.OPENAI_API_KEY, "secret");
  assert.equal(parsed.BACKEND_PAUSED, "false");
  assert.equal(parsed.X_AUTOMATION_ENABLED, "true");
  assert.equal(parsed.VLADINATOR_WALLET_ADDRESS, "0xabc");
});
