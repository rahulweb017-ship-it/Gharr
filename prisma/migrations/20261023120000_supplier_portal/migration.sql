-- Supplier self-service: products a supplier submits wait for admin review.
-- Existing products were all created by admins, so they default to APPROVED.

-- CreateEnum
CREATE TYPE "ProductReviewStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "reviewNote" TEXT,
ADD COLUMN     "reviewStatus" "ProductReviewStatus" NOT NULL DEFAULT 'APPROVED',
ADD COLUMN     "submittedByVendorId" TEXT;

-- CreateIndex
CREATE INDEX "Product_reviewStatus_createdAt_idx" ON "Product"("reviewStatus", "createdAt");

-- CreateIndex
CREATE INDEX "Product_submittedByVendorId_idx" ON "Product"("submittedByVendorId");

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_submittedByVendorId_fkey" FOREIGN KEY ("submittedByVendorId") REFERENCES "Vendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;
