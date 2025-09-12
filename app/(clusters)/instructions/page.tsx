export default function Page() {
  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 600, marginBottom: 8 }}>Clusters JTBD Student Edition</h1>
      <p style={{ color: '#374151', marginBottom: 16 }}>Move from a clear Problem Statement to Archetypes, Quality Metrics & Clusters, and actionable Insights—without drowning in AI jargon.</p>
      <ol style={{ lineHeight: 1.8 }}>
        <li>1. Problem → refine your Problem Statement, then Extract Pains (anchors)</li>
        <li>2. Archetypes → paste interview notes (one idea per line), Generate Archetypes</li>
        <li>3. Quality Metrics & Clusters → Run Analysis to see readiness and clusters</li>
        <li>4. Insights → Generate Insights for short guidance and next experiments</li>
      </ol>
      <p style={{ marginTop: 16, color: '#6B7280' }}>Tip: Set NEXT_PUBLIC_API_BASE to call an existing server. Otherwise, the UI will use simple placeholders.</p>
    </div>
  )
}
