'use client';
import { useAppStore } from '../store/useAppStore';

function LoaderDots(){
  const dot: React.CSSProperties = { width:10, height:10, borderRadius:999, background:'#2563eb', animation:'pulse 1.2s infinite ease-in-out' };
  return (<><span style={dot}/><span style={{...dot,animationDelay:'.2s'}}/><span style={{...dot,animationDelay:'.4s'}}/><style>{`@keyframes pulse{0%,80%,100%{opacity:.25}40%{opacity:1}}`}</style></>);
}

export default function ProfilesPage(){
  const s = useAppStore();
  const set = useAppStore.setState;

  const canGenerate = !!(s.notes?.trim()) && !s.busyProfiles;

  const handleGenerate = async ()=>{ await s.generateProfiles(); };
  const handleClear = ()=>{ set({ profiles:[], profilesMatrix:[], profilesSummary:null, profilesError:'' }); };

  const hasProfiles = Array.isArray(s.profiles) && s.profiles.length > 0;

  return (
    <section>
      <h2 style={{ marginTop:0 }}>Profiles (JTBD)</h2>

      <div className="card" style={{ marginTop:12 }}>
        <label className="label">Paste your JTBD interview notes</label>
        <textarea
          className="input textarea"
          value={s.notes}
          onChange={e=>set({ notes:e.target.value })}
          placeholder={
`Use any format. For best results, include:

Interview – Name, Role, Context
Who/Context: …
Struggling moment: …
Current workarounds: …
What's not working (anxieties): …
What does success look like (outcomes): …

Paste multiple interviews separated by blank lines or "Interview 2 – …".`
        }
        />
        <div style={{ marginTop:10, display:'flex', gap:8 }}>
          <button className={`btn ${canGenerate ? 'btn-primary' : 'disabled'}`} disabled={!canGenerate} onClick={handleGenerate}>
            {s.busyProfiles ? <LoaderDots/> : 'Generate Profiles'}
          </button>
          <button className="btn" onClick={handleClear}>Clear fields</button>
        </div>
        {s.profilesError && <div className="hint" style={{ marginTop:8, color:'#b45309' }}>{s.profilesError}</div>}
      </div>

      {hasProfiles && (
        <div style={{ display:'grid', gap:12, marginTop:12 }}>
          {(s.profiles || []).map((p: { id: string; narrative?: string; themes?: { core?: string[]; facets?: string[] }; jtbd?: { struggling_moment?: string; workarounds?: string[]; jobs?: string[]; selection_criteria?: string[]; anxieties?: string[]; outcomes?: string[] } }, index:number)=>(
            <div key={String(p.id)} className="card">
              <div style={{ fontWeight:800 }}>{`Profile ${index+1}`}</div>

              {/* Narrative (already includes name + context) */}
              <div className="hint" style={{ marginTop:6 }}>
                {String(p.narrative || '')}
              </div>

              {/* Theme chips: Core first (strings only), then critical facets */}
              <div style={{ marginTop:8, display:'flex', gap:6, flexWrap:'wrap' }}>
                {Array.isArray(p.themes?.core) && p.themes.core.map((t:string,i:number)=>
                  <span key={`c-${i}`} className="chip">{typeof t === 'string' ? t : String(t)}</span>
                )}
                {Array.isArray(p.themes?.facets) && p.themes.facets.map((t:string,i:number)=>
                  <span key={`f-${i}`} className="chip">{(typeof t === 'string' ? t : String(t)).replace(/_/g,' ')}</span>
                )}
              </div>

              {/* Always-visible Interview (JTBD) findings — no "Who" heading */}
              <div className="findings">
                {p.jtbd?.struggling_moment && (
                  <div className="section">
                    <div className="label">Struggling moment</div>
                    <div>{String(p.jtbd.struggling_moment)}</div>
                  </div>
                )}

                {Array.isArray(p.jtbd?.workarounds) && p.jtbd.workarounds.length>0 && (
                  <div className="section">
                    <div className="label">Workarounds</div>
                    <ul>{p.jtbd.workarounds.slice(0,4).map((x:string,i:number)=><li key={i}>{String(x)}</li>)}</ul>
                  </div>
                )}

                {Array.isArray(p.jtbd?.jobs) && p.jtbd.jobs.length>0 && (
                  <div className="section">
                    <div className="label">Jobs</div>
                    <ul>{p.jtbd.jobs.slice(0,4).map((x:string,i:number)=><li key={i}>{String(x)}</li>)}</ul>
                  </div>
                )}

                {Array.isArray(p.jtbd?.selection_criteria) && p.jtbd.selection_criteria.length>0 && (
                  <div className="section">
                    <div className="label">Selection criteria</div>
                    <ul>{p.jtbd.selection_criteria.slice(0,4).map((x:string,i:number)=><li key={i}>{String(x)}</li>)}</ul>
                  </div>
                )}

                {Array.isArray(p.jtbd?.anxieties) && p.jtbd.anxieties.length>0 && (
                  <div className="section">
                    <div className="label">Anxieties</div>
                    <ul>{p.jtbd.anxieties.slice(0,4).map((x:string,i:number)=><li key={i}>{String(x)}</li>)}</ul>
                  </div>
                )}

                {Array.isArray(p.jtbd?.outcomes) && p.jtbd.outcomes.length>0 && (
                  <div className="section">
                    <div className="label">Outcomes (success)</div>
                    <ul>{p.jtbd.outcomes.slice(0,4).map((x:string,i:number)=><li key={i}>{String(x)}</li>)}</ul>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {hasProfiles && (
        <div style={{ display:'flex', alignItems:'center', gap:10, marginTop:12 }}>
          <button className="btn btn-primary" onClick={()=>{ location.href='/metrics'; }}>
            NEXT
          </button>
          <span className="hint">Proceed to Clusters &amp; Metrics — narratives and themes are saved for the math.</span>
        </div>
      )}
    </section>
  );
}