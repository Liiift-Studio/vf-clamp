// site/src/app/api/demo/clamp/route.ts — unauthenticated demo endpoint
// Accepts { font: base64, subfamilies, format? } and returns restricted font buffers.
import { type NextRequest, NextResponse } from 'next/server'
import { clampFont } from 'vf-clamp'
import type { SubfamilyConfig, OutputFormat } from 'vf-clamp'
import { checkRateLimit, getClientIp } from '../../../../lib/rateLimit'

const MAX_BYTES = 20 * 1024 * 1024 // 20 MB

interface DemoClampRequest {
	/** Base64-encoded source font binary */
	font: string
	subfamilies: SubfamilyConfig[]
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

	const { font: fontBase64, subfamilies, format } = body

	if (!fontBase64) return NextResponse.json({ error: 'font is required' }, { status: 400 })
	if (!Array.isArray(subfamilies) || !subfamilies.length) {
		return NextResponse.json({ error: 'subfamilies must be a non-empty array' }, { status: 400 })
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
		const results = await clampFont(fontBuffer, { subfamilies, format })
		return NextResponse.json({
			results: results.map((r) => ({
				name: r.name,
				data: Buffer.from(r.buffer).toString('base64'),
				format: r.format,
				size: r.buffer.byteLength,
			})),
		})
	} catch (err) {
		console.error('Demo clampFont failed:', err)
		return NextResponse.json(
			{ error: `Font processing failed: ${err instanceof Error ? err.message : String(err)}` },
			{ status: 500 }
		)
	}
}
