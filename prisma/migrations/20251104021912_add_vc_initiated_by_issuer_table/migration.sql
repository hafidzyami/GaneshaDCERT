-- CreateTable
CREATE TABLE "VCinitiatedByIssuer" (
    "id" TEXT NOT NULL,
    "request_type" "RequestType" NOT NULL,
    "issuer_did" TEXT NOT NULL,
    "holder_did" TEXT NOT NULL,
    "encrypted_body" TEXT NOT NULL,
    "status" "VCResponseStatus" NOT NULL DEFAULT 'PENDING',
    "processing_at" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "VCinitiatedByIssuer_pkey" PRIMARY KEY ("id")
);
