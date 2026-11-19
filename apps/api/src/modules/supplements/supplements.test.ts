import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import request from "supertest";
import type { Express } from "express";

let app: Express;
let db: typeof import("../../config/prisma.js").prisma;
let token: string;
let otherToken: string;
let userId: string;
let supplementId: string;
let readKey: string;
let writeKey: string;
const req = createRequire(import.meta.url);
beforeAll(async () => {
  process.env.LOG_LEVEL = "silent";
  process.env.DATABASE_URL = `file:${join(mkdtempSync(join(tmpdir(), "bodydashboard-supplements-")), "test.db").replaceAll("\\", "/")}`;
  writeFileSync(process.env.DATABASE_URL.slice(5), "");
  execFileSync(process.execPath, [req.resolve("prisma/build/index.js"), "migrate", "deploy", "--schema", resolve("prisma/schema.prisma")], { env: process.env, stdio: "pipe" });
  db = (await import("../../config/prisma.js")).prisma;
  app = (await import("../../app.js")).createApp();
  const { signAccessToken } = await import("../../middleware/auth.js");
  const user = await db.user.create({ data: { name: "Test", email: "supplements@example.invalid", passwordHash: "unused" } });
  const other = await db.user.create({ data: { name: "Other", email: "other@example.invalid", passwordHash: "unused" } });
  userId = user.id;
  token = signAccessToken(user); otherToken = signAccessToken(other);
  const { IntegrationApiKeyService } = await import("../../services/integrations/IntegrationApiKeyService.js");
  const keys = new IntegrationApiKeyService();
  readKey = (await keys.create({ userId, name: "Read", scopes: ["supplements:read"] })).apiKey;
  writeKey = (await keys.create({ userId, name: "Write", scopes: ["supplements:read", "supplements:write"] })).apiKey;
}, 30000);
afterAll(async () => { await db?.$disconnect(); });
const auth = () => ({ Authorization: `Bearer ${token}` });

describe("supplements and overview", () => {
  it("initializes defaults exactly once with unknown nutrition and protects ownership", async () => {
    const first = await request(app).get("/api/supplements").set(auth()).expect(200);
    expect(first.body.map((s: { name: string }) => s.name)).toEqual(["Creatin", "Kollagen", "LaVita"]);
    expect(first.body.every((s: { calories: null }) => s.calories === null)).toBe(true);
    supplementId = first.body[1].id;
    const second = await request(app).get("/api/supplements").set(auth()).expect(200);
    expect(second.body).toEqual(first.body);
    await request(app).get(`/api/supplements/${supplementId}`).set({ Authorization: `Bearer ${otherToken}` }).expect(404);
    await request(app).get("/api/supplements").expect(401);
  });
  it("enforces scopes, dates, units and idempotency", async () => {
    await request(app).get("/api/integrations/openclaw/supplements").set("x-api-key", readKey).expect(200);
    await request(app).post(`/api/integrations/openclaw/supplements/${supplementId}/entries`).set("x-api-key", readKey).send({ amount: 10 }).expect(403);
    await request(app).post(`/api/supplements/${supplementId}/entries`).set(auth()).send({ date: "2026-02-30", amount: 10 }).expect(400);
    await request(app).post(`/api/supplements/${supplementId}/entries`).set(auth()).send({ date: "2026-11-19", amount: 10, unit: "ml" }).expect(400);
    const path = `/api/integrations/openclaw/supplements/${supplementId}/entries`;
    const payload = { date: "2026-11-19", amount: 10, externalId: "one-booking" };
    const first = await request(app).post(path).set("x-api-key", writeKey).send(payload).expect(201);
    const second = await request(app).post(path).set("x-api-key", writeKey).send(payload).expect(201);
    expect(first.body.id).toBe(second.body.id);
    await request(app).post(path).set("x-api-key", writeKey).send({ ...payload, amount: 20 }).expect(409);
    await request(app).delete(`/api/supplements/${supplementId}/entries/${first.body.id}`).set(auth()).expect(204);
  });
  it("keeps historical snapshots, counts intake days once and averages measured days", async () => {
    await request(app).patch(`/api/supplements/${supplementId}`).set(auth()).send({ calories: 400, protein: 90, fat: 0, carbs: 0 }).expect(200);
    for (const amount of [10, 20]) await request(app).post(`/api/supplements/${supplementId}/entries`).set(auth()).send({ date: "2026-11-19", amount }).expect(201);
    await request(app).patch(`/api/supplements/${supplementId}`).set(auth()).send({ calories: 200 }).expect(200);
    await db.weightEntry.createMany({ data: [
      { userId, date: new Date("2026-11-19T08:00:00Z"), weightKg: 90, bodyFatPercent: 20 },
      { userId, date: new Date("2026-11-19T10:00:00Z"), weightKg: 94, bodyFatPercent: 22 },
      { userId, date: new Date("2026-11-18T08:00:00Z"), weightKg: 96 }
    ] });
    await db.activity.create({ data: { userId, typeName: "Walking", date: new Date("2026-11-18T23:30:00Z"), durationMinutes: 20, calories: 50, intensity: "LIGHT" } });
    const response = await request(app).get("/api/stats/overview?end=2026-11-19").set(auth()).expect(200);
    expect(response.body.days[0]).toMatchObject({ date: "2026-11-19", calories: 120, protein: 27, activityCount: 1 });
    expect(response.body.weeks[0]).toMatchObject({ start: "2026-11-13", end: "2026-11-19", calories: 17.1, weightKg: 94, bodyFatPercent: 21 });
    expect(response.body.weeks[0].supplements.find((s: { id: string }) => s.id === supplementId).days).toBe(1);
    expect(response.body.weeks[1].hasNutrition).toBe(false);
    expect(response.body.weeks[1].weightKg).toBe(null);
    const old = await request(app).get("/api/stats/day/2026-11-19").set(auth()).expect(200);
    expect(old.body.totals.calories).toBe(120);
  });
  it("edits/deletes entries without replacing nutrition and preserves archived history", async () => {
    const item = await request(app).get(`/api/supplements/${supplementId}`).set(auth()).expect(200);
    const entry = item.body.entries[0];
    const edited = await request(app).patch(`/api/supplements/${supplementId}/entries/${entry.id}`).set(auth()).send({ amount: 5 }).expect(200);
    expect(edited.body.calories).toBe(400);
    await request(app).patch(`/api/supplements/${supplementId}`).set(auth()).send({ unit: "ml" }).expect(400);
    await request(app).patch(`/api/supplements/${supplementId}`).set(auth()).send({ archived: true }).expect(200);
    await request(app).post(`/api/supplements/${supplementId}/entries`).set(auth()).send({ amount: 10 }).expect(400);
    const overview = await request(app).get("/api/stats/overview?end=2026-11-19").set(auth()).expect(200);
    expect(overview.body.supplements.some((s: { id: string }) => s.id === supplementId)).toBe(true);
    await request(app).delete(`/api/supplements/${supplementId}/entries/${entry.id}`).set(auth()).expect(204);
    await request(app).delete(`/api/supplements/${supplementId}/entries/${entry.id}`).set(auth()).expect(404);
  });
  it("distinguishes unknown nutrition and handles leap days and timezone boundaries", async () => {
    const { dateKey, shiftDay, supplementTotals } = await import("../../services/supplements/supplements.js");
    expect(shiftDay("2024-03-01", -1)).toBe("2024-02-29");
    expect(shiftDay("2026-01-01", -1)).toBe("2025-12-31");
    expect(dateKey(new Date("2026-03-29T22:30:00Z"), "Europe/Berlin")).toBe("2026-03-30");
    expect(supplementTotals([{ amount: 10, calories: null, protein: 90, fat: null, carbs: 0 }])).toMatchObject({ calories: 0, protein: 9, missingNutritionCount: 1 });
    const newItem = await request(app).post("/api/supplements").set(auth()).send({ name: "Vitamin D", unit: "Stück" }).expect(201);
    await request(app).post(`/api/supplements/${newItem.body.id}/entries`).set(auth()).send({ date: "2026-11-17", amount: 1 }).expect(201);
    const data = await request(app).get("/api/stats/overview?end=2026-11-19").set(auth()).expect(200);
    expect(data.body.days[2]).toMatchObject({ hasNutrition: true, missingNutritionCount: 1, knownNutrition: { calories: false } });
  });
});
