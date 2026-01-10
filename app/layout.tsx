import type React from "react"
import type { Metadata } from "next"
import { Inter, Space_Mono } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import "./globals.css"

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" })
const spaceMono = Space_Mono({ subsets: ["latin"], weight: "400", variable: "--font-space-mono" })

export const metadata: Metadata = {
  title: "AI Products with Tehan",
  description: "Discover innovative AI solutions crafted by Tehan to transform your business",
  icons: {
    icon: "/technology.png",
    apple: "/technology.png",
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${spaceMono.variable}`}>
      <body className="font-sans antialiased">
        {children}
        <Analytics />
      </body>
    </html>
  )
}
