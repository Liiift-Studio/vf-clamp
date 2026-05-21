// vite.config.ts — library-mode build for ESM + CJS + types
import { defineConfig } from 'vite'
import dts from 'vite-plugin-dts'

export default defineConfig({
	plugins: [
		dts({ include: ['src'], exclude: ['src/__tests__/**'], rollupTypes: true }),
	],
	build: {
		lib: {
			entry: 'src/index.ts',
			formats: ['es', 'cjs'],
			fileName: (format) => `index.${format === 'es' ? 'js' : 'cjs'}`,
		},
		rollupOptions: {
			external: ['@web-alchemy/fonttools'],
		},
	},
})
