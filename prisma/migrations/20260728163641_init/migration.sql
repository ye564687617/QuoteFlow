-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'SALESPERSON');

-- CreateEnum
CREATE TYPE "QuoteStatus" AS ENUM ('DRAFT', 'FINALIZED');

-- CreateEnum
CREATE TYPE "ExportStatus" AS ENUM ('PENDING', 'PROCESSING', 'READY', 'FAILED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "piPrefix" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'SALESPERSON',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanyProfile" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "legalName" TEXT NOT NULL,
    "plantAddress" TEXT,
    "telephone" TEXT,
    "fax" TEXT,
    "mobile" TEXT,
    "website" TEXT,
    "email" TEXT,
    "skype" TEXT,
    "logoPath" TEXT,
    "bankName" TEXT,
    "beneficiaryName" TEXT,
    "beneficiaryAccount" TEXT,
    "swiftCode" TEXT,
    "bankAddress" TEXT,
    "companyAddress" TEXT,
    "defaultDeliveryTerms" TEXT,
    "defaultPaymentTerms" TEXT,
    "defaultProductionTime" TEXT,
    "signatureName" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "pn" TEXT NOT NULL,
    "pnNormalized" TEXT NOT NULL,
    "name" TEXT,
    "description" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "category" TEXT,
    "attributes" JSONB,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductAsset" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "thumbnailPath" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "byteSize" INTEGER NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "internalLabel" TEXT NOT NULL,
    "recipientName" TEXT,
    "companyName" TEXT,
    "telephone" TEXT,
    "email" TEXT,
    "taxId" TEXT,
    "shipTo" TEXT,
    "notes" TEXT,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuoteSeries" (
    "id" TEXT NOT NULL,
    "basePiNumber" TEXT NOT NULL,
    "quoteDate" DATE NOT NULL,
    "dailySequence" INTEGER NOT NULL,
    "salespersonId" TEXT NOT NULL,
    "customerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuoteSeries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuoteRevision" (
    "id" TEXT NOT NULL,
    "seriesId" TEXT NOT NULL,
    "revisionNumber" INTEGER NOT NULL,
    "displayPiNumber" TEXT NOT NULL,
    "revisionDate" DATE NOT NULL,
    "status" "QuoteStatus" NOT NULL DEFAULT 'DRAFT',
    "recipientName" TEXT,
    "customerCompanyName" TEXT,
    "telephone" TEXT,
    "email" TEXT,
    "taxId" TEXT,
    "shipTo" TEXT,
    "companySnapshot" JSONB NOT NULL,
    "salespersonSnapshot" JSONB NOT NULL,
    "deliveryTerms" TEXT,
    "paymentTerms" TEXT,
    "productionTime" TEXT,
    "shippingNote" TEXT,
    "shippingFee" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "subtotal" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "exportedPath" TEXT,
    "exportedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuoteRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuoteItem" (
    "id" TEXT NOT NULL,
    "revisionId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "productId" TEXT,
    "pnSnapshot" TEXT NOT NULL,
    "nameSnapshot" TEXT,
    "descriptionSnapshot" TEXT NOT NULL,
    "unitSnapshot" TEXT NOT NULL,
    "imagePathSnapshot" TEXT,
    "quantity" DECIMAL(18,3) NOT NULL,
    "unitPrice" DECIMAL(18,4) NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,

    CONSTRAINT "QuoteItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExportJob" (
    "id" TEXT NOT NULL,
    "revisionId" TEXT NOT NULL,
    "status" "ExportStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "outputPath" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "ExportJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Product_pnNormalized_key" ON "Product"("pnNormalized");

-- CreateIndex
CREATE INDEX "Product_archivedAt_pnNormalized_idx" ON "Product"("archivedAt", "pnNormalized");

-- CreateIndex
CREATE UNIQUE INDEX "ProductAsset_storagePath_key" ON "ProductAsset"("storagePath");

-- CreateIndex
CREATE UNIQUE INDEX "ProductAsset_thumbnailPath_key" ON "ProductAsset"("thumbnailPath");

-- CreateIndex
CREATE INDEX "ProductAsset_productId_isPrimary_idx" ON "ProductAsset"("productId", "isPrimary");

-- CreateIndex
CREATE INDEX "Customer_ownerId_archivedAt_idx" ON "Customer"("ownerId", "archivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "QuoteSeries_basePiNumber_key" ON "QuoteSeries"("basePiNumber");

-- CreateIndex
CREATE INDEX "QuoteSeries_salespersonId_createdAt_idx" ON "QuoteSeries"("salespersonId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "QuoteSeries_salespersonId_quoteDate_dailySequence_key" ON "QuoteSeries"("salespersonId", "quoteDate", "dailySequence");

-- CreateIndex
CREATE UNIQUE INDEX "QuoteRevision_displayPiNumber_key" ON "QuoteRevision"("displayPiNumber");

-- CreateIndex
CREATE INDEX "QuoteRevision_status_createdAt_idx" ON "QuoteRevision"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "QuoteRevision_seriesId_revisionNumber_key" ON "QuoteRevision"("seriesId", "revisionNumber");

-- CreateIndex
CREATE UNIQUE INDEX "QuoteItem_revisionId_position_key" ON "QuoteItem"("revisionId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "ExportJob_revisionId_key" ON "ExportJob"("revisionId");

-- CreateIndex
CREATE INDEX "ExportJob_status_createdAt_idx" ON "ExportJob"("status", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_createdAt_idx" ON "AuditLog"("entityType", "entityId", "createdAt");

-- AddForeignKey
ALTER TABLE "ProductAsset" ADD CONSTRAINT "ProductAsset_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteSeries" ADD CONSTRAINT "QuoteSeries_salespersonId_fkey" FOREIGN KEY ("salespersonId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteSeries" ADD CONSTRAINT "QuoteSeries_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteRevision" ADD CONSTRAINT "QuoteRevision_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "QuoteSeries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteItem" ADD CONSTRAINT "QuoteItem_revisionId_fkey" FOREIGN KEY ("revisionId") REFERENCES "QuoteRevision"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteItem" ADD CONSTRAINT "QuoteItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExportJob" ADD CONSTRAINT "ExportJob_revisionId_fkey" FOREIGN KEY ("revisionId") REFERENCES "QuoteRevision"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
