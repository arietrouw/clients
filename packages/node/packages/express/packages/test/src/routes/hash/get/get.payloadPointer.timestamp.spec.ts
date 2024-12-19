import { assertEx } from '@xylabs/assert'
import { delay } from '@xylabs/delay'
import type { AccountInstance } from '@xyo-network/account'
import { Account } from '@xyo-network/account'
import { PayloadBuilder } from '@xyo-network/payload-builder'
import type { Payload } from '@xyo-network/payload-model'
import {
  beforeAll, describe, expect, it,
} from 'vitest'

import {
  getHash, getNewBoundWitness, insertBlock, insertPayload,
} from '../../../testUtil/index.js'
import { createPointer, expectHashNotFoundError } from './get.payloadPointer.spec.js'

describe('/:hash', () => {
  describe('with rules for [timestamp]', () => {
    let account: AccountInstance
    let payloads: Payload[]
    let expectedSchema: string
    beforeAll(async () => {
      account = await Account.random()
      const [bwA, payloadsA] = await getNewBoundWitness([account])
      await delay(100) // to ensure different timestamps
      const [bwB, payloadsB] = await getNewBoundWitness([account])
      await delay(100) // to ensure different timestamps
      const [bwC, payloadsC] = await getNewBoundWitness([account])
      payloads = [...payloadsA, ...payloadsB, ...payloadsC]
      const boundWitnesses = [bwA, bwB, bwC]
      expectedSchema = payloadsA[0].schema
      for (const bw of boundWitnesses) {
        const blockResponse = await insertBlock(bw, account)
        expect(blockResponse.length).toBe(1)
      }
      const payloadResponse = await insertPayload(payloads)
      expect(payloadResponse.length).toBe(payloads.length)
    })
    it('ascending', async () => {
      const expected = assertEx(payloads.at(0))
      const pointerHash = await createPointer([[account.address]], [[expectedSchema]], 'asc')
      const result = await getHash(pointerHash)
      expect(PayloadBuilder.omitStorageMeta(result)).toEqual(expected)
    })
    it('descending', async () => {
      const expected = assertEx(payloads.at(-1))
      const pointerHash = await createPointer([[account.address]], [[expectedSchema]], 'desc')
      const result = await getHash(pointerHash)
      expect(PayloadBuilder.omitStorageMeta(result)).toEqual(expected)
    })
    it('no matching timestamp', async () => {
      const pointerHash = await createPointer([[account.address]], [[expectedSchema]], 'asc')
      const result = await getHash(pointerHash)
      expectHashNotFoundError(result)
    })
  })
})
