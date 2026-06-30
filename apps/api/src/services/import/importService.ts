import { prisma } from "../../config/prisma.js";
import type { ColumnMapping, ImportPreviewItem } from "./types.js";
import { ConfluenceProvider } from "./confluenceProvider.js";
import { ImportMapper } from "./importMapper.js";

export class ImportService {
  private mapper = new ImportMapper();

  async preview(sourceId: string, userId: string) {
    const source = await prisma.importSource.findFirstOrThrow({ where: { id: sourceId, userId } });
    const rows = await this.provider(source.provider).fetchRows(source);
    const items = this.mapper.mapRows(rows, JSON.parse(source.mappingJson) as ColumnMapping);
    return this.withConflicts(items, userId);
  }

  async run(sourceId: string, userId: string) {
    const source = await prisma.importSource.findFirstOrThrow({ where: { id: sourceId, userId } });
    const preview = await this.preview(sourceId, userId);
    let importedCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;
    let conflictCount = 0;

    for (const item of preview) {
      if (item.conflict) {
        conflictCount += 1;
        continue;
      }
      if (item.recordType === "FOOD") {
        const result = await prisma.food.upsert({
          where: { userId_externalId_source: { userId, externalId: item.externalId, source: `confluence:${source.id}` } },
          update: this.foodData(item),
          create: { ...this.foodData(item), userId, externalId: item.externalId, source: `confluence:${source.id}` }
        });
        result.createdAt.getTime() === result.updatedAt.getTime() ? (importedCount += 1) : (updatedCount += 1);
      } else {
        await prisma.recipe.upsert({
          where: { userId_externalId_source: { userId, externalId: item.externalId, source: `confluence:${source.id}` } },
          update: this.recipeData(item),
          create: { ...this.recipeData(item), userId, externalId: item.externalId, source: `confluence:${source.id}` }
        });
        importedCount += 1;
      }
    }

    const log = await prisma.importLog.create({
      data: {
        sourceId,
        recordType: "FOOD",
        status: conflictCount ? "completed_with_conflicts" : "completed",
        message: `Imported ${importedCount}, updated ${updatedCount}, skipped ${skippedCount}, conflicts ${conflictCount}`,
        importedCount,
        updatedCount,
        skippedCount,
        conflictCount,
        payloadJson: JSON.stringify({ preview: preview.slice(0, 50) })
      }
    });
    await prisma.importSource.update({ where: { id: sourceId }, data: { lastImportedAt: new Date() } });
    return log;
  }

  private provider(provider: string) {
    if (provider === "CONFLUENCE") {
      return new ConfluenceProvider();
    }
    throw new Error(`Unsupported provider ${provider}`);
  }

  private async withConflicts(items: ImportPreviewItem[], userId: string) {
    return Promise.all(
      items.map(async (item) => {
        if (item.conflict || !item.data.name) {
          return item;
        }
        const existing =
          item.recordType === "FOOD"
            ? await prisma.food.findFirst({ where: { userId, name: String(item.data.name) } })
            : await prisma.recipe.findFirst({ where: { userId, name: String(item.data.name) } });
        return existing ? { ...item, conflict: `Existing ${item.recordType.toLowerCase()} with same name` } : item;
      })
    );
  }

  private foodData(item: ImportPreviewItem) {
    return {
      name: String(item.data.name ?? ""),
      brand: item.data.brand ? String(item.data.brand) : null,
      category: item.data.category ? String(item.data.category) : null,
      caloriesPer100g: Number(item.data.caloriesPer100g ?? 0),
      protein: Number(item.data.protein ?? 0),
      fat: Number(item.data.fat ?? 0),
      carbs: Number(item.data.carbs ?? 0),
      sugar: Number(item.data.sugar ?? 0),
      fiber: Number(item.data.fiber ?? 0),
      salt: Number(item.data.salt ?? 0)
    };
  }

  private recipeData(item: ImportPreviewItem) {
    return {
      name: String(item.data.name ?? ""),
      servings: Number(item.data.servings ?? 1),
      instructions: item.data.instructions ? String(item.data.instructions) : null,
      category: item.data.category ? String(item.data.category) : null
    };
  }
}
