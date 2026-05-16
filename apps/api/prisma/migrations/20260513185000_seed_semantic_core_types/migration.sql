-- Seed the first system ontology used by the semantic core.
-- These rows are global (`projectId` is null) and can be extended later with
-- project-specific custom types.

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
    ('object_type_domain', 'domain', 'Domain', 'Domain', '{}'::jsonb, '[]'::jsonb, '["contains", "references", "affects"]'::jsonb, 'system', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('object_type_entity', 'entity', 'Entity', 'Domain', '{"properties":{"attributes":{"type":"array"}}}'::jsonb, '["domain"]'::jsonb, '["contains", "has_attribute", "maps_to", "uses", "references", "affects"]'::jsonb, 'system', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('object_type_table', 'table', 'Table', 'Data', '{"properties":{"columns":{"type":"array"}}}'::jsonb, '["domain", "database"]'::jsonb, '["contains", "maps_to", "references", "affects"]'::jsonb, 'system', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('object_type_event', 'event', 'Event', 'Event', '{}'::jsonb, '["domain"]'::jsonb, '["emits", "consumes", "triggers", "references", "affects"]'::jsonb, 'system', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('object_type_api_endpoint', 'api_endpoint', 'API Endpoint', 'API', '{"properties":{"method":{"type":"string"},"path":{"type":"string"},"authRequired":{"type":"boolean"}}}'::jsonb, '["api_contract"]'::jsonb, '["calls", "accepts", "returns", "references", "affects"]'::jsonb, 'system', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('object_type_use_case', 'use_case', 'Use Case', 'Behavior', '{}'::jsonb, '["domain"]'::jsonb, '["calls", "emits", "uses", "references", "affects"]'::jsonb, 'system', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('object_type_decision', 'decision', 'Decision', 'Governance', '{}'::jsonb, '["domain"]'::jsonb, '["affects", "references", "supersedes"]'::jsonb, 'system', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('object_type_document', 'document', 'Document', 'Documentation', '{"properties":{"format":{"type":"string"}}}'::jsonb, '["domain"]'::jsonb, '["references", "affects"]'::jsonb, 'system', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

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
    ('relation_type_contains', 'contains', 'Contains', NULL, NULL, '1:N', false, '{}'::jsonb, 'system', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('relation_type_has_attribute', 'has_attribute', 'Has attribute', 'entity', NULL, '1:N', false, '{}'::jsonb, 'system', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('relation_type_maps_to', 'maps_to', 'Maps to', NULL, NULL, 'N:N', false, '{}'::jsonb, 'system', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('relation_type_uses', 'uses', 'Uses', NULL, NULL, 'N:N', false, '{}'::jsonb, 'system', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('relation_type_emits', 'emits', 'Emits', NULL, 'event', 'N:N', false, '{}'::jsonb, 'system', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('relation_type_calls', 'calls', 'Calls', NULL, NULL, 'N:N', false, '{}'::jsonb, 'system', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('relation_type_references', 'references', 'References', NULL, NULL, 'N:N', false, '{}'::jsonb, 'system', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('relation_type_affects', 'affects', 'Affects', NULL, NULL, 'N:N', false, '{}'::jsonb, 'system', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
