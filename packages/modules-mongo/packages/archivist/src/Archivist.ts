import { exists } from '@xylabs/exists'
import { Hash } from '@xylabs/hex'
import { AnyObject } from '@xylabs/object'
import { fulfilledValues } from '@xylabs/promise'
import { AbstractArchivist } from '@xyo-network/archivist-abstract'
import { ArchivistConfigSchema, ArchivistInsertQuerySchema } from '@xyo-network/archivist-model'
import { MongoDBArchivistConfigSchema } from '@xyo-network/archivist-model-mongodb'
import { MongoDBModuleMixin } from '@xyo-network/module-abstract-mongodb'
import { PayloadBuilder } from '@xyo-network/payload-builder'
import { Payload, WithMeta } from '@xyo-network/payload-model'
import { PayloadWithMongoMeta, PayloadWithPartialMongoMeta } from '@xyo-network/payload-mongodb'
import { PayloadWrapper } from '@xyo-network/payload-wrapper'

import { toPayloadWithMongoMeta, toReturnValue, validByType } from './lib'

const MongoDBArchivistBase = MongoDBModuleMixin(AbstractArchivist)

export class MongoDBArchivist extends MongoDBArchivistBase {
  static override configSchemas = [MongoDBArchivistConfigSchema, ArchivistConfigSchema]

  override readonly queries: string[] = [ArchivistInsertQuerySchema, ...super.queries]

  override async head(): Promise<Payload | undefined> {
    const head = await (await this.payloads.find({})).sort({ _timestamp: -1 }).limit(1).toArray()
    return head[0] ? (await PayloadWrapper.wrap(head[0])).jsonPayload() : undefined
  }

  protected override async getHandler(hashes: string[]): Promise<Payload[]> {
    let remainingHashes = [...hashes]

    const dataPayloads = (await Promise.all(remainingHashes.map((_$hash) => this.payloads.findOne({ _$hash })))).filter(exists)
    const dataPayloadsHashes = dataPayloads.map((payload) => payload._$hash)
    remainingHashes = remainingHashes.filter((hash) => !dataPayloadsHashes.includes(hash))

    const dataBws = (await Promise.all(remainingHashes.map((_$hash) => this.boundWitnesses.findOne({ _$hash })))).filter(exists)
    const dataBwsHashes = dataBws.map((payload) => payload._$hash)
    remainingHashes = remainingHashes.filter((hash) => !dataBwsHashes.includes(hash))

    const payloads = (await Promise.all(remainingHashes.map((_hash) => this.payloads.findOne({ _hash })))).filter(exists)
    const payloadsHashes = payloads.map((payload) => payload._hash)
    remainingHashes = remainingHashes.filter((hash) => !payloadsHashes.includes(hash))

    const bws = (await Promise.all(remainingHashes.map((_hash) => this.boundWitnesses.findOne({ _hash })))).filter(exists)
    const bwsHashes = bws.map((payload) => payload._hash)
    remainingHashes = remainingHashes.filter((hash) => !bwsHashes.includes(hash))

    const foundPayloads = [...dataPayloads, ...dataBws, ...payloads, ...bws] as PayloadWithMongoMeta<Payload & { _$meta?: unknown; _$hash: Hash }>[]
    return foundPayloads.map(({ _$hash, _$meta, ...other }) => ({ $hash: _$hash, $meta: _$meta, ...other })).map(toReturnValue)
  }

  protected override async insertHandler(payloads: Payload[]): Promise<Payload[]> {
    const payloadsWithMeta = await Promise.all(
      payloads.map(async (payload) => {
        const p = (await PayloadBuilder.build(payload)) as AnyObject
        //switch $ fields to _$ fields since mongo uses $
        if (p.$hash) {
          p._$hash = p.$hash
          delete p.$hash
        }
        if (p.$meta) {
          p._$meta = p.$meta
          delete p.$meta
        }
        return p as Payload
      }),
    )

    const [bw, p] = await validByType(payloads)
    const payloadsWithExternalMeta = await Promise.all(p.map((x) => toPayloadWithMongoMeta(x)))
    if (payloadsWithMeta.length) {
      const payloadsResult = await this.payloads.insertMany(payloadsWithExternalMeta)
      if (!payloadsResult.acknowledged || payloadsResult.insertedCount !== payloadsWithExternalMeta.length)
        throw new Error('MongoDBDeterministicArchivist: Error inserting Payloads')
    }
    const boundWitnessesWithExternalMeta = await Promise.all(bw.map((x) => toPayloadWithMongoMeta(x)))
    if (boundWitnessesWithExternalMeta.length) {
      const boundWitnessesResult = await this.boundWitnesses.insertMany(boundWitnessesWithExternalMeta)
      if (!boundWitnessesResult.acknowledged || boundWitnessesResult.insertedCount !== boundWitnessesWithExternalMeta.length)
        throw new Error('MongoDBDeterministicArchivist: Error inserting BoundWitnesses')
    }

    return payloadsWithMeta
  }

  protected override async startHandler() {
    await super.startHandler()
    await this.ensureIndexes()
    return true
  }
}
