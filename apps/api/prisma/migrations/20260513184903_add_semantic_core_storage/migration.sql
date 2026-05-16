-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "modelVersion" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "ontologyVersion" TEXT NOT NULL DEFAULT '2026-05-13';

-- CreateTable
CREATE TABLE "ObjectType" (
    "id" TEXT NOT NULL,
    "projectId" TEXT,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "icon" TEXT,
    "color" TEXT,
    "schema" JSONB NOT NULL DEFAULT '{}',
    "allowedParentTypes" JSONB,
    "allowedRelationTypes" JSONB,
    "scope" TEXT NOT NULL DEFAULT 'system',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ObjectType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RelationType" (
    "id" TEXT NOT NULL,
    "projectId" TEXT,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sourceType" TEXT,
    "targetType" TEXT,
    "cardinality" TEXT,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "scope" TEXT NOT NULL DEFAULT 'system',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RelationType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModelObject" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT,
    "description" TEXT,
    "domainId" TEXT,
    "parentId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "ModelObject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModelRelation" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "sourceObjectId" TEXT NOT NULL,
    "targetObjectId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "direction" TEXT NOT NULL DEFAULT 'directed',
    "cardinalitySource" TEXT,
    "cardinalityTarget" TEXT,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "ModelRelation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModelView" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "scope" JSONB NOT NULL DEFAULT '{}',
    "filters" JSONB NOT NULL DEFAULT '{}',
    "settings" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "ModelView_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ViewNode" (
    "id" TEXT NOT NULL,
    "viewId" TEXT NOT NULL,
    "objectId" TEXT NOT NULL,
    "x" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "y" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "width" DOUBLE PRECISION,
    "height" DOUBLE PRECISION,
    "collapsed" BOOLEAN NOT NULL DEFAULT false,
    "visible" BOOLEAN NOT NULL DEFAULT true,
    "style" JSONB NOT NULL DEFAULT '{}',
    "settings" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "ViewNode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ViewEdge" (
    "id" TEXT NOT NULL,
    "viewId" TEXT NOT NULL,
    "relationId" TEXT,
    "sourceViewNodeId" TEXT NOT NULL,
    "targetViewNodeId" TEXT NOT NULL,
    "isModelRelation" BOOLEAN NOT NULL DEFAULT true,
    "routing" JSONB,
    "visible" BOOLEAN NOT NULL DEFAULT true,
    "style" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "ViewEdge_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ObjectType_projectId_key_idx" ON "ObjectType"("projectId", "key");

-- CreateIndex
CREATE INDEX "ObjectType_key_idx" ON "ObjectType"("key");

-- CreateIndex
CREATE INDEX "ObjectType_scope_idx" ON "ObjectType"("scope");

-- CreateIndex
CREATE INDEX "RelationType_projectId_key_idx" ON "RelationType"("projectId", "key");

-- CreateIndex
CREATE INDEX "RelationType_key_idx" ON "RelationType"("key");

-- CreateIndex
CREATE INDEX "RelationType_sourceType_targetType_idx" ON "RelationType"("sourceType", "targetType");

-- CreateIndex
CREATE INDEX "RelationType_scope_idx" ON "RelationType"("scope");

-- CreateIndex
CREATE INDEX "ModelObject_projectId_type_idx" ON "ModelObject"("projectId", "type");

-- CreateIndex
CREATE INDEX "ModelObject_projectId_parentId_idx" ON "ModelObject"("projectId", "parentId");

-- CreateIndex
CREATE INDEX "ModelObject_projectId_domainId_idx" ON "ModelObject"("projectId", "domainId");

-- CreateIndex
CREATE INDEX "ModelObject_projectId_slug_idx" ON "ModelObject"("projectId", "slug");

-- CreateIndex
CREATE INDEX "ModelObject_projectId_updatedAt_idx" ON "ModelObject"("projectId", "updatedAt");

-- CreateIndex
CREATE INDEX "ModelObject_deletedAt_idx" ON "ModelObject"("deletedAt");

-- CreateIndex
CREATE INDEX "ModelRelation_projectId_type_idx" ON "ModelRelation"("projectId", "type");

-- CreateIndex
CREATE INDEX "ModelRelation_projectId_sourceObjectId_idx" ON "ModelRelation"("projectId", "sourceObjectId");

-- CreateIndex
CREATE INDEX "ModelRelation_projectId_targetObjectId_idx" ON "ModelRelation"("projectId", "targetObjectId");

-- CreateIndex
CREATE INDEX "ModelRelation_deletedAt_idx" ON "ModelRelation"("deletedAt");

-- CreateIndex
CREATE INDEX "ModelView_projectId_type_idx" ON "ModelView"("projectId", "type");

-- CreateIndex
CREATE INDEX "ModelView_projectId_updatedAt_idx" ON "ModelView"("projectId", "updatedAt");

-- CreateIndex
CREATE INDEX "ModelView_deletedAt_idx" ON "ModelView"("deletedAt");

-- CreateIndex
CREATE INDEX "ViewNode_viewId_objectId_idx" ON "ViewNode"("viewId", "objectId");

-- CreateIndex
CREATE INDEX "ViewNode_objectId_idx" ON "ViewNode"("objectId");

-- CreateIndex
CREATE INDEX "ViewEdge_viewId_idx" ON "ViewEdge"("viewId");

-- CreateIndex
CREATE INDEX "ViewEdge_relationId_idx" ON "ViewEdge"("relationId");

-- CreateIndex
CREATE INDEX "ViewEdge_sourceViewNodeId_idx" ON "ViewEdge"("sourceViewNodeId");

-- CreateIndex
CREATE INDEX "ViewEdge_targetViewNodeId_idx" ON "ViewEdge"("targetViewNodeId");

-- AddForeignKey
ALTER TABLE "ObjectType" ADD CONSTRAINT "ObjectType_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RelationType" ADD CONSTRAINT "RelationType_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModelObject" ADD CONSTRAINT "ModelObject_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModelObject" ADD CONSTRAINT "ModelObject_domainId_fkey" FOREIGN KEY ("domainId") REFERENCES "ModelObject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModelObject" ADD CONSTRAINT "ModelObject_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "ModelObject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModelRelation" ADD CONSTRAINT "ModelRelation_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModelRelation" ADD CONSTRAINT "ModelRelation_sourceObjectId_fkey" FOREIGN KEY ("sourceObjectId") REFERENCES "ModelObject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModelRelation" ADD CONSTRAINT "ModelRelation_targetObjectId_fkey" FOREIGN KEY ("targetObjectId") REFERENCES "ModelObject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModelView" ADD CONSTRAINT "ModelView_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ViewNode" ADD CONSTRAINT "ViewNode_viewId_fkey" FOREIGN KEY ("viewId") REFERENCES "ModelView"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ViewNode" ADD CONSTRAINT "ViewNode_objectId_fkey" FOREIGN KEY ("objectId") REFERENCES "ModelObject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ViewEdge" ADD CONSTRAINT "ViewEdge_viewId_fkey" FOREIGN KEY ("viewId") REFERENCES "ModelView"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ViewEdge" ADD CONSTRAINT "ViewEdge_relationId_fkey" FOREIGN KEY ("relationId") REFERENCES "ModelRelation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ViewEdge" ADD CONSTRAINT "ViewEdge_sourceViewNodeId_fkey" FOREIGN KEY ("sourceViewNodeId") REFERENCES "ViewNode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ViewEdge" ADD CONSTRAINT "ViewEdge_targetViewNodeId_fkey" FOREIGN KEY ("targetViewNodeId") REFERENCES "ViewNode"("id") ON DELETE CASCADE ON UPDATE CASCADE;
