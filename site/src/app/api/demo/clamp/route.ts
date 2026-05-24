// site/src/app/api/demo/clamp/route.ts — unauthenticated demo endpoint
// Accepts { font: base64, subfamilies, format? } and returns restricted font buffers.
import { type NextRequest, NextResponse } from 'next/server'
import { clampFont } from '@liiift-studio/vf-clamp'
import type { OutputConfig, OutputFormat } from '@liiift-studio/vf-clamp'
import { checkRateLimit, getClientIp } from '../../../../lib/rateLimit'

const MAX_BYTES  = 20 * 1024 * 1024 // 20 MB
const TIMEOUT_MS = 60_000            // 60 s — prevents hangs on pathological fonts (#3)

interface DemoClampRequest {
	/** Base64-encoded source font binary */
	font: string
	outputs: OutputConfig[]
	format?: OutputFormat
}

export async function POST(req: NextRequest) {
	if (!checkRateLimit(getClientIp(req))) {
		return NextResponse.json({ error: 'Too many requests — please wait a moment' }, { status: 429 })
	}

	let body: DemoClampRequest
	try {
		body = await req.json()
	} catch {
		return NextResponse.json({ error: 'Request body must be valid JSON' }, { status: 400 })
	}

	const { font: fontBase64, outputs, format } = body

	if (!fontBase64) return NextResponse.json({ error: 'font is required' }, { status: 400 })
	if (!Array.isArray(outputs) || !outputs.length) {
		return NextResponse.json({ error: 'outputs must be a non-empty array' }, { status: 400 })
	}

	let fontBuffer: Buffer
	try {
		fontBuffer = Buffer.from(fontBase64, 'base64')
	} catch {
		return NextResponse.json({ error: 'Invalid base64 font data' }, { status: 400 })
	}

	if (fontBuffer.length > MAX_BYTES) {
		return NextResponse.json({ error: 'Font too large (max 20 MB)' }, { status: 413 })
	}

	try {
		const timeout = new Promise<never>((_, reject) =>
			setTimeout(() => reject(new Error('Processing timed out after 60 s')), TIMEOUT_MS)
		)
		const results = await Promise.race([
			clampFont(fontBuffer, { outputs, format }),
			timeout,
		])
		return NextResponse.json({
			results: results.map((r) => ({
				name: r.name,
				data: Buffer.from(r.buffer).toString('base64'),
				format: r.format,
				size: r.buffer.byteLength,
			})),
		})
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err)
		const isTimeout = message.includes('timed out')
		console.error('Demo clampFont failed:', err)
		return NextResponse.json(
			{ error: `Font processing failed: ${message}` },
			{ status: isTimeout ? 504 : 500 }
		)
	}
}
