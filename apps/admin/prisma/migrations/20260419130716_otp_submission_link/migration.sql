/*
  Warnings:

  - Added the required column `destination` to the `OtpToken` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "OtpToken" ADD COLUMN     "destination" TEXT NOT NULL,
ADD COLUMN     "submissionId" TEXT,
ALTER COLUMN "orderId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "OtpToken_submissionId_idx" ON "OtpToken"("submissionId");

-- AddForeignKey
ALTER TABLE "OtpToken" ADD CONSTRAINT "OtpToken_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "Submission"("id") ON DELETE CASCADE ON UPDATE CASCADE;
