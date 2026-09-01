import baseConfig from '../../config/vitest.config'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  ...baseConfig,
  test: {
    ...baseConfig.test,
    include: ['tests/chat-transport-qualification/*.qualification.test.ts']
  }
})
