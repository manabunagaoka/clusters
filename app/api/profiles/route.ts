import { NextRequest, NextResponse } from 'next/server'
import { foldToUniversalsWithFacetWeights, normalizeWeights, pickCriticalFacets } from '@/app/(clusters)/lib/universals'

// Deterministic JTBD Profile extraction (no LLM) applying explicit placement rules.

interface IncomingBody { notes?: string; ps_anchors?: string[] }

type ProfileOut = {
  id: string;
  narrative: string; // Summary (2–3 sentences)
  jtbd: {
    who?: string;
    context?: { role?: string };
    struggling_moment?: string;
    workarounds?: string[];
    selection_criteria?: string[]; // kept internally, shown under Other contexts
    anxieties?: string[];          // captured negatives / not working
    outcomes?: string[];           // success statements (money removed)
  };
  themes: { core: string[]; facets: string[] };
  theme_weights: Record<string, number>;
  other?: {
    dependent?: { relation: string; conditions: string[] };
    language?: string;
    household_scope?: string[];
    transport?: string[];
    continuity?: string[];
    missed_by_summary?: string[];
  };
  flags?: { thin_interview?: boolean; missing_outcomes?: boolean; pricing_misplaced?: boolean; solution_bias?: boolean };
  approved?: boolean;
  edited?: boolean;
  original?: unknown;
};

function splitInterviews(raw: string): string[] {
  const blocks = (raw||'')
    .split(/(?:^|\n)\s*(?:-{3,}|={3,}|#+\s*Interview\s+\d+.*?)\s*(?:\n|$)/i) // headers or separators
    .join('\n')
    .split(/\n{2,}/)
    .map(b => b.trim())
    .filter(Boolean);
  // fallback: if only one big block and it has many lines, heuristically cut every ~12 lines
  if (blocks.length <= 1) {
    const lines = (raw||'').split(/\n+/).map(l=>l.trim()).filter(Boolean);
    const chunk: string[] = [];
    const out: string[] = [];
    for (const ln of lines) {
      chunk.push(ln);
      if (chunk.length >= 12) { out.push(chunk.join('\n')); chunk.length = 0; }
    }
    if (chunk.length) out.push(chunk.join('\n'));
    if (out.length > 1) return out;
  }
  return blocks.slice(0, 8); // cap
}

function stripHeadings(s: string){ return s.replace(/^Interview\s*\d+\s*[-–]\s*/i, '').trim(); }
function splitBullets(s: string){ return s.split(/[\n;•]+/).map(v=>v.trim()).filter(Boolean); }

// --- Sentence utilities ----------------------------------------------------
function preprocess(raw: string): string[] {
  // Remove obvious headers like "Interview 1 -" lines
  const cleaned = raw.replace(/^Interview\s+\d+.*$/gim, '').replace(/\r/g,'');
  // Split into sentences (simple heuristic) then trim
  const sentences = cleaned
    .split(/(?<=[.!?])\s+|\n+/)
    .map(s=>s.replace(/^["'\-*\s]+|["'\-*\s]+$/g,'').trim())
    .filter(s=>s.length>0 && /[a-zA-Z]/.test(s));
  return sentences.slice(0, 60); // cap to keep deterministic + bounded
}

const BRAND_STOP = new Set(['netflix','disney+','hbo','hulu','prime','tubi','youtube','apple','apple tv+','crunchyroll','peacock']);
function normalizeNameRole(line: string): { who: string; role: string } | undefined {
  if (!line) return undefined;
  const cleaned = line.replace(/^interview\s+\d+\s*[-–]\s*/i,'').trim();
  if (!/,/.test(cleaned)) return undefined;
  const [namePart, roleMaybe] = cleaned.split(/,/).map(p=>p.trim());
  if (!namePart) return undefined;
  if (BRAND_STOP.has(namePart.toLowerCase())) return undefined;
  if (!/[A-Z][a-z]+/.test(namePart)) return undefined;
  const nameTokens = namePart.split(/\s+/).filter(Boolean);
  if (nameTokens.length === 0) return undefined;
  const first = nameTokens[0];
  const last = nameTokens[nameTokens.length-1];
  let who = first;
  if (last && last.toLowerCase() !== first.toLowerCase()) who = `${first} ${last[0].toUpperCase()}.`;
  const roleRaw = roleMaybe || '';
  const role = roleRaw.split(/;|\||,/)[0].replace(/\b(and|&).*$/i,'').trim();
  if (!role) return { who, role: '' };
  return { who, role };
}

interface LabeledBuckets {
  selection: string[];
  notWorking: string[];
  workarounds: string[];
  struggle: string[];
  success: string[];
}

const selectionPattern = /(must|required|need to be able|price|pay|fee|discount|worth it|cancel|no rotation|spanish required|drive|can drive|cpr|first aid|allergy safe|ad-?free|platform we don'?t have)/i;
const notWorkingPattern = /(never\b|can'?t|doesn'?t|removed mid-season|only on another platform|rigid|always end up|keeps? \w+ing|burning out|too institutional|buffering|lag|crashes)/i;
const workaroundPattern = /(current solution|we rely on|i use|we use|rotating between|i ask|sharing accounts|using free )/i;
const strugglePattern = /(\bi need\b|\bwe need\b|my biggest frustration|i struggle with|the problem is|hard to|can'?t find|we always end up )/i;
const successPattern = /(success would mean|ideally|wants|i want a way to|i need someone who can)/i;

function stripFillerStart(s: string){ return s.replace(/^(but|like|then|so|honestly|currently)\b[\s,.-]*/i,'').trim(); }
function labelSentences(sentences: string[]): LabeledBuckets {
  const b: LabeledBuckets = { selection: [], notWorking: [], workarounds: [], struggle: [], success: [] };
  sentences.forEach(s => {
    const clean = stripFillerStart(s).split(/[;\.]/)[0].trim();
    if (!clean) return;
    const ls = clean.toLowerCase();
    if (selectionPattern.test(ls)) b.selection.push(clean);
    else if (notWorkingPattern.test(ls)) b.notWorking.push(clean);
    else if (workaroundPattern.test(ls)) b.workarounds.push(clean);
    else if (strugglePattern.test(ls)) b.struggle.push(clean);
    else if (successPattern.test(ls)) b.success.push(clean);
  });
  return b;
}

function dedupeLimitTruncate(b: LabeledBuckets){
  const seen: string[] = [];
  function canonical(t: string){ return t.toLowerCase().replace(/[^a-z0-9\s]/g,'').replace(/\s+/g,' ').trim(); }
  function pushUnique(arr: string[]): string[] {
    const out: string[] = [];
    arr.forEach(s => {
      const c = canonical(s);
      if (!c) return;
      // token overlap check with existing
      const tokens = new Set(c.split(' '));
      const dup = seen.some(prev => {
        const prevTokens = prev.split(' ');
        const overlap = prevTokens.filter(t=>tokens.has(t)).length;
        return overlap / Math.max(prevTokens.length, tokens.size) >= 0.8;
      });
  if (!dup) { seen.push(c); out.push(s.slice(0, 160)); }
    });
    return out;
  }
  b.selection = pushUnique(b.selection).slice(0,3);
  b.notWorking = pushUnique(b.notWorking).slice(0,3);
  b.workarounds = pushUnique(b.workarounds).slice(0,3);
  b.struggle = pushUnique(b.struggle).slice(0,1); // only need best struggle
  b.success = pushUnique(b.success).slice(0,3);
  return b;
}

function buildSummaryFromBuckets(nameRole: { who?: string; role?: string } | undefined, b: LabeledBuckets): string {
  const parts: string[] = [];
  if (nameRole?.who || nameRole?.role) parts.push([nameRole?.who, nameRole?.role].filter(Boolean).join(', '));
  if (b.struggle[0]) parts.push(b.struggle[0]);
  const second = b.success[0] || (b.workarounds[0] ? `Currently ${b.workarounds[0]}` : '');
  if (second) parts.push(second);
  let summary = parts.filter(Boolean).slice(0,2).join('. ');
  if (!/[.!?]$/.test(summary)) summary += '.';
  // Ensure not verbatim of any single bullet
  const allBullets = [...b.struggle, ...b.workarounds, ...b.notWorking, ...b.success];
  const canon = (s: string)=>s.toLowerCase().replace(/[^a-z0-9\s]/g,'').replace(/\s+/g,' ').trim();
  const sumC = canon(summary);
  if (allBullets.some(bu => {
    const bc = canon(bu); const tokens = bc.split(' '); const overlap = tokens.filter(t=>sumC.includes(t)).length; return overlap / tokens.length > 0.9; })) {
    // Rephrase minimally by removing some starting tokens
    summary = summary.replace(/^([^,.]+?), /,'$1,').replace(/^\w+\s+/, '');
  }
  return summary.split(/\s+/).slice(0,120).join(' ');
}

function stem(str: string){ return str.toLowerCase().replace(/(ing|ed|ly|ment|tion|s)\b/g,''); }
function missedBySummarySentences(summary: string, buckets: LabeledBuckets): string[] {
  const pool = [buckets.struggle[0], ...buckets.workarounds, ...buckets.notWorking, ...buckets.success].filter(Boolean) as string[];
  const s = stem(summary);
  const missed: string[] = [];
  for (const sent of pool) {
    if (missed.length >= 2) break;
    const st = stem(sent);
    if (!s.includes(st.slice(0, Math.min(10, st.length)))) {
      const fragment = sent.split(/\s+/).slice(0,10).join(' ').replace(/[.,;!?]+$/,'');
      missed.push(fragment);
    }
  }
  return missed;
}

// Context facet ids we do NOT want to show as emergent themes (since they appear elsewhere)
const CONTEXT_FACETS = new Set([
  'continuity_of_caregiver','transport_support','household_help','dependent_care','language_support'
]);

function extractPlacement(text: string){
  const sentences = preprocess(text);
  const nameRole = normalizeNameRole(sentences[0] || '');
  // Remove first line if it is name/role so it is not reclassified
  if (nameRole && sentences.length) sentences.shift();
  const buckets = dedupeLimitTruncate(labelSentences(sentences));
  // Selection criteria kept separate (internal -> displays under Other contexts) – apply pricing removal to success
  const pricingRegex = /(\$|\bper hour|willing to pay|budget|cost|price)/i;
  const successFiltered = buckets.success.filter(s=>!pricingRegex.test(s));
  return {
    who: nameRole?.who || '',
    role: nameRole?.role || '',
    struggling: buckets.struggle[0] || '',
    workarounds: buckets.workarounds,
    selection_criteria: buckets.selection,
    anxieties: buckets.notWorking,
    outcomes: successFiltered
  };
}

function naiveTags(text: string): string[] {
  const words = (text.toLowerCase().match(/[a-z]{4,}/g) || []).slice(0, 120);
  const uniq: string[] = [];
  for (const w of words) if (!uniq.includes(w)) uniq.push(w);
  return uniq.slice(0, 50);
}

// (old buildSummary & missedBySummary replaced by new sentence based versions)

export async function POST(req: NextRequest) {
  let body: IncomingBody = {};
  try { body = await req.json(); } catch {}
  const raw = body.notes || '';
  const blocks = splitInterviews(raw);
  if (!blocks.length) {
    return NextResponse.json<ProfilesAPIResponse>({ profiles: [], matrix: [], summary: null, note: 'No interview content found.' }, { status: 200 });
  }

  const profiles: ProfileOut[] = [];
  const matrix: number[][] = [];

  blocks.forEach((block, i) => {
    const placement = extractPlacement(block);
    const summary = buildSummaryFromBuckets({ who: placement.who, role: placement.role }, {
      selection: placement.selection_criteria,
      notWorking: placement.anxieties || [],
      workarounds: placement.workarounds || [],
      struggle: placement.struggling ? [placement.struggling] : [],
      success: placement.outcomes || []
    });
    const tags = naiveTags(block);
    const { coreWeights, facetWeights } = foldToUniversalsWithFacetWeights(tags);
    const coreNorm = normalizeWeights(coreWeights);
    const coreList = Object.keys(coreNorm).sort();
    // Filter facets to exclude context facets for emergent themes display
    const rawFacets = pickCriticalFacets(facetWeights, 6).filter(f=>!CONTEXT_FACETS.has(f));
    const facets = rawFacets.slice(0,3);
    const themeWeights: Record<string, number> = coreNorm;
    const thin = tags.length < 10;
    const missingOutcomes = (placement.outcomes || []).length === 0;

    // Dependent / conditions
  const condMatch = block.match(/(adhd|autism|aspergers|asd|iep|504|dyslexia)/gi) || [];
  const dep = /\b(son|daughter|kid|child)\b/i.exec(block);
    let dependent: { relation: string; conditions: string[] } | undefined;
    if (dep) {
      const relWord = dep[1].toLowerCase();
      const relation = /son|daughter|kid|child/.test(relWord) ? 'child' : 'other';
      const conditions = Array.from(new Set(condMatch.map(c=>c.toLowerCase())));
      if (relation === 'child' && conditions.length) {
        dependent = { relation, conditions };
      }
    }
    const language = (block.match(/\b(spanish|mandarin|bilingual)\b/i)||[])[0]?.toLowerCase();
  const household_scope = Array.from(new Set(splitBullets(block).filter(l=>/(groceries|meal prep|light cleaning)/i.test(l)).slice(0,3)));
    const transport = Array.from(new Set(splitBullets(block).filter(l=>/(school pickup|drive|driving|drop[- ]?off)/i.test(l)).slice(0,4)));
    const continuity = Array.from(new Set(splitBullets(block).filter(l=>/(no rotation|same person|part of family|long[- ]?term)/i.test(l)).slice(0,4)));

    const jtbd = {
      who: placement.who || undefined,
      context: placement.role ? { role: placement.role } : {},
      struggling_moment: placement.struggling || undefined,
      workarounds: (placement.workarounds||[]).length ? placement.workarounds : undefined,
      selection_criteria: (placement.selection_criteria||[]).length ? placement.selection_criteria : undefined,
      anxieties: (placement.anxieties||[]).length ? placement.anxieties : undefined,
      outcomes: (placement.outcomes||[]).length ? placement.outcomes : undefined
    };
    const missed = missedBySummarySentences(summary, {
      selection: placement.selection_criteria,
      notWorking: placement.anxieties || [],
      workarounds: placement.workarounds || [],
      struggle: placement.struggling ? [placement.struggling] : [],
      success: placement.outcomes || []
    });
    profiles.push({
      id: `p${i+1}`,
      narrative: summary,
      jtbd,
      themes: { core: coreList, facets },
      theme_weights: themeWeights,
      other: {
        dependent,
        language,
        household_scope: household_scope.length?household_scope:undefined,
        transport: transport.length?transport:undefined,
        continuity: continuity.length?continuity:undefined,
        missed_by_summary: missed.length?missed:undefined
      },
      flags: { thin_interview: thin, missing_outcomes: missingOutcomes },
      approved: false,
      edited: false
    });
    matrix.push(coreList.map(c=>themeWeights[c]||0));
  });

  const summary = { count: profiles.length };
  return NextResponse.json<ProfilesAPIResponse>({ profiles, matrix, summary, note: profiles.length ? undefined : 'No profiles extracted.' }, { status: 200 });
}

// Local re-export of TS interface used in store (avoid circular import of types.ts here)
interface ProfilesAPIResponse { profiles: ProfileOut[]; matrix: number[][]; summary: { count: number } | null; note?: string }

