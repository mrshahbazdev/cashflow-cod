-- AlterTable
ALTER TABLE "Submission" ADD COLUMN     "country" TEXT,
ADD COLUMN     "email" TEXT,
ADD COLUMN     "fields" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "ipAddress" TEXT,
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "requiresOtp" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "riskReasons" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "riskScore" INTEGER,
ADD COLUMN     "userAgent" TEXT;
