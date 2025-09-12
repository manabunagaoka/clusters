import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Clusters JTBD Student Edition',
  description: 'Move from Problem Statement to Archetypes, Metrics & Insights',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: 'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, Noto Sans, "Apple Color Emoji", "Segoe UI Emoji"' }}>
        {children}
      </body>
    </html>
  )
}
