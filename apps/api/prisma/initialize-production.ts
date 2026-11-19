import "dotenv/config";
import { prisma } from "../src/config/prisma.js";
import { initializeSupplements } from "../src/services/supplements/supplements.js";

// Deliberately separate from demo seed: never rewrite users or their health history.
try {
  const users = await prisma.user.findMany({ select: { id: true } });
  for (const user of users) await initializeSupplements(user.id);
  console.log(`Supplement defaults ensured for ${users.length} users.`);
} finally {
  await prisma.$disconnect();
}
