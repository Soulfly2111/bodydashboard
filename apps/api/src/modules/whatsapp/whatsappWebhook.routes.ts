import { createHmac, timingSafeEqual } from "node:crypto";
import { Router, type Request } from "express";
import { env } from "../../config/env.js";
import { logger } from "../../config/logger.js";
import { prisma } from "../../config/prisma.js";
import { asyncHandler } from "../../utils/asyncHandler.js";

type MetaMessage = {
  id?: unknown;
  from?: unknown;
  timestamp?: unknown;
  type?: unknown;
  text?: { body?: unknown };
};

type RequestWithRawBody = Request & { rawBody?: Buffer };

export function verifyMetaSignature(body: Buffer, signatureHeader: string | undefined, appSecret: string) {
  if (!signatureHeader?.startsWith("sha256=") || !appSecret) return false;
  const providedHex = signatureHeader.slice(7);
  if (!/^[a-f0-9]{64}$/i.test(providedHex)) return false;
  const expected = createHmac("sha256", appSecret).update(body).digest();
  const provided = Buffer.from(providedHex, "hex");
  return expected.length === provided.length && timingSafeEqual(expected, provided);
}

export function extractMetaMessages(payload: unknown): MetaMessage[] {
  if (!payload || typeof payload !== "object") return [];
  const entries = (payload as { entry?: unknown }).entry;
  if (!Array.isArray(entries)) return [];
  const messages: MetaMessage[] = [];
  for (const entry of entries) {
    if (!entry || typeof entry !== "object") continue;
    const changes = (entry as { changes?: unknown }).changes;
    if (!Array.isArray(changes)) continue;
    for (const change of changes) {
      if (!change || typeof change !== "object") continue;
      const value = (change as { value?: unknown }).value;
      if (!value || typeof value !== "object") continue;
      const candidates = (value as { messages?: unknown }).messages;
      if (Array.isArray(candidates)) messages.push(...(candidates as MetaMessage[]));
    }
  }
  return messages;
}

function receivedAt(timestamp: unknown) {
  const seconds = typeof timestamp === "string" || typeof timestamp === "number"
    ? Number(timestamp)
    : Number.NaN;
  const value = Number.isFinite(seconds) ? new Date(seconds * 1000) : new Date();
  return Number.isNaN(value.getTime()) ? new Date() : value;
}

export const whatsappWebhookRouter = Router();

whatsappWebhookRouter.get("/", (req, res) => {
  if (!env.META_WHATSAPP_VERIFY_TOKEN) {
    res.status(503).json({ error: "WhatsApp webhook is not configured" });
    return;
  }
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];
  if (mode === "subscribe" && token === env.META_WHATSAPP_VERIFY_TOKEN && typeof challenge === "string") {
    res.status(200).type("text/plain").send(challenge);
    return;
  }
  res.status(403).json({ error: "Webhook verification failed" });
});

whatsappWebhookRouter.post("/", asyncHandler(async (req, res) => {
  if (!env.META_WHATSAPP_APP_SECRET) {
    res.status(503).json({ error: "WhatsApp webhook is not configured" });
    return;
  }
  const rawBody = (req as RequestWithRawBody).rawBody;
  const signature = req.header("x-hub-signature-256");
  if (!rawBody || !verifyMetaSignature(rawBody, signature, env.META_WHATSAPP_APP_SECRET)) {
    res.status(401).json({ error: "Invalid webhook signature" });
    return;
  }

  for (const message of extractMetaMessages(req.body)) {
    if (typeof message.id !== "string" || typeof message.from !== "string") continue;
    const messageType = typeof message.type === "string" ? message.type : "unknown";
    const textContent = messageType === "text" && typeof message.text?.body === "string"
      ? message.text.body
      : null;
    await prisma.whatsAppInboundMessage.upsert({
      where: { providerMessageId: message.id },
      create: {
        providerMessageId: message.id,
        externalUserId: message.from,
        messageType,
        textContent,
        rawPayloadJson: JSON.stringify(message),
        receivedAt: receivedAt(message.timestamp)
      },
      update: {}
    });
  }
  logger.info({ messageCount: extractMetaMessages(req.body).length }, "WhatsApp webhook accepted");
  res.status(200).json({ status: "accepted" });
}));
