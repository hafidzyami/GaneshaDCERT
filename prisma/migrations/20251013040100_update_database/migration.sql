/*
  Warnings:

  - You are about to drop the `VcRequest` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "RequestType" AS ENUM ('ISSUANCE', 'RENEWAL', 'UPDATE', 'REVOKE');

-- DropTable
DROP TABLE "public"."VcRequest";

-- CreateTable
CREATE TABLE "VCIssuanceRequest" (
    "id" TEXT NOT NULL,
    "schema_id" TEXT NOT NULL,
    "issuer_did" TEXT NOT NULL,
    "holder_did" TEXT NOT NULL,
    "status" "RequestStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "VCIssuanceRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VCRenewalRequest" (
    "id" TEXT NOT NULL,
    "VCs_id" TEXT[],
    "issuer_did" TEXT NOT NULL,
    "holder_did" TEXT NOT NULL,
    "status" "RequestStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "VCRenewalRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VCUpdateRequest" (
    "id" TEXT NOT NULL,
    "VCs_id" TEXT[],
    "issuer_did" TEXT NOT NULL,
    "holder_did" TEXT NOT NULL,
    "status" "RequestStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "VCUpdateRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VCRevokeRequest" (
    "id" TEXT NOT NULL,
    "VCs_id" TEXT[],
    "issuer_did" TEXT NOT NULL,
    "holder_did" TEXT NOT NULL,
    "status" "RequestStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "VCRevokeRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VPSharing" (
    "id" TEXT NOT NULL,
    "holder_did" TEXT NOT NULL,
    "VP" JSONB NOT NULL,

    CONSTRAINT "VPSharing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VCResponse" (
    "id" TEXT NOT NULL,
    "request_id" TEXT NOT NULL,
    "request_type" "RequestType" NOT NULL,
    "schema_id" TEXT NOT NULL,
    "issuer_did" TEXT NOT NULL,
    "holder_did" TEXT NOT NULL,
    "VC" JSONB,

    CONSTRAINT "VCResponse_pkey" PRIMARY KEY ("id")
);
