// vfClamp landing page — hero, demo, how it works, usage, WOFF2, REST API
import CodeBlock from "../components/CodeBlock"
import CopyInstall from "../components/CopyInstall"
import SiteFooter from "../components/SiteFooter"
import Demo from "../components/Demo"
import { MagnetChar } from "@liiift-studio/magnettype"
import { version } from "../../../package.json"
import { version as siteVersion } from "../../package.json"

export default function Home() {
	return (
		<main className="flex flex-col items-center px-6 py-20 gap-24">

			{/* Hero */}
			<section className="w-full max-w-2xl lg:max-w-5xl flex flex-col gap-6">
				<div className="flex flex-col gap-2">
					<p className="text-xs uppercase tracking-[0.18em] font-medium text-muted">vf-clamp</p>
					<h1 className="text-4xl lg:text-8xl xl:text-9xl" style={{ fontFamily: "var(--font-merriweather), serif", fontVariationSettings: '"wght" 300, "opsz" 144', lineHeight: "1.05em" }}>
						<MagnetChar as="span" minWeight={300} maxWeight={800} spreadRadius={220} fixedAxes={{ opsz: 144 }}>Restrict the range,</MagnetChar><br />
						<MagnetChar as="span" minWeight={300} maxWeight={800} spreadRadius={220} fixedAxes={{ opsz: 144 }} style={{ color: "var(--foreground-subtle)", fontStyle: "italic" }}>keep what varies.</MagnetChar>
					</h1>
				</div>
				<div className="flex items-center gap-4">
					<CopyInstall />
					<a
						href="https://github.com/Liiift-Studio/vf-clamp"
						target="_blank"
						rel="noopener noreferrer"
						className="text-sm text-muted hover:text-foreground transition-colors"
					>
						GitHub ↗
					</a>
				</div>
				<div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted tracking-wide">
					<span>TypeScript</span><span>·</span>
					<span>fonttools varLib.instancer</span><span>·</span>
					<span>Pyodide WASM</span><span>·</span>
					<span>TTF · OTF · WOFF · WOFF2</span>
				</div>
				<p className="text-base leading-relaxed max-w-lg">
					Deliver a variable font scoped to exactly the instances a customer bought — not
					the whole family. vf-clamp is the delivery layer for per-purchase micro-VFs: a new
					licensing tier between static styles and the full family.
				</p>
				<p className="text-base text-muted leading-relaxed max-w-lg">
					Under the hood it wraps fonttools&rsquo; varLib.instancer in a zero-install WASM runtime.
					Pass in a variable font and a map of axis constraints — pin an axis to remove it,
					restrict it to a sub-range, or leave it untouched. The output is a smaller,
					self-contained font trimmed to exactly the design space you declared.
				</p>
			</section>

			{/* Interactive demo */}
			<section className="w-full max-w-2xl lg:max-w-5xl flex flex-col gap-4">
				<h2 className="text-xs uppercase tracking-[0.18em] font-medium text-muted">Interactive demo</h2>
				<p className="text-sm text-muted leading-relaxed max-w-lg">
					This is what a customer&rsquo;s purchase produces. Load Encode Sans or drop any variable
					font, then select named instances — as if picking the styles in an order. Adjacent
					selections merge into a single output file; isolated selections generate their own,
					flagged in yellow. Preview the restricted design space live, watch the file size drop,
					then download the clamped fonts.
				</p>
				<div className="rounded-xl -mx-8 px-8 py-8" style={{ background: "color-mix(in oklch, var(--foreground) 20%, transparent)" }}>
					<Demo />
				</div>
			</section>

			{/* Integrations */}
			<section className="w-full max-w-2xl lg:max-w-5xl flex flex-col gap-6">
				<h2 className="text-xs uppercase tracking-[0.18em] font-medium text-muted">Integrations</h2>
				<p className="text-sm text-muted leading-relaxed max-w-lg">
					vf-clamp is available as a CLI, and as native plugins for Glyphs.app, RoboFont, and VS Code —
					all using the same axis-constraint model as the npm package.
				</p>
				<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

					{/* CLI */}
					<div className="flex flex-col gap-3 rounded-xl p-6" style={{ background: "color-mix(in oklch, var(--foreground) 20%, transparent)" }}>
						<div className="flex items-center gap-3">
							<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="opacity-60" aria-hidden="true">
								<polyline points="4 17 10 11 4 5" />
								<line x1="12" y1="19" x2="20" y2="19" />
							</svg>
							<span className="text-sm font-semibold">CLI</span>
						</div>
						<p className="text-xs text-muted leading-relaxed">
							Run <code className="font-mono">vf-clamp</code> from any shell. Pass a font file, a JSON config, and get clamped outputs written to disk. Scriptable and CI-friendly.
						</p>
						<code className="text-xs font-mono text-subtle">vf-clamp clamp font.ttf --axis wght:400:700</code>
						<div className="flex items-center gap-2 mt-auto pt-3">
							<a href="https://github.com/Liiift-Studio/vf-clamp-cli" target="_blank" rel="noopener noreferrer" className="flex-1 text-center text-xs font-medium py-2 px-3 rounded-lg bg-foreground/10 hover:bg-foreground/15 transition-colors">GitHub ↗</a>
							<a href="https://github.com/Liiift-Studio/vf-clamp-cli#readme" target="_blank" rel="noopener noreferrer" className="flex-1 text-center text-xs py-2 px-3 rounded-lg border border-foreground/15 hover:border-foreground/30 hover:bg-foreground/5 transition-colors text-muted hover:text-foreground">Docs ↗</a>
						</div>
					</div>

					{/* VS Code */}
					<div className="flex flex-col gap-3 rounded-xl p-6" style={{ background: "color-mix(in oklch, var(--foreground) 20%, transparent)" }}>
						<div className="flex items-center gap-3">
							{/* VS Code: the distinctive four-panel / fragmented-square logo shape */}
							<svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" className="opacity-60" aria-hidden="true">
								<path d="M13 2.5L4.5 10.5l3 1.5L13 2.5z"/>
								<path d="M4.5 15.5l8.5-3V2.5L4.5 10.5v5z"/>
							</svg>
							<span className="text-sm font-semibold">VS Code</span>
						</div>
						<p className="text-xs text-muted leading-relaxed">
							Right-click any <code className="font-mono">.ttf</code> in the Explorer to open the vf-clamp panel. Select instances, preview the design space, and export — without leaving your editor.
						</p>
						<code className="text-xs font-mono text-subtle">vf-clamp.vscode-extension</code>
						<div className="flex items-center gap-2 mt-auto pt-3">
							<a href="https://github.com/Liiift-Studio/vf-clamp-vscode/releases/latest/download/vf-clamp.vsix" target="_blank" rel="noopener noreferrer" className="flex-1 text-center text-xs font-medium py-2 px-3 rounded-lg bg-foreground/10 hover:bg-foreground/15 transition-colors">Download .vsix ↗</a>
							<a href="https://github.com/Liiift-Studio/vf-clamp-vscode" target="_blank" rel="noopener noreferrer" className="flex-1 text-center text-xs py-2 px-3 rounded-lg border border-foreground/15 hover:border-foreground/30 hover:bg-foreground/5 transition-colors text-muted hover:text-foreground">GitHub ↗</a>
						</div>
					</div>

					{/* Glyphs.app + RoboFont — combined card, shared screenshot */}
					<div className="flex flex-col gap-3 rounded-xl p-6 sm:col-span-2" style={{ background: "color-mix(in oklch, var(--foreground) 20%, transparent)" }}>
						<div className="flex items-center gap-3">
							{/* Glyphs.app: bezier path with anchor + handle nodes */}
							<svg width="18" height="18" viewBox="0 0 18 18" fill="none" className="opacity-60" aria-hidden="true">
								<path d="M3 15C4 9 9 4 15 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
								<circle cx="3" cy="15" r="2" fill="currentColor"/>
								<circle cx="15" cy="3" r="2" fill="currentColor"/>
								<line x1="3" y1="15" x2="3" y2="8" stroke="currentColor" strokeWidth="1" opacity="0.45"/>
								<line x1="15" y1="3" x2="8" y2="3" stroke="currentColor" strokeWidth="1" opacity="0.45"/>
								<circle cx="3" cy="8" r="1.5" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.65"/>
								<circle cx="8" cy="3" r="1.5" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.65"/>
							</svg>
							{/* RoboFont: robot face */}
							<svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" className="opacity-60" aria-hidden="true">
								<rect x="3" y="7" width="12" height="9" rx="2" strokeWidth="1.4"/>
								<line x1="9" y1="7" x2="9" y2="4" strokeWidth="1.4"/>
								<circle cx="9" cy="3" r="1.2" fill="currentColor" stroke="none"/>
								<circle cx="6.5" cy="11.5" r="1.5" fill="currentColor" stroke="none"/>
								<circle cx="11.5" cy="11.5" r="1.5" fill="currentColor" stroke="none"/>
								<path d="M6 14.5h6" strokeWidth="1.4" strokeLinecap="round"/>
							</svg>
							<span className="text-sm font-semibold">Glyphs.app &amp; RoboFont</span>
						</div>
						<p className="text-xs text-muted leading-relaxed max-w-2xl">
							Native plugins for Glyphs.app and RoboFont. Select named instances from your open font (or a TTF/OTF on disk), preview the licensed design space in a live chart with an animated specimen, and export restricted VFs — without leaving your type editor. Both plugins share the same UI; pick the one for your tool.
						</p>
						<div className="rounded-lg border border-foreground/10 overflow-hidden bg-foreground/30 flex items-center justify-center">
							<img src="/screenshots/glyphs-robofont.png" alt="vf-clamp dialog inside Glyphs.app — RoboFont uses the same UI" className="max-w-full h-auto" />
						</div>
						<div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-auto pt-3">
							<div className="flex flex-col gap-2">
								<code className="text-xs font-mono text-subtle">vf-clamp-glyphs.glyphsPlugin</code>
								<div className="flex gap-2">
									<a href="https://github.com/Liiift-Studio/vf-clamp-glyphs/releases/latest/download/vf-clamp-glyphs.zip" target="_blank" rel="noopener noreferrer" className="flex-1 text-center text-xs font-medium py-2 px-3 rounded-lg bg-foreground/10 hover:bg-foreground/15 transition-colors">Glyphs.app ↗</a>
									<a href="https://github.com/Liiift-Studio/vf-clamp-glyphs" target="_blank" rel="noopener noreferrer" className="flex-1 text-center text-xs py-2 px-3 rounded-lg border border-foreground/15 hover:border-foreground/30 hover:bg-foreground/5 transition-colors text-muted hover:text-foreground">GitHub ↗</a>
								</div>
							</div>
							<div className="flex flex-col gap-2">
								<code className="text-xs font-mono text-subtle">vf-clamp.roboFontExt</code>
								<div className="flex gap-2">
									<a href="https://github.com/Liiift-Studio/vf-clamp-robofont/releases/latest/download/vf-clamp-robofont.zip" target="_blank" rel="noopener noreferrer" className="flex-1 text-center text-xs font-medium py-2 px-3 rounded-lg bg-foreground/10 hover:bg-foreground/15 transition-colors">RoboFont ↗</a>
									<a href="https://github.com/Liiift-Studio/vf-clamp-robofont" target="_blank" rel="noopener noreferrer" className="flex-1 text-center text-xs py-2 px-3 rounded-lg border border-foreground/15 hover:border-foreground/30 hover:bg-foreground/5 transition-colors text-muted hover:text-foreground">GitHub ↗</a>
								</div>
							</div>
						</div>
					</div>

				</div>
			</section>

			{/* For foundries */}
			<section className="w-full max-w-2xl lg:max-w-5xl flex flex-col gap-6">
				<h2 className="text-xs uppercase tracking-[0.18em] font-medium text-muted">For foundries</h2>
				<p className="text-base text-muted leading-relaxed max-w-xl">
					Today a variable font is all-or-nothing: customers buy the whole family to get one,
					or they buy statics and lose interpolation entirely. vf-clamp adds the tier in
					between — a variable font scoped to exactly the named instances a customer purchased,
					generated and delivered at checkout.
				</p>

				{/* Purchase → Clamp → Deliver */}
				<div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
					{[
						{ n: "01", t: "Purchase", d: "A customer buys two or more adjacent styles — Light through Bold, or a single width across its weights." },
						{ n: "02", t: "Clamp", d: "Your store POSTs the order to the vf-clamp API. The design space is clamped to the range of those instances; everything outside is pruned." },
						{ n: "03", t: "Deliver", d: "A scoped VF comes back in seconds, name table rewritten to the purchased range, in the format the licence calls for." },
					].map((step) => (
						<div key={step.n} className="flex flex-col gap-2 rounded-xl p-5" style={{ background: "color-mix(in oklch, var(--foreground) 20%, transparent)" }}>
							<span className="text-xs font-mono text-faint">{step.n}</span>
							<span className="text-sm font-semibold">{step.t}</span>
							<span className="text-xs text-muted leading-relaxed">{step.d}</span>
						</div>
					))}
				</div>

				{/* Value props */}
				<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">

					<div className="flex flex-col gap-2 rounded-xl p-6" style={{ background: "color-mix(in oklch, var(--foreground) 20%, transparent)" }}>
						<span className="text-sm font-semibold">A new revenue tier</span>
						<p className="text-xs text-muted leading-relaxed">
							Two adjacent styles become a variable purchase, not just two statics. Price a
							ladder — two-style VF, subfamily, full family — and capture customers who want
							interpolation but don&rsquo;t need every weight.
						</p>
					</div>

					<div className="flex flex-col gap-2 rounded-xl p-6" style={{ background: "color-mix(in oklch, var(--foreground) 20%, transparent)" }}>
						<span className="text-sm font-semibold">Licence containment</span>
						<p className="text-xs text-muted leading-relaxed">
							A full VF ships every master — customers can reach weights they never paid for.
							A clamped VF physically contains only the purchased range. There&rsquo;s nothing
							outside the licence left in the file to leak.
						</p>
					</div>

					<div className="flex flex-col gap-2 rounded-xl p-6" style={{ background: "color-mix(in oklch, var(--foreground) 20%, transparent)" }}>
						<span className="text-sm font-semibold">Branded, traceable files</span>
						<p className="text-xs text-muted leading-relaxed">
							The name table — family, full name, PostScript name — is rewritten to the
							purchased range. Every delivered file is identifiable as that specific order,
							which helps with support and tracing leaks.
						</p>
					</div>

					<div className="flex flex-col gap-2 rounded-xl p-6" style={{ background: "color-mix(in oklch, var(--foreground) 20%, transparent)" }}>
						<span className="text-sm font-semibold">Lighter files for the web</span>
						<p className="text-xs text-muted leading-relaxed">
							A site that uses only Medium&ndash;Black shouldn&rsquo;t ship Thin&ndash;Light
							deadweight. Clamping prunes the masters outside the licensed range, so the
							customer gets variation across what they bought — and a smaller download.
						</p>
					</div>

					<div className="flex flex-col gap-2 rounded-xl p-6" style={{ background: "color-mix(in oklch, var(--foreground) 20%, transparent)" }}>
						<span className="text-sm font-semibold">Sell bespoke cuts</span>
						<p className="text-xs text-muted leading-relaxed">
							Pin an axis to a coordinate that was never a named instance — a custom optical
							size or width — and sell that exact cut. The retail family doesn&rsquo;t have to
							ship it for a customer to buy it.
						</p>
					</div>

					<div className="flex flex-col gap-2 rounded-xl p-6" style={{ background: "color-mix(in oklch, var(--foreground) 20%, transparent)" }}>
						<span className="text-sm font-semibold">Ready for opsz demand</span>
						<p className="text-xs text-muted leading-relaxed">
							Browsers now drive the optical-size axis automatically with
							<code className="font-mono text-muted"> font-optical-sizing: auto</code>, keying
							off the rendered point size. As <code className="font-mono text-muted">opsz</code>
							{" "}matters more, delivering it clamped to a usable range keeps files honest and small.
						</p>
					</div>

				</div>
			</section>

		{/* How it works */}
			<section className="w-full max-w-2xl lg:max-w-5xl flex flex-col gap-6">
				<h2 className="text-xs uppercase tracking-[0.18em] font-medium text-muted">How it works</h2>
				<div className="grid grid-cols-1 sm:grid-cols-2 gap-12 text-sm leading-relaxed text-muted prose-grid">
					<div className="flex flex-col gap-3">
						<p className="font-semibold text-foreground text-base">Start from named instances</p>
						<p>
							Variable fonts ship with named instances — presets like Regular, Bold, or Condensed
							that map to specific axis coordinates. Use <code className="text-xs font-mono">getInstances()</code> to
							read them, then pass adjacent instances as a subfamily to produce a restricted VF that
							spans exactly that slice of the design space.
						</p>
					</div>
					<div className="flex flex-col gap-3">
						<p className="font-semibold text-foreground text-base">Pin an axis to remove it</p>
						<p>
							Setting an axis to a number fixes it at that value and removes it from the
							output font&rsquo;s fvar table. Unused glyph masters and gvar deltas are
							stripped — the result is a smaller, static-like font with no unnecessary variation.
						</p>
					</div>
					<div className="flex flex-col gap-3">
						<p className="font-semibold text-foreground text-base">Range-restrict to slim the space</p>
						<p>
							Passing <code className="text-xs font-mono">&#123; min, max &#125;</code> keeps
							the axis variable but clips it to that sub-range. Masters outside the bounds are
							pruned — a 100–900 weight axis becomes a tight 400–700 slice without changing
							how the axis behaves inside that range.
						</p>
					</div>
					<div className="flex flex-col gap-3">
						<p className="font-semibold text-foreground text-base">No Python, multiple outputs</p>
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
				<h2 className="text-xs uppercase tracking-[0.18em] font-medium text-muted">Usage</h2>
				<div className="flex flex-col gap-8 text-sm">

					<div className="flex flex-col gap-3">
						<p className="text-muted">From named instances — design-space range computed automatically</p>
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
						<p className="text-muted">From explicit axis ranges</p>
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
						<p className="text-muted">Mix instances and axes — explicit axes override the computed range</p>
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
						<p className="text-muted">Inspect a font first</p>
						<CodeBlock code={`import { getInstances } from '@liiift-studio/vf-clamp'
import { readFile } from 'fs/promises'

const font = await readFile('MyFont-VF.ttf')
const { axes, instances } = await getInstances(font)

// axes: [{ tag: 'wght', name: 'Weight', minimum: 100, default: 400, maximum: 900 }, ...]
// instances: [{ name: 'Regular', coordinates: { wght: 400 } }, ...]`} />
					</div>

					<div className="flex flex-col gap-3">
						<p className="text-muted">CLI — from the shell</p>
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
						<p className="text-muted" id="axis-value-table-label">Axis value reference</p>
						<table className="w-full text-xs" aria-labelledby="axis-value-table-label">
							<caption className="sr-only">Axis value reference — how different value types constrain an axis</caption>
							<thead>
								<tr className="text-subtle text-left">
									<th className="pb-2 pr-6 font-normal">Value</th>
									<th className="pb-2 font-normal">Effect</th>
								</tr>
							</thead>
							<tbody className="text-muted">
								<tr className="border-t border-foreground/10 hover:bg-foreground/5 transition-colors"><td className="py-2 pr-6 font-mono">number</td><td className="py-2">Pin axis at value — removed from output design space</td></tr>
								<tr className="border-t border-foreground/10 hover:bg-foreground/5 transition-colors"><td className="py-2 pr-6 font-mono">&#123; min, max &#125;</td><td className="py-2">Restrict to range — axis stays variable within bounds</td></tr>
								<tr className="border-t border-foreground/10 hover:bg-foreground/5 transition-colors"><td className="py-2 pr-6 font-mono">null</td><td className="py-2">Explicitly keep full original range — same as omitting the axis entirely</td></tr>
								<tr className="border-t border-foreground/10 hover:bg-foreground/5 transition-colors"><td className="py-2 pr-6 font-mono italic text-subtle">omitted</td><td className="py-2">Keep full original range — axis is unchanged</td></tr>
							</tbody>
						</table>
					</div>

				</div>
			</section>

			{/* REST API */}
			<section className="w-full max-w-2xl lg:max-w-5xl flex flex-col gap-6">
				<h2 className="text-xs uppercase tracking-[0.18em] font-medium text-muted">REST API — the delivery layer</h2>
				<p className="text-sm text-muted leading-relaxed max-w-lg">
					This is how a storefront wires vf-clamp into checkout: turn a purchase event into a
					delivered file. vfclamp.com exposes two endpoints — one to read a font&rsquo;s instances,
					one to clamp and return scoped fonts by URL. Both require an API key. Contact{" "}
					<a href="mailto:hello@liiift.studio" className="opacity-100 hover:underline underline-offset-2">hello@liiift.studio</a> to request access.
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
				<h2 className="text-xs uppercase tracking-[0.18em] font-medium text-muted">Limitations</h2>
				<div className="grid grid-cols-1 sm:grid-cols-2 gap-8 text-sm leading-relaxed text-muted">
					<div className="flex flex-col gap-2">
						<p className="font-semibold text-foreground">Isolated selections produce static-like output</p>
						<p>
							An output built from a single named instance — or from instances that all share the
							same coordinates — pins every axis and removes it from the design space. The result
							is a minimal font with no variation, not a variable font. Select at least two
							instances with differing axis values to keep variation.
						</p>
					</div>
					<div className="flex flex-col gap-2">
						<p className="font-semibold text-foreground">Named instances must exist</p>
						<p>
							The <code className="text-xs font-mono">instances</code> path looks up coordinates
							by name from the font&rsquo;s fvar table. If a name doesn&rsquo;t match exactly,
							clampFont throws. Use <code className="text-xs font-mono">getInstances()</code> to
							discover what names the font exposes before building your config.
						</p>
					</div>
					<div className="flex flex-col gap-2">
						<p className="font-semibold text-foreground">Cold start latency</p>
						<p>
							Pyodide (the Python WASM runtime) takes ~10 s to initialise on first use per
							process. Subsequent calls are fast. On vfclamp.com the engine is kept warm with
							a cron ping — cold starts mainly affect self-hosted or edge deployments.
						</p>
					</div>
					<div className="flex flex-col gap-2">
						<p className="font-semibold text-foreground">Default axis value clamping</p>
						<p>
							If you restrict an axis to a range that excludes its default value — for example,
							restricting <code className="text-xs font-mono">wght</code> to 100–300 when the font&rsquo;s
							default is 400 — fonttools silently clamps the default to the nearest bound.
							The output is valid, but the default weight will be 300, not 400. The Glyphs
							and RoboFont plugins log a console warning when this occurs.
						</p>
					</div>
					<div className="flex flex-col gap-2">
						<p className="font-semibold text-foreground">CFF2 variable fonts</p>
						<p>
							fonttools&rsquo; varLib.instancer has limited support for OTF/CFF2-based variable
							fonts. TTF (glyf + gvar) is fully supported. Most variable fonts shipping today
							are TTF-based, but if your font uses CFF2 outlines the instancer may error or
							produce unexpected results.
						</p>
					</div>
					<div className="flex flex-col gap-2">
						<p className="font-semibold text-foreground">Output size</p>
						<p>
							How much a clamped font shrinks depends on the source. Fonts with many
							intermediate masters across a wide axis range compress well; fonts with few
							masters may see little size reduction regardless of the range specified.
						</p>
					</div>
					<div className="flex flex-col gap-2">
						<p className="font-semibold text-foreground">Single-threaded processing</p>
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
