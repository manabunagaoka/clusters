import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import {
  CORE_DIMENSIONS,
  toSnake, foldToUniversalsWithFacetWeights, normalizeWeights, pickCriticalFacets
} from '@/app/(clusters)/lib/universals';

/* ------------ Segmentation ------------ */
function segmentInterviews(raw:string){
  const hasHeaders=/(^|\n)\s*(interview|participant)\s*\d+/i.test(raw);
  let blocks:string[]=[];
  if (hasHeaders){ blocks = raw.split(/(?:^|\n)(?=(?:\s*)(?:interview|participant)\s*\d+)/ig); }
  else if (/\n\s*\n/.test(raw)){ blocks = raw.split(/\n\s*\n+/); }
  else { blocks = [raw]; }
  return blocks.map(s=>s.trim()).filter(Boolean).slice(0,15).map((text,i)=>({ id:String(i+1), text }));
}

/* ------------ Timeouts & pool ------------ */
function withTimeout<T>(p:Promise<T>, ms:number, label='op'):Promise<T>{
  return new Promise((resolve,reject)=>{
    const id=setTimeout(()=>reject(new Error(`${label} timeout after ${ms}ms`)),ms);
    p.then(v=>{clearTimeout(id); resolve(v);}).catch(e=>{clearTimeout(id); reject(e);});
  });
}
async function poolMap<T,R>(items:T[], limit:number, fn:(t:T, idx:number)=>Promise<R>):Promise<R[]>{
  const out:R[]=[]; let i=0;
  async function run():Promise<void>{
    const idx=i++; if(idx>=items.length) return;
    out[idx] = await fn(items[idx], idx);
    await run();
  }
  await Promise.all(Array.from({length:Math.min(limit,items.length)}, run));
  return out;
}

/* ------------ LLM helpers ------------ */
async function jtbdNormalize(client:OpenAI, id:string, text:string): Promise<Record<string, unknown>>{
  const sys = `
Normalize an interview into JTBD fields and tag internal sentences.
STRICT JSON ONLY:
{"who":"","context":{"role":"","geo":"","work_pattern":"","language_pref":""},"struggling_moment":"","jobs_to_be_done":[],"pains":[{"tag":"snake_case","confidence":0.0}],"workarounds":[],"selection_criteria":[],"anxieties":[],"outcomes":[],"sentences":[{"text":"verbatim","tags":["snake_case"]}]}
No invented numbers. Keep sentences verbatim (light trims ok).
`.trim();
  const r = await withTimeout(
    client.chat.completions.create({
      model:'gpt-4o-mini', temperature:0.2, max_tokens:700, response_format:{type:'json_object'},
      messages:[ {role:'system',content:sys}, {role:'user',content:`INTERVIEW ${id}\n${text.slice(0,3000)}`} ]
    }),
    25000, 'jtbdNormalize'
  );
  let out:Record<string, unknown>={}; try{ out=JSON.parse(r.choices?.[0]?.message?.content||'{}'); }catch{}
  return out;
}

async function miniPS(client:OpenAI, fields:Record<string, unknown>): Promise<string>{
  const sys = `Write a 2–3 sentence narrative in plain English. Include name + context if present (role, work pattern), then the struggle and desired outcome. No snake_case. No invented numbers.`.trim();
  const user=JSON.stringify({
    who:fields.who||'',
    context:fields.context||{},
    struggling_moment:fields.struggling_moment||'',
    outcomes:fields.outcomes||[]
  },null,2);
  const r = await withTimeout(
    client.chat.completions.create({
      model:'gpt-4o-mini', temperature:0.2, max_tokens:200,
      messages:[ {role:'system',content:sys}, {role:'user',content:`Make one concise narrative:\n${user}`} ]
    }),
    15000, 'miniPS'
  );
  return (r.choices?.[0]?.message?.content||'').trim();
}

function fallbackNarrative(fields:Record<string, unknown>, text:string): string{
  const who = fields?.who || '';
  const ctx = fields?.context && typeof fields.context === 'object' && fields.context !== null ? 
    Object.values(fields.context as Record<string, unknown>).filter(Boolean).join(', ') : '';
  const struggle = typeof fields?.struggling_moment === 'string' ? fields.struggling_moment : '';
  const want = Array.isArray(fields?.outcomes) && fields.outcomes.length > 0 ? String(fields.outcomes[0]) : '';
  const lead = [who, ctx].filter(Boolean).join(' — ');
  const cleaned = [lead, struggle, want?`Ultimately, ${want}`:''].filter(Boolean).join(' ').trim();
  return cleaned || text.slice(0,220);
}

/* ------------ Main ------------ */
export async function POST(req: NextRequest) {
  try {
    const { notes = "" } = await req.json() || {};
    const blocks = segmentInterviews(String(notes||''));

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({
        profiles:[], theme_universe:[], matrix:[],
        summary:{ anchor_coverage:[], top_emergents:[] },
        note:'OPENAI_API_KEY missing'
      }, { status:200 });
    }
    if (!blocks.length) {
      return NextResponse.json({
        profiles:[], theme_universe:[], matrix:[],
        summary:{ anchor_coverage:[], top_emergents:[] },
        note:'Paste your JTBD interview notes to generate profiles.'
      }, { status:200 });
    }

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const profiles: Record<string, unknown>[] = [];
    const matrix: [string, Record<string, number>][] = [];
    const totals = new Map<string, number>(); // core totals for summary
    const facetTotals = new Map<string, number>(); // facets across profiles
    const universe = new Set<string>();

    await poolMap(blocks, 3, async (block) => {
      try {
        const jtbd = await jtbdNormalize(client, block.id, block.text);
        const sentences = Array.isArray(jtbd?.sentences) ? jtbd.sentences : [];

        // collect raw tags from JTBD
        const raw:string[] = [];
        const pains = Array.isArray(jtbd?.pains) ? jtbd.pains : [];
        pains.forEach((p)=>{ 
          if(p && typeof p === 'object' && 'tag' in p && p.tag) {
            raw.push(toSnake(String(p.tag))); 
          }
        });
        sentences.forEach((s)=> {
          if(s && typeof s === 'object' && 'tags' in s) {
            const tags = Array.isArray(s.tags) ? s.tags : [];
            tags.forEach((t: unknown)=> raw.push(toSnake(String(t))));
          }
        });

        // Map to universals → core & facet weights
        const { coreWeights, facetWeights } = foldToUniversalsWithFacetWeights(raw);

        // ensure at least one core by light fallback
        if (coreWeights.size === 0) {
          // try to infer from JTBD fields text blobs
          const workarounds = Array.isArray(jtbd?.workarounds) ? jtbd.workarounds : [];
          const anxieties = Array.isArray(jtbd?.anxieties) ? jtbd.anxieties : [];
          const txt = [
            typeof jtbd?.struggling_moment === 'string' ? jtbd.struggling_moment : '',
            ...workarounds.map(w => String(w)),
            ...anxieties.map(a => String(a))
          ].join(' ');
          const t = txt.toLowerCase();
          if (/(trust|consisten|referral)/.test(t)) coreWeights.set('trust', 1);
          if (/(cost|price|afford|expens|budget)/.test(t)) coreWeights.set('cost', 1);
          if (/(schedul|overnight|flex)/.test(t)) coreWeights.set('flexibility', 1);
        }

        // compress to coarse magnitudes
        const theme_weights = normalizeWeights(coreWeights);
        // pick critical facets (max 3) for display ONLY
        const criticalFacets = pickCriticalFacets(facetWeights, 3);

        // update summary totals/universe
        Object.keys(theme_weights).forEach(k=>{
          totals.set(k, (totals.get(k)||0) + theme_weights[k]);
          universe.add(k);
        });
        criticalFacets.forEach(f => { facetTotals.set(f, (facetTotals.get(f)||0) + 1); universe.add(f); });

        // Narrative includes name + context
        let narrative = '';
        try { narrative = await miniPS(client, jtbd); } catch { narrative = fallbackNarrative(jtbd, block.text); }

        profiles.push({
          id: block.id,
          title: '',
          narrative,
          themes: { core: Array.from(coreWeights.keys()), facets: criticalFacets },
          theme_weights,
          jtbd: {
            // we keep findings, but DO NOT show "Who" heading in UI
            who: typeof jtbd?.who === 'string' ? jtbd.who : '',
            context: jtbd?.context && typeof jtbd.context === 'object' ? jtbd.context as Record<string, unknown> : {},
            struggling_moment: typeof jtbd?.struggling_moment === 'string' ? jtbd.struggling_moment : '',
            jobs: Array.isArray(jtbd?.jobs_to_be_done) ? jtbd.jobs_to_be_done.map(j => String(j)) : [],
            workarounds: Array.isArray(jtbd?.workarounds) ? jtbd.workarounds.map(w => String(w)) : [],
            selection_criteria: Array.isArray(jtbd?.selection_criteria) ? jtbd.selection_criteria.map(s => String(s)) : [],
            anxieties: Array.isArray(jtbd?.anxieties) ? jtbd.anxieties.map(a => String(a)) : [],
            outcomes: Array.isArray(jtbd?.outcomes) ? jtbd.outcomes.map(o => String(o)) : []
          }
        });

        matrix.push([block.id, theme_weights]);
      } catch {
        // Partial failure: still emit a readable profile
        profiles.push({ id:block.id, title:'', narrative:block.text.slice(0,220), themes:{ core:[], facets:[] }, theme_weights:{}, jtbd:{} });
        matrix.push([block.id, {}]);
      }
    });

    // sort by interview order
    profiles.sort((a,b)=> Number(a.id) - Number(b.id));
    matrix.sort((a,b)=> Number(a[0]) - Number(b[0]));

    // page summary (for diagnostics / instructor use)
    const toArr = (m:Map<string,number>) =>
      Array.from(m.entries()).sort((a,b)=> b[1]-a[1] || a[0].localeCompare(b[0]))
        .map(([tag,count])=>({ tag, count: Number(count.toFixed(2)) }));

    const summary = {
      anchor_coverage: toArr(totals).filter(x => (CORE_DIMENSIONS as string[]).includes(x.tag)),
      top_emergents: toArr(facetTotals).slice(0,12)
    };

    return NextResponse.json({
      profiles,
      theme_universe: Array.from(universe),
      matrix,
      summary,
      note: ''
    }, { status:200 });

  } catch (e: unknown) {
    return NextResponse.json({
      profiles:[], theme_universe:[], matrix:[],
      summary:{ anchor_coverage:[], top_emergents:[] },
      note: e instanceof Error ? e.message : 'Profiles generation had an issue. Paste JTBD interview notes and try again.'
    }, { status:200 });
  }
}