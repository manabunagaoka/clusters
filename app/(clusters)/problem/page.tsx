'use client'
import { useState } from 'react'
import { useAppStore } from '../store/useAppStore'
import { Chip } from '../components/Chip'
import { LoaderDots } from '../components/LoaderDots'
import { StepNav } from '../components/StepNav'

export default function Page() {
  const { psText, psTags, setPSText, generatePS, extractPains, canGoArchetypes } = useAppStore()
  const [loadingPS, setLoadingPS] = useState(false)
  const [loadingPains, setLoadingPains] = useState(false)

  async function onGenPS() {
    setLoadingPS(true)
    try { await generatePS() } finally { setLoadingPS(false) }
  }
  async function onExtract() {
    setLoadingPains(true)
    try { await extractPains() } finally { setLoadingPains(false) }
  }

  return (
    <div className="card">
      <h1 style={{ fontSize: 24, fontWeight: 600, marginBottom: 16 }}>Problem Statement</h1>
      
      <label style={{ display: 'block', fontWeight: 500, marginBottom: 8 }}>Describe the problem you want to solve</label>
      <textarea 
        className="input textarea"
        value={psText} 
        onChange={(e) => setPSText(e.target.value)} 
        rows={6} 
        placeholder="e.g., Students struggle to get started with research interviews because..."
      />

      <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
        <button 
          className={`btn ${loadingPS ? 'disabled' : ''}`}
          onClick={onGenPS} 
          disabled={loadingPS}
        >
          {loadingPS ? <LoaderDots /> : 'Generate PS'}
        </button>
        <button 
          className={`btn btn-primary ${loadingPains ? 'disabled' : ''}`}
          onClick={onExtract} 
          disabled={loadingPains || !psText.trim()}
        >
          {loadingPains ? <LoaderDots /> : 'Extract Pains'}
        </button>
      </div>

      {psTags?.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <div style={{ marginBottom: 12, fontWeight: 500 }}>Pain Anchors</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {psTags.map((t) => (
              <Chip key={t}>{t}</Chip>
            ))}
          </div>
          {psTags.length > 0 && (
            <div className="green-box" style={{ marginTop: 16 }}>
              <strong>Good!</strong> We found {psTags.length} pain anchor{psTags.length !== 1 ? 's' : ''}. These will help align your interview notes in the next step.
            </div>
          )}
        </div>
      )}

      <StepNav next={canGoArchetypes() ? "/archetypes" : undefined} />
    </div>
  )
}
