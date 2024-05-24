import { XyTsupConfig } from '@xylabs/ts-scripts-yarn3'
const config: XyTsupConfig = {
  compile: {
    node: {
      src: { entry: ['./src/index.ts', './src/launchServer.ts'] },
    },
  },
}

// eslint-disable-next-line import/no-default-export
export default config