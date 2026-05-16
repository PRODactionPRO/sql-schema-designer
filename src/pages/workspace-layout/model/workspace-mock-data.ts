import type { TabType } from './types';

export const DIAGRAM_LINK_PATHS = [
  'M140 130 C260 120 320 190 420 180',
  'M220 445 C350 405 430 420 560 350',
  'M560 270 C730 260 820 220 1010 150',
  'M700 430 C830 440 920 510 1080 500',
];

export const DIAGRAM_ENTITIES = [
  {
    title: 'ProductAudienceFit',
    accent: '#d5a176',
    positionClassName: 'left-[7%] top-[5%]',
    rows: ['id', 'publicId', 'brandId', 'productId', 'audienceSegmentId', 'status', 'metadata'],
  },
  {
    title: 'AlternateSolution',
    accent: '#d49c73',
    positionClassName: 'left-[32%] top-[7%]',
    rows: ['id', 'publicId', 'productAudienceFitId', 'competitorProductId', 'name', 'type'],
  },
  {
    title: 'CustomerJourney',
    accent: '#d4af69',
    positionClassName: 'left-[27%] top-[47%]',
    rows: ['id', 'publicId', 'brandId', 'audienceSegmentId', 'name', 'description'],
  },
  {
    title: 'JourneyStage',
    accent: '#f39b12',
    selected: true,
    positionClassName: 'left-[50%] top-[39%]',
    rows: ['id', 'publicId', 'customerJourneyId', 'name', 'stageType', 'customerTriggers', 'sortOrder'],
  },
  {
    title: 'ContextPreset',
    accent: '#8a82c8',
    positionClassName: 'right-[4%] top-[22%]',
    rows: ['id', 'publicId', 'brandId', 'key', 'name', 'taskType', 'rules'],
  },
  {
    title: 'JourneyStageType',
    accent: '#d7ba77',
    positionClassName: 'right-[20%] bottom-[17%]',
    rows: ['unaware', 'problem_aware', 'solution_aware', 'trial', 'purchase'],
  },
];

export const CLASS_DIAGRAM_GROUPS = [
  ['Domain Model', 'Entity', 'Value Object', 'Aggregate'],
  ['Application', 'Command', 'Query', 'Use Case'],
  ['Infrastructure', 'Repository', 'Adapter', 'Mapper'],
];

export const ASSISTANT_CHECKS = ['Schema consistency', 'Relation naming', 'Missing lifecycle events'];

export const CODE_MODE_SNIPPET = `entity("JourneyStage", {
  id: bigint().primary(),
  customerJourneyId: relation("CustomerJourney"),
  name: text().required(),
  stageType: enumRef("JourneyStageType"),
  sortOrder: integer()
})`;

export const TABLE_ITEMS = ['ProductAudienceFit', 'AlternateSolution', 'CustomerJourney', 'JourneyStage', 'ContextPreset'];

export const PROPERTY_ROWS = [
  ['Domain', 'Customer Journey'],
  ['Primary key', 'id'],
  ['Status', 'active'],
  ['Relations', '2 inbound / 1 outbound'],
];

export const EVENT_ROWS = [
  ['AudienceMatched', 'ProductAudienceFit'],
  ['JourneyStageCreated', 'CustomerJourney'],
  ['CompetitorLinked', 'AlternateSolution'],
];

export const SEMANTIC_LISTS = {
  schemas: ['Data Design Schema', 'Live DB Schema', 'Public API Schema', 'Analytics Schema'],
  domains: ['Brand', 'Audience', 'Journey', 'Context', 'Competitor'],
  entities: ['ProductAudienceFit', 'AlternateSolution', 'CustomerJourney', 'JourneyStage'],
};

export const GENERIC_ROWS_BY_TYPE: Partial<Record<TabType, string[]>> = {
  dependencyGraph: ['Project', 'Documents', 'Entities', 'Events', 'API'],
  lifecycle: ['draft', 'active', 'archived', 'deleted'],
  impact: ['2 relations', '3 events', '1 API contract', '5 generated types'],
  process: ['Discovery', 'Design', 'Validation', 'Publishing'],
  functions: ['normalizeSchema()', 'validateRelations()', 'generateDDL()'],
  scenario: ['Create segment', 'Map journey', 'Review impact', 'Publish schema'],
  trace: ['Action', 'Command', 'Event', 'Projection'],
  validation: ['No orphan relations', 'Enum coverage 92%', 'Descriptions 68%'],
  history: ['Added JourneyStage', 'Renamed stageType', 'Linked ContextPreset'],
  permissions: ['Admin', 'Architect', 'Analyst', 'Viewer'],
  apiContract: ['GET /schemas', 'POST /entities', 'PATCH /relations'],
  dataSamples: ['CustomerJourney #184', 'JourneyStage #912', 'ContextPreset #44'],
  file: ['schema.json', 'revisions.log', 'exports', 'assets'],
  assets: ['live-db-schema.json', 'schema-snapshot.png', 'openapi.yaml'],
  actions: ['Create entity', 'Link relation', 'Generate migration'],
};
