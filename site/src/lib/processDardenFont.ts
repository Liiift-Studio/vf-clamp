// site/src/lib/processDardenFont.ts — core processing logic for Darden vf-clamp integration
// Fetches a variable font from Sanity, runs clampFont for each vfClampConfig entry, and
// patches the font document with the generated restrictedVariants.
import { createClient } from '@sanity/client'
import { clampFont } from 'vf-clamp'

interface VfClampConfigEntry {
	/** Variant name, e.g. "Condensed" */
	subfamily: string
	/** JSON string: number to pin, {min,max} to range, null to pass through */
	axesJson: string
}

interface SanityFileRef {
	asset?: { _ref?: string }
}

/** Minimal shape of the Sanity font document we need */
export interface DardenFontDoc {
	_id: string
	variableFont?: boolean
	vfClampConfig?: VfClampConfigEntry[]
	fileInput?: { ttf?: SanityFileRef }
}

/** Build a Sanity CDN URL from a file asset _ref (file-{hash}-{ext}) */
function assetRefToUrl(ref: string, projectId: string, dataset: string): string {
	const match = ref.match(/^file-([a-zA-Z0-9]+)-([a-zA-Z0-9]+)$/)
	if (!match) throw new Error(`Unrecognised Sanity file asset ref: ${ref}`)
	const [, hash, ext] = match
	return `https://cdn.sanity.io/files/${projectId}/${dataset}/${hash}.${ext}`
}

/** Parse axesJson safely, throwing a descriptive error on failure */
function parseAxesJson(subfamily: string, json: string): Record<string, unknown> {
	try {
		const parsed = JSON.parse(json)
		if (typeof parsed !== 'object' || parsed === null) throw new Error('must be an object')
		return parsed
	} catch (e) {
		throw new Error(`Invalid axesJson for subfamily "${subfamily}": ${e instanceof Error ? e.message : String(e)}`)
	}
}

/**
 * Process a Darden font document: fetch the source TTF, run clampFont for every
 * vfClampConfig entry (both TTF + WOFF2), upload results to Sanity, and patch
 * the document's restrictedVariants field.
 */
export async function processDardenFont(doc: DardenFontDoc): Promise<{ variants: number }> {
	const { _id, vfClampConfig, fileInput } = doc

	if (!vfClampConfig?.length) throw new Error('No vfClampConfig entries on document')
	const ttfRef = fileInput?.ttf?.asset?._ref
	if (!ttfRef) throw new Error('No TTF file reference found on document')

	const projectId = process.env.SANITY_PROJECT_ID
	const dataset   = process.env.SANITY_DATASET ?? 'production'
	const token     = process.env.SANITY_TOKEN

	if (!projectId) throw new Error('SANITY_PROJECT_ID env var is not set')
	if (!token)     throw new Error('SANITY_TOKEN env var is not set')

	const client = createClient({ projectId, dataset, token, apiVersion: '2022-11-09', useCdn: false })

	// Fetch the source TTF from Sanity CDN
	const ttfUrl = assetRefToUrl(ttfRef, projectId, dataset)
	const ttfRes = await fetch(ttfUrl)
	if (!ttfRes.ok) throw new Error(`Failed to fetch TTF from Sanity CDN: ${ttfRes.status} ${ttfRes.statusText}`)
	const ttfBuffer = Buffer.from(await ttfRes.arrayBuffer())

	// Parse all output axis configs
	const outputs = vfClampConfig.map(({ subfamily, axesJson }) => ({
		name: subfamily,
		axes: parseAxesJson(subfamily, axesJson) as Parameters<typeof clampFont>[1]['outputs'][0]['axes'],
	}))

	// Generate TTF and WOFF2 variants in parallel
	const [ttfResults, woff2Results] = await Promise.all([
		clampFont(ttfBuffer, { outputs, format: 'ttf' }),
		clampFont(ttfBuffer, { outputs, format: 'woff2' }),
	])

	// Upload each result and build patch entries
	const restrictedVariants = await Promise.all(
		ttfResults.map(async (ttfResult, i) => {
			const woff2Result = woff2Results[i]
			const { name: subfamily } = ttfResult
			const safeId = _id.replace(/[^a-zA-Z0-9-_]/g, '_')

			const [ttfAsset, woff2Asset] = await Promise.all([
				client.assets.upload('file', Buffer.from(ttfResult.buffer), {
					filename: `${safeId}-${subfamily}-VF.ttf`,
					contentType: 'font/ttf',
				}),
				client.assets.upload('file', Buffer.from(woff2Result.buffer), {
					filename: `${safeId}-${subfamily}-VF.woff2`,
					contentType: 'font/woff2',
				}),
			])

			const configEntry = vfClampConfig.find((e) => e.subfamily === subfamily)

			return {
				_key: `vf-clamp-${subfamily.replace(/\s+/g, '-').toLowerCase()}`,
				subfamily,
				axisConfig: configEntry?.axesJson ?? '',
				files: {
					ttf:   { _type: 'file', asset: { _type: 'reference', _ref: ttfAsset._id } },
					woff2: { _type: 'file', asset: { _type: 'reference', _ref: woff2Asset._id } },
				},
				generatedAt: new Date().toISOString(),
			}
		})
	)

	// Patch the Sanity document
	await client.patch(_id).set({ restrictedVariants }).commit()

	return { variants: restrictedVariants.length }
}
