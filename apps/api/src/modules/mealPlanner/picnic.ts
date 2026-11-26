import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { z } from "zod";
import { env } from "../../config/env.js";
import { fail } from "./recipes.js";

const record = z.record(z.unknown());
export const picnicAvailable = () => Boolean(env.MEAL_PICNIC_URL && env.MEAL_PICNIC_TOKEN && env.MEAL_PICNIC_OWNER_ID);

export async function withPicnic<T>(use: (call: (name: string, args?: Record<string, unknown>) => Promise<unknown>) => Promise<T>) {
  if (!picnicAvailable()) throw fail(503, "Picnic ist noch nicht für den Server eingerichtet.");
  const client = new Client({ name: "bodydashboard-meal-planner", version: "1.0.0" });
  const transport = new StreamableHTTPClientTransport(new URL(env.MEAL_PICNIC_URL), {
    requestInit: { headers: { authorization: "Bearer " + env.MEAL_PICNIC_TOKEN } }
  });
  try {
    await client.connect(transport, { timeout: 15_000 });
    return await use(async (name, args = {}) => {
      const result = await client.callTool({ name, arguments: args }, undefined, { timeout: 30_000 });
      if (result.isError) throw new Error("Picnic meldet einen Fehler bei " + name);
      if (result.structuredContent) return result.structuredContent;
      const plain = Array.isArray(result.content) ? result.content.find((part) => part.type === "text") : undefined;
      if (plain?.type === "text" && typeof plain.text === "string") {
        try { return JSON.parse(plain.text) as unknown; } catch { /* tool returned human-readable success */ }
      }
      return null;
    });
  } finally {
    await client.close().catch(() => undefined);
  }
}

function rows(value: unknown, keys: string[]): unknown[] {
  if (Array.isArray(value)) return value;
  const parsed = record.safeParse(value);
  if (parsed.success) {
    for (const key of keys) {
      const container = parsed.data[key];
      if (Array.isArray(container)) return container;
      if (container && typeof container === "object") {
        try { return rows(container, keys); } catch { /* try the next known container */ }
      }
    }
  }
  throw new Error("Unerwartetes Antwortformat von Picnic");
}

export const productSchema = z.object({
  id: z.string().min(1).max(100), name: z.string().min(1).max(250), packageInfo: z.string().max(150),
  priceCents: z.number().int().min(0).max(1_000_000).nullable()
});
export type PicnicProduct = z.infer<typeof productSchema>;

export function productOptions(value: unknown) {
  return rows(value, ["products", "items", "results", "articles"]).flatMap((entry) => {
    const product = record.safeParse(entry);
    if (!product.success) return [];
    const row = product.data;
    const parsed = productSchema.safeParse({
      id: row.id ?? row.productId ?? row.sellingUnitId,
      name: row.name ?? row.displayName,
      packageInfo: row.packageInfo ?? row.unit ?? row.unit_quantity ?? "",
      priceCents: row.priceCents ?? row.price_cents ?? row.price ?? null
    });
    return parsed.success ? [parsed.data] : [];
  });
}

export function cartCounts(value: unknown) {
  const counts = new Map<string, number>();
  for (const entry of rows(value, ["items", "products", "cart", "basket", "articles"])) {
    const row = record.parse(entry);
    const product = record.safeParse(row.product ?? row.article);
    const id = row.productId ?? row.sellingUnitId ?? row.product_id ?? (product.success ? product.data.id : row.id);
    const count = row.count ?? row.quantity ?? row.amount;
    if (typeof id !== "string" || typeof count !== "number" || !Number.isInteger(count) || count < 0) {
      throw new Error("Picnic-Warenkorb konnte nicht eindeutig gelesen werden.");
    }
    counts.set(id, (counts.get(id) ?? 0) + count);
  }
  return counts;
}
