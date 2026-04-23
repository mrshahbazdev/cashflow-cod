-- AlterTable
ALTER TABLE "ABTest" ADD COLUMN     "name" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'running';

-- AlterTable
ALTER TABLE "Form" ADD COLUMN     "direction" TEXT NOT NULL DEFAULT 'ltr',
ADD COLUMN     "translations" JSONB NOT NULL DEFAULT '{}';

-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "body" TEXT,
ADD COLUMN     "fromAddress" TEXT,
ADD COLUMN     "threadId" TEXT,
ADD COLUMN     "toAddress" TEXT;

-- AlterTable
ALTER TABLE "Shop" ADD COLUMN     "defaultLanguage" TEXT NOT NULL DEFAULT 'en',
ADD COLUMN     "enabledLanguages" JSONB NOT NULL DEFAULT '["en"]';

-- CreateTable
CREATE TABLE "ABTestExposure" (
    "id" TEXT NOT NULL,
    "abTestId" TEXT NOT NULL,
    "variantKey" TEXT NOT NULL,
    "bucketDate" DATE NOT NULL,
    "views" INTEGER NOT NULL DEFAULT 0,
    "conversions" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ABTestExposure_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InboxThread" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'whatsapp',
    "customerPhone" TEXT,
    "customerEmail" TEXT,
    "customerName" TEXT,
    "orderId" TEXT,
    "lastMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastDirection" TEXT,
    "lastPreview" TEXT,
    "unreadCount" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'open',
    "assignedAgentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InboxThread_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentProviderAccount" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "credentials" JSONB NOT NULL DEFAULT '{}',
    "mode" TEXT NOT NULL DEFAULT 'mock',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentProviderAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentAdvance" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'PKR',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "providerRef" TEXT,
    "checkoutUrl" TEXT,
    "paidAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentAdvance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LandingPage" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "formId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "headline" TEXT,
    "subheadline" TEXT,
    "heroImage" TEXT,
    "bodyHtml" TEXT,
    "theme" JSONB NOT NULL DEFAULT '{}',
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "views" INTEGER NOT NULL DEFAULT 0,
    "conversions" INTEGER NOT NULL DEFAULT 0,
    "utmDefault" JSONB NOT NULL DEFAULT '{}',
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LandingPage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GdprExport" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "customerId" TEXT,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "status" TEXT NOT NULL DEFAULT 'received',
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GdprExport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ABTestExposure_abTestId_bucketDate_idx" ON "ABTestExposure"("abTestId", "bucketDate");

-- CreateIndex
CREATE UNIQUE INDEX "ABTestExposure_abTestId_variantKey_bucketDate_key" ON "ABTestExposure"("abTestId", "variantKey", "bucketDate");

-- CreateIndex
CREATE UNIQUE INDEX "InboxThread_orderId_key" ON "InboxThread"("orderId");

-- CreateIndex
CREATE INDEX "InboxThread_shopId_lastMessageAt_idx" ON "InboxThread"("shopId", "lastMessageAt");

-- CreateIndex
CREATE INDEX "InboxThread_shopId_status_idx" ON "InboxThread"("shopId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "InboxThread_shopId_channel_customerPhone_key" ON "InboxThread"("shopId", "channel", "customerPhone");

-- CreateIndex
CREATE INDEX "PaymentProviderAccount_shopId_idx" ON "PaymentProviderAccount"("shopId");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentProviderAccount_shopId_provider_label_key" ON "PaymentProviderAccount"("shopId", "provider", "label");

-- CreateIndex
CREATE INDEX "PaymentAdvance_orderId_idx" ON "PaymentAdvance"("orderId");

-- CreateIndex
CREATE INDEX "PaymentAdvance_status_idx" ON "PaymentAdvance"("status");

-- CreateIndex
CREATE UNIQUE INDEX "LandingPage_slug_key" ON "LandingPage"("slug");

-- CreateIndex
CREATE INDEX "LandingPage_shopId_idx" ON "LandingPage"("shopId");

-- CreateIndex
CREATE INDEX "LandingPage_formId_idx" ON "LandingPage"("formId");

-- CreateIndex
CREATE INDEX "GdprExport_shopId_kind_idx" ON "GdprExport"("shopId", "kind");

-- CreateIndex
CREATE INDEX "GdprExport_status_idx" ON "GdprExport"("status");

-- CreateIndex
CREATE INDEX "Message_threadId_createdAt_idx" ON "Message"("threadId", "createdAt");

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "InboxThread"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ABTestExposure" ADD CONSTRAINT "ABTestExposure_abTestId_fkey" FOREIGN KEY ("abTestId") REFERENCES "ABTest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InboxThread" ADD CONSTRAINT "InboxThread_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InboxThread" ADD CONSTRAINT "InboxThread_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentProviderAccount" ADD CONSTRAINT "PaymentProviderAccount_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentAdvance" ADD CONSTRAINT "PaymentAdvance_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentAdvance" ADD CONSTRAINT "PaymentAdvance_providerAccountId_fkey" FOREIGN KEY ("providerAccountId") REFERENCES "PaymentProviderAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LandingPage" ADD CONSTRAINT "LandingPage_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LandingPage" ADD CONSTRAINT "LandingPage_formId_fkey" FOREIGN KEY ("formId") REFERENCES "Form"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GdprExport" ADD CONSTRAINT "GdprExport_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

