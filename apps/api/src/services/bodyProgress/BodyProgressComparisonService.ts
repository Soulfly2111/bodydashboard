import { prisma } from "../../config/prisma.js";

export class BodyProgressComparisonService {
  async compare(userId: string, fromDate: Date, toDate: Date) {
    const measurements = await prisma.bodyMeasurement.findMany({ where: { userId, date: { gte: fromDate, lte: toDate } }, orderBy: { date: "asc" } });
    const summary = measurements.reduce<Record<string, { from?: number; to?: number; delta?: number }>>((acc, item) => {
      acc[item.measurementType] ??= {};
      acc[item.measurementType].from ??= item.value;
      acc[item.measurementType].to = item.value;
      acc[item.measurementType].delta = Math.round(((acc[item.measurementType].to ?? item.value) - (acc[item.measurementType].from ?? item.value)) * 10) / 10;
      return acc;
    }, {});
    return { fromDate, toDate, summary };
  }
}
