"use client";

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useAppStore } from '../store/useAppStore';

function LoaderDots(){
  const dot: React.CSSProperties = { width:10, height:10, borderRadius:999, background:'#2563eb', animation:'pulse 1.2s infinite ease-in-out' };
  return (
    <>
      <span style={dot} />
      <span style={{ ...dot, animationDelay:'.2s' as React.CSSProperties['animationDelay'] }} />
      <span style={{ ...dot, animationDelay:'.4s' as React.CSSProperties['animationDelay'] }} />
      <style>{`@keyframes pulse{0%,80%,100%{opacity:.25}40%{opacity:1}}`}</style>
    </>
  );
}
type ButtonProps = {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  primary?: boolean;
};
function Button({ children, onClick, disabled, primary=false }: ButtonProps){
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`btn ${primary?'btn-primary':''} ${disabled?'disabled':''}`}
      style={{ marginRight:8 }}
    >
      {children}
    </button>
  );
}

export default function Page(){
  const s = useAppStore();
  const set = useAppStore.setState;

  const canGeneratePS = Boolean(s.title && s.wizWho && s.wizStruggle && s.wizCurrent && s.wizGap && s.wizSuccess) && !s.busyPS;
  const canExtract = Boolean(s.psText) && !s.busyExtract;
  const canNext = s.psTags.length > 0 && !s.psBlocked;

  const [typed, setTyped] = useState('');

  // One-shot typing AFTER Generate PS; no auto-typing on page load
  useEffect(() => {
    if (!s.psJustGenerated) return;
    setTyped('');
    const target = s.psText || '';
    let i = 0;
    const id = setInterval(() => {
      i++;
      setTyped(target.slice(0, i));
      if (i >= target.length) {
        clearInterval(id);
        s.ackPSAnimation();
      }
    }, 12);
    return () => clearInterval(id);
  }, [s.psJustGenerated, s.psText, s]);

  const showHint = !s.busyPS && !s.psText && !s.psJustGenerated;

  const handleClear = () => {
    set({
      title:'', wizWho:'', wizStruggle:'', wizCurrent:'', wizGap:'', wizSuccess:'',
      psText:'', psTags:[], psWarnings: undefined, psBlocked:false
    });
    setTyped('');
  };

  return (
    <section>
      <h2 className="page-title">Problem Statement</h2>

      <div className="card" style={{ marginTop:12 }}>
        <div className="card-body" style={{ paddingBottom:8 }}>
          <div className="hint">Tip: keep answers short and concrete. You can refine later.</div>
        </div>

        <label className="label">Project Name</label>
        <input className="input" value={s.title} onChange={e=>set({ title:e.target.value })} placeholder="e.g., Nanny Pathways Study" />

        <label className="label">1. Who is your customer?</label>
        <input className="input" value={s.wizWho} onChange={e=>set({ wizWho:e.target.value })} placeholder="e.g., Working parents with young children" />

        <label className="label">2. What’s their struggle?</label>
        <input className="input" value={s.wizStruggle} onChange={e=>set({ wizStruggle:e.target.value })} placeholder="e.g., Trustworthy childcare is hard to find and expensive" />

        <label className="label">3. What do they currently do?</label>
        <input className="input" value={s.wizCurrent} onChange={e=>set({ wizCurrent:e.target.value })} placeholder="e.g., Share sitters; rely on grandparents; juggle schedules" />

        <label className="label">4. What’s not working?</label>
        <input className="input" value={s.wizGap} onChange={e=>set({ wizGap:e.target.value })} placeholder="e.g., Inconsistent caregivers; no verification; coordination overhead" />

        <label className="label">5. What does success look like?</label>
        <input className="input" value={s.wizSuccess} onChange={e=>set({ wizSuccess:e.target.value })} placeholder="e.g., Consistent vetted caregiver; transparent scheduling; human support" />

        <div style={{ marginTop:8, display:'flex', gap:8 }}>
          <Button primary disabled={!canGeneratePS} onClick={s.generatePS}>{s.busyPS ? <LoaderDots/> : 'Generate PS'}</Button>
          <Button disabled={!s.title && !s.wizWho && !s.wizStruggle && !s.wizCurrent && !s.wizGap && !s.wizSuccess && !s.psText} onClick={handleClear}>Clear fields</Button>
        </div>

        {/* Generated paragraph area */}
        <div className="pre" style={{ marginTop:10, minHeight:72 }}>
          {showHint ? <span className="pre-hint">Click <b>Generate PS</b> to create a readable paragraph.</span> : (s.psJustGenerated ? typed : (s.psText || ''))}
        </div>

        <div style={{ marginTop:10 }}>
          <Button primary disabled={!canExtract} onClick={s.extractPains}>{s.busyExtract ? <LoaderDots/> : 'Extract Pains'}</Button>
        </div>

        <div className="green-box" style={{ marginTop:10 }}>
          <div style={{ fontWeight:800, marginBottom:4 }}>Anchors (pains)</div>
          <div className="hint" style={{ marginBottom:8 }}>These are the assumed pains you’ll test against real interviews.</div>
          {(s.psTags.length || 0) === 0 ? (
            <div className="hint">No anchors yet. Click Extract Pains.</div>
          ) : (
            <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
              {s.psTags.map((p,i)=>(
                <span key={`${p.tag}-${i}`} className="chip" title={p.label || p.tag}>
                  {p.tag}
                </span>
              ))}
            </div>
          )}
          {/* Message (neutral when OK, orange when blocked) */}
          {s.psWarnings && (
            <div
              className="hint"
              style={{ marginTop:6, color: s.psBlocked ? '#b45309' : '#334155' }}
            >
              {s.psWarnings}
            </div>
          )}
        </div>

        <div style={{ display:'flex', alignItems:'center', gap:10, marginTop:12 }}>
          <Link className={`btn ${canNext ? 'btn-primary' : 'disabled'}`} href={canNext ? '/archetypes' : '#'} aria-disabled={!canNext}>NEXT</Link>
          {!canNext && <span className="hint">Generate &amp; extract first.</span>}
        </div>
      </div>
    </section>
  );
}
