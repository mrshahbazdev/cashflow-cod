-- CreateTable
CREATE TABLE "CustomerSegment" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "filter" JSONB NOT NULL DEFAULT '{}',
    "memberCount" INTEGER NOT NULL DEFAULT 0,
    "lastBuiltAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerSegment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Broadcast" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "segmentId" TEXT,
    "channel" TEXT NOT NULL DEFAULT 'whatsapp',
    "name" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "scheduledAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "sent" INTEGER NOT NULL DEFAULT 0,
    "failed" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Broadcast_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailIntegration" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "credentials" JSONB NOT NULL DEFAULT '{}',
    "syncSubmissions" BOOLEAN NOT NULL DEFAULT true,
    "syncOrders" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastSyncAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailIntegration_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CustomerSegment_shopId_idx" ON "CustomerSegment"("shopId");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerSegment_shopId_name_key" ON "CustomerSegment"("shopId", "name");

-- CreateIndex
CREATE INDEX "Broadcast_shopId_status_idx" ON "Broadcast"("shopId", "status");

-- CreateIndex
CREATE INDEX "Broadcast_shopId_createdAt_idx" ON "Broadcast"("shopId", "createdAt");

-- CreateIndex
CREATE INDEX "EmailIntegration_shopId_idx" ON "EmailIntegration"("shopId");

-- CreateIndex
CREATE UNIQUE INDEX "EmailIntegration_shopId_provider_label_key" ON "EmailIntegration"("shopId", "provider", "label");

-- AddForeignKey
ALTER TABLE "CustomerSegment" ADD CONSTRAINT "CustomerSegment_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Broadcast" ADD CONSTRAINT "Broadcast_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Broadcast" ADD CONSTRAINT "Broadcast_segmentId_fkey" FOREIGN KEY ("segmentId") REFERENCES "CustomerSegment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailIntegration" ADD CONSTRAINT "EmailIntegration_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

