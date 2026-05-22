// site/src/app/api/webhook/darden/route.ts — Sanity webhook receiver for Darden vf-clamp
// Validates the Sanity signing secret, then processes the font document via processDardenFont.
// Configure in Sanity: filter `_type == "font" && variableFont == true`, event: publish.
import { type NextRequest, NextResponse } from 'next/server'
import { createHmac, timingSafeEqual } from 'node:crypto'
import { processDardenFont, type DardenFontDoc } from '../../../../lib/processDardenFont'

/**
 * Validate Sanity's HMAC-SHA256 webhook signature.
 * Header format: sanity-webhook-signature: t=<unix_ts>,v1=<hex_hmac>
 * HMAC input: "<timestamp>.<raw_body>"
 */
function isValidSanitySignature(rawBody: string, header: string | null, secret: string): boolean {
	if (!header) return false
	const parts: Record<string, string> = {}
	for (const part of header.split(',')) {
		const idx = part.indexOf('=')
		if (idx > 0) parts[part.slice(0, idx)] = part.slice(idx + 1)
	}
	const { t: timestamp, v1: signature } = parts
	if (!timestamp || !signature) return false

	// Reject payloads older than 5 minutes
	if (Math.abs(Date.now() / 1000 - parseInt(timestamp, 10)) > 300) return false

	const expected = createHmac('sha256', secret)
		.update(`${timestamp}.${rawBody}`)
		.digest('hex')

	try {
		const expectedBuf = Buffer.from(expected, 'hex')
		const receivedBuf = Buffer.from(signature, 'hex')
		return expectedBuf.length === receivedBuf.length && timingSafeEqual(expectedBuf, receivedBuf)
	} catch {
		return false
	}
}

export async function POST(req: NextRequest) {
	const secret = process.env.SANITY_WEBHOOK_SECRET
	if (!secret) {
		console.error('SANITY_WEBHOOK_SECRET is not set')
		return NextResponse.json({ error: 'Service misconfigured' }, { status: 500 })
	}

	const rawBody = await req.text()
	const signature = req.headers.get('sanity-webhook-signature')

	if (!isValidSanitySignature(rawBody, signature, secret)) {
		return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 401 })
	}

	let doc: DardenFontDoc
	try {
		doc = JSON.parse(rawBody)
	} catch {
		return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
	}

	if (!doc._id || !doc.variableFont) {
		return NextResponse.json({ ok: true, skipped: true, reason: 'Not a variable font document' })
	}

	if (!doc.vfClampConfig?.length) {
		return NextResponse.json({ ok: true, skipped: true, reason: 'No vfClampConfig entries' })
	}

	try {
		const result = await processDardenFont(doc)
		console.warn(`vf-clamp: processed ${result.variants} variant(s) for document ${doc._id}`)
		return NextResponse.json({ ok: true, ...result })
	} catch (err) {
		console.error('vf-clamp Darden webhook failed:', err)
		return NextResponse.json(
			{ error: err instanceof Error ? err.message : String(err) },
			{ status: 500 }
		)
	}
}
