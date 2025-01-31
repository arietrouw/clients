import type { ArchivistConfig } from '@xyo-network/archivist-model'
import type { BaseMongoSdkPublicConfig } from '@xyo-network/sdk-xyo-mongo-js'

import type { MongoDBArchivistConfigSchema } from './Schema.ts'

export type MongoDBArchivistConfigV2 = ArchivistConfig<{
  payloadSdkConfig?: Partial<BaseMongoSdkPublicConfig>
  schema: MongoDBArchivistConfigSchema
}>
