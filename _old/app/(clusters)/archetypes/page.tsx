"use client";

import { useMemo, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import type { Summary, PatternCard } from '../lib/types';
import { canonicalTag } from '../lib/canonical';

const MAX_FAMILIES = 8;  // overlap+emergent unique theme families
const MAX_PERSONAS  = 6; // max cards
const MIN_ALIGNED   = 6; // total aligned quotes across cards

function LoaderDots(){
  const dot: React.CSSProperties = { width:10, height:10, borderRadius:999, background:'#2563eb', animation:'pulse 1.2s infinite ease-in-out' };
  const d2: React.CSSProperties = { ...dot, animationDelay: '.2s' };
  const d3: React.CSSProperties = { ...dot, animationDelay: '.4s' };
  return (<><span style={dot}/><span style={d2}/><span style={d3}/><style>{`@keyframes pulse{0%,80%,100%{opacity:.25}40%{opacity:1}}`}</style></>);
}

// Button component removed (using raw <button> for Generate to simplify props and avoid lint warnings)

/** Theme-family equivalence for alignment/counting (keep in sync with server) */
function equivKey(t:string){
  const x = (t||'').toLowerCase().replace(/[^a-z0-9_]/g,'');
  if (['trustworthy_care','trust_issues','safety_concerns','privacy_concerns'].includes(x)) return 'trustworthy_care';
  if ([
    'rising_costs','price_sensitivity','financial_burden','affordability_challenge',
    'affordability_concerns','cost_barrier','too_expensive','cost_pressure'
  ].includes(x)) return 'rising_costs';
  if ([
    'coordination_challenge','scheduling_frustration','logistics_management',
    'scheduling_complexity','setup_complexity'
  ].includes(x)) return 'coordination_challenge';
  if (['option_overload','overwhelming_options','decision_fatigue','decision_challenge','decision_friction'].includes(x)) return 'option_overload';
  if (['info_fragmentation','content_fragmentation','information_fragmentation'].includes(x)) return 'info_fragmentation';
  if (['research_time_cost','information_overload','compare_time','research_burden'].includes(x)) return 'research_time_cost';
  return x;
}

export default function ArchetypesPage(){
  const s = useAppStore();
  const set = useAppStore.setState;

  const [notesLocal, setNotesLocal] = useState(s.notes || '');
  const [showJtbd, setShowJtbd] = useState(false);

  const canGenerate = s.psTags.length>0 && notesLocal.trim().length>0 && !s.busyArch;

  const anchors = useMemo(()=> s.psTags.map(p=>p.tag), [s.psTags]);
  const anchorFamilies = useMemo(()=> new Set(anchors.map(equivKey)), [anchors]);

  const handleGenerate = async ()=>{
    set({ notes: notesLocal }); // persist notes
    await s.generateArchetypes();
  };

  // Build evidence map and aligned counts using equivalence families
  const evidenceAll = useMemo(()=>(s.archetypes||[]).flatMap(a => a.evidence || [] as { id:string; text:string; primary_tag:string; approved?:boolean; tags?: string[] }[]), [s.archetypes]);

  // Fallback summary if server omitted it
  const fallbackSummary: Summary = useMemo(()=>{
    const cover = new Map<string,number>();
    const emerg = new Map<string,number>();
    for (const e of evidenceAll){
      const fams = Array.from(new Set([...(e.tags||[]), e.primary_tag].filter(Boolean).map(equivKey)));
      for (const fam of fams){
        if (!fam) continue;
        if (anchorFamilies.has(fam)) cover.set(fam, (cover.get(fam)||0)+1);
        else emerg.set(fam, (emerg.get(fam)||0)+1);
      }
    }
    const toArr = (m:Map<string,number>) =>
      Array.from(m.entries()).sort((a,b)=> b[1]-a[1] || a[0].localeCompare(b[0]))
        .map(([tag,count])=>({ tag, count }));
    return { anchor_coverage: toArr(cover), top_emergents: toArr(emerg).slice(0,6) };
  }, [evidenceAll, anchorFamilies]);

  const summary: Summary = s.summary || fallbackSummary;
  const emergent = s.emergent || null;

  // quick match/mismatch read
  const matchHint = useMemo(()=> {
    const cov = (summary.anchor_coverage||[]).reduce((n:number,x:{tag:string;count:number})=>n+x.count,0);
    const emg = (summary.top_emergents||[]).reduce((n:number,x:{tag:string;count:number})=>n+x.count,0);
    const total = cov + emg;
    if (total === 0) return null;
    const pct = Math.round((cov/total)*100);
  const gaps = anchors.filter(a => !(summary.anchor_coverage||[]).some((x:{tag:string;count:number})=>x.tag===equivKey(a)));
    if (pct >= 60 && gaps.length===0) return `Most evidence supports your anchors (${pct}%).`;
    if (pct < 30 || gaps.length>=2) return `Evidence weakly supports anchors (${pct}%). Consider narrowing or revising anchors (${gaps.join(', ')} lack hits).`;
    return `Mixed support for anchors (${pct}%). Some emergent themes matter too.`;
  }, [summary, anchors]);

  // Pattern cards with equivalence-based alignment
  const cards = useMemo(()=>{
    const anchorCards = (s.patterns||[] as PatternCard[]); // already one per anchor
    return anchorCards.map(p => {
      const members = new Set((p.member_ids||[]).map(String));
      // Align by membership only (exclusive)
      const aligned = evidenceAll.filter(e => members.has(String(e.id)));
      // de-duplicate by text+primary
      const uniq: typeof aligned = [];
      const seen = new Set<string>();
      for (const q of aligned){
        const key = `${q.primary_tag}::${q.text}`;
        if (!seen.has(key)){ seen.add(key); uniq.push(q); }
      }
      return { pattern: p, aligned: uniq };
    });
  }, [s.patterns, evidenceAll]);

  // Is there anything to show yet (post-run)?
  const hasResults =
    (summary.anchor_coverage && summary.anchor_coverage.length > 0) ||
    (summary.top_emergents && summary.top_emergents.length > 0) ||
    (s.patterns && s.patterns.length > 0) ||
    evidenceAll.length > 0;

  // NEXT soft-gating and hints
  const overlapFamilies = new Set((summary.anchor_coverage||[]).map((x:{tag:string;count:number})=>x.tag));
  const emergentFamilies = new Set((summary.top_emergents||[]).map((x:{tag:string;count:number})=>x.tag));
  const totalFamilies = overlapFamilies.size + emergentFamilies.size;
  const totalAlignedQuotes = cards.reduce((n, c) => n + c.aligned.length, 0);
  const personaCount = cards.length;
  // Only block when there is literally no aligned evidence; otherwise show hints
  const nextDisabled = hasResults ? (totalAlignedQuotes === 0) : true;
  const issues:string[] = [];
  const anchorGaps = anchors.filter(a => !(summary.anchor_coverage||[]).some((x:{tag:string;count:number})=>x.tag===equivKey(a)));
  if (totalFamilies > MAX_FAMILIES) issues.push(`Many distinct themes detected (${totalFamilies}). Consider narrowing anchors.`);
  if (personaCount > MAX_PERSONAS) issues.push(`Too many archetypes (${personaCount}). Combine closely-related profiles.`);
  if (totalAlignedQuotes < MIN_ALIGNED) issues.push(`Low evidence (${totalAlignedQuotes} aligned quotes). Paste more notes.`);
  if (anchorGaps.length > 0) issues.push(`No overlap for: ${anchorGaps.join(', ')}.`);
  const nextMsg = !hasResults
    ? 'Paste notes and click Generate to see overlap and emergent themes.'
    : nextDisabled
      ? 'No aligned evidence yet. Paste more notes (one idea per line) or refine your anchors, then Generate again.'
      : `From your interview notes, ${overlapFamilies.size} overlapping theme${overlapFamilies.size!==1?'s':''} and ${emergentFamilies.size} emergent theme${emergentFamilies.size!==1?'s':''} were identified. These will be used to analyze data quality and how themes form clusters. ${issues.length ? 'Heads-up: ' + issues.join(' ') : 'If you accept these themes, click NEXT.'}`;

  // hasResults computed above

  return (
    <section>
      <h2 style={{ marginTop:0 }}>Archetypes</h2>

  <div className="card" style={{ marginTop:12 }}>
        <label className="label">Interview notes (paste any format)</label>
        <textarea
          className="input textarea"
          value={notesLocal}
          onChange={e=>setNotesLocal(e.target.value)}
          placeholder={`Paste your interview notes in any format. We'll structure them automatically using JTBD (who/struggle/pains/workarounds/outcomes).`}
        />
        <div style={{ marginTop:10, display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
          <button className={`btn ${canGenerate ? 'btn-primary' : 'disabled'}`} disabled={!canGenerate} onClick={handleGenerate}>
            {s.busyArch ? <LoaderDots/> : 'Generate Archetypes'}
          </button>
          <button className="btn" title="Clear fields" onClick={()=>{
            set({ notes:'', patterns:[], summary:null, emergent:null, archetypes:[], error: undefined });
            setNotesLocal('');
          }}>
            <RotateCcw size={16}/> Clear fields
          </button>
          <label className="hint" style={{ display:'inline-flex', alignItems:'center', gap:6 }}>
            <input type="checkbox" checked={showJtbd} onChange={e=>setShowJtbd(e.target.checked)} />
            Show JTBD fields
          </label>
        </div>
        {s.error && <div className="error" style={{ marginTop:8 }}>{s.error}</div>}
      </div>

      {/* PS vs Observed + Overlap & Emergent */}

      {hasResults && (() => {
        const psAnchors = (s.psTags || []).map(p => canonicalTag(p.tag));
        const totalHits = (summary.anchor_coverage||[]).reduce((n,x)=>n+x.count,0) + (summary.top_emergents||[]).reduce((n,x)=>n+x.count,0);
        const coveredArr = (summary.anchor_coverage||[]).filter(x => psAnchors.map(equivKey).includes(equivKey(x.tag)));
        const coveragePct = totalHits ? Math.round((coveredArr.reduce((n,x)=>n+x.count,0) / totalHits) * 100) : 0;
        const gaps = psAnchors.filter(a => !(summary.anchor_coverage||[]).some(x => equivKey(x.tag) === equivKey(a)));
        return (
        <div className="green-box">
          {/* PS vs Observed Strip */}
          <div style={{ display:'grid', gap:6, marginBottom:8 }}>
            <div>
              <div className="hint" style={{ fontWeight:700, marginBottom:4 }}>PS anchors</div>
              <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                {psAnchors.length === 0 ? <span className="hint">—</span> : psAnchors.map((a,i)=>(<span key={`ps-${i}`} className="chip">{a}</span>))}
              </div>
            </div>
            <div>
              <div className="hint" style={{ fontWeight:700, margin:'8px 0 4px' }}>Observed anchors</div>
              <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                {(summary.anchor_coverage||[]).map((r,i)=>(
                  <span key={`obs-${i}`} className="chip">{r.tag} <span className="hint" style={{ marginLeft:4 }}>({r.count})</span></span>
                ))}
              </div>
            </div>
            <div className="hint" style={{ marginTop:6 }}>
              Match: <b>{coveragePct}%</b>{gaps.length ? <> • Gaps: {gaps.join(', ')}</> : null}
            </div>
          </div>

          <div style={{ fontWeight:800, marginBottom:6 }}>Overlap (anchors)</div>
          <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:8 }}>
            {(summary.anchor_coverage||[]).filter((r:{tag:string;count:number})=>!['snake_case','misc','unknown','general','other'].includes(r.tag)).map((r:{tag:string;count:number},i:number)=>(
              <span key={`cov-${i}`} className="chip">{r.tag} <span className="hint" style={{marginLeft:4}}>({r.count})</span></span>
            ))}
          </div>
          <div style={{ fontWeight:800, marginBottom:6 }}>Top Emergent themes</div>
          <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
            {(summary.top_emergents||[]).filter((r:{tag:string;count:number})=>!['snake_case','misc','unknown','general','other'].includes(r.tag)).map((r:{tag:string;count:number},i:number)=>(
              <span key={`em-${i}`} className="chip">{r.tag} <span className="hint" style={{marginLeft:4}}>({r.count})</span></span>
            ))}
          </div>
          {matchHint && <div className="hint" style={{ marginTop:8 }}>{matchHint}</div>}
        </div>
      )})()}

      {hasResults && (
        <div style={{ display:'flex', alignItems:'center', gap:10, marginTop:12 }}>
          <button
            className={`btn ${nextDisabled ? 'disabled' : 'btn-primary'}`}
            disabled={nextDisabled}
            onClick={()=> { if(!nextDisabled) location.href='/metrics'; }}
          >
            NEXT
          </button>
          <span className="hint" style={{ color: nextDisabled ? '#b45309' : (issues.length ? '#b45309' : '#334155') }}>
            {nextMsg}
          </span>
        </div>
      )}

      {/* Cards */}
      <div style={{ display:'grid', gap:12, gridTemplateColumns:'repeat(auto-fit, minmax(280px, 1fr))', marginTop:12 }}>
        {!s.busyArch && hasResults && totalAlignedQuotes === 0 && (
          <div className="green-box" style={{ background:'#fff7ed', borderColor:'#fed7aa', color:'#9a3412' }}>
            Not enough aligned signal yet. Paste more notes (one idea per line) or refine your anchors, then try Generate again.
          </div>
        )}

        {cards.map(({ pattern, aligned })=>{
          const title = pattern.name || 'Archetype';
          const oneLiner = pattern.one_liner ?? ''; // prefer server one-liner if present
          const tags = (pattern.likely_tags||[]).map(canonicalTag);

          return (
            <div key={pattern.id} className="card card-anchor">
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:8 }}>
                <div style={{ fontWeight:800, color:'#0f172a' }}>{title}</div>
                <span className="chip">Aligned quotes: {aligned.length}</span>
              </div>

              {oneLiner && (<div className="hint" style={{ marginTop:6 }}>{oneLiner}</div>)}

              {tags.length>0 && (
                <div style={{ marginTop:8, display:'flex', gap:6, flexWrap:'wrap' }}>
                  {tags.map((t:string,i:number)=><span key={`${pattern.id}-tag-${i}`} className="chip">{t}</span>)}
                </div>
              )}

              <details style={{ marginTop:8 }}>
                <summary>Evidence ({aligned.length})</summary>
                {aligned.length===0 ? (
                  <div className="hint" style={{ marginTop:6 }}>No aligned quotes</div>
                ) : (
                  <ul style={{ marginTop:6, paddingLeft:18 }}>
                    {aligned.map((e,i)=>(
                      <li key={`${pattern.id}-ev-${i}`} style={{ marginBottom:6 }}>
                        <span style={{ fontStyle:'italic' }}>&ldquo;{e.text}&rdquo;</span>
                        <span style={{ marginLeft:8, fontSize:12, color:'#334155' }}>({canonicalTag(e.primary_tag)})</span>
                      </li>
                    ))}
                  </ul>
                )}
              </details>

              {showJtbd && pattern.jtbd_fields && (
                <details style={{ marginTop:8 }}>
                  <summary>JTBD fields</summary>
                  <div className="hint" style={{ marginTop:6 }}>
                    {Array.isArray(pattern.jtbd_fields?.who) && pattern.jtbd_fields!.who!.length>0 && (
                      <div><b>Who</b>: {pattern.jtbd_fields!.who!.join('; ')}</div>
                    )}
                    {pattern.jtbd_fields?.context && (
                      <div style={{ marginTop:4 }}>
                        {Array.isArray(pattern.jtbd_fields.context?.role) && pattern.jtbd_fields.context!.role!.length>0 && <> <b>Role</b>: {pattern.jtbd_fields.context!.role!.join('; ')} </>}
                        {Array.isArray(pattern.jtbd_fields.context?.work_pattern) && pattern.jtbd_fields.context!.work_pattern!.length>0 && <> • <b>Work pattern</b>: {pattern.jtbd_fields.context!.work_pattern!.join('; ')} </>}
                        {Array.isArray(pattern.jtbd_fields.context?.language_pref) && pattern.jtbd_fields.context!.language_pref!.length>0 && <> • <b>Language</b>: {pattern.jtbd_fields.context!.language_pref!.join('; ')} </>}
                        {Array.isArray(pattern.jtbd_fields.context?.geo) && pattern.jtbd_fields.context!.geo!.length>0 && <> • <b>Geo</b>: {pattern.jtbd_fields.context!.geo!.join('; ')} </>}
                      </div>
                    )}
                    {Array.isArray(pattern.jtbd_fields?.struggling_moments) && pattern.jtbd_fields!.struggling_moments!.length>0 && (
                      <div style={{ marginTop:6 }}><b>Struggling moment</b>: {pattern.jtbd_fields!.struggling_moments!.join(' | ')}</div>
                    )}
                    {(['jobs','workarounds','selection_criteria','anxieties','outcomes'] as const).map((k)=>{
                      const list = pattern.jtbd_fields?.[k] as string[] | undefined;
                      return Array.isArray(list) && list.length>0 ? (
                        <div key={k} style={{ marginTop:6 }}>
                          <b>{k.replace('_',' ')}</b>:
                          <ul style={{ margin:'4px 0 0', paddingLeft:18 }}>
                            {list.map((s:string, i:number)=> <li key={i}>{s}</li>)}
                          </ul>
                        </div>
                      ) : null;
                    })}
                  </div>
                </details>
              )}

              {/* per-card hint removed */}
            </div>
          );
        })}

        {/* Emerging trends (discovery) → Emerging trends & opportunities */}
        {emergent && (emergent.paragraph || (emergent.bullets||[]).length > 0) && (
          <div className="card card-emergent" style={{ marginTop:12 }}>
            <div style={{ fontWeight:800, marginBottom:6 }}>Emerging trends &amp; opportunities</div>
            {emergent.paragraph && (
              <div className="hint" style={{ color:'#7c2d12', marginBottom:8 }}>{emergent.paragraph}</div>
            )}
            {Array.isArray(emergent.bullets) && emergent.bullets.length > 0 && (
              <ul style={{ margin:0, paddingLeft:18 }}>
                {emergent.bullets.map((b, i:number)=> (
                  <li key={i} style={{ marginBottom:4 }}>
                    <span style={{ fontWeight:600 }}>{String(b.facet || '').replace(/_/g,' ')}</span>: {String(b.explanation || '')}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
