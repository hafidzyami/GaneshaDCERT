-- AlterTable
ALTER TABLE "VCIssuanceRequest" ADD COLUMN     "vc_id" TEXT;

-- AlterTable
ALTER TABLE "VCRenewalRequest" ADD COLUMN     "vc_id" TEXT;

-- AlterTable
ALTER TABLE "VCRevokeRequest" ADD COLUMN     "vc_id" TEXT;

-- AlterTable
ALTER TABLE "VCUpdateRequest" ADD COLUMN     "vc_id" TEXT;
