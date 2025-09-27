// ReadinessMeter (default export) shows a horizontal gradient with a movable knob
export default function ReadinessMeter({ value }: { value: number }) {
  const clamped = Math.max(0, Math.min(1, value || 0));
  return (
    <div style={{ position: 'relative', height: 14, borderRadius: 999, background: 'linear-gradient(90deg,#f87171,#fbbf24,#4ade80)', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', left: `${clamped * 100}%`, top: '50%', transform: 'translate(-50%, -50%)', width: 10, height: 18, background: '#111827', borderRadius: 4, boxShadow: '0 0 0 2px #fff' }} />
    </div>
  );
}
