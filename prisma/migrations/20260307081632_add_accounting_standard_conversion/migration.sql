-- AlterTable
ALTER TABLE "settings" ADD COLUMN "ai_data_residency" TEXT;
ALTER TABLE "settings" ADD COLUMN "ai_model" TEXT;
ALTER TABLE "settings" ADD COLUMN "ai_zdr_enabled" BOOLEAN DEFAULT true;
ALTER TABLE "settings" ADD COLUMN "openrouter_api_key" TEXT;

-- CreateTable
CREATE TABLE "box_tokens" (
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

-- CreateTable
CREATE TABLE "investor_invitations" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "invited_by" TEXT NOT NULL,
    "invited_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "user_id" TEXT,
    "accepted_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "investor_invitations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "accounting_standards" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "name_en" TEXT NOT NULL,
    "description" TEXT,
    "country_code" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "chart_of_accounts" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "company_id" TEXT NOT NULL,
    "standard_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "chart_of_accounts_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "chart_of_accounts_standard_id_fkey" FOREIGN KEY ("standard_id") REFERENCES "accounting_standards" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "chart_of_account_items" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "coa_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "name_en" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "subcategory" TEXT,
    "normal_balance" TEXT NOT NULL,
    "parent_id" TEXT,
    "level" INTEGER NOT NULL DEFAULT 0,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_convertible" BOOLEAN NOT NULL DEFAULT true,
    "metadata" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "chart_of_account_items_coa_id_fkey" FOREIGN KEY ("coa_id") REFERENCES "chart_of_accounts" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "chart_of_account_items_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "chart_of_account_items" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "account_mappings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "company_id" TEXT NOT NULL,
    "source_coa_id" TEXT NOT NULL,
    "source_item_id" TEXT NOT NULL,
    "target_coa_id" TEXT NOT NULL,
    "target_item_id" TEXT NOT NULL,
    "mapping_type" TEXT NOT NULL,
    "conversion_rule" TEXT,
    "percentage" REAL,
    "confidence" REAL NOT NULL DEFAULT 1.0,
    "is_manual_review" BOOLEAN NOT NULL DEFAULT false,
    "is_approved" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "created_by" TEXT,
    "approved_by" TEXT,
    "approved_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "account_mappings_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "account_mappings_source_coa_id_fkey" FOREIGN KEY ("source_coa_id") REFERENCES "chart_of_accounts" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "account_mappings_source_item_id_fkey" FOREIGN KEY ("source_item_id") REFERENCES "chart_of_account_items" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "account_mappings_target_coa_id_fkey" FOREIGN KEY ("target_coa_id") REFERENCES "chart_of_accounts" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "account_mappings_target_item_id_fkey" FOREIGN KEY ("target_item_id") REFERENCES "chart_of_account_items" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "conversion_projects" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "company_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "source_standard_id" TEXT NOT NULL,
    "target_standard_id" TEXT NOT NULL,
    "target_coa_id" TEXT NOT NULL,
    "period_start" DATETIME NOT NULL,
    "period_end" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "progress" REAL NOT NULL DEFAULT 0,
    "settings" TEXT NOT NULL,
    "statistics" TEXT,
    "created_by" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    "completed_at" DATETIME,
    CONSTRAINT "conversion_projects_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "conversion_projects_source_standard_id_fkey" FOREIGN KEY ("source_standard_id") REFERENCES "accounting_standards" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "conversion_projects_target_standard_id_fkey" FOREIGN KEY ("target_standard_id") REFERENCES "accounting_standards" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "conversion_projects_target_coa_id_fkey" FOREIGN KEY ("target_coa_id") REFERENCES "chart_of_accounts" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "conversion_results" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "project_id" TEXT NOT NULL,
    "journal_conversions" TEXT,
    "balance_sheet" TEXT,
    "profit_loss" TEXT,
    "cash_flow" TEXT,
    "disclosures" TEXT,
    "ai_analysis" TEXT,
    "conversion_date" DATETIME NOT NULL,
    "conversion_duration_ms" INTEGER NOT NULL,
    "warnings" TEXT,
    "errors" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "conversion_results_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "conversion_projects" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "adjusting_entries" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "project_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "description_en" TEXT,
    "lines" TEXT NOT NULL,
    "ifrs_reference" TEXT,
    "usgaap_reference" TEXT,
    "ai_suggested" BOOLEAN NOT NULL DEFAULT false,
    "is_approved" BOOLEAN NOT NULL DEFAULT false,
    "approved_by" TEXT,
    "approved_at" DATETIME,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "adjusting_entries_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "conversion_projects" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "conversion_audit_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "project_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT,
    "old_value" TEXT,
    "new_value" TEXT,
    "user_id" TEXT,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "notes" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "conversion_audit_logs_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "conversion_projects" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "conversion_exports" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "result_id" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "config" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "file_path" TEXT,
    "file_size" INTEGER NOT NULL,
    "generated_by" TEXT,
    "generated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" DATETIME,
    CONSTRAINT "conversion_exports_result_id_fkey" FOREIGN KEY ("result_id") REFERENCES "conversion_results" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "box_tokens_company_id_key" ON "box_tokens"("company_id");

-- CreateIndex
CREATE UNIQUE INDEX "investor_invitations_token_key" ON "investor_invitations"("token");

-- CreateIndex
CREATE INDEX "investor_invitations_token_idx" ON "investor_invitations"("token");

-- CreateIndex
CREATE INDEX "investor_invitations_email_idx" ON "investor_invitations"("email");

-- CreateIndex
CREATE INDEX "investor_invitations_status_idx" ON "investor_invitations"("status");

-- CreateIndex
CREATE UNIQUE INDEX "accounting_standards_code_key" ON "accounting_standards"("code");

-- CreateIndex
CREATE INDEX "chart_of_accounts_company_id_is_active_idx" ON "chart_of_accounts"("company_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "chart_of_accounts_company_id_standard_id_version_key" ON "chart_of_accounts"("company_id", "standard_id", "version");

-- CreateIndex
CREATE INDEX "chart_of_account_items_coa_id_category_idx" ON "chart_of_account_items"("coa_id", "category");

-- CreateIndex
CREATE UNIQUE INDEX "chart_of_account_items_coa_id_code_key" ON "chart_of_account_items"("coa_id", "code");

-- CreateIndex
CREATE INDEX "account_mappings_company_id_source_coa_id_idx" ON "account_mappings"("company_id", "source_coa_id");

-- CreateIndex
CREATE INDEX "account_mappings_company_id_target_coa_id_idx" ON "account_mappings"("company_id", "target_coa_id");

-- CreateIndex
CREATE UNIQUE INDEX "account_mappings_company_id_source_item_id_target_coa_id_key" ON "account_mappings"("company_id", "source_item_id", "target_coa_id");

-- CreateIndex
CREATE INDEX "conversion_projects_company_id_status_idx" ON "conversion_projects"("company_id", "status");

-- CreateIndex
CREATE INDEX "conversion_projects_company_id_period_start_period_end_idx" ON "conversion_projects"("company_id", "period_start", "period_end");

-- CreateIndex
CREATE INDEX "conversion_results_project_id_idx" ON "conversion_results"("project_id");

-- CreateIndex
CREATE INDEX "adjusting_entries_project_id_type_idx" ON "adjusting_entries"("project_id", "type");

-- CreateIndex
CREATE INDEX "conversion_audit_logs_project_id_action_idx" ON "conversion_audit_logs"("project_id", "action");

-- CreateIndex
CREATE INDEX "conversion_audit_logs_project_id_created_at_idx" ON "conversion_audit_logs"("project_id", "created_at");

-- CreateIndex
CREATE INDEX "conversion_exports_result_id_idx" ON "conversion_exports"("result_id");
