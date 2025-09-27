'use client'
import { useState } from 'react'
import { useAppStore } from '../store/useAppStore'
import LoaderDots from '../components/LoaderDots'
// StepGuard removed; inline gating now handled here.

export default function Page() {
  const { insights, getInsights, canSeeInsights } = useAppStore()
  const [loading, setLoading] = useState(false)

  async function onGen() {
    setLoading(true)
    try { await getInsights() } finally { setLoading(false) }
  }

  const allowed = canSeeInsights();
  return (
    <div>
      <h2 className="page-title">Insights</h2>
      {!allowed && (
        <div className="card" style={{ marginTop:12, background:'#fff7ed', borderColor:'#fed7aa' }}>
          <div style={{ fontSize:13, fontWeight:600, marginBottom:4 }}>Clusters not ready</div>
          <div style={{ fontSize:12, lineHeight:1.45 }}>Form clusters first. Go to Clusters, run Form Clusters, then return here.</div>
        </div>
      )}
      {allowed && (
        <>
          <div className="card" style={{ marginTop:12 }}>
            <button onClick={onGen} disabled={loading} className="btn">
              {loading ? <LoaderDots /> : 'Generate Insights'}
            </button>
          </div>
          {insights && (
            <div className="card" style={{ marginTop: 12 }}>
              <div className="card-body">
                <Field label="Summary" value={insights.summary} />
                <Field label="Focus Now" value={Array.isArray(insights.focusNow) ? insights.focusNow.join('; ') : (insights.focusNow as any)} />
                <Field label="Two Experiments" value={insights.twoExperiments.join('; ')} />
                <Field label="Tighten Data" value={insights.tightenData.join('; ')} />
                <Field label="Why This Makes Sense" value={insights.whyThisMakesSense} />
              </div>
            </div>
          )}
        </>
      )}
    </div>
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
