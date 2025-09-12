import Link from 'next/link'

export default function ClustersLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', minHeight: '100vh' }}>
      <aside style={{ borderRight: '1px solid #e5e7eb', padding: '16px' }}>
        <nav style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Link href="/instructions">Instructions</Link>
          <Link href="/problem">Problem</Link>
          <Link href="/archetypes">Archetypes</Link>
          <Link href="/metrics">Metrics</Link>
          <Link href="/insights">Insights</Link>
        </nav>
      </aside>
      <main style={{ padding: '24px' }}>{children}</main>
    </div>
  )
}
