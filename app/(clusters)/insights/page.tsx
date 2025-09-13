'use client'
import { useState } from 'react'
import { useAppStore } from '../store/useAppStore'
import { LoaderDots } from '../components/LoaderDots'
import { StepGuard } from '../components/StepGuard'
import { StepNav } from '../components/StepNav'

export default function Page() {
  const { insights, getInsights, canSeeInsights } = useAppStore()
  const [loading, setLoading] = useState(false)

  async function onGen() {
    setLoading(true)
    try { await getInsights() } finally { setLoading(false) }
  }

  return (
    <StepGuard allow={canSeeInsights()} redirectTo="/metrics">
      <div className="card">
        <h1 style={{ fontSize: 24, fontWeight: 600, marginBottom: 16 }}>Insights</h1>
        
        <div style={{ marginBottom: 24 }}>
          <button 
            className={`btn btn-primary ${loading ? 'disabled' : ''}`}
            onClick={onGen} 
            disabled={loading}
          >
            {loading ? <LoaderDots /> : 'Generate Insights'}
          </button>
        </div>

        {insights && (
          <div style={{ marginTop: 24 }}>
            <div style={{ display: 'grid', gap: 20 }}>
              <Field label="Summary" value={insights.summary} />
              <Field label="Focus Now" value={Array.isArray(insights.focusNow) ? insights.focusNow : [insights.focusNow]} />
              <Field label="Two Experiments" value={insights.twoExperiments} />
              <Field label="Tighten Data" value={insights.tightenData} />
              <Field label="Why This Makes Sense" value={insights.whyThisMakesSense} />
            </div>
          </div>
        )}

        <StepNav back="/metrics" />
      </div>
    </StepGuard>
  )
}

function Field({ label, value }: { label: string; value: string | string[] }) {
  const isArray = Array.isArray(value)
  const text = isArray ? value.join(' • ') : value || ''
  // Convert any decimals in the text to percents
  const formattedText = text.replace(/(?<!\d)(0?\.[0-9]{1,2})(?!\d)/g, (m) => `${Math.round(parseFloat(m) * 100)}%`)
  
  return (
    <div className="card" style={{ margin: 0 }}>
      <div style={{ fontWeight: 600, marginBottom: 8, color: 'var(--primary)' }}>{label}</div>
      <div style={{ lineHeight: 1.5 }}>{formattedText}</div>
    </div>
  )
}
