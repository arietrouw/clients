import { BoundWitness } from '@xyo-network/boundwitness-model'

import { PayloadWithPartialMongoMeta } from '../Payload/index.js'
import { BoundWitnessMongoMeta } from './BoundWitnessMeta.js'

export type BoundWitnessWithMongoMeta<
  T extends BoundWitness = BoundWitness,
  P extends PayloadWithPartialMongoMeta<T> = PayloadWithPartialMongoMeta<T>,
> = T & BoundWitnessMongoMeta<P>

export type BoundWitnessWithPartialMongoMeta<
  T extends BoundWitness = BoundWitness,
  P extends PayloadWithPartialMongoMeta<T> = PayloadWithPartialMongoMeta<T>,
> = T & Partial<BoundWitnessMongoMeta<P>>
