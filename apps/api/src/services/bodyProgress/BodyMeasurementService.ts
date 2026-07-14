import { startOfDay } from "date-fns";
import { prisma } from "../../config/prisma.js";
import { slugifyMeasurement } from "./bodyMeasurementCatalog.js";

export type BodyMeasurementInput = {
  date: Date;
  measurementType: string;
  value: number;
  unit?: string;
  source?: string;
  confidence?: number | null;
  confirmedByUser?: boolean;
  notes?: string | null;
};

export class BodyMeasurementService {
  list(userId: string) {
    return prisma.bodyMeasurement.findMany({ where: { userId }, orderBy: [{ date: "desc" }, { measurementType: "asc" }] });
  }

  get(userId: string, id: string) {
    return prisma.bodyMeasurement.findFirst({ where: { id, userId } });
  }

  async create(userId: string, input: BodyMeasurementInput) {
    const type = await prisma.bodyMeasurementType.findFirst({ where: { OR: [{ slug: slugifyMeasurement(input.measurementType) }, { name: input.measurementType }] } });
    return prisma.bodyMeasurement.create({
      data: {
        userId,
        date: startOfDay(input.date),
        measurementTypeId: type?.id,
        measurementType: type?.name ?? input.measurementType,
        value: input.value,
        unit: input.unit ?? type?.unit ?? "cm",
        source: input.source ?? "manual",
        confidence: input.confidence,
        confirmedByUser: input.confirmedByUser ?? true,
        notes: input.notes
      }
    });
  }

  update(userId: string, id: string, input: Partial<BodyMeasurementInput>) {
    return prisma.bodyMeasurement.updateMany({ where: { id, userId }, data: { ...input, date: input.date ? startOfDay(input.date) : undefined } });
  }

  delete(userId: string, id: string) {
    return prisma.bodyMeasurement.deleteMany({ where: { id, userId } });
  }
}
