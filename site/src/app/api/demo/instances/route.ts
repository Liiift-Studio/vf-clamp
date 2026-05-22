// site/src/app/api/demo/instances/route.ts — unauthenticated demo endpoint
// Accepts a raw font binary and returns { axes, instances }.
import { type NextRequest, NextResponse } from 'next/server'
import { getInstances } from 'vf-clamp'

const MAX_BYTES = 20 * 1024 * 1024 // 20 MB

export async function POST(req: NextRequest) {
	const buffer = await req.arrayBuffer()

	if (buffer.byteLength === 0) {
		return NextResponse.json({ error: 'Empty request body' }, { status: 400 })
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
