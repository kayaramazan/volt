-- AlterTable
ALTER TABLE "api_requests" ADD COLUMN     "post_response_script" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "pre_request_script" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "collections" ADD COLUMN     "description" TEXT NOT NULL DEFAULT '';

-- CreateTable
CREATE TABLE "history_entries" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "request_id" UUID,
    "method" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "request_snapshot" JSONB NOT NULL,
    "status_code" INTEGER,
    "response_headers" JSONB,
    "response_size_bytes" INTEGER,
    "response_content_type" TEXT,
    "started_at" TIMESTAMP(3) NOT NULL,
    "duration_ms" INTEGER NOT NULL,
    "error_code" TEXT,
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "revision" BIGINT NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "history_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "history_entries_workspace_id_revision_idx" ON "history_entries"("workspace_id", "revision");

-- CreateIndex
CREATE INDEX "history_entries_workspace_id_started_at_idx" ON "history_entries"("workspace_id", "started_at" DESC);

-- AddForeignKey
ALTER TABLE "history_entries" ADD CONSTRAINT "history_entries_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
