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
    (
        'object_type_function',
        'function',
        'Function',
        'Behavior',
        '{"properties":{"status":{"type":"string"},"decompositionDiagramId":{"type":"string"}}}'::jsonb,
        '["domain", "function"]'::jsonb,
        '["idef0_input", "idef0_control", "idef0_output", "idef0_mechanism", "decomposes", "references", "affects"]'::jsonb,
        'system',
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
    ),
    ('object_type_dataset', 'dataset', 'Dataset', 'Information', '{"properties":{"subtype":{"type":"string"},"status":{"type":"string"}}}'::jsonb, '["domain", "function"]'::jsonb, '["idef0_input", "idef0_output", "references", "affects"]'::jsonb, 'system', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('object_type_artifact', 'artifact', 'Artifact', 'Information', '{"properties":{"subtype":{"type":"string"},"status":{"type":"string"}}}'::jsonb, '["domain", "function"]'::jsonb, '["idef0_input", "idef0_output", "references", "affects"]'::jsonb, 'system', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('object_type_material_object', 'material_object', 'Material Object', 'Physical', '{"properties":{"status":{"type":"string"}}}'::jsonb, '["domain", "function"]'::jsonb, '["idef0_input", "idef0_output", "references", "affects"]'::jsonb, 'system', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('object_type_rule', 'rule', 'Rule / Constraint', 'Governance', '{"properties":{"subtype":{"type":"string"},"status":{"type":"string"}}}'::jsonb, '["domain"]'::jsonb, '["idef0_control", "references", "affects"]'::jsonb, 'system', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('object_type_actor', 'actor', 'Actor / Role', 'Behavior', '{"properties":{"subtype":{"type":"string"},"status":{"type":"string"}}}'::jsonb, '["domain"]'::jsonb, '["idef0_mechanism", "references", "affects"]'::jsonb, 'system', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

UPDATE "ObjectType"
SET
    "schema" = '{"properties":{"status":{"type":"string"}}}'::jsonb,
    "allowedParentTypes" = '["state_machine", "domain", "function"]'::jsonb,
    "allowedRelationTypes" = '["idef0_input", "idef0_output", "references", "affects"]'::jsonb,
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "id" = 'object_type_state';

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
    ('relation_type_idef0_input', 'idef0_input', 'IDEF0 Input', NULL, 'function', 'N:N', false, '{"role":"input","side":"left"}'::jsonb, 'system', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('relation_type_idef0_control', 'idef0_control', 'IDEF0 Control', NULL, 'function', 'N:N', false, '{"role":"control","side":"top"}'::jsonb, 'system', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('relation_type_idef0_output', 'idef0_output', 'IDEF0 Output', 'function', NULL, 'N:N', false, '{"role":"output","side":"right"}'::jsonb, 'system', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('relation_type_idef0_mechanism', 'idef0_mechanism', 'IDEF0 Mechanism', NULL, 'function', 'N:N', false, '{"role":"mechanism","side":"bottom"}'::jsonb, 'system', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('relation_type_decomposes', 'decomposes', 'Decomposes', 'function', 'function', '1:N', false, '{}'::jsonb, 'system', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
