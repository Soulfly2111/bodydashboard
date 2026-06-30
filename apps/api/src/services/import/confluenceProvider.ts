import type { ImportSource } from "@prisma/client";
import { decryptSecret } from "../../utils/crypto.js";
import type { ImportProviderClient, ImportTableRow } from "./types.js";

type ConfluencePageResponse = {
  id: string;
  title: string;
  body?: { storage?: { value?: string } };
};

export class ConfluenceProvider implements ImportProviderClient {
  async fetchRows(source: ImportSource): Promise<ImportTableRow[]> {
    const page = await this.fetchPage(source);
    const html = page.body?.storage?.value ?? "";
    return this.extractTables(html).map((row, index) => ({
      ...row,
      _externalId: `${page.id}:${index}`,
      _sourceTitle: page.title
    }));
  }

  private async fetchPage(source: ImportSource): Promise<ConfluencePageResponse> {
    const token = decryptSecret(source.encryptedApiToken);
    const username = source.encryptedUsername ? decryptSecret(source.encryptedUsername) : "";
    const base = source.baseUrl.replace(/\/$/, "");
    const url = source.pageId
      ? `${base}/wiki/rest/api/content/${source.pageId}?expand=body.storage,version`
      : `${base}/wiki/rest/api/content?spaceKey=${encodeURIComponent(source.spaceKey ?? "")}&title=${encodeURIComponent(
          source.pageTitle ?? ""
        )}&expand=body.storage,version`;

    const headers: Record<string, string> = { Accept: "application/json" };
    headers.Authorization =
      source.authType === "pat" ? `Bearer ${token}` : `Basic ${Buffer.from(`${username}:${token}`).toString("base64")}`;

    const response = await fetch(url, { headers });
    if (!response.ok) {
      throw new Error(`Confluence request failed: ${response.status} ${response.statusText}`);
    }
    const data = await response.json();
    return source.pageId ? data : data.results?.[0];
  }

  private extractTables(html: string): ImportTableRow[] {
    const tables = [...html.matchAll(/<table[\s\S]*?<\/table>/gi)].map((match) => match[0]);
    return tables.flatMap((table) => {
      const rows = [...table.matchAll(/<tr[\s\S]*?<\/tr>/gi)].map((match) => match[0]);
      const header = this.extractCells(rows.shift() ?? "").map(this.cleanCell);
      return rows.map((row) => {
        const cells = this.extractCells(row).map(this.cleanCell);
        return Object.fromEntries(header.map((name, index) => [name, cells[index] ?? ""]));
      });
    });
  }

  private extractCells(row: string) {
    return [...row.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((match) => match[1]);
  }

  private cleanCell(value: string) {
    return value
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .trim();
  }
}
