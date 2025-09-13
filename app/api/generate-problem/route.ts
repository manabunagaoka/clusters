import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

export async function POST(req: NextRequest) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ note: 'OPENAI_API_KEY missing' }, { status: 500 });
    }
    const { projectName='', who='', struggle='', current='', gap='', success='' } = await req.json();

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const system = `You rewrite inputs into a single, plain-English paragraph (2–3 sentences).
- Keep facts; don't invent details.
- Mention who, the struggle, what currently happens, what's not working, and what success looks like.
- Tone: clear, student-friendly.`;
    const user = JSON.stringify({ projectName, who, struggle, current, gap, success }, null, 2);

    const resp = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.2,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: `Make one readable paragraph from this JSON:\n${user}` }
      ]
    });

    const text = resp.choices?.[0]?.message?.content?.trim() || '';
    const fallback =
      `${who} are trying to make progress on “${struggle}”. They currently ${current}. ` +
      `What’s not working is that ${gap}. Success looks like ${success}.`;

    return NextResponse.json({ problemStatement: text || fallback });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Generate PS failed';
    return NextResponse.json({ note: msg }, { status: 500 });
  }
}
