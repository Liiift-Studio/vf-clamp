// site/src/app/opengraph-image.tsx — OG image for vfclamp.com
import { ImageResponse } from 'next/og'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

export const alt = 'vf-clamp — Restrict variable font axis ranges'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function Image() {
	const interLight = await readFile(join(process.cwd(), 'public/fonts/inter-300.woff'))
	return new ImageResponse(
		(
			<div style={{ background: '#010515', width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '72px 80px', fontFamily: 'Inter, sans-serif' }}>
				<span style={{ fontSize: 13, letterSpacing: '0.18em', color: '#afb8c8', textTransform: 'uppercase' }}>vf-clamp</span>
				<div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
					{/* Axis range bars — visual metaphor for restricting design space */}
					<div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 48 }}>
						{[
							{ label: 'wght', full: 900, min: 100, lo: 400, hi: 700 },
							{ label: 'wdth', full: 125, min: 75, lo: 87.5, hi: 100 },
							{ label: 'opsz', full: 144, min: 6, lo: 8, hi: 24 },
						].map(({ label, full, min, lo, hi }) => {
							const w = 280
							const loFrac = (lo - min) / (full - min)
							const hiFrac = (hi - min) / (full - min)
							return (
								<div key={label} style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
									<span style={{ fontSize: 11, color: '#8c929f', fontFamily: 'monospace', width: 32 }}>{label}</span>
									<div style={{ position: 'relative', width: w, height: 4, background: '#2b2e34', borderRadius: 2, display: 'flex' }}>
										<div style={{ position: 'absolute', left: `${loFrac * 100}%`, width: `${(hiFrac - loFrac) * 100}%`, height: '100%', background: 'rgba(80,190,200,0.75)', borderRadius: 2 }} />
									</div>
								</div>
							)
						})}
					</div>
					<div style={{ fontSize: 76, color: '#f2f5fb', lineHeight: 1.06, fontWeight: 300 }}>Restrict the range,</div>
					<div style={{ fontSize: 76, color: '#afb8c8', lineHeight: 1.06, fontWeight: 300, fontStyle: 'italic' }}>keep what varies.</div>
				</div>
				<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
					<div style={{ fontSize: 14, color: '#afb8c8', letterSpacing: '0.04em', display: 'flex', gap: 20 }}>
						<span>TypeScript</span><span style={{ opacity: 0.4 }}>·</span>
						<span>fonttools varLib.instancer</span><span style={{ opacity: 0.4 }}>·</span>
						<span>Pyodide WASM</span><span style={{ opacity: 0.4 }}>·</span>
						<span>TTF · OTF · WOFF · WOFF2</span>
					</div>
					<div style={{ fontSize: 13, color: '#8c929f', letterSpacing: '0.04em' }}>vfclamp.com</div>
				</div>
			</div>
		),
		{ ...size, fonts: [{ name: 'Inter', data: interLight, style: 'normal', weight: 300 }] },
	)
}
