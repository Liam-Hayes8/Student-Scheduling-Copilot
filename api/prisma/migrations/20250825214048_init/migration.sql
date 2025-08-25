-- CreateEnum
CREATE TYPE "SyllabusEventType" AS ENUM ('EXAM', 'ASSIGNMENT', 'QUIZ', 'PROJECT', 'OTHER');

-- DropIndex
DROP INDEX "audit_logs_action_idx";

-- DropIndex
DROP INDEX "audit_logs_createdAt_idx";

-- DropIndex
DROP INDEX "audit_logs_userId_idx";

-- DropIndex
DROP INDEX "scheduling_sessions_status_idx";

-- DropIndex
DROP INDEX "scheduling_sessions_userId_idx";

-- DropIndex
DROP INDEX "syllabi_userId_idx";

-- DropIndex
DROP INDEX "syllabus_chunks_embedding_idx";

-- DropIndex
DROP INDEX "syllabus_chunks_syllabusId_idx";

-- CreateTable
CREATE TABLE "course_info" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT,
    "instructor" TEXT,
    "semester" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "course_info_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "syllabus_events" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "type" "SyllabusEventType" NOT NULL,
    "description" TEXT,
    "course" TEXT,
    "confidence" DOUBLE PRECISION NOT NULL,
    "sourceText" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "syllabus_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_chunks" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "chunkIndex" INTEGER NOT NULL,
    "pageNumber" INTEGER,
    "embedding" vector(1536),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_chunks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "course_info_userId_key" ON "course_info"("userId");
