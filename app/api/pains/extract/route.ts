import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

/* ================= Core theme registry (single-word universals) ================= */
const CORES = [
  'cost','time','effort','quality','reliability','trust',
  'flexibility','choice','information','risk','support','access','value'
] as const;
type CoreId = typeof CORES[number];

// Reserved for future filtering of meta labels if needed.
// const BLOCKLIST = new Set(['snake_case','misc','unknown','general','other']);

/* Simple stem/keyword sets per core (domain-agnostic) */
const CORE_KEYWORDS: Record<CoreId, RegExp[]> = {
  cost:        [/cost|price|fee|budget|afford|pay|expens/i],
  time:        [/time|wait|speed|fast|slow|delay/i],
  effort:      [/effort|friction|hard|cumbersome|overhead/i],
  quality:     [/quality|fit|accur|good|bad|relevant/i],
  reliability: [/reliab|uptime|consisten|stable|dependable/i],
  trust:       [/trust|safety|privacy|credib|referral/i],
  flexibility: [/flex|schedul|shift|overnight|non[-\s]?traditional|adapt/i],
  choice:      [/option|choice|variety|compare|too many|scroll/i],
  information: [/info|content|find|discover|fragment|where.*find|limited selection/i],
  risk:        [/risk|uncertain|lock|renew|cancel|penalty/i],
  support:     [/support|help|service|assist/i],
  access:      [/access|coverage|eligib|inclusion|language|bilingual/i],
  value:       [/value|worth/i],
};

/* ================= Utils ================= */
function scoreHeuristic(ps: string): Record<CoreId, number> {
  const s = (ps||'').toLowerCase();
  const out = {} as Record<CoreId, number>;
  CORES.forEach(c => {
    const hits = CORE_KEYWORDS[c].reduce((n, rx) => n + (s.match(rx)?.length || 0), 0);
    out[c] = hits;
  });
  // normalize 0..1
  const max = Math.max(1, ...Object.values(out));
  CORES.forEach(c => out[c] = out[c] / max);
  return out;
}

async function withTimeout<T>(p: Promise<T>, ms: number, label='op'): Promise<T> {
  return new Promise((resolve, reject) => {
    const id = setTimeout(() => reject(new Error(`${label} timeout after ${ms}ms`)), ms);
    p.then(v => { clearTimeout(id); resolve(v); })
     .catch(e => { clearTimeout(id); reject(e); });
  });
}

async function scoreLLM(ps: string, client: OpenAI): Promise<{ scores: Record<CoreId, number>, why: Record<CoreId, string> }> {
  const system = `
You are scoring a short Problem Statement against a fixed list of universal themes.
Return STRICT JSON ONLY:

{
  "scores": { "cost": 0..1, "time": 0..1, ... },
  "why": { "cost": "short justification", "time": "..." }
}

Rules:
- Only these keys are allowed: cost,time,effort,quality,reliability,trust,flexibility,choice,information,risk,support,access,value
- Values in 0..1 (decimals ok). No other keys. Keep justifications short.
`.trim();

  const user = `Problem Statement:\n"""${ps.slice(0, 2000)}"""`;

  const resp = await withTimeout(
    client.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.2,
      max_tokens: 350,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user }
      ]
    }),
    12000,
    'llmScore'
  );

  type LLMJson = { scores?: Partial<Record<CoreId, unknown>>; why?: Partial<Record<CoreId, unknown>> };
  let parsed: LLMJson = {};
  try { parsed = JSON.parse(resp.choices?.[0]?.message?.content || '{}') as LLMJson; } catch {}
  const safeScores: Record<CoreId, number> = Object.create(null);
  const safeWhy: Record<CoreId, string> = Object.create(null);
  CORES.forEach(c => {
    const v = Number(parsed?.scores?.[c]);
    safeScores[c] = isFinite(v) ? Math.max(0, Math.min(1, v)) : 0;
    const w = String(parsed?.why?.[c] || '');
    safeWhy[c] = w.slice(0, 200);
  });
  return { scores: safeScores, why: safeWhy };
}

/* Pick 2–4 themes with diversity safeguards */
function pickThemes(consensus: Record<CoreId, number>, heur: Record<CoreId, number>, why: Record<CoreId, string>) {
  // threshold is gentle; we’ll still enforce diversity
  const THRESH = 0.25;
  const entries = CORES.map(c => [c, consensus[c]] as [CoreId, number])
                       .sort((a,b)=> b[1]-a[1]);

  // take themes above threshold
  let selected = entries.filter(([,v])=> v >= THRESH).slice(0, 4).map(([c])=> c);

  // Ensure at least 2 if PS clearly mentions >1 via heuristics
  if (selected.length < 2) {
    const sortedHeur = CORES.map(c => [c, heur[c]] as [CoreId, number])
                            .sort((a,b)=> b[1]-a[1]);
    const top2 = sortedHeur.slice(0,2).filter(([,v])=> v > 0).map(([c])=> c);
    selected = Array.from(new Set([...selected, ...top2])).slice(0,2);
  }

  // If still 0 (very vague PS), we’ll return empty and a kind note
  const pains = selected.map(tag => ({
    tag,
    why: why[tag] || `Signals in the statement suggest ${tag}.`,
    confidence: Number(consensus[tag].toFixed(2))
  }));

  return pains;
}

/* ================= Handler ================= */
export async function POST(req: NextRequest) {
  try {
    const { problem_statement = '' } = await req.json();
    const ps = String(problem_statement || '').trim();

    if (!ps) {
      return NextResponse.json({
        pains: [],
        warnings: { too_vague: true },
        block_next: true,
        note: 'Add specifics about who, the struggle, what they currently do, and what success looks like.'
      }, { status: 200 });
    }

    // Heuristic signal
    const heur = scoreHeuristic(ps);

    // LLM scorer (optional)
    let llmScores: Record<CoreId, number> = Object.fromEntries(CORES.map(c=>[c,0])) as Record<CoreId, number>;
    let llmWhy:    Record<CoreId, string> = Object.fromEntries(CORES.map(c=>[c,''])) as Record<CoreId, string>;
    let note = '';

    const apiKey = process.env.OPENAI_API_KEY;
    if (apiKey) {
      try {
        const client = new OpenAI({ apiKey });
        const { scores, why } = await scoreLLM(ps, client);
        llmScores = scores; llmWhy = why;
      } catch (e) {
        note = e instanceof Error ? e.message : 'Theme scorer timed out; used keyword scoring only.';
      }
    } else {
      note = 'OPENAI_API_KEY missing; used keyword scoring only.';
    }

    // Consensus (0.5 heur, 0.5 llm)
    const consensus = {} as Record<CoreId, number>;
    CORES.forEach(c => { consensus[c] = Number(((heur[c] + llmScores[c]) / 2).toFixed(2)); });

    const pains = pickThemes(consensus, heur, llmWhy);

    // Warnings + gating
  const warnings: Record<string, unknown> = {};
    if (pains.length >= 5) warnings.too_many = { count: pains.length };
    if (pains.length === 0) warnings.too_vague = true;

    const block_next = pains.length >= 5 || pains.length === 0;

    return NextResponse.json({ pains, warnings, block_next, note }, { status: 200 });

  } catch (e) {
    // Graceful fallback
    return NextResponse.json({
      pains: [],
      warnings: { error: true },
      block_next: true,
      note: e instanceof Error ? e.message : 'Could not extract themes. Try adding specifics (who/struggle/workarounds/outcomes).'
    }, { status: 200 });
  }
}
