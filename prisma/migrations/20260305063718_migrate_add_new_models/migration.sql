-- CreateTable
CREATE TABLE "settings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "theme" TEXT NOT NULL DEFAULT 'system',
    "ai_provider" TEXT NOT NULL DEFAULT 'openai',
    "openai_api_key" TEXT,
    "gemini_api_key" TEXT,
    "claude_api_key" TEXT,
    "azure_api_key" TEXT,
    "azure_endpoint" TEXT,
    "aws_access_key_id" TEXT,
    "aws_secret_access_key" TEXT,
    "aws_region" TEXT,
    "gcp_api_key" TEXT,
    "gcp_project_id" TEXT,
    "secret_source" TEXT NOT NULL DEFAULT 'local',
    "freee_client_id" TEXT,
    "freee_client_secret" TEXT,
    "freee_company_id" TEXT,
    "analysis_prompt" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "account_items" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "company_id" TEXT NOT NULL,
    "freee_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "shortcut" TEXT,
    "shortcut_num" TEXT,
    "category_id" INTEGER NOT NULL,
    "category_name" TEXT NOT NULL,
    "category_type" TEXT NOT NULL,
    "corresponding_income_id" INTEGER,
    "corresponding_income_name" TEXT,
    "corresponding_expense_id" INTEGER,
    "corresponding_expense_name" TEXT,
    "searchable" BOOLEAN NOT NULL DEFAULT true,
    "cumulable" BOOLEAN NOT NULL DEFAULT false,
    "balance" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "account_items_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "debts" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "company_id" TEXT NOT NULL,
    "freee_deal_id" TEXT,
    "partner_id" TEXT,
    "partner_name" TEXT,
    "description" TEXT,
    "amount" REAL NOT NULL,
    "due_date" DATETIME NOT NULL,
    "payment_date" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "category" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "debts_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "settings_user_id_key" ON "settings"("user_id");

-- CreateIndex
CREATE INDEX "account_items_company_id_category_type_idx" ON "account_items"("company_id", "category_type");

-- CreateIndex
CREATE UNIQUE INDEX "account_items_company_id_freee_id_key" ON "account_items"("company_id", "freee_id");

-- CreateIndex
CREATE INDEX "debts_company_id_due_date_idx" ON "debts"("company_id", "due_date");

-- CreateIndex
CREATE INDEX "debts_company_id_status_idx" ON "debts"("company_id", "status");
