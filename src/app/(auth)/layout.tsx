import type { Metadata } from 'next'
import { Cormorant_Garamond } from 'next/font/google'
import AuthLayoutClient from './AuthLayoutClient'

const cormorant = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  style: ['normal', 'italic'],
  variable: '--font-cormorant',
  display: 'swap',
})

export const metadata: Metadata = {
  title: {
    template: '%s | FallCon',
    default: 'FallCon — Ticket Conductor',
  },
  description: 'Luxury ticket management for exclusive events.',
}

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className={cormorant.variable}>
      <AuthLayoutClient>{children}</AuthLayoutClient>
    </div>
  )
}
