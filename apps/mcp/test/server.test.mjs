import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:http";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import test from "node:test";

const expectedTools = ["bd_status", "food_search", "food_upsert", "meal_log",
  "meal_add_item", "meal_get_day", "meal_update_item", "meal_delete_item",
  "off_search", "off_import", "water_log", "weight_log", "activity_log",
  "stats_day", "stats_week", "supplement_list", "supplement_get", "supplement_log", "supplement_update_entry", "supplement_delete_entry"].sort();

for (const keyOnly of [false, true]) test(`HTTP MCP ${keyOnly ? "API-key-only" : "JWT"} initializes, lists tools and routes authenticated calls to a mock API`, { timeout: 20000 }, async (t) => {
  const requests = [];
  const mock = createServer(async (req, res) => {
    let raw = "";
    for await (const chunk of req) raw += chunk;
    requests.push({ path: req.url, headers: req.headers, body: raw ? JSON.parse(raw) : null });
    res.setHeader("content-type", "application/json");
    const responses = {
      "/api/integrations/openclaw/health": { provider: "openclaw", scopes: ["water:write"] },
      "/api/auth/login": { accessToken: "test-access-token", refreshToken: "test-refresh-token" },
      "/api/auth/me": { name: "Test", email: "test@example.invalid", role: "USER" },
      "/api/integrations/openclaw/water": { ok: true },
    };
    res.statusCode = responses[req.url] ? 200 : 404;
    res.end(JSON.stringify(responses[req.url] ?? { error: "Unexpected mock request" }));
  });
  mock.listen(0, "127.0.0.1");
  await once(mock, "listening");
  t.after(() => { mock.closeAllConnections(); mock.close(); });

  // Reserve an ephemeral port, then release it for the child server.
  const reservation = createServer();
  reservation.listen(0, "127.0.0.1");
  await once(reservation, "listening");
  const port = reservation.address().port;
  await new Promise(resolve => reservation.close(resolve));
  const entry = process.env.MCP_TEST_ENTRY || fileURLToPath(new URL("../server.js", import.meta.url));
  const child = spawn(process.execPath, [entry], {
    env: { ...process.env, BODYDASH_TRANSPORT: "http", PORT: String(port),
      MCP_PATH_SECRET: "local-test-secret", BODYDASH_URL: `http://127.0.0.1:${mock.address().port}`,
      BODYDASH_API_KEY: "test-api-key", BODYDASH_EMAIL: keyOnly ? "" : "test@example.invalid", BODYDASH_PASSWORD: keyOnly ? "" : "test-password" },
    stdio: ["ignore", "ignore", "pipe"],
  });
  let stderr = "";
  child.stderr.on("data", chunk => { stderr += chunk; });
  t.after(async () => {
    if (child.exitCode === null) {
      const exited = once(child, "exit");
      child.kill();
      await exited;
    }
  });
  for (let i = 0; !stderr.includes("lauscht auf"); i++) {
    assert.equal(child.exitCode, null, stderr);
    assert.ok(i < 200, "MCP did not start: " + stderr);
    await delay(25);
  }
  const base = `http://127.0.0.1:${port}`;
  let id = 0;
  async function rpc(method, params = {}) {
    const response = await fetch(`${base}/mcp/local-test-secret`, {
      method: "POST", headers: { "content-type": "application/json", accept: "application/json, text/event-stream" },
      body: JSON.stringify({ jsonrpc: "2.0", id: ++id, method, params }),
    });
    assert.equal(response.status, 200);
    const message = await response.json();
    assert.equal(message.error, undefined, JSON.stringify(message));
    return message.result;
  }
  const initialized = await rpc("initialize", { protocolVersion: "2025-03-26", capabilities: {}, clientInfo: { name: "test", version: "1" } });
  assert.equal(initialized.serverInfo.name, "bodydashboard");
  assert.equal(initialized.serverInfo.version, "1.1.0");
  assert.deepEqual((await rpc("tools/list")).tools.map(tool => tool.name).sort(), expectedTools);
  const status = await rpc("tools/call", { name: "bd_status", arguments: {} });
  assert.match(status.content[0].text, /API-Key: ok/);
  assert.match(status.content[0].text, keyOnly ? /API-Key-Konto: ok/ : /JWT-Login: ok/);
  const meHeaders = requests.find(r => r.path === "/api/auth/me").headers;
  assert.equal(keyOnly ? meHeaders["x-api-key"] : meHeaders.authorization, keyOnly ? "test-api-key" : "Bearer test-access-token");
  if (keyOnly) assert.ok(!requests.some(r => r.path === "/api/auth/login"));
  const water = await rpc("tools/call", { name: "water_log", arguments: { amountMl: 250, date: "2026-11-19" } });
  assert.notEqual(water.isError, true);
  const write = requests.find(r => r.path === "/api/integrations/openclaw/water");
  assert.equal(write.headers["x-api-key"], "test-api-key");
  assert.deepEqual(write.body, { amountMl: 250, date: "2026-11-19" });
  const count = requests.length;
  const invalid = await rpc("tools/call", { name: "water_log", arguments: { amountMl: -1 } });
  assert.equal(invalid.isError, true);
  assert.equal(requests.length, count);
  assert.equal((await fetch(`${base}/mcp/wrong-secret`, { method: "POST" })).status, 404);
});
