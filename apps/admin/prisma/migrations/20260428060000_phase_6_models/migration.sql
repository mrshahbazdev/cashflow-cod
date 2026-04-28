-- CreateEnum
CREATE TYPE "ReturnResolution" AS ENUM ('REFUND', 'REPLACE', 'STORE_CREDIT');

-- CreateEnum
CREATE TYPE "ReturnStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'PICKED_UP', 'RECEIVED', 'RESOLVED');

-- AlterTable
ALTER TABLE "MerchantGroup" ADD COLUMN     "agencyTenantId" TEXT;

-- CreateTable
CREATE TABLE "FxRate" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "base" TEXT NOT NULL,
    "target" TEXT NOT NULL,
    "rate" DECIMAL(20,10) NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FxRate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReturnRequest" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "trackingCode" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "resolution" "ReturnResolution" NOT NULL DEFAULT 'REFUND',
    "status" "ReturnStatus" NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "refundAmount" DECIMAL(14,2),
    "replacementOrderId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReturnRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApiKey" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "secretHash" TEXT NOT NULL,
    "scopes" JSONB NOT NULL DEFAULT '[]',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "ApiKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApiKeyUsage" (
    "id" TEXT NOT NULL,
    "apiKeyId" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "status" INTEGER NOT NULL,
    "ip" TEXT,
    "durationMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApiKeyUsage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgencyTenant" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contactEmail" TEXT,
    "customDomain" TEXT,
    "logoUrl" TEXT,
    "primaryColor" TEXT DEFAULT '#10b981',
    "accentColor" TEXT DEFAULT '#0f172a',
    "supportUrl" TEXT,
    "hidePoweredBy" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgencyTenant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FxRate_shopId_fetchedAt_idx" ON "FxRate"("shopId", "fetchedAt");

-- CreateIndex
CREATE UNIQUE INDEX "FxRate_shopId_base_target_key" ON "FxRate"("shopId", "base", "target");

-- CreateIndex
CREATE UNIQUE INDEX "ReturnRequest_trackingCode_key" ON "ReturnRequest"("trackingCode");

-- CreateIndex
CREATE INDEX "ReturnRequest_shopId_createdAt_idx" ON "ReturnRequest"("shopId", "createdAt");

-- CreateIndex
CREATE INDEX "ReturnRequest_status_idx" ON "ReturnRequest"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ApiKey_prefix_key" ON "ApiKey"("prefix");

-- CreateIndex
CREATE INDEX "ApiKey_shopId_isActive_idx" ON "ApiKey"("shopId", "isActive");

-- CreateIndex
CREATE INDEX "ApiKeyUsage_apiKeyId_createdAt_idx" ON "ApiKeyUsage"("apiKeyId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AgencyTenant_slug_key" ON "AgencyTenant"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "AgencyTenant_customDomain_key" ON "AgencyTenant"("customDomain");

-- CreateIndex
CREATE INDEX "MerchantGroup_agencyTenantId_idx" ON "MerchantGroup"("agencyTenantId");

-- AddForeignKey
ALTER TABLE "MerchantGroup" ADD CONSTRAINT "MerchantGroup_agencyTenantId_fkey" FOREIGN KEY ("agencyTenantId") REFERENCES "AgencyTenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FxRate" ADD CONSTRAINT "FxRate_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReturnRequest" ADD CONSTRAINT "ReturnRequest_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReturnRequest" ADD CONSTRAINT "ReturnRequest_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiKey" ADD CONSTRAINT "ApiKey_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiKeyUsage" ADD CONSTRAINT "ApiKeyUsage_apiKeyId_fkey" FOREIGN KEY ("apiKeyId") REFERENCES "ApiKey"("id") ON DELETE CASCADE ON UPDATE CASCADE;

