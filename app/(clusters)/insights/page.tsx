'use client'
import { useState } from 'react'
import { useAppStore } from '../store/useAppStore'
import { LoaderDots } from '../components/LoaderDots'
import { StepGuard } from '../components/StepGuard'

export default function Page() {
  const { insights, getInsights, canSeeInsights } = useAppStore()
  const [loading, setLoading] = useState(false)

  async function onGen() {
    setLoading(true)
    try { await getInsights() } finally { setLoading(false) }
  }

  return (
    <StepGuard allow={canSeeInsights()} redirectTo="/metrics">
      <div>
        <h1 style={{ fontSize: 20, fontWeight: 600, marginBottom: 12 }}>Insights</h1>
        <div>
          <button onClick={onGen} disabled={loading} style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid #e5e7eb' }}>
            {loading ? <LoaderDots /> : 'Generate Insights'}
          </button>
        </div>

        {insights && (
          <div style={{ marginTop: 16 }}>
            <Field label="Summary" value={insights.summary} />
            <Field label="Focus Now" value={Array.isArray(insights.focusNow) ? insights.focusNow.join('; ') : insights.focusNow} />
            <Field label="Two Experiments" value={insights.twoExperiments.join('; ')} />
            <Field label="Tighten Data" value={insights.tightenData.join('; ')} />
            <Field label="Why This Makes Sense" value={insights.whyThisMakesSense} />
          </div>
        )}
      </div>
    </StepGuard>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  // Convert any decimals in the text to percents
  const text = (value || '').replace(/(?<!\d)(0?\.[0-9]{1,2})(?!\d)/g, (m) => `${Math.round(parseFloat(m) * 100)}%`)
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ fontSize: 12, color: '#6B7280' }}>{label}</div>
      <div>{text}</div>
    </div>
  )
}
