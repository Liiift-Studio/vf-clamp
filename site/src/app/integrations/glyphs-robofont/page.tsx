// Per-plugin integration page — deep dive on the Glyphs.app and RoboFont plugins
// (they share the same UI, so they share a page).
import SiteFooter from "../../../components/SiteFooter"
import { version } from "../../../../../package.json"
import { version as siteVersion } from "../../../../package.json"

export const metadata = {
	title: "Glyphs.app & RoboFont — vf-clamp",
	description:
		"Native plugins for Glyphs.app and RoboFont. Preview the licensed design space, animate the specimen, and export restricted variable fonts without leaving your type editor.",
}

const FEATURES = [
	{
		title: "Interactive design-space chart",
		body:
			"A 2D plot of the font's named instances with the licensed sub-range highlighted. Click any dot to toggle its selection; the rectangle and counters update live.",
	},
	{
		title: "Animated specimen",
		body:
			"HOHO Anes sweeps through the licensed design space at 30 fps. A soft tracking ring on the chart follows the specimen's exact variation values, so you can see the licensed range in motion.",
	},
	{
		title: "Structural counters",
		body:
			"~38 KB · 5 instances · 2 masters · 2 ax · 1 pinned. Surfaces what's actually driving the file size before you generate.",
	},
	{
		title: "Source presets",
		body:
			"Save the current instance selection by name, recall it on demand, manage saved entries. Persistence is a single JSON file at ~/.vf-clamp/presets.json.",
	},
	{
		title: "Full keyboard navigation",
		body:
			"⌘A/⌘D/⌘I for bulk select; ⇥ Tab to cycle focus; ␣ Space to toggle; ⏎ Enter to generate. The chips are always visible at the bottom of the action bar.",
	},
	{
		title: "VoiceOver-ready",
		body:
			"Both custom views expose dynamic accessibility values. The chart's instance dots are individually navigable; VO + Space toggles selection just like a mouse click.",
	},
	{
		title: "Activity log with peripheral signal",
		body:
			"A scrollable LOG pane replaces the prior single-line status. New entries flash a 3-px accent stripe on the pane's left edge for 0.8 s so async events aren't missed.",
	},
]

const PLUGINS = [
	{
		name: "Glyphs.app",
		bundleName: "vf-clamp-glyphs.glyphsPlugin",
		requirement: "Glyphs 3.x (3.2+ recommended for the Open Font source mode)",
		downloadUrl:
			"https://github.com/Liiift-Studio/vf-clamp-glyphs/releases/latest/download/vf-clamp-glyphs.zip",
		repoUrl: "https://github.com/Liiift-Studio/vf-clamp-glyphs",
		install:
			"Unzip the .glyphsPlugin bundle into ~/Library/Application Support/Glyphs 3/Plugins/ and restart Glyphs. The menu item appears under Script › vf-clamp › Generate Restricted VFs.",
	},
	{
		name: "RoboFont",
		bundleName: "vf-clamp.roboFontExt",
		requirement:
			"RoboFont 4.0+ — uses the bundled Python 3 + fonttools + vanilla. Open Font source mode requires a designspace file alongside the UFO.",
		downloadUrl:
			"https://github.com/Liiift-Studio/vf-clamp-robofont/releases/latest/download/vf-clamp-robofont.zip",
		repoUrl: "https://github.com/Liiift-Studio/vf-clamp-robofont",
		install:
			"Drag the .roboFontExt bundle to RoboFont's Extensions panel. The menu item appears under Extensions › vf-clamp.",
	},
]

export default function GlyphsRoboFontPage() {
	return (
		<main className="flex flex-col items-center px-6 py-20 gap-20">
			{/* Hero */}
			<section className="w-full max-w-2xl lg:max-w-5xl flex flex-col gap-6">
				<div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] font-medium text-muted">
					<a href="/" className="hover:text-foreground transition-colors">vf-clamp</a>
					<span>›</span>
					<span>integrations</span>
				</div>
				<h1 className="text-4xl lg:text-6xl xl:text-7xl leading-[1.05]" style={{ fontFamily: "var(--font-merriweather), serif", fontVariationSettings: '"wght" 350, "opsz" 144' }}>
					Glyphs.app &amp; RoboFont
				</h1>
				<p className="text-base text-muted leading-relaxed max-w-2xl">
					Native plugins for both type editors. Same UI, same shared NSView modules — pick the
					one that matches your tool. Both plugins read the open font (or a TTF/OTF on disk),
					preview the licensed design space in a live chart with an animated specimen, and
					export restricted variable fonts.
				</p>
			</section>

			{/* Screenshot — large, dominant */}
			<section className="w-full max-w-2xl lg:max-w-5xl">
				<div className="rounded-2xl border border-white/10 overflow-hidden bg-black/30">
					<img
						src="/screenshots/glyphs-robofont.png"
						alt="vf-clamp dialog inside Glyphs.app — RoboFont uses the same UI"
						className="w-full h-auto"
					/>
				</div>
				<p className="text-xs text-muted mt-3 text-center">
					vf-clamp inside Glyphs.app on a real source font (Daith Adv) — RoboFont renders the same UI from the same shared source.
				</p>
			</section>

			{/* Features */}
			<section className="w-full max-w-2xl lg:max-w-5xl flex flex-col gap-6">
				<h2 className="text-xs uppercase tracking-[0.18em] font-medium text-muted">What you get</h2>
				<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
					{FEATURES.map((f) => (
						<div key={f.title} className="flex flex-col gap-2 rounded-xl p-6" style={{ background: "rgba(0,0,0,0.2)" }}>
							<h3 className="text-sm font-semibold">{f.title}</h3>
							<p className="text-xs text-muted leading-relaxed">{f.body}</p>
						</div>
					))}
				</div>
			</section>

			{/* Install per plugin */}
			<section className="w-full max-w-2xl lg:max-w-5xl flex flex-col gap-6">
				<h2 className="text-xs uppercase tracking-[0.18em] font-medium text-muted">Install</h2>
				<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
					{PLUGINS.map((p) => (
						<div key={p.name} className="flex flex-col gap-3 rounded-xl p-6" style={{ background: "rgba(0,0,0,0.2)" }}>
							<h3 className="text-sm font-semibold">{p.name}</h3>
							<p className="text-xs text-muted leading-relaxed">{p.requirement}</p>
							<p className="text-xs text-muted leading-relaxed">{p.install}</p>
							<code className="text-xs font-mono text-subtle">{p.bundleName}</code>
							<div className="flex items-center gap-2 mt-auto pt-3">
								<a href={p.downloadUrl} target="_blank" rel="noopener noreferrer" className="flex-1 text-center text-xs font-medium py-2 px-3 rounded-lg bg-white/10 hover:bg-white/15 transition-colors">Download ↗</a>
								<a href={p.repoUrl} target="_blank" rel="noopener noreferrer" className="flex-1 text-center text-xs py-2 px-3 rounded-lg border border-white/15 hover:border-white/30 hover:bg-white/5 transition-colors text-muted hover:text-foreground">GitHub ↗</a>
							</div>
						</div>
					))}
				</div>
			</section>

			{/* Why two plugins, one UI */}
			<section className="w-full max-w-2xl lg:max-w-5xl flex flex-col gap-4">
				<h2 className="text-xs uppercase tracking-[0.18em] font-medium text-muted">Why both look the same</h2>
				<p className="text-base text-muted leading-relaxed max-w-2xl">
					The chart and the animated specimen are framework-agnostic <code className="font-mono text-sm">NSView</code> subclasses
					with zero Glyphs.app or RoboFont dependencies. The canonical source lives in
					{" "}<code className="font-mono text-sm">vfClamp/shared/plugin-views/</code>; both plugin bundles
					receive byte-identical copies via <code className="font-mono text-sm">npm run sync-plugin-views</code>,
					and CI refuses any PR that introduces drift.
				</p>
				<p className="text-base text-muted leading-relaxed max-w-2xl">
					What differs between the two plugins is the host integration — how each one reads the
					open font, where saved files land, how exports flow through each app's own export API.
					Everything visual stays in sync by construction.
				</p>
			</section>

			<SiteFooter current="vfClamp" npmVersion={version} siteVersion={siteVersion} />
		</main>
	)
}
