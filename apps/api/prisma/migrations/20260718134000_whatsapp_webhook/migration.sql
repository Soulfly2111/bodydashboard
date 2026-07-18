CREATE TABLE "WhatsAppInboundMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "providerMessageId" TEXT NOT NULL,
    "externalUserId" TEXT NOT NULL,
    "messageType" TEXT NOT NULL,
    "textContent" TEXT,
    "rawPayloadJson" TEXT NOT NULL,
    "processingStatus" TEXT NOT NULL DEFAULT 'RECEIVED',
    "receivedAt" DATETIME NOT NULL,
    "processedAt" DATETIME,
    "processingError" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE UNIQUE INDEX "WhatsAppInboundMessage_providerMessageId_key"
ON "WhatsAppInboundMessage"("providerMessageId");

CREATE INDEX "WhatsAppInboundMessage_externalUserId_idx"
ON "WhatsAppInboundMessage"("externalUserId");

CREATE INDEX "WhatsAppInboundMessage_processingStatus_idx"
ON "WhatsAppInboundMessage"("processingStatus");

CREATE INDEX "WhatsAppInboundMessage_receivedAt_idx"
ON "WhatsAppInboundMessage"("receivedAt");
