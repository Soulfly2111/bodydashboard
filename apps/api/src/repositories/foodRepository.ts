import type { Prisma } from "@prisma/client";
import { prisma } from "../config/prisma.js";

export class FoodRepository {
  search(userId: string, query?: string, take = 25, skip = 0) {
    const where: Prisma.FoodWhereInput = {
      OR: [{ userId }, { isPublic: true }],
      ...(query
        ? {
            AND: [
              {
                OR: [
                  { name: { contains: query } },
                  { brand: { contains: query } },
                  { category: { contains: query } },
                  { barcode: { contains: query } }
                ]
              }
            ]
          }
        : {})
    };
    return prisma.food.findMany({ where, orderBy: [{ lastUsedAt: "desc" }, { name: "asc" }], take, skip });
  }

  create(data: Prisma.FoodCreateInput) {
    return prisma.food.create({ data });
  }

  async update(id: string, userId: string, data: Prisma.FoodUpdateInput) {
    await prisma.food.updateMany({ where: { id, userId }, data });
    return prisma.food.findFirstOrThrow({ where: { id, userId } });
  }

  delete(id: string, userId: string) {
    return prisma.food.deleteMany({ where: { id, userId } });
  }
}
