import { endOfDay, startOfDay, subDays } from "date-fns";
import { prisma } from "../../config/prisma.js";
import { slugifyActivityName } from "./activityCatalog.js";
import { METCalculationService } from "./METCalculationService.js";

export type ActivityInput = {
  typeName: string;
  date: Date;
  startTime?: string | null;
  endTime?: string | null;
  durationMinutes: number;
  intensity?: string;
  distanceKm?: number | null;
  averageSpeedKmh?: number | null;
  averageHeartRate?: number | null;
  maxHeartRate?: number | null;
  calories?: number | null;
  notes?: string | null;
  steps?: number | null;
  elevationGainM?: number | null;
  powerWatts?: number | null;
  cadence?: number | null;
  pace?: string | null;
  source?: string;
  externalId?: string | null;
  muscleGroups?: string[];
  exercisesCount?: number | null;
  setsCount?: number | null;
  repsCount?: number | null;
  trainingVolume?: number | null;
};

export class ActivityService {
  private met = new METCalculationService();

  list(userId: string, query?: { from?: Date; to?: Date; limit?: number }) {
    return prisma.activity.findMany({
      where: {
        userId,
        date: {
          gte: query?.from ? startOfDay(query.from) : undefined,
          lte: query?.to ? endOfDay(query.to) : undefined
        }
      },
      include: { activityType: true },
      orderBy: [{ date: "desc" }, { startTime: "desc" }],
      take: query?.limit ?? 100
    });
  }

  get(userId: string, id: string) {
    return prisma.activity.findFirst({ where: { id, userId }, include: { activityType: true, workout: { include: { exercises: { include: { sets: true } } } } } });
  }

  async create(userId: string, input: ActivityInput) {
    const data = await this.data(userId, input);
    return prisma.activity.create({ data, include: { activityType: true } });
  }

  async update(userId: string, id: string, input: Partial<ActivityInput>) {
    const existing = await prisma.activity.findFirstOrThrow({ where: { id, userId } });
    const merged: ActivityInput = {
      typeName: input.typeName ?? existing.typeName,
      date: input.date ?? existing.date,
      startTime: input.startTime ?? existing.startTime,
      endTime: input.endTime ?? existing.endTime,
      durationMinutes: input.durationMinutes ?? existing.durationMinutes,
      intensity: input.intensity ?? existing.intensity,
      distanceKm: input.distanceKm ?? existing.distanceKm,
      averageSpeedKmh: input.averageSpeedKmh ?? existing.averageSpeedKmh,
      averageHeartRate: input.averageHeartRate ?? existing.averageHeartRate,
      maxHeartRate: input.maxHeartRate ?? existing.maxHeartRate,
      calories: input.calories ?? (existing.caloriesOverride ? existing.calories : null),
      notes: input.notes ?? existing.notes,
      steps: input.steps ?? existing.steps,
      elevationGainM: input.elevationGainM ?? existing.elevationGainM,
      powerWatts: input.powerWatts ?? existing.powerWatts,
      cadence: input.cadence ?? existing.cadence,
      pace: input.pace ?? existing.pace,
      source: input.source ?? existing.source,
      externalId: input.externalId ?? existing.externalId,
      muscleGroups: input.muscleGroups ?? (existing.muscleGroupsJson ? JSON.parse(existing.muscleGroupsJson) : undefined),
      exercisesCount: input.exercisesCount ?? existing.exercisesCount,
      setsCount: input.setsCount ?? existing.setsCount,
      repsCount: input.repsCount ?? existing.repsCount,
      trainingVolume: input.trainingVolume ?? existing.trainingVolume
    };
    const data = await this.data(userId, merged);
    return prisma.activity.update({ where: { id }, data, include: { activityType: true } });
  }

  delete(userId: string, id: string) {
    return prisma.activity.deleteMany({ where: { id, userId } });
  }

  async stats(userId: string, from: Date, to: Date) {
    const activities = await this.list(userId, { from, to, limit: 500 });
    const activeDays = new Set(activities.map((item) => item.date.toISOString().slice(0, 10))).size;
    const calories = activities.reduce((sum, item) => sum + item.calories, 0);
    const durationMinutes = activities.reduce((sum, item) => sum + item.durationMinutes, 0);
    const steps = activities.reduce((sum, item) => sum + (item.steps ?? 0), 0);
    const byType = activities.reduce<Record<string, { count: number; calories: number; durationMinutes: number }>>((acc, item) => {
      acc[item.typeName] ??= { count: 0, calories: 0, durationMinutes: 0 };
      acc[item.typeName].count += 1;
      acc[item.typeName].calories += item.calories;
      acc[item.typeName].durationMinutes += item.durationMinutes;
      return acc;
    }, {});
    const favorite = Object.entries(byType).sort((a, b) => b[1].count - a[1].count)[0]?.[0] ?? null;
    return {
      activities,
      totals: {
        count: activities.length,
        calories: Math.round(calories),
        durationMinutes,
        steps,
        activeDays
      },
      averages: {
        calories: activities.length ? Math.round(calories / activities.length) : 0,
        durationMinutes: activities.length ? Math.round(durationMinutes / activities.length) : 0
      },
      favoriteActivity: favorite,
      longestActivity: activities.sort((a, b) => b.durationMinutes - a.durationMinutes)[0] ?? null,
      byType
    };
  }

  private async data(userId: string, input: ActivityInput) {
    const userWeight = await prisma.weightEntry.findFirst({ where: { userId, weightKg: { not: null } }, orderBy: { date: "desc" } });
    const slug = slugifyActivityName(input.typeName);
    const activityType = await prisma.activityType.findFirst({ where: { OR: [{ slug }, { name: input.typeName }] } });
    const intensity = input.intensity ?? "MEDIUM";
    const calories = input.calories ?? await this.met.calculate({ typeName: input.typeName, intensity, durationMinutes: input.durationMinutes, weightKg: userWeight?.weightKg });
    return {
      userId,
      activityTypeId: activityType?.id,
      typeName: activityType?.name ?? input.typeName,
      date: startOfDay(input.date),
      startTime: input.startTime,
      endTime: input.endTime,
      durationMinutes: input.durationMinutes,
      intensity,
      distanceKm: input.distanceKm,
      averageSpeedKmh: input.averageSpeedKmh,
      averageHeartRate: input.averageHeartRate,
      maxHeartRate: input.maxHeartRate,
      calories,
      caloriesOverride: input.calories != null,
      notes: input.notes,
      steps: input.steps,
      elevationGainM: input.elevationGainM,
      powerWatts: input.powerWatts,
      cadence: input.cadence,
      pace: input.pace,
      source: input.source ?? "manual",
      externalId: input.externalId,
      muscleGroupsJson: input.muscleGroups ? JSON.stringify(input.muscleGroups) : undefined,
      exercisesCount: input.exercisesCount,
      setsCount: input.setsCount,
      repsCount: input.repsCount,
      trainingVolume: input.trainingVolume
    };
  }
}
