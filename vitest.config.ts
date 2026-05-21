// vitest.config.ts — Node environment for font processing tests
import { defineConfig } from 'vitest/config'

export default defineConfig({
	test: {
		environment: 'node',
		testTimeout: 30000,
	},
})
