-- CreateTable
CREATE TABLE "PushToken" (
    "id" TEXT NOT NULL,
    "holder_did" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "deviceInfo" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PushToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PushToken_token_key" ON "PushToken"("token");

-- CreateIndex
CREATE INDEX "PushToken_holder_did_idx" ON "PushToken"("holder_did");

-- CreateIndex
CREATE INDEX "PushToken_token_idx" ON "PushToken"("token");
