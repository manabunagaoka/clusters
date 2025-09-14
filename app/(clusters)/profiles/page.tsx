'use client';
import { useEffect, useState } from 'react';
import { useAppStore } from '../store/useAppStore';

function LoaderDots(){
  const dot: React.CSSProperties = { width:10, height:10, borderRadius:999, background:'#2563eb', animation:'pulse 1.2s infinite ease-in-out' };
  return (<><span style={dot}/><span style={{...dot,animationDelay:'.2s' as React.CSSProperties['animationDelay']}}/><span style={{...dot,animationDelay:'.4s' as React.CSSProperties['animationDelay']}}/><style>{`@keyframes pulse{0%,80%,100%{opacity:.25}40%{opacity:1}}`}</style></>);
}

export default function ProfilesPage(){
  const s = useAppStore();
  const set = useAppStore.setState;
  const canGenerate = !!(s.notes?.trim()) && !s.busyProfiles;

  // typewriter state: id -> typed narrative
  const [typed, setTyped] = useState<Record<string,string>>({});
  const [playing, setPlaying] = useState(false);

  const handleGenerate = async ()=>{
    setTyped({});
    await s.generateProfiles();
    setPlaying(true);
  };
  const handleClear = ()=>{
    set({ profiles:[], profilesMatrix:[], profilesSummary:null, profilesError:'' });
  };

  // PS vs Observed (reserved for future compare view)
  // const psAnchors = useMemo(()=> (s.psTags||[]).map(p=>p.tag), [s.psTags]);
  // const observed = s.profilesSummary?.anchor_coverage || [];
  // kept for potential future comparison view
  // const totalHits = (observed||[]).reduce((n,x)=>n+x.count,0) + (s.profilesSummary?.top_emergents||[]).reduce((n,x)=>n+x.count,0);
  // const coverage = totalHits ? Math.round((observed.reduce((n,x)=>n+x.count,0) / totalHits) * 100) : 0;
  // const gaps = psAnchors.filter(a => !(observed||[]).some(x => x.tag === a));

  // Typewriter: reveal each profile sequentially
  useEffect(()=>{
    if (!playing) return;
    const list = s.profiles || [];
    let idx = 0; let current = list[0]?.id || '';
    const timer = setInterval(()=>{
      if (!list.length) { clearInterval(timer); setPlaying(false); return; }
      const prof = list[idx];
      if (!prof){ clearInterval(timer); setPlaying(false); return; }
      const text = String(prof.narrative || '');
      const soFar = (typed[prof.id] || '');
      if (soFar.length < text.length){
        setTyped(prev => ({ ...prev, [prof.id]: text.slice(0, soFar.length + 2) }));
      } else {
        // move to next
        idx += 1;
        current = list[idx]?.id || '';
        if (!current) { clearInterval(timer); setPlaying(false); }
      }
    }, 12);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, s.profiles]);

  const hasProfiles = (s.profiles||[]).length > 0;

  return (
    <section>
      <h2 style={{ marginTop:0 }}>Profiles (JTBD)</h2>

      <div className="card" style={{ marginTop:12 }}>
        <label className="label">Interview notes (any format)</label>
        <textarea
          className="input textarea"
          value={s.notes}
          onChange={e=>set({ notes:e.target.value })}
          placeholder={`Paste raw interviews. We'll structure them automatically using a JTBD schema (` + 
                      `who/context, struggling moment, pains, workarounds, outcomes).`}
        />
        <div style={{ marginTop:10, display:'flex', gap:8 }}>
          <button className={`btn ${canGenerate ? 'btn-primary' : 'disabled'}`} disabled={!canGenerate} onClick={handleGenerate}>
            {s.busyProfiles ? <LoaderDots/> : 'Generate Profiles'}
          </button>
          <button className="btn" onClick={handleClear}>Clear fields</button>
        </div>
        {s.profilesError && <div className="hint" style={{ marginTop:8, color:'#b45309' }}>{s.profilesError}</div>}
      </div>

      {/* Compare block removed for Profiles pivot */}

      {/* Profiles list */}
      {hasProfiles && (
        <div style={{ display:'grid', gap:12, marginTop:12 }}>
          {(s.profiles || []).map((p, idx: number)=>(
            <div key={p.id} className="card">
              <div style={{ fontWeight:800 }}>{`Profile ${idx+1}`}</div>
              <div className="hint" style={{ marginTop:6 }}>
                {typed[p.id] ?? p.narrative}
              </div>
              <div style={{ marginTop:8, display:'flex', gap:6, flexWrap:'wrap' }}>
                {(p.themes?.core||[]).map((t:string,i:number)=><span key={`c-${i}`} className="chip">{t}</span>)}
                {(p.themes?.facets||[]).map((t:string,i:number)=><span key={`f-${i}`} className="chip">{t}</span>)}
              </div>
              {/* Always-visible JTBD findings box */}
              <div className="findings">
                {(p.jtbd?.who || p.jtbd?.context) && (
                  <div className="section">
                    <div className="label">Interview (JTBD) findings — Who</div>
                    {p.jtbd?.who && <div>{p.jtbd.who}</div>}
                    {p.jtbd?.context && (
                      <div className="meta" style={{ marginTop:6 }}>
                        {p.jtbd.context.role && <span className="chip">{p.jtbd.context.role}</span>}
                        {p.jtbd.context.work_pattern && <span className="chip">{p.jtbd.context.work_pattern}</span>}
                        {p.jtbd.context.language_pref && <span className="chip">{p.jtbd.context.language_pref}</span>}
                        {p.jtbd.context.geo && <span className="chip">{p.jtbd.context.geo}</span>}
                      </div>
                    )}
                  </div>
                )}

                {p.jtbd?.struggling_moment && (
                  <div className="section">
                    <div className="label">Struggling moment</div>
                    <div>{p.jtbd.struggling_moment}</div>
                  </div>
                )}

                {Array.isArray(p.jtbd?.workarounds) && p.jtbd.workarounds.length>0 && (
                  <div className="section">
                    <div className="label">Workarounds</div>
                    <ul>{p.jtbd.workarounds.slice(0,4).map((s:string,i:number)=><li key={i}>{s}</li>)}</ul>
                  </div>
                )}

                {Array.isArray(p.jtbd?.jobs) && p.jtbd.jobs.length>0 && (
                  <div className="section">
                    <div className="label">Jobs</div>
                    <ul>{p.jtbd.jobs.slice(0,4).map((s:string,i:number)=><li key={i}>{s}</li>)}</ul>
                  </div>
                )}

                {Array.isArray(p.jtbd?.selection_criteria) && p.jtbd.selection_criteria.length>0 && (
                  <div className="section">
                    <div className="label">Selection criteria</div>
                    <ul>{p.jtbd.selection_criteria.slice(0,4).map((s:string,i:number)=><li key={i}>{s}</li>)}</ul>
                  </div>
                )}

                {Array.isArray(p.jtbd?.anxieties) && p.jtbd.anxieties.length>0 && (
                  <div className="section">
                    <div className="label">Anxieties</div>
                    <ul>{p.jtbd.anxieties.slice(0,4).map((s:string,i:number)=><li key={i}>{s}</li>)}</ul>
                  </div>
                )}

                {Array.isArray(p.jtbd?.outcomes) && p.jtbd.outcomes.length>0 && (
                  <div className="section">
                    <div className="label">Outcomes (success)</div>
                    <ul>{p.jtbd.outcomes.slice(0,4).map((s:string,i:number)=><li key={i}>{s}</li>)}</ul>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {s.profiles && s.profiles.length>0 && (
        <div style={{ display:'flex', alignItems:'center', gap:10, marginTop:12 }}>
          <button className="btn btn-primary" onClick={()=>{ location.href='/metrics'; }}>NEXT</button>
          <span className="hint">Proceed to Clusters & Metrics. Narratives and themes are saved for the math.</span>
        </div>
      )}
    </section>
  );
}
