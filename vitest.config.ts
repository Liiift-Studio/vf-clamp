// vitest.config.ts — Node environment for font processing tests
import { defineConfig } from 'vitest/config'

export default defineConfig({
	test: {
		environment: 'node',
		testTimeout: 30000,
		// Plugin submodules ship their own test runners (mocha for vscode, vitest with
		// dist gating for cli). Scope the npm core run to its own __tests__ folder so
		// `npm run test:run` (and `prepublishOnly`) does not try to load them.
		include: ['src/**/*.test.ts'],
		exclude: ['node_modules/**', 'dist/**', 'plugins/**', 'site/**'],
	},
})
