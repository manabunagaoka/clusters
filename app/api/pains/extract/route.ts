import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

/* ================= Core theme registry (single-word universals) ================= */
const CORES = [
  'cost','time','effort','quality','reliability','trust',
  'flexibility','choice','information','risk','support','access','value'
] as const;
type CoreId = typeof CORES[number];

// reserved for potential future filtering of meta labels
// const BLOCKLIST = new Set(['snake_case','misc','unknown','general','other']);

/* ================= Heuristics (domain-agnostic) ================= */
const CORE_KEYWORDS: Record<CoreId, RegExp[]> = {
  cost:        [/cost|price|fee|budget|afford|pay|expens/i],
  time:        [/time|wait|speed|fast|slow|delay|hours/i],
  effort:      [/effort|friction|hard|cumbersome|overhead|burden/i],
  quality:     [/quality|fit|accur|relevant|good|bad/i],
  reliability: [/reliab|uptime|consisten|stable|dependable|rotation/i],
  trust:       [/trust|safety|privacy|credib|referral/i],
  flexibility: [/flex|schedul|shift|overnight|irregular|non[-\s]?traditional|coordina|logistic|handoff/i],
  choice:      [/option|choice|variety|compare|too many|scroll/i],
  information: [/info|content|find|discover|fragment|where.*find|limited selection/i],
  risk:        [/risk|uncertain|lock|renew|cancel|penalty/i],
  support:     [/support|help|service|assist|human available/i],
  access:      [/access|coverage|eligib|inclusion|language|bilingual/i],
  value:       [/value|worth/i],
};

/* ================= Text utilities ================= */
function scoreHeuristic(text: string): Record<CoreId, number> {
  const s = (text||'').toLowerCase();
  const out = {} as Record<CoreId, number>;
  CORES.forEach(c => {
    const hits = CORE_KEYWORDS[c].reduce((n, rx) => n + (s.match(rx)?.length || 0), 0);
    out[c] = hits;
  });
  const max = Math.max(1, ...Object.values(out));
  CORES.forEach(c => out[c] = Number((out[c] / max).toFixed(2)));
  return out;
}

function withTimeout<T>(p: Promise<T>, ms: number, label='op'): Promise<T> {
  return new Promise((resolve, reject) => {
    const id = setTimeout(() => reject(new Error(`${label} timeout after ${ms}ms`)), ms);
    p.then(v => { clearTimeout(id); resolve(v); })
     .catch(e => { clearTimeout(id); reject(e); });
  });
}

/* Split PS into “problem” vs “solution” sentences (we only score the problem) */
function splitProblemSolution(ps: string) {
  const sentences = (ps || '')
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+/)
    .map(s => s.trim())
    .filter(Boolean);

  const solutionRx = /\b(the\s+solution|our\s+(plan|approach|product|service|platform)|we\s+(propose|will|built|created)|using\s+ai|llm|we\s+aim\s+to|plan\s+to|will\s+provide)\b/i;

  const problem: string[] = [];
  const solution: string[] = [];

  for (const s of sentences) {
    if (solutionRx.test(s)) solution.push(s);
    else problem.push(s);
  }
  return {
    problemText: problem.join(' ').trim(),
    solutionText: solution.join(' ').trim(),
    hasSolution: solution.length > 0
  };
}

/* ================= LLM scorer (bounded JSON) ================= */
async function scoreLLM(problemText: string, client: OpenAI): Promise<{ scores: Record<CoreId, number>, why: Record<CoreId, string> }> {
  const system = `
You are scoring a short Problem Statement against a fixed list of universal themes.
IMPORTANT: The text you receive is ONLY the problem portion; any solution sentences were removed. Score the PROBLEM ONLY.

Return STRICT JSON ONLY:

{
  "scores": { "cost": 0..1, "time": 0..1, "effort": 0..1, "quality": 0..1, "reliability": 0..1, "trust": 0..1, "flexibility": 0..1, "choice": 0..1, "information": 0..1, "risk": 0..1, "support": 0..1, "access": 0..1, "value": 0..1 },
  "why": { "cost": "≤ 200 chars", "time": "…" }
}

Rules:
- Keys must match exactly the above 13 themes.
- Keep justifications short and grounded in the text.
- No other keys; no narrative.
`.trim();

  const user = `Problem (solution text removed):\n"""${problemText.slice(0, 2000)}"""`;

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

  type LlmJson = { scores?: Partial<Record<CoreId, unknown>>; why?: Partial<Record<CoreId, unknown>> };
  let parsed: LlmJson = {};
  try { parsed = JSON.parse(resp.choices?.[0]?.message?.content || '{}') as LlmJson; } catch {}
  const safeScores = {} as Record<CoreId, number>;
  const safeWhy = {} as Record<CoreId, string>;
  CORES.forEach(c => {
    const v = Number(parsed?.scores?.[c]);
    safeScores[c] = isFinite(v) ? Math.max(0, Math.min(1, v)) : 0;
    const w = String(parsed?.why?.[c] || '');
    safeWhy[c] = w.slice(0, 200);
  });
  return { scores: safeScores, why: safeWhy };
}

/* Final pick (2–4 themes) with diversity safeguards */
function pickThemes(consensus: Record<CoreId, number>, heur: Record<CoreId, number>, why: Record<CoreId, string>) {
  const THRESH = 0.25;
  const ranked = CORES.map(c => [c, consensus[c]] as [CoreId, number])
                      .sort((a,b)=> b[1]-a[1]);

  // Keep 2–4 above threshold
  let selected = ranked.filter(([,v])=> v >= THRESH).slice(0, 4).map(([c])=> c);

  // Ensure at least 2 when heuristics show >0 for multiple cores
  if (selected.length < 2) {
    const topHeur = CORES.map(c => [c, heur[c]] as [CoreId, number])
                         .filter(([,v])=> v > 0)
                         .sort((a,b)=> b[1]-a[1])
                         .slice(0, 2)
                         .map(([c])=> c);
    selected = Array.from(new Set([...selected, ...topHeur])).slice(0, 2);
  }

  return selected.map(tag => ({
    tag,
    why: why[tag] || `Signals suggest ${tag}.`,
    confidence: Number(consensus[tag].toFixed(2))
  }));
}

/* ================= Handler ================= */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({} as { problem_statement?: unknown }));
    const { problem_statement = '' } = body as { problem_statement?: unknown };
    const ps = String(problem_statement || '').trim();

    if (!ps) {
      return NextResponse.json({
        pains: [],
        warnings: { too_vague: true },
        block_next: true,
        note: 'Add specifics about who, the struggle, what they currently do, and what success looks like.'
      }, { status: 200 });
    }

    // Split into problem vs solution; we only score the problem
    const { problemText, solutionText, hasSolution } = splitProblemSolution(ps);
    const baseText = problemText || ps; // fallback if split is over-zealous

    // Heuristic on problem only
    const heur = scoreHeuristic(baseText);

    // LLM scorer (optional)
    let llmScores: Record<CoreId, number> = Object.fromEntries(CORES.map(c=>[c,0])) as Record<CoreId, number>;
    let llmWhy:    Record<CoreId, string> = Object.fromEntries(CORES.map(c=>[c,''])) as Record<CoreId, string>;
    let note = '';

    const apiKey = process.env.OPENAI_API_KEY;
    if (apiKey) {
      try {
        const client = new OpenAI({ apiKey });
        const { scores, why } = await scoreLLM(baseText, client);
        llmScores = scores; llmWhy = why;
      } catch (e) {
        note = e instanceof Error ? e.message : 'Theme scorer timed out; used keyword scoring only.';
      }
    } else {
      note = 'OPENAI_API_KEY missing; used keyword scoring only.';
    }

    // Consensus (even blend)
    const consensus = {} as Record<CoreId, number>;
    CORES.forEach(c => { consensus[c] = Number(((heur[c] + llmScores[c]) / 2).toFixed(2)); });

    // Final selection
    const pains = pickThemes(consensus, heur, llmWhy);

    // Warnings & gating
  const warnings: Record<string, unknown> = {};
    if (hasSolution && solutionText.length >= 20) {
      warnings.solution_bias = true;
      warnings.solution_snippet = solutionText.slice(0, 180);
      if (note) note += ' ';
      note += 'Detected solution framing; themes were extracted from the problem portion only.';
    }
    if (pains.length === 0) warnings.too_vague = true;
    if (pains.length >= 5) warnings.too_many = { count: pains.length };

    const block_next = pains.length === 0 || pains.length >= 5;

    return NextResponse.json({ pains, warnings, block_next, note }, { status: 200 });

  } catch (e) {
    return NextResponse.json({
      pains: [],
      warnings: { error: true },
      block_next: true,
      note: e instanceof Error ? e.message : 'Could not extract themes. Try adding specifics (who/struggle/workarounds/outcomes).'
    }, { status: 200 });
  }
}
