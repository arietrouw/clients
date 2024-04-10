import { flatten } from '@xylabs/array'
import { exists } from '@xylabs/exists'
import { hexFromHexString } from '@xylabs/hex'
import { BoundWitness } from '@xyo-network/boundwitness-model'
import { BoundWitnessDiviner } from '@xyo-network/diviner-boundwitness-abstract'
import {
  BoundWitnessDivinerConfigSchema,
  BoundWitnessDivinerQueryPayload,
  isBoundWitnessDivinerQueryPayload,
} from '@xyo-network/diviner-boundwitness-model'
import { DefaultLimit, DefaultMaxTimeMS, DefaultOrder, MongoDBModuleMixin } from '@xyo-network/module-abstract-mongodb'
import { Payload } from '@xyo-network/payload-model'
import { BoundWitnessWithMongoMeta, fromDbRepresentation } from '@xyo-network/payload-mongodb'
import { Filter, SortDirection } from 'mongodb'

const MongoDBDivinerBase = MongoDBModuleMixin(BoundWitnessDiviner)

export class MongoDBBoundWitnessDiviner extends MongoDBDivinerBase {
  static override configSchemas = [BoundWitnessDivinerConfigSchema]

  protected override async divineHandler(payloads?: Payload[]): Promise<BoundWitness[]> {
    const query = payloads?.find<BoundWitnessDivinerQueryPayload>(isBoundWitnessDivinerQueryPayload)
    // TODO: Support multiple queries
    if (!query) return []
    // NOTE: We're supporting address (which is deprecated) until we can ensure that all
    // clients are using addresses
    const { address, addresses, destination, hash, limit, offset, order, payload_hashes, payload_schemas, sourceQuery, timestamp } = query
    const parsedLimit = limit || DefaultLimit
    const parsedOrder = order || DefaultOrder
    const parsedOffset = offset || 0
    const sort: { [key: string]: SortDirection } = { _timestamp: parsedOrder === 'asc' ? 1 : -1 }
    const filter: Filter<BoundWitnessWithMongoMeta> = {}
    if (timestamp) {
      // TODO: Should we sort by timestamp instead of _timestamp here as well?
      filter._timestamp = parsedOrder === 'desc' ? { $exists: true, $lt: timestamp } : { $exists: true, $gt: timestamp }
    }

    // NOTE: Defaulting to $all since it makes the most sense when singing addresses are supplied
    // but based on how MongoDB implements multi-key indexes $in might be much faster and we could
    // solve the multi-sig problem via multiple API calls when multi-sig is desired instead of
    // potentially impacting performance for all single-address queries
    const allAddresses = flatten(address, addresses)
      .map((x) => hexFromHexString(x, { prefix: false }))
      .filter(exists)
    if (allAddresses.length > 0) filter.addresses = allAddresses.length === 1 ? allAddresses[0] : { $all: allAddresses }
    if (payload_hashes?.length) filter.payload_hashes = { $in: payload_hashes }
    if (payload_schemas?.length) filter.payload_schemas = { $all: payload_schemas }
    if (sourceQuery) filter['_$meta.sourceQuery'] = sourceQuery
    if (destination?.length) filter['_$meta.destination'] = { $in: destination }
    if (hash) {
      const filter1 = { ...filter }
      if (hash) filter1._hash = hash
      const resultSetOne = (
        await (await this.boundWitnesses.find(filter1)).sort(sort).skip(parsedOffset).limit(parsedLimit).maxTimeMS(DefaultMaxTimeMS).toArray()
      ).map(fromDbRepresentation)

      const filter2 = { ...filter }
      if (hash) filter2._$hash = hash
      const resultSetTwo = (
        await (await this.boundWitnesses.find(filter2)).sort(sort).skip(parsedOffset).limit(parsedLimit).maxTimeMS(DefaultMaxTimeMS).toArray()
      ).map(fromDbRepresentation)
      const result = [...resultSetOne, ...resultSetTwo].map(fromDbRepresentation) as BoundWitness[]
      return result
    } else {
      const result = (
        await (await this.boundWitnesses.find(filter)).sort(sort).skip(parsedOffset).limit(parsedLimit).maxTimeMS(DefaultMaxTimeMS).toArray()
      ).map(fromDbRepresentation) as BoundWitness[]
      return result
    }
  }

  protected override async startHandler() {
    await super.startHandler()
    await this.ensureIndexes()
    return true
  }
}
