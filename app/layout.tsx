import type React from "react"
import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import { AppShell } from "@/components/app-shell"
import { RuntimeThemeSync } from "@/components/runtime-theme-sync"
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "@/components/ui/toaster"
import "./globals.css"

const geistSans = Geist({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-geist-sans",
})

const geistMono = Geist_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-geist-mono",
})

export const metadata: Metadata = {
  title: "项目管理看板",
  description: "现代化的项目管理和看板系统",
  generator: "v0.app",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
      <body className="font-sans bg-background">
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
          <RuntimeThemeSync />
          <AppShell>{children}</AppShell>
          <Toaster />
          <Analytics />
        </ThemeProvider>
      </body>
    </html>
  )
}
