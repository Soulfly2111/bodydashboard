import { z } from "zod";

export function registerSupplementTools(server, api, requireKey) {
  const identity = { supplement: z.string().min(1).describe("Supplement-ID oder eindeutiger vollständiger Name (LaVita, Creatin, Kollagen …)") };
  const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe("Datum YYYY-MM-DD in der Benutzerzeitzone");
  const result = data => ({ content: [{ type: "text", text: JSON.stringify(data, null, 2) }] });
  const base = "/api/integrations/openclaw/supplements";
  async function resolve(value) {
    const items = await api(`${base}?archived=true`);
    const matches = items.filter(item => item.id === value || item.name.toLocaleLowerCase("de-DE") === value.toLocaleLowerCase("de-DE"));
    if (matches.length !== 1) throw new Error(matches.length ? "Name ist mehrdeutig. Bitte supplement_list nutzen und eine ID angeben." : "Supplement nicht gefunden. Bitte supplement_list nutzen.");
    return matches[0].id;
  }
  server.tool("supplement_list", "Listet die eigenen Supplements mit Mengen-Einheit und Nährwerten. Fehlende Nährwerte sind null, nicht null Kalorien.", {
    query: z.string().optional(), includeArchived: z.boolean().optional().default(false)
  }, async ({ query, includeArchived }) => {
    requireKey("supplement_list");
    const items = await api(`${base}?archived=${includeArchived}`);
    return result(query ? items.filter(item => item.name.toLocaleLowerCase("de-DE").includes(query.toLocaleLowerCase("de-DE"))) : items);
  });
  server.tool("supplement_get", "Ruft ein einzelnes Supplement mit Produktdaten und Einnahmehistorie ab. Zeitraum optional.", {
    ...identity, from: date.optional(), to: date.optional()
  }, async ({ supplement, from, to }) => {
    requireKey("supplement_get");
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    return result(await api(`${base}/${await resolve(supplement)}?${params}`));
  });
  server.tool("supplement_log", "Erfasst eine Supplement-Einnahme. Menge in der hinterlegten Einheit; Datum standardmäßig heute in der Benutzerzeitzone. Mit externalId sind Wiederholungen idempotent.", {
    ...identity, date: date.optional(), amount: z.number().positive(), unit: z.enum(["g", "ml", "Stück"]).optional(), externalId: z.string().min(1).optional()
  }, async ({ supplement, ...body }) => {
    requireKey("supplement_log");
    return result(await api(`${base}/${await resolve(supplement)}/entries`, { method: "POST", body }));
  });
  server.tool("supplement_update_entry", "Korrigiert Datum oder Menge einer Supplement-Einnahme. Historische Nährwerte bleiben erhalten.", {
    ...identity, entryId: z.string().min(1), date: date.optional(), amount: z.number().positive().optional()
  }, async ({ supplement, entryId, ...body }) => {
    requireKey("supplement_update_entry");
    return result(await api(`${base}/${await resolve(supplement)}/entries/${encodeURIComponent(entryId)}`, { method: "PATCH", body }));
  });
  server.tool("supplement_delete_entry", "Löscht eine einzelne Supplement-Einnahme anhand ihrer ID.", {
    ...identity, entryId: z.string().min(1)
  }, async ({ supplement, entryId }) => {
    requireKey("supplement_delete_entry");
    return result(await api(`${base}/${await resolve(supplement)}/entries/${encodeURIComponent(entryId)}`, { method: "DELETE" }));
  });
}
