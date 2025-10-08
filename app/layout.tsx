
import type { Metadata } from 'next'
import './globals.css'
import GoogleAnalytics from './(clusters)/components/GoogleAnalytics'

export const metadata: Metadata = {
  title: 'Clusters JTBD Student Edition (MVP) by Manaboodle',
  description: 'Move from Problem Statement to Archetypes, Metrics & Insights',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="app-body">
        <GoogleAnalytics GA_MEASUREMENT_ID="G-014RS0SVMJ" />
        {children}
      </body>
    </html>
  )
}
