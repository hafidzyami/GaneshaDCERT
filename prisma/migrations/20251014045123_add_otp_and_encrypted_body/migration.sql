/*
  Warnings:

  - You are about to drop the column `schema_id` on the `VCIssuanceRequest` table. All the data in the column will be lost.
  - You are about to drop the column `VCs_id` on the `VCRenewalRequest` table. All the data in the column will be lost.
  - You are about to drop the column `VC` on the `VCResponse` table. All the data in the column will be lost.
  - You are about to drop the column `schema_id` on the `VCResponse` table. All the data in the column will be lost.
  - You are about to drop the column `VCs_id` on the `VCRevokeRequest` table. All the data in the column will be lost.
  - You are about to drop the column `VCs_id` on the `VCUpdateRequest` table. All the data in the column will be lost.
  - Added the required column `encrypted_body` to the `VCIssuanceRequest` table without a default value. This is not possible if the table is not empty.
  - Added the required column `encrypted_body` to the `VCRenewalRequest` table without a default value. This is not possible if the table is not empty.
  - Added the required column `encrypted_body` to the `VCResponse` table without a default value. This is not possible if the table is not empty.
  - Added the required column `encrypted_body` to the `VCRevokeRequest` table without a default value. This is not possible if the table is not empty.
  - Added the required column `encrypted_body` to the `VCUpdateRequest` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "InstitutionRegistration" ADD COLUMN     "otp" TEXT;

-- AlterTable
ALTER TABLE "VCIssuanceRequest" DROP COLUMN "schema_id",
ADD COLUMN     "encrypted_body" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "VCRenewalRequest" DROP COLUMN "VCs_id",
ADD COLUMN     "encrypted_body" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "VCResponse" DROP COLUMN "VC",
DROP COLUMN "schema_id",
ADD COLUMN     "encrypted_body" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "VCRevokeRequest" DROP COLUMN "VCs_id",
ADD COLUMN     "encrypted_body" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "VCUpdateRequest" DROP COLUMN "VCs_id",
ADD COLUMN     "encrypted_body" TEXT NOT NULL;
