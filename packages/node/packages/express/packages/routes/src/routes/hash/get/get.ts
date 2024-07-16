import { Hash } from '@xylabs/hex'
import { asyncHandler, NoReqBody, NoReqQuery } from '@xylabs/sdk-api-express-ecs'
import { setRawResponseFormat } from '@xyo-network/express-node-middleware'
import { Payload } from '@xyo-network/payload-model'
import { RequestHandler } from 'express'
import { StatusCodes } from 'http-status-codes'

import { getBlockForRequest } from './getBlockForRequest.js'
import { HashPathParams } from './HashPathParams.js'

const reservedHashes = new Set(['archive', 'schema', 'doc', 'domain'])

// eslint-disable-next-line @typescript-eslint/no-misused-promises
const handler: RequestHandler<HashPathParams, Payload, NoReqBody, NoReqQuery> = async (req, res, next) => {
  if (res.headersSent) {
    return
  }
  const { hash } = req.params
  if (!hash) {
    next({ message: 'Hash not supplied', statusCode: StatusCodes.BAD_REQUEST })
    return
  }
  if (reservedHashes.has(hash)) {
    next()
    return
  }
  const block = await getBlockForRequest(req, hash as Hash)
  if (block) {
    setRawResponseFormat(res)
    res.json(block)
    return
  }
  next({ message: 'Hash not found', statusCode: StatusCodes.NOT_FOUND })
}

export const getByHash = asyncHandler(handler)
