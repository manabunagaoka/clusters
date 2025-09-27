'use client';
import React, { useEffect, useMemo, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { textHash } from '../lib/psRules';
import { useAppStore } from '../store/useAppStore';

const CORE_TOOLTIPS: Record<string,string> = {
  cost: 'money out (price, fees, discounts)',
  time: 'waiting or speed',
  effort: 'hassle, coordination, learning curve',
  quality: 'outcomes, performance, safety',
  reliability: 'consistency over time, continuity',
  trust: 'credibility, privacy/safety, confidence in people',
  flexibility: 'adapts to needs/schedule/config',
  choice: 'breadth/availability of options',
  information: 'findability, transparency, comparability',
  access: 'eligibility, coverage, language, device/geo',
  support: 'human help when things go wrong',
  risk: 'lock-in, penalties, compliance/legal downside (explicit only)',
  value: '“worth it / renew / cancel” judgement'
};

export default function InterviewPage(){
  const router = useRouter();
  const s = useAppStore();
  const set = useAppStore.setState;
  // Removed auto-clear effect: state should persist for session navigation

  const busy = s.busyThemes;
  const canExtract = !!(s.interviewNotes?.trim()) && !busy;

  const [dataVersion, setDataVersion] = useState(0);
  const [animateBars, setAnimateBars] = useState(false);
  const prefersReducedMotion = usePrefersReducedMotion();
  const chartRef = useRef<HTMLDivElement|null>(null);
  const notesRef = useRef<HTMLTextAreaElement|null>(null);
  const handleExtract = async (e?: React.MouseEvent)=>{
    e?.preventDefault();
    if(!canExtract) return;
    // Blur textarea to avoid mobile keyboard pushing layout
    try { notesRef.current?.blur(); } catch{}
    await s.extractThemes();
    try {
      const latest = useAppStore.getState() as any;
      const themes = (latest.psTags||[]).map((t:any)=> t.tag).filter(Boolean);
      const hash = textHash(latest.psText||'');
      const snapshot = { hash, themes };
      try { localStorage.setItem('psSnapshot', JSON.stringify(snapshot)); } catch{}
      // Persist the exact matrix pairs used downstream (id -> weights record)
      const matrixPairs: Array<[string, Record<string, number>]> = Array.isArray(latest.profilesMatrix) ? latest.profilesMatrix : [];
      useAppStore.setState({ themesReady: true, interviewMatrix: matrixPairs } as any);
    } catch {}
    setDataVersion(v=>v+1);
    const scrollChartIntoView = () => {
      if(!chartRef.current) return;
      try {
        chartRef.current.scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : 'smooth', block: 'center', inline: 'nearest' });
      } catch{}
    };
    // Double RAF ensures initial 0% paint of bars before scroll
    requestAnimationFrame(()=> requestAnimationFrame(scrollChartIntoView));
  };
  const handleClear = ()=>{ 
    s.resetThemes(); 
    useAppStore.setState({ themesReady: false, interviewMatrix: [] } as any);
  };

  // Compute stats based on themesDisplay (matrix presence per interview)
  const CORES = ['cost','time','effort','quality','reliability','trust','flexibility','choice','information','access','support','risk','value'] as const;
  const presenceCounts = useMemo(()=>{
    const counts: Record<string, number> = Object.fromEntries(CORES.map(c=>[c,0]));
    (s.themesDisplay||[]).forEach((row:any)=>{
      const cores: string[] = (row.top_cores||[]).map((c:any)=>c.core as string);
      const uniq: string[] = Array.from(new Set(cores));
      uniq.forEach((c:string)=>{ if(Object.prototype.hasOwnProperty.call(counts,c)) counts[c]+=1; });
    });
    return counts;
  },[s.themesDisplay]);
  const interviewsTotal = (s.themesDisplay||[]).length;
  const interviewsWithThemes = (s.themesDisplay||[]).filter((r:any)=>(r.top_cores||[]).length>0).length;
  const topThemes = useMemo(()=>{
    return Object.entries(presenceCounts)
      .filter(([_,v])=>v>0)
      .sort((a,b)=> b[1]-a[1] || a[0].localeCompare(b[0]))
      .slice(0,3)
      .map(([c])=>c);
  },[presenceCounts]);
  // Problem Statement themes: prefer PS snapshot (from PS page) else tags, else topThemes
  const snapshotThemes: string[] = Array.isArray(s.psSnapshot?.themes) ? (s.psSnapshot!.themes as string[]) : [];
  const problemStatementThemes = snapshotThemes.slice(0,3);
  const psChips = problemStatementThemes;

  const [sortAZ, setSortAZ] = useState(false);
  const barData = useMemo(()=>{
    const entries = Object.entries(presenceCounts);
    const filtered = entries; // always 13 cores
    const sorted = sortAZ
      ? filtered.sort((a,b)=> a[0].localeCompare(b[0]))
      : filtered.sort((a,b)=> b[1]-a[1] || a[0].localeCompare(b[0]));
    return sorted;
  },[presenceCounts, sortAZ]);

  const coreColors: Record<string,string> = { cost:'#ef4444', time:'#06b6d4', effort:'#f59e0b', quality:'#8b5cf6', reliability:'#10b981', trust:'#f97316', flexibility:'#22c55e', choice:'#a855f7', information:'#3b82f6', access:'#14b8a6', support:'#64748b', risk:'#b91c1c', value:'#eab308' };

  const showEarlyHint = interviewsTotal>0 && (interviewsTotal < 5 || (interviewsWithThemes / Math.max(1, interviewsTotal)) < 0.6);
  const blankLineWarningNeeded = (s.interviewNotes||'').includes('Interview') && !/\n\s*\n/.test((s.interviewNotes||'').trim());

  return (
    <section>
      <h2 className="page-title" style={{marginTop:0}}>Interview</h2>
      <div className="card" style={{marginTop:12}}>
        <div style={{fontSize:14, lineHeight:1.4, marginBottom:12}}>
          Paste your interview notes. We’ll detect the most common customer pain themes and show how often each one appears across your interviews.
        </div>
        <textarea
          className="input textarea"
          ref={notesRef}
          value={s.interviewNotes||''}
          onChange={e=>set({ interviewNotes:e.target.value })}
          placeholder={`For best results, write each interview as 4–6 plain sentences answering the Problem Statement wizard questions:\n\n1) Who are you and what’s your role or context?\n2) What is your struggle?\n3) What do you currently do to solve it?\n4) What is not working?\n5) What would success look like? (Avoid proposing a solution—describe the outcome you want.)\n\nFormatting:\n• Separate interviews with a blank line, and start each with a heading like: “Interview 2 — Name, Role”.\n• Include helpful details when relevant (for example, language preference, schedule constraints, budget).\n\nExample\nInterview 1 — Maya P., High School Senior\nI’m choosing colleges this fall and I feel overwhelmed by too many options. I spend hours on rankings and school sites and still feel unsure.\nI meet with my school counselor, but they have very limited time. We usually get 10 minutes and it’s mostly about deadlines.\nI looked into a private counselor, but it’s too expensive for my family right now.\nSuccess would be getting a short list that matches my interests and budget, with some personalized guidance so I feel confident about my choice.`}
          rows={10}
          style={{minHeight:260}}
        />
        <div className="hint" style={{fontSize:11, marginTop:6}}>Blank line between interviews is required.</div>
        {blankLineWarningNeeded && !busy && <div className="hint" style={{color:'#b45309', fontSize:12, marginTop:4}}>Add a blank line between interviews and try again.</div>}
        {(s.themesWarnings||[]).filter(w=>/blank line/i.test(w)).map((w,i)=>(<div key={i} className="hint" style={{color:'#b45309', fontSize:12, marginTop:4}}>{w}</div>))}
        <div style={{marginTop:12, display:'flex', gap:8, flexWrap:'wrap', alignItems:'center'}}>
          <button type="button" className="btn btn-primary" disabled={!canExtract} onClick={handleExtract}>{busy ? 'Extracting…' : 'Extract Themes'}</button>
          <button className="btn btn-primary" disabled={interviewsWithThemes<1} onClick={()=>{ if(interviewsWithThemes>=1) router.push('/clusters'); }}>Next</button>
          <div style={{flex:1}} />
          <button className="btn" onClick={handleClear}>Clear</button>
        </div>
      </div>
      {(s.themesWarnings||[]).filter(w=>!/blank line/i.test(w)).length>0 && (
        <div className="hint" style={{marginTop:8, color:'#b45309'}}>
          {(s.themesWarnings||[]).filter(w=>!/blank line/i.test(w)).map((w,i)=><div key={i}>{w}</div>)}
        </div>
      )}
      {interviewsTotal>0 && (
        <div style={{marginTop:16, maxWidth:960, marginLeft:'auto', marginRight:'auto', padding:'0 4px'}}>
          <div style={{display:'flex', flexWrap:'wrap', gap:'14px 24px', fontSize:12, marginBottom:12}}>
            <div><strong>Interviews pasted:</strong> {interviewsTotal}</div>
            <div><strong>Interviews with clear themes:</strong> {interviewsWithThemes} of {interviewsTotal}</div>
            <div style={{display:'flex', alignItems:'center', gap:6}}><strong>Top themes:</strong> {topThemes.length===0? <span style={{color:'#888'}}>—</span>: topThemes.map(t=> <span key={t} className="chip" style={{background:coreColors[t], color:'#fff', border:'none', fontSize:11}}>{t}</span>)}</div>
            <div style={{display:'flex', alignItems:'center', gap:6}}><strong>Problem Statement themes:</strong> {psChips.length===0? <span style={{color:'#888'}}>—</span>: psChips.map(t=> <span key={t} className="chip" style={{background:'#fff', color:coreColors[t], border:`1px solid ${coreColors[t]}`, fontSize:11}}>{t}</span>)}</div>
          </div>
          <div ref={chartRef} key={dataVersion} id="themes-chart" className="themes-chart card" style={{padding:'14px 16px'}}>
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:12}}>
              <h3 style={{margin:0, fontSize:14}}>How often each theme appears across your interviews</h3>
              <button className="btn" style={{fontSize:11, padding:'4px 8px'}} onClick={()=>setSortAZ(v=>!v)}>{sortAZ ? 'Sort: Count' : 'Sort: A–Z'}</button>
            </div>
            <BarList
              key={dataVersion}
              data={barData}
              total={interviewsTotal}
              colors={coreColors}
              animate={animateBars && !prefersReducedMotion}
              onArmAnimation={()=>{
                // double RAF to ensure initial 0% paint
                setAnimateBars(false);
                let r1:number; let r2:number;
                r1 = requestAnimationFrame(()=>{ r2 = requestAnimationFrame(()=> setAnimateBars(true)); });
                return ()=>{ cancelAnimationFrame(r1); cancelAnimationFrame(r2); };
              }}
            />
            {showEarlyHint && <div className="hint" style={{marginTop:12, fontSize:12}}>Early read — consider adding 2–3 more interviews for a stronger cluster.</div>}
            <ThemeGuide colors={coreColors} />
          </div>
        </div>
      )}
      {interviewsWithThemes<1 && interviewsTotal>0 && <div className="hint" style={{marginTop:12, fontSize:12}}>Add a blank line between interviews and try again.</div>}
    </section>
  );
}

function ThemeGuide({ colors }:{ colors:Record<string,string> }){
  const [open,setOpen]=useState(false);
  const guide: Array<[string,string]> = [
    ['cost','money out (price, fees)'],
    ['time','waiting or speed'],
    ['effort','hassle or coordination'],
    ['quality','results or safety'],
    ['reliability','consistent over time'],
    ['trust','credibility, privacy/safety'],
    ['flexibility','adapts to needs/schedule'],
    ['choice','options and availability'],
    ['information','findability & clarity'],
    ['access','eligibility or coverage'],
    ['support','human help when stuck'],
    ['risk','lock-in/penalties (explicit)'],
    ['value','“worth it / renew / cancel”'],
  ];
  return (
    <div style={{marginTop:16}}>
      <button className="btn" style={{fontSize:12, padding:'4px 8px'}} onClick={()=>setOpen(o=>!o)}>{open? 'Hide Theme guide':'Theme guide'}</button>
      {open && (
        <div style={{marginTop:12, display:'grid', gap:8, gridTemplateColumns:'repeat(auto-fit, minmax(210px, 1fr))'}}>
          {guide.map(([core,label])=> (
            <div key={core} style={{display:'flex', alignItems:'center', gap:8, fontSize:12}}>
              <span className="chip" style={{background:colors[core], color:'#fff', border:'none', fontSize:11}}>{core}</span>
              <span style={{color:'#444'}}>{label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Reduced motion hook
function usePrefersReducedMotion(){
  const [reduce,setReduce] = useState(false);
  useEffect(()=>{
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = () => setReduce(mq.matches);
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  },[]);
  return reduce;
}

interface BarListProps { data: [string, number][]; total:number; colors:Record<string,string>; animate:boolean; onArmAnimation:()=>void }
function BarList({ data, total, colors, animate, onArmAnimation }: BarListProps){
  const [armed, setArmed] = useState(false);
  useEffect(()=>{ onArmAnimation(); setArmed(true); /* eslint-disable-next-line react-hooks/exhaustive-deps */ },[]);
  return (
    <div style={{marginTop:12, display:'flex', flexDirection:'column', gap:8}}>
      {data.map(([core,count], i)=>{
        const pct = total ? (count/total) : 0;
        const target = (pct*100);
        return (
          <div key={core} style={{display:'flex', alignItems:'center', gap:8}}>
            <div style={{width:92, fontSize:11, textTransform:'uppercase', letterSpacing:0.5}}>{core}</div>
            <div style={{flex:1, background:'#f1f5f9', borderRadius:4, position:'relative', height:20, overflow:'hidden'}}>
              <div
                className="bar"
                data-animate={animate? 'true':'false'}
                style={{
                  position:'absolute', left:0, top:0, bottom:0, borderRadius:4,
                  background:colors[core],
                  width: animate ? target+'%' : '0%',
                  transitionProperty:'width,opacity',
                  transitionTimingFunction:'ease-out',
                  transitionDuration:'600ms',
                  transitionDelay: animate ? `${i*60}ms` : '0ms',
                  opacity: animate ? 1 : .4
                }}
              />
              <span
                className="bar-count"
                style={{
                  position:'absolute', right:6, top:0, bottom:0, display:'flex', alignItems:'center', fontSize:12, fontWeight:600,
                  color: count>0 ? '#111':'#666',
                  opacity: animate ? 1 : 0,
                  transition:'opacity 300ms ease-out',
                  transitionDelay: animate ? `${i*60+200}ms` : '0ms'
                }}
              >{count}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}