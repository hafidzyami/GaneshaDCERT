/*
  Warnings:

  - The primary key for the `VCSchema` table will be changed. If it partially fails, the table could be left without primary key constraint.

*/
-- AlterTable
ALTER TABLE "VCSchema" DROP CONSTRAINT "VCSchema_pkey",
ADD CONSTRAINT "VCSchema_pkey" PRIMARY KEY ("id", "version");

-- CreateIndex
CREATE INDEX "VCSchema_id_idx" ON "VCSchema"("id");

-- CreateIndex
CREATE INDEX "VCSchema_version_idx" ON "VCSchema"("version");

-- CreateIndex
CREATE INDEX "VCSchema_isActive_idx" ON "VCSchema"("isActive");
