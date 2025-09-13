'use client'
import { useState } from 'react'
import { useAppStore } from '../store/useAppStore'
import { Chip } from '../components/Chip'
import { LoaderDots } from '../components/LoaderDots'
import { StepNav } from '../components/StepNav'

export default function Page() {
  const { psText, psTags, setPSText, generatePS, extractPains } = useAppStore()
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
    <div>
      <h1 style={{ fontSize: 20, fontWeight: 600, marginBottom: 12 }}>Problem</h1>
      <label style={{ display: 'block', fontWeight: 500, marginBottom: 8 }}>Problem Statement</label>
      <textarea className="input textarea" value={psText} onChange={(e) => setPSText(e.target.value)} rows={6} placeholder="Describe the problem..." />

      <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
        <button className="btn btn-primary" onClick={onGenPS} disabled={loadingPS}>
          {loadingPS ? <LoaderDots /> : 'Generate PS'}
        </button>
        <button className="btn" onClick={onExtract} disabled={loadingPains}>
          {loadingPains ? <LoaderDots /> : 'Extract Pains'}
        </button>
      </div>

      {psTags?.length ? (
        <div className="card" style={{ marginTop: 16 }}>
          <div style={{ marginBottom: 8, fontWeight: 600 }}>Anchors</div>
          <div>
            {psTags.map((t) => (
              <Chip key={t}>{t}</Chip>
            ))}
          </div>
        </div>
      ) : null}

      <StepNav next="/archetypes" />
    </div>
  )
}
