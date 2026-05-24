// site/src/app/api/demo/instances/route.ts — unauthenticated demo endpoint
// Accepts a raw font binary and returns { axes, instances }.
import { type NextRequest, NextResponse } from 'next/server'
import { getInstances } from '@liiift-studio/vf-clamp'
import { checkRateLimit, getClientIp } from '../../../../lib/rateLimit'

const MAX_BYTES = 20 * 1024 * 1024 // 20 MB

export async function POST(req: NextRequest) {
	const buffer = await req.arrayBuffer()

	// Tiny bodies (≤4 bytes) are warmup pings from the Demo component — bypass
	// the rate limit so users don't lose one of their 10 allowed requests before
	// they've interacted with the demo. (#6)
	if (buffer.byteLength <= 4) {
		return NextResponse.json({ warmup: true })
	}

	if (!checkRateLimit(getClientIp(req))) {
		return NextResponse.json({ error: 'Too many requests — please wait a moment' }, { status: 429 })
	}

	if (buffer.byteLength > MAX_BYTES) {
		return NextResponse.json({ error: 'Font file too large (max 20 MB)' }, { status: 413 })
	}

	try {
		const result = await getInstances(buffer)
		return NextResponse.json(result)
	} catch (err) {
		console.error('Demo getInstances failed:', err)
		return NextResponse.json(
			{ error: `Could not read font: ${err instanceof Error ? err.message : String(err)}` },
			{ status: 422 }
		)
	}
}
