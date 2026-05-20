-- AlterTable
ALTER TABLE "api_requests" ADD COLUMN     "description" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "examples" JSONB NOT NULL DEFAULT '[]';
