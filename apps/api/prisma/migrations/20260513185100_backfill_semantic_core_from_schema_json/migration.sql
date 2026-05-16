-- Extend the first system ontology with the minimum product-facing types.

INSERT INTO "ObjectType" (
    "id",
    "key",
    "name",
    "category",
    "schema",
    "allowedParentTypes",
    "allowedRelationTypes",
    "scope",
    "createdAt",
    "updatedAt"
)
VALUES
    ('object_type_enum', 'enum', 'Enum', 'Data', '{"properties":{"values":{"type":"array"}}}'::jsonb, '["domain"]'::jsonb, '["references", "affects"]'::jsonb, 'system', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('object_type_json_schema', 'json_schema', 'JSON Schema', 'Data', '{}'::jsonb, '["domain"]'::jsonb, '["references", "affects"]'::jsonb, 'system', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('object_type_process', 'process', 'Process', 'Process', '{}'::jsonb, '["domain"]'::jsonb, '["contains", "uses", "emits", "references", "affects"]'::jsonb, 'system', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('object_type_process_step', 'process_step', 'Process Step', 'Process', '{}'::jsonb, '["process"]'::jsonb, '["uses", "emits", "calls", "references", "affects"]'::jsonb, 'system', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('object_type_component', 'component', 'Component', 'Architecture', '{}'::jsonb, '["domain"]'::jsonb, '["contains", "depends_on", "implements", "references", "affects"]'::jsonb, 'system', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('object_type_api_contract', 'api_contract', 'API Contract', 'API', '{}'::jsonb, '["domain", "component"]'::jsonb, '["contains", "references", "affects"]'::jsonb, 'system', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('object_type_state_machine', 'state_machine', 'State Machine', 'State', '{}'::jsonb, '["domain", "entity"]'::jsonb, '["contains", "references", "affects"]'::jsonb, 'system', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('object_type_state', 'state', 'State', 'State', '{}'::jsonb, '["state_machine"]'::jsonb, '["references", "affects"]'::jsonb, 'system', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

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
    ('relation_type_depends_on', 'depends_on', 'Depends on', NULL, NULL, 'N:N', false, '{}'::jsonb, 'system', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('relation_type_implements', 'implements', 'Implements', NULL, NULL, 'N:N', false, '{}'::jsonb, 'system', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('relation_type_consumes', 'consumes', 'Consumes', NULL, 'event', 'N:N', false, '{}'::jsonb, 'system', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('relation_type_triggers', 'triggers', 'Triggers', NULL, NULL, 'N:N', false, '{}'::jsonb, 'system', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('relation_type_accepts', 'accepts', 'Accepts', 'api_endpoint', NULL, 'N:N', false, '{}'::jsonb, 'system', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('relation_type_returns', 'returns', 'Returns', 'api_endpoint', NULL, 'N:N', false, '{}'::jsonb, 'system', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- Backfill current Project.schemaJson into the semantic core as a compatibility
-- projection. The legacy JSON stays intact and remains the UI source for now.

INSERT INTO "ModelObject" (
    "id",
    "projectId",
    "type",
    "name",
    "slug",
    "description",
    "status",
    "metadata",
    "createdAt",
    "updatedAt"
)
SELECT
    'model:' || project.id || ':domain:' || COALESCE(domain.value ->> 'id', domain.ordinality::text),
    project.id,
    'domain',
    COALESCE(NULLIF(domain.value ->> 'name', ''), 'Untitled domain'),
    NULLIF(domain.value ->> 'slug', ''),
    NULLIF(domain.value ->> 'description', ''),
    'active',
    domain.value,
    project."createdAt",
    project."updatedAt"
FROM "Project" project
CROSS JOIN LATERAL jsonb_array_elements(
    CASE
        WHEN jsonb_typeof(COALESCE(project."schemaJson" -> 'domains', '[]'::jsonb)) = 'array'
            THEN COALESCE(project."schemaJson" -> 'domains', '[]'::jsonb)
        ELSE '[]'::jsonb
    END
) WITH ORDINALITY AS domain(value, ordinality);

INSERT INTO "ModelObject" (
    "id",
    "projectId",
    "type",
    "name",
    "slug",
    "description",
    "domainId",
    "status",
    "metadata",
    "createdAt",
    "updatedAt"
)
SELECT
    'model:' || project.id || ':table:' || COALESCE(table_item.value ->> 'id', table_item.ordinality::text),
    project.id,
    'table',
    COALESCE(NULLIF(table_item.value ->> 'name', ''), 'Untitled table'),
    NULLIF(table_item.value ->> 'slug', ''),
    NULLIF(table_item.value ->> 'description', ''),
    domain_object.id,
    'active',
    table_item.value,
    project."createdAt",
    project."updatedAt"
FROM "Project" project
CROSS JOIN LATERAL jsonb_array_elements(
    CASE
        WHEN jsonb_typeof(COALESCE(project."schemaJson" -> 'tables', '[]'::jsonb)) = 'array'
            THEN COALESCE(project."schemaJson" -> 'tables', '[]'::jsonb)
        ELSE '[]'::jsonb
    END
) WITH ORDINALITY AS table_item(value, ordinality)
LEFT JOIN "ModelObject" domain_object
    ON domain_object.id = 'model:' || project.id || ':domain:' || (table_item.value ->> 'domainId');

INSERT INTO "ModelObject" (
    "id",
    "projectId",
    "type",
    "name",
    "slug",
    "description",
    "status",
    "metadata",
    "createdAt",
    "updatedAt"
)
SELECT
    'model:' || project.id || ':enum:' || COALESCE(enum_item.value ->> 'id', enum_item.ordinality::text),
    project.id,
    'enum',
    COALESCE(NULLIF(enum_item.value ->> 'name', ''), 'Untitled enum'),
    NULLIF(enum_item.value ->> 'slug', ''),
    NULLIF(enum_item.value ->> 'description', ''),
    'active',
    enum_item.value,
    project."createdAt",
    project."updatedAt"
FROM "Project" project
CROSS JOIN LATERAL jsonb_array_elements(
    CASE
        WHEN jsonb_typeof(COALESCE(project."schemaJson" -> 'enums', '[]'::jsonb)) = 'array'
            THEN COALESCE(project."schemaJson" -> 'enums', '[]'::jsonb)
        ELSE '[]'::jsonb
    END
) WITH ORDINALITY AS enum_item(value, ordinality);

INSERT INTO "ModelObject" (
    "id",
    "projectId",
    "type",
    "name",
    "slug",
    "description",
    "status",
    "metadata",
    "createdAt",
    "updatedAt"
)
SELECT
    'model:' || project.id || ':json_schema:' || COALESCE(schema_item.value ->> 'id', schema_item.ordinality::text),
    project.id,
    'json_schema',
    COALESCE(NULLIF(schema_item.value ->> 'name', ''), 'Untitled JSON Schema'),
    NULLIF(schema_item.value ->> 'slug', ''),
    NULLIF(schema_item.value ->> 'description', ''),
    'active',
    schema_item.value,
    project."createdAt",
    project."updatedAt"
FROM "Project" project
CROSS JOIN LATERAL jsonb_array_elements(
    CASE
        WHEN jsonb_typeof(COALESCE(project."schemaJson" -> 'jsonSchemas', '[]'::jsonb)) = 'array'
            THEN COALESCE(project."schemaJson" -> 'jsonSchemas', '[]'::jsonb)
        ELSE '[]'::jsonb
    END
) WITH ORDINALITY AS schema_item(value, ordinality);

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
    'relation:' || project.id || ':references:' || COALESCE(relation_item.value ->> 'id', relation_item.ordinality::text),
    project.id,
    source_object.id,
    target_object.id,
    'references',
    'directed',
    false,
    relation_item.value,
    project."createdAt",
    project."updatedAt"
FROM "Project" project
CROSS JOIN LATERAL jsonb_array_elements(
    CASE
        WHEN jsonb_typeof(COALESCE(project."schemaJson" -> 'relations', '[]'::jsonb)) = 'array'
            THEN COALESCE(project."schemaJson" -> 'relations', '[]'::jsonb)
        ELSE '[]'::jsonb
    END
) WITH ORDINALITY AS relation_item(value, ordinality)
JOIN "ModelObject" source_object
    ON source_object.id = 'model:' || project.id || ':table:' || COALESCE(relation_item.value ->> 'fromTableId', relation_item.value ->> 'sourceTableId')
JOIN "ModelObject" target_object
    ON target_object.id = 'model:' || project.id || ':table:' || COALESCE(relation_item.value ->> 'toTableId', relation_item.value ->> 'targetTableId');

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
    'view:' || project.id || ':erd:primary',
    project.id,
    'erd',
    'Primary ERD',
    'Compatibility ERD generated from legacy schemaJson',
    '{"objectTypes":["table"],"relationTypes":["references"]}'::jsonb,
    '{}'::jsonb,
    '{}'::jsonb,
    project."createdAt",
    project."updatedAt"
FROM "Project" project
WHERE jsonb_typeof(COALESCE(project."schemaJson" -> 'tables', '[]'::jsonb)) = 'array'
  AND jsonb_array_length(COALESCE(project."schemaJson" -> 'tables', '[]'::jsonb)) > 0;

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
    'view_node:' || project.id || ':erd:primary:' || COALESCE(table_item.value ->> 'id', table_item.ordinality::text),
    'view:' || project.id || ':erd:primary',
    'model:' || project.id || ':table:' || COALESCE(table_item.value ->> 'id', table_item.ordinality::text),
    COALESCE(NULLIF(table_item.value ->> 'x', '')::double precision, 0),
    COALESCE(NULLIF(table_item.value ->> 'y', '')::double precision, 0),
    NULL,
    NULL,
    false,
    true,
    '{}'::jsonb,
    '{}'::jsonb
FROM "Project" project
CROSS JOIN LATERAL jsonb_array_elements(
    CASE
        WHEN jsonb_typeof(COALESCE(project."schemaJson" -> 'tables', '[]'::jsonb)) = 'array'
            THEN COALESCE(project."schemaJson" -> 'tables', '[]'::jsonb)
        ELSE '[]'::jsonb
    END
) WITH ORDINALITY AS table_item(value, ordinality)
WHERE EXISTS (
    SELECT 1
    FROM "ModelView" view_item
    WHERE view_item.id = 'view:' || project.id || ':erd:primary'
);

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
    'view_edge:' || project.id || ':erd:primary:' || COALESCE(relation_item.value ->> 'id', relation_item.ordinality::text),
    'view:' || project.id || ':erd:primary',
    model_relation.id,
    source_node.id,
    target_node.id,
    true,
    NULL,
    true,
    '{}'::jsonb
FROM "Project" project
CROSS JOIN LATERAL jsonb_array_elements(
    CASE
        WHEN jsonb_typeof(COALESCE(project."schemaJson" -> 'relations', '[]'::jsonb)) = 'array'
            THEN COALESCE(project."schemaJson" -> 'relations', '[]'::jsonb)
        ELSE '[]'::jsonb
    END
) WITH ORDINALITY AS relation_item(value, ordinality)
JOIN "ModelRelation" model_relation
    ON model_relation.id = 'relation:' || project.id || ':references:' || COALESCE(relation_item.value ->> 'id', relation_item.ordinality::text)
JOIN "ViewNode" source_node
    ON source_node.id = 'view_node:' || project.id || ':erd:primary:' || COALESCE(relation_item.value ->> 'fromTableId', relation_item.value ->> 'sourceTableId')
JOIN "ViewNode" target_node
    ON target_node.id = 'view_node:' || project.id || ':erd:primary:' || COALESCE(relation_item.value ->> 'toTableId', relation_item.value ->> 'targetTableId');
