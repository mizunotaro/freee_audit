-- CreateTable
CREATE TABLE "board_meetings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "company_id" TEXT NOT NULL,
    "meeting_date" DATETIME NOT NULL,
    "meeting_type" TEXT NOT NULL,
    "minutes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "board_meetings_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "agenda_items" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "board_meeting_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL,
    "decision_type" TEXT NOT NULL,
    "required_by_law" BOOLEAN NOT NULL DEFAULT false,
    "legal_basis" TEXT,
    "ai_analysis" TEXT,
    "resolution" TEXT,
    "resolution_status" TEXT NOT NULL DEFAULT 'PENDING',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "agenda_items_board_meeting_id_fkey" FOREIGN KEY ("board_meeting_id") REFERENCES "board_meetings" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "board_meetings_company_id_meeting_date_idx" ON "board_meetings"("company_id", "meeting_date");

-- CreateIndex
CREATE INDEX "agenda_items_board_meeting_id_idx" ON "agenda_items"("board_meeting_id");
