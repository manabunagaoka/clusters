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
        <h1 style={{ fontSize: 20, fontWeight: 600, marginBottom: 12 }}>Archetypes</h1>
        <label style={{ display: 'block', fontWeight: 500, marginBottom: 8 }}>Interview notes (one idea per line)</label>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={8} style={{ width: '100%', padding: 12, border: '1px solid #e5e7eb', borderRadius: 6 }} placeholder="Paste notes..." />
        <div style={{ marginTop: 12 }}>
          <button onClick={onGen} disabled={loading} style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid #e5e7eb' }}>
            {loading ? <LoaderDots /> : 'Generate Archetypes'}
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))', gap: 16, marginTop: 16 }}>
          {archetypes.map((a) => (
            <div key={a.id} style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 12 }}>
              <div style={{ fontWeight: 600, marginBottom: 6 }}>{a.name}</div>
              <div style={{ color: '#374151', marginBottom: 8 }}>{a.narrative}</div>
              <div style={{ marginBottom: 8 }}>{a.tags.map((t) => <Chip key={t}>{t}</Chip>)}</div>
              <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 4 }}>Aligned evidence</div>
              {a.quotes.length ? (
                <ul style={{ paddingLeft: 16 }}>
                  {a.quotes.map((q, i) => (<li key={i} style={{ marginBottom: 6 }}>&quot;{q}&quot;</li>))}
                </ul>
              ) : (
                <div style={{ color: '#9CA3AF' }}>No aligned quotes</div>
              )}
              {a.quotes.length < 4 && (
                <div style={{ marginTop: 8, color: '#92400E', background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 6, padding: 8 }}>Hint: collect more notes to strengthen this archetype.</div>
              )}
            </div>
          ))}
        </div>
      </div>
    </StepGuard>
  )
}
