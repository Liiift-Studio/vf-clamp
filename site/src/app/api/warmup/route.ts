// site/src/app/api/warmup/route.ts — Pyodide warmup endpoint called by Vercel cron
// Keeps the Pyodide runtime warm so webhook requests from Darden don't incur cold-start latency.
import { type NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
	// Only accept requests from Vercel cron (authorization header set automatically)
	const authHeader = req.headers.get('authorization')
	if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
		return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
	}

	try {
		const { createRequire } = await import('node:module')
		const _require = createRequire(import.meta.url)
		const { preparePyodide } = _require('@web-alchemy/fonttools/src/pyodide.js')
		await preparePyodide()
		return NextResponse.json({ ok: true, warmed: true })
	} catch (err) {
		// Non-fatal — cron will retry on next interval
		console.warn('Warmup failed:', err)
		return NextResponse.json({ ok: false, error: String(err) }, { status: 500 })
	}
}
