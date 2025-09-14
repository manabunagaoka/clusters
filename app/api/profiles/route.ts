import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

/* ---------- Constants: stable families & blocklists (domain-agnostic) ---------- */
const ANCHOR_FAMILIES = [
  'trustworthy_care', 'rising_costs', 'coordination_challenge',
  'option_overload', 'info_fragmentation', 'research_time_cost', 'value_uncertainty'
];
const FACET_BLOCKLIST = new Set(['snake_case','misc','unknown','general','other']);

/* ---------- Helpers ---------- */
function toSnakeStrict(s:string){
  return (s||'').normalize('NFKC').toLowerCase()
    .replace(/['’]/g,'')
    .replace(/[^\p{Letter}\p{Number}\s-]/gu,' ')
    .replace(/[-\s]+/g,' ')
    .trim()
    .split(' ')
    .filter(Boolean)
    .slice(0,3)
    .join('_');
}
function equivKey(t: string){
  const x = (t||'').toLowerCase().replace(/[^a-z0-9_]/g,'');
  if (['trustworthy_care','trust_issues','trust_building','safety_concerns','privacy_concerns'].includes(x)) return 'trustworthy_care';
  if (['rising_costs','price_sensitivity','financial_burden','affordability_challenge','affordability_concerns','budget_constraints','too_expensive','cost_pressure'].includes(x)) return 'rising_costs';
  if (['coordination_challenge','scheduling_frustration','scheduling_complexity','logistics_management','time_constraints','availability'].includes(x)) return 'coordination_challenge';
  if (['option_overload','overwhelming_options','decision_fatigue','decision_challenge','decision_friction'].includes(x)) return 'option_overload';
  if (['info_fragmentation','content_fragmentation','information_fragmentation','content_discovery','limited_selection'].includes(x)) return 'info_fragmentation';
  if (['research_time_cost','information_overload','compare_time','research_burden','research_complexity'].includes(x)) return 'research_time_cost';
  if (['value_uncertainty','worth_it','renewal_doubt'].includes(x)) return 'value_uncertainty';
  return x;
}
function forceFamily(tag:string){
  const t = toSnakeStrict(tag);
  if (FACET_BLOCKLIST.has(t)) return '';
  if (ANCHOR_FAMILIES.includes(t)) return t;
  const f = equivKey(t);
  return ANCHOR_FAMILIES.includes(f) ? f : '';
}
function normalizeNotes(raw:string){
  // Segment into interviews: prefer explicit headers; else blank-line blocks; else whole text
  const hasHeaders = /^(interview|participant)\s*\d+/im.test(raw);
  let blocks: string[] = [];
  if (hasHeaders){
    blocks = raw.split(/(?:^|\n)(?=(?:interview|participant)\s*\d+)/ig).map(s=>s.trim()).filter(Boolean);
  } else if (/\n\s*\n/.test(raw)) {
    blocks = raw.split(/\n\s*\n+/).map(s=>s.trim()).filter(Boolean);
  } else {
    blocks = [raw.trim()];
  }
  // Make id + text
  return blocks.map((text, i)=>({ id:`iv${i+1}`, text }));
}
function detectAnchorFromText(text:string){
  const t = text.toLowerCase();
  if (/\btrust|consistent|consistency|referral|rotation|rotating staff|re[-\s]?explain\b/.test(t)) return 'trustworthy_care';
  if (/(\b(expensive|afford|budget|price|pricing|cost|costs|fee|fees|would pay)\b|\$\s*\d+)/.test(t)) return 'rising_costs';
  if (/\bschedul|flexible|random times|non[-\s]?traditional|until midnight|overnight|12[-\s]?hour|shift|handoff\b/.test(t)) return 'coordination_challenge';
  if (/\btoo many|end up scrolling|so many options|keep comparing\b/.test(t)) return 'option_overload';
  if (/\bwhere.*find|which app|limited selection|content.+scattered|discover\b/.test(t)) return 'info_fragmentation';
  if (/\bresearch|reading reviews|hours comparing|information overload\b/.test(t)) return 'research_time_cost';
  if (/\bworth it|renew|renewal|cancel\b/.test(t)) return 'value_uncertainty';
  return '';
}
function uniq<T>(arr:T[], key=(x:T)=>String(x), limit=8){
  const seen = new Set<string>(), out:T[] = [];
  for (const v of arr){
    const k = key(v); if (!k) continue;
    if (!seen.has(k)){ seen.add(k); out.push(v); if (out.length>=limit) break; }
  }
  return out;
}

function isMessy(raw:string, profilesCount:number, coreThemeHits:number){
  const tooShort = raw.trim().length < 220;
  const noProfiles = profilesCount === 0;
  const noCore = coreThemeHits === 0;
  return tooShort || noProfiles || noCore;
}

type JtbdReply = {
  who?: string
  context?: { role?: string; geo?: string; work_pattern?: string; language_pref?: string }
  struggling_moment?: string
  jobs_to_be_done?: string[]
  pains?: Array<{ tag?: string }>
  workarounds?: string[]
  selection_criteria?: string[]
  anxieties?: string[]
  outcomes?: string[]
  sentences?: Array<{ text?: string; tags?: string[] }>
}

/* ---------- LLM helpers ---------- */
async function jtbdNormalize(client:OpenAI, blockId:string, text:string){
  const sys = `
Normalize this interview into JTBD fields and tag the internal sentences with short, domain-agnostic noun-phrase tags (snake_case).
Return STRICT JSON ONLY:

{
  "who":"short",
  "context":{"role":"","geo":"","work_pattern":"","language_pref":""},
  "struggling_moment":"one sentence",
  "jobs_to_be_done":["..."],
  "pains":[{"tag":"snake_case","confidence":0.0}],
  "workarounds":["..."],
  "selection_criteria":["..."],
  "anxieties":["..."],
  "outcomes":["..."],
  "sentences":[ {"text":"verbatim sentence","tags":["snake_case","..."]} ]
}

Rules:
- Use only plain English; no code-like words in prose.
- Tags must be snake_case (max 3 words); prefer anchor-like families when applicable; add facet tags when needed.
- Do NOT invent numbers; keep sentences verbatim (light trims ok).
`.trim();
  const r = await client.chat.completions.create({
    model:'gpt-4o-mini', temperature:0.2, response_format:{type:'json_object'},
    messages:[
      { role:'system', content: sys },
      { role:'user', content: `INTERVIEW ${blockId}\n${text}` }
    ]
  });
  let out: unknown = {};
  try { out = JSON.parse(r.choices?.[0]?.message?.content || '{}'); } catch {}
  return out as Record<string, unknown>;
}
async function miniPS(client:OpenAI, fields: Record<string, unknown>){
  const sys = `
Rewrite JTBD fields into one 2–3 sentence narrative (human, student-friendly).
No code-like labels (no snake_case), no invented numbers, no UX fluff.
`.trim();
  const user = JSON.stringify({
    who: fields.who || '',
    context: fields.context || {},
    struggling_moment: fields.struggling_moment || '',
    jobs_to_be_done: fields.jobs_to_be_done || [],
    pains: fields.pains || [],
    outcomes: fields.outcomes || []
  }, null, 2);
  const r = await client.chat.completions.create({
    model:'gpt-4o-mini', temperature:0.2,
    messages:[
      { role:'system', content: sys },
      { role:'user', content: `Make one concise narrative from this JSON:\n${user}` }
    ]
  });
  return (r.choices?.[0]?.message?.content || '').trim();
}

/* ---------- Main ---------- */
export async function POST(req: NextRequest) {
  try {
  const { notes = "", ps_anchors = [] } = await req.json() || {} as { notes?: string; ps_anchors?: string[] };
    const blocks = normalizeNotes(String(notes||''));
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({
        profiles: [], theme_universe: [], matrix: [],
        summary:{ anchor_coverage:[], top_emergents:[] },
        note: 'OPENAI_API_KEY missing'
      }, { status:200 });
    }
    if (!blocks.length) {
      return NextResponse.json({
        profiles: [], theme_universe: [], matrix: [],
        summary:{ anchor_coverage:[], top_emergents:[] },
        note: 'Paste interview notes to generate profiles.'
      }, { status:200 });
    }

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const profiles: Array<Record<string, unknown>> = [];
    const tagCountsAll = new Map<string,number>(); // for summary
    const themeUniverse = new Set<string>();
  const matrix: Array<[string, Record<string, number>]> = [];

    for (const block of blocks){
      // 1) JTBD normalize
  let jtbd: JtbdReply = {};
      try { jtbd = await jtbdNormalize(client, block.id, block.text); } catch {}
  const sentences: Array<{ text?: string; tags?: string[] }> = Array.isArray(jtbd?.sentences) ? (jtbd.sentences as Array<{ text?: string; tags?: string[] }>) : [];

      // Collect tags per sentence
      const sentTags = sentences.map((s: { text?: string; tags?: string[] }) => ({
        text: String(s?.text || ''),
        tags: Array.isArray(s?.tags) ? (s.tags as string[]).map((t: string) => toSnakeStrict(String(t))) : [] as string[]
      })).filter((s: { text?: string }) => !!s.text);

      // Theme set per profile with weights (count of sentence-hits per tag family)
      const weights = new Map<string, number>();

      // 2) From JTBD pains
      const pains = Array.isArray(jtbd?.pains) ? jtbd.pains as Array<{ tag?: string }> : [];
      for (const p of pains){
        const fam = forceFamily(p?.tag || '');
        if (fam){ weights.set(fam, (weights.get(fam)||0) + 1); themeUniverse.add(fam); }
      }

      // 3) From sentence tags (anchors + facets)
      for (const s of sentTags){
        for (const raw of (s.tags||[])){
          const fam = equivKey(raw);
          if (FACET_BLOCKLIST.has(fam)) continue;
          // Anchor
          if (ANCHOR_FAMILIES.includes(fam)) {
            weights.set(fam, (weights.get(fam)||0) + 1); themeUniverse.add(fam);
            tagCountsAll.set(fam, (tagCountsAll.get(fam)||0)+1);
          } else {
            // facet
            weights.set(raw, (weights.get(raw)||0) + 1);
            themeUniverse.add(raw);
            tagCountsAll.set(raw, (tagCountsAll.get(raw)||0)+1);
          }
        }
      }

      // 4) If no anchor present, detect from text to avoid orphan
      const hasAnchor = Array.from(weights.keys()).some(k => ANCHOR_FAMILIES.includes(equivKey(k)));
      if (!hasAnchor){
        const detected = detectAnchorFromText(block.text);
        if (detected){ weights.set(detected, (weights.get(detected)||0)+1); themeUniverse.add(detected); tagCountsAll.set(detected, (tagCountsAll.get(detected)||0)+1); }
      }

  // Derive themes (core/facets)
  const coreThemes = Array.from(weights.keys()).filter(k => ANCHOR_FAMILIES.includes(equivKey(k)));
  const facetThemes  = Array.from(weights.keys()).filter(k => !ANCHOR_FAMILIES.includes(equivKey(k)) && !FACET_BLOCKLIST.has(k));

      // Normalize weights to 0..1 with cap {0.33,0.67,1.0} to keep it simple
      const maxCount = Math.max(1, ...Array.from(weights.values()));
  const themeWeights: Record<string, number> = {};
      weights.forEach((cnt, tag) => {
        const w = cnt / maxCount;
        themeWeights[tag] = w >= 0.8 ? 1.0 : w >= 0.5 ? 0.67 : 0.33;
      });

      // 5) Mini-PS narrative
  let narrative = '';
      try { narrative = await miniPS(client, jtbd || {}); } catch { narrative = ''; }

      const profileId = block.id;
      profiles.push({
        id: profileId,
        title: '', // optional title later
        narrative,
        themes: { core: uniq(coreThemes), facets: uniq(facetThemes) },
        theme_weights: themeWeights,
        jtbd: {
          who: jtbd?.who || '',
          context: jtbd?.context || {},
          struggling_moment: jtbd?.struggling_moment || '',
          jobs: Array.isArray(jtbd?.jobs_to_be_done) ? jtbd.jobs_to_be_done : [],
          workarounds: Array.isArray(jtbd?.workarounds) ? jtbd.workarounds : [],
          selection_criteria: Array.isArray(jtbd?.selection_criteria) ? jtbd.selection_criteria : [],
          anxieties: Array.isArray(jtbd?.anxieties) ? jtbd.anxieties : [],
          outcomes: Array.isArray(jtbd?.outcomes) ? jtbd.outcomes : []
        }
      });

  matrix.push([profileId, themeWeights]);
    }

    // Build summary from tagCountsAll (families for anchors; non-anchors for emergents)
    const anchorMap = new Map<string,number>();
    const emergMap = new Map<string,number>();
    tagCountsAll.forEach((count, tag) => {
      const fam = equivKey(tag);
      if (ANCHOR_FAMILIES.includes(fam)) {
        anchorMap.set(fam, (anchorMap.get(fam)||0)+count);
      } else if (!FACET_BLOCKLIST.has(tag)) {
        emergMap.set(tag, (emergMap.get(tag)||0)+count);
      }
    });
    const toArr = (m:Map<string,number>) =>
      Array.from(m.entries()).sort((a,b)=> b[1]-a[1] || a[0].localeCompare(b[0]))
        .map(([tag,count])=>({ tag, count }));

    const summary = { anchor_coverage: toArr(anchorMap), top_emergents: toArr(emergMap).slice(0,12) };
    const coreHits = (summary.anchor_coverage||[]).reduce((n,x)=>n+x.count,0);
    const messy = isMessy(String(notes||'').trim(), profiles.length, coreHits);
    const note = messy
      ? 'For best results, organize interviews with name/context, struggling moment, current workarounds, and outcomes (JTBD). You can proceed now—Clusters will still run—but quality may be limited.'
      : '';

    return NextResponse.json({
      profiles,
      theme_universe: Array.from(themeUniverse),
      matrix,
      summary,
      note
    }, { status:200 });

  } catch (e) {
    return NextResponse.json({
      profiles: [], theme_universe: [], matrix: [],
      summary:{ anchor_coverage:[], top_emergents:[] },
      note: e instanceof Error ? e.message : 'Profiles generation had an issue. Paste more notes or try again.'
    }, { status:200 });
  }
}
