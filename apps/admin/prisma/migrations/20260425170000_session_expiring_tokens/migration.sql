-- Add refresh-token columns required by @shopify/shopify-app-session-storage-prisma v9
-- (Shopify started enforcing expiring offline access tokens on 2026-04-01.)

ALTER TABLE "Session"
  ADD COLUMN "refreshToken" TEXT,
  ADD COLUMN "refreshTokenExpires" TIMESTAMP(3);
