import { NextRequest, NextResponse } from 'next/server'
import { CORE_DIMENSIONS } from '@/app/(clusters)/lib/universals'
import { matchCuesInSentence, FACET_CUES } from '@/app/(clusters)/lib/universals'

const CORES: string[] = [...CORE_DIMENSIONS];

function segment(raw: string): string[] {
  const trimmed = (raw||'').replace(/\r/g,'').trim();
  if (!trimmed) return [];
  // Split on blank lines only; keep headings inside blocks for name/role extraction.
  const parts = trimmed.split(/\n{2,}/).map(s=>s.trim()).filter(Boolean);
  return parts.slice(0,15);
}

function sentences(block: string): string[] {
  // Preserve content after an inline heading like "Interview 3: ..." instead of dropping the whole line.
  // First remove standalone heading-only lines, then strip the heading prefix when content follows.
  const cleaned = block
    // Remove lines that are ONLY a heading.
    .replace(/^Interview\s+\d+\s*[-–—:]?\s*$/gim,'')
    // For lines that start with heading + content, remove just the heading token.
    .replace(/^Interview\s+\d+\s*[-–—:]\s*/gim,'')
    .replace(/^Interview\s+\d+\s+/gim,'')
    // Remove filler discourse markers.
    .replace(/\b(So|Like|Honestly|Currently|Then)\b[,:]?\s+/gi,'');
  return cleaned
    .split(/(?<=[.!?])\s+|\n+/)
    .map(s=>s.trim())
    .filter(s=>s.length>3 && /[a-zA-Z]/.test(s))
    .slice(0,60);
}

// Convert raw hit counts to discrete weights per spec.
function countsToDiscreteWeights(counts: Map<string, number>): Map<string, number> {
  if (counts.size === 0) return counts;
  const out = new Map<string, number>();
  counts.forEach((cnt, core) => {
    let w = 0.33; // 1 occurrence => Low
    if (cnt === 2) w = 0.67; // 2 => Med
    if (cnt >= 3) w = 1.0; // 3+ => High
    out.set(core, w);
  });
  return out;
}

function topThree(counts: Map<string, number>): Map<string, number> {
  const arr = Array.from(counts.entries()).sort((a,b)=> b[1]-a[1] || a[0].localeCompare(b[0]));
  const sel = new Map<string, number>();
  arr.slice(0,3).forEach(([c,v])=> sel.set(c,v));
  return sel;
}

function detectContextAndHeading(block: string){
  const geoMatch = /(bay area|california|nyc|new york|austin|seattle)/i.exec(block);
  const lang = /(spanish|bilingual)/i.test(block) ? 'spanish' : undefined;
  // Proximity-based dependent detection: child term within ±80 chars of ADHD/Autism token.
  const lower = block.toLowerCase();
  const childRe = /(child|kid|son|daughter|my son|my daughter)/i;
  const clinicalRe = /(ADHD|Autism|ASD)/i;
  const dependentConds: string[] = [];
  if (clinicalRe.test(block)) {
    const clinicalMatches = [...block.matchAll(/(ADHD|Autism|ASD)/ig)];
    for (const m of clinicalMatches) {
      const idx = m.index || 0;
      const start = Math.max(0, idx - 80);
      const end = Math.min(block.length, idx + 80);
      const window = block.slice(start, end);
      if (childRe.test(window)) {
        const token = m[1].toUpperCase();
        if (token === 'ADHD' && !dependentConds.includes('ADHD')) dependentConds.push('ADHD');
        if ((token === 'AUTISM' || token === 'ASD') && !dependentConds.includes('Autism Spectrum Disorder')) dependentConds.push('Autism Spectrum Disorder');
      }
    }
  }
  const dependent = dependentConds.length ? [{ relation:'child', conditions: dependentConds }] : undefined;
  // Heading name / role extraction
  let name: string | undefined; let role: string | undefined;
  const firstLine = block.split(/\n+/)[0] || '';
  // Pattern 1: Interview X – Name, Role
  const p1 = /^Interview\s*\d+\s*[-–—:]\s*([^,\n]+)(?:,\s*[^,\n]+)?(?:,\s*([^,\n]+))?/i.exec(firstLine);
  // Pattern 2: Name, Role (line only)
  const p2 = /^([A-Z][A-Za-z'\-]+(?:\s+[A-Z][A-Za-z'\-]+)*)\s*,\s*([^,]{2,40})$/i.exec(firstLine);
  if (p1) {
    name = (p1[1]||'').trim();
    role = (p1[2]||'').trim() || undefined;
  } else if (p2) {
    name = (p2[1]||'').trim();
    role = (p2[2]||'').trim();
  }
  if (name) {
    const parts = name.split(/\s+/);
    if (parts.length>1) name = `${parts[0]} ${parts[1][0].toUpperCase()}.`; else name = parts[0];
  }
  return {
    context: {
      language: lang ? [lang] : undefined,
      geo: geoMatch?.[1]?.toLowerCase(),
      dependent
    },
    name,
    role: role && role.length<40 ? role : undefined
  };
}

export async function POST(req: NextRequest){
  let body: { notes?: string } = {};
  try { body = await req.json(); } catch {}
  const raw = body.notes || '';
  // Detect headings but no blank line separation -> issue warning later.
  const hasHeadingPattern = /\bInterview\s+\d+/i.test(raw);
  const hasBlankLineSeparation = /\n\s*\n/.test(raw.trim());
  const blocks = segment(raw);
  if (!blocks.length) {
    return NextResponse.json({ matrix: [], display: [], warnings: ['No interview content found.'] });
  }
  const display: any[] = [];
  const matrix: Array<[string, Record<string, number>]> = [];
  const warnings: string[] = [];
  if (hasHeadingPattern && !hasBlankLineSeparation) {
    warnings.push('We couldn’t reliably separate your interviews. Please add a blank line between each interview and try again.');
  }
  blocks.forEach((block, idx) => {
    const id = `i${idx+1}`;
    const sents = sentences(block);
    const coreCounts = new Map<string, number>();
    const facetCounts = new Map<string, number>();
    sents.forEach(sent => {
      const { coreHits, facetHits } = matchCuesInSentence(sent);
      Object.entries(coreHits).forEach(([core, c]) => { coreCounts.set(core, (coreCounts.get(core)||0) + c); });
      Object.entries(facetHits).forEach(([facet, c]) => { facetCounts.set(facet, (facetCounts.get(facet)||0) + c); });
    });
    // Guardrails: risk only if explicit risk cue appeared (already intrinsic to counts). If risk absent after filtering, ignore.
    // Value already captured via regex cues (worth it / renew / cancel / pay double / bang for buck).
    // Support requires explicit human help terms (already in regex).
    // Pick top <=3 cores
    const limited = topThree(coreCounts);
    if (limited.size === 0) {
      const interviewNum = idx + 1;
      warnings.push(`No clear theme found in Interview ${interviewNum}. Add one specific pain (for example, what keeps breaking, what you’d pay for, or what needs to adapt).`);
    }
    const discrete = countsToDiscreteWeights(limited);
    const weightsRecord: Record<string, number> = {};
    Array.from(discrete.entries()).forEach(([c,w]) => { if (w>0) weightsRecord[c] = w; });
    matrix.push([id, weightsRecord]);
    // Emergent facets: top 3 by count
    const emergent = Array.from(facetCounts.entries())
      .sort((a,b)=> b[1]-a[1] || a[0].localeCompare(b[0]))
      .slice(0,3)
      .map(([f])=>f);
    // Context detection (reuse existing minimal logic)
  const { context: ctx, name, role } = detectContextAndHeading(block);
    const top_cores = Array.from(discrete.entries())
      .sort((a,b)=> b[1]-a[1] || CORES.indexOf(a[0])-CORES.indexOf(b[0]))
      .map(([core, w])=>({ core, weight_label: w===1?'High': w===0.67?'Med':'Low' }));
    // Why fragments: pick sentences that contributed to selected cores, up to 3, trimmed
    const selectedSet = new Set(Array.from(limited.keys()));
    const why: string[] = [];
    for (const sent of sents) {
      if (why.length>=3) break;
      const lower = sent.toLowerCase();
      if (Array.from(selectedSet).some(c => lower.includes(c))) {
        const frag = lower.replace(/[^a-z0-9\s]/gi,' ').replace(/\s+/g,' ').trim().slice(0,110);
        if (frag && !why.includes(frag)) why.push(frag);
      }
    }
    if (limited.size>0 && why.length===1) {
      const emergFrag = emergent[0]?.replace(/_/g,' ');
      if (emergFrag && !why.includes(emergFrag)) why.push(emergFrag); else why.push(why[0]);
    }
    if (limited.size>0 && why.length===0) why.push('core signals present');
    display.push({ id, name, role, top_cores, emergent, context: Object.fromEntries(Object.entries(ctx).filter(([_,v])=>v!==undefined && v!==null)), why });
    if (process.env.THEMES_DEBUG === '1') {
      // eslint-disable-next-line no-console
      console.log('[THEMES_DEBUG]', id, {
        preview: block.slice(0,120).replace(/\n+/g,' '),
        coreCounts: Object.fromEntries(coreCounts.entries()),
        facetCounts: Object.fromEntries(facetCounts.entries()),
        selected: weightsRecord,
        name, role,
        context: ctx,
        why
      });
    }
  });
  return NextResponse.json({ matrix, display, warnings });
}

export const dynamic = 'force-dynamic';