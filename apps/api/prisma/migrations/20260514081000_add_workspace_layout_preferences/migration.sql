-- Store per-user project workspace layout separately from the semantic model.
-- This keeps UI preferences such as panel placement and canvas viewport out of
-- Project.schemaJson and lets multiple users keep different workspaces.

CREATE TABLE "WorkspaceLayoutPreference" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "state" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkspaceLayoutPreference_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WorkspaceLayoutPreference_projectId_userId_key"
    ON "WorkspaceLayoutPreference"("projectId", "userId");

CREATE INDEX "WorkspaceLayoutPreference_userId_updatedAt_idx"
    ON "WorkspaceLayoutPreference"("userId", "updatedAt");

CREATE INDEX "WorkspaceLayoutPreference_projectId_idx"
    ON "WorkspaceLayoutPreference"("projectId");

ALTER TABLE "WorkspaceLayoutPreference"
    ADD CONSTRAINT "WorkspaceLayoutPreference_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "Project"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WorkspaceLayoutPreference"
    ADD CONSTRAINT "WorkspaceLayoutPreference_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
