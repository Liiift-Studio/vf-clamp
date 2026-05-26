// vfClamp landing page — hero, demo, how it works, usage, WOFF2, REST API
import CodeBlock from "../components/CodeBlock"
import CopyInstall from "../components/CopyInstall"
import SiteFooter from "../components/SiteFooter"
import Demo from "../components/Demo"
import { MagnetChar } from "@liiift-studio/magnettype"
import SettleP from "../components/SettleP"
import { version } from "../../../package.json"
import { version as siteVersion } from "../../package.json"

export default function Home() {
	return (
		<main className="flex flex-col items-center px-6 py-20 gap-24">

			{/* Hero */}
			<section className="w-full max-w-2xl lg:max-w-5xl flex flex-col gap-6">
				<div className="flex flex-col gap-2">
					<p className="text-xs uppercase tracking-widest opacity-50">vf-clamp</p>
					<h1 className="text-4xl lg:text-8xl xl:text-9xl" style={{ fontFamily: "var(--font-merriweather), serif", fontVariationSettings: '"wght" 300, "opsz" 144', lineHeight: "1.05em" }}>
						<MagnetChar as="span" minWeight={300} maxWeight={800} spreadRadius={220} fixedAxes={{ opsz: 144 }}>Restrict the range,</MagnetChar><br />
						<MagnetChar as="span" minWeight={300} maxWeight={800} spreadRadius={220} fixedAxes={{ opsz: 144 }} style={{ opacity: 0.5, fontStyle: "italic" }}>keep what varies.</MagnetChar>
					</h1>
				</div>
				<div className="flex items-center gap-4">
					<CopyInstall />
					<a
						href="https://github.com/Liiift-Studio/vf-clamp"
						target="_blank"
						rel="noopener noreferrer"
						className="text-sm opacity-50 hover:opacity-100 transition-opacity"
					>
						GitHub ↗
					</a>
				</div>
				<div className="flex flex-wrap gap-x-4 gap-y-1 text-xs opacity-50 tracking-wide">
					<span>TypeScript</span><span>·</span>
					<span>fonttools varLib.instancer</span><span>·</span>
					<span>Pyodide WASM</span><span>·</span>
					<span>TTF · OTF · WOFF · WOFF2</span>
				</div>
				<SettleP className="text-base opacity-60 leading-relaxed max-w-lg">
					vf-clamp wraps fonttools&rsquo; varLib.instancer in a zero-install WASM runtime.
					Pass in a variable font and a map of axis constraints — pin an axis to remove it,
					restrict it to a sub-range, or leave it untouched. The output is a smaller,
					self-contained font trimmed to exactly the design space you declared.
				</SettleP>
			</section>

			{/* Interactive demo */}
		<section className="w-full max-w-2xl lg:max-w-5xl flex flex-col gap-4">
			<p className="text-xs uppercase tracking-widest opacity-50">Interactive demo</p>
			<SettleP className="text-sm opacity-50 leading-relaxed max-w-lg">
				Load Encode Sans or drop any variable font. Select named instances — adjacent selections
				merge into a single output file. Isolated selections generate their own file, flagged in yellow.
				Preview the restricted design space live, then download the clamped TTFs.
			</SettleP>
			<div className="rounded-xl -mx-2 px-8 py-8" style={{ background: "rgba(0,0,0,0.2)" }}>
				<Demo />
			</div>
		</section>

			{/* Integrations */}
			<section className="w-full max-w-2xl lg:max-w-5xl flex flex-col gap-6">
				<p className="text-xs uppercase tracking-widest opacity-50">Integrations</p>
				<SettleP className="text-sm opacity-60 leading-relaxed max-w-lg">
					vf-clamp is available as a CLI, and as native plugins for Glyphs.app, RoboFont, and VS Code —
					all using the same axis-constraint model as the npm package.
				</SettleP>
				<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

					{/* CLI */}
					<div className="flex flex-col gap-3 rounded-xl p-6" style={{ background: "rgba(0,0,0,0.2)" }}>
						<div className="flex items-center gap-3">
							<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="opacity-60" aria-hidden="true">
								<polyline points="4 17 10 11 4 5" />
								<line x1="12" y1="19" x2="20" y2="19" />
							</svg>
							<span className="text-sm font-medium">CLI</span>
						</div>
						<SettleP className="text-xs opacity-50 leading-relaxed">
							Run <code className="font-mono">vf-clamp</code> from any shell. Pass a font file, a JSON config, and get clamped outputs written to disk. Scriptable and CI-friendly.
						</SettleP>
						<code className="text-xs font-mono opacity-40">vf-clamp clamp font.ttf --axis wght:400:700</code>
						<div className="flex items-center gap-2 mt-auto pt-3">
							<a href="https://github.com/Liiift-Studio/vf-clamp-cli" target="_blank" rel="noopener noreferrer" className="flex-1 text-center text-xs font-medium py-2 px-3 rounded-lg bg-white/10 hover:bg-white/15 transition-colors">GitHub ↗</a>
							<a href="https://github.com/Liiift-Studio/vf-clamp-cli#readme" target="_blank" rel="noopener noreferrer" className="flex-1 text-center text-xs py-2 px-3 rounded-lg border border-white/15 hover:border-white/30 hover:bg-white/5 transition-colors opacity-70 hover:opacity-100">Docs ↗</a>
						</div>
					</div>

					{/* Glyphs.app */}
					<div className="flex flex-col gap-3 rounded-xl p-6" style={{ background: "rgba(0,0,0,0.2)" }}>
						<div className="flex items-center gap-3">
							{/* Glyphs.app: bezier path with anchor + handle nodes — the signature Glyphs UI motif */}
							<svg width="18" height="18" viewBox="0 0 18 18" fill="none" className="opacity-60" aria-hidden="true">
								<path d="M3 15C4 9 9 4 15 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
								<circle cx="3" cy="15" r="2" fill="currentColor"/>
								<circle cx="15" cy="3" r="2" fill="currentColor"/>
								<line x1="3" y1="15" x2="3" y2="8" stroke="currentColor" strokeWidth="1" opacity="0.45"/>
								<line x1="15" y1="3" x2="8" y2="3" stroke="currentColor" strokeWidth="1" opacity="0.45"/>
								<circle cx="3" cy="8" r="1.5" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.65"/>
								<circle cx="8" cy="3" r="1.5" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.65"/>
							</svg>
							<span className="text-sm font-medium">Glyphs.app</span>
						</div>
						<SettleP className="text-xs opacity-50 leading-relaxed">
							Native Glyphs plugin. Select named instances from your open font, choose a format, and export restricted VFs — all without leaving the app.
						</SettleP>
						<code className="text-xs font-mono opacity-40">vf-clamp-glyphs.glyphsPlugin</code>
						<div className="flex items-center gap-2 mt-auto pt-3">
							<a href="https://github.com/Liiift-Studio/vf-clamp-glyphs/releases/latest/download/vf-clamp-glyphs.zip" target="_blank" rel="noopener noreferrer" className="flex-1 text-center text-xs font-medium py-2 px-3 rounded-lg bg-white/10 hover:bg-white/15 transition-colors">Download ↗</a>
							<a href="https://github.com/Liiift-Studio/vf-clamp-glyphs" target="_blank" rel="noopener noreferrer" className="flex-1 text-center text-xs py-2 px-3 rounded-lg border border-white/15 hover:border-white/30 hover:bg-white/5 transition-colors opacity-70 hover:opacity-100">GitHub ↗</a>
						</div>
					</div>

					{/* RoboFont */}
					<div className="flex flex-col gap-3 rounded-xl p-6" style={{ background: "rgba(0,0,0,0.2)" }}>
						<div className="flex items-center gap-3">
							{/* RoboFont: robot face — antenna, eyes, mouth */}
							<svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" className="opacity-60" aria-hidden="true">
								<rect x="3" y="7" width="12" height="9" rx="2" strokeWidth="1.4"/>
								<line x1="9" y1="7" x2="9" y2="4" strokeWidth="1.4"/>
								<circle cx="9" cy="3" r="1.2" fill="currentColor" stroke="none"/>
								<circle cx="6.5" cy="11.5" r="1.5" fill="currentColor" stroke="none"/>
								<circle cx="11.5" cy="11.5" r="1.5" fill="currentColor" stroke="none"/>
								<path d="M6 14.5h6" strokeWidth="1.4" strokeLinecap="round"/>
							</svg>
							<span className="text-sm font-medium">RoboFont</span>
						</div>
						<SettleP className="text-xs opacity-50 leading-relaxed">
							RoboFont extension using fonttools directly. Pick instances from any open UFO-based variable font and export clamped outputs from the Extensions menu.
						</SettleP>
						<code className="text-xs font-mono opacity-40">vf-clamp.roboFontExt</code>
						<div className="flex items-center gap-2 mt-auto pt-3">
							<a href="https://github.com/Liiift-Studio/vf-clamp-robofont/releases/latest/download/vf-clamp-robofont.zip" target="_blank" rel="noopener noreferrer" className="flex-1 text-center text-xs font-medium py-2 px-3 rounded-lg bg-white/10 hover:bg-white/15 transition-colors">Download ↗</a>
							<a href="https://github.com/Liiift-Studio/vf-clamp-robofont" target="_blank" rel="noopener noreferrer" className="flex-1 text-center text-xs py-2 px-3 rounded-lg border border-white/15 hover:border-white/30 hover:bg-white/5 transition-colors opacity-70 hover:opacity-100">GitHub ↗</a>
						</div>
					</div>

					{/* VS Code */}
					<div className="flex flex-col gap-3 rounded-xl p-6" style={{ background: "rgba(0,0,0,0.2)" }}>
						<div className="flex items-center gap-3">
							{/* VS Code: the distinctive four-panel / fragmented-square logo shape */}
							<svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" className="opacity-60" aria-hidden="true">
								<path d="M13 2.5L4.5 10.5l3 1.5L13 2.5z"/>
								<path d="M4.5 15.5l8.5-3V2.5L4.5 10.5v5z"/>
							</svg>
							<span className="text-sm font-medium">VS Code</span>
						</div>
						<SettleP className="text-xs opacity-50 leading-relaxed">
							Right-click any <code className="font-mono">.ttf</code> in the Explorer to open the vf-clamp panel. Select instances, preview the axis hull, and export — without leaving your editor.
						</SettleP>
						<code className="text-xs font-mono opacity-40">vf-clamp.vscode-extension</code>
						<div className="flex items-center gap-2 mt-auto pt-3">
							<a href="https://github.com/Liiift-Studio/vf-clamp-vscode/releases/latest/download/vf-clamp.vsix" target="_blank" rel="noopener noreferrer" className="flex-1 text-center text-xs font-medium py-2 px-3 rounded-lg bg-white/10 hover:bg-white/15 transition-colors">Download .vsix ↗</a>
							<a href="https://github.com/Liiift-Studio/vf-clamp-vscode" target="_blank" rel="noopener noreferrer" className="flex-1 text-center text-xs py-2 px-3 rounded-lg border border-white/15 hover:border-white/30 hover:bg-white/5 transition-colors opacity-70 hover:opacity-100">GitHub ↗</a>
						</div>
					</div>

				</div>
			</section>

		{/* How it works */}
			<section className="w-full max-w-2xl lg:max-w-5xl flex flex-col gap-6">
				<p className="text-xs uppercase tracking-widest opacity-50">How it works</p>
				<div className="grid grid-cols-1 sm:grid-cols-2 gap-12 text-sm leading-relaxed opacity-70 prose-grid">
					<div className="flex flex-col gap-3">
						<p className="font-semibold opacity-100 text-base">Start from named instances</p>
						<SettleP>
							Variable fonts ship with named instances — presets like Regular, Bold, or Condensed
							that map to specific axis coordinates. Use <code className="text-xs font-mono">getInstances()</code> to
							read them, then pass adjacent instances as a subfamily to produce a restricted VF that
							spans exactly that slice of the design space.
						</SettleP>
					</div>
					<div className="flex flex-col gap-3">
						<p className="font-semibold opacity-100 text-base">Pin an axis to remove it</p>
						<SettleP>
							Setting an axis to a number fixes it at that value and removes it from the
							output font&rsquo;s fvar table. Unused glyph masters and gvar deltas are
							stripped — the result is a smaller, static-like font with no unnecessary variation.
						</SettleP>
					</div>
					<div className="flex flex-col gap-3">
						<p className="font-semibold opacity-100 text-base">Range-restrict to slim the space</p>
						<SettleP>
							Passing <code className="text-xs font-mono">&#123; min, max &#125;</code> keeps
							the axis variable but clips it to that sub-range. Masters outside the bounds are
							pruned — a 100–900 weight axis becomes a tight 400–700 slice without changing
							how the axis behaves inside that range.
						</SettleP>
					</div>
					<div className="flex flex-col gap-3">
						<p className="font-semibold opacity-100 text-base">No Python, multiple outputs</p>
						<SettleP>
							fonttools runs inside Pyodide — a Python interpreter compiled to WebAssembly.
							One <code className="text-xs font-mono">clampFont()</code> call produces any number
							of restricted variants from the same source. The Pyodide instance is a shared
							singleton: the cold start is paid once per process, subsequent calls are fast.
						</SettleP>
					</div>
				</div>
			</section>

			{/* Usage */}
			<section className="w-full max-w-2xl lg:max-w-5xl flex flex-col gap-6">
				<p className="text-xs uppercase tracking-widest opacity-50">Usage</p>
				<div className="flex flex-col gap-8 text-sm">

					<div className="flex flex-col gap-3">
						<SettleP className="opacity-50">From named instances — hull computed automatically</SettleP>
						<CodeBlock code={`import { clampFont } from '@liiift-studio/vf-clamp'
import { readFile, writeFile } from 'fs/promises'

const source = await readFile('Omnes-VF.ttf')

const results = await clampFont(source, {
  outputs: [
    // one VF spanning the full weight range for Condensed
    {
      name: 'Condensed',
      instances: ['Condensed Thin', 'Condensed Black'],
    },
    // one VF for a narrower weight slice of SemiCondensed
    {
      name: 'SemiCondensed Text',
      instances: ['SemiCondensed Light', 'SemiCondensed Bold'],
    },
  ],
})

for (const result of results) {
  await writeFile(\`Omnes-\${result.name}-VF.ttf\`, result.buffer)
}`} />
					</div>

					<div className="flex flex-col gap-3">
						<SettleP className="opacity-50">From explicit axis ranges</SettleP>
						<CodeBlock code={`const results = await clampFont(source, {
  outputs: [
    // pin wdth to 75 — axis removed from output
    { name: 'Condensed', axes: { wdth: 75 } },

    // restrict wdth to a range — axis stays variable
    { name: 'SemiCondensed', axes: { wdth: { min: 87.5, max: 100 } } },
  ],
})`} />
					</div>

					<div className="flex flex-col gap-3">
						<SettleP className="opacity-50">Mix instances and axes — axes override the hull</SettleP>
						<CodeBlock code={`const results = await clampFont(source, {
  format: 'woff2',
  outputs: [
    {
      name: 'Condensed Text',
      instances: ['Condensed Light', 'Condensed Bold'],
      // clamp the opsz axis independently of the named instance range
      axes: { opsz: { min: 8, max: 24 } },
    },
  ],
})`} />
					</div>

					<div className="flex flex-col gap-3">
						<SettleP className="opacity-50">CLI — from the shell</SettleP>
						<CodeBlock code={`# Pin wght, restrict wdth, keep all other axes
npx @liiift-studio/vf-clamp-cli clamp font.ttf \\
  --output out/ \\
  --axis wght:400 \\
  --axis wdth:75:100 \\
  --axis opsz:keep

# tag:value       → pin axis at value (axis removed from output)
# tag:min:max     → restrict to range (axis stays variable)
# tag:*  tag:keep → keep full original range (explicit no-op)`} />
					</div>

					<div className="flex flex-col gap-3">
						<SettleP className="opacity-50">Axis value reference</SettleP>
						<table className="w-full text-xs">
							<thead>
								<tr className="opacity-50 text-left">
									<th className="pb-2 pr-6 font-normal">Value</th>
									<th className="pb-2 font-normal">Effect</th>
								</tr>
							</thead>
							<tbody className="opacity-70">
								<tr className="border-t border-white/10 hover:bg-white/5 transition-colors"><td className="py-2 pr-6 font-mono">number</td><td className="py-2">Pin axis at value — removed from output design space</td></tr>
								<tr className="border-t border-white/10 hover:bg-white/5 transition-colors"><td className="py-2 pr-6 font-mono">&#123; min, max &#125;</td><td className="py-2">Restrict to range — axis stays variable within bounds</td></tr>
								<tr className="border-t border-white/10 hover:bg-white/5 transition-colors"><td className="py-2 pr-6 font-mono">null</td><td className="py-2">Explicitly keep full original range — same as omitting the axis entirely</td></tr>
								<tr className="border-t border-white/10 hover:bg-white/5 transition-colors"><td className="py-2 pr-6 font-mono italic opacity-50">omitted</td><td className="py-2">Keep full original range — axis is unchanged</td></tr>
							</tbody>
						</table>
					</div>

				</div>
			</section>

			{/* Inspect a font */}
			<section className="w-full max-w-2xl lg:max-w-5xl flex flex-col gap-6">
				<p className="text-xs uppercase tracking-widest opacity-50">Inspect a font</p>
				<SettleP className="text-sm opacity-60 leading-relaxed max-w-lg">
					<code className="text-xs font-mono">getInstances()</code> reads the fvar table and returns every axis
					and named instance defined in the font — useful for discovering what can be clamped
					before building a subfamily config.
				</SettleP>
				<CodeBlock code={`import { getInstances } from '@liiift-studio/vf-clamp'
import { readFile } from 'fs/promises'

const font = await readFile('MyFont-VF.ttf')
const { axes, instances } = await getInstances(font)

// axes: [{ tag: 'wght', minimum: 100, default: 400, maximum: 900, name: 'Weight' }, ...]
// instances: [{ name: 'Regular', coordinates: { wght: 400 } }, ...]`} />
			</section>

			{/* REST API */}
			<section className="w-full max-w-2xl lg:max-w-5xl flex flex-col gap-6">
				<p className="text-xs uppercase tracking-widest opacity-50">REST API</p>
				<SettleP className="text-sm opacity-60 leading-relaxed max-w-lg">
					vfclamp.com exposes two endpoints for server-to-server use. Both require an API key.
					Contact <a href="mailto:hello@liiift.studio" className="opacity-100 hover:underline underline-offset-2">hello@liiift.studio</a> to request access.
				</SettleP>
				<CodeBlock code={`POST https://vfclamp.com/api/clamp
X-API-Key: <your-key>

{
  "fontUrl": "https://cdn.example.com/MyFont-VF.ttf",
  "format": "woff2",
  "outputs": [
    { "name": "Text", "instances": ["Light", "Bold"] },
    { "name": "Condensed", "axes": { "wdth": 75 } }
  ]
}
// → { results: [{ name, data, format, size }] }

POST https://vfclamp.com/api/instances
X-API-Key: <your-key>

{ "fontUrl": "https://cdn.example.com/MyFont-VF.ttf" }
// → { axes: [...], instances: [...] }`} />
			</section>

			{/* Limitations */}
			<section className="w-full max-w-2xl lg:max-w-5xl flex flex-col gap-6">
				<p className="text-xs uppercase tracking-widest opacity-50">Limitations</p>
				<div className="grid grid-cols-1 sm:grid-cols-2 gap-8 text-sm leading-relaxed opacity-70">
					<div className="flex flex-col gap-2">
						<p className="font-semibold opacity-100">Isolated selections produce static-like output</p>
						<SettleP>
							An output built from a single named instance — or from instances that all share the
							same coordinates — pins every axis and removes it from the design space. The result
							is a minimal font with no variation, not a variable font. Select at least two
							instances with differing axis values to keep variation.
						</SettleP>
					</div>
					<div className="flex flex-col gap-2">
						<p className="font-semibold opacity-100">Named instances must exist</p>
						<SettleP>
							The <code className="text-xs font-mono">instances</code> path looks up coordinates
							by name from the font&rsquo;s fvar table. If a name doesn&rsquo;t match exactly,
							clampFont throws. Use <code className="text-xs font-mono">getInstances()</code> to
							discover what names the font exposes before building your config.
						</SettleP>
					</div>
					<div className="flex flex-col gap-2">
						<p className="font-semibold opacity-100">Cold start latency</p>
						<SettleP>
							Pyodide (the Python WASM runtime) takes ~10 s to initialise on first use per
							process. Subsequent calls are fast. On vfclamp.com the engine is kept warm with
							a cron ping — cold starts mainly affect self-hosted or edge deployments.
						</SettleP>
					</div>
					<div className="flex flex-col gap-2">
						<p className="font-semibold opacity-100">Default axis value clamping</p>
						<SettleP>
							If you restrict an axis to a range that excludes its default value — for example,
							restricting <code className="text-xs font-mono">wght</code> to 100–300 when the font&rsquo;s
							default is 400 — fonttools silently clamps the default to the nearest bound.
							The output is valid, but the default weight will be 300, not 400. The Glyphs
							and RoboFont plugins log a console warning when this occurs.
						</SettleP>
					</div>
					<div className="flex flex-col gap-2">
						<p className="font-semibold opacity-100">CFF2 variable fonts</p>
						<SettleP>
							fonttools&rsquo; varLib.instancer has limited support for OTF/CFF2-based variable
							fonts. TTF (glyf + gvar) is fully supported. Most variable fonts shipping today
							are TTF-based, but if your font uses CFF2 outlines the instancer may error or
							produce unexpected results.
						</SettleP>
					</div>
					<div className="flex flex-col gap-2">
						<p className="font-semibold opacity-100">Output size</p>
						<SettleP>
							How much a clamped font shrinks depends on the source. Fonts with many
							intermediate masters across a wide axis range compress well; fonts with few
							masters may see little size reduction regardless of the range specified.
						</SettleP>
					</div>
					<div className="flex flex-col gap-2">
						<p className="font-semibold opacity-100">Single-threaded processing</p>
						<SettleP>
							Pyodide runs on a single thread. Multiple concurrent <code className="text-xs font-mono">clampFont()</code> calls
							queue behind each other. For batch workloads, process fonts sequentially or
							spread calls across multiple Node.js processes.
						</SettleP>
					</div>
				</div>
			</section>

			<SiteFooter current="vfClamp" npmVersion={version} siteVersion={siteVersion} />

		</main>
	)
}
