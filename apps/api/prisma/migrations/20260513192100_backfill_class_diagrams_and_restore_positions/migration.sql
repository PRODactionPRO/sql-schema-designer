-- Preserve the manual ERD layout from legacy table metadata.
-- The previous semantic backfill used root x/y fields, while most modern
-- projects store table coordinates as metadata.position.

UPDATE "ViewNode" view_node
SET
    "x" = COALESCE(NULLIF(model_object.metadata #>> '{position,x}', '')::double precision, view_node."x"),
    "y" = COALESCE(NULLIF(model_object.metadata #>> '{position,y}', '')::double precision, view_node."y")
FROM "ModelObject" model_object
WHERE view_node."objectId" = model_object.id
  AND model_object.type = 'table'
  AND jsonb_typeof(model_object.metadata -> 'position') = 'object';

-- Extend relation ontology for class diagrams.

INSERT INTO "RelationType" (
    "id",
    "key",
    "name",
    "sourceType",
    "targetType",
    "cardinality",
    "required",
    "metadata",
    "scope",
    "createdAt",
    "updatedAt"
)
VALUES
    ('relation_type_association', 'association', 'Association', 'entity', 'entity', 'N:N', false, '{}'::jsonb, 'system', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('relation_type_inheritance', 'inheritance', 'Inheritance', 'entity', 'entity', 'N:N', false, '{}'::jsonb, 'system', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('relation_type_composition', 'composition', 'Composition', 'entity', 'entity', 'N:N', false, '{}'::jsonb, 'system', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('relation_type_aggregation', 'aggregation', 'Aggregation', 'entity', 'entity', 'N:N', false, '{}'::jsonb, 'system', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('relation_type_dependency', 'dependency', 'Dependency', 'entity', 'entity', 'N:N', false, '{}'::jsonb, 'system', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- Backfill class-diagram documents into the semantic core.

WITH class_domains AS (
    SELECT
        'model:' || project.id || ':domain:' || COALESCE(domain_item.value ->> 'id', domain_item.ordinality::text) AS id,
        project.id AS project_id,
        COALESCE(NULLIF(domain_item.value ->> 'name', ''), 'Untitled domain') AS name,
        domain_item.value AS metadata,
        project."createdAt" AS created_at,
        GREATEST(project."updatedAt", document."updatedAt") AS updated_at,
        ROW_NUMBER() OVER (
            PARTITION BY 'model:' || project.id || ':domain:' || COALESCE(domain_item.value ->> 'id', domain_item.ordinality::text)
            ORDER BY document."updatedAt" DESC
        ) AS row_number
    FROM "ProjectDocument" document
    JOIN "Project" project ON project.id = document."projectId"
    CROSS JOIN LATERAL jsonb_array_elements(
        CASE
            WHEN jsonb_typeof(COALESCE(document.payload -> 'domains', '[]'::jsonb)) = 'array'
                THEN COALESCE(document.payload -> 'domains', '[]'::jsonb)
            ELSE '[]'::jsonb
        END
    ) WITH ORDINALITY AS domain_item(value, ordinality)
    WHERE document.type = 'class-diagram'
      AND document."deletedAt" IS NULL
      AND project."deletedAt" IS NULL
)
INSERT INTO "ModelObject" (
    "id",
    "projectId",
    "type",
    "name",
    "status",
    "metadata",
    "createdAt",
    "updatedAt"
)
SELECT
    id,
    project_id,
    'domain',
    name,
    'active',
    metadata,
    created_at,
    updated_at
FROM class_domains
WHERE row_number = 1
ON CONFLICT ("id") DO UPDATE
SET
    "name" = EXCLUDED."name",
    "metadata" = EXCLUDED."metadata",
    "updatedAt" = EXCLUDED."updatedAt",
    "deletedAt" = NULL;

WITH class_objects AS (
    SELECT
        'model:' || project.id || ':class:' || COALESCE(class_item.value ->> 'id', class_item.ordinality::text) AS id,
        project.id AS project_id,
        COALESCE(NULLIF(class_item.value ->> 'name', ''), 'Untitled class') AS name,
        NULLIF(class_item.value ->> 'description', '') AS description,
        domain_object.id AS domain_id,
        class_item.value AS metadata,
        project."createdAt" AS created_at,
        GREATEST(project."updatedAt", document."updatedAt") AS updated_at,
        ROW_NUMBER() OVER (
            PARTITION BY 'model:' || project.id || ':class:' || COALESCE(class_item.value ->> 'id', class_item.ordinality::text)
            ORDER BY document."updatedAt" DESC
        ) AS row_number
    FROM "ProjectDocument" document
    JOIN "Project" project ON project.id = document."projectId"
    CROSS JOIN LATERAL jsonb_array_elements(
        CASE
            WHEN jsonb_typeof(COALESCE(document.payload -> 'classes', '[]'::jsonb)) = 'array'
                THEN COALESCE(document.payload -> 'classes', '[]'::jsonb)
            ELSE '[]'::jsonb
        END
    ) WITH ORDINALITY AS class_item(value, ordinality)
    LEFT JOIN "ModelObject" domain_object
        ON domain_object.id = 'model:' || project.id || ':domain:' || (class_item.value ->> 'domainId')
    WHERE document.type = 'class-diagram'
      AND document."deletedAt" IS NULL
      AND project."deletedAt" IS NULL
)
INSERT INTO "ModelObject" (
    "id",
    "projectId",
    "type",
    "name",
    "description",
    "domainId",
    "status",
    "metadata",
    "createdAt",
    "updatedAt"
)
SELECT
    id,
    project_id,
    'entity',
    name,
    description,
    domain_id,
    'active',
    metadata,
    created_at,
    updated_at
FROM class_objects
WHERE row_number = 1
ON CONFLICT ("id") DO UPDATE
SET
    "name" = EXCLUDED."name",
    "description" = EXCLUDED."description",
    "domainId" = EXCLUDED."domainId",
    "metadata" = EXCLUDED."metadata",
    "updatedAt" = EXCLUDED."updatedAt",
    "deletedAt" = NULL;

WITH class_relations AS (
    SELECT
        'relation:' || project.id || ':class:' || COALESCE(relation_item.value ->> 'id', relation_item.ordinality::text) AS id,
        project.id AS project_id,
        source_object.id AS source_object_id,
        target_object.id AS target_object_id,
        COALESCE(NULLIF(relation_item.value ->> 'type', ''), 'association') AS type,
        relation_item.value AS metadata,
        project."createdAt" AS created_at,
        GREATEST(project."updatedAt", document."updatedAt") AS updated_at,
        ROW_NUMBER() OVER (
            PARTITION BY 'relation:' || project.id || ':class:' || COALESCE(relation_item.value ->> 'id', relation_item.ordinality::text)
            ORDER BY document."updatedAt" DESC
        ) AS row_number
    FROM "ProjectDocument" document
    JOIN "Project" project ON project.id = document."projectId"
    CROSS JOIN LATERAL jsonb_array_elements(
        CASE
            WHEN jsonb_typeof(COALESCE(document.payload -> 'relations', '[]'::jsonb)) = 'array'
                THEN COALESCE(document.payload -> 'relations', '[]'::jsonb)
            ELSE '[]'::jsonb
        END
    ) WITH ORDINALITY AS relation_item(value, ordinality)
    JOIN "ModelObject" source_object
        ON source_object.id = 'model:' || project.id || ':class:' || (relation_item.value ->> 'fromClassId')
    JOIN "ModelObject" target_object
        ON target_object.id = 'model:' || project.id || ':class:' || (relation_item.value ->> 'toClassId')
    WHERE document.type = 'class-diagram'
      AND document."deletedAt" IS NULL
      AND project."deletedAt" IS NULL
)
INSERT INTO "ModelRelation" (
    "id",
    "projectId",
    "sourceObjectId",
    "targetObjectId",
    "type",
    "direction",
    "required",
    "metadata",
    "createdAt",
    "updatedAt"
)
SELECT
    id,
    project_id,
    source_object_id,
    target_object_id,
    type,
    'directed',
    false,
    metadata,
    created_at,
    updated_at
FROM class_relations
WHERE row_number = 1
ON CONFLICT ("id") DO UPDATE
SET
    "sourceObjectId" = EXCLUDED."sourceObjectId",
    "targetObjectId" = EXCLUDED."targetObjectId",
    "type" = EXCLUDED."type",
    "metadata" = EXCLUDED."metadata",
    "updatedAt" = EXCLUDED."updatedAt",
    "deletedAt" = NULL;

INSERT INTO "ModelView" (
    "id",
    "projectId",
    "type",
    "name",
    "description",
    "scope",
    "filters",
    "settings",
    "createdAt",
    "updatedAt"
)
SELECT
    'view:' || project.id || ':class_diagram:' || document.id,
    project.id,
    'class_diagram',
    document.name,
    document.description,
    '{"objectTypes":["entity"],"relationTypes":["association","inheritance","composition","aggregation","dependency"]}'::jsonb,
    '{}'::jsonb,
    '{}'::jsonb,
    document."createdAt",
    document."updatedAt"
FROM "ProjectDocument" document
JOIN "Project" project ON project.id = document."projectId"
WHERE document.type = 'class-diagram'
  AND document."deletedAt" IS NULL
  AND project."deletedAt" IS NULL
  AND jsonb_typeof(COALESCE(document.payload -> 'classes', '[]'::jsonb)) = 'array'
  AND jsonb_array_length(COALESCE(document.payload -> 'classes', '[]'::jsonb)) > 0
ON CONFLICT ("id") DO UPDATE
SET
    "name" = EXCLUDED."name",
    "description" = EXCLUDED."description",
    "updatedAt" = EXCLUDED."updatedAt",
    "deletedAt" = NULL;

INSERT INTO "ViewNode" (
    "id",
    "viewId",
    "objectId",
    "x",
    "y",
    "width",
    "height",
    "collapsed",
    "visible",
    "style",
    "settings"
)
SELECT
    'view_node:' || project.id || ':class_diagram:' || document.id || ':' || COALESCE(class_item.value ->> 'id', class_item.ordinality::text),
    'view:' || project.id || ':class_diagram:' || document.id,
    'model:' || project.id || ':class:' || COALESCE(class_item.value ->> 'id', class_item.ordinality::text),
    COALESCE(NULLIF(class_item.value #>> '{position,x}', '')::double precision, 0),
    COALESCE(NULLIF(class_item.value #>> '{position,y}', '')::double precision, 0),
    280,
    NULL,
    false,
    true,
    '{}'::jsonb,
    '{}'::jsonb
FROM "ProjectDocument" document
JOIN "Project" project ON project.id = document."projectId"
CROSS JOIN LATERAL jsonb_array_elements(
    CASE
        WHEN jsonb_typeof(COALESCE(document.payload -> 'classes', '[]'::jsonb)) = 'array'
            THEN COALESCE(document.payload -> 'classes', '[]'::jsonb)
        ELSE '[]'::jsonb
    END
) WITH ORDINALITY AS class_item(value, ordinality)
WHERE document.type = 'class-diagram'
  AND document."deletedAt" IS NULL
  AND project."deletedAt" IS NULL
  AND EXISTS (
      SELECT 1
      FROM "ModelView" view_item
      WHERE view_item.id = 'view:' || project.id || ':class_diagram:' || document.id
  )
ON CONFLICT ("id") DO UPDATE
SET
    "x" = EXCLUDED."x",
    "y" = EXCLUDED."y",
    "objectId" = EXCLUDED."objectId",
    "visible" = true;

INSERT INTO "ViewEdge" (
    "id",
    "viewId",
    "relationId",
    "sourceViewNodeId",
    "targetViewNodeId",
    "isModelRelation",
    "routing",
    "visible",
    "style"
)
SELECT
    'view_edge:' || project.id || ':class_diagram:' || document.id || ':' || COALESCE(relation_item.value ->> 'id', relation_item.ordinality::text),
    'view:' || project.id || ':class_diagram:' || document.id,
    model_relation.id,
    source_node.id,
    target_node.id,
    true,
    NULL,
    true,
    '{}'::jsonb
FROM "ProjectDocument" document
JOIN "Project" project ON project.id = document."projectId"
CROSS JOIN LATERAL jsonb_array_elements(
    CASE
        WHEN jsonb_typeof(COALESCE(document.payload -> 'relations', '[]'::jsonb)) = 'array'
            THEN COALESCE(document.payload -> 'relations', '[]'::jsonb)
        ELSE '[]'::jsonb
    END
) WITH ORDINALITY AS relation_item(value, ordinality)
JOIN "ModelRelation" model_relation
    ON model_relation.id = 'relation:' || project.id || ':class:' || COALESCE(relation_item.value ->> 'id', relation_item.ordinality::text)
JOIN "ViewNode" source_node
    ON source_node.id = 'view_node:' || project.id || ':class_diagram:' || document.id || ':' || (relation_item.value ->> 'fromClassId')
JOIN "ViewNode" target_node
    ON target_node.id = 'view_node:' || project.id || ':class_diagram:' || document.id || ':' || (relation_item.value ->> 'toClassId')
WHERE document.type = 'class-diagram'
  AND document."deletedAt" IS NULL
  AND project."deletedAt" IS NULL
ON CONFLICT ("id") DO UPDATE
SET
    "relationId" = EXCLUDED."relationId",
    "sourceViewNodeId" = EXCLUDED."sourceViewNodeId",
    "targetViewNodeId" = EXCLUDED."targetViewNodeId",
    "visible" = true;
