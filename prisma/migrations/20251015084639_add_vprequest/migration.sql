-- CreateTable
CREATE TABLE "VPRequest" (
    "id" TEXT NOT NULL,
    "holder_did" TEXT NOT NULL,
    "verifier_did" TEXT NOT NULL,
    "list_schema_id" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VPRequest_pkey" PRIMARY KEY ("id")
);
