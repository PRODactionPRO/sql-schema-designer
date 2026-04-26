-- AlterTable
ALTER TABLE "User" ADD COLUMN     "role" TEXT NOT NULL DEFAULT 'user';

-- CreateTable
CREATE TABLE "ProjectSqlView" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "sqlQuery" TEXT NOT NULL,
    "dialect" TEXT NOT NULL DEFAULT 'postgresql',
    "tool" TEXT DEFAULT 'grafana',
    "authorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectSqlView_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectMigration" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "fromRevision" INTEGER,
    "toRevision" INTEGER,
    "upSql" TEXT NOT NULL,
    "downSql" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "authorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectMigration_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProjectSqlView_projectId_updatedAt_idx" ON "ProjectSqlView"("projectId", "updatedAt");

-- CreateIndex
CREATE INDEX "ProjectMigration_projectId_updatedAt_idx" ON "ProjectMigration"("projectId", "updatedAt");

-- AddForeignKey
ALTER TABLE "ProjectSqlView" ADD CONSTRAINT "ProjectSqlView_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectSqlView" ADD CONSTRAINT "ProjectSqlView_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectMigration" ADD CONSTRAINT "ProjectMigration_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectMigration" ADD CONSTRAINT "ProjectMigration_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
