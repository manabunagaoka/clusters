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
    <StepGuard allow={canRunAnalysis()} redirectTo="/profiles">
      <div>
        <h2 className="page-title">Quality Metrics & Clusters</h2>
        <div className="card" style={{ marginTop:12 }}>
          <button onClick={onRun} disabled={loading} className="btn">
            {loading ? <LoaderDots /> : 'Run Analysis'}
          </button>
        </div>

        {result && (
          <div className="card" style={{ marginTop: 12 }}>
            <div className="card-title">Readiness</div>
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
              <div className="green-box" style={{ marginTop: 8 }}>
                Opportunity: tighten evidence before scaling decisions.
              </div>
            )}

            <div style={{ marginTop: 12 }}>
              <div className="card-title" style={{ marginBottom: 8 }}>Clusters</div>
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
