-- CreateTable
CREATE TABLE "IssuerVCData" (
    "issuer_did" TEXT NOT NULL,
    "encrypted_body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IssuerVCData_pkey" PRIMARY KEY ("issuer_did","encrypted_body")
);

-- CreateIndex
CREATE INDEX "IssuerVCData_issuer_did_idx" ON "IssuerVCData"("issuer_did");
