"use client";
import React, { useRef, useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
// lightweight clsx replacement (avoid adding dependency)
function cx(...args:any[]){
  const out:string[] = [];
  for (const a of args){
    if(!a) continue;
    if (typeof a === 'string'){ out.push(a); continue; }
    if (typeof a === 'object'){
      for (const k in a){ if(a[k]) out.push(k); }
    }
  }
  return out.join(' ');
}
import styles from './clusters.module.css';
import { useAppStore } from '../store/useAppStore';
import LoaderDots from '../components/LoaderDots';
import { CORE_COLORS } from '../lib/coreColors';
import CoreChip from '../components/CoreChip';
import RingsView from './RingsView';
const CORES = Object.keys(CORE_COLORS);

const CORE_TO_PHRASE: Record<string,string> = {
  cost: 'affordability or price',
  time: 'speed or waiting time',
  effort: 'hassle or coordination',
  quality: 'content or service quality',
  reliability: 'consistency or continuity',
  trust: 'confidence, safety, or privacy',
  flexibility: 'scheduling or adaptability',
  choice: 'availability of options',
  information: 'finding, clarity, or discovery',
  access: 'eligibility, language, or coverage',
  support: 'human help when stuck',
  risk: 'lock-in, penalties, or compliance',
  value: 'sense of worth or renewal decision'
};

interface ClusterResCluster {
  id: number;
  size: number;
  centroid: Record<string, number>;
  top_dims: string[];
  ps_match?: number;
  representatives?: string[];
}

interface ClustersResponse {
  k_selected: number;
  clusters: ClusterResCluster[];
  assignments: Array<{ id: string; cluster: number }>;
  ps_themes: string[];
  silhouette: number;
  fit: string;
}

/* ================= Main Page Component ================= */
export default function Page(){
  const store = useAppStore();
  const { error, notes, profilesMatrix, profiles, interviewMatrix: storeInterviewMatrix } = store as any;
  const interviewsCount = (notes||'').split(/\n+/).filter((l:string)=> l.trim()).length;
  // Local frozen clusters result; single source for current run
  const [clustersRes, setClustersRes] = useState<ClustersResponse | null>(null);
  const res: ClustersResponse | null = clustersRes;
  // Use the original profilesMatrix (id -> raw weights) for Rings frequency & other derived views
  const matrix: Array<[string, Record<string, number>]> = Array.isArray(profilesMatrix) ? profilesMatrix : [];
  // Problem Statement snapshot: prefer store if present, else fallback to localStorage snapshot
  const psSnapshot = useAppStore(s => (s as any).psSnapshot);
  const [psSnapshotThemesLS, setPsSnapshotThemesLS] = useState<string[]>([]);
  useEffect(()=>{
    try {
      const raw = typeof window !== 'undefined' ? localStorage.getItem('psSnapshot') : null;
      if (raw){
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed?.themes)) {
          setPsSnapshotThemesLS(parsed.themes.map((t:any)=> String(t).toLowerCase()).filter(Boolean));
        }
      }
    } catch{}
  },[]);
  const psThemes = useMemo(()=> {
    const themes = (psSnapshot?.themes && psSnapshot.themes.length) ? psSnapshot.themes : psSnapshotThemesLS;
    return (themes || []).map((t:string)=> String(t).toLowerCase()).filter(Boolean);
  }, [psSnapshot, psSnapshotThemesLS]);
  const reducedMotion = useReducedMotion();
  // Selected visualization (graph | rings)
  const [isRunning, setIsRunning] = useState(false);
  const [hasResults, setHasResults] = useState(false); // always start empty
  const [selectedView, setSelectedView] = useState<'Graph'|'Rings'>('Graph');
  const [clustersRunId, setClustersRunId] = useState<number|null>(null);
  const [matrixAtRun, setMatrixAtRun] = useState<Array<[string, Record<string, number>]>>([]); // snapshot of matrix at run for Rings
  const [statusMsg, setStatusMsg] = useState<{ kind:'info'|'error'; text:string }|null>(null);
  const toast = {
    info: (t:string)=> setStatusMsg({ kind:'info', text:t }),
    error: (t:string)=> setStatusMsg({ kind:'error', text:t })
  };
  const actionsRef = useRef<HTMLDivElement|null>(null);
  const resultsRef = useRef<HTMLDivElement|null>(null);
  const router = useRouter();
  // No auto-run effect; page always starts empty
  const [gridReady, setGridReady] = useState(false);
  const [gridLoading, setGridLoading] = useState(false);
  // (busyQC retained if other UI wants it; we rely on local isRunning to gate buttons)
  const contentRef = useRef<HTMLDivElement|null>(null);
  const decoratedClusters = useMemo(()=>{
    if(!res) return [] as any[];
    return res.clusters.map(c=> ({...c, _barThemes: c.top_dims.slice(0,3)}));
  },[res]);
  const silhouette = res?.silhouette || 0;
  const fit = res?.fit || '-';
  const bestCluster = decoratedClusters[0];
  const bestPct = bestCluster ? Math.round((bestCluster.ps_match||0)*100) : 0;
  const thinInterviews = 0; // placeholder; thin detection removed previously
  const earlyHint = interviewsCount < 8;

  const interviewMatrix: Array<[string, Record<string, number>]> = Array.isArray(storeInterviewMatrix) && storeInterviewMatrix.length
    ? storeInterviewMatrix
    : (Array.isArray(profilesMatrix) ? profilesMatrix : []);
  const canRun = Array.isArray(interviewMatrix) && interviewMatrix.length > 0 && !isRunning;
  const toggleDisabled = !hasResults || isRunning; // disabled until first results exist or running

  // (Removed duplicate ref declarations)

  // Toggle component reused in setup and results control bar
  function SegmentedToggle({ options, value, onChange, disabled, compact }:{ options:string[]; value:string; onChange:(v:any)=>void; disabled?:boolean; compact?:boolean }){
    return (
      <div aria-label="Select clusters view" style={{display:'inline-flex', border:'1px solid #e2e8f0', borderRadius:6, overflow:'hidden', background: disabled ? '#f8fafc' : '#fff', opacity: disabled ? .6 : 1}}>
        {options.map(opt=>{
          const mode = opt.toLowerCase();
          const selected = value.toLowerCase() === mode;
          return (
            <button
              key={opt}
              type="button"
              disabled={disabled}
                onClick={(e)=>{ e.preventDefault(); if(disabled || selected) return; setSelectedView(opt as 'Graph'|'Rings'); }}
              className="btn"
              style={{
                borderRadius:0,
                border:'none',
                background: disabled ? '#f1f5f9' : selected ? '#2563eb' : '#fff',
                color: disabled ? '#94a3b8' : selected ? '#fff' : '#334155',
                fontSize:13,
                padding: compact ? '4px 12px' : '6px 16px',
                cursor: disabled ? 'default':'pointer',
                display:'flex', alignItems:'center', gap:6,
                minWidth:64
              }}
            >
                {opt}
            </button>
          );
        })}
      </div>
    );
  }
  const onFormClusters = async () => {
    if (isRunning) return;
    if (!Array.isArray(interviewMatrix) || interviewMatrix.length === 0){
      toast.info('Paste interviews and Extract Themes first.');
      return;
    }
  // Use store snapshot themes (already lowercased via psThemes memo); allow empty array (server marks ps_vector_empty)
    setIsRunning(true);
    try {
      // 1) freeze matrix for this run
      const snap: Array<[string, Record<string, number>]> = interviewMatrix.map(([id,w]:any)=> [String(id), { ...(w||{}) }]);
      setMatrixAtRun(snap);
      // 2) call clusters endpoint with JSON headers
  const payload = { matrix: interviewMatrix, ps_themes: psThemes };
      const resp = await fetch('/api/clusters', { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify(payload) });
      if (!resp.ok){ toast.error(`Clusters failed (${resp.status})`); return; }
    const json = await resp.json();
      if (!json || !Array.isArray(json.clusters)){ toast.error('Clusters response malformed.'); return; }
      if (json.clusters.length === 0){ toast.info('No clusters formed (small-N guard). Add more interviews.'); return; }
  if (json.note === 'ps_vector_empty' && psThemes.length === 0){ toast.info('Problem Statement themes were empty; match % unavailable this run.'); }
      setClustersRes(json);
    try { useAppStore.setState({ clustersRes: json }); } catch {}
      setClustersRunId(Date.now());
      setHasResults(true);
      setSelectedView('Graph');
    } catch(e:any){
      toast.error(e?.message || 'Clusters request failed.');
    } finally {
      setIsRunning(false);
    }
  };

  function handleClearClusters(){
    setClustersRes(null);
    setMatrixAtRun([]);
    setClustersRunId(null);
    setHasResults(false);
    setSelectedView('Graph');
    actionsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  return (
    <section style={{display:'flex', flexDirection:'column', gap:16}}>
      <h1 className="page-title" style={{marginTop:0}}>Clusters</h1>
      <div className={styles.setupCard}>
        <div className={styles.noteWrap}>
          <strong>Form clusters to compare customer themes</strong><br/>
          <em>Graph</em>: groups interviews & ranks alignment.<br/>
          <em>Rings</em>: frequency of each core theme.
        </div>
        <div className={cx(styles.actionsRow, styles.scrollAnchor)} ref={actionsRef}>
          {/* 1) Form Clusters */}
          <button
            type="button"
            className="btn btn-primary"
            disabled={isRunning || !canRun}
            onClick={onFormClusters}
          >
            {isRunning ? <LoaderDots /> : 'Form Clusters'}
          </button>
          {/* 2) Toggle */}
          <SegmentedToggle
            options={['Graph','Rings']}
            value={selectedView}
            onChange={setSelectedView}
            disabled={!hasResults || isRunning}
            compact
          />
          {/* 3) Next (skip metrics, go straight to insights) */}
          <button
            type="button"
            className="btn btn-primary"
            disabled={!hasResults || isRunning}
            onClick={() => router.push('/insights')}
          >
            Next
          </button>
          {/* 4) Clear */}
          <button
            type="button"
            className="btn"
            disabled={isRunning}
            onClick={handleClearClusters}
          >
            Clear
          </button>
          {!profiles?.length && <span style={{fontSize:11, color:'#64748b'}}>Generate profiles first.</span>}
          {statusMsg && <span style={{fontSize:11, color: statusMsg.kind==='error' ? '#b91c1c' : '#475569'}}>{statusMsg.text}</span>}
          {error && <span style={{fontSize:11, color:'#b91c1c'}}>{error}</span>}
        </div>
      </div>
      <div ref={resultsRef} className={styles.resultsWrap}>
        {hasResults && selectedView === 'Graph' && res && (
          <GraphCards clusters={decoratedClusters} assignments={res?.assignments||[]} psThemes={psThemes} matrix={matrixAtRun.length ? matrixAtRun : matrix} />
        )}
        {hasResults && selectedView === 'Rings' && (
          <div className={styles.ringsWrap}>
            <div className={styles.ringCanvas}>
              <RingsView matrixAtRun={matrixAtRun} clustersRunId={clustersRunId} />
            </div>
            <div className={styles.ringPanel}>
              <FindingsPanel matrixAtRun={matrixAtRun} />
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

// StatsStrip removed in results mode per revised spec (kept here commented if needed)
// function StatsStrip(){ return null; }

function letterFor(idx:number){ return String.fromCharCode('A'.charCodeAt(0) + idx); }

/* ===== Findings Panel for Rings (static legend + counts) ===== */
function FindingsPanel({ matrixAtRun }:{ matrixAtRun: Array<[string, Record<string, number>]> }){
  const N = matrixAtRun.length;
  const counts: Record<string, number> = useMemo(()=>{
    const base: Record<string, number> = Object.fromEntries(CORES.map(c=>[c,0]));
    for (const [,w] of matrixAtRun){ for (const c of CORES){ if ((w?.[c]||0)>0) base[c]++; } }
    return base;
  },[matrixAtRun]);
  const ranked = useMemo(()=> [...CORES].sort((a,b)=> counts[b]-counts[a] || a.localeCompare(b)),[counts]);
  const top = ranked[0];
  const topPct = top? Math.round((counts[top]/(N||1))*100):0;
  return (
    <div style={{display:'flex', flexDirection:'column', gap:12}}>
      <div style={{fontSize:12, fontWeight:600, letterSpacing:.5, textTransform:'uppercase', color:'#475569'}}>Rings (theme frequency)</div>
      {N>0 && top && (
        <div style={{fontSize:14, fontWeight:500, color:'#1e293b'}}>
          Most frequent theme: <strong style={{textTransform:'uppercase'}}>{top}</strong> <span style={{fontWeight:400}}>({counts[top]} of {N}, {topPct}%)</span>
        </div>
      )}
      {N===0 && <div style={{fontSize:12, color:'#64748b'}}>Form clusters to view frequency distribution.</div>}
      {N>0 && (
        <div style={{display:'flex', flexWrap:'wrap', gap:6}}>
          {ranked.map(core=>{
            const pct = Math.round((counts[core]/N)*100);
            return (
              <span key={core} style={{display:'inline-flex', alignItems:'center', gap:4, fontSize:11, padding:'4px 8px', border:'1px solid #e2e8f0', borderRadius:4}}>
                <span style={{width:10, height:10, background:CORE_COLORS[core], borderRadius:2}} />
                <span style={{textTransform:'uppercase'}}>{core}</span>
                <span style={{color:'#475569'}}>{pct}%</span>
              </span>
            );
          })}
        </div>
      )}
      {N>0 && (
        <div style={{fontSize:11, color:'#475569'}}>Each ring stroke encodes share of interviews containing that theme (presence &gt; 0).</div>
      )}
    </div>
  );
}

interface CardProps { cluster: any; index:number; assignments:Array<{id:string; cluster:number}>; matrix: Array<[string, Record<string, number>]>; psThemes:string[]; animate?: boolean }
function ClusterCard({ cluster, index, assignments, matrix, psThemes, animate }: CardProps){
  const members = assignments.filter(a=> a.cluster === cluster.id).map(a=> a.id);
  const barThemes: string[] = cluster._barThemes || [];
  // Client fallback for ps_match if server value missing (e.g., older cached response without ps_themes)
  function cosineClientFallback(centroid: Record<string, number>, psThemesLocal: string[]): number {
    if (!psThemesLocal.length) return 0;
    const cores = ['cost','time','effort','quality','reliability','trust','flexibility','choice','information','access','support','risk','value'];
    const a:number[] = cores.map(k => Number(centroid[k] || 0));
    const b:number[] = cores.map(k => psThemesLocal.includes(k) ? 1 : 0);
    const dot = a.reduce((s,v,i)=> s + v*b[i], 0);
    const na = Math.sqrt(a.reduce((s,v)=> s + v*v, 0)) || 1;
    const nb = Math.sqrt(b.reduce((s,v)=> s + v*v, 0)) || 1;
    if (nb === 0) return 0;
    return dot / (na*nb || 1);
  }
  const serverMatch = typeof cluster.ps_match === 'number' ? cluster.ps_match : 0;
  const clientMatch = cosineClientFallback(cluster.centroid || {}, psThemes || []);
  const effectiveMatch = psThemes.length ? (serverMatch > 0 ? serverMatch : clientMatch) : 0;
  // Build bars (top centroid cores already selected)
  const bars = barThemes.map((core,i) => {
    const value = Number(cluster.centroid[core]||0);
    let presence = 0;
    members.forEach(id=>{
      const rec = matrix.find(r=> r[0]===id)?.[1];
      if (rec && Number(rec[core]||0)>0) presence++;
    });
    return <MiniBar key={core} core={core} value={value} color={CORE_COLORS[core]} presence={presence} size={members.length} animate={animate} delay={i*80} />;
  });
  const ps_match_pct = Math.round(effectiveMatch*100);
  // Summary (non-typewriter; fade-in only)
  function alignmentWord(m:number){ if(m>=0.70) return 'strongly aligns with'; if(m>=0.40) return 'partially aligns with'; return 'weakly aligns with'; }
  const phrases = barThemes.map(c=> CORE_TO_PHRASE[c] || c).filter(Boolean);
  let summary = '';
  if (phrases[0]){
    summary += 'This cluster represents customers whose main concern is ' + phrases[0];
    if (phrases[1]){
      summary += ' often paired with ' + phrases[1];
      if (phrases[2]) summary += ' and ' + phrases[2];
    }
    summary += '. ';
  }
  summary += 'It ' + alignmentWord(effectiveMatch) + ' your Problem Statement.';
  const [showSummary, setShowSummary] = useState(false);
  useEffect(()=>{
    const prefersReduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
    if (prefersReduced || !animate){ setShowSummary(true); return; }
    const t = setTimeout(()=> setShowSummary(true), 30 + index*40); // small stagger
    return ()=> clearTimeout(t);
  },[animate,index]);
  // Overlap & Emergent Themes chips
  const overlap = barThemes.filter(c=> psThemes.includes(c));
  const emergentCandidates = CORES
    .map(core=> ({ core, val:Number(cluster.centroid[core]||0) }))
    .filter(o=> o.val>0 && !psThemes.includes(o.core))
    .sort((a,b)=> b.val - a.val || a.core.localeCompare(b.core))
    .map(o=>o.core);
  const emergent = emergentCandidates.slice(0,2);
  return (
    <div className="card" data-cluster-card style={{padding:'14px 16px'}}>
      <h3 style={{margin:'0 0 8px', fontSize:15}}>
        Cluster {letterFor(index)} — {ps_match_pct}% match to Problem Statement — <span style={{fontWeight:400}}>Group size: {members.length} of {assignments.length ? new Set(assignments.map(a=>a.id)).size : members.length} ({assignments.length ? Math.round((members.length / new Set(assignments.map(a=>a.id)).size)*100) : 100}%)</span>
      </h3>
      <div style={{display:'flex', flexDirection:'column', gap:10}}>
        <div style={{display:'flex', flexDirection:'column', gap:6}}>{bars}</div>
  <p className={cx(styles.summaryText, showSummary && styles.fadeIn)} style={{fontSize:12, lineHeight:1.45, color:'#334155', minHeight:32, margin:0}}>{summary}</p>
        {overlap.length>0 && (
          <div style={{display:'flex', flexWrap:'wrap', gap:6}}>
            <span style={{fontSize:11, color:'#475569'}}>Overlap:</span>
            {overlap.map(c=> <CoreChip key={c} core={c} variant="filled" size="sm" />)}
          </div>
        )}
        {emergent.length>0 && (
          <div style={{display:'flex', flexWrap:'wrap', gap:6}}>
            <span style={{fontSize:11, color:'#475569'}}>Emergent Themes:</span>
            {emergent.map(c=> <CoreChip key={c} core={c} variant="outline" size="sm" />)}
          </div>
        )}
        {cluster.representatives && cluster.representatives.length>0 && (
          <div style={{fontSize:12}}><strong>Representatives:</strong> {cluster.representatives.join(', ')}</div>
        )}
      </div>
    </div>
  );
}

// (Differs helper removed per new summary requirements)

function MiniBar({ core, value, color, presence, size, animate, delay }:{ core:string; value:number; color:string; presence:number; size:number; animate?:boolean; delay?:number }){
  const label = value.toFixed(2);
  const pct = Math.min(1, value);
  const [mounted, setMounted] = useState(!animate);
  useEffect(()=>{ if(!animate) return; const t = setTimeout(()=> setMounted(true), (delay||0)+50); return ()=> clearTimeout(t); },[animate, delay]);
  return (
    <div style={{display:'flex', alignItems:'center', gap:8}}>
      <div style={{width:80, fontSize:11, textTransform:'uppercase'}}>{core}</div>
      <div style={{flex:1, background:'#f1f5f9', borderRadius:4, height:18, position:'relative', overflow:'hidden'}}>
  <div style={{position:'absolute', left:0, top:0, bottom:0, width: mounted? `${(pct*100).toFixed(0)}%` : 0, background:color, borderRadius:4, transitionProperty: animate ? 'width' : 'none', transitionDuration: animate ? '600ms' : '0ms', transitionTimingFunction: animate ? 'ease' : 'linear', transitionDelay: animate? `${delay||0}ms` : '0ms'}} />
        <div style={{position:'absolute', right:6, top:0, bottom:0, display:'flex', alignItems:'center', fontSize:11, fontWeight:600}}>{label}</div>
      </div>
      <div style={{width:56, fontSize:11, textAlign:'right'}}>{presence} of {size}</div>
    </div>
  );
}

/* ================= Heatmap Component ================= */
function Heatmap({ clusters, onMeasured, loadingFlag, hasRun }:{ clusters:any[]; onMeasured?:()=>void; loadingFlag?:boolean; hasRun?:boolean }){
  const ROW_H = 40; // consistent row height
  const GUTTER = 16; // inner padding allowance for measurement subtraction
  const PADDING_X = 32; // card horizontal padding total
  const colCount = clusters.length;
  const rowLabels = CORES;
  const cardRef = useRef<HTMLDivElement|null>(null);
  const labelsRef = useRef<HTMLDivElement|null>(null);
  const headerScrollRef = useRef<HTMLDivElement|null>(null);
  const gridScrollRef = useRef<HTMLDivElement|null>(null);
  const [geom, setGeom] = useState({ containerW:0, labelW:0, colW:72 });
  const prev = useRef(geom);
  const measured = useRef(false);
  const reduced = useReducedMotion();

  useEffect(()=>{
    if(!cardRef.current || !labelsRef.current) return;
    const ro = new ResizeObserver(()=>{
      if(!cardRef.current || !labelsRef.current) return;
      const containerW = Math.floor(cardRef.current.clientWidth || 0);
      const labelW = Math.floor(labelsRef.current.getBoundingClientRect().width || 0);
      const isMobile = typeof window !== 'undefined' ? window.matchMedia('(max-width:640px)').matches : false;
      const MAX_VISIBLE_COLS = isMobile ? 3 : 4;
      const visibleCols = Math.min(colCount, MAX_VISIBLE_COLS);
      const avail = Math.max(0, containerW - labelW - PADDING_X - GUTTER);
      const colW = Math.max(56, Math.floor(avail / Math.max(1, visibleCols)));
      const changed = containerW !== prev.current.containerW || labelW !== prev.current.labelW || colW !== prev.current.colW;
      if(changed){
        const next = { containerW, labelW, colW };
        prev.current = next;
        setGeom(next);
      }
    });
    ro.observe(cardRef.current);
    ro.observe(labelsRef.current);
    return ()=> ro.disconnect();
  },[colCount]);

  useEffect(()=>{
    if(!measured.current && geom.containerW>0){ measured.current = true; onMeasured && onMeasured(); }
  },[geom.containerW,onMeasured]);

  // Sync horizontal scroll
  useEffect(()=>{
    const h = headerScrollRef.current; const g = gridScrollRef.current; if(!h||!g) return;
    const onH = ()=> { g.scrollLeft = h.scrollLeft; };
    const onG = ()=> { h.scrollLeft = g.scrollLeft; };
    h.addEventListener('scroll', onH); g.addEventListener('scroll', onG);
    return ()=> { h.removeEventListener('scroll', onH); g.removeEventListener('scroll', onG); };
  },[colCount]);

  const gridWidth = colCount * geom.colW;

  function tier(w:number){
    if (w >= 0.85) return { level:'high', alpha:0.8, dots:3 };
    if (w >= 0.6) return { level:'medium', alpha:0.5, dots:2 };
    if (w >= 0.33) return { level:'low', alpha:0.25, dots:1 };
    return null;
  }
  function hexToRgb(hex:string){
    const m = hex.replace('#','');
    const bigint = parseInt(m.length===3? m.split('').map(c=>c+c).join(''): m,16);
    const r = (bigint>>16)&255; const g=(bigint>>8)&255; const b=bigint&255; return {r,g,b};
  }

  const fadeBaseDelay = 40;

  return (
    <div ref={cardRef} className="card" style={{padding:16, overflow:'hidden'}}>
      <div style={{fontSize:12, marginBottom:8}}><strong>Theme × Cluster heatmap</strong></div>
      {!colCount && (
        <div style={{fontSize:12, color:'#64748b'}}>No clusters formed.</div>
      )}
      {colCount>0 && (
        <div style={{display:'grid', gridTemplateColumns:'auto 1fr', gridTemplateRows:'auto 1fr', gap:0}}>
          {/* Corner */}
          <div style={{height:ROW_H, lineHeight:ROW_H+'px', fontSize:11, paddingRight:8, textTransform:'uppercase', color:'#475569', position:'sticky', top:'var(--card-sticky-offset,0px)', left:0, background:'var(--card-bg,#fff)', zIndex:3}}>Core</div>
          {/* Column headers */}
          <div style={{position:'relative'}}>
            <div ref={headerScrollRef} style={{overflowX:'auto', overflowY:'hidden', position:'sticky', top:'var(--card-sticky-offset,0px)', background:'var(--card-bg,#fff)', zIndex:2}}>
              <div style={{position:'relative', width:gridWidth, height:ROW_H}}>
                {clusters.map((c,i)=> (
                  <div key={c.id} style={{position:'absolute', left:i*geom.colW, top:0, width:geom.colW, height:ROW_H, lineHeight:ROW_H+'px', textAlign:'center', fontSize:12, fontWeight:500}}>{letterFor(i)}</div>
                ))}
              </div>
            </div>
          </div>
          {/* Row labels */}
          <div ref={labelsRef} style={{display:'flex', flexDirection:'column', position:'sticky', left:0, background:'var(--card-bg,#fff)', zIndex:1}}>
            {rowLabels.map(core => (
              <div key={core} style={{height:ROW_H, lineHeight:ROW_H+'px', fontSize:11, paddingRight:8, textTransform:'uppercase'}}>{core}</div>
            ))}
          </div>
          {/* Heat grid */}
          <div className="plot-area" style={{position:'relative'}}>
            <div
              ref={gridScrollRef}
              style={{overflowX:'auto', overflowY:'hidden', maxWidth:'100%', scrollMarginTop:72, WebkitOverflowScrolling:'touch', touchAction:'pan-x'}}
            >
              <div
                style={{
                  position:'relative',
                  width:gridWidth,
                  display:'grid',
                  gridTemplateColumns:`repeat(${colCount}, ${geom.colW}px)`,
                  gridTemplateRows:`repeat(${rowLabels.length}, ${ROW_H}px)`,
                }}
              >
                {rowLabels.map((core,rIdx)=> clusters.map((c,cIdx)=>{
                  const w = Number(c.centroid[core]||0);
                  const t = tier(w);
                  const key = c.id+core;
                  const rgb = t ? hexToRgb(CORE_COLORS[core]) : null;
                  const bg = t && rgb ? `rgba(${rgb.r},${rgb.g},${rgb.b},${t.alpha})` : 'transparent';
                  const dotStr = t ? '•'.repeat(t.dots) : '';
                  const aria = t ? `Theme ${core}, Cluster ${letterFor(cIdx)}, strength ${t.level}` : undefined;
                  const delay = !reduced && hasRun ? (cIdx * fadeBaseDelay + rIdx*10) : 0;
                  return (
                    <div
                      key={key}
                      aria-label={aria}
                      style={{
                        width:geom.colW,
                        height:ROW_H,
                        boxShadow:'inset 0 0 0 1px rgba(0,0,0,0.08)',
                        background:bg,
                        position:'relative',
                        display:'flex',
                        alignItems:'center',
                        justifyContent:'center',
                        fontSize:10,
                        color:'rgba(255,255,255,0.7)',
                        fontWeight:600,
                        opacity: reduced?1:0,
                        animation: reduced? 'none': `fadeInCell 320ms ease ${delay}ms forwards`
                      }}
                    >{dotStr}</div>
                  );
                }))}
              </div>
            </div>
            <div style={{marginTop:12, fontSize:11, color:'#475569', display:'flex', alignItems:'center', gap:12}}>
              <span>fill = strength</span>
              <span style={{display:'inline-flex', alignItems:'center', gap:4}}>
                <span style={{width:16,height:16, background:'rgba(0,0,0,0.08)', display:'inline-block', position:'relative'}} />
              </span>
              <span style={{opacity:0.7}}>tiers: low / med / high</span>
            </div>
          </div>
        </div>
      )}
      <style>{`
        @keyframes fadeInCell { from { opacity:0 } to { opacity:1 } }
      `}</style>
    </div>
  );
}

// Wheel view removed per current spec; Rings supersedes it.

/* ================= Hooks & Skeletons ================= */
function useReducedMotion(){
  const [pref, setPref] = useState(false);
  useEffect(()=>{
    const m = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handler = () => setPref(m.matches);
    handler();
    m.addEventListener('change', handler);
    return ()=> m.removeEventListener('change', handler);
  },[]);
  return pref;
}

function SkeletonClusters(){
  return (
    <div style={{display:'flex', flexDirection:'column', gap:16}}>
      {Array.from({length:3}).map((_,i)=>(
        <div key={i} className="card" style={{padding:'14px 16px', opacity:0.85}}>
          <div style={{height:14, width:220, background:'#e2e8f0', borderRadius:4, marginBottom:12}} />
          <div style={{display:'flex', flexDirection:'column', gap:8}}>
            {Array.from({length:3}).map((__,j)=>(
              <div key={j} style={{display:'flex', alignItems:'center', gap:8}}>
                <div style={{width:80, height:14, background:'#f1f5f9'}} />
                <div style={{flex:1, height:18, background:'#f1f5f9', position:'relative', overflow:'hidden', borderRadius:4}}>
                  <div style={{position:'absolute', inset:0, background: 'linear-gradient(90deg,#f1f5f9, #e2e8f0, #f1f5f9)', backgroundSize:'200% 100%', animation:'shimmer 1.2s linear infinite'}} />
                </div>
                <div style={{width:56, height:14, background:'#f1f5f9'}} />
              </div>
            ))}
            <div style={{height:28, background:'#f1f5f9', borderRadius:4}} />
          </div>
        </div>
      ))}
      <style>{`@keyframes shimmer {0%{background-position:0 0}100%{background-position:-200% 0}}`}</style>
    </div>
  );
}

/* ================= Simple Wrappers for Selected Views ================= */
function GraphCards({ clusters, assignments, psThemes, matrix }:{ clusters:any[]; assignments:any[]; psThemes:string[]; matrix:Array<[string,Record<string,number>]> }){
  return (
    <div style={{display:'flex', flexDirection:'column', gap:12}}>
      {clusters.map((c,i)=> <ClusterCard key={c.id} cluster={c} index={i} assignments={assignments} matrix={matrix} psThemes={psThemes} animate />)}
    </div>
  );
}

// Deprecated inline RingsView wrapper removed (now using dedicated RingsView.tsx with snapshot prop)
