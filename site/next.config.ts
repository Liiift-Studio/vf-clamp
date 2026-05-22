// site/next.config.ts — vfclamp.com site + API microservice
import type { NextConfig } from 'next'

const config: NextConfig = {
	// Prevent bundling of Pyodide-based packages — must run as Node.js server-side only
	serverExternalPackages: ['@web-alchemy/fonttools', 'vf-clamp'],
	// Enable instrumentation hook so Pyodide can pre-warm at function boot
	experimental: { instrumentationHook: true },
}

export default config
