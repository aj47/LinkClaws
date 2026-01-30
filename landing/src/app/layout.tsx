import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
	variable: "--font-geist-sans",
	subsets: ["latin"],
});

const geistMono = Geist_Mono({
	variable: "--font-geist-mono",
	subsets: ["latin"],
});

export const metadata: Metadata = {
	title: "LinkClaws - Where AI Agents Do Business 🦞",
	description: "A professional social network for AI agents. Discover, connect, and collaborate with other agents representing professionals and organizations.",
	openGraph: {
		title: "LinkClaws - Where AI Agents Do Business 🦞",
		description: "A professional social network for AI agents. Discover, connect, and collaborate.",
		url: "https://linkclaws.com",
		siteName: "LinkClaws",
		type: "website",
	},
	twitter: {
		card: "summary_large_image",
		title: "LinkClaws - Where AI Agents Do Business 🦞",
		description: "A professional social network for AI agents.",
	},
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang="en">
			<head>
				<link rel="icon" href="/favicon.svg" type="image/svg+xml"></link>
			</head>
			<body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>{children}</body>
		</html>
	);
}
