-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "password_hash" TEXT,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'VIEWER',
    "company_id" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "users_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires_at" DATETIME NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "companies" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "freee_company_id" TEXT,
    "name" TEXT NOT NULL,
    "fiscal_year_start" INTEGER NOT NULL DEFAULT 1,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "api_keys" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "company_id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "encrypted_key" TEXT NOT NULL,
    "encrypted_secret" TEXT,
    "metadata" TEXT,
    "expires_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "api_keys_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "journals" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "company_id" TEXT NOT NULL,
    "freee_journal_id" TEXT NOT NULL,
    "entry_date" DATETIME NOT NULL,
    "description" TEXT NOT NULL,
    "debit_account" TEXT NOT NULL,
    "credit_account" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "tax_amount" REAL NOT NULL DEFAULT 0,
    "tax_type" TEXT,
    "document_id" TEXT,
    "audit_status" TEXT NOT NULL DEFAULT 'PENDING',
    "synced_at" DATETIME NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "journals_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "journals_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "documents" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "company_id" TEXT NOT NULL,
    "freee_document_id" TEXT,
    "file_path" TEXT NOT NULL,
    "file_type" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "file_size" INTEGER NOT NULL,
    "upload_date" DATETIME NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "documents_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "audit_results" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "journal_id" TEXT NOT NULL,
    "document_id" TEXT,
    "status" TEXT NOT NULL,
    "issues" TEXT NOT NULL,
    "confidence_score" REAL,
    "raw_ai_response" TEXT,
    "analyzed_at" DATETIME NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "audit_results_journal_id_fkey" FOREIGN KEY ("journal_id") REFERENCES "journals" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "audit_results_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT,
    "action" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "resource_id" TEXT,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "details" TEXT,
    "result" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "budgets" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "company_id" TEXT NOT NULL,
    "fiscal_year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "department_id" TEXT,
    "account_code" TEXT NOT NULL,
    "account_name" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "note" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "budgets_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "cash_flows" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "company_id" TEXT NOT NULL,
    "fiscal_year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "category" TEXT NOT NULL,
    "item_name" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "note" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "cash_flows_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "exchange_rates" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "rate_date" DATETIME NOT NULL,
    "from_currency" TEXT NOT NULL,
    "to_currency" TEXT NOT NULL,
    "rate" REAL NOT NULL,
    "source" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "financial_kpis" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "company_id" TEXT NOT NULL,
    "fiscal_year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "kpi_name" TEXT NOT NULL,
    "value" REAL NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'JPY',
    "exchange_rate_id" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "financial_kpis_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "financial_kpis_exchange_rate_id_fkey" FOREIGN KEY ("exchange_rate_id") REFERENCES "exchange_rates" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "monthly_balances" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "company_id" TEXT NOT NULL,
    "fiscal_year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "account_code" TEXT NOT NULL,
    "account_name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "monthly_balances_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "freee_tokens" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "company_id" TEXT NOT NULL,
    "access_token" TEXT NOT NULL,
    "refresh_token" TEXT NOT NULL,
    "expires_at" DATETIME NOT NULL,
    "token_type" TEXT NOT NULL DEFAULT 'Bearer',
    "scope" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_token_key" ON "sessions"("token");

-- CreateIndex
CREATE INDEX "sessions_user_id_idx" ON "sessions"("user_id");

-- CreateIndex
CREATE INDEX "sessions_token_idx" ON "sessions"("token");

-- CreateIndex
CREATE UNIQUE INDEX "companies_freee_company_id_key" ON "companies"("freee_company_id");

-- CreateIndex
CREATE UNIQUE INDEX "api_keys_company_id_provider_key" ON "api_keys"("company_id", "provider");

-- CreateIndex
CREATE UNIQUE INDEX "journals_freee_journal_id_key" ON "journals"("freee_journal_id");

-- CreateIndex
CREATE UNIQUE INDEX "journals_document_id_key" ON "journals"("document_id");

-- CreateIndex
CREATE INDEX "journals_company_id_entry_date_idx" ON "journals"("company_id", "entry_date");

-- CreateIndex
CREATE INDEX "journals_company_id_audit_status_idx" ON "journals"("company_id", "audit_status");

-- CreateIndex
CREATE UNIQUE INDEX "documents_freee_document_id_key" ON "documents"("freee_document_id");

-- CreateIndex
CREATE INDEX "documents_company_id_idx" ON "documents"("company_id");

-- CreateIndex
CREATE INDEX "audit_results_journal_id_idx" ON "audit_results"("journal_id");

-- CreateIndex
CREATE INDEX "audit_results_status_idx" ON "audit_results"("status");

-- CreateIndex
CREATE INDEX "audit_logs_user_id_idx" ON "audit_logs"("user_id");

-- CreateIndex
CREATE INDEX "audit_logs_action_idx" ON "audit_logs"("action");

-- CreateIndex
CREATE INDEX "audit_logs_resource_idx" ON "audit_logs"("resource");

-- CreateIndex
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at");

-- CreateIndex
CREATE INDEX "budgets_company_id_fiscal_year_idx" ON "budgets"("company_id", "fiscal_year");

-- CreateIndex
CREATE UNIQUE INDEX "budgets_company_id_fiscal_year_month_department_id_account_code_key" ON "budgets"("company_id", "fiscal_year", "month", "department_id", "account_code");

-- CreateIndex
CREATE INDEX "cash_flows_company_id_fiscal_year_idx" ON "cash_flows"("company_id", "fiscal_year");

-- CreateIndex
CREATE UNIQUE INDEX "cash_flows_company_id_fiscal_year_month_category_item_name_key" ON "cash_flows"("company_id", "fiscal_year", "month", "category", "item_name");

-- CreateIndex
CREATE INDEX "exchange_rates_rate_date_idx" ON "exchange_rates"("rate_date");

-- CreateIndex
CREATE UNIQUE INDEX "exchange_rates_rate_date_from_currency_to_currency_key" ON "exchange_rates"("rate_date", "from_currency", "to_currency");

-- CreateIndex
CREATE INDEX "financial_kpis_company_id_fiscal_year_idx" ON "financial_kpis"("company_id", "fiscal_year");

-- CreateIndex
CREATE UNIQUE INDEX "financial_kpis_company_id_fiscal_year_month_kpi_name_currency_key" ON "financial_kpis"("company_id", "fiscal_year", "month", "kpi_name", "currency");

-- CreateIndex
CREATE INDEX "monthly_balances_company_id_fiscal_year_idx" ON "monthly_balances"("company_id", "fiscal_year");

-- CreateIndex
CREATE UNIQUE INDEX "monthly_balances_company_id_fiscal_year_month_account_code_key" ON "monthly_balances"("company_id", "fiscal_year", "month", "account_code");

-- CreateIndex
CREATE UNIQUE INDEX "freee_tokens_company_id_key" ON "freee_tokens"("company_id");
