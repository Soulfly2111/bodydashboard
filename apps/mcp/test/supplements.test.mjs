import assert from "node:assert/strict";
import test from "node:test";
import { registerSupplementTools } from "../supplements.js";

test("supplement tools resolve individual products, preserve booking identifiers and route corrections", async () => {
  const tools = new Map();
  const calls = [];
  const products = [{ id: "creatin-id", name: "Creatin" }, { id: "collagen-id", name: "Kollagen" }];
  registerSupplementTools({ tool: (name, _description, _shape, handler) => tools.set(name, handler) }, async (path, options) => {
    calls.push({ path, options });
    return path.includes("?archived=") ? products : { id: "entry-id", ok: true };
  }, () => {});
  await tools.get("supplement_get")({ supplement: "creatin", from: "2026-11-01", to: "2026-11-19" });
  assert.equal(calls.at(-1).path, "/api/integrations/openclaw/supplements/creatin-id?from=2026-11-01&to=2026-11-19");
  await tools.get("supplement_log")({ supplement: "collagen-id", date: "2026-11-19", amount: 10, externalId: "retry-id" });
  assert.equal(calls.at(-1).options.method, "POST");
  assert.deepEqual(calls.at(-1).options.body, { date: "2026-11-19", amount: 10, externalId: "retry-id" });
  await tools.get("supplement_update_entry")({ supplement: "Creatin", entryId: "entry-id", amount: 5 });
  assert.equal(calls.at(-1).options.method, "PATCH");
  await tools.get("supplement_delete_entry")({ supplement: "Creatin", entryId: "entry-id" });
  assert.equal(calls.at(-1).options.method, "DELETE");
  const list = await tools.get("supplement_list")({ query: "koll", includeArchived: false });
  assert.equal(JSON.parse(list.content[0].text)[0].id, "collagen-id");
  await assert.rejects(tools.get("supplement_get")({ supplement: "Unknown" }), /nicht gefunden/);
  products.push({ id: "other-id", name: "Creatin" });
  await assert.rejects(tools.get("supplement_log")({ supplement: "Creatin", amount: 10 }), /mehrdeutig/);
});
