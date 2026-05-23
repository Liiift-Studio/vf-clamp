// vfClamp landing page — hero, demo, how it works, usage, WOFF2, REST API
import CodeBlock from "../components/CodeBlock"
import SiteFooter from "../components/SiteFooter"
import Demo from "../components/Demo"
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
						Restrict the range,<br />
						<span style={{ opacity: 0.5, fontStyle: "italic" }}>keep what varies.</span>
					</h1>
				</div>
				<div className="flex items-center gap-4">
					<code className="text-sm font-mono bg-white/5 px-3 py-1.5 rounded opacity-80">
						npm install vf-clamp
					</code>
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
					<span>TTF + WOFF2 output</span>
				</div>
				<p className="text-base opacity-60 leading-relaxed max-w-lg">
					vf-clamp wraps fonttools&rsquo; varLib.instancer in a zero-install WASM runtime.
					Pass in a variable font and a map of axis constraints — pin an axis to remove it,
					restrict it to a sub-range, or leave it untouched. The output is a smaller,
					self-contained font trimmed to exactly the design space you declared.
				</p>
			</section>

			{/* Interactive demo */}
		<section className="w-full max-w-2xl lg:max-w-5xl flex flex-col gap-4">
			<p className="text-xs uppercase tracking-widest opacity-50">Interactive demo</p>
			<p className="text-sm opacity-50 leading-relaxed max-w-lg">
				Load Encode Sans or drop any variable font. Select named instances — adjacent selections
				merge into a single output file. Isolated selections generate their own file, flagged in yellow.
				Preview the restricted design space live, then download the clamped TTFs.
			</p>
			<div className="rounded-xl -mx-2 px-8 py-8" style={{ background: "rgba(0,0,0,0.2)" }}>
				<Demo />
			</div>
		</section>

		{/* How it works */}
			<section className="w-full max-w-2xl lg:max-w-5xl flex flex-col gap-6">
				<p className="text-xs uppercase tracking-widest opacity-50">How it works</p>
				<div className="grid grid-cols-1 sm:grid-cols-2 gap-12 text-sm leading-relaxed opacity-70 prose-grid">
					<div className="flex flex-col gap-3">
						<p className="font-semibold opacity-100 text-base">Start from named instances</p>
						<p>
							Variable fonts ship with named instances — presets like Regular, Bold, or Condensed
							that map to specific axis coordinates. Use <code className="text-xs font-mono">getInstances()</code> to
							read them, then pass adjacent instances as a subfamily to produce a restricted VF that
							spans exactly that slice of the design space.
						</p>
					</div>
					<div className="flex flex-col gap-3">
						<p className="font-semibold opacity-100 text-base">Pin an axis to remove it</p>
						<p>
							Setting an axis to a number fixes it at that value and removes it from the
							output font&rsquo;s fvar table. Unused glyph masters and gvar deltas are
							stripped — the result is a smaller, static-like font with no unnecessary variation.
						</p>
					</div>
					<div className="flex flex-col gap-3">
						<p className="font-semibold opacity-100 text-base">Range-restrict to slim the space</p>
						<p>
							Passing <code className="text-xs font-mono">&#123; min, max &#125;</code> keeps
							the axis variable but clips it to that sub-range. Masters outside the bounds are
							pruned — a 100–900 weight axis becomes a tight 400–700 slice without changing
							how the axis behaves inside that range.
						</p>
					</div>
					<div className="flex flex-col gap-3">
						<p className="font-semibold opacity-100 text-base">No Python, multiple outputs</p>
						<p>
							fonttools runs inside Pyodide — a Python interpreter compiled to WebAssembly.
							One <code className="text-xs font-mono">clampFont()</code> call produces any number
							of restricted variants from the same source. The Pyodide instance is a shared
							singleton: the cold start is paid once per process, subsequent calls are fast.
						</p>
					</div>
				</div>
			</section>

			{/* Usage */}
			<section className="w-full max-w-2xl lg:max-w-5xl flex flex-col gap-6">
				<p className="text-xs uppercase tracking-widest opacity-50">Usage</p>
				<div className="flex flex-col gap-8 text-sm">

					<div className="flex flex-col gap-3">
						<p className="opacity-50">From named instances — hull computed automatically</p>
						<CodeBlock code={`import { clampFont } from 'vf-clamp'
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
						<p className="opacity-50">From explicit axis ranges</p>
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
						<p className="opacity-50">Mix instances and axes — axes override the hull</p>
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
						<p className="opacity-50">Axis value reference</p>
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
								<tr className="border-t border-white/10 hover:bg-white/5 transition-colors"><td className="py-2 pr-6 font-mono">null</td><td className="py-2">Drop axis at its default — removed from output, same as pinning at default</td></tr>
								<tr className="border-t border-white/10 hover:bg-white/5 transition-colors"><td className="py-2 pr-6 font-mono italic opacity-50">omitted</td><td className="py-2">Keep full original range — axis is unchanged</td></tr>
							</tbody>
						</table>
					</div>

				</div>
			</section>

			{/* Inspect a font */}
			<section className="w-full max-w-2xl lg:max-w-5xl flex flex-col gap-6">
				<p className="text-xs uppercase tracking-widest opacity-50">Inspect a font</p>
				<p className="text-sm opacity-60 leading-relaxed max-w-lg">
					<code className="text-xs font-mono">getInstances()</code> reads the fvar table and returns every axis
					and named instance defined in the font — useful for discovering what can be clamped
					before building a subfamily config.
				</p>
				<CodeBlock code={`import { getInstances } from 'vf-clamp'
import { readFile } from 'fs/promises'

const font = await readFile('MyFont-VF.ttf')
const { axes, instances } = await getInstances(font)

// axes: [{ tag: 'wght', minimum: 100, default: 400, maximum: 900, name: 'Weight' }, ...]
// instances: [{ name: 'Regular', coordinates: { wght: 400 } }, ...]`} />
			</section>

			{/* REST API */}
			<section className="w-full max-w-2xl lg:max-w-5xl flex flex-col gap-6">
				<p className="text-xs uppercase tracking-widest opacity-50">REST API</p>
				<p className="text-sm opacity-60 leading-relaxed max-w-lg">
					vfclamp.com exposes two endpoints for server-to-server use. Both require an API key.
					Contact <a href="mailto:hello@liiift.studio" className="opacity-100 hover:underline underline-offset-2">hello@liiift.studio</a> to request access.
				</p>
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
						<p className="font-semibold opacity-100">Named instances must exist</p>
						<p>
							The <code className="text-xs font-mono">instances</code> path looks up coordinates
							by name from the font&rsquo;s fvar table. If a name doesn&rsquo;t match exactly,
							clampFont throws. Use <code className="text-xs font-mono">getInstances()</code> to
							discover what names the font exposes before building your config.
						</p>
					</div>
					<div className="flex flex-col gap-2">
						<p className="font-semibold opacity-100">Isolated selections produce static-like output</p>
						<p>
							An output built from a single named instance — or from instances that all share the
							same coordinates — pins every axis and removes it from the design space. The result
							is a minimal font with no variation, not a variable font. Select at least two
							instances with differing axis values to keep variation.
						</p>
					</div>
					<div className="flex flex-col gap-2">
						<p className="font-semibold opacity-100">Cold start latency</p>
						<p>
							Pyodide (the Python WASM runtime) takes ~10 s to initialise on first use per
							process. Subsequent calls are fast. On vfclamp.com the engine is kept warm with
							a cron ping — cold starts mainly affect self-hosted or edge deployments.
						</p>
					</div>
					<div className="flex flex-col gap-2">
						<p className="font-semibold opacity-100">CFF2 variable fonts</p>
						<p>
							fonttools&rsquo; varLib.instancer has limited support for OTF/CFF2-based variable
							fonts. TTF (glyf + gvar) is fully supported. Most variable fonts shipping today
							are TTF-based, but if your font uses CFF2 outlines the instancer may error or
							produce unexpected results.
						</p>
					</div>
					<div className="flex flex-col gap-2">
						<p className="font-semibold opacity-100">Output size</p>
						<p>
							How much a clamped font shrinks depends on the source. Fonts with many
							intermediate masters across a wide axis range compress well; fonts with few
							masters may see little size reduction regardless of the range specified.
						</p>
					</div>
					<div className="flex flex-col gap-2">
						<p className="font-semibold opacity-100">Single-threaded processing</p>
						<p>
							Pyodide runs on a single thread. Multiple concurrent <code className="text-xs font-mono">clampFont()</code> calls
							queue behind each other. For batch workloads, process fonts sequentially or
							spread calls across multiple Node.js processes.
						</p>
					</div>
				</div>
			</section>

			<SiteFooter current="vfClamp" npmVersion={version} siteVersion={siteVersion} />

		</main>
	)
}
