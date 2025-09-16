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
  let out: Record<string, unknown>={}; try{ out=JSON.parse(r.choices?.[0]?.message?.content||'{}'); }catch{}
  return out;
}

async function miniPS(client:OpenAI, fields:Record<string, unknown>){
  const sys = `Write a 2–3 sentence narrative. Include name + context if present (role, work pattern), then the struggle and desired outcome. No snake_case. No invented numbers.`.trim();
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

function fallbackNarrative(fields:Record<string, unknown>, text:string){
  const who = String(fields?.who||'').trim();
  const ctx = fields?.context && typeof fields.context === 'object' ? Object.values(fields.context).filter(Boolean).join(', ') : '';
  const struggle = String(fields?.struggling_moment||'').trim();
  const outcomes = Array.isArray(fields?.outcomes) ? fields.outcomes : [];
  const want = outcomes.length > 0 ? String(outcomes[0] || '').trim() : '';
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
    const matrix: unknown[] = [];
    const totals = new Map<string, number>();     // core totals for summary
    const facetTotals = new Map<string, number>(); // facets across profiles
    const universe = new Set<string>();

    await poolMap(blocks, 3, async (block) => {
      try {
        const jtbdRaw = await jtbdNormalize(client, block.id, block.text);

        // Sanitize all JTBD arrays to strings — prevents React object-child crashes
        const sanitizeArr = (a:unknown)=> Array.isArray(a) ? a.map((x:unknown)=> String((x as Record<string, unknown>)?.text ?? x ?? '')).filter(Boolean) : [];
        const jtbd = {
          who: String(jtbdRaw?.who || ''),
          context: typeof jtbdRaw?.context === 'object' && jtbdRaw?.context ? jtbdRaw.context : {},
          struggling_moment: String(jtbdRaw?.struggling_moment || ''),
          jobs_to_be_done: sanitizeArr(jtbdRaw?.jobs_to_be_done),
          workarounds: sanitizeArr(jtbdRaw?.workarounds),
          selection_criteria: sanitizeArr(jtbdRaw?.selection_criteria),
          anxieties: sanitizeArr(jtbdRaw?.anxieties),
          outcomes: sanitizeArr(jtbdRaw?.outcomes),
          sentences: Array.isArray(jtbdRaw?.sentences) ? jtbdRaw.sentences : []
        };

        // Collect raw tags from JTBD pains + sentences
        const raw:string[] = [];
        (Array.isArray(jtbdRaw?.pains) ? jtbdRaw.pains : []).forEach((p:unknown)=>{ 
          const pain = p as Record<string, unknown>;
          if(pain?.tag) raw.push(toSnake(String(pain.tag))); 
        });
        jtbd.sentences.forEach((s:unknown)=> {
          const sentence = s as Record<string, unknown>;
          (Array.isArray(sentence?.tags)? sentence.tags : []).forEach((t:unknown)=> raw.push(toSnake(String(t))));
        });

        // Map to universals → core & facet weights
        const { coreWeights, facetWeights } = foldToUniversalsWithFacetWeights(raw);

        // if no cores, infer from JTBD text
        if (coreWeights.size === 0) {
          const txt = [jtbd.struggling_moment, ...jtbd.workarounds, ...jtbd.anxieties].join(' ').toLowerCase();
          if (/(trust|consisten|referral)/.test(txt)) coreWeights.set('trust' as typeof CORE_DIMENSIONS[number], 1);
          if (/(cost|price|afford|expens|budget)/.test(txt)) coreWeights.set('cost' as typeof CORE_DIMENSIONS[number], 1);
          if (/(schedul|overnight|flex)/.test(txt)) coreWeights.set('flexibility' as typeof CORE_DIMENSIONS[number], 1);
        }

        // compress to coarse magnitudes & pick critical facets
        const theme_weights = normalizeWeights(coreWeights);
        const coreThemes = Array.from(coreWeights.keys());
        const criticalFacets = pickCriticalFacets(facetWeights, 3);

        // summary totals/universe
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
          themes: { core: coreThemes, facets: criticalFacets },
          theme_weights,
          jtbd: {
            who: jtbd.who,
            context: jtbd.context,
            struggling_moment: jtbd.struggling_moment,
            jobs: jtbd.jobs_to_be_done,
            workarounds: jtbd.workarounds,
            selection_criteria: jtbd.selection_criteria,
            anxieties: jtbd.anxieties,
            outcomes: jtbd.outcomes
          }
        });

        matrix.push([block.id, theme_weights]);
      } catch {
        profiles.push({ id:block.id, title:'', narrative:block.text.slice(0,220), themes:{ core:[], facets:[] }, theme_weights:{}, jtbd:{} });
        matrix.push([block.id, {}]);
      }
    });

    // sort by interview order
    profiles.sort((a,b)=> Number((a as Record<string, unknown>).id) - Number((b as Record<string, unknown>).id));
    matrix.sort((a:unknown,b:unknown)=> Number((a as unknown[])[0]) - Number((b as unknown[])[0]));

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
      note: (e as Error)?.message || 'Profiles generation had an issue. Paste JTBD interview notes and try again.'
    }, { status:200 });
  }
}
