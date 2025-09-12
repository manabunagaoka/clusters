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
      <textarea value={psText} onChange={(e) => setPSText(e.target.value)} rows={6} style={{ width: '100%', padding: 12, border: '1px solid #e5e7eb', borderRadius: 6 }} placeholder="Describe the problem..." />

      <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
        <button onClick={onGenPS} disabled={loadingPS} style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid #e5e7eb' }}>
          {loadingPS ? <LoaderDots /> : 'Generate PS'}
        </button>
        <button onClick={onExtract} disabled={loadingPains} style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid #e5e7eb' }}>
          {loadingPains ? <LoaderDots /> : 'Extract Pains'}
        </button>
      </div>

      {psTags?.length ? (
        <div style={{ marginTop: 16 }}>
          <div style={{ marginBottom: 8, fontWeight: 500 }}>Anchors</div>
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
