-- AlterTable
ALTER TABLE "settings" ADD COLUMN "fiscal_year_end_month" INTEGER;
ALTER TABLE "settings" ADD COLUMN "tax_business_type" TEXT;

-- CreateTable
CREATE TABLE "tax_schedules" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "company_id" TEXT NOT NULL,
    "tax_type" TEXT NOT NULL,
    "fiscal_year" INTEGER NOT NULL,
    "due_date" DATETIME NOT NULL,
    "amount" REAL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "filed_date" DATETIME,
    "paid_date" DATETIME,
    "note" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "tax_schedules_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "tax_payments" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tax_schedule_id" TEXT NOT NULL,
    "payment_date" DATETIME NOT NULL,
    "amount" REAL NOT NULL,
    "payment_method" TEXT NOT NULL,
    "reference_number" TEXT,
    "note" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "tax_payments_tax_schedule_id_fkey" FOREIGN KEY ("tax_schedule_id") REFERENCES "tax_schedules" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "tax_schedules_company_id_fiscal_year_idx" ON "tax_schedules"("company_id", "fiscal_year");

-- CreateIndex
CREATE UNIQUE INDEX "tax_schedules_company_id_tax_type_fiscal_year_key" ON "tax_schedules"("company_id", "tax_type", "fiscal_year");

-- CreateIndex
CREATE INDEX "tax_payments_tax_schedule_id_idx" ON "tax_payments"("tax_schedule_id");
