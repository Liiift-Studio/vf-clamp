// site/src/app/api/trigger/darden/route.ts — manual trigger endpoint for the Darden Sanity document action
// Accepts the same font document payload as the Sanity webhook but authenticates with a
// studio-safe trigger key (SANITY_STUDIO_VF_CLAMP_TRIGGER_KEY) rather than a webhook signature.
import { type NextRequest, NextResponse } from 'next/server'
import { processDardenFont, type DardenFontDoc } from '../../../../lib/processDardenFont'

export async function POST(req: NextRequest) {
	const triggerKey = process.env.VF_CLAMP_TRIGGER_KEY
	if (!triggerKey) {
		console.error('VF_CLAMP_TRIGGER_KEY is not set')
		return NextResponse.json({ error: 'Service misconfigured' }, { status: 500 })
	}

	const provided = req.headers.get('x-trigger-key')
	if (!provided || provided !== triggerKey) {
		return NextResponse.json({ error: 'Invalid or missing x-trigger-key header' }, { status: 401 })
	}

	let doc: DardenFontDoc
	try {
		doc = await req.json()
	} catch {
		return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
	}

	if (!doc._id || !doc.variableFont) {
		return NextResponse.json({ error: 'Document is not a variable font' }, { status: 400 })
	}

	if (!doc.vfClampConfig?.length) {
		return NextResponse.json({ error: 'No vfClampConfig entries on document' }, { status: 400 })
	}

	try {
		const result = await processDardenFont(doc)
		return NextResponse.json({ ok: true, ...result })
	} catch (err) {
		console.error('vf-clamp Darden trigger failed:', err)
		return NextResponse.json(
			{ error: err instanceof Error ? err.message : String(err) },
			{ status: 500 }
		)
	}
}
