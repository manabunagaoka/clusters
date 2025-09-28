import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

/* ---------- generic helpers ---------- */
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
const MERGE: Record<string,string> = {
  price_increase:'rising_costs', rising_prices:'rising_costs', too_expensive:'rising_costs',
  cost_pressure:'rising_costs', coordination_tool:'coordination_challenge',
  coordination_complexity:'coordination_challenge', complexity_of_arrangements:'coordination_challenge',
};
const canonical = (t:string) => MERGE[toSnakeStrict(t)] || toSnakeStrict(t);

/* small, domain-agnostic families used for counting & alignment */
function equivKey(t: string){
  const x = (t||'').toLowerCase().replace(/[^a-z0-9_]/g,'');
  if (['trustworthy_care','trust_issues','safety_concerns','privacy_concerns','trust_building'].includes(x)) return 'trustworthy_care';
  if (['rising_costs','price_sensitivity','financial_burden','affordability_challenge','affordability_concerns','cost_barrier','budget_constraints'].includes(x)) return 'rising_costs';
  if (['coordination_challenge','scheduling_frustration','scheduling_complexity','logistics_management','time_constraints'].includes(x)) return 'coordination_challenge';
  if (['option_overload','overwhelming_options','decision_fatigue','decision_challenge','decision_friction'].includes(x)) return 'option_overload';
  if (['info_fragmentation','content_fragmentation','information_fragmentation','content_discovery','limited_selection'].includes(x)) return 'info_fragmentation';
  if (['research_time_cost','information_overload','compare_time','research_burden','research_complexity'].includes(x)) return 'research_time_cost';
  if (['value_uncertainty','subscription_renewal','contract_renewal','streaming_value'].includes(x)) return 'value_uncertainty';
  return x;
}

/* segmentation: robust enough for paragraphs/bullets */
function normalizeNotes(raw:string){
  const chunks = (raw||'')
    .split(/\r?\n/)
    .flatMap(l => l.split(/(?<=[.!?])\s+(?=[A-Z(“"])/g))
    .flatMap(s => s.split(/•|–|- {1,3}|\u2022/g))
    .map(s => s.replace(/^\s*[\d\)\].-]+\s*/,'').trim())
    .filter(s => s.length >= 3);

  const out:string[] = [];
  for (const l of chunks){
    const t = l.replace(/\s+/g,' ').trim();
    if (t && (!out.length || out[out.length-1].toLowerCase() !== t.toLowerCase())) out.push(t);
  }
  return out.map((text, i)=>({ id:String(i+1), text }));
}

const FACET_BLOCKLIST = new Set(['snake_case','misc','unknown','general','other']);

function collectFacets(allTags: string[], anchorFamilies:Set<string>) {
  const fams = allTags.map(equivKey);
  const c = new Map<string,number>();
  for (const f of fams) if (!anchorFamilies.has(f) && !FACET_BLOCKLIST.has(f)) c.set(f, (c.get(f)||0)+1);
  return Array.from(c.entries()).sort((a,b)=>b[1]-a[1]);
}

function summarizeFromQuotes(anchors:string[], quotes:{tags:string[]}[]){
  const aFamilies = new Set(anchors.map(equivKey));
  const cover = new Map<string,number>(), emerg = new Map<string,number>();
  for (const q of quotes){
    const fams = Array.from(new Set((q.tags||[]).map(equivKey)));
    for (const f of fams){
      if (aFamilies.has(f)) cover.set(f, (cover.get(f)||0)+1);
      else if (!FACET_BLOCKLIST.has(f)) emerg.set(f, (emerg.get(f)||0)+1);
    }
  }
  const toArr = (m:Map<string,number>) =>
    Array.from(m.entries()).sort((a,b)=> b[1]-a[1] || a[0].localeCompare(b[0]))
      .map(([tag,count])=>({ tag, count }));
  return { anchor_coverage: toArr(cover), top_emergents: toArr(emerg).slice(0,12) };
}

/* JTBD normalization: turn messy notes into structured interviews + tags referencing original ids */
type Quote = { id: string; text: string; tags: string[] };
type Bucket = { ids: string[]; quotes: Quote[] };
type JTBDInterview = {
  who?: string;
  context?: { role?: string; geo?: string; work_pattern?: string; language_pref?: string };
  struggling_moment?: string;
  jobs_to_be_done?: string[];
  pains?: Array<{ tag?: string; line_ids?: string[] }>;
  workarounds?: Array<{ text?: string; line_ids?: string[] }>;
  selection_criteria?: string[];
  anxieties?: string[];
  outcomes?: string[];
};
type JTBD = { interviews?: JTBDInterview[]; quote_tags?: Array<{ id?: string|number; tags?: Array<string> }> };

async function jtbden(rawLines:{id:string,text:string}[], client:OpenAI){
  const lines = rawLines.map(l => `${l.id}. ${l.text}`).join('\n');
  const sys = `
Normalize messy interview notes into a JTBD schema, referencing original line ids.
Return STRICT JSON ONLY:

{
  "interviews":[
    {
      "who": "short",
      "context": {"role":"","geo":"","work_pattern":"","language_pref":""},
      "struggling_moment": "one sentence",
      "jobs_to_be_done": ["verb phrases"],
      "pains": [{"tag":"snake_case","line_ids":["1","5"]}],
      "workarounds": [{"text":"verbatim", "line_ids":["3"]}],
      "selection_criteria": ["..."],
      "anxieties": ["..."],
      "outcomes": ["..."]
    }
  ],
  "quote_tags":[ {"id":"1","tags":["snake_case","..."]} ]  // tag the original lines by id
}

Guidelines:
- Use only tags that are short, domain-agnostic noun phrases (snake_case, max 3 words).
- Prefer anchor-like families when applicable (trustworthy_care, rising_costs, coordination_challenge); add facet tags as needed (bilingual_support, medical_awareness, household_support, community_support, info_fragmentation, option_overload, research_time_cost, etc).
- Do NOT invent content; quote_tags.id must reference existing line ids.
  `.trim();

  const r = await client.chat.completions.create({
    model:'gpt-4o-mini', temperature:0.2, response_format:{type:'json_object'},
    messages:[
      { role:'system', content: sys },
      { role:'user', content: `LINES (id. text):\n${lines}` }
    ]
  });

  let parsed: JTBD = {};
  try { parsed = JSON.parse(r.choices?.[0]?.message?.content || '{}') as JTBD; } catch {}
  const quoteTagsRaw = parsed?.quote_tags;
  const tagById = new Map<string,string[]>();
  const quoteTagsList = Array.isArray(quoteTagsRaw) ? quoteTagsRaw : [];
  for (const rec of quoteTagsList){
    const id = typeof rec?.id === 'string' || typeof rec?.id === 'number' ? String(rec.id) : '';
    const tags = Array.isArray(rec?.tags) ? rec!.tags!.map((t) => canonical(String(t))) : [];
    if (id) tagById.set(id, tags);
  }
  return { jtbd: parsed, tagById };
}

/* summarize emergent trends, natural language (no snake_case in paragraph) */
async function emergentSummary(quotes:Quote[], anchorFamilies:Set<string>, client:OpenAI){
  if (!quotes.length) return { paragraph:'', bullets:[] as {facet:string, explanation:string}[] };
  const facetCounts = collectFacets(quotes.flatMap(q=>q.tags||[]), anchorFamilies); // sorted
  const topPairs = facetCounts.slice(0,3);
  const topList = topPairs.map(([t,c]) => `${t} (${c})`).join(', ');
  const sample = quotes.slice(0,10).map(q=>`- ${q.text}`).join('\n');
  const sys = `
Return STRICT JSON ONLY:
{
  "paragraph": "2–3 sentences in plain English that AVOID code-like labels (no snake_case). Start with a positive nod (anchors captured…). No invented numbers.",
  "bullets": [
    {"facet":"snake_case_label","explanation":"short human sentence grounded in the lines"},
    {"facet":"snake_case_label","explanation":"..."}
  ]
}`.trim();
  try{
    const r = await client.chat.completions.create({
      model:'gpt-4o-mini', temperature:0.2, response_format:{ type:'json_object' },
      messages:[
        { role:'system', content: sys },
        { role:'user', content: `Top facets with counts: ${topList || 'none'}\nSample lines (verbatim):\n${sample}` }
      ]
    });
    const j = JSON.parse(r.choices?.[0]?.message?.content || '{}');
    return {
      paragraph: String(j?.paragraph || ''),
      bullets: Array.isArray(j?.bullets)
        ? (j.bullets as unknown[]).slice(0,3).map((b) => {
            const rec = b as { facet?: unknown; explanation?: unknown };
            return { facet: String(rec?.facet || ''), explanation: String(rec?.explanation || '') };
          })
        : []
    };
  } catch { return { paragraph:'', bullets:[] }; }
}

/* dominant anchor picker for a quote */
function dominantAnchorFamily(tags: string[], anchorFamilies: Set<string>, anchorOrder: string[]) {
  const fams = tags.map(equivKey);
  const counts = new Map<string,number>();
  for (const f of fams) counts.set(f, (counts.get(f)||0)+1);
  const anchorCounts = Array.from(counts.entries()).filter(([f]) => anchorFamilies.has(f));
  if (anchorCounts.length === 0) return '';
  anchorCounts.sort((a,b) => b[1]-a[1] || anchorOrder.indexOf(a[0]) - anchorOrder.indexOf(b[0]));
  return anchorCounts[0][0];
}

// Light, domain-agnostic detector for anchor families from raw text
function detectAnchorFromText(text:string){
  const t = text.toLowerCase();
  // TRUST
  if (/\btrust|consistent|consistency|referral|re[-\s]?explain|rotation|rotating staff|different people\b/.test(t))
    return 'trustworthy_care';
  // COST
  if (/(?:\b(expensive|afford|budget|price|pricing|cost|costs|would pay|fee|fees)\b)|\$\s*\d+/.test(text))
    return 'rising_costs';
  // COORDINATION / SCHEDULING
  if (/\bschedul|flexible|random times|non[-\s]?traditional|until midnight|overnight|12[-\s]?hour|shift|handoff\b/.test(t))
    return 'coordination_challenge';
  return '';
}

// --- JTBD field collection helpers ---
function uniq(arr:string[], limit=6){
  const seen = new Set<string>();
  const out:string[] = [];
  for (const s of arr.map(x=>String(x||'').trim()).filter(Boolean)){
    const k = s.toLowerCase();
    if (!seen.has(k)){ seen.add(k); out.push(s); if (out.length>=limit) break; }
  }
  return out;
}

// Build a map lineId -> interview index using JTBD fields that carry line_ids
function buildLineToInterviewMap(jtbd: JTBD){
  const map = new Map<string, number>();
  const ivs: JTBDInterview[] = Array.isArray(jtbd?.interviews) ? (jtbd.interviews as JTBDInterview[]) : [];
  ivs.forEach((iv, idx) => {
    const pains = Array.isArray(iv?.pains) ? iv.pains! : [];
    const works = Array.isArray(iv?.workarounds) ? iv.workarounds! : [];
    pains.forEach((p)=> (Array.isArray(p?.line_ids) ? p.line_ids! : []).forEach((id)=> map.set(String(id), idx)));
    works.forEach((w)=> (Array.isArray(w?.line_ids) ? w.line_ids! : []).forEach((id)=> map.set(String(id), idx)));
  });
  return { map, interviews: ivs };
}

function collectJTBDForBucket(memberIds:string[], jtbd: JTBD){
  const { map: lineToIv, interviews } = buildLineToInterviewMap(jtbd);
  const ivIdxs = new Set<number>();
  memberIds.forEach(id => { const idx = lineToIv.get(String(id)); if (typeof idx==='number') ivIdxs.add(idx); });
  const ivList: JTBDInterview[] = (ivIdxs.size ? Array.from(ivIdxs).map(i=>interviews[i]) : interviews).filter(Boolean) as JTBDInterview[];

  const roles    = uniq(ivList.map((iv)=> iv?.context?.role || ''));
  const geos     = uniq(ivList.map((iv)=> iv?.context?.geo || ''));
  const patterns = uniq(ivList.map((iv)=> iv?.context?.work_pattern || ''));
  const langs    = uniq(ivList.map((iv)=> iv?.context?.language_pref || ''));
  const whos     = uniq(ivList.map((iv)=> iv?.who || ''));
  const struggles= uniq(ivList.map((iv)=> iv?.struggling_moment || ''));
  const jobs     = uniq(ivList.flatMap((iv)=> Array.isArray(iv?.jobs_to_be_done)? iv.jobs_to_be_done!.map(x=>x||'') : []));
  const works    = uniq(ivList.flatMap((iv)=> Array.isArray(iv?.workarounds)? iv.workarounds!.map((w)=> w?.text || '') : []));
  const criteria = uniq(ivList.flatMap((iv)=> Array.isArray(iv?.selection_criteria)? iv.selection_criteria! : []));
  const anx      = uniq(ivList.flatMap((iv)=> Array.isArray(iv?.anxieties)? iv.anxieties! : []));
  const outcomes = uniq(ivList.flatMap((iv)=> Array.isArray(iv?.outcomes)? iv.outcomes! : []));

  return {
    who: whos,
    context: { role: roles, geo: geos, work_pattern: patterns, language_pref: langs },
    struggling_moments: struggles,
    jobs,
    workarounds: works,
    selection_criteria: criteria,
    anxieties: anx,
    outcomes
  };
}

export async function POST(req: NextRequest) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ note:'OPENAI_API_KEY missing' }, { status:500 });
    }
    const body = await req.json();
    const ps_tags: string[] = Array.isArray(body?.ps_tags) ? body.ps_tags : [];
    const raw_text: string = String(body?.raw_text || '');
    const notes = normalizeNotes(raw_text);
    const anchors = ps_tags.map(canonical);
    const anchorFamilies = new Set(anchors.map(equivKey));
    const anchorOrder = anchors.map(equivKey);

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    // 1) JTBD normalize (cache jtbd for downstream JTBD fields)
    const { jtbd, tagById } = await jtbden(notes, client);

    // 2) Build quotes with tags (verbatim text by id)
    const normQuotes: Quote[] = notes.map(n => ({ id: n.id, text: n.text, tags: (tagById.get(n.id) || []).map(canonical) }));

    // Fallback tag helpers
    const fallbackTags = (text:string): string[] => {
      const t = text.toLowerCase();
      const tags: string[] = [];
      if (/(?:\b(expensive|afford|budget|price|pricing|cost|costs|would pay|fee|fees)\b)|\$\s*\d+/.test(text)) tags.push('rising_costs');
      if (/\bschedul|shift|handoff|coordination|coordinat|calendar|availability/.test(t)) tags.push('coordination_challenge');
      if (/\btrust|consistent|consistency|referral|verify|verified|background check|safe|safety|privacy/.test(t)) tags.push('trustworthy_care');
      return Array.from(new Set(tags));
    };
    const maybeAddCostTag = (text:string, tags:string[]) => {
      if (!/(?:\b(expensive|afford|budget|price|pricing|cost|costs|would pay|fee|fees)\b)|\$\s*\d+/.test(text)) return;
      if (!tags.includes('rising_costs')) tags.push('rising_costs');
    };

    // Ensure each quote has a chance to map into an anchor family
    for (const q of normQuotes) {
      if (!q.tags || q.tags.length === 0) q.tags = fallbackTags(q.text);
      maybeAddCostTag(q.text, q.tags);
      const fams = (q.tags||[]).map(equivKey);
      const hasAnchor = fams.some(f => anchorFamilies.has(f));
      if (!hasAnchor) {
        const detected = detectAnchorFromText(q.text);
        if (detected) q.tags.push(detected);
      }
    }

    // 3) Exclusive assignment to anchor buckets
    const buckets = new Map<string, Bucket>();
    const bucketIdSet = new Set<string>();
    for (const q of normQuotes) {
      const fam = dominantAnchorFamily(q.tags || [], anchorFamilies, anchorOrder);
      if (fam) {
        if (!buckets.has(fam)) buckets.set(fam, { ids:[], quotes:[] });
        buckets.get(fam)!.ids.push(q.id);
        buckets.get(fam)!.quotes.push(q);
        bucketIdSet.add(q.id);
      }
    }
    const emergentQuotes = normQuotes.filter(q => !bucketIdSet.has(q.id));

    // 4) Create cards: one per anchor family present
    async function summarizeBucket(nameFam:string, items:{ids:string[], quotes:Quote[]}){
      const lines = items.quotes.slice(0, 12).map(q => `- ${q.text}`).join('\n');
      const facets = collectFacets(items.quotes.flatMap(q=>q.tags||[]), anchorFamilies).slice(0,4).map(([t])=>t).join(', ');
      const r = await client.chat.completions.create({
        model:'gpt-4o-mini', temperature:0.2, response_format:{type:'json_object'},
        messages:[
          {role:'system', content:`Return STRICT JSON: {"title":"...", "one_liner":"..."}.
Write a short theme-oriented title and ONE persona sentence that includes at most two concrete specifics (from lines or facets).`},
          {role:'user', content:`ANCHOR: ${nameFam.replace(/_/g,' ')}\nFACETS: ${facets||'none'}\nLINES:\n${lines}`}
        ],
      });
      try {
        const j = JSON.parse(r.choices?.[0]?.message?.content || '{}');
        return { title: String(j?.title || nameFam.replace(/_/g,' ')), one_liner: String(j?.one_liner || '') };
      } catch { return { title: nameFam.replace(/_/g,' '), one_liner: '' }; }
    }

    const patternsOut: Array<{
      id: string;
      kind: 'pattern';
      name: string;
      who_where?: string;
      one_liner?: string;
      core_goals: string[];
      pains: string[];
      behaviors: string[];
      likely_tags: string[];
      top_tags: string[];
      member_ids: string[];
      count: number;
      jtbd_fields?: {
        who?: string[];
        context?: { role?: string[]; geo?: string[]; work_pattern?: string[]; language_pref?: string[] };
        struggling_moments?: string[];
        jobs?: string[];
        workarounds?: string[];
        selection_criteria?: string[];
        anxieties?: string[];
        outcomes?: string[];
      };
    }> = [];
    for (const fam of Array.from(buckets.keys())) {
      const b = buckets.get(fam)!;
      const { title, one_liner } = await summarizeBucket(fam, b);
      const jtbdFields = collectJTBDForBucket(b.ids, jtbd);
      patternsOut.push({
        id: fam,
        kind: 'pattern',
        name: title,
        who_where: undefined,
        one_liner,
        core_goals: [],
        pains: [fam],
        behaviors: [],
        likely_tags: [fam],
        top_tags: [fam],
        member_ids: b.ids,
        count: b.ids.length,
        jtbd_fields: jtbdFields
      });
    }

    // Evidence = exclusive by bucket; primary_tag = its anchor family; carry all tags
    const evidence = Array.from(buckets.entries()).flatMap(([fam, b]) =>
      b.quotes.map(q => ({
        id: q.id, text: q.text, primary_tag: canonical(fam), approved: true, tags: (q.tags||[]).map(canonical)
      }))
    );

    // 5) Overlap/emergents and trends
    const { anchor_coverage, top_emergents } = summarizeFromQuotes(anchors, normQuotes);
    const emergent = await emergentSummary(emergentQuotes, anchorFamilies, client);

    return NextResponse.json({
      summary: { patterns: patternsOut.map(p => ({ name:p.name, count:p.count })), anchor_coverage, top_emergents },
      cards: { pattern: patternsOut },
      archetypes: [{ id:'1', profile:{}, evidence }],
      emergent,                          // { paragraph, bullets }
      dropped_items: 0
    }, { status:200 });

  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Archetype generation had a problem. Try refining anchors or pasting more notes.';
    return NextResponse.json({
      note: msg,
      summary: { anchor_coverage: [], top_emergents: [] },
      cards: { pattern: [] },
      archetypes: [{ id: '1', profile: {}, evidence: [] }],
      emergent: { paragraph: '', bullets: [] },
      dropped_items: 0,
    }, { status: 200 });
  }
}
 
