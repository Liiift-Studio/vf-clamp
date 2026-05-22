// site/src/app/api/instances/route.ts — POST /api/instances: extract axis + instance data from a variable font
import { type NextRequest, NextResponse } from 'next/server'
import { getInstances } from 'vf-clamp'

interface InstancesRequest {
	/** URL of the source variable font (TTF). Fetched server-side — must be publicly accessible. */
	fontUrl: string
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
	let body: InstancesRequest
	try {
		body = await req.json()
	} catch {
		return badRequest('Request body must be valid JSON')
	}

	const { fontUrl } = body

	if (!fontUrl || typeof fontUrl !== 'string') {
		return badRequest('fontUrl is required and must be a string')
	}

	// Fetch font
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

	// Extract instances
	try {
		const result = await getInstances(fontBuffer)
		return NextResponse.json(result)
	} catch (err) {
		console.error('getInstances failed:', err)
		return NextResponse.json(
			{ error: `Instance extraction failed: ${err instanceof Error ? err.message : String(err)}` },
			{ status: 500 }
		)
	}
}
