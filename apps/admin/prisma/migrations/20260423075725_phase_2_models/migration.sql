-- CreateEnum
CREATE TYPE "UpsellTrigger" AS ENUM ('PRE_PURCHASE', 'POST_PURCHASE', 'ONE_TICK');

-- CreateEnum
CREATE TYPE "UpsellOffer" AS ENUM ('DISCOUNT_PERCENT', 'DISCOUNT_FLAT', 'FREE_GIFT', 'BUNDLE');

-- CreateTable
CREATE TABLE "Upsell" (
    "id" TEXT NOT NULL,
    "formId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "triggerType" "UpsellTrigger" NOT NULL DEFAULT 'PRE_PURCHASE',
    "triggerRule" JSONB NOT NULL DEFAULT '{}',
    "offerType" "UpsellOffer" NOT NULL DEFAULT 'DISCOUNT_PERCENT',
    "productId" TEXT,
    "variantId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "imageUrl" TEXT,
    "discountType" TEXT,
    "discountValue" DECIMAL(10,2),
    "position" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Upsell_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CallSession" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerId" TEXT,
    "direction" TEXT NOT NULL DEFAULT 'outbound',
    "status" TEXT NOT NULL DEFAULT 'queued',
    "scriptId" TEXT,
    "language" TEXT NOT NULL DEFAULT 'en',
    "recordingUrl" TEXT,
    "transcript" TEXT,
    "durationSec" INTEGER,
    "dispositionCapture" TEXT,
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CallSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AbandonedForm" (
    "id" TEXT NOT NULL,
    "formId" TEXT NOT NULL,
    "visitorId" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "partialData" JSONB NOT NULL DEFAULT '{}',
    "lastStep" TEXT,
    "recoveryToken" TEXT NOT NULL,
    "notifiedAt" TIMESTAMP(3),
    "convertedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AbandonedForm_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RiskEvaluation" (
    "id" TEXT NOT NULL,
    "orderId" TEXT,
    "submissionId" TEXT,
    "features" JSONB NOT NULL DEFAULT '{}',
    "score" INTEGER NOT NULL,
    "label" TEXT,
    "model" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RiskEvaluation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Upsell_formId_position_idx" ON "Upsell"("formId", "position");

-- CreateIndex
CREATE INDEX "CallSession_orderId_createdAt_idx" ON "CallSession"("orderId", "createdAt");

-- CreateIndex
CREATE INDEX "CallSession_status_idx" ON "CallSession"("status");

-- CreateIndex
CREATE UNIQUE INDEX "AbandonedForm_recoveryToken_key" ON "AbandonedForm"("recoveryToken");

-- CreateIndex
CREATE INDEX "AbandonedForm_formId_createdAt_idx" ON "AbandonedForm"("formId", "createdAt");

-- CreateIndex
CREATE INDEX "AbandonedForm_phone_idx" ON "AbandonedForm"("phone");

-- CreateIndex
CREATE INDEX "AbandonedForm_email_idx" ON "AbandonedForm"("email");

-- CreateIndex
CREATE INDEX "RiskEvaluation_orderId_idx" ON "RiskEvaluation"("orderId");

-- CreateIndex
CREATE INDEX "RiskEvaluation_submissionId_idx" ON "RiskEvaluation"("submissionId");

-- AddForeignKey
ALTER TABLE "Upsell" ADD CONSTRAINT "Upsell_formId_fkey" FOREIGN KEY ("formId") REFERENCES "Form"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallSession" ADD CONSTRAINT "CallSession_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AbandonedForm" ADD CONSTRAINT "AbandonedForm_formId_fkey" FOREIGN KEY ("formId") REFERENCES "Form"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiskEvaluation" ADD CONSTRAINT "RiskEvaluation_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
