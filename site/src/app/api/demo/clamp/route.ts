// site/src/app/api/demo/clamp/route.ts — unauthenticated demo endpoint
// Accepts multipart/form-data: font (binary), outputs (JSON string), format? (string).
// Using multipart avoids the ~33% base64 inflation of the previous JSON approach,
// so fonts up to 20 MB can reach the handler without hitting platform body limits. (#2)
import { type NextRequest, NextResponse } from 'next/server'
import { clampFont } from '@liiift-studio/vf-clamp'
import type { OutputConfig, OutputFormat } from '@liiift-studio/vf-clamp'
import { checkRateLimit, getClientIp } from '../../../../lib/rateLimit'

const MAX_BYTES  = 20 * 1024 * 1024 // 20 MB
const TIMEOUT_MS = 60_000            // 60 s — prevents hangs on pathological fonts (#3)

const VALID_FORMATS = new Set(['ttf', 'otf', 'woff', 'woff2'])

export async function POST(req: NextRequest) {
	if (!checkRateLimit(getClientIp(req))) {
		return NextResponse.json({ error: 'Too many requests — please wait a moment' }, { status: 429 })
	}

	let form: FormData
	try {
		form = await req.formData()
	} catch {
		return NextResponse.json({ error: 'Request must be multipart/form-data' }, { status: 400 })
	}

	const fontEntry          = form.get('font')
	const outputsRaw         = form.get('outputs')
	const formatRaw          = form.get('format') ?? 'ttf'
	const normalizeWeightAxis = form.get('normalizeWeightAxis') === '1'

	if (!fontEntry || !(fontEntry instanceof Blob)) {
		return NextResponse.json({ error: 'font field is required (binary)' }, { status: 400 })
	}
	if (typeof outputsRaw !== 'string') {
		return NextResponse.json({ error: 'outputs field is required (JSON string)' }, { status: 400 })
	}

	const format = String(formatRaw) as OutputFormat
	if (!VALID_FORMATS.has(format)) {
		return NextResponse.json({ error: `Invalid format "${format}"` }, { status: 400 })
	}

	let outputs: OutputConfig[]
	try {
		const parsed = JSON.parse(outputsRaw)
		if (!Array.isArray(parsed) || !parsed.length) throw new Error('must be a non-empty array')
		outputs = parsed
	} catch (e) {
		return NextResponse.json({ error: `Invalid outputs: ${e instanceof Error ? e.message : String(e)}` }, { status: 400 })
	}

	const fontBuffer = Buffer.from(await fontEntry.arrayBuffer())
	if (fontBuffer.length > MAX_BYTES) {
		return NextResponse.json({ error: 'Font too large (max 20 MB)' }, { status: 413 })
	}

	try {
		const timeout = new Promise<never>((_, reject) =>
			setTimeout(() => reject(new Error('Processing timed out after 60 s')), TIMEOUT_MS)
		)
		const results = await Promise.race([
			clampFont(fontBuffer, { outputs, format, normalizeWeightAxis }),
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
