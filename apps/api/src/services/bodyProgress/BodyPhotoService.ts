import { startOfDay } from "date-fns";
import { prisma } from "../../config/prisma.js";
import { ImageStorageService } from "./ImageStorageService.js";

export type BodyPhotoInput = {
  date: Date;
  viewType: string;
  imageUrl: string;
  thumbnailUrl?: string | null;
  notes?: string | null;
  linkedWeightEntryId?: string | null;
  trainingPhase?: string | null;
  dietPhase?: string | null;
  referenceObject?: string | null;
};

export class BodyPhotoService {
  private storage = new ImageStorageService();

  list(userId: string) {
    return prisma.bodyPhoto.findMany({ where: { userId }, include: { analyses: { orderBy: { createdAt: "desc" }, take: 1 } }, orderBy: { date: "desc" } });
  }

  get(userId: string, id: string) {
    return prisma.bodyPhoto.findFirst({ where: { id, userId }, include: { analyses: { orderBy: { createdAt: "desc" } } } });
  }

  create(userId: string, input: BodyPhotoInput) {
    const image = this.storage.normalize(input);
    return prisma.bodyPhoto.create({ data: { ...input, ...image, userId, date: startOfDay(input.date) } });
  }

  update(userId: string, id: string, input: Partial<BodyPhotoInput>) {
    const image = input.imageUrl ? this.storage.normalize({ imageUrl: input.imageUrl, thumbnailUrl: input.thumbnailUrl }) : {};
    return prisma.bodyPhoto.updateMany({ where: { id, userId }, data: { ...input, ...image, date: input.date ? startOfDay(input.date) : undefined } });
  }

  delete(userId: string, id: string) {
    return prisma.bodyPhoto.deleteMany({ where: { id, userId } });
  }
}
