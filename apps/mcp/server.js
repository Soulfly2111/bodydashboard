#!/usr/bin/env node
/**
 * bodydashboard-mcp – MCP-Server für das Bodydashboard-API
 *
 * Zwei Transport-Modi:
 *   1. stdio (Standard)   → für lokale Clients (OpenCode, Claude Desktop)
 *   2. http               → für ChatGPT & Co. (Streamable HTTP, Express)
 *      BODYDASH_TRANSPORT=http PORT=4001 MCP_PATH_SECRET=<token>
 *      Endpoint: http://127.0.0.1:PORT/mcp/<token>
 *
 * Konfiguration über Umgebungsvariablen:
 *   BODYDASH_URL        API-Basis-URL (Standard: https://bodydashboard.de)
 *   BODYDASH_API_KEY    Integrations-API-Key ("bdoc_...") – OpenClaw-Endpunkte
 *   BODYDASH_EMAIL      Optional: E-Mail/Username für JWT-Login (aktiviert
 *   BODYDASH_PASSWORD   Lebensmittelsuche, Tagesabfrage, Statistiken, OFF)
 */

import express from "express";
import { registerMealPlannerTools } from "./meal-planner.js";
import { registerSupplementTools } from "./supplements.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";

const BASE_URL = (process.env.BODYDASH_URL || "https://bodydashboard.de").replace(/\/+$/, "");
const API_KEY = process.env.BODYDASH_API_KEY || "";
const EMAIL = process.env.BODYDASH_EMAIL || "";
const PASSWORD = process.env.BODYDASH_PASSWORD || "";
const TRANSPORT = process.env.BODYDASH_TRANSPORT || "stdio";
const HTTP_PORT = Number(process.env.PORT || 4001);
const MCP_SECRET = process.env.MCP_PATH_SECRET || "";

const MEAL_TYPES = ["BREAKFAST", "LUNCH", "DINNER", "SNACK"];

// ---------------------------------------------------------------- HTTP ----

/** Fehler aus einer API-Antwort in eine lesbare Nachricht umwandeln. */
async function errorText(res) {
  let body = "";
  try { body = await res.text(); } catch { /* ignore */ }
  return `HTTP ${res.status} ${res.statusText}${body ? ` – ${body.slice(0, 500)}` : ""}`;
}

// ---------------------------------------------------------------- JWT -----

let jwt = { accessToken: null, refreshToken: null, expiresHint: 0 };

async function jwtLogin() {
  if (!EMAIL || !PASSWORD) return null;
  const res = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD, rememberMe: true })
  });
  if (!res.ok) throw new Error(`Login fehlgeschlagen: ${await errorText(res)}`);
  const data = await res.json();
  jwt = { accessToken: data.accessToken, refreshToken: data.refreshToken, expiresHint: Date.now() + 50 * 60 * 1000 };
  return jwt.accessToken;
}

async function jwtRefresh() {
  if (!jwt.refreshToken) return jwtLogin();
  const res = await fetch(`${BASE_URL}/api/auth/refresh`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ refreshToken: jwt.refreshToken })
  });
  if (!res.ok) return jwtLogin(); // Refresh-Token ungültig → frischer Login
  const data = await res.json();
  jwt = { accessToken: data.accessToken, refreshToken: data.refreshToken, expiresHint: Date.now() + 50 * 60 * 1000 };
  return jwt.accessToken;
}

/** API-Aufruf. jwt=true → Bearer-Token (automatischer Login/Refresh). */
async function api(path, { method = "GET", body, jwt: useJwt = false } = {}) {
  // Account-bound API keys also authenticate the normal API routes.
  if (API_KEY && !EMAIL && !PASSWORD) useJwt = false;
  const headers = {};
  if (API_KEY) headers["x-api-key"] = API_KEY;
  if (useJwt) {
    if (!jwt.accessToken) await jwtLogin();
    headers["authorization"] = `Bearer ${jwt.accessToken}`;
  }
  if (body !== undefined) headers["content-type"] = "application/json";

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined
  });

  if (res.status === 401 && useJwt) {
    // Ein Retry mit frischem Token
    await jwtRefresh();
    const retry = await fetch(`${BASE_URL}${path}`, {
      method,
      headers: { ...headers, authorization: `Bearer ${jwt.accessToken}`, ...(body !== undefined ? { "content-type": "application/json" } : {}) },
      body: body !== undefined ? JSON.stringify(body) : undefined
    });
    if (!retry.ok) throw new Error(await errorText(retry));
    return retry.status === 204 ? { ok: true } : await retry.json();
  }

  if (!res.ok) throw new Error(await errorText(res));
  if (res.status === 204) return { ok: true };
  return res.json();
}

const requireKey = (name) => {
  if (!API_KEY) throw new Error(`${name} benötigt BODYDASH_API_KEY in der MCP-Konfiguration.`);
};
const requireJwt = (name) => {
  if (!API_KEY && (!EMAIL || !PASSWORD)) {
    throw new Error(`${name} benötigt BODYDASH_EMAIL + BODYDASH_PASSWORD in der MCP-Konfiguration (der API-Key deckt nur die Tracking-Endpunkte ab).`);
  }
};

// ---------------------------------------------------------------- Tools ---

const foodShape = {
  name: z.string().min(1).describe("Lebensmittelname"),
  brand: z.string().optional().nullable().describe("Marke"),
  category: z.string().optional().nullable().describe("Kategorie, z. B. Obst, Getreide"),
  barcode: z.string().optional().nullable().describe("EAN/Barcode"),
  caloriesPer100g: z.coerce.number().nonnegative().describe("kcal pro 100 g/ml"),
  protein: z.coerce.number().nonnegative().describe("Protein in g pro 100 g"),
  fat: z.coerce.number().nonnegative().describe("Fett in g pro 100 g"),
  carbs: z.coerce.number().nonnegative().describe("Kohlenhydrate in g pro 100 g"),
  sugar: z.coerce.number().nonnegative().optional().default(0).describe("Zucker in g pro 100 g (Standard 0)"),
  fiber: z.coerce.number().nonnegative().optional().default(0).describe("Ballaststoffe in g pro 100 g (Standard 0)"),
  salt: z.coerce.number().nonnegative().optional().default(0).describe("Salz in g pro 100 g (Standard 0)")
};

const dateArg = z.string().optional().describe("Datum als YYYY-MM-DD (Standard: heute)");

/** Erzeugt eine MCP-Server-Instanz mit allen registrierten Tools. */
function buildServer() {
  const server = new McpServer({ name: "bodydashboard", version: "1.1.0" });

  // --- Status -------------------------------------------------------------

  server.tool(
    "bd_status",
    "Prüft die Verbindung zum Bodydashboard: API-Key-Gültigkeit, Scopes und – falls konfiguriert – Login-Status.",
    {},
    async () => {
      const parts = [];
      if (API_KEY) {
        const health = await api("/api/integrations/openclaw/health");
        parts.push(`API-Key: ok (provider ${health.provider}, scopes ${JSON.stringify(health.scopes)})`);
      } else {
        parts.push("API-Key: NICHT KONFIGURIERT (BODYDASH_API_KEY fehlt)");
      }
      if (EMAIL && PASSWORD) {
        await jwtLogin();
        const me = await api("/api/auth/me", { jwt: true });
        parts.push(`JWT-Login: ok (user ${me.name} <${me.email}>, Rolle ${me.role})`);
      } else if (API_KEY) {
        const me = await api("/api/auth/me");
        parts.push(`API-Key-Konto: ok (user ${me.name} <${me.email}>, Rolle ${me.role})`);
      } else {
        parts.push("JWT-Login: nicht konfiguriert (Lesen/Suchen/Statistiken deaktiviert)");
      }
      return { content: [{ type: "text", text: parts.join("\n") }] };
    }
  );

  // --- Lebensmittel -------------------------------------------------------

  server.tool(
    "food_search",
    "Sucht in den eigenen Bodydashboard-Lebensmitteln nach Name/Barcode (JWT-Login erforderlich).",
    {
      query: z.string().min(1).describe("Suchbegriff (Name oder Barcode)"),
      take: z.coerce.number().int().min(1).max(100).optional().default(25).describe("Max. Treffer (Standard 25)")
    },
    async ({ query, take }) => {
      requireJwt("food_search");
      const foods = await api(`/api/foods?q=${encodeURIComponent(query)}&take=${take}`, { jwt: true });
      return { content: [{ type: "text", text: JSON.stringify(foods, null, 2) }] };
    }
  );

  server.tool(
    "food_upsert",
    "Legt ein Lebensmittel an oder aktualisiert es (via OpenClaw-Integration, Abgleich über Name). Gibt die Lebensmittel-ID zurück.",
    foodShape,
    async (food) => {
      requireKey("food_upsert");
      const result = await api("/api/integrations/openclaw/foods", { method: "POST", body: food });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    "off_search",
    "Sucht Lebensmittel in der Open Food Facts Datenbank (JWT-Login erforderlich).",
    {
      query: z.string().min(1).describe("Suchbegriff oder Barcode"),
      take: z.coerce.number().int().min(1).max(50).optional().default(10).describe("Max. Treffer (Standard 10)")
    },
    async ({ query, take }) => {
      requireJwt("off_search");
      const results = await api(`/api/open-food-facts/search?q=${encodeURIComponent(query)}&take=${take}`, { jwt: true });
      return { content: [{ type: "text", text: JSON.stringify(results, null, 2) }] };
    }
  );

  server.tool(
    "off_import",
    "Importiert ein Open-Food-Facts-Produkt anhand des Barcodes als Lebensmittel ins Bodydashboard (JWT-Login erforderlich).",
    { barcode: z.string().min(1).describe("EAN/Barcode des Produkts") },
    async ({ barcode }) => {
      requireJwt("off_import");
      const result = await api("/api/open-food-facts/import", { method: "POST", body: { barcode } });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  // --- Mahlzeiten ---------------------------------------------------------

  server.tool(
    "meal_log",
    "Trackt eine Mahlzeit: legt ggf. das Lebensmittel an und bucht die Portion auf Frühstück/Mittag/Abend/Snack. Der praktische Ein-Klick-Weg fürs Essens-Tracking.",
    {
      date: dateArg,
      type: z.enum(MEAL_TYPES).describe("Mahlzeitentyp"),
      amount: z.coerce.number().positive().describe("Menge, Standard-Einheit g"),
      unit: z.string().optional().default("g").describe("Einheit, z. B. g, ml, Portion"),
      servingName: z.string().optional().describe("Freitext-Bezeichnung der Portion, z. B. 'Teller'"),
      food: z.object(foodShape).describe("Das Lebensmittel mit Nährwerten pro 100 g")
    },
    async ({ date, type, amount, unit, servingName, food }) => {
      requireKey("meal_log");
      const result = await api("/api/integrations/openclaw/meals/quick-add", {
        method: "POST",
        body: { date: date ?? new Date().toISOString(), type, amount, unit, ...(servingName ? { servingName } : {}), food }
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    "meal_add_item",
    "Bucht ein bereits vorhandenes Lebensmittel (foodId aus food_search/food_upsert) als Mahlzeiten-Eintrag.",
    {
      date: dateArg,
      type: z.enum(MEAL_TYPES).describe("Mahlzeitentyp"),
      foodId: z.string().min(1).describe("ID des Lebensmittels"),
      amount: z.coerce.number().positive().describe("Menge in Gramm/ml"),
      unit: z.string().optional().default("g").describe("Einheit")
    },
    async ({ date, type, foodId, amount, unit }) => {
      requireKey("meal_add_item");
      const result = await api("/api/integrations/openclaw/meals/items", {
        method: "POST",
        body: { date: date ?? new Date().toISOString(), type, foodId, amount, unit }
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    "meal_get_day",
    "Zeigt alle Mahlzeiten eines Tages inkl. Einträge, Nährwerte und Tagessummen (JWT-Login erforderlich).",
    { date: z.string().min(1).describe("Datum als YYYY-MM-DD") },
    async ({ date }) => {
      requireJwt("meal_get_day");
      const meals = await api(`/api/meals/day/${encodeURIComponent(date)}`, { jwt: true });
      return { content: [{ type: "text", text: JSON.stringify(meals, null, 2) }] };
    }
  );

  server.tool(
    "meal_update_item",
    "Ändert Menge/Einheit eines Mahlzeiten-Eintrags.",
    {
      id: z.string().min(1).describe("MealItem-ID"),
      amount: z.coerce.number().positive().optional().describe("Neue Menge"),
      unit: z.string().optional().describe("Neue Einheit"),
      servingName: z.string().optional().nullable().describe("Neue Portionsbezeichnung")
    },
    async ({ id, amount, unit, servingName }) => {
      requireKey("meal_update_item");
      const body = {};
      if (amount !== undefined) body.amount = amount;
      if (unit !== undefined) body.unit = unit;
      if (servingName !== undefined) body.servingName = servingName;
      const result = await api(`/api/integrations/openclaw/meals/items/${id}`, { method: "PUT", body });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    "meal_delete_item",
    "Löscht einen Mahlzeiten-Eintrag.",
    { id: z.string().min(1).describe("MealItem-ID") },
    async ({ id }) => {
      requireKey("meal_delete_item");
      await api(`/api/integrations/openclaw/meals/items/${id}`, { method: "DELETE" });
      return { content: [{ type: "text", text: `Eintrag ${id} gelöscht.` }] };
    }
  );

  // --- Wasser & Gewicht ---------------------------------------------------

  server.tool(
    "water_log",
    "Trackt getrunkenes Wasser.",
    {
      amountMl: z.coerce.number().int().positive().describe("Menge in Millilitern, z. B. 250"),
      date: dateArg
    },
    async ({ amountMl, date }) => {
      requireKey("water_log");
      const result = await api("/api/integrations/openclaw/water", {
        method: "POST",
        body: { amountMl, date: date ?? new Date().toISOString() }
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    "weight_log",
    "Trackt Körperdaten: Gewicht, Körperfett, Muskelmasse (mindestens ein Wert erforderlich).",
    {
      weightKg: z.coerce.number().positive().optional().describe("Gewicht in kg"),
      bodyFatPercent: z.coerce.number().min(0).max(100).optional().describe("Körperfett in %"),
      muscleMassKg: z.coerce.number().positive().optional().describe("Muskelmasse in kg"),
      date: dateArg
    },
    async ({ weightKg, bodyFatPercent, muscleMassKg, date }) => {
      requireKey("weight_log");
      if (weightKg == null && bodyFatPercent == null && muscleMassKg == null) {
        throw new Error("Mindestens einer der Werte weightKg, bodyFatPercent oder muscleMassKg ist erforderlich.");
      }
      const result = await api("/api/integrations/openclaw/weight", {
        method: "POST",
        body: { date: date ?? new Date().toISOString(), weightKg, bodyFatPercent, muscleMassKg }
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  // --- Aktivitäten --------------------------------------------------------

  server.tool(
    "activity_log",
    "Trackt eine Aktivität (Sport/Bewegung).",
    {
      typeName: z.string().min(2).describe("Aktivitätstyp, z. B. 'Radfahren', 'Laufen' (muss im Katalog existieren)"),
      durationMinutes: z.coerce.number().int().positive().describe("Dauer in Minuten"),
      date: dateArg,
      intensity: z.enum(["VERY_LIGHT", "LIGHT", "MEDIUM", "HIGH", "VERY_HIGH"]).optional().default("MEDIUM").describe("Intensität"),
      distanceKm: z.coerce.number().nonnegative().optional().describe("Distanz in km"),
      calories: z.coerce.number().nonnegative().optional().describe("Verbrannte kcal (leer = MET-Berechnung)"),
      notes: z.string().optional().describe("Notizen")
    },
    async ({ typeName, durationMinutes, date, intensity, distanceKm, calories, notes }) => {
      requireKey("activity_log");
      const result = await api("/api/integrations/openclaw/activities", {
        method: "POST",
        body: { typeName, durationMinutes, date: date ?? new Date().toISOString(), intensity, ...(distanceKm !== undefined ? { distanceKm } : {}), ...(calories !== undefined ? { calories } : {}), ...(notes ? { notes } : {}) }
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  // --- Statistiken --------------------------------------------------------

  server.tool(
    "stats_day",
    "Nährwert-Statistik für einen Tag (Kcal/Makros über alle Mahlzeiten) – JWT-Login erforderlich.",
    { date: z.string().min(1).describe("Datum als YYYY-MM-DD") },
    async ({ date }) => {
      requireJwt("stats_day");
      const stats = await api(`/api/stats/day/${encodeURIComponent(date)}`, { jwt: true });
      return { content: [{ type: "text", text: JSON.stringify(stats, null, 2) }] };
    }
  );

  server.tool(
    "stats_week",
    "Nährwert-Statistik für die aktuelle Woche – JWT-Login erforderlich.",
    {},
    async () => {
      requireJwt("stats_week");
      const stats = await api("/api/stats/week", { jwt: true });
      return { content: [{ type: "text", text: JSON.stringify(stats, null, 2) }] };
    }
  );

  registerSupplementTools(server, api, requireKey);
  registerMealPlannerTools(server, api, requireKey);
  return server;
}

// ---------------------------------------------------------------- Start ---

if (TRANSPORT === "http") {
  const app = express();
  app.use(express.json({ limit: "1mb" }));

  const MCP_PATH = `/mcp/${MCP_SECRET}`;

  app.all(MCP_PATH, async (req, res) => {
    try {
      // Stateless: pro Request eine frische Server/Transport-Instanz
      const server = buildServer();
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
        enableJsonResponse: true
      });
      res.on("close", () => {
        transport.close();
        server.close();
      });
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (err) {
      console.error("MCP-Fehler:", err);
      if (!res.headersSent) {
        res.status(500).json({ jsonrpc: "2.0", error: { code: -32603, message: "Internal error" }, id: null });
      }
    }
  });

  app.get(/.*/, (_req, res) => res.status(405).json({ error: "GET nicht unterstützt (stateless streamable HTTP – nur POST)" }));
  app.all(/.*/, (_req, res) => res.status(404).json({ error: "Not found" }));

  const HOST = "127.0.0.1";
  app.listen(HTTP_PORT, HOST, () => {
    console.error(`bodydashboard-mcp (http) lauscht auf http://${HOST}:${HTTP_PORT}${MCP_PATH}`);
  });
} else {
  await buildServer().connect(new StdioServerTransport());
  console.error(`bodydashboard-mcp (stdio) gestartet → ${BASE_URL} (API-Key: ${API_KEY ? "ja" : "nein"}, JWT: ${EMAIL ? "ja" : "nein"})`);
}
