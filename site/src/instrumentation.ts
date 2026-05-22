// site/src/instrumentation.ts — pre-warm Pyodide at function boot so the first
// demo request doesn't pay the full cold-start cost (~20–30 s).
// Next.js calls register() once per server process startup (not per request).
export async function register() {
	// Only run in Node.js — not in the edge runtime
	if (process.env.NEXT_RUNTIME !== 'edge') {
		try {
			const { createRequire } = await import('node:module')
			const _require = createRequire(import.meta.url)
			const { preparePyodide } = _require('@web-alchemy/fonttools/src/pyodide.js')
			await preparePyodide()
			console.log('Pyodide pre-warmed successfully')
		} catch (err) {
			// Non-fatal — the first real request will still initialise Pyodide
			console.warn('Pyodide pre-warm failed (non-fatal):', err)
		}
	}
}
