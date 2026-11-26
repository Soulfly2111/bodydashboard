import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import { prisma } from "../../config/prisma.js";
import { dbConflict, fail, membership } from "./recipes.js";

const name = z.string().trim().min(1).max(100);
const hash = (token: string) => createHash("sha256").update(token).digest("hex");

export async function requireHousehold(userId: string, managing = false) {
  const member = await membership(userId);
  if (!member) throw fail(404, "Kein Haushalt vorhanden.");
  if (managing && member.role !== "owner") throw fail(403, "Diese Aktion ist der Haushaltsverwaltung vorbehalten.");
  return member;
}

export async function householdView(userId: string) {
  const member = await membership(userId);
  if (!member) return null;
  const members = await prisma.mealHouseholdMember.findMany({
    where: { householdId: member.householdId }, select: { userId: true, role: true, user: { select: { name: true } } }
  });
  const invitations = member.role === "owner" ? await prisma.mealHouseholdInvite.findMany({
    where: { householdId: member.householdId, acceptedAt: null, expiresAt: { gt: new Date() } },
    select: { id: true, expiresAt: true }, orderBy: { expiresAt: "asc" }
  }) : [];
  return { ...member.household, role: member.role, members, invitations };
}

export async function createHousehold(userId: string, input: unknown) {
  const body = z.object({ name }).parse(input);
  if (await membership(userId)) throw fail(409, "Das Konto gehört bereits einem Haushalt an.");
  try {
    await prisma.mealHousehold.create({ data: { ...body, members: { create: { userId, role: "owner" } } } });
  } catch (error) {
    if (dbConflict(error)) throw fail(409, "Das Konto gehört bereits einem Haushalt an.");
    throw error;
  }
  return householdView(userId);
}

export async function inviteMember(userId: string) {
  const member = await requireHousehold(userId, true);
  const token = randomBytes(24).toString("base64url");
  const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);
  const invite = await prisma.mealHouseholdInvite.create({ data: { householdId: member.householdId, tokenHash: hash(token), expiresAt } });
  return { token, expiresAt, id: invite.id };
}

export async function revokeInvitation(userId: string, id: string) {
  const { householdId } = await requireHousehold(userId, true);
  await prisma.mealHouseholdInvite.deleteMany({ where: { id, householdId, acceptedAt: null } });
}

export async function acceptInvitation(userId: string, input: unknown) {
  const { token } = z.object({ token: z.string().trim().length(32) }).parse(input);
  try {
    await prisma.$transaction(async (tx) => {
      const invite = await tx.mealHouseholdInvite.findUnique({ where: { tokenHash: hash(token) } });
      const now = new Date();
      if (!invite || invite.acceptedAt || invite.expiresAt <= now) throw fail(404, "Einladung ungültig oder abgelaufen.");
      const updated = await tx.mealHouseholdInvite.updateMany({ where: { id: invite.id, acceptedAt: null, expiresAt: { gt: now } }, data: { acceptedAt: now } });
      if (!updated.count) throw fail(409, "Die Einladung wurde bereits verwendet.");
      await tx.mealHouseholdMember.create({ data: { userId, householdId: invite.householdId, role: "member" } });
    });
  } catch (error) {
    if (dbConflict(error)) throw fail(409, "Die Einladung wurde bereits verwendet oder das Konto gehört einem Haushalt an.");
    throw error;
  }
  return householdView(userId);
}

export async function removeMember(userId: string, targetId: string) {
  const { householdId } = await requireHousehold(userId, true);
  await prisma.$transaction(async (tx) => {
    const removed = await tx.mealHouseholdMember.deleteMany({ where: { householdId, userId: targetId, role: "member" } });
    if (removed.count) await tx.recipePlanning.updateMany({ where: { householdId, recipe: { userId: targetId } }, data: { householdId: null } });
  });
}

export async function updatePreferences(userId: string, input: unknown) {
  const member = await requireHousehold(userId, true);
  const data = z.object({
    name: name.optional(),
    servings: z.number().int().min(1).max(100).optional(),
    dishCount: z.number().int().min(1).max(14).optional(),
    preferences: z.string().trim().max(1500).optional(),
    budgetCents: z.number().int().min(0).max(1_000_000).nullable().optional(),
    autoPlan: z.boolean().optional()
  }).parse(input);
  const autoPlanSince = data.autoPlan === true && !member.household.autoPlan ? new Date() : data.autoPlan === false ? null : undefined;
  await prisma.mealHousehold.update({ where: { id: member.householdId }, data: { ...data, autoPlanSince } });
  return householdView(userId);
}
