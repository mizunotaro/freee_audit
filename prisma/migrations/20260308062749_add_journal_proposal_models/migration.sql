-- CreateTable
CREATE TABLE "company_settings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "company_id" TEXT NOT NULL,
    "ocr_engine" TEXT NOT NULL DEFAULT 'ndlocr',
    "ai_provider" TEXT,
    "ai_model" TEXT,
    "ai_temperature" REAL,
    "ai_max_tokens" INTEGER,
    "updated_at" DATETIME NOT NULL,
    "updated_by" TEXT NOT NULL,
    CONSTRAINT "company_settings_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "receipt_documents" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "company_id" TEXT NOT NULL,
    "encrypted_path" TEXT NOT NULL,
    "original_name" TEXT NOT NULL,
    "content_type" TEXT NOT NULL,
    "file_size" INTEGER NOT NULL,
    "file_hash" TEXT NOT NULL,
    "ocr_result" TEXT,
    "ocr_engine" TEXT,
    "ocr_confidence" REAL,
    "status" TEXT NOT NULL DEFAULT 'uploaded',
    "expires_at" DATETIME,
    "deleted_at" DATETIME,
    "uploaded_by" TEXT NOT NULL,
    "uploaded_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_accessed_at" DATETIME,
    CONSTRAINT "receipt_documents_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "journal_proposals" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "company_id" TEXT NOT NULL,
    "document_id" TEXT NOT NULL,
    "user_context" TEXT NOT NULL,
    "proposals" TEXT NOT NULL,
    "ai_provider" TEXT NOT NULL,
    "ai_model" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "created_by" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewed_by" TEXT,
    "reviewed_at" DATETIME,
    CONSTRAINT "journal_proposals_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "journal_proposals_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "receipt_documents" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "company_settings_company_id_key" ON "company_settings"("company_id");

-- CreateIndex
CREATE INDEX "company_settings_company_id_idx" ON "company_settings"("company_id");

-- CreateIndex
CREATE INDEX "receipt_documents_company_id_idx" ON "receipt_documents"("company_id");

-- CreateIndex
CREATE INDEX "receipt_documents_status_idx" ON "receipt_documents"("status");

-- CreateIndex
CREATE INDEX "receipt_documents_expires_at_idx" ON "receipt_documents"("expires_at");

-- CreateIndex
CREATE INDEX "receipt_documents_uploaded_at_idx" ON "receipt_documents"("uploaded_at");

-- CreateIndex
CREATE UNIQUE INDEX "journal_proposals_document_id_key" ON "journal_proposals"("document_id");

-- CreateIndex
CREATE INDEX "journal_proposals_company_id_idx" ON "journal_proposals"("company_id");

-- CreateIndex
CREATE INDEX "journal_proposals_status_idx" ON "journal_proposals"("status");

-- CreateIndex
CREATE INDEX "journal_proposals_created_at_idx" ON "journal_proposals"("created_at");
