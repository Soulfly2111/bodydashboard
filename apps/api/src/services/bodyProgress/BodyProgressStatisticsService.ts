import { subDays } from "date-fns";
import { prisma } from "../../config/prisma.js";

export class BodyProgressStatisticsService {
  async statistics(userId: string) {
    const [measurements, photos, weights] = await Promise.all([
      prisma.bodyMeasurement.findMany({ where: { userId }, orderBy: { date: "asc" } }),
      prisma.bodyPhoto.findMany({ where: { userId }, orderBy: { date: "desc" } }),
      prisma.weightEntry.findMany({ where: { userId, date: { gte: subDays(new Date(), 90) } }, orderBy: { date: "asc" } })
    ]);
    const latestByType = new Map<string, typeof measurements[number]>();
    for (const item of measurements) latestByType.set(item.measurementType, item);
    const byType = measurements.reduce<Record<string, Array<{ date: string; value: number }>>>((acc, item) => {
      acc[item.measurementType] ??= [];
      acc[item.measurementType].push({ date: item.date.toISOString().slice(0, 10), value: item.value });
      return acc;
    }, {});
    const delta = (type: string, days: number) => {
      const items = measurements.filter((item) => item.measurementType === type && item.date >= subDays(new Date(), days));
      if (items.length < 2) return 0;
      return Math.round((items[items.length - 1].value - items[0].value) * 10) / 10;
    };
    const waist = latestByType.get("Taillenumfang")?.value;
    const hip = latestByType.get("Hüftumfang")?.value;
    const height = await prisma.user.findUnique({ where: { id: userId }, select: { heightCm: true } });
    return {
      latestPhoto: photos[0] ?? null,
      latestMeasurements: Object.fromEntries(latestByType),
      changes: {
        abdomen30: delta("Bauchumfang", 30),
        skinfold30: delta("Hautfaltendicke", 30),
        waist30: delta("Taillenumfang", 30),
        chest30: delta("Brustumfang", 30),
        abdomen90: delta("Bauchumfang", 90),
        skinfold90: delta("Hautfaltendicke", 90),
        waist90: delta("Taillenumfang", 90)
      },
      ratios: {
        waistToHip: waist && hip ? Math.round((waist / hip) * 100) / 100 : null,
        waistToHeight: waist && height?.heightCm ? Math.round((waist / height.heightCm) * 100) / 100 : null
      },
      series: byType,
      photoCount: photos.length,
      weights
    };
  }
}
