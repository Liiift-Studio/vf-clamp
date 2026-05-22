import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"

const inter = Inter({
	subsets: ["latin"],
	weight: ["300", "900"],
	variable: "--font-inter",
	display: "swap",
})

export const metadata: Metadata = {
	title: "vf-clamp — Restrict variable font axis ranges",
	icons: { icon: "/icon.svg", shortcut: "/icon.svg", apple: "/icon.svg" },
	description: "Clamp a variable font's design space to specific axis ranges per subfamily. Like CSS clamp() for type design.",
	keywords: ["variable font", "vf-clamp", "font instancer", "axis range", "typography", "npm", "fonttools", "woff2"],
	openGraph: {
		title: "vf-clamp — Restrict variable font axis ranges",
		description: "Clamp a variable font's design space to specific axis ranges per subfamily. Like CSS clamp() for type design.",
		url: "https://vfclamp.com",
		siteName: "vf-clamp",
		type: "website",
	},
	twitter: {
		card: "summary_large_image",
		title: "vf-clamp — Restrict variable font axis ranges",
		description: "Clamp a variable font's design space to specific axis ranges. Like CSS clamp() for type.",
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
