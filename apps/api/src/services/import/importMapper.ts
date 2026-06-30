import type { ColumnMapping, ImportPreviewItem, ImportTableRow } from "./types.js";

const numberFields = new Set([
  "caloriesPer100g",
  "protein",
  "fat",
  "carbs",
  "sugar",
  "fiber",
  "salt",
  "servings"
]);

export class ImportMapper {
  mapRows(rows: ImportTableRow[], mapping: ColumnMapping): ImportPreviewItem[] {
    return rows.map((row, index) => {
      const data = Object.fromEntries(
        Object.entries(mapping.columns).map(([sourceColumn, targetField]) => [
          targetField,
          this.coerce(row[sourceColumn] ?? "", targetField)
        ])
      );
      const recordType = (mapping.recordType ?? (data.instructions || data.servings ? "recipe" : "food")).toUpperCase() as
        | "FOOD"
        | "RECIPE";
      return {
        recordType,
        externalId: String(row._externalId ?? index),
        data,
        conflict: !data.name ? "Missing required name" : undefined
      };
    });
  }

  private coerce(value: string, targetField: string) {
    if (!numberFields.has(targetField)) {
      return value;
    }
    const parsed = Number(String(value).replace(",", ".").replace(/[^\d.-]/g, ""));
    return Number.isFinite(parsed) ? parsed : 0;
  }
}
