'use client';
import { useAppStore } from '../store/useAppStore';

export default function Page(){
  const resetAll = useAppStore(s => s.resetAll);

  const handleReset = () => {
    resetAll();
    if (typeof window !== 'undefined') window.location.href = '/instructions';
  };

  return (
    <section>
      <h2 style={{ marginTop:0 }}>Account</h2>
      <div className="card" style={{ marginTop:12 }}>
        <div className="hint" style={{ marginBottom:8 }}>Reset clears all local progress (Problem Statement, anchors, notes, archetypes, metrics, insights).</div>
        <button className="btn" onClick={handleReset}>Reset workspace</button>
      </div>
    </section>
  );
}
