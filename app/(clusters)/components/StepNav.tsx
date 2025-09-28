import Link from 'next/link'

export function StepNav({ back, next, onNext, loading }: { back?: string; next?: string; onNext?: () => void; loading?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 24 }}>
      <div>{back ? <Link href={back}>← Back</Link> : <span />}</div>
      <div>
        {next && !onNext && <Link href={next}>NEXT →</Link>}
        {onNext && (
          <button onClick={onNext} disabled={!!loading} style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid #e5e7eb' }}>
            {loading ? 'Working…' : 'NEXT →'}
          </button>
        )}
      </div>
    </div>
  )
}
