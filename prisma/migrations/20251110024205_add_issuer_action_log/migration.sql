-- CreateTable
CREATE TABLE "IssuerActionLog" (
    "id" TEXT NOT NULL,
    "action_type" "RequestType" NOT NULL,
    "issuer_did" TEXT NOT NULL,
    "holder_did" TEXT,
    "vc_id" TEXT NOT NULL,
    "new_vc_id" TEXT,
    "transaction_hash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IssuerActionLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "IssuerActionLog_issuer_did_idx" ON "IssuerActionLog"("issuer_did");

-- CreateIndex
CREATE INDEX "IssuerActionLog_holder_did_idx" ON "IssuerActionLog"("holder_did");

-- CreateIndex
CREATE INDEX "IssuerActionLog_action_type_idx" ON "IssuerActionLog"("action_type");
