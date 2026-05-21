// site/src/app/page.tsx — vfclamp.com landing page
export default function Home() {
	return (
		<main className="flex-1 max-w-3xl mx-auto px-6 py-20 w-full">
			<header className="mb-16">
				<p className="text-sm font-mono text-neutral-500 mb-3">npm install vf-clamp</p>
				<h1 className="text-4xl font-bold tracking-tight mb-4">vf-clamp</h1>
				<p className="text-lg text-neutral-400 leading-relaxed">
					Restrict a variable font&apos;s axis ranges to a specific subfamily scope.
					Like <code className="text-neutral-300 bg-neutral-800 px-1 py-0.5 rounded text-sm">clamp()</code> for type design.
				</p>
			</header>

			<section className="mb-14">
				<h2 className="text-xs font-mono text-neutral-500 uppercase tracking-widest mb-4">Install</h2>
				<pre className="bg-neutral-900 border border-neutral-800 rounded-lg p-4 text-sm font-mono text-neutral-200 overflow-x-auto">
					<code>npm install vf-clamp</code>
				</pre>
			</section>

			<section className="mb-14">
				<h2 className="text-xs font-mono text-neutral-500 uppercase tracking-widest mb-4">Usage</h2>
				<pre className="bg-neutral-900 border border-neutral-800 rounded-lg p-4 text-sm font-mono text-neutral-200 overflow-x-auto leading-relaxed">
					<code>{`import { clampFont } from 'vf-clamp'
import { readFile, writeFile } from 'fs/promises'

const source = await readFile('Omnes-VF.ttf')

const results = await clampFont(source, {
  subfamilies: [
    // pin wdth to 75 — axis removed from output
    { name: 'Condensed', axes: { wdth: 75 } },

    // restrict wdth to a range — axis stays variable
    { name: 'SemiCondensed', axes: { wdth: { min: 87.5, max: 100 } } },

    // mixed: pin width, keep full weight range
    { name: 'Narrow', axes: { wdth: 62.5 } },
  ],
})

for (const result of results) {
  await writeFile(\`Omnes-\${result.name}-VF.ttf\`, result.buffer)
}`}</code>
				</pre>
			</section>

			<section className="mb-14">
				<h2 className="text-xs font-mono text-neutral-500 uppercase tracking-widest mb-4">Axis values</h2>
				<div className="space-y-4 text-sm text-neutral-400">
					<div className="flex gap-4">
						<code className="text-neutral-300 bg-neutral-800 px-2 py-1 rounded shrink-0">number</code>
						<span>Pin an axis to a single value. The axis is removed from the output font.</span>
					</div>
					<div className="flex gap-4">
						<code className="text-neutral-300 bg-neutral-800 px-2 py-1 rounded shrink-0">{'{ min, max }'}</code>
						<span>Restrict an axis to a range. The axis stays variable within those bounds.</span>
					</div>
					<div className="flex gap-4">
						<code className="text-neutral-300 bg-neutral-800 px-2 py-1 rounded shrink-0">null</code>
						<span>Drop an axis entirely, fixing it at its current default value.</span>
					</div>
					<div className="flex gap-4">
						<span className="text-neutral-500 italic shrink-0">omitted</span>
						<span>Axes not listed in the config keep their full original range.</span>
					</div>
				</div>
			</section>

			<section className="mb-14">
				<h2 className="text-xs font-mono text-neutral-500 uppercase tracking-widest mb-4">How it works</h2>
				<p className="text-sm text-neutral-400 leading-relaxed">
					vf-clamp wraps{' '}
					<a href="https://fonttools.readthedocs.io/en/latest/varLib/instancer.html" className="text-neutral-300 underline underline-offset-2">
						fonttools varLib.instancer
					</a>{' '}
					via{' '}
					<a href="https://github.com/web-alchemy/fonttools" className="text-neutral-300 underline underline-offset-2">
						@web-alchemy/fonttools
					</a>{' '}
					(Pyodide WASM). No Python installation required. Unused masters, gvar deltas,
					and axis records are trimmed from the output.
				</p>
			</section>

			<section>
				<h2 className="text-xs font-mono text-neutral-500 uppercase tracking-widest mb-4">API microservice</h2>
				<p className="text-sm text-neutral-400 leading-relaxed mb-4">
					vfclamp.com exposes a REST endpoint for server-side use. Accepts a font URL and returns restricted variants as base64.
				</p>
				<pre className="bg-neutral-900 border border-neutral-800 rounded-lg p-4 text-sm font-mono text-neutral-200 overflow-x-auto leading-relaxed">
					<code>{`POST https://vfclamp.com/api/clamp
X-API-Key: <your-key>
Content-Type: application/json

{
  "fontUrl": "https://cdn.example.com/MyFont-VF.ttf",
  "subfamilies": [
    { "name": "Condensed", "axes": { "wdth": 75 } }
  ]
}`}</code>
				</pre>
			</section>

			<footer className="mt-20 pt-8 border-t border-neutral-800 text-xs text-neutral-600 flex justify-between">
				<span>vf-clamp by <a href="https://liiift.studio" className="text-neutral-500 hover:text-neutral-400">Liiift Studio</a></span>
				<a href="https://github.com/Liiift-Studio/vf-clamp" className="text-neutral-500 hover:text-neutral-400">GitHub</a>
			</footer>
		</main>
	)
}
