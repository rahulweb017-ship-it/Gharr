-- CreateEnum
CREATE TYPE "EstimateMode" AS ENUM ('NEW_BUILD', 'RENOVATION');

-- CreateEnum
CREATE TYPE "EstimateScope" AS ENUM ('WHOLE_HOUSE', 'BATHROOM', 'KITCHEN', 'FLOORING', 'PAINTING');

-- CreateEnum
CREATE TYPE "QualityTier" AS ENUM ('BASIC', 'STANDARD', 'PREMIUM');

-- CreateEnum
CREATE TYPE "EstimateBucket" AS ENUM ('MATERIALS', 'LABOUR', 'OTHER');

-- CreateEnum
CREATE TYPE "QuantityBasis" AS ENUM ('BUILTUP_SQFT', 'FLOOR_SQFT', 'WALL_SQFT', 'PER_ROOM', 'PER_BATHROOM', 'PER_FLOOR', 'FIXED', 'PERCENT_OF_SUBTOTAL');



-- CreateTable
CREATE TABLE "EstimateRule" (
    "id" TEXT NOT NULL,
    "mode" "EstimateMode" NOT NULL,
    "scope" "EstimateScope" NOT NULL,
    "tier" "QualityTier" NOT NULL,
    "itemKey" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "bucket" "EstimateBucket" NOT NULL,
    "basis" "QuantityBasis" NOT NULL,
    "quantityPerBasis" DECIMAL(12,4) NOT NULL,
    "unit" "Unit",
    "wastagePercent" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EstimateRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EstimatePrice" (
    "id" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "tier" "QualityTier" NOT NULL,
    "itemKey" TEXT NOT NULL,
    "unitPricePaise" INTEGER NOT NULL,
    "productId" TEXT,
    "packCoverage" DECIMAL(12,3) NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EstimatePrice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Estimate" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "mode" "EstimateMode" NOT NULL,
    "scope" "EstimateScope" NOT NULL,
    "tier" "QualityTier" NOT NULL,
    "city" TEXT NOT NULL,
    "inputs" JSONB NOT NULL,
    "materialsPaise" INTEGER NOT NULL,
    "labourPaise" INTEGER NOT NULL,
    "otherPaise" INTEGER NOT NULL,
    "totalPaise" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Estimate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EstimateLine" (
    "id" TEXT NOT NULL,
    "estimateId" TEXT NOT NULL,
    "itemKey" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "bucket" "EstimateBucket" NOT NULL,
    "basis" "QuantityBasis" NOT NULL,
    "quantity" DECIMAL(14,3) NOT NULL,
    "unit" "Unit",
    "unitPricePaise" INTEGER NOT NULL,
    "amountPaise" INTEGER NOT NULL,
    "productId" TEXT,
    "packCoverage" DECIMAL(12,3) NOT NULL DEFAULT 1,
    "sortOrder" INTEGER NOT NULL,

    CONSTRAINT "EstimateLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EstimateRule_mode_scope_tier_isActive_idx" ON "EstimateRule"("mode", "scope", "tier", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "EstimateRule_mode_scope_tier_itemKey_key" ON "EstimateRule"("mode", "scope", "tier", "itemKey");

-- CreateIndex
CREATE INDEX "EstimatePrice_productId_idx" ON "EstimatePrice"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "EstimatePrice_city_tier_itemKey_key" ON "EstimatePrice"("city", "tier", "itemKey");

-- CreateIndex
CREATE INDEX "Estimate_userId_createdAt_idx" ON "Estimate"("userId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "EstimateLine_estimateId_sortOrder_idx" ON "EstimateLine"("estimateId", "sortOrder");

-- AddForeignKey
ALTER TABLE "EstimatePrice" ADD CONSTRAINT "EstimatePrice_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Estimate" ADD CONSTRAINT "Estimate_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EstimateLine" ADD CONSTRAINT "EstimateLine_estimateId_fkey" FOREIGN KEY ("estimateId") REFERENCES "Estimate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
