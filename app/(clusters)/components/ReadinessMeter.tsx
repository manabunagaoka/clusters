export function ReadinessMeter({ value }: { value: number }) {
  const clamped = Math.max(0, Math.min(1, value || 0))
  return (
    <div style={{ position: 'relative', height: 10, borderRadius: 999, background: 'linear-gradient(90deg,#fee2e2,#fef3c7,#dcfce7)', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', left: `${clamped * 100}%`, top: -3, transform: 'translateX(-50%)', width: 4, height: 16, background: '#111827', borderRadius: 2 }} />
    </div>
  )
}
