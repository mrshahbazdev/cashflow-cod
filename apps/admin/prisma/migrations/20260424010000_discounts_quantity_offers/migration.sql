-- AlterEnum
ALTER TYPE "UpsellOffer" ADD VALUE 'SHIPPING_PROTECTION';
ALTER TYPE "UpsellOffer" ADD VALUE 'GIFT_WRAP';

-- CreateTable
CREATE TABLE "Discount" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "value" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "minSubtotal" DECIMAL(10,2),
    "appliesTo" TEXT NOT NULL DEFAULT 'all',
    "productIds" JSONB NOT NULL DEFAULT '[]',
    "startsAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "usageLimit" INTEGER,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "perCustomer" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Discount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiscountRedemption" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "discountId" TEXT NOT NULL,
    "submissionId" TEXT,
    "orderId" TEXT,
    "amount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "customerKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DiscountRedemption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuantityOffer" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "productId" TEXT,
    "variantId" TEXT,
    "ladder" JSONB NOT NULL DEFAULT '[]',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuantityOffer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Discount_shopId_code_key" ON "Discount"("shopId", "code");
CREATE INDEX "Discount_shopId_isActive_idx" ON "Discount"("shopId", "isActive");

-- CreateIndex
CREATE INDEX "DiscountRedemption_discountId_idx" ON "DiscountRedemption"("discountId");
CREATE INDEX "DiscountRedemption_shopId_createdAt_idx" ON "DiscountRedemption"("shopId", "createdAt");

-- CreateIndex
CREATE INDEX "QuantityOffer_shopId_isActive_idx" ON "QuantityOffer"("shopId", "isActive");
CREATE INDEX "QuantityOffer_productId_idx" ON "QuantityOffer"("productId");
CREATE INDEX "QuantityOffer_variantId_idx" ON "QuantityOffer"("variantId");

-- AddForeignKey
ALTER TABLE "Discount" ADD CONSTRAINT "Discount_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DiscountRedemption" ADD CONSTRAINT "DiscountRedemption_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DiscountRedemption" ADD CONSTRAINT "DiscountRedemption_discountId_fkey" FOREIGN KEY ("discountId") REFERENCES "Discount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "QuantityOffer" ADD CONSTRAINT "QuantityOffer_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
