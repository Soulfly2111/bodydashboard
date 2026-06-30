import { prisma } from "../../config/prisma.js";

export class FavoriteService {
  list(userId: string) {
    return prisma.favorite.findMany({ where: { userId }, orderBy: { createdAt: "desc" } });
  }

  async listFoods(userId: string) {
    const favorites = await this.list(userId);
    const foodIds = favorites.filter((favorite) => favorite.type === "FOOD").map((favorite) => favorite.targetId);
    if (!foodIds.length) return [];
    return prisma.food.findMany({
      where: { id: { in: foodIds }, OR: [{ userId }, { isPublic: true }] },
      orderBy: { name: "asc" }
    });
  }

  upsertFood(userId: string, foodId: string, label: string) {
    return prisma.favorite.upsert({
      where: { userId_type_targetId: { userId, type: "FOOD", targetId: foodId } },
      update: { label },
      create: { userId, type: "FOOD", targetId: foodId, label }
    });
  }

  delete(userId: string, id: string) {
    return prisma.favorite.deleteMany({ where: { id, userId } });
  }
}
