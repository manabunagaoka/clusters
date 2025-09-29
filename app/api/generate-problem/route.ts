import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { buildProblemStatement, looksLowQuality } from '@/app/(clusters)/lib/psBuilder';

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
    const norm = (s:string) => (s||'').trim().replace(/[\s]+/g,' ').replace(/^["'“”`]+|["'“”`]+$/g,'');
    const cap = (s:string) => s ? s.charAt(0).toUpperCase()+s.slice(1) : s;
    const ensurePeriod = (s:string) => s.replace(/[\.?!]+$/,'') + '.';
    const pn = norm(projectName);
    const fallback = buildProblemStatement({ projectName, who, struggle, current, gap, success });

    if (!process.env.OPENAI_API_KEY) {
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
    let candidate = lowerCommonNounsMidSentence(raw || fallback).replace(/\s{2,}/g,' ').trim();
    if (!candidate) candidate = fallback;
    if (looksLowQuality(candidate, { projectName, who, struggle, current, gap, success })) {
      candidate = fallback;
    } else if (pn && !candidate.includes(pn)) {
      // If project name provided but stripped, prepend intro sentence from fallback
      const fbFirst = fallback.split(/(?<=\.)\s+/)[0];
      candidate = fbFirst + ' ' + candidate;
    }
    const polished = candidate;

    return NextResponse.json({ problemStatement: polished }, { status: 200 });
  } catch (e) {
    // Log server-side only; return a safe, non-empty fallback with 200
    console.warn('[PS-FIX] /api/generate-problem failed', e);
    // Attempt to reuse parsed inputs via defensive defaults
    const problemStatement = 'They are trying to make progress. They currently do some workaround. What’s not working is unclear. Success looks like a better outcome.';
    return NextResponse.json({ problemStatement }, { status: 200 });
  }
}
