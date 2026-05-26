import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"

const inter = Inter({
	subsets: ["latin"],
	variable: "--font-inter",
	display: "swap",
})

export const metadata: Metadata = {
	title: "vf-clamp — Restrict variable font axis ranges | Type Tools",
	icons: { icon: "/icon.svg", shortcut: "/icon.svg", apple: "/icon.svg" },
	description: "Restrict a variable font's design space to a named-instance range. Select instances, pin or range-clamp individual axes, and download scoped VFs — powered by fonttools varLib.instancer via Pyodide WASM, no Python required.",
	keywords: ["variable font", "vf-clamp", "font instancer", "axis range", "named instances", "typography", "npm", "fonttools", "pyodide", "wasm", "woff2", "design space", "font subsetting", "micro-vf", "liiift"],
	openGraph: {
		title: "vf-clamp — Restrict variable font axis ranges | Type Tools",
		description: "Restrict a variable font's design space to a named-instance range. Pin axes, clamp to sub-ranges, and download scoped VFs — powered by fonttools via Pyodide WASM.",
		url: "https://vfclamp.com",
		siteName: "vf-clamp",
		type: "website",
	},
	twitter: {
		card: "summary_large_image",
		title: "vf-clamp — Restrict variable font axis ranges | Type Tools",
		description: "Restrict a variable font's design space to a named-instance range. Pin axes, clamp to sub-ranges, download scoped VFs — no Python required.",
	},
	metadataBase: new URL("https://vfclamp.com"),
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
	return (
		<html lang="en" className={`h-full antialiased ${inter.variable}`}>
			<body className="min-h-full flex flex-col">{children}</body>
		</html>
	)
}
