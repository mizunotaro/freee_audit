-- CreateTable
CREATE TABLE "custom_kpis" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "company_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "formula" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "target_value" REAL,
    "is_visible" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "custom_kpis_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "fixed_assets" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "company_id" TEXT NOT NULL,
    "freee_asset_id" TEXT,
    "name" TEXT NOT NULL,
    "acquisition_date" DATETIME NOT NULL,
    "acquisition_cost" REAL NOT NULL,
    "salvage_value" REAL NOT NULL,
    "useful_life" INTEGER NOT NULL,
    "depreciation_method" TEXT NOT NULL,
    "accumulated_dep" REAL NOT NULL DEFAULT 0,
    "book_value" REAL NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "fixed_assets_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "tax_effect_accounting" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "company_id" TEXT NOT NULL,
    "fiscal_year" INTEGER NOT NULL,
    "deferred_tax_asset" REAL NOT NULL,
    "deferred_tax_liability" REAL NOT NULL,
    "net_deferred_tax" REAL NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "tax_effect_accounting_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "inventory_adjustments" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "company_id" TEXT NOT NULL,
    "fiscal_year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "opening_balance" REAL NOT NULL,
    "closing_balance" REAL NOT NULL,
    "adjustment" REAL NOT NULL,
    "journal_entry_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "inventory_adjustments_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "custom_kpis_company_id_idx" ON "custom_kpis"("company_id");

-- CreateIndex
CREATE INDEX "fixed_assets_company_id_idx" ON "fixed_assets"("company_id");

-- CreateIndex
CREATE INDEX "tax_effect_accounting_company_id_fiscal_year_idx" ON "tax_effect_accounting"("company_id", "fiscal_year");

-- CreateIndex
CREATE UNIQUE INDEX "tax_effect_accounting_company_id_fiscal_year_key" ON "tax_effect_accounting"("company_id", "fiscal_year");

-- CreateIndex
CREATE INDEX "inventory_adjustments_company_id_fiscal_year_idx" ON "inventory_adjustments"("company_id", "fiscal_year");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_adjustments_company_id_fiscal_year_month_key" ON "inventory_adjustments"("company_id", "fiscal_year", "month");
