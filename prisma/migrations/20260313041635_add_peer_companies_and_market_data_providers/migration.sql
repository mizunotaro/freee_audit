-- CreateTable
CREATE TABLE "peer_companies" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "company_id" TEXT NOT NULL,
    "ticker" TEXT,
    "name" TEXT NOT NULL,
    "name_en" TEXT,
    "exchange" TEXT,
    "industry" TEXT,
    "market_cap" REAL,
    "revenue" REAL,
    "employees" INTEGER,
    "per" REAL,
    "pbr" REAL,
    "ev_ebitda" REAL,
    "psr" REAL,
    "beta" REAL,
    "similarity_score" REAL,
    "data_source" TEXT NOT NULL DEFAULT 'manual',
    "source_url" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "peer_companies_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "market_data_providers" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "company_id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "encrypted_email" TEXT,
    "encrypted_password" TEXT,
    "encrypted_api_key" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 10,
    "last_sync_at" DATETIME,
    "last_error" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "market_data_providers_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "peer_companies_company_id_idx" ON "peer_companies"("company_id");

-- CreateIndex
CREATE INDEX "peer_companies_company_id_is_active_idx" ON "peer_companies"("company_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "peer_companies_company_id_ticker_key" ON "peer_companies"("company_id", "ticker");

-- CreateIndex
CREATE UNIQUE INDEX "market_data_providers_company_id_provider_key" ON "market_data_providers"("company_id", "provider");
