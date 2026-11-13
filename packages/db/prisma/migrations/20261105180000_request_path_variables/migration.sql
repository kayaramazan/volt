-- Path variables (`:id` segments) on requests, synced like query params.
ALTER TABLE "api_requests" ADD COLUMN IF NOT EXISTS "path_variables" JSONB NOT NULL DEFAULT '[]';
