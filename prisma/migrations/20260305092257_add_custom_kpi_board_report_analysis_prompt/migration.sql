/*
  Warnings:

  - Added the required column `calculation_type` to the `custom_kpis` table without a default value. This is not possible if the table is not empty.
  - Added the required column `code` to the `custom_kpis` table without a default value. This is not possible if the table is not empty.

*/
-- CreateTable
CREATE TABLE "custom_kpi_values" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "custom_kpi_id" TEXT NOT NULL,
    "fiscal_year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "value" REAL NOT NULL,
    "previous_value" REAL,
    "yoy_change" REAL,
    "is_calculated" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "custom_kpi_values_custom_kpi_id_fkey" FOREIGN KEY ("custom_kpi_id") REFERENCES "custom_kpis" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "board_reports" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "company_id" TEXT NOT NULL,
    "fiscal_year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "generated_at" DATETIME,
    "presented_at" DATETIME,
    "approved_by" TEXT,
    "approved_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "board_reports_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "board_report_sections" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "report_id" TEXT NOT NULL,
    "section_type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "data" TEXT,
    "sort_order" INTEGER NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "board_report_sections_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "board_reports" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "analysis_prompts" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "company_id" TEXT,
    "analysis_type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "system_prompt" TEXT NOT NULL,
    "user_prompt_template" TEXT NOT NULL,
    "variables" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 1,
    "parent_prompt_id" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "analysis_prompts_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_custom_kpis" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "company_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL,
    "calculation_type" TEXT NOT NULL,
    "formula" TEXT,
    "data_source" TEXT,
    "unit" TEXT NOT NULL DEFAULT 'number',
    "display_format" TEXT,
    "decimal_places" INTEGER NOT NULL DEFAULT 0,
    "is_visible" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "target_value" REAL,
    "warning_threshold" REAL,
    "critical_threshold" REAL,
    "comparison_type" TEXT NOT NULL DEFAULT 'higher_better',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "custom_kpis_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_custom_kpis" ("category", "company_id", "created_at", "formula", "id", "is_visible", "name", "sort_order", "target_value", "unit", "updated_at") SELECT "category", "company_id", "created_at", "formula", "id", "is_visible", "name", "sort_order", "target_value", "unit", "updated_at" FROM "custom_kpis";
DROP TABLE "custom_kpis";
ALTER TABLE "new_custom_kpis" RENAME TO "custom_kpis";
CREATE INDEX "custom_kpis_company_id_idx" ON "custom_kpis"("company_id");
CREATE UNIQUE INDEX "custom_kpis_company_id_code_key" ON "custom_kpis"("company_id", "code");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "custom_kpi_values_custom_kpi_id_fiscal_year_idx" ON "custom_kpi_values"("custom_kpi_id", "fiscal_year");

-- CreateIndex
CREATE UNIQUE INDEX "custom_kpi_values_custom_kpi_id_fiscal_year_month_key" ON "custom_kpi_values"("custom_kpi_id", "fiscal_year", "month");

-- CreateIndex
CREATE INDEX "board_reports_company_id_fiscal_year_idx" ON "board_reports"("company_id", "fiscal_year");

-- CreateIndex
CREATE UNIQUE INDEX "board_reports_company_id_fiscal_year_month_key" ON "board_reports"("company_id", "fiscal_year", "month");

-- CreateIndex
CREATE INDEX "board_report_sections_report_id_idx" ON "board_report_sections"("report_id");

-- CreateIndex
CREATE INDEX "analysis_prompts_company_id_analysis_type_idx" ON "analysis_prompts"("company_id", "analysis_type");

-- CreateIndex
CREATE INDEX "analysis_prompts_analysis_type_is_default_idx" ON "analysis_prompts"("analysis_type", "is_default");

-- CreateIndex
CREATE UNIQUE INDEX "analysis_prompts_company_id_analysis_type_is_active_key" ON "analysis_prompts"("company_id", "analysis_type", "is_active");
