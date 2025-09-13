'use client'
import { useState } from 'react'
import { useAppStore } from '../store/useAppStore'
import { Chip } from '../components/Chip'
import { LoaderDots } from '../components/LoaderDots'
import { StepGuard } from '../components/StepGuard'
import { StepNav } from '../components/StepNav'

export default function Page() {
  const { notes, setNotes, archetypes, generateArchetypes, canGoArchetypes, canRunAnalysis } = useAppStore()
  const [loading, setLoading] = useState(false)

  async function onGen() {
    setLoading(true)
    try { await generateArchetypes() } finally { setLoading(false) }
  }

  return (
    <StepGuard allow={canGoArchetypes()} redirectTo="/problem">
      <div className="card">
        <h1 style={{ fontSize: 24, fontWeight: 600, marginBottom: 16 }}>Archetypes</h1>
        
        <label style={{ display: 'block', fontWeight: 500, marginBottom: 8 }}>
          Interview notes (one idea per line)
        </label>
        <textarea 
          className="input textarea" 
          value={notes} 
          onChange={(e) => setNotes(e.target.value)} 
          rows={8} 
          placeholder="e.g.,&#10;I get frustrated when I can't find what I'm looking for quickly&#10;The interface feels cluttered and confusing&#10;I want clearer guidance on next steps..."
        />
        
        <div style={{ marginTop: 16 }}>
          <button 
            className={`btn btn-primary ${loading ? 'disabled' : ''}`}
            onClick={onGen} 
            disabled={loading || !notes.trim()}
          >
            {loading ? <LoaderDots /> : 'Generate Archetypes'}
          </button>
        </div>

        {archetypes.length > 0 && (
          <div style={{ marginTop: 24 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: 16 }}>
              {archetypes.map((a) => (
                <div key={a.id} className="card" style={{ margin: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 8 }}>{a.name}</div>
                  <div style={{ color: 'var(--muted)', marginBottom: 12, lineHeight: 1.5 }}>{a.narrative}</div>
                  
                  <div style={{ marginBottom: 12, display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {a.tags.map((t) => <Chip key={t}>{t}</Chip>)}
                  </div>
                  
                  <div className="hint" style={{ marginBottom: 8 }}>Aligned evidence:</div>
                  {a.quotes.length > 0 ? (
                    <ul style={{ paddingLeft: 16, margin: 0 }}>
                      {a.quotes.map((q, i) => (
                        <li key={i} style={{ marginBottom: 6, fontSize: 13, lineHeight: 1.4 }}>
                          "{q}"
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="hint">No aligned quotes found</div>
                  )}
                  
                  {a.quotes.length < 4 && (
                    <div style={{ 
                      marginTop: 12, 
                      padding: '8px 12px',
                      backgroundColor: 'var(--warn-bg)',
                      border: '1px solid var(--warn-border)',
                      color: 'var(--warn-ink)',
                      borderRadius: '8px',
                      fontSize: 13
                    }}>
                      <strong>Hint:</strong> Collect more notes to strengthen this archetype.
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <StepNav 
          back="/problem" 
          next={canRunAnalysis() ? "/metrics" : undefined} 
        />
      </div>
    </StepGuard>
  )
}
