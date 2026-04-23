-- AlterTable
ALTER TABLE "Shop" ADD COLUMN     "fraudGraphOptIn" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "merchantGroupId" TEXT;

-- CreateTable
CREATE TABLE "FraudGraphEntry" (
    "id" TEXT NOT NULL,
    "type" "BlocklistType" NOT NULL,
    "valueHash" TEXT NOT NULL,
    "reportCount" INTEGER NOT NULL DEFAULT 1,
    "offenderHits" INTEGER NOT NULL DEFAULT 0,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "severity" INTEGER NOT NULL DEFAULT 1,
    "notes" TEXT,

    CONSTRAINT "FraudGraphEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FraudGraphReport" (
    "id" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "disposition" TEXT,
    "linkedOrderId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FraudGraphReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RtoStat" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "dimension" TEXT NOT NULL,
    "dimensionKey" TEXT NOT NULL,
    "bucketDate" DATE NOT NULL,
    "totalOrders" INTEGER NOT NULL DEFAULT 0,
    "rtoOrders" INTEGER NOT NULL DEFAULT 0,
    "deliveredOrders" INTEGER NOT NULL DEFAULT 0,
    "confirmedOrders" INTEGER NOT NULL DEFAULT 0,
    "rtoRate" DECIMAL(6,4) NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RtoStat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MerchantGroup" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ownerEmail" TEXT,
    "plan" "Plan" NOT NULL DEFAULT 'PRO',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MerchantGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FormTemplate" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "region" TEXT,
    "language" TEXT NOT NULL DEFAULT 'en',
    "description" TEXT,
    "schema" JSONB NOT NULL,
    "previewUrl" TEXT,
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "installCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FormTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FraudGraphEntry_valueHash_idx" ON "FraudGraphEntry"("valueHash");

-- CreateIndex
CREATE INDEX "FraudGraphEntry_severity_idx" ON "FraudGraphEntry"("severity");

-- CreateIndex
CREATE UNIQUE INDEX "FraudGraphEntry_type_valueHash_key" ON "FraudGraphEntry"("type", "valueHash");

-- CreateIndex
CREATE INDEX "FraudGraphReport_entryId_idx" ON "FraudGraphReport"("entryId");

-- CreateIndex
CREATE INDEX "FraudGraphReport_shopId_createdAt_idx" ON "FraudGraphReport"("shopId", "createdAt");

-- CreateIndex
CREATE INDEX "RtoStat_shopId_dimension_bucketDate_idx" ON "RtoStat"("shopId", "dimension", "bucketDate");

-- CreateIndex
CREATE UNIQUE INDEX "RtoStat_shopId_dimension_dimensionKey_bucketDate_key" ON "RtoStat"("shopId", "dimension", "dimensionKey", "bucketDate");

-- CreateIndex
CREATE INDEX "MerchantGroup_ownerEmail_idx" ON "MerchantGroup"("ownerEmail");

-- CreateIndex
CREATE UNIQUE INDEX "FormTemplate_slug_key" ON "FormTemplate"("slug");

-- CreateIndex
CREATE INDEX "FormTemplate_category_idx" ON "FormTemplate"("category");

-- CreateIndex
CREATE INDEX "FormTemplate_region_idx" ON "FormTemplate"("region");

-- CreateIndex
CREATE INDEX "Shop_merchantGroupId_idx" ON "Shop"("merchantGroupId");

-- AddForeignKey
ALTER TABLE "Shop" ADD CONSTRAINT "Shop_merchantGroupId_fkey" FOREIGN KEY ("merchantGroupId") REFERENCES "MerchantGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FraudGraphReport" ADD CONSTRAINT "FraudGraphReport_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "FraudGraphEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FraudGraphReport" ADD CONSTRAINT "FraudGraphReport_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RtoStat" ADD CONSTRAINT "RtoStat_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

