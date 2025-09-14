import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

/** ------- Light canonicalization (merge only obvious dupes) ------- */
function toSnakeStrict(s:string){
  return (s||'')
    .normalize('NFKC').toLowerCase()
    .replace(/['’]/g,'')
    .replace(/[^\p{Letter}\p{Number}\s-]/gu,' ')
    .replace(/[-\s]+/g,' ')
    .trim()
    .split(' ')
    .filter(Boolean)
    .slice(0,3)
    .join('_');
}

// Note: We previously merged near-duplicate tags; now we enforce families via forceFamily()

// Canonical, stable anchor families and a small blocklist of meta labels
const ANCHOR_FAMILIES = [
  'trustworthy_care','rising_costs','coordination_challenge',
  'option_overload','info_fragmentation','research_time_cost','value_uncertainty'
];
const BLOCKLIST = new Set(['snake_case','misc','unknown','general','other']);

/** ------- Topic/state → pain safeguard (generic, cross-domain) ------- */
function topicToPain(tag: string): string {
  const x = toSnakeStrict(tag);

  // decision / choice topics → cognitive load pains
  if (['plan_selection','plan_choice','provider_selection','vendor_choice','feature_comparison','subscription_renewal','contract_renewal'].includes(x))
    return 'value_uncertainty'; // or 'cancellation_friction' depending on context, but keep one generic here

  // option sets → overload
  if (['too_many_options','many_alternatives','offer_catalog','options_catalog','market_crowded'].includes(x))
    return 'option_overload';

  // scattered info/content/providers → fragmentation
  if (['information_scattered','documentation_scattered','content_availability','service_scattered','siloed_information','where_is_it'].includes(x))
    return 'info_fragmentation';

  // research / discovery burden
  if (['research_burden','too_much_research','information_overload','compare_time'].includes(x))
    return 'research_time_cost';

  // price / budget
  if (['monthly_cost','pricing_confusion','affordability','affordability_challenge','budget_constraints'].includes(x))
    return 'price_sensitivity';

  // trust / privacy / safety
  if (['trust_concerns','privacy_concerns','data_security','safety_concerns','trust_issues'].includes(x))
    return 'trust_issues';

  // onboarding / integration / setup
  if (['implementation','onboarding','setup_time','integration_overhead'].includes(x))
    return 'setup_complexity';

  // scheduling / availability friction
  if (['scheduling','time_slot_availability','calendar_conflict'].includes(x))
    return 'scheduling_frustration';

  // support quality
  if (['customer_support','support_response','support_quality'].includes(x))
    return 'support_unreliability';

  // commitment / lock-in
  if (['cancellation','cancelation','lock_in_risk','commitment_risk','early_termination_fee'].includes(x))
    return 'cancellation_friction';

  // pass through if already looks like a pain noun phrase
  return x;
}

// Map any tag to the nearest allowed family; drop if meta/unknown
function forceFamily(tag:string){
  let t = toSnakeStrict(tag);
  if (BLOCKLIST.has(t)) return '';
  if (ANCHOR_FAMILIES.includes(t)) return t;
  t = topicToPain(t);
  // additional direct mappings for stability
  if (t === 'price_sensitivity') t = 'rising_costs';
  if (t === 'scheduling_frustration' || t === 'setup_complexity') t = 'coordination_challenge';
  if (t === 'trust_issues') t = 'trustworthy_care';
  return ANCHOR_FAMILIES.includes(t) ? t : '';
}

export async function POST(req: NextRequest) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ note: 'OPENAI_API_KEY missing' }, { status: 500 });
    }
    const { problem_statement = '' } = await req.json();
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    /** --------- Prompt: explicit PAIN test + multi-domain examples ---------- */
    const system = `
Extract between 3 and 5 core pain points ("anchors") from the student's Problem Statement.

Return STRICT JSON only:
{
  "pains":[
    {"tag":"snake_case","label":"human phrase","why":"short clause","confidence":0..1}
  ]
}

DEFINITIONS
- A "pain" describes what hurts, blocks progress, increases time/cost/risk, or adds friction.
- Avoid topics/states like "plan_selection", "provider_selection", "subscription_renewal", "information_scattered".
  Convert them into pains:
  - plan_selection / provider_selection  -> option_overload (too many choices) OR value_uncertainty (unsure it's worth it)
  - subscription_renewal / contract_renewal -> value_uncertainty OR cancellation_friction
  - information_scattered / documentation_scattered -> info_fragmentation (info split across places)
- Prefer short, domain-agnostic NOUN PHRASES that stay close to the student's wording.
- "tag": snake_case, max 3 words (e.g., trust_issues, option_overload, info_fragmentation).
- "label": human-readable phrase (what the student would recognize).
- "why": one short clause grounded in the input.
- "confidence": 0..1 number (no %).
- Do not invent facts.

POSITIVE EXAMPLES (multi-domain)
- Telecom: "too many similar data plans"      -> tag: option_overload,       label: "too many plan options"
- Higher-ed: "is this program worth tuition?" -> tag: value_uncertainty,     label: "value uncertainty"
- SMB SaaS: "setup takes weeks"               -> tag: setup_complexity,      label: "setup takes too long"
- Healthcare: "hard to find a time that fits" -> tag: scheduling_frustration,label: "scheduling frustration"
- E-commerce: "hidden fees at checkout"       -> tag: price_sensitivity,     label: "price sensitivity"
- Research: "info is scattered across sites"  -> tag: info_fragmentation,    label: "information fragmentation"
- Trust: "hesitant to share data"             -> tag: trust_issues,          label: "data privacy concerns"

NEGATIVE EXAMPLES (rewrite into pains)
- "subscription_renewal" (state)     -> value_uncertainty or cancellation_friction
- "plan_selection" (topic)           -> option_overload or value_uncertainty
- "provider_selection" (topic)       -> option_overload
- "information_scattered" (topic)    -> info_fragmentation
    `.trim();

    const resp = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.2,                 // small variance keeps student voice
      max_tokens: 360,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: problem_statement }
      ]
    });

  let out: { pains?: Array<{ tag?: string; label?: string; why?: string; confidence?: number }> } = {};
    try { out = JSON.parse(resp.choices?.[0]?.message?.content || '{}'); } catch { out = {}; }
  const pains = Array.isArray(out?.pains) ? out.pains : [];

    // Normalize: keep label, rewrite topics→pains, canonicalize lightly, sort by confidence, max 5
    const normalized = pains.map((p) => {
      const rawTag = String(p?.tag || '');
      const tag = forceFamily(rawTag);
      const label = (String(p?.label || '') || rawTag).trim();
      const why = String(p?.why || '').slice(0, 200);
      const confidence = Math.max(0, Math.min(1, Number(p?.confidence ?? 0)));
      return { tag, label: label || tag.replace(/_/g,' '), why, confidence };
    })
    .filter((p)=> p.tag)
    .sort((a,b)=> (b.confidence||0) - (a.confidence||0))
    .slice(0, 5);

    // Warnings & gating (policy unchanged)
  const warnings: Record<string, unknown> = {};
    if (normalized.length >= 5) warnings.too_many = { count: normalized.length };
    if (problem_statement.trim().length < 60) warnings.too_vague = true;

    const block_next = normalized.length >= 5;

    return NextResponse.json({ pains: normalized, warnings, block_next });
  } catch (e) {
    const msg = (e as Error)?.message || 'Extract Pains failed';
    return NextResponse.json({ note: msg }, { status: 500 });
  }
}
