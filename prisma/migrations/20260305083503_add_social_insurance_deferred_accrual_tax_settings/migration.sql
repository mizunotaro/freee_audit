-- CreateTable
CREATE TABLE "social_insurance_schedules" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "company_id" TEXT NOT NULL,
    "insurance_type" TEXT NOT NULL,
    "task_name" TEXT NOT NULL,
    "due_date" DATETIME NOT NULL,
    "completed_date" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "social_insurance_schedules_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "social_insurance_payments" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "company_id" TEXT NOT NULL,
    "insurance_type" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "expected_amount" REAL NOT NULL,
    "actual_amount" REAL NOT NULL,
    "journal_entry_id" TEXT,
    "payment_date" DATETIME,
    "due_date" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "social_insurance_payments_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "prepaid_expenses" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "company_id" TEXT NOT NULL,
    "account_code" TEXT NOT NULL,
    "account_name" TEXT NOT NULL,
    "original_amount" REAL NOT NULL,
    "remaining_amount" REAL NOT NULL,
    "start_date" DATETIME NOT NULL,
    "end_date" DATETIME NOT NULL,
    "total_months" INTEGER NOT NULL,
    "monthly_amount" REAL NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "prepaid_expenses_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "prepaid_amortizations" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "prepaid_id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "expected_amount" REAL NOT NULL,
    "actual_amount" REAL NOT NULL,
    "journal_entry_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "prepaid_amortizations_prepaid_id_fkey" FOREIGN KEY ("prepaid_id") REFERENCES "prepaid_expenses" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "accrual_expenses" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "company_id" TEXT NOT NULL,
    "account_code" TEXT NOT NULL,
    "account_name" TEXT NOT NULL,
    "accrual_year" INTEGER NOT NULL,
    "accrual_month" INTEGER NOT NULL,
    "expected_amount" REAL NOT NULL,
    "actual_amount" REAL NOT NULL,
    "accrual_journal_id" TEXT,
    "payment_year" INTEGER,
    "payment_month" INTEGER,
    "payment_journal_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACCRUED',
    "notes" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "accrual_expenses_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "tax_settings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "company_id" TEXT NOT NULL,
    "withholding_special_rule" BOOLEAN NOT NULL DEFAULT false,
    "withholding_employee_count" INTEGER NOT NULL DEFAULT 0,
    "fiscal_year_start" INTEGER NOT NULL DEFAULT 1,
    "consumption_taxable" BOOLEAN NOT NULL DEFAULT true,
    "tax_filing_method" TEXT NOT NULL DEFAULT 'BLUE',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "tax_settings_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "social_insurance_schedules_company_id_due_date_idx" ON "social_insurance_schedules"("company_id", "due_date");

-- CreateIndex
CREATE INDEX "social_insurance_schedules_company_id_status_idx" ON "social_insurance_schedules"("company_id", "status");

-- CreateIndex
CREATE INDEX "social_insurance_payments_company_id_year_month_idx" ON "social_insurance_payments"("company_id", "year", "month");

-- CreateIndex
CREATE UNIQUE INDEX "social_insurance_payments_company_id_insurance_type_year_month_key" ON "social_insurance_payments"("company_id", "insurance_type", "year", "month");

-- CreateIndex
CREATE INDEX "prepaid_expenses_company_id_status_idx" ON "prepaid_expenses"("company_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "prepaid_amortizations_prepaid_id_year_month_key" ON "prepaid_amortizations"("prepaid_id", "year", "month");

-- CreateIndex
CREATE INDEX "accrual_expenses_company_id_accrual_year_accrual_month_idx" ON "accrual_expenses"("company_id", "accrual_year", "accrual_month");

-- CreateIndex
CREATE UNIQUE INDEX "tax_settings_company_id_key" ON "tax_settings"("company_id");
