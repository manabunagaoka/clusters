import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Clusters JTBD Student Edition (MVP) by Manaboodle',
  description: 'Move from Problem Statement to Archetypes, Metrics & Insights',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="app-body">{children}</body>
    </html>
  )
}
