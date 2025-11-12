/*
  Warnings:

  - You are about to drop the column `list_schema_id` on the `VPRequest` table. All the data in the column will be lost.
  - Added the required column `purpose` to the `VPRequest` table without a default value. This is not possible if the table is not empty.
  - Added the required column `requested_credentials` to the `VPRequest` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `VPRequest` table without a default value. This is not possible if the table is not empty.
  - Added the required column `verifier_name` to the `VPRequest` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "VPRequestStatus" AS ENUM ('PENDING', 'ACCEPT', 'DECLINE');

-- CreateEnum
CREATE TYPE "VPVerifyStatus" AS ENUM ('NOT_VERIFIED', 'VALID_VERIFICATION', 'INVALID_VERIFICATION');

-- AlterTable
ALTER TABLE "VPRequest" DROP COLUMN "list_schema_id",
ADD COLUMN     "purpose" TEXT NOT NULL,
ADD COLUMN     "requested_credentials" JSONB NOT NULL,
ADD COLUMN     "status" "VPRequestStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "verifier_name" TEXT NOT NULL,
ADD COLUMN     "verify_status" "VPVerifyStatus" NOT NULL DEFAULT 'NOT_VERIFIED',
ADD COLUMN     "vp_id" TEXT;

-- AlterTable
ALTER TABLE "VPSharing" ADD COLUMN     "hasClaim" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "verifier_did" TEXT;

-- CreateIndex
CREATE INDEX "VPRequest_holder_did_idx" ON "VPRequest"("holder_did");

-- CreateIndex
CREATE INDEX "VPRequest_verifier_did_idx" ON "VPRequest"("verifier_did");

-- CreateIndex
CREATE INDEX "VPRequest_status_idx" ON "VPRequest"("status");

-- CreateIndex
CREATE INDEX "VPRequest_vp_id_idx" ON "VPRequest"("vp_id");

-- CreateIndex
CREATE INDEX "VPSharing_verifier_did_idx" ON "VPSharing"("verifier_did");

-- CreateIndex
CREATE INDEX "VPSharing_hasClaim_idx" ON "VPSharing"("hasClaim");
