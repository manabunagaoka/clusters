"use client";

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { CORE_IDS } from '../lib/psRules';
import { useAppStore } from '../store/useAppStore';
import CoreChip from '../components/CoreChip';
import LoaderDots from '../components/LoaderDots';
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
      className={`btn ${primary ? 'btn-primary' : ''}`}
      style={{ marginRight:8 }}
    >
      {children}
    </button>
  );
}

export default function Page(){
  const s = useAppStore();
  const set = useAppStore.getState().setWizard;
  const clear = useAppStore.getState().clearPsWizard;
  const psDraft = useAppStore(st => st.psDraft);
  const psText = useAppStore(st => st.psText);
  const psJustGenerated = useAppStore(st => st.psJustGenerated);
  const ackPSAnimation = useAppStore(st => st.ackPSAnimation);
  const setPsDraft = useAppStore(st => st.setPsDraft);
  const setPsSnapshot = useAppStore(st => st.setPsSnapshot);
  const [busy, setBusy] = useState(false);

  const canGeneratePS = Boolean(s.title && s.wizWho && s.wizStruggle && s.wizCurrent && s.wizGap && s.wizSuccess) && !s.busyPS;
  const canExtract = Boolean(psDraft) && !busy;

  // Live typing will update psDraft directly; no overlay block

  // One-shot typing AFTER Generate PS; no auto-typing on page load
  useEffect(() => {
    if (!psJustGenerated) return;
    const target = psText || '';
    let i = 0;
    // Reset textarea then type into it directly
    setPsDraft('');
    const id = setInterval(() => {
      i++;
      setPsDraft(target.slice(0, i));
      if (i >= target.length) {
        clearInterval(id);
        ackPSAnimation();
      }
    }, 12);
    return () => clearInterval(id);
  }, [psJustGenerated, psText, ackPSAnimation, setPsDraft]);

  const showHint = !s.busyPS && !s.psText && !s.psJustGenerated;

  const handleClear = () => {
    // Clear wizard and PS-related fields in one go
    clear();
    useAppStore.setState({
      // PS
      psText: '',
      psDraft: '',
      psJustGenerated: false,
      psTags: [],
      psWarnings: undefined,
      psBlocked: false,
      psSnapshot: null,
      psReady: false,
      interviewReady: false,
      // Wizard inputs
      title: '',
      wizWho: '',
      wizStruggle: '',
      wizCurrent: '',
      wizGap: '',
      wizSuccess: '',
    });
  };

  const handleExtractThemes = async () => {
    ackPSAnimation(); // ensure overlay is not shown during Extract
    if (!psDraft.trim()) return;
    setBusy(true);
    try {
      const res = await fetch('/api/pains/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ problem_statement: psDraft })
      });
      const json = await res.json();
      const tags = Array.isArray(json?.pains) ? json.pains.map((p:any)=> String(p?.tag||'').toLowerCase()) : [];
      const coreTags = tags.filter((t:string)=> (CORE_IDS as readonly string[]).includes(t as any)).slice(0,3);
  setPsSnapshot(coreTags);
  useAppStore.setState({ psReady: true });
    } finally {
      setBusy(false);
    }
  };

  const coreThemes = (s.psSnapshot?.themes || []);
  const canNext = coreThemes.length > 0 && !s.psBlocked;

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
          <Button primary disabled={!canGeneratePS} onClick={s.generatePS}>{s.busyPS ? <LoaderDots/> : <span className="btn-label">Generate PS</span>}</Button>
          <Button disabled={!s.title && !s.wizWho && !s.wizStruggle && !s.wizCurrent && !s.wizGap && !s.wizSuccess && !s.psText} onClick={handleClear}>Clear PS</Button>
        </div>

        {/* Show typing animation once per generation */}
        {/* Editable PS textarea bound to store (persists across navigation). Types live during generation. */}
        <label className="label" style={{ marginTop:10 }}>Problem Statement (editable)</label>
        <textarea
          className="input textarea"
          value={psDraft}
          onChange={(e)=> setPsDraft(e.target.value)}
          placeholder="Type or paste your problem statement here..."
          style={{ minHeight: 96 }}
          disabled={psJustGenerated}
        />

        <div style={{ marginTop:10 }}>
          <Button primary disabled={!canExtract} onClick={handleExtractThemes}>{busy ? <LoaderDots/> : <span className="btn-label">Extract Themes</span>}</Button>
        </div>

        <div className="green-box" style={{ marginTop:10 }}>
          <div style={{ fontWeight:800, marginBottom:4 }}>Themes</div>
          <div className="hint" style={{ marginBottom:8 }}>These are the assumed themes you’ll test against real interviews.</div>
          {(coreThemes.length || 0) === 0 ? (
            <div className="hint">No themes yet. Click Extract Themes.</div>
          ) : (
            <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
              {coreThemes.map((core,i)=>(
                <CoreChip key={`${core}-${i}`} core={core} variant="filled" size="md" title={core} />
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
          <Link className={`btn btn-primary`} href={canNext ? '/interview' : '#'} aria-disabled={!canNext} style={{ opacity: canNext ? 1 : .55, pointerEvents: canNext ? 'auto':'none' }}>NEXT</Link>
          {!canNext && <span className="hint">Generate &amp; extract first.</span>}
        </div>
      </div>
    </section>
  );
}
