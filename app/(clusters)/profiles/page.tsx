'use client';
import React from 'react';
import { useAppStore } from '../store/useAppStore';

function LoaderDots(){
  const dot: React.CSSProperties = { width:10, height:10, borderRadius:999, background:'#2563eb', animation:'pulse 1.2s infinite ease-in-out' };
  return (<><span style={dot}/><span style={{...dot,animationDelay:'.2s' as React.CSSProperties['animationDelay']}}/><span style={{...dot,animationDelay:'.4s' as React.CSSProperties['animationDelay']}}/><style>{`@keyframes pulse{0%,80%,100%{opacity:.25}40%{opacity:1}}`}</style></>);
}

export default function ProfilesPage(){
  const s = useAppStore();
  const set = useAppStore.setState;
  const canGenerate = !!(s.notes?.trim()) && !s.busyProfiles;

  const handleGenerate = async ()=>{
    await s.generateProfiles();
  };
  const handleClear = ()=>{
    set({ profiles:[], profilesMatrix:[], profilesSummary:null, profilesError:'' });
  };

  const hasProfiles = (s.profiles||[]).length > 0;

  return (
    <section>
  <h2 style={{ marginTop:0 }}>Profiles (JTBD)</h2>

      <div className="card" style={{ marginTop:12 }}>
        <label className="label">Paste your JTBD interview notes</label>
        <textarea
          className="input textarea"
          value={s.notes}
          onChange={e=>set({ notes:e.target.value })}
          placeholder={`Paste 3–8 interview notes. Separate interviews by a blank line or a header like “Interview 1”.\n\nHelpful (optional) structure:\nWho/Context\nStruggling moment\nWorkarounds\nOutcomes\n\nWe'll turn them into friendly JTBD profiles, map themes into universal core dimensions, and keep key phrases.`}
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
              <div className="hint" style={{ marginTop:6 }}>{p.narrative}</div>
              <div style={{ marginTop:8, display:'flex', gap:6, flexWrap:'wrap' }}>
                {(p.themes?.core||[]).map((t: unknown, i:number)=>{
                  let label: string;
                  if (typeof t === 'string') label = t;
                  else if (typeof t === 'number') label = String(t);
                  else if (typeof t === 'object' && t !== null) {
                    if ('tag' in (t as Record<string, unknown>)) label = String((t as Record<string, unknown>).tag);
                    else label = JSON.stringify(t);
                  } else label = String(t ?? '');
                  return <span key={`c-${i}`} className="chip">{label}</span>;
                })}
                {(p.themes?.facets||[]).map((t: unknown, i:number)=>{
                  let label: string;
                  if (typeof t === 'string') label = t;
                  else if (typeof t === 'number') label = String(t);
                  else if (typeof t === 'object' && t !== null) {
                    if ('tag' in (t as Record<string, unknown>)) label = String((t as Record<string, unknown>).tag);
                    else label = JSON.stringify(t);
                  } else label = String(t ?? '');
                  return <span key={`f-${i}`} className="chip">{label}</span>;
                })}
              </div>
              <div className="findings" style={{ marginTop:6 }}>
                {p.jtbd?.struggling_moment && (
                  <div className="section">
                    <div className="label">Struggling moment</div>
                    <div>{p.jtbd.struggling_moment}</div>
                  </div>
                )}
                {Array.isArray(p.jtbd?.workarounds) && p.jtbd.workarounds.length>0 && (
                  <div className="section">
                    <div className="label">Workarounds</div>
                    <ul>{p.jtbd.workarounds.slice(0,4).map((s: unknown,i:number)=><li key={i}>{typeof s==='string'?s:String(s)}</li>)}</ul>
                  </div>
                )}
                {Array.isArray(p.jtbd?.jobs) && p.jtbd.jobs.length>0 && (
                  <div className="section">
                    <div className="label">Jobs</div>
                    <ul>{p.jtbd.jobs.slice(0,4).map((s: unknown,i:number)=><li key={i}>{typeof s==='string'?s:String(s)}</li>)}</ul>
                  </div>
                )}
                {Array.isArray(p.jtbd?.selection_criteria) && p.jtbd.selection_criteria.length>0 && (
                  <div className="section">
                    <div className="label">Selection criteria</div>
                    <ul>{p.jtbd.selection_criteria.slice(0,4).map((s: unknown,i:number)=><li key={i}>{typeof s==='string'?s:String(s)}</li>)}</ul>
                  </div>
                )}
                {Array.isArray(p.jtbd?.anxieties) && p.jtbd.anxieties.length>0 && (
                  <div className="section">
                    <div className="label">Anxieties</div>
                    <ul>{p.jtbd.anxieties.slice(0,4).map((s: unknown,i:number)=><li key={i}>{typeof s==='string'?s:String(s)}</li>)}</ul>
                  </div>
                )}
                {Array.isArray(p.jtbd?.outcomes) && p.jtbd.outcomes.length>0 && (
                  <div className="section">
                    <div className="label">Outcomes (success)</div>
                    <ul>{p.jtbd.outcomes.slice(0,4).map((s: unknown,i:number)=><li key={i}>{typeof s==='string'?s:String(s)}</li>)}</ul>
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
