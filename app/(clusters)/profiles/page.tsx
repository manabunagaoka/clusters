'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useAppStore } from '../store/useAppStore';

function LoaderDots(){
  const dot: React.CSSProperties = { width:10, height:10, borderRadius:999, background:'#2563eb', animation:'pulse 1.2s infinite ease-in-out' };
  return (<><span style={dot}/><span style={{...dot,animationDelay:'.2s' as any}}/><span style={{...dot,animationDelay:'.4s' as any}}/><style>{`@keyframes pulse{0%,80%,100%{opacity:.25}40%{opacity:1}}`}</style></>);
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

  // PS vs Observed
  const psAnchors = useMemo(()=> (s.psTags||[]).map(p=>p.tag), [s.psTags]);
  const observed = s.profilesSummary?.anchor_coverage || [];
  const totalHits = (observed||[]).reduce((n,x)=>n+x.count,0) + (s.profilesSummary?.top_emergents||[]).reduce((n,x)=>n+x.count,0);
  const coverage = totalHits ? Math.round((observed.reduce((n,x)=>n+x.count,0) / totalHits) * 100) : 0;
  const gaps = psAnchors.filter(a => !(observed||[]).some(x => x.tag === a));

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
        {s.profilesError && <div className="error" style={{ marginTop:8 }}>{s.profilesError}</div>}
      </div>

      {/* PS vs Observed */}
      {hasProfiles && (
        <div className="green-box" style={{ marginTop:12 }}>
          <div className="hint" style={{ fontWeight:700, marginBottom:6 }}>PS anchors</div>
          <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
            {psAnchors.length ? psAnchors.map((a,i)=><span key={i} className="chip">{a}</span>) : <span className="hint">—</span>}
          </div>
          <div className="hint" style={{ fontWeight:700, margin:'8px 0 6px' }}>Observed anchors</div>
          <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
            {(observed||[]).map((r:any,i:number)=> <span key={i} className="chip">{r.tag} <span className="hint">({r.count})</span></span>)}
          </div>
          <div className="hint" style={{ marginTop:6 }}>
            Match: <b>{coverage}%</b>{gaps.length ? <> • Gaps: {gaps.join(', ')}</> : null}
          </div>
        </div>
      )}

      {/* Profiles list */}
      {hasProfiles && (
        <div style={{ display:'grid', gap:12, marginTop:12 }}>
          {s.profiles.map((p:any)=>(
            <div key={p.id} className="card">
              <div style={{ fontWeight:800 }}>{p.title || `Profile ${p.id}`}</div>
              <div className="hint" style={{ marginTop:6 }}>
                {typed[p.id] ?? p.narrative}
              </div>
              <div style={{ marginTop:8, display:'flex', gap:6, flexWrap:'wrap' }}>
                {(p.anchors||[]).map((t:string,i:number)=><span key={`a-${i}`} className="chip">{t}</span>)}
                {(p.facets||[]).map((t:string,i:number)=><span key={`f-${i}`} className="chip">{t}</span>)}
              </div>

              {/* Optional: JTBD details drawer */}
              <details style={{ marginTop:8 }}>
                <summary>JTBD fields</summary>
                <div className="hint" style={{ marginTop:6 }}>
                  {p.jtbd?.who && (<div><b>Who</b>: {p.jtbd.who}</div>)}
                  {p.jtbd?.context && (
                    <div style={{ marginTop:4 }}>
                      {p.jtbd.context.role && <> <b>Role</b>: {p.jtbd.context.role} </>}
                      {p.jtbd.context.work_pattern && <> • <b>Work pattern</b>: {p.jtbd.context.work_pattern} </>}
                      {p.jtbd.context.language_pref && <> • <b>Language</b>: {p.jtbd.context.language_pref} </>}
                      {p.jtbd.context.geo && <> • <b>Geo</b>: {p.jtbd.context.geo} </>}
                    </div>
                  )}
                  {p.jtbd?.struggling_moment && (<div style={{ marginTop:6 }}><b>Struggling moment</b>: {p.jtbd.struggling_moment}</div>)}
                  {Array.isArray(p.jtbd?.jobs) && p.jtbd.jobs.length>0 && (
                    <div style={{ marginTop:6 }}><b>Jobs</b>:
                      <ul style={{ margin:'4px 0 0', paddingLeft:18 }}>
                        {p.jtbd.jobs.map((s:string,i:number)=><li key={i}>{s}</li>)}
                      </ul>
                    </div>
                  )}
                  {Array.isArray(p.jtbd?.workarounds) && p.jtbd.workarounds.length>0 && (
                    <div style={{ marginTop:6 }}><b>Workarounds</b>:
                      <ul style={{ margin:'4px 0 0', paddingLeft:18 }}>
                        {p.jtbd.workarounds.map((s:string,i:number)=><li key={i}>{s}</li>)}
                      </ul>
                    </div>
                  )}
                  {Array.isArray(p.jtbd?.selection_criteria) && p.jtbd.selection_criteria.length>0 && (
                    <div style={{ marginTop:6 }}><b>Selection criteria</b>:
                      <ul style={{ margin:'4px 0 0', paddingLeft:18 }}>
                        {p.jtbd.selection_criteria.map((s:string,i:number)=><li key={i}>{s}</li>)}
                      </ul>
                    </div>
                  )}
                  {Array.isArray(p.jtbd?.anxieties) && p.jtbd.anxieties.length>0 && (
                    <div style={{ marginTop:6 }}><b>Anxieties</b>:
                      <ul style={{ margin:'4px 0 0', paddingLeft:18 }}>
                        {p.jtbd.anxieties.map((s:string,i:number)=><li key={i}>{s}</li>)}
                      </ul>
                    </div>
                  )}
                  {Array.isArray(p.jtbd?.outcomes) && p.jtbd.outcomes.length>0 && (
                    <div style={{ marginTop:6 }}><b>Outcomes</b>:
                      <ul style={{ margin:'4px 0 0', paddingLeft:18 }}>
                        {p.jtbd.outcomes.map((s:string,i:number)=><li key={i}>{s}</li>)}
                      </ul>
                    </div>
                  )}
                </div>
              </details>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
