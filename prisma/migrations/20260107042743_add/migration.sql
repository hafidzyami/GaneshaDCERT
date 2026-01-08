-- AlterTable
ALTER TABLE "IssuerVCData" ADD COLUMN     "holder_did" TEXT,
ADD COLUMN     "vc_id" TEXT;

-- AlterTable
ALTER TABLE "VCinitiatedByIssuer" ADD COLUMN     "vc_id" TEXT;

-- CreateTable
CREATE TABLE "VCSchemaPrice" (
    "schemaId" TEXT NOT NULL,
    "price" DECIMAL(65,30) NOT NULL,
    "currency" TEXT NOT NULL,

    CONSTRAINT "VCSchemaPrice_pkey" PRIMARY KEY ("schemaId")
);

-- CreateIndex
CREATE INDEX "IssuerVCData_holder_did_idx" ON "IssuerVCData"("holder_did");

-- CreateIndex
CREATE INDEX "IssuerVCData_vc_id_idx" ON "IssuerVCData"("vc_id");

-- CreateIndex
CREATE INDEX "VCinitiatedByIssuer_vc_id_idx" ON "VCinitiatedByIssuer"("vc_id");
