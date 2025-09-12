'use client'
import { useState } from 'react'
import { useAppStore } from '../store/useAppStore'
import { LoaderDots } from '../components/LoaderDots'
import { ReadinessMeter } from '../components/ReadinessMeter'
import { StepGuard } from '../components/StepGuard'

export default function Page() {
  const { result, runAnalysis, canRunAnalysis } = useAppStore()
  const [loading, setLoading] = useState(false)

  async function onRun() {
    setLoading(true)
    try { await runAnalysis() } finally { setLoading(false) }
  }

  const r = result?.readiness

  return (
    <StepGuard allow={canRunAnalysis()} redirectTo="/archetypes">
      <div>
        <h1 style={{ fontSize: 20, fontWeight: 600, marginBottom: 12 }}>Quality Metrics & Clusters</h1>
        <div>
          <button onClick={onRun} disabled={loading} style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid #e5e7eb' }}>
            {loading ? <LoaderDots /> : 'Run Analysis'}
          </button>
        </div>

        {result && (
          <div style={{ marginTop: 16 }}>
            <h2 style={{ fontWeight: 600, marginBottom: 8 }}>Readiness</h2>
            <div style={{ marginBottom: 8 }}>
              <ReadinessMeter value={r?.overall || 0} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,minmax(140px,1fr))', gap: 12 }}>
              <Tile label="Overall" value={r?.overall || 0} />
              <Tile label="Focus" value={r?.focus || 0} />
              <Tile label="Clear" value={r?.clear || 0} />
              <Tile label="Action" value={r?.action || 0} />
            </div>
            {(r?.overall || 0) < 0.5 && (
              <div style={{ marginTop: 12, color: '#7C2D12', background: '#FEF3C7', border: '1px solid #FCD34D', borderRadius: 6, padding: 8 }}>
                Opportunity: tighten evidence before scaling decisions.
              </div>
            )}

            <div style={{ marginTop: 16 }}>
              <h3 style={{ fontWeight: 600, marginBottom: 8 }}>Clusters</h3>
              <ul style={{ paddingLeft: 16 }}>
                {result.clusters.map((c) => (
                  <li key={c.id} style={{ marginBottom: 6 }}>
                    <strong>{c.label}</strong> — {c.tags.join(', ')}{typeof c.size === 'number' ? ` (${c.size})` : ''}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>
    </StepGuard>
  )
}

function Tile({ label, value }: { label: string; value: number }) {
  const pct = Math.round((value || 0) * 100)
  return (
    <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 12 }}>
      <div style={{ fontSize: 12, color: '#6B7280' }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700 }}>{pct}%</div>
    </div>
  )
}
