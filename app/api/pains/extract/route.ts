import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

/** Light canonicalization (only merge obvious dupes) */
function toSnakeStrict(s:string){ return (s||'').normalize('NFKC').toLowerCase()
  .replace(/['']/g,'').replace(/[^\p{Letter}\p{Number}\s-]/gu,' ')
  .replace(/[-\s]+/g,' ').trim().split(' ').filter(Boolean).slice(0,3).join('_'); }

const MAP: Record<string,string> = {
  // light merges only (keep most synonyms as-is)
  price_increase:'rising_costs',
  rising_prices:'rising_costs',
  too_expensive:'rising_costs',
  cost_pressure:'rising_costs',
  coordination_tool:'coordination_challenge',
  coordination_complexity:'coordination_challenge',
  complexity_of_arrangements:'coordination_challenge',
};
function canonicalTag(t:string){ const x = toSnakeStrict(t); return MAP[x] || x; }

export async function POST(req: NextRequest) {
  try {
    const { problem_statement = '' } = await req.json();

    // For testing purposes when OPENAI_API_KEY is not available
    if (!process.env.OPENAI_API_KEY) {
      // Mock data that simulates the new API response format
      const mockPains = [
        { tag: "trust_issues", label: "trust issues with source quality", why: "mentioned trust issues with source quality", confidence: 0.9 },
        { tag: "information_overload", label: "too many irrelevant results", why: "too many irrelevant results mentioned", confidence: 0.8 },
        { tag: "organization_challenge", label: "hard to organize sources", why: "difficulty organizing sources", confidence: 0.7 },
        { tag: "time_consuming", label: "time-consuming process", why: "finding sources is time-consuming", confidence: 0.6 }
      ];

      const normalized = mockPains.map((p) => {
        const tag = canonicalTag(p.tag);
        return { tag, label: p.label, why: p.why, confidence: p.confidence };
      });

      const warnings: Record<string, unknown> = {};
      const block_next = normalized.length >= 5;

      return NextResponse.json({ pains: normalized, warnings, block_next });
    }

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const system = `Extract between 3 and 5 core pain points ("anchors") from the student's Problem Statement.

Return STRICT JSON only:
{
  "pains":[
    {"tag":"snake_case", "label":"human phrase from the PS or a short generalization", "why":"short clause", "confidence":0..1}
  ]
}

Rules:
- Prefer short, domain-agnostic NOUN PHRASES that stay close to the student's own wording.
- If you generalize, keep it simple (e.g., "trust issues", "affordability challenge", "coordination challenge").
- "tag" must be snake_case max 3 words (e.g., trust_issues, affordability_challenge, coordination_challenge).
- "label" is human-readable (what the student would recognize).
- "why" is one short clause grounded in the input.
- "confidence" is 0..1 number (no %).
- Do not invent facts.`;

    const resp = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.2,                   // small randomness to stay near student text
      max_tokens: 300,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: problem_statement }
      ]
    });

    type RawPain = { tag?: unknown; label?: unknown; why?: unknown; confidence?: unknown };
    type ParsedResponse = { pains?: RawPain[] };
    let out: ParsedResponse = {};
    try { 
      out = JSON.parse(resp.choices?.[0]?.message?.content || '{}') as ParsedResponse; 
    } catch { 
      out = {}; 
    }
    const pains = Array.isArray(out?.pains) ? out.pains : [];

    // Normalize, preserve label, sort by confidence, trim to max 5
    const normalized = pains.map((p: RawPain) => {
      const rawTag = String(p?.tag || '');
      const tag = canonicalTag(rawTag);
      const label = String(p?.label || '').trim() || rawTag.replace(/_/g,' ');
      const why = String(p?.why || '').slice(0, 200);
      const confidence = Math.max(0, Math.min(1, Number(p?.confidence ?? 0)));
      return { tag, label, why, confidence };
    })
    .filter((p: { tag: string; label: string; why: string; confidence: number }) => p.tag)
    .sort((a: { confidence: number }, b: { confidence: number }) => (b.confidence || 0) - (a.confidence || 0))
    .slice(0, 5);

    // Warnings & gating
    const warnings: Record<string, unknown> = {};
    if (normalized.length >= 5) warnings.too_many = { count: normalized.length };
    if (problem_statement.trim().length < 60) warnings.too_vague = true;

    const block_next = normalized.length >= 5;

    return NextResponse.json({ pains: normalized, warnings, block_next });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Extract Pains failed';
    return NextResponse.json({ note: message }, { status: 500 });
  }
}