'use client';
import { useState, useEffect } from 'react';
import { useAppStore } from '../store/useAppStore';

function LoaderDots(){
  const dot: React.CSSProperties = { width:10, height:10, borderRadius:999, background:'#2563eb', animation:'pulse 1.2s infinite ease-in-out' };
  return (<><span style={dot}/><span style={{...dot,animationDelay:'.2s' as any}}/><span style={{...dot,animationDelay:'.4s' as any}}/><style>{`@keyframes pulse{0%,80%,100%{opacity:.25}40%{opacity:1}}`}</style></>);
}

export default function Page(){
  const s = useAppStore();
  const set = useAppStore.setState;
  const [typedIds, setTypedIds] = useState<string[]>([]);
  const canGenerate = !!(s.notes?.trim()) && !s.busyProfiles;

  const handleGenerate = async ()=>{
    await s.generateProfiles();
    setTypedIds([]); // reset typing animation guard
  };
  const handleClear = ()=> s.clearProfiles();

  // simple typewriter for each profile narrative
  useEffect(()=>{ /* left intentionally minimal; Copilot can add per-card typing next */ },[s.profiles]);

  const psAnchors = (s.psTags||[]).map(p=>p.tag);
  const observed = s.profilesSummary?.anchor_coverage || [];
  const totalHits = observed.reduce((n,x)=>n+Number(x.count||0),0) + (s.profilesSummary?.top_emergents||[]).reduce((n,x)=>n+Number(x.count||0),0);
  const coverage = totalHits ? Math.round((observed.reduce((n,x)=>n+Number(x.count||0),0) / totalHits) * 100) : 0;
  const gaps = psAnchors.filter(a => !(observed||[]).some((x:any) => x.tag === a));

  return (
    <section>
      <h2 style={{ marginTop:0 }}>Profiles (JTBD)</h2>

      <div className="card" style={{ marginTop:12 }}>
        <label className="label">Interview notes (any format)</label>
        <textarea className="input textarea" value={s.notes} onChange={e=>set({ notes:e.target.value })} placeholder="Paste raw interviews. We'll structure them using JTBD." />
        <div style={{ marginTop:10, display:'flex', gap:8 }}>
          <button className={`btn ${canGenerate ? 'btn-primary' : 'disabled'}`} disabled={!canGenerate} onClick={handleGenerate}>
            {s.busyProfiles ? <LoaderDots/> : 'Generate Profiles'}
          </button>
          <button className="btn" onClick={handleClear}>Clear fields</button>
        </div>
        {s.profilesError && <div className="error" style={{ marginTop:8 }}>{s.profilesError}</div>}
      </div>

      {/* PS vs Observed strip */}
      {s.profiles && s.profiles.length > 0 && (
        <div className="green-box" style={{ marginTop:12 }}>
          <div className="hint" style={{ fontWeight:700, marginBottom:6 }}>PS anchors</div>
          <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>{psAnchors.map((a,i)=><span key={i} className="chip">{a}</span>)}</div>
          <div className="hint" style={{ fontWeight:700, margin:'8px 0 6px' }}>Observed anchors</div>
          <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>{observed.map((r:any,i:number)=><span key={i} className="chip">{r.tag} <span className="hint">({r.count})</span></span>)}</div>
          <div className="hint" style={{ marginTop:6 }}>Match: <b>{coverage}%</b>{gaps.length? <> • Gaps: {gaps.join(', ')}</> : null}</div>
        </div>
      )}

      {/* Profiles list */}
      {s.profiles && s.profiles.length > 0 && (
        <div style={{ display:'grid', gap:12, marginTop:12 }}>
          {s.profiles.map((p:any)=>(
            <div key={p.id} className="card">
              <div style={{ fontWeight:800 }}>{p.title || `Profile ${p.id}`}</div>
              <div className="hint" style={{ marginTop:6 }}>{p.narrative}</div>
              <div style={{ marginTop:8, display:'flex', gap:6, flexWrap:'wrap' }}>
                {(p.anchors||[]).map((t:string,i:number)=><span key={`a-${i}`} className="chip">{t}</span>)}
                {(p.facets||[]).map((t:string,i:number)=><span key={`f-${i}`} className="chip">{t}</span>)}
              </div>
              {/* optional JTBD fields toggle later */}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
