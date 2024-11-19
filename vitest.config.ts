import dotenv from 'dotenv'
import { defineConfig } from 'vitest/config'

dotenv.config()

export default defineConfig({
  test: {
    globals: true,
    reporters: ['verbose'],
    setupFiles: ['./vitest.startup.ts'],
    globalSetup: ['./packages/node/packages/express/packages/test/src/globalSetup.ts'],
  },
})
