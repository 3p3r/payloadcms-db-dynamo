import type {
  AttributeDefinition,
  CreateTableCommandInput,
  GlobalSecondaryIndex,
  KeySchemaElement,
} from '@aws-sdk/client-dynamodb'

export const TABLE_KEY_ATTRS = {
  pk: 'pk',
  sk: 'sk',
  gsi1pk: 'gsi1pk',
  gsi1sk: 'gsi1sk',
  gsi2pk: 'gsi2pk',
  gsi2sk: 'gsi2sk',
  geohash: 'geohash',
} as const

export function buildCreateTableInput(tableName: string): CreateTableCommandInput {
  const attributeDefinitions: AttributeDefinition[] = [
    { AttributeName: 'pk', AttributeType: 'S' },
    { AttributeName: 'sk', AttributeType: 'S' },
    { AttributeName: 'gsi1pk', AttributeType: 'S' },
    { AttributeName: 'gsi1sk', AttributeType: 'S' },
    { AttributeName: 'gsi2pk', AttributeType: 'S' },
    { AttributeName: 'gsi2sk', AttributeType: 'S' },
    { AttributeName: 'geohash', AttributeType: 'S' },
  ]

  const keySchema: KeySchemaElement[] = [
    { AttributeName: 'pk', KeyType: 'HASH' },
    { AttributeName: 'sk', KeyType: 'RANGE' },
  ]

  const globalSecondaryIndexes: GlobalSecondaryIndex[] = [
    {
      IndexName: 'gsi1',
      KeySchema: [
        { AttributeName: 'gsi1pk', KeyType: 'HASH' },
        { AttributeName: 'gsi1sk', KeyType: 'RANGE' },
      ],
      Projection: { ProjectionType: 'ALL' },
    },
    {
      IndexName: 'gsi2',
      KeySchema: [
        { AttributeName: 'gsi2pk', KeyType: 'HASH' },
        { AttributeName: 'gsi2sk', KeyType: 'RANGE' },
      ],
      Projection: { ProjectionType: 'ALL' },
    },
    {
      IndexName: 'geo-index',
      KeySchema: [
        { AttributeName: 'pk', KeyType: 'HASH' },
        { AttributeName: 'geohash', KeyType: 'RANGE' },
      ],
      Projection: { ProjectionType: 'ALL' },
    },
  ]

  return {
    TableName: tableName,
    AttributeDefinitions: attributeDefinitions,
    KeySchema: keySchema,
    GlobalSecondaryIndexes: globalSecondaryIndexes,
    BillingMode: 'PAY_PER_REQUEST',
  }
}

export const ENTITY_KEY_TEMPLATES = {
  collectionDoc: 'pk={collectionSlug}, sk={id}',
  global: 'pk={globalSlug}, sk={globalSlug}',
  collectionVersion: 'pk={slug}_versions, sk={versionId}',
  invertedIndex: 'pk=IDX#{slug}#{path}#{value}, sk={id}',
  listSpine: 'gsi1pk=COL#{slug}#LIST, gsi1sk={sortKey}#DOC#{id}',
  versionLatest: 'gsi1pk=COL#{slug}#VER#LATEST (pointer row), gsi1sk={updatedAt}#VER#{versionId}',
  versionParent: 'gsi1pk=VER#{slug}#PARENT#{parentId}, gsi1sk={updatedAt}#VER#{versionId}',
  geoCell: 'pk=GEO#{slug}#{field}#{hashPrefix}, geohash={geohash}, sk=DOC#{id}',
} as const
