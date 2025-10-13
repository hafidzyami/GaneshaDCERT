/*
  Warnings:

  - The required column `order_id` was added to the `VCResponse` table with a prisma-level default value. This is not possible if the table is not empty. Please add this column as optional, then populate it before making it required.

*/
-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('UNPAID', 'PAID', 'CANCELED');

-- AlterTable
ALTER TABLE "VCResponse" ADD COLUMN     "order_id" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "payment_method_id" TEXT NOT NULL,
    "payment_payload" JSONB NOT NULL,
    "VCs_id" TEXT[],
    "schemas_id" TEXT[],
    "request_type" "RequestType" NOT NULL,
    "holder_did" TEXT NOT NULL,
    "issuer_did" TEXT NOT NULL,
    "payment_status" "PaymentStatus" NOT NULL DEFAULT 'UNPAID',
    "product_fee" DECIMAL(65,30) NOT NULL,
    "service_fee" DECIMAL(65,30) NOT NULL,
    "total_fee" DECIMAL(65,30) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentMethod" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "group" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "bank_code" TEXT NOT NULL,
    "sender_bank_type" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "deadline" INTEGER NOT NULL,
    "icon" TEXT NOT NULL,
    "availability" BOOLEAN NOT NULL DEFAULT false,
    "fee_fixed" DECIMAL(65,30) NOT NULL,
    "fee_percent" DECIMAL(65,30) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "PaymentMethod_pkey" PRIMARY KEY ("id")
);
