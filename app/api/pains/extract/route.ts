import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

/** Minimal canonicalizer (keep in sync with client mapping) */
function toSnakeStrict(s:string){ return (s||'').normalize('NFKC').toLowerCase()
  .replace(/['’]/g,'').replace(/[^\p{Letter}\p{Number}\s-]/gu,' ')
  .replace(/[-\s]+/g,' ').trim().split(' ').filter(Boolean).slice(0,3).join('_'); }
const MAP: Record<string,string> = {
  trustworthy_options:'trustworthy_care',
  coordination_tool:'coordination_challenge',
  coordination_complexity:'coordination_challenge',
  complexity_of_arrangements:'coordination_challenge',
  resource_gap_middle:'resource_gap_middle_income',
  return_to_work:'postpartum_transition_strain',
  communication_needs:'communication_mismatch',
  tech_solution_preference:'nanny_led_tech_preference',
  overwhelming_choices:'overwhelming_options',
  choice_overload:'overwhelming_options',
  decision_difficulty:'decision_challenge',
  difficulty_in_selection:'decision_challenge',
  decision_fatigue:'decision_challenge',
  price_hike:'rising_costs',
  price_increase:'rising_costs',
  rising_prices:'rising_costs',
  too_expensive:'rising_costs',
  cost_pressure:'rising_costs',
  nanny_led_tech:'nanny_led_tech_preference'
};
function canonicalTag(t:string){ const x = toSnakeStrict(t); return MAP[x] || x; }

export async function POST(req: NextRequest) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ note: 'OPENAI_API_KEY missing' }, { status: 500 });
    }
    const { problem_statement = '' } = await req.json();
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const system = `Extract 3–5 core pain points from the Problem Statement.
Return STRICT JSON: { "pains":[{"tag":"snake_case","why":"short","confidence":0..1}] }.
Rules:
- tag max 3 words, snake_case, domain-agnostic (e.g., rising_costs, coordination_challenge, trustworthy_care).
- why: one short clause grounded in the text.
- confidence: 0..1 numeric (no %).`;
    const user = problem_statement;

    const resp = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.1,
      max_tokens: 250,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user }
      ]
    });

  type RawPain = { tag?: unknown; why?: unknown; confidence?: unknown };
  type Parsed = { pains?: RawPain[] };
  let out: Parsed = {};
  try { out = JSON.parse(resp.choices?.[0]?.message?.content || '{}') as Parsed; } catch { out = {}; }
  const pains = Array.isArray(out?.pains) ? out.pains : [];

    // Canonicalize + sanitize
    const cleaned = pains.slice(0, 6).map((p: RawPain) => ({
      tag: canonicalTag(String(p?.tag || '')),
      why: String(p?.why || '').slice(0, 200),
      confidence: Math.max(0, Math.min(1, Number(p?.confidence ?? 0)))
    })).filter((p) => p.tag);

    // Simple warnings / gating
  const warnings: Record<string, unknown> = {};
    if (cleaned.length > 5) warnings.too_many = { count: cleaned.length };
    if (problem_statement.trim().length < 60) warnings.too_vague = true;

    const block_next = cleaned.length === 0;

    return NextResponse.json({ pains: cleaned, warnings, block_next });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Extract Pains failed';
    return NextResponse.json({ note: msg }, { status: 500 });
  }
}
