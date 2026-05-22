// site/next.config.ts — vfclamp.com site + API microservice
import type { NextConfig } from 'next'
import path from 'path'

const config: NextConfig = {
	turbopack: {
		root: path.resolve(__dirname, '..'),
	},
	// Prevent bundling of Pyodide-based packages — must run as Node.js server-side only
	serverExternalPackages: ['@web-alchemy/fonttools', 'vf-clamp'],
	// Enable instrumentation hook so Pyodide can pre-warm at function boot
	experimental: { instrumentationHook: true },
}

export default config
