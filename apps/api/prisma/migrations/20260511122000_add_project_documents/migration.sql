-- CreateTable
CREATE TABLE "ProjectDocument" (
    "id" TEXT NOT NULL,
    "projectId" TEXT,
    "ownerId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "payload" JSONB NOT NULL,
    "snapshot" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "ProjectDocument_pkey" PRIMARY KEY ("id")
);

-- Backfill documents that used to live inside Project.schemaJson.documents.
INSERT INTO "ProjectDocument" (
    "id",
    "projectId",
    "ownerId",
    "type",
    "name",
    "description",
    "payload",
    "snapshot",
    "createdAt",
    "updatedAt"
)
SELECT
    COALESCE(document.value ->> 'id', 'doc_' || project.id || '_' || document.ordinality::text),
    project.id,
    project."ownerId",
    COALESCE(document.value ->> 'type', 'erd'),
    COALESCE(document.value ->> 'name', 'Untitled document'),
    NULLIF(document.value ->> 'description', ''),
    CASE
        WHEN document.value ->> 'type' = 'erd' THEN COALESCE(document.value -> 'erd', '{}'::jsonb)
        WHEN document.value ->> 'type' = 'class-diagram' THEN COALESCE(document.value -> 'classDiagram', '{}'::jsonb)
        ELSE document.value
    END,
    NULLIF(document.value ->> 'snapshot', ''),
    CASE
        WHEN (document.value ->> 'createdAt') ~ '^\d{4}-\d{2}-\d{2}T' THEN (document.value ->> 'createdAt')::timestamp
        ELSE project."createdAt"
    END,
    CASE
        WHEN (document.value ->> 'updatedAt') ~ '^\d{4}-\d{2}-\d{2}T' THEN (document.value ->> 'updatedAt')::timestamp
        ELSE project."updatedAt"
    END
FROM "Project" project
CROSS JOIN LATERAL jsonb_array_elements(
    CASE
        WHEN jsonb_typeof(COALESCE(project."schemaJson" -> 'documents', '[]'::jsonb)) = 'array'
            THEN COALESCE(project."schemaJson" -> 'documents', '[]'::jsonb)
        ELSE '[]'::jsonb
    END
) WITH ORDINALITY AS document(value, ordinality)
ON CONFLICT ("id") DO NOTHING;

-- Remove embedded document copies from the project container after the backfill.
UPDATE "Project"
SET "schemaJson" = "schemaJson" - 'documents'
WHERE "schemaJson" ? 'documents';

-- CreateIndex
CREATE INDEX "ProjectDocument_ownerId_updatedAt_idx" ON "ProjectDocument"("ownerId", "updatedAt");

-- CreateIndex
CREATE INDEX "ProjectDocument_projectId_updatedAt_idx" ON "ProjectDocument"("projectId", "updatedAt");

-- CreateIndex
CREATE INDEX "ProjectDocument_type_idx" ON "ProjectDocument"("type");

-- AddForeignKey
ALTER TABLE "ProjectDocument" ADD CONSTRAINT "ProjectDocument_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectDocument" ADD CONSTRAINT "ProjectDocument_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
