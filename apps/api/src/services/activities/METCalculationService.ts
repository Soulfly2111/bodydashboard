import { prisma } from "../../config/prisma.js";
import { activityTypes, metForIntensity, slugifyActivityName } from "./activityCatalog.js";

export class METCalculationService {
  async calculate(input: { typeName: string; intensity: string; durationMinutes: number; weightKg?: number | null }) {
    const met = await this.resolveMet(input.typeName, input.intensity);
    const weightKg = input.weightKg || 75;
    const durationHours = Math.max(input.durationMinutes, 0) / 60;
    return Math.round(met * weightKg * durationHours);
  }

  async resolveMet(typeName: string, intensity: string) {
    const slug = slugifyActivityName(typeName);
    const type = await prisma.activityType.findFirst({
      where: { OR: [{ slug }, { name: typeName }] },
      include: { metValues: true }
    });
    const metValue = type?.metValues.find((item) => item.intensity === intensity)?.met;
    if (metValue) return metValue;
    const fallbackType = activityTypes.find((item) => item.slug === slug || item.name.toLowerCase() === typeName.toLowerCase());
    return metForIntensity(fallbackType?.defaultMet ?? 4, intensity);
  }
}
