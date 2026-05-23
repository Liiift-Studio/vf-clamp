// site/src/app/api/clamp/route.ts — POST /api/clamp microservice endpoint
import { type NextRequest, NextResponse } from 'next/server'
import { clampFont } from 'vf-clamp'
import type { SubfamilyConfig, OutputFormat } from 'vf-clamp'

interface ClampRequest {
	/** URL of the source variable font (TTF). Fetched server-side — must be publicly accessible. */
	fontUrl: string
	/** One entry per restricted variant to produce */
	subfamilies: SubfamilyConfig[]
	/** Output format — 'ttf' (default), 'otf', 'woff', or 'woff2' */
	format?: OutputFormat
}

interface ClampResponseResult {
	name: string
	/** Base64-encoded restricted font */
	data: string
	/** Format of the returned font binary */
	format: OutputFormat
	/** Byte size of the restricted font */
	size: number
}

interface ClampResponse {
	results: ClampResponseResult[]
}

function unauthorized(message: string) {
	return NextResponse.json({ error: message }, { status: 401 })
}

function badRequest(message: string) {
	return NextResponse.json({ error: message }, { status: 400 })
}

export async function POST(req: NextRequest) {
	// Auth
	const apiKey = req.headers.get('x-api-key')
	const expectedKey = process.env.VF_CLAMP_API_KEY

	if (!expectedKey) {
		console.error('VF_CLAMP_API_KEY environment variable is not set')
		return NextResponse.json({ error: 'Service misconfigured' }, { status: 500 })
	}

	if (!apiKey || apiKey !== expectedKey) {
		return unauthorized('Invalid or missing X-API-Key header')
	}

	// Parse body
	let body: ClampRequest
	try {
		body = await req.json()
	} catch {
		return badRequest('Request body must be valid JSON')
	}

	const { fontUrl, subfamilies, format } = body

	if (!fontUrl || typeof fontUrl !== 'string') {
		return badRequest('fontUrl is required and must be a string')
	}

	if (!Array.isArray(subfamilies) || subfamilies.length === 0) {
		return badRequest('subfamilies must be a non-empty array')
	}

	// Validate subfamilies shape
	for (const s of subfamilies) {
		if (!s.name || typeof s.name !== 'string') {
			return badRequest('Each subfamily must have a name string')
		}
		if (!s.axes || typeof s.axes !== 'object') {
			return badRequest(`Subfamily "${s.name}" must have an axes object`)
		}
	}

	// Fetch source font
	let fontBuffer: ArrayBuffer
	try {
		const fontRes = await fetch(fontUrl)
		if (!fontRes.ok) {
			return badRequest(`Failed to fetch font: ${fontRes.status} ${fontRes.statusText}`)
		}
		fontBuffer = await fontRes.arrayBuffer()
	} catch (err) {
		return badRequest(`Could not fetch font from URL: ${err instanceof Error ? err.message : String(err)}`)
	}

	// Process
	let clampResults
	try {
		clampResults = await clampFont(fontBuffer, { subfamilies, format })
	} catch (err) {
		console.error('clampFont failed:', err)
		return NextResponse.json(
			{ error: `Font processing failed: ${err instanceof Error ? err.message : String(err)}` },
			{ status: 500 }
		)
	}

	// Encode results as base64
	const results: ClampResponseResult[] = clampResults.map((r) => ({
		name: r.name,
		data: Buffer.from(r.buffer).toString('base64'),
		format: r.format,
		size: r.buffer.byteLength,
	}))

	return NextResponse.json<ClampResponse>({ results })
}
