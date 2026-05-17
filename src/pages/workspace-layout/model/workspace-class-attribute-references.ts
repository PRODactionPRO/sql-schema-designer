import type { ClassAttributeValueType, ProjectData } from '@/shared/types/project';
import type { Idef0DataReference } from '@/shared/types/idef0';
import { getClassDiagram, getObjectBinding, getProjectDomains } from './workspace-project-utils';

const CLASS_ATTRIBUTE_LEGACY_PREFIX = 'class_attr::';

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function normalizeValueType(value: unknown): string | undefined {
  const next = asString(value);
  if (!next) return undefined;
  const normalized = next.trim().toLowerCase();
  if (
    normalized === 'string'
    || normalized === 'number'
    || normalized === 'boolean'
    || normalized === 'date'
    || normalized === 'datetime'
    || normalized === 'uuid'
    || normalized === 'json'
    || normalized === 'enum'
    || normalized === 'reference'
    || normalized === 'custom'
  ) {
    return normalized as ClassAttributeValueType;
  }
  return normalized;
}

function toDataRefId(legacyId: string, objectId?: string): string {
  return objectId ?? legacyId;
}

export function buildClassAttributeReferenceOptions(project: ProjectData): Idef0DataReference[] {
  const domainById = new Map(getProjectDomains(project).map((domain) => [domain.id, domain.name]));
  const classDiagram = getClassDiagram(project);
  const refsByLegacyId = new Map<string, Idef0DataReference>();

  for (const entity of classDiagram?.classes ?? []) {
    for (const attribute of entity.attributes) {
      const legacyId = `${CLASS_ATTRIBUTE_LEGACY_PREFIX}${entity.id}::${attribute.id}`;
      const binding = getObjectBinding(project, legacyId);
      refsByLegacyId.set(legacyId, {
        id: toDataRefId(legacyId, binding?.objectId),
        objectId: binding?.objectId,
        legacyId,
        classId: entity.id,
        className: entity.name,
        attributeId: attribute.id,
        attributeName: attribute.name,
        valueType: normalizeValueType(attribute.valueType ?? attribute.type) ?? 'custom',
        domainId: entity.domainId,
        domainName: entity.domainId ? domainById.get(entity.domainId) : undefined,
      });
    }
  }

  for (const [legacyId, binding] of Object.entries(project.semantic?.objectsByLegacyId ?? {})) {
    if (!legacyId.startsWith(CLASS_ATTRIBUTE_LEGACY_PREFIX)) continue;
    const metadata = isRecord(binding.metadata) ? binding.metadata : {};
    const existing = refsByLegacyId.get(legacyId);
    const classId = asString(metadata.classId) ?? existing?.classId;
    const domainId = asString(metadata.domainId) ?? existing?.domainId;

    refsByLegacyId.set(legacyId, {
      id: toDataRefId(legacyId, binding.objectId ?? existing?.objectId),
      objectId: binding.objectId ?? existing?.objectId,
      legacyId,
      classId,
      className: asString(metadata.className) ?? existing?.className ?? classId ?? 'Class',
      attributeId: asString(metadata.attributeId) ?? existing?.attributeId,
      attributeName: asString(metadata.attributeName) ?? asString(metadata.name) ?? existing?.attributeName ?? 'attribute',
      valueType: normalizeValueType(metadata.valueType) ?? existing?.valueType ?? normalizeValueType(metadata.type) ?? 'custom',
      domainId,
      domainName: asString(metadata.domainName) ?? (domainId ? domainById.get(domainId) : undefined) ?? existing?.domainName,
    });
  }

  return [...refsByLegacyId.values()].sort((a, b) => {
    const domainA = (a.domainName ?? '').toLowerCase();
    const domainB = (b.domainName ?? '').toLowerCase();
    if (domainA !== domainB) return domainA.localeCompare(domainB);

    const classA = (a.className ?? '').toLowerCase();
    const classB = (b.className ?? '').toLowerCase();
    if (classA !== classB) return classA.localeCompare(classB);

    return a.attributeName.toLowerCase().localeCompare(b.attributeName.toLowerCase());
  });
}
