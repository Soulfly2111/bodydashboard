import type { ImportSource } from "@prisma/client";

export type ImportTableRow = Record<string, string>;

export type ImportPreviewItem = {
  recordType: "FOOD" | "RECIPE";
  externalId: string;
  data: Record<string, unknown>;
  conflict?: string;
};

export type ImportProviderClient = {
  fetchRows(source: ImportSource): Promise<ImportTableRow[]>;
};

export type ColumnMapping = {
  recordType?: "food" | "recipe";
  columns: Record<string, string>;
};
