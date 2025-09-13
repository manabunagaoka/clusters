'use client'
import { useState } from 'react'
import { useAppStore } from '../store/useAppStore'
import { LoaderDots } from '../components/LoaderDots'
import { ReadinessMeter } from '../components/ReadinessMeter'
import { StepGuard } from '../components/StepGuard'
import { StepNav } from '../components/StepNav'

export default function Page() {
  const { result, runAnalysis, canRunAnalysis, canSeeInsights } = useAppStore()
  const [loading, setLoading] = useState(false)

  async function onRun() {
    setLoading(true)
    try { await runAnalysis() } finally { setLoading(false) }
  }

  const r = result?.readiness

  return (
    <StepGuard allow={canRunAnalysis()} redirectTo="/archetypes">
      <div className="card">
        <h1 style={{ fontSize: 24, fontWeight: 600, marginBottom: 16 }}>Quality Metrics & Clusters</h1>
        
        <div style={{ marginBottom: 24 }}>
          <button 
            className={`btn btn-primary ${loading ? 'disabled' : ''}`}
            onClick={onRun} 
            disabled={loading}
          >
            {loading ? <LoaderDots /> : 'Run Analysis'}
          </button>
        </div>

        {result && (
          <div style={{ marginTop: 24 }}>
            <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16 }}>Readiness</h2>
            
            <div style={{ marginBottom: 16 }}>
              <ReadinessMeter value={r?.overall || 0} />
            </div>
            
            <div className="grid-2" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
              <Tile label="Overall" value={r?.overall || 0} />
              <Tile label="Focus" value={r?.focus || 0} />
              <Tile label="Clear" value={r?.clear || 0} />
              <Tile label="Action" value={r?.action || 0} />
            </div>
            
            {(r?.overall || 0) < 0.5 && (
              <div style={{ 
                marginTop: 16, 
                padding: '12px 16px',
                backgroundColor: 'var(--warn-bg)',
                border: '1px solid var(--warn-border)',
                color: 'var(--warn-ink)',
                borderRadius: '8px'
              }}>
                <strong>Opportunity:</strong> Tighten evidence before scaling decisions.
              </div>
            )}

            <div style={{ marginTop: 24 }}>
              <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>Clusters</h3>
              <div style={{ display: 'grid', gap: 8 }}>
                {result.clusters.map((c) => (
                  <div key={c.id} className="card" style={{ margin: 0, padding: 12 }}>
                    <div style={{ fontWeight: 600, marginBottom: 4 }}>{c.label}</div>
                    <div className="hint">
                      {c.tags.join(', ')}{typeof c.size === 'number' ? ` • ${c.size} evidence` : ''}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        <StepNav 
          back="/archetypes" 
          next={canSeeInsights() ? "/insights" : undefined} 
        />
      </div>
    </StepGuard>
  )
}

function Tile({ label, value }: { label: string; value: number }) {
  const pct = Math.round((value || 0) * 100)
  return (
    <div className="card" style={{ margin: 0, textAlign: 'center' }}>
      <div className="hint" style={{ marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--primary)' }}>{pct}%</div>
    </div>
  )
}
