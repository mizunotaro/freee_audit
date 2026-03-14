-- CreateTable
CREATE TABLE "dd_checklists" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "company_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "fiscal_year" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'IN_PROGRESS',
    "materiality" REAL,
    "overall_score" INTEGER,
    "created_by" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "dd_checklists_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "dd_checklist_items" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "checklist_id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "item_code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "severity" TEXT NOT NULL,
    "findings" TEXT,
    "recommendation" TEXT,
    "evidence" TEXT,
    "checked_at" DATETIME,
    "checked_by" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "dd_checklist_items_checklist_id_fkey" FOREIGN KEY ("checklist_id") REFERENCES "dd_checklists" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "dd_findings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "company_id" TEXT NOT NULL,
    "checklist_id" TEXT,
    "category" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "impact" TEXT,
    "impact_amount" REAL,
    "recommendation" TEXT,
    "related_standard" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "assignee" TEXT,
    "deadline" DATETIME,
    "resolved_at" DATETIME,
    "resolved_by" TEXT,
    "resolution" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "dd_findings_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "dd_findings_checklist_id_fkey" FOREIGN KEY ("checklist_id") REFERENCES "dd_checklists" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "dd_reports" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "company_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "fiscal_years" TEXT NOT NULL,
    "accounting_standard" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "file_path" TEXT,
    "file_size" INTEGER,
    "overall_score" INTEGER,
    "generated_by" TEXT,
    "generated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" DATETIME,
    CONSTRAINT "dd_reports_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "dd_conversions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "company_id" TEXT NOT NULL,
    "source_standard" TEXT NOT NULL,
    "target_standard" TEXT NOT NULL,
    "fiscal_year" INTEGER NOT NULL,
    "source_trial_balance" TEXT NOT NULL,
    "target_trial_balance" TEXT,
    "adjustments" TEXT,
    "reconciliation" TEXT,
    "conversion_notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "quality_score" INTEGER,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "dd_conversions_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "dd_checklists_company_id_status_idx" ON "dd_checklists"("company_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "dd_checklists_company_id_type_fiscal_year_key" ON "dd_checklists"("company_id", "type", "fiscal_year");

-- CreateIndex
CREATE INDEX "dd_checklist_items_checklist_id_category_idx" ON "dd_checklist_items"("checklist_id", "category");

-- CreateIndex
CREATE INDEX "dd_checklist_items_checklist_id_status_idx" ON "dd_checklist_items"("checklist_id", "status");

-- CreateIndex
CREATE INDEX "dd_findings_company_id_status_idx" ON "dd_findings"("company_id", "status");

-- CreateIndex
CREATE INDEX "dd_findings_company_id_severity_idx" ON "dd_findings"("company_id", "severity");

-- CreateIndex
CREATE INDEX "dd_reports_company_id_type_idx" ON "dd_reports"("company_id", "type");

-- CreateIndex
CREATE INDEX "dd_conversions_company_id_status_idx" ON "dd_conversions"("company_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "dd_conversions_company_id_source_standard_target_standard_fiscal_year_key" ON "dd_conversions"("company_id", "source_standard", "target_standard", "fiscal_year");
