'use client'
import { useState } from 'react'
import { useAppStore } from '../store/useAppStore'
import { Chip } from '../components/Chip'
import { LoaderDots } from '../components/LoaderDots'
import { StepGuard } from '../components/StepGuard'

export default function Page() {
  const { notes, setNotes, archetypes, generateArchetypes, canGoArchetypes } = useAppStore()
  const [loading, setLoading] = useState(false)

  async function onGen() {
    setLoading(true)
    try { await generateArchetypes() } finally { setLoading(false) }
  }

  return (
    <StepGuard allow={canGoArchetypes()} redirectTo="/problem">
      <div>
        <h2 className="page-title">Archetypes</h2>
        <div className="card" style={{ marginTop:12 }}>
          <label className="label">Interview notes (one idea per line)</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={8} className="input textarea" placeholder="Paste notes..." />
          <div style={{ marginTop: 8 }}>
            <button onClick={onGen} disabled={loading} className="btn">
              {loading ? <LoaderDots /> : 'Generate Archetypes'}
            </button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))', gap: 12, marginTop: 12 }}>
          {archetypes.map((a) => (
            <div key={a.id} className="card">
              <div className="card-title">{a.name}</div>
              <div className="card-body" style={{ marginBottom:8 }}>{a.narrative}</div>
              <div style={{ marginBottom: 8 }}>{a.tags.map((t) => <Chip key={t}>{t}</Chip>)}</div>
              <div className="hint" style={{ marginBottom:4 }}>Aligned evidence</div>
              {a.quotes.length ? (
                <ul style={{ paddingLeft: 16 }}>
                  {a.quotes.map((q, i) => (<li key={i} style={{ marginBottom: 6 }}>&quot;{q}&quot;</li>))}
                </ul>
              ) : (
                <div className="hint">No aligned quotes</div>
              )}
              {a.quotes.length < 4 && (
                <div className="green-box" style={{ marginTop: 8 }}>Hint: collect more notes to strengthen this archetype.</div>
              )}
            </div>
          ))}
        </div>
      </div>
    </StepGuard>
  )
}
