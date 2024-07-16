import { config } from 'dotenv'
config()
import { disableGloballyUnique } from '@xylabs/object'
import { HDWallet } from '@xyo-network/account'
import { getApp } from '@xyo-network/express-node-server'
import { canAddMongoModules } from '@xyo-network/node-core-modules-mongo'
import { WALLET_PATHS } from '@xyo-network/node-core-types'
import { MemoryNode, MemoryNodeParams } from '@xyo-network/node-memory'
import { PayloadValidator } from '@xyo-network/payload-validator'
import { SchemaNameValidator } from '@xyo-network/schema-name-validator'
import { Express } from 'express'
import { Config } from 'jest'
import { MongoMemoryReplSet } from 'mongodb-memory-server'
import supertest from 'supertest'
// eslint-disable-next-line import/no-internal-modules
import type TestAgent from 'supertest/lib/agent.js'

disableGloballyUnique()

// Augment global scope with shared variables (must be var)
declare global {
  // eslint-disable-next-line no-var
  var app: Express
  // eslint-disable-next-line no-var
  var mongo: MongoMemoryReplSet
  // eslint-disable-next-line no-var
  var req: TestAgent
}

const database = process.env.MONGO_DATABASE || 'archivist'

const setupMongo = async () => {
  console.log('Mongo: Starting')
  // https://nodkz.async github.io/mongodb-memory-server/docs/guides/quick-start-guide/#replicaset
  // This will create an new instance of "MongoMemoryReplSet" and automatically start all Servers
  // To use Transactions, the "storageEngine" needs to be changed to `wiredTiger`
  const mongo = await MongoMemoryReplSet.create({
    instanceOpts: [
      { port: 55_391, replicaMemberConfig: { buildIndexes: true } },
      { port: 55_392, replicaMemberConfig: { arbiterOnly: true, buildIndexes: true } },
      { port: 55_393, replicaMemberConfig: { arbiterOnly: true, buildIndexes: true } },
    ],
    replSet: { count: 3, storageEngine: 'wiredTiger' },
  }) // This will create an ReplSet with 3 members and storage-engine "wiredTiger"
  await mongo.waitUntilRunning()
  globalThis.mongo = mongo
  const uri = mongo.getUri()
  // eslint-disable-next-line unicorn/prefer-spread
  const mongoConnectionString = uri.split('/').slice(0, -1).concat(database).join('/') + uri.split('/').slice(-1)
  // Recreate connection string to ReplicaSet adding default DB in the proper place
  process.env.MONGO_CONNECTION_STRING = mongoConnectionString
  console.log('Mongo: Started')
}

const setupNode = async () => {
  console.log('Node: Starting')
  const mnemonic = process.env.MNEMONIC || ''
  const path = WALLET_PATHS.Nodes.Node
  const account = await HDWallet.fromPhrase(mnemonic, path)
  const config = { schema: MemoryNode.defaultConfigSchema }
  const params: MemoryNodeParams = { account, config }
  const node = await MemoryNode.create(params)
  globalThis.app = await getApp(node)
  globalThis.req = supertest(app)
  const apiDomain = req.get('/').url.replace(/\/$/, '')
  process.env.API_DOMAIN = apiDomain
  process.env.ARCHIVIST_API_DOMAIN = apiDomain
  console.log('Node: Started')
}

/**
 * Jest global setup method runs before any tests are run
 * https://jestjs.io/docs/configuration#globalsetup-string
 */
const setup = async (_globalConfig: Config, _projectConfig: Config) => {
  console.log('')
  PayloadValidator.setSchemaNameValidatorFactory((schema: string) => new SchemaNameValidator(schema))
  if (canAddMongoModules()) await setupMongo()
  await setupNode()
}

// eslint-disable-next-line id-denylist
module.exports = setup
