-- CreateTable
CREATE TABLE "Symbol" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "isPopular" BOOLEAN NOT NULL DEFAULT false,
    "symbolType" TEXT,
    "provider" TEXT,
    "metadata" JSONB,
    "lastAction" TEXT,
    "lastScore" INTEGER,
    "lastPrice" DOUBLE PRECISION,
    "analyzedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Symbol_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AlertHistory" (
    "id" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "price" DOUBLE PRECISION,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dateSent" TEXT NOT NULL,

    CONSTRAINT "AlertHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cache" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "category" TEXT NOT NULL,
    "provider" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Cache_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnalysisError" (
    "id" TEXT NOT NULL,
    "symbolId" TEXT NOT NULL,
    "symbolName" TEXT NOT NULL,
    "errorType" TEXT NOT NULL,
    "errorMessage" TEXT NOT NULL,
    "metadata" JSONB,
    "count" INTEGER NOT NULL DEFAULT 1,
    "firstOccurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastOccurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnalysisError_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Symbol_name_key" ON "Symbol"("name");

-- CreateIndex
CREATE INDEX "Symbol_symbolType_idx" ON "Symbol"("symbolType");

-- CreateIndex
CREATE INDEX "Symbol_isPopular_idx" ON "Symbol"("isPopular");

-- CreateIndex
CREATE INDEX "Symbol_analyzedAt_idx" ON "Symbol"("analyzedAt");

-- CreateIndex
CREATE INDEX "AlertHistory_dateSent_idx" ON "AlertHistory"("dateSent");

-- CreateIndex
CREATE INDEX "AlertHistory_symbol_idx" ON "AlertHistory"("symbol");

-- CreateIndex
CREATE UNIQUE INDEX "AlertHistory_symbol_dateSent_key" ON "AlertHistory"("symbol", "dateSent");

-- CreateIndex
CREATE UNIQUE INDEX "Cache_key_key" ON "Cache"("key");

-- CreateIndex
CREATE INDEX "Cache_category_idx" ON "Cache"("category");

-- CreateIndex
CREATE INDEX "Cache_provider_idx" ON "Cache"("provider");

-- CreateIndex
CREATE INDEX "Cache_expiresAt_idx" ON "Cache"("expiresAt");

-- CreateIndex
CREATE INDEX "Cache_category_provider_idx" ON "Cache"("category", "provider");

-- CreateIndex
CREATE INDEX "AnalysisError_symbolName_idx" ON "AnalysisError"("symbolName");

-- CreateIndex
CREATE INDEX "AnalysisError_errorType_idx" ON "AnalysisError"("errorType");

-- CreateIndex
CREATE INDEX "AnalysisError_lastOccurredAt_idx" ON "AnalysisError"("lastOccurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "AnalysisError_symbolId_errorType_key" ON "AnalysisError"("symbolId", "errorType");
