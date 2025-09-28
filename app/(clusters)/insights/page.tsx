"use client";
import { useState, useEffect, Fragment } from 'react';
import { useAppStore } from '../store/useAppStore';
import { generateActions } from '../lib/actionGenerator';
import LoaderDots from '../components/LoaderDots';
import { useTypeStream } from '../lib/useTypeStream';
import CoreChip from '../components/CoreChip';

/* =====================================================
   Simplified Generative Insights Page (Everyday Language)
   - Single narrative + Next Steps
   - Typewriter reveal
   - No badges, no evidence drawer (reserved for Pro)
   - Avoid research jargon; conversational tone
===================================================== */

export default function Page(){
  const { insights, getInsights, canSeeInsights, notes, interviewNotes } = useAppStore() as any;
  const allowed = canSeeInsights();
  const [loading, setLoading] = useState(false);
  const [started, setStarted] = useState(false); // whether user triggered generation this session
  const [fullText, setFullText] = useState('');
  const [nextSteps, setNextSteps] = useState<string[]>([]);
  const [typed, done] = useTypeStream({ text: fullText, active: started && !!fullText, speed: 80, chunk: 3 });

  async function onGen(){
    if (loading) return;
    setStarted(true);
    setFullText('');
    setNextSteps([]);
    setLoading(true);
    try {
      await getInsights();
    } finally {
      setLoading(false);
    }
  }

  // Build plain-language narrative when insights update
  useEffect(()=>{
    if(!insights) return;
    const rawNotes = (interviewNotes && interviewNotes.trim()) ? interviewNotes : (notes || '');
    const narrative = buildPlainNarrative(insights as any, rawNotes);
    setFullText(narrative.text);
    setNextSteps(buildNextSteps(insights as any, narrative));
  },[insights, interviewNotes, notes]);

  return (
    <div>
      <h2 className="page-title" style={{marginTop:0}}>Insights</h2>
      {!allowed && (
        <div className="card" style={{ marginTop:12, background:'#fff7ed', borderColor:'#fed7aa' }}>
          <div style={{ fontSize:13, fontWeight:600, marginBottom:4 }}>Clusters not ready</div>
          <div style={{ fontSize:12, lineHeight:1.45 }}>Form clusters first. Go to Clusters, run Form Clusters, then come back here.</div>
        </div>
      )}
      {allowed && (
        <div className="card" style={{marginTop:12, display:'flex', flexDirection:'column', gap:16}}>
          <div style={{fontSize:13, lineHeight:1.55, color:'#334155'}}>
            Press generate and we’ll tell the story of what you thought the problem was, what people actually talked about, and how the groups of interviews lined up with (or drifted away from) your original focus.
          </div>
          <div>
            <button
              type="button"
              onClick={onGen}
              disabled={loading}
              className="btn btn-primary"
              style={{display:'inline-flex', alignItems:'center', gap:8}}
              aria-live="polite"
            >
              {loading && <LoaderDots />}
              {loading ? 'Working…' : started ? 'Regenerate' : 'Generate Insights'}
            </button>
          </div>
          <div style={{display:'flex', flexDirection:'column', gap:24}}>
            {started && (
              <div style={{position:'relative'}}>
                <h3 style={{margin:'0 0 8px', fontSize:15}}>What We Learned</h3>
                <AnimatedParagraph text={typed} done={done} />
              </div>
            )}
            {done && nextSteps.length>0 && (
              <div>
                <h3 style={{margin:'0 0 8px', fontSize:15}}>Next Steps</h3>
                <ul style={{margin:0, paddingLeft:18, fontSize:13, lineHeight:1.55}}>
                  {nextSteps.map((s,i)=> <li key={i}>{s}</li>)}
                </ul>
              </div>
            )}
            {(done || (started && !loading && typed.length === fullText.length && fullText.length>0)) && (
              <div style={{border:'1px solid #e2e8f0', borderRadius:8, padding:14, display:'flex', flexDirection:'column', gap:10, background:'#fff'}}>
                <div style={{fontSize:13, fontWeight:600, color:'#0f172a'}}>Coming Soon: Pro</div>
                <div style={{fontSize:12, lineHeight:1.5, color:'#334155'}}>
                  Pro will help you run sharper follow‑up interviews: sector‑aware prompts, market‑specific pattern spotting, and guidance on what to probe next so you spend less time re‑asking generic questions.
                </div>
                <div style={{fontSize:12, color:'#475569'}}>Want early access when we open this up?</div>
                <div>
                  <a href="/subscribe" className="btn btn-primary" style={{fontSize:12}}>Get Early Access</a>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function AnimatedParagraph({ text, done }:{ text:string; done:boolean }){
  // Preserve double newlines as paragraph breaks; during streaming treat everything as one flowing block.
  const raw = text;
  const paragraphs = done ? raw.split(/\n\n+/) : [raw];
  function renderWithChips(p:string, idx:number){
    const parts: any[] = [];
    const regex = /\[\[(THEME|THEME_FILLED):([a-z]+)\]\]/g;
    let lastIndex = 0; let m:RegExpExecArray|null;
    while((m = regex.exec(p))){
      if(m.index > lastIndex){ parts.push(p.slice(lastIndex, m.index)); }
      const variantType = m[1];
      const theme = m[2];
      const variant = variantType === 'THEME_FILLED' ? 'filled' : 'filled'; // all filled per requirement
      parts.push(<CoreChip key={idx+'-'+parts.length} core={theme} variant={variant as any} size="sm" />);
      lastIndex = regex.lastIndex;
    }
    if(lastIndex < p.length){ parts.push(p.slice(lastIndex)); }
    return parts;
  }
  if(!done){
    return <p style={{margin:0, fontSize:13, lineHeight:1.55, whiteSpace:'pre-wrap'}}>{renderWithChips(paragraphs[0],0)}</p>;
  }
  return (
    <div style={{display:'flex', flexDirection:'column', gap:24}}>
      {paragraphs.map((p,i)=> <p key={i} style={{margin:0, fontSize:13, lineHeight:1.55}}>{renderWithChips(p,i)}</p>)}
    </div>
  );
}

// (Blink caret removed per updated spec)

/* ================= Narrative Builders ================= */
interface PlainNarrative { text:string; themesValidated:string[]; themesEmergent:string[]; themesMissing:string[]; anchor?:string; anchorQuote?:string; themeOrder:string[] }

function buildPlainNarrative(n: any, notesText: string): PlainNarrative {
  const ev = n.evidence || {};
  const interviewsCount:number = ev.interviewsCount || 0;
  const clusterArr = Array.isArray(ev.clusters) ? ev.clusters : [];
  const psThemes: string[] = ev.problemThemes || ev.psThemes || [];
  const themePresence = Array.isArray(ev.themePresence) ? ev.themePresence : [];
  const validated = (n.validatedThemes || n.validated || []).filter(Boolean);
  const gaps = (n.gaps || []).filter(Boolean);
  const emergent = (n.emergent || []).filter(Boolean);
  const early = (n.earlySignals || []).filter(Boolean);
  const stageEarly = interviewsCount < 5;

  // Scenario classification for tone modulation
  let scenario: 'earlyExploration'|'solidifying'|'reframing'|'pivotEmerging'|'mixed' = 'mixed';
  if(stageEarly) scenario = 'earlyExploration';
  else if(validated.length && !gaps.length && !emergent.length) scenario = 'solidifying';
  else if(emergent.length && validated.length <= 1) scenario = 'pivotEmerging';
  else if(gaps.length && validated.length <= gaps.length) scenario = 'reframing';

  // Prepare quotes extraction (will be used only for potential anchor)
  const quotesInventory = extractThemeQuotes({ notesText, themes: Array.from(new Set([...validated, ...gaps, ...emergent, ...early])).slice(0,12) });
  
  // Minimal secondary pattern requirements per theme (only define for the most collision-prone themes; others pass lexical only)
  const THEME_CONTEXT_REGEX: Record<string, RegExp> = {
    cost: /\b(cost|price|prices?|pay|paid|paying|pricing|bill|billed|billing|fee|fees|expensive|cheaper|cheapest|afford)\b/i,
    time: /\b(time|hours?|hour|minutes?|mins?|wait|waiting|delay|delays|faster|slow|slowly|quick|quicker|speed)\b/i,
    choice: /\b(choice|choices|option|options|pick|picked|select|selection|catalog|library|available|availability)\b/i,
    value: /\b(value|worth|return|getting|gotten|justify|justifies|justifying)\b/i
  };

  function selectAnchorQuote(anchor:string|null): string | null {
    if(!anchor) return null;
    const candidates = (quotesInventory[anchor]||[]).slice(0,5);
    if(!candidates.length) return null;
    const secondary = THEME_CONTEXT_REGEX[anchor];
    // Build competing theme list (PS themes + top emergent peers minus anchor)
    const competitors = Array.from(new Set([...psThemes, ...emergent].filter(t=> t!==anchor)));
    for(const raw of candidates){
      const line = raw.trim();
      if(!line) continue;
      // Must contain anchor as whole word
      const anchorWord = new RegExp('\\b'+anchor+'\\b','i');
      if(!anchorWord.test(line)) continue;
      // If secondary regex exists, require it (line may simply include anchor token elsewhere)
      if(secondary && !secondary.test(line)) continue;
      // Reject if an earlier competing theme appears before anchor (position heuristic)
      const lower = line.toLowerCase();
      const anchorIdx = lower.search(anchorWord);
      let conflictEarly = false;
      for(const c of competitors){
        if(!c) continue;
        const w = new RegExp('\\b'+c+'\\b','i');
        const idx = lower.search(w);
        if(idx !== -1 && idx < anchorIdx){ conflictEarly = true; break; }
      }
      if(conflictEarly) continue;
      // Length guard
      if(line.length < 18 || line.length > 160) continue;
      // Normalize punctuation (remove trailing multi-dot clutter)
      const cleaned = line
        .replace(/[“”]/g,'"')
        .replace(/([.]){3,}/g,'…')
        .replace(/\s+…/g,' …')
        .replace(/\.{2,}$/,'…')
        .replace(/([.!?])\1+/g,'$1')
        .trim();
      return cleaned;
    }
    return null; // no acceptable quote
  }

  // Helper: build theme detail string with counts & cluster letters
  function detail(themes: string[]): string {
    if(!themes.length) return '';
    const parts = themes.map(t=>{
      const rec = themePresence.find((r:any)=> r.theme===t);
      const count = rec ? Math.round((rec.interviewPct||0) * interviewsCount) : 0;
      const clustersWith = clusterArr
        .map((c:any,i:number)=> ({ has: (c.topThemes||[]).includes(t), letter: String.fromCharCode(65+i), sizePct: c.sizePct as number }))
        .filter((o:{has:boolean; letter:string; sizePct:number})=> o.has)
        .sort((a:{has:boolean; letter:string; sizePct:number}, b:{has:boolean; letter:string; sizePct:number})=> b.sizePct - a.sizePct);
      const topCluster = clustersWith[0];
      let piece = t;
      if(count>0){ piece += ` (${count}/${interviewsCount})`; }
      if(topCluster){ piece += ` mainly in Cluster ${topCluster.letter}`; }
      return piece;
    });
    return parts.join(', ');
  }

  // Identify potential new anchor & apply dominance qualification rules
  interface AnchorEval { candidate: string|null; qualified: boolean; pct: number; nextPct: number }
  function evaluateAnchor(): AnchorEval {
    if(!emergent.length) return { candidate:null, qualified:false, pct:0, nextPct:0 };
    const scored = emergent.map((t:string)=>{
      const rec = themePresence.find((r:any)=> r.theme===t);
      return { theme:t, pct: rec ? Number(rec.interviewPct||0) : 0 };
    }).sort((a:{theme:string; pct:number}, b:{theme:string; pct:number})=> b.pct - a.pct);
    const top = scored[0];
    const second = scored[1];
    if(!top) return { candidate:null, qualified:false, pct:0, nextPct:0 };
    const pct = top.pct;
    const nextPct = second ? second.pct : 0;
    // Qualify only if >=30% and either >=40% OR 8pp higher than next emergent theme
    const qualified = pct >= 0.30 && (pct >= 0.40 || (pct - nextPct) >= 0.08);
    return { candidate: top.theme, qualified, pct, nextPct };
  }
  const anchorEval = evaluateAnchor();
  let anchorCandidate: string | null = anchorEval.candidate;
  const anchorQualified = !!anchorEval.qualified && !!anchorCandidate && !psThemes.includes(anchorEval.candidate!);
  // Quote helpers
  function trimQuote(q:string): string {
    if(!q) return q;
    const max = 140;
    const raw = q.replace(/[“”]/g,'"').replace(/^\s*"|"\s*$/g,'').trim();
    if(raw.length <= max) return raw;
    const slice = raw.slice(0,max);
    const sentenceEnd = Math.max(slice.lastIndexOf('. '), slice.lastIndexOf('! '), slice.lastIndexOf('? '));
    if(sentenceEnd > 40) return slice.slice(0, sentenceEnd+1).trim() + '…';
    const comma = slice.lastIndexOf(',');
    if(comma > 60) return slice.slice(0, comma).trim() + '…';
    const space = slice.lastIndexOf(' ');
    return slice.slice(0, space).trim() + '…';
  }
  function formatQuote(q:string): string {
    const t = trimQuote(q).replace(/["']$/,'').trim();
    return t.replace(/[.?!,:;]+$/,'').trim();
  }
  // Anchor supporting quote (single, strongest, trimmed)
  let anchorQuote: string | null = selectAnchorQuote(anchorQualified ? anchorCandidate : null);

  // Paragraph 1: stage setting (grammar & capitalization) + emotional emergence
  let p1 = '';
  if(psThemes.length){
    // Tokenize each PS theme for chip rendering (ensures first sentence shows colored chips)
    const framedList = readableList(psThemes.slice(0,5));
    const tokenized = injectThemeTokens(framedList);
    p1 += `You framed the problem around ${tokenized}. `;
  } else {
    p1 += 'You started broad without fixed anchors. ';
  }
  if(interviewsCount){
    p1 += `We listened to ${interviewsCount} interview${interviewsCount===1?'':'s'} and grouped them into ${clusterArr.length || 1} segment${(clusterArr.length||1)===1?'':'s'}. `;
    if(interviewsCount < 7){
      p1 += 'Still early—patterns can flip with a few more conversations. ';
    }
  }
  if(anchorQualified){
    p1 += `[[THEME_FILLED:${anchorCandidate}]] kept coming up with more energy than the original themes. `;
  }

  // Paragraph 2: anchor articulation (add token for later chip replacement)
  let p2 = '';
  if(anchorCandidate && anchorQualified){
    const rec = themePresence.find((r:any)=> r.theme===anchorCandidate);
    const count = rec ? Math.round((rec.interviewPct||0)*interviewsCount) : undefined;
    p2 += `Potential new anchor is [[THEME:${anchorCandidate}]]` + (count?` — it shows up in ${count} of ${interviewsCount} interviews. `:' ');
    if(anchorQuote){ p2 += `One person said: “${formatQuote(anchorQuote)}.” `; }
    const displaced = psThemes.filter(t=> t!==anchorCandidate && !emergent.includes(t));
    if(displaced.length){
      const displacedList = injectThemeTokens(readableList(displaced.slice(0,2)));
      p2 += `It feels sharper right now than ${displacedList}. `;
    }
    p2 += 'If a few more people echo a concrete moment around it, rewrite your problem boundary there. ';
    p2 += `To test it: in the next 3 interviews ask for a recent specific moment; if they drift to other pains or cannot recall one tied to [[THEME:${anchorCandidate}]], set it back to “watch list.”`;
  } else if(anchorCandidate && !anchorQualified){
    p2 += 'A few new signals are emerging but none clearly dominate yet—keep probing concrete moments before elevating one.';
  } else {
    p2 += stageEarly ? 'Too early to call a new anchor—signals are still forming.' : 'No single dominant new anchor; attention is still distributed.';
  }

  // Paragraph 3: original theme validation & quiet assumptions (with tokens)
  let p3 = '';
  if(validated.length){ p3 += `Holding some ground: ${injectThemeTokens(detail(validated))}. `; }
  else if(!anchorQualified){ p3 += 'Starting themes have not stabilized yet; that is normal before you introduce richer story prompts. '; }
  if(gaps.length){ p3 += `Quieter than expected: ${injectThemeTokens(detail(gaps))}. `; }
  else if(validated.length){ p3 += 'None of the starting themes are completely absent. '; }

  // Paragraph 4: secondary emergent / early signals
  let p4 = '';
  const secondaryEmergent = anchorQualified ? emergent.filter((t:string)=> t!==anchorCandidate) : emergent;
  if(secondaryEmergent.length){
    p4 += `Secondary sparks: ${injectThemeTokens(detail(secondaryEmergent))}. Track lightly—only elevate if ${anchorCandidate || 'the lead theme'} weakens.`;
  } else if(early.length && !anchorCandidate){
    p4 += `Light early mentions: ${injectThemeTokens(detail(early))}. Keep a watch list rather than widening scope prematurely.`;
  }

  // Paragraph 5: scenario guidance (expanded actionable depth instructions)
  let p5 = '';
  const deeper = 'Go a level deeper by: (1) isolating the exact trigger moment (“When did you realize this was a problem?”), (2) mapping the sequence of workaround steps, (3) capturing emotional spikes (“What was the most frustrating 30 seconds?”), (4) asking what they tried immediately after, and (5) noting any tool/app they opened first.';
  switch(scenario){
    case 'earlyExploration':
      p5 = deeper;
      break;
    case 'solidifying':
      p5 = 'Tighten phrasing: rewrite the problem in the customer’s words, stress‑test with 2 contrasting contexts, and begin excluding fringe pains.';
      break;
    case 'pivotEmerging':
      p5 = 'Run 2–3 focused follow‑ups on the new anchor only: map triggers, first workaround action, switching cost felt, and abandonment point.';
      break;
    case 'reframing':
      p5 = 'Interrogate quieter assumptions directly; if you cannot elicit a fresh concrete incident in 2–3 tries, de‑prioritize them for now.';
      break;
    default:
      p5 = deeper;
  }

  const text = [p1,p2,p3,p4,p5].map(s=> s.trim()).filter(Boolean).join('\n\n');
  const themeOrder = Array.from(new Set([anchorQualified ? anchorCandidate : null, ...validated, ...gaps, ...emergent].filter(Boolean)));
  return { text, themesValidated: validated, themesEmergent: emergent, themesMissing: gaps, anchor: anchorCandidate || undefined, anchorQuote: anchorQuote || undefined, themeOrder };
}
function readableList(arr:string[]): string {
  const a = arr.filter(Boolean);
  if(!a.length) return '';
  if(a.length===1) return a[0];
  if(a.length===2) return a[0] + ' and ' + a[1];
  return a.slice(0,-1).join(', ') + ' and ' + a[a.length-1];
}

// Replace core theme words with token markers (case-insensitive). Skip if already tokenized.
function injectThemeTokens(text: string): string {
  if(!text) return text;
  // Instead of bailing if any token exists, only skip already-tokenized segments and convert remaining raw occurrences.
  // Approach: split by token markers and only process plain segments.
  const tokenRegex = /\[\[(THEME|THEME_FILLED):[a-z]+\]\]/i;
  if(!tokenRegex.test(text)) {
    // Fast path: no tokens present yet
    return text.replace(/\b(cost|time|effort|quality|reliability|trust|flexibility|choice|information|access|support|risk|value)\b/gi, (m)=> `[[THEME:${m.toLowerCase()}]]`);
  }
  const parts: string[] = [];
  let last = 0;
  const globalToken = /\[\[(THEME|THEME_FILLED):[a-z]+\]\]/gi;
  let match: RegExpExecArray | null;
  while((match = globalToken.exec(text))){
    const segment = text.slice(last, match.index);
    if(segment){
      parts.push(segment.replace(/\b(cost|time|effort|quality|reliability|trust|flexibility|choice|information|access|support|risk|value)\b/gi, (m)=> `[[THEME:${m.toLowerCase()}]]`));
    }
    parts.push(match[0]); // existing token untouched
    last = match.index + match[0].length;
  }
  const tail = text.slice(last);
  if(tail){
    parts.push(tail.replace(/\b(cost|time|effort|quality|reliability|trust|flexibility|choice|information|access|support|risk|value)\b/gi, (m)=> `[[THEME:${m.toLowerCase()}]]`));
  }
  return parts.join('');
}
function capitalize(s:string){ return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }

/* ================= Quote Extraction Helpers ================= */
interface QuoteInventory { [theme: string]: string[] }
function extractThemeQuotes({ notesText, themes, maxPerTheme=3, maxTotal=12 }:{ notesText:string; themes:string[]; maxPerTheme?:number; maxTotal?:number }): QuoteInventory {
  const inv: QuoteInventory = {};
  if(!notesText || !themes.length) return inv;
  const lines = notesText.split(/\n+/).map(l=> l.trim()).filter(l=> l.length > 8 && /[a-z]/i.test(l));
  const lowerLines = lines.map(l=> l.toLowerCase());
  let total = 0;
  for (const theme of themes){
    const themeLower = theme.toLowerCase();
    for (let i=0;i<lines.length && (inv[theme]?.length||0) < maxPerTheme && total < maxTotal;i++){
      if (lowerLines[i].includes(themeLower)){
        const cleaned = sanitizeQuote(lines[i]);
        if(!cleaned) continue;
        if(!inv[theme]) inv[theme] = [];
        inv[theme].push(cleaned);
        total++;
      }
    }
  }
  return inv;
}

function sanitizeQuote(line:string): string | null {
  const trimmed = line.replace(/[\u201C\u201D]/g,'"').trim();
  if(!trimmed) return null;
  // Drop extremely long lines (likely paragraphs) to keep quotes scannable
  if(trimmed.length > 220) return trimmed.slice(0,200).trim() + '…';
  return trimmed;
}

// buildQuoteBlocks removed – single anchor quote inline only

function buildNextSteps(n:any, plain: PlainNarrative): string[] {
  const steps: string[] = [];
  const { themesEmergent, themesMissing } = plain;
  const ev = n.evidence || {};
  const interviewsCount = ev.interviewsCount || 0;
  if(interviewsCount < 8){
    steps.push('Add 3–4 more interviews (different contexts) so repetition vs noise becomes clearer.');
  }
  if(themesMissing.length){
    steps.push('Ask directly: “When does ' + readableList(themesMissing.slice(0,2)) + ' actually bite you?” to confirm if it is real or drop it.');
  }
  if(themesEmergent.length){
    steps.push('Run a short follow‑up focused only on ' + readableList(themesEmergent.slice(0,2)) + '—push for specific recent moments.');
  }
  if(!themesEmergent.length && !themesMissing.length){
    steps.push('Shift to richer probing: map current workaround steps and friction points in detail.');
  }
  steps.push('Rewrite a cleaner one‑paragraph problem statement reflecting today’s evidence.');
  return steps.slice(0,6);
}

/* ================= Styles ================= */
// Local blink keyframes (scoped via style tag at root once) – inserted only once
// (Blink animation style injection removed)
