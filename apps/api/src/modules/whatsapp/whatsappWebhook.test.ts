import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { extractMetaMessages, verifyMetaSignature } from "./whatsappWebhook.routes.js";

describe("WhatsApp webhook", () => {
  it("verifies Meta SHA-256 signatures", () => {
    const body = Buffer.from('{"object":"whatsapp_business_account"}');
    const secret = "test-app-secret";
    const signature = `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;
    expect(verifyMetaSignature(body, signature, secret)).toBe(true);
    expect(verifyMetaSignature(Buffer.concat([body, Buffer.from("x")]), signature, secret)).toBe(false);
    expect(verifyMetaSignature(body, "sha256=invalid", secret)).toBe(false);
  });

  it("extracts messages and ignores status-only events", () => {
    const payload = {
      entry: [{ changes: [{ value: { messages: [{ id: "wamid.1", from: "491701234567", type: "text" }] } }] }]
    };
    expect(extractMetaMessages(payload)).toHaveLength(1);
    expect(extractMetaMessages({ entry: [{ changes: [{ value: { statuses: [{ id: "status.1" }] } }] }] })).toEqual([]);
  });
});
