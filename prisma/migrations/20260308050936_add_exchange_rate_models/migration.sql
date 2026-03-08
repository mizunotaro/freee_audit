/*
  Warnings:

  - Added the required column `updated_at` to the `exchange_rates` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "conversion_projects" ADD COLUMN "rationale_review_status" TEXT;
ALTER TABLE "conversion_projects" ADD COLUMN "rationale_reviewed_at" DATETIME;
ALTER TABLE "conversion_projects" ADD COLUMN "rationale_reviewed_by" TEXT;

-- CreateTable
CREATE TABLE "currencies" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "name_ja" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "decimal_places" INTEGER NOT NULL DEFAULT 2,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "foreign_currency_transactions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "company_id" TEXT NOT NULL,
    "transaction_date" DATETIME NOT NULL,
    "transaction_type" TEXT NOT NULL,
    "currency_code" TEXT NOT NULL,
    "original_amount" REAL NOT NULL,
    "exchange_rate_id" TEXT NOT NULL,
    "exchanged_amount" REAL NOT NULL,
    "reference_number" TEXT,
    "partner_id" TEXT,
    "partner_name" TEXT,
    "document_id" TEXT,
    "description" TEXT,
    "settlement_date" DATETIME,
    "settlement_rate_id" TEXT,
    "settlement_amount" REAL,
    "exchange_gain_loss" REAL,
    "exchange_gain_loss_type" TEXT,
    "revaluation_date" DATETIME,
    "revaluation_rate_id" TEXT,
    "revaluation_gain_loss" REAL,
    "journal_id" TEXT,
    "settlement_journal_id" TEXT,
    "revaluation_journal_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "foreign_currency_transactions_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "foreign_currency_transactions_currency_code_fkey" FOREIGN KEY ("currency_code") REFERENCES "currencies" ("code") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "foreign_currency_transactions_exchange_rate_id_fkey" FOREIGN KEY ("exchange_rate_id") REFERENCES "exchange_rates" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "foreign_currency_transactions_settlement_rate_id_fkey" FOREIGN KEY ("settlement_rate_id") REFERENCES "exchange_rates" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "foreign_currency_transactions_revaluation_rate_id_fkey" FOREIGN KEY ("revaluation_rate_id") REFERENCES "exchange_rates" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "foreign_currency_transactions_journal_id_fkey" FOREIGN KEY ("journal_id") REFERENCES "journals" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "exchange_rate_fetch_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "source" TEXT NOT NULL,
    "fetched_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rate_date" DATETIME NOT NULL,
    "status" TEXT NOT NULL,
    "records_count" INTEGER NOT NULL DEFAULT 0,
    "error_message" TEXT,
    "duration_ms" INTEGER NOT NULL,
    "retry_count" INTEGER NOT NULL DEFAULT 0
);

-- CreateTable
CREATE TABLE "exchange_rate_settings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "company_id" TEXT NOT NULL,
    "slack_enabled" BOOLEAN NOT NULL DEFAULT false,
    "slack_webhook_url" TEXT,
    "slack_channel" TEXT,
    "slack_notify_on_failure" BOOLEAN NOT NULL DEFAULT true,
    "slack_notify_on_success" BOOLEAN NOT NULL DEFAULT false,
    "email_enabled" BOOLEAN NOT NULL DEFAULT false,
    "email_recipients" TEXT,
    "email_notify_on_failure" BOOLEAN NOT NULL DEFAULT true,
    "auto_fetch_enabled" BOOLEAN NOT NULL DEFAULT true,
    "fetch_time" TEXT NOT NULL DEFAULT '11:00',
    "retry_delays" TEXT NOT NULL DEFAULT '[300000,900000,3600000]',
    "auto_revaluation_enabled" BOOLEAN NOT NULL DEFAULT true,
    "revaluation_months" TEXT NOT NULL DEFAULT '[3,12]',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "standard_references" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "standard" TEXT NOT NULL,
    "reference_type" TEXT NOT NULL,
    "reference_number" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "title_en" TEXT,
    "description" TEXT,
    "description_en" TEXT,
    "effective_date" DATETIME,
    "superseded_date" DATETIME,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "official_url" TEXT,
    "keywords" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "conversion_rationales" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "project_id" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "rationale_type" TEXT NOT NULL,
    "source_reference_id" TEXT,
    "target_reference_id" TEXT,
    "summary" TEXT NOT NULL,
    "summary_en" TEXT,
    "detailed_explanation" TEXT,
    "detailed_explanation_en" TEXT,
    "impact_amount" REAL,
    "impact_direction" TEXT,
    "is_ai_generated" BOOLEAN NOT NULL DEFAULT false,
    "ai_model_used" TEXT,
    "ai_confidence" REAL,
    "is_reviewed" BOOLEAN NOT NULL DEFAULT false,
    "reviewed_by" TEXT,
    "reviewed_at" DATETIME,
    "created_by" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "conversion_rationales_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "conversion_projects" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "conversion_rationales_source_reference_id_fkey" FOREIGN KEY ("source_reference_id") REFERENCES "standard_references" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "conversion_rationales_target_reference_id_fkey" FOREIGN KEY ("target_reference_id") REFERENCES "standard_references" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "rationale_audit_trails" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "rationale_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "previous_value" TEXT,
    "new_value" TEXT,
    "changed_fields" TEXT,
    "user_id" TEXT,
    "userName" TEXT,
    "user_role" TEXT,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "notes" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "rationale_audit_trails_rationale_id_fkey" FOREIGN KEY ("rationale_id") REFERENCES "conversion_rationales" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "approval_workflows" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "project_id" TEXT NOT NULL,
    "stage" TEXT NOT NULL DEFAULT 'mapping_review',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "due_date" DATETIME,
    "completed_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "approval_workflows_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "conversion_projects" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "approval_assignees" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workflow_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "user_name" TEXT NOT NULL,
    "user_role" TEXT NOT NULL,
    "is_required" BOOLEAN NOT NULL DEFAULT true,
    "assigned_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approved_at" DATETIME,
    "comment" TEXT,
    CONSTRAINT "approval_assignees_workflow_id_fkey" FOREIGN KEY ("workflow_id") REFERENCES "approval_workflows" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "approval_history_entries" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workflow_id" TEXT NOT NULL,
    "stage" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "user_name" TEXT NOT NULL,
    "user_role" TEXT NOT NULL,
    "comment" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "approval_history_entries_workflow_id_fkey" FOREIGN KEY ("workflow_id") REFERENCES "approval_workflows" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "disclosure_documents" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "project_id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "title_en" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "content_en" TEXT,
    "sections" TEXT,
    "is_generated" BOOLEAN NOT NULL DEFAULT false,
    "is_ai_enhanced" BOOLEAN NOT NULL DEFAULT false,
    "generated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    "reviewed_by" TEXT,
    "reviewed_at" DATETIME,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "disclosure_documents_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "conversion_projects" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "disclosure_standard_references" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "disclosure_id" TEXT NOT NULL,
    "reference_number" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "disclosure_standard_references_disclosure_id_fkey" FOREIGN KEY ("disclosure_id") REFERENCES "disclosure_documents" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "disclosure_rationale_links" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "disclosure_id" TEXT NOT NULL,
    "rationale_id" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "disclosure_rationale_links_disclosure_id_fkey" FOREIGN KEY ("disclosure_id") REFERENCES "disclosure_documents" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_exchange_rates" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "rate_date" DATETIME NOT NULL,
    "from_currency" TEXT NOT NULL,
    "to_currency" TEXT NOT NULL,
    "rate" REAL NOT NULL,
    "source" TEXT NOT NULL,
    "source_url" TEXT,
    "confidence" REAL NOT NULL DEFAULT 1.0,
    "is_official" BOOLEAN NOT NULL DEFAULT false,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);
INSERT INTO "new_exchange_rates" ("created_at", "from_currency", "id", "rate", "rate_date", "source", "to_currency") SELECT "created_at", "from_currency", "id", "rate", "rate_date", "source", "to_currency" FROM "exchange_rates";
DROP TABLE "exchange_rates";
ALTER TABLE "new_exchange_rates" RENAME TO "exchange_rates";
CREATE INDEX "exchange_rates_rate_date_idx" ON "exchange_rates"("rate_date");
CREATE INDEX "exchange_rates_to_currency_idx" ON "exchange_rates"("to_currency");
CREATE UNIQUE INDEX "exchange_rates_rate_date_from_currency_to_currency_source_key" ON "exchange_rates"("rate_date", "from_currency", "to_currency", "source");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "currencies_code_key" ON "currencies"("code");

-- CreateIndex
CREATE INDEX "foreign_currency_transactions_company_id_transaction_date_idx" ON "foreign_currency_transactions"("company_id", "transaction_date");

-- CreateIndex
CREATE INDEX "foreign_currency_transactions_company_id_status_idx" ON "foreign_currency_transactions"("company_id", "status");

-- CreateIndex
CREATE INDEX "foreign_currency_transactions_company_id_reference_number_idx" ON "foreign_currency_transactions"("company_id", "reference_number");

-- CreateIndex
CREATE INDEX "foreign_currency_transactions_company_id_partner_name_idx" ON "foreign_currency_transactions"("company_id", "partner_name");

-- CreateIndex
CREATE INDEX "exchange_rate_fetch_logs_source_fetched_at_idx" ON "exchange_rate_fetch_logs"("source", "fetched_at");

-- CreateIndex
CREATE INDEX "exchange_rate_fetch_logs_rate_date_status_idx" ON "exchange_rate_fetch_logs"("rate_date", "status");

-- CreateIndex
CREATE UNIQUE INDEX "exchange_rate_settings_company_id_key" ON "exchange_rate_settings"("company_id");

-- CreateIndex
CREATE INDEX "standard_references_standard_is_active_idx" ON "standard_references"("standard", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "standard_references_standard_reference_number_key" ON "standard_references"("standard", "reference_number");

-- CreateIndex
CREATE INDEX "conversion_rationales_project_id_entity_type_idx" ON "conversion_rationales"("project_id", "entity_type");

-- CreateIndex
CREATE INDEX "conversion_rationales_project_id_created_at_idx" ON "conversion_rationales"("project_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "conversion_rationales_project_id_entity_type_entity_id_rationale_type_key" ON "conversion_rationales"("project_id", "entity_type", "entity_id", "rationale_type");

-- CreateIndex
CREATE INDEX "rationale_audit_trails_rationale_id_created_at_idx" ON "rationale_audit_trails"("rationale_id", "created_at");

-- CreateIndex
CREATE INDEX "approval_workflows_project_id_status_idx" ON "approval_workflows"("project_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "approval_workflows_project_id_key" ON "approval_workflows"("project_id");

-- CreateIndex
CREATE INDEX "approval_assignees_workflow_id_idx" ON "approval_assignees"("workflow_id");

-- CreateIndex
CREATE INDEX "approval_assignees_user_id_idx" ON "approval_assignees"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "approval_assignees_workflow_id_user_id_key" ON "approval_assignees"("workflow_id", "user_id");

-- CreateIndex
CREATE INDEX "approval_history_entries_workflow_id_created_at_idx" ON "approval_history_entries"("workflow_id", "created_at");

-- CreateIndex
CREATE INDEX "disclosure_documents_project_id_idx" ON "disclosure_documents"("project_id");

-- CreateIndex
CREATE INDEX "disclosure_documents_project_id_category_idx" ON "disclosure_documents"("project_id", "category");

-- CreateIndex
CREATE INDEX "disclosure_standard_references_disclosure_id_idx" ON "disclosure_standard_references"("disclosure_id");

-- CreateIndex
CREATE INDEX "disclosure_rationale_links_disclosure_id_idx" ON "disclosure_rationale_links"("disclosure_id");

-- CreateIndex
CREATE INDEX "disclosure_rationale_links_rationale_id_idx" ON "disclosure_rationale_links"("rationale_id");

-- CreateIndex
CREATE UNIQUE INDEX "disclosure_rationale_links_disclosure_id_rationale_id_key" ON "disclosure_rationale_links"("disclosure_id", "rationale_id");
