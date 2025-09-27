import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

function lowerCommonNounsMidSentence(text: string) {
  // Only lowercase these when they appear inside a sentence (not first token of a sentence)
  const COMMONS = ['Customers','Subscribers','Users','Parents','Teachers','Employees','Students','Viewers','Buyers','Shoppers','Readers','Players'];
  // Split into sentence chunks, keeping delimiters
  const parts = text.split(/([.!?]\s+)/);
  for (let i = 0; i < parts.length; i += 2) {
    const seg = parts[i];
    if (!seg) continue;
    parts[i] = seg.replace(new RegExp(`\\b(${COMMONS.join('|')})\\b`, 'g'), (w, idx) => (idx === 0 ? w : w.toLowerCase()));
  }
  return parts.join('');
}

export async function POST(req: NextRequest) {
  try {
    const { projectName = '', who = '', struggle = '', current = '', gap = '', success = '' } = await req.json().catch(() => ({} as any));
    const fallback =
      `${who} are trying to make progress on “${struggle}”. ` +
      `They currently ${current}. What’s not working is ${gap}. ` +
      `Success looks like ${success}.`;

    if (!process.env.OPENAI_API_KEY) {
      // Return deterministic fallback with 200 to keep UI flow stable
      return NextResponse.json({ problemStatement: fallback }, { status: 200 });
    }

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const SYSTEM = `
You are an editor. Rewrite the inputs into ONE concise paragraph (2–3 sentences).
Requirements:
- Fix grammar, punctuation, and capitalization.
- Use sentence case. Keep common nouns/adjectives (e.g., "customers", "subscribers") lowercase when they appear mid-sentence.
- Preserve proper names and brands exactly (e.g., Netflix).
- Do not add facts, change meanings, or invent numbers.
- Keep it student-friendly, plain English.
`.trim();

    const USER = JSON.stringify({ projectName, who, struggle, current, gap, success }, null, 2);

    const resp = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.2,
      messages: [
        { role: 'system', content: SYSTEM },
        { role: 'user', content: `Rewrite this JSON as requested:\n${USER}` }
      ],
    });

    const raw = resp.choices?.[0]?.message?.content?.trim() || '';

    // Post-pass: conservative mid-sentence common-noun lowercasing
    const polished = lowerCommonNounsMidSentence(raw || fallback);

    return NextResponse.json({ problemStatement: polished }, { status: 200 });
  } catch (e) {
    // Log server-side only; return a safe, non-empty fallback with 200
    console.warn('[PS-FIX] /api/generate-problem failed', e);
    // Attempt to reuse parsed inputs via defensive defaults
    const problemStatement = 'They are trying to make progress. They currently do some workaround. What’s not working is unclear. Success looks like a better outcome.';
    return NextResponse.json({ problemStatement }, { status: 200 });
  }
}
