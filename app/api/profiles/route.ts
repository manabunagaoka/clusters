import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import {
  CORE_DIMENSIONS, FACET_BLOCKLIST,
  toSnake, foldToUniversals, normalizeWeights
} from '@/app/(clusters)/lib/universals';

/* ---------- Segmentation & helpers ---------- */
function normalizeBlocks(raw:string){
  const hasHeaders=/(^|\n)\s*(interview|participant)\s*\d+/i.test(raw);
  let blocks:string[]=[];
  if (hasHeaders){ blocks = raw.split(/(?:^|\n)(?=(?:\s*)(?:interview|participant)\s*\d+)/ig); }
  else if (/\n\s*\n/.test(raw)){ blocks = raw.split(/\n\s*\n+/); }
  else { blocks = [raw]; }
  return blocks.map(s=>s.trim()).filter(Boolean).slice(0,15).map((text,i)=>({ id:String(i+1), text }));
}

function detectAnchorFromText(text:string): string {
  const t=text.toLowerCase();
  if (/\btrust|consistent|referral|rotation|re[-\s]?explain\b/.test(t)) return 'trust';
  if (/\b(expensive|afford|budget|price|pricing|cost|costs|fee|fees|would pay)\b/.test(t) || /\$\s*\d+/.test(text)) return 'cost';
  if (/\bschedul|flexible|random times|non[-\s]?traditional|until midnight|overnight|12[-\s]?hour|shift|handoff\b/.test(t)) return 'flexibility';
  if (/\btoo many|scrolling|so many options|keep comparing\b/.test(t)) return 'choice';
  if (/\bwhere.*find|which app|limited selection|content.+scattered|discover\b/.test(t)) return 'information';
  if (/\bresearch|reading reviews|hours comparing|information overload\b/.test(t)) return 'time';
  if (/\bworth it|renew|renewal|cancel\b/.test(t)) return 'value';
  return '';
}

/* ---------- Timeouts & concurrency ---------- */
function withTimeout<T>(p:Promise<T>, ms:number, label='op'):Promise<T>{
  return new Promise((resolve,reject)=>{
    const id=setTimeout(()=>reject(new Error(`${label} timeout after ${ms}ms`)),ms);
    p.then(v=>{clearTimeout(id); resolve(v);}).catch(e=>{clearTimeout(id); reject(e);});
  });
}
async function poolMap<T,R>(items:T[], limit:number, fn:(t:T, idx:number)=>Promise<R>):Promise<R[]>{
  const out:R[]=[]; let i=0;
  async function run(k:number):Promise<void>{
    const idx=i++; if(idx>=items.length) return;
    out[idx] = await fn(items[idx], idx);
    await run(k);
  }
  await Promise.all(Array.from({length:Math.min(limit,items.length)},(_,k)=>run(k)));
  return out;
}

/* ---------- LLM helpers ---------- */
interface JTBDContext { role?: string; geo?: string; work_pattern?: string; language_pref?: string }
interface JTBDSentence { text?: string; tags?: string[] }
interface JTBDPayload {
  who?: string;
  context?: JTBDContext;
  struggling_moment?: string;
  jobs_to_be_done?: string[];
  pains?: Array<{ tag?: string; confidence?: number }>;
  workarounds?: string[];
  selection_criteria?: string[];
  anxieties?: string[];
  outcomes?: string[];
  sentences?: JTBDSentence[];
  [k: string]: unknown;
}
interface GeneratedProfile {
  id: string;
  title: string;
  narrative: string;
  themes: { core: string[]; facets: string[] };
  theme_weights: Record<string, number>;
  jtbd: {
    who?: string;
    context?: JTBDContext;
    struggling_moment?: string;
    jobs?: string[];
    workarounds?: string[];
    selection_criteria?: string[];
    anxieties?: string[];
    outcomes?: string[];
  };
}

async function jtbdNormalize(client:OpenAI, id:string, text:string): Promise<JTBDPayload>{
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
  let out: JTBDPayload = {}; try{ out=JSON.parse(r.choices?.[0]?.message?.content||'{}'); }catch{}
  return out;
}
async function miniPS(client:OpenAI, fields:JTBDPayload){
  const sys=`Rewrite JTBD fields into one 2–3 sentence narrative (plain English). No snake_case. No invented numbers.`.trim();
  const user=JSON.stringify({
    who:fields.who||'',context:fields.context||{},struggling_moment:fields.struggling_moment||'',
    jobs_to_be_done:fields.jobs_to_be_done||[],outcomes:fields.outcomes||[]
  },null,2);
  const r = await withTimeout(
    client.chat.completions.create({
      model:'gpt-4o-mini', temperature:0.2, max_tokens:180,
      messages:[ {role:'system',content:sys}, {role:'user',content:`Make one concise narrative:\n${user}`} ]
    }),
    15000, 'miniPS'
  );
  return (r.choices?.[0]?.message?.content||'').trim();
}
function fallbackNarrative(fields:JTBDPayload, text:string){
  const who = fields?.who || '';
  const struggle = fields?.struggling_moment || '';
  const want = (fields?.outcomes||[])[0] || '';
  const cleaned = (who||struggle||want)
    ? `${who? who + ' — ':''}${struggle||''}${(struggle&&want)?' ':' '}${want? ('Ultimately, ' + want):''}`.trim()
    : text.slice(0,220);
  return cleaned || 'Interview summary unavailable.';
}

/* ---------- Main ---------- */
export async function POST(req: NextRequest) {
  try {
    const { notes = "" } = await req.json() || {};
    const blocks = normalizeBlocks(String(notes||''));
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ profiles:[], theme_universe:[], matrix:[], summary:{anchor_coverage:[], top_emergents:[]}, note:'OPENAI_API_KEY missing' }, { status:200 });
    }
    if (!blocks.length) {
      return NextResponse.json({ profiles:[], theme_universe:[], matrix:[], summary:{anchor_coverage:[], top_emergents:[]}, note:'Paste your JTBD interview notes to generate profiles.' }, { status:200 });
    }

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const profiles: GeneratedProfile[] = []; const matrix: Array<[string, Record<string, number>]> = [];
    const tagTotals = new Map<string, number>();   // accumulate final weights for summary
    const themeSet  = new Set<string>();           // expose theme_universe

    const results = await poolMap(blocks, 3, async (block) => {
      try {
        const jtbd = await jtbdNormalize(client, block.id, block.text);
        const sentences: JTBDSentence[] = Array.isArray(jtbd?.sentences) ? jtbd.sentences as JTBDSentence[] : [];

        // Collect raw tags from JTBD (pains + sentence tags)
        const raw:string[] = [];
  (Array.isArray(jtbd?.pains) ? jtbd.pains : []).forEach((p)=>{ if(p?.tag) raw.push(toSnake(p.tag)); });
  sentences.forEach((s)=> (Array.isArray(s?.tags)? s.tags : []).forEach((t)=> raw.push(toSnake(String(t)))));

        // Map to universals → core weights + facets
        const { coreWeights, facets } = foldToUniversals(raw);

        // If no core dimension inferred, detect from text to avoid orphan
        if (coreWeights.size === 0) {
          const det = detectAnchorFromText(block.text);
            if (det && (CORE_DIMENSIONS as string[]).includes(det)) {
              coreWeights.set(det as typeof CORE_DIMENSIONS[number], (coreWeights.get(det as typeof CORE_DIMENSIONS[number])||0) + 1);
            }
        }

        // Normalize to coarse magnitudes and build final sets
        const theme_weights = normalizeWeights(coreWeights);
        const coreThemes = Array.from(coreWeights.keys());
        const facetThemes = Array.from(facets).filter(f => !FACET_BLOCKLIST.has(f));

        // Update totals & universe (summary)
        Object.keys(theme_weights).forEach(k=>{
          tagTotals.set(k, (tagTotals.get(k)||0) + theme_weights[k]);
          themeSet.add(k);
        });
        facetThemes.forEach(f=> themeSet.add(f));

        // Mini narrative
        let narrative=''; try { narrative = await miniPS(client, jtbd); } catch { narrative = fallbackNarrative(jtbd, block.text); }

        // Push profile
        profiles.push({
          id: block.id,
          title: '',
          narrative,
          themes: { core: coreThemes, facets: facetThemes },
          theme_weights,
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

        // matrix row
        matrix.push([block.id, theme_weights]);
        return { ok:true };
      } catch(e) {
        profiles.push({ id:block.id, title:'', narrative:block.text.slice(0,220), themes:{ core:[], facets:[] }, theme_weights:{}, jtbd:{} } as GeneratedProfile);
        matrix.push([block.id, {}]);
        return { ok:false, note: e instanceof Error ? e.message : 'One interview failed to parse.' };
      }
    });

    // Deterministic order: by numeric id
    profiles.sort((a,b)=> Number(a.id) - Number(b.id));
  matrix.sort((a,b)=> Number(a[0]) - Number(b[0]));

    // Build summary from dimension totals
    const coreMap = new Map<string,number>();
    const facetMap= new Map<string,number>();
    tagTotals.forEach((count, tag) => {
      if ((CORE_DIMENSIONS as string[]).includes(tag)) coreMap.set(tag, (coreMap.get(tag)||0) + count);
      else if (!FACET_BLOCKLIST.has(tag)) facetMap.set(tag, (facetMap.get(tag)||0) + count);
    });
    const toArr = (m:Map<string,number>) =>
      Array.from(m.entries()).sort((a,b)=> b[1]-a[1] || a[0].localeCompare(b[0]))
        .map(([tag,count])=>({ tag, count: Number(count.toFixed(2)) }));

    const summary = { anchor_coverage: toArr(coreMap), top_emergents: toArr(facetMap).slice(0,12) };

    const anyFail = results.some(r=>!r?.ok);
    const note = anyFail
      ? 'Some interviews could not be fully parsed. Profiles are partially generated; you can still proceed.'
      : '';

    return NextResponse.json({
      profiles,
      theme_universe: Array.from(themeSet),
      matrix,
      summary,
      note
    }, { status:200 });

  } catch (e) {
    return NextResponse.json({
      profiles:[], theme_universe:[], matrix:[],
      summary:{ anchor_coverage:[], top_emergents:[] },
      note: e instanceof Error ? e.message : 'Profiles generation had an issue. Paste JTBD interview notes and try again.'
    }, { status:200 });
  }
}
