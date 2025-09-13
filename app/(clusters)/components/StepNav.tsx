import Link from 'next/link'

export function StepNav({ back, next, onNext, loading }: { back?: string; next?: string; onNext?: () => void; loading?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 32, paddingTop: 20, borderTop: '1px solid var(--border)' }}>
      <div>{back ? <Link href={back} className="btn">← Back</Link> : <span />}</div>
      <div>
        {next && !onNext && <Link href={next} className="btn btn-primary">NEXT →</Link>}
        {onNext && (
          <button onClick={onNext} disabled={!!loading} className={`btn btn-primary ${loading ? 'disabled' : ''}`}>
            {loading ? 'Working…' : 'NEXT →'}
          </button>
        )}
      </div>
    </div>
  )
}
