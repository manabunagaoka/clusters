import Link from 'next/link'

export default function Page() {
  return (
    <div className="card">
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 12 }}>Clusters JTBD Student Edition</h1>
      <p style={{ color: 'var(--muted)', marginBottom: 24, fontSize: 16, lineHeight: 1.6 }}>
        Move from a clear Problem Statement to Archetypes, Quality Metrics & Clusters, and actionable Insights—without drowning in AI jargon.
      </p>
      
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16 }}>How it works:</h2>
        <ol style={{ lineHeight: 1.8, paddingLeft: 24 }}>
          <li style={{ marginBottom: 8 }}>
            <strong>Problem Statement</strong> → Refine your problem description, then extract pain anchors
          </li>
          <li style={{ marginBottom: 8 }}>
            <strong>Archetypes</strong> → Paste interview notes (one idea per line), generate aligned archetypes
          </li>
          <li style={{ marginBottom: 8 }}>
            <strong>Quality Metrics & Clusters</strong> → Run analysis to see readiness scores and clusters
          </li>
          <li style={{ marginBottom: 8 }}>
            <strong>Insights</strong> → Generate actionable guidance and next experiments
          </li>
        </ol>
      </div>

      <div className="green-box">
        <strong>Tip:</strong> Set <code>NEXT_PUBLIC_API_BASE</code> to call an existing server. Otherwise, the UI will use helpful placeholders for learning.
      </div>

      <div style={{ marginTop: 32, textAlign: 'center' }}>
        <Link href="/problem" className="btn btn-primary" style={{ fontSize: 16, padding: '12px 24px' }}>
          Get Started →
        </Link>
      </div>
    </div>
  )
}
