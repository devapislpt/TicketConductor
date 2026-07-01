import type { Metadata, Viewport } from 'next'
import './globals.css'
import { ThemeProvider } from '@/components/layout/ThemeProvider'
import { LuxuryToaster } from '@/components/ui/toast'

export const metadata: Metadata = {
  title: {
    default: 'FallCon — Ticket Conductor',
    template: '%s | FallCon',
  },
  description: 'Manage your FallCon event tickets with elegance.',
  manifest: '/manifest.json',
}

export const viewport: Viewport = {
  themeColor: '#0A0A0A',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head />
      <body className="antialiased">
        <ThemeProvider>
          {children}
          <LuxuryToaster />
        </ThemeProvider>
      </body>
    </html>
  )
}
