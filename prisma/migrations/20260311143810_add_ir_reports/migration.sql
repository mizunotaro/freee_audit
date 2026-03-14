-- CreateTable
CREATE TABLE "ir_reports" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "company_id" TEXT NOT NULL,
    "report_type" TEXT NOT NULL,
    "fiscal_year" INTEGER NOT NULL,
    "quarter" INTEGER,
    "title" TEXT NOT NULL,
    "title_en" TEXT,
    "summary" TEXT,
    "summary_en" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "language" TEXT NOT NULL DEFAULT 'ja',
    "published_at" DATETIME,
    "published_by" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "ir_reports_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ir_report_sections" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "report_id" TEXT NOT NULL,
    "section_type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "title_en" TEXT,
    "content" TEXT NOT NULL,
    "content_en" TEXT,
    "data" TEXT,
    "sort_order" INTEGER NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "ir_report_sections_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "ir_reports" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "shareholder_compositions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "company_id" TEXT NOT NULL,
    "as_of_date" DATETIME NOT NULL,
    "shareholder_type" TEXT NOT NULL,
    "shareholder_name" TEXT,
    "shares_held" REAL NOT NULL,
    "percentage" REAL NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "shareholder_compositions_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ir_events" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "company_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "title_en" TEXT,
    "description" TEXT,
    "description_en" TEXT,
    "scheduled_date" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'scheduled',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "ir_events_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "faqs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "company_id" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "category" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "ir_reports_company_id_fiscal_year_idx" ON "ir_reports"("company_id", "fiscal_year");

-- CreateIndex
CREATE UNIQUE INDEX "ir_reports_company_id_report_type_fiscal_year_quarter_key" ON "ir_reports"("company_id", "report_type", "fiscal_year", "quarter");

-- CreateIndex
CREATE INDEX "ir_report_sections_report_id_idx" ON "ir_report_sections"("report_id");

-- CreateIndex
CREATE INDEX "shareholder_compositions_company_id_as_of_date_idx" ON "shareholder_compositions"("company_id", "as_of_date");

-- CreateIndex
CREATE INDEX "ir_events_company_id_scheduled_date_idx" ON "ir_events"("company_id", "scheduled_date");

-- CreateIndex
CREATE INDEX "faqs_company_id_idx" ON "faqs"("company_id");

-- CreateIndex
CREATE INDEX "faqs_company_id_category_idx" ON "faqs"("company_id", "category");

-- CreateIndex
CREATE INDEX "faqs_company_id_is_active_idx" ON "faqs"("company_id", "is_active");
