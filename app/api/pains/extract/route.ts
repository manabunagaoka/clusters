import { NextRequest, NextResponse } from 'next/server';

const CORES = ['cost','time','effort','quality','reliability','trust','flexibility','choice','information','access','support','risk','value'] as const;
type CoreId = typeof CORES[number];

const RX: Record<CoreId, RegExp[]> = {
  cost:[/\b(price|fee|expensive|cheap|unaffordable|pay)\b/i],
  time:[/\b(wait|waiting|delay|hours?)\b/i],
  effort:[/\b(re[-\s]?explain|juggle|coordinate|steps|hassle|overhead)\b/i],
  quality:[/\b(quality|accuracy|safety|first aid|allerg(y|ies)|protocol)\b/i],
  reliability:[/\b(rotation|continuity|same person|stable|uptime)\b/i],
  trust:[/\b(trust( issues)?|trustworthy|background check|privacy|security)\b/i],
  flexibility:[/\b(overnight|random times?|fixed hours|non[-\s]?traditional|on[-\s]?call|schedule|availability|always available|24\/?7|anytime)\b/i],
  choice:[/\b(assortment|only on|exclusive|catalog|selection|options)\b/i],
  information:[/\b(find|discover|compare|clarity|hidden info|documentation)\b/i],
  access:[/\b(in[-\s]?network|eligible|coverage|language|spanish|bilingual|region|device)\b/i],
  support:[/\b(customer support|support agent|help desk|hotline|on[-\s]?call backup|sla)\b/i],
  risk:[/\b(lock[-\s]?in|penalt(y|ies)|contract|termination|compliance|legal)\b/i],
  value:[/\b(worth it|renew|cancel|roi)\b/i],
};

// Score + precedence
function extractCores(textRaw: string): CoreId[] {
  const t = (textRaw || '').normalize('NFKC');
  const scores: Record<CoreId, number> = Object.fromEntries(CORES.map(c=>[c,0])) as any;

  for (const c of CORES) for (const rx of (RX[c] || [])) if (rx.test(t)) scores[c]+=2;
  if (/\b(hours?|late|long)\b/i.test(t)) scores.time += 1;
  if (/\b(trust|safe)\b/i.test(t)) scores.trust += 1;

  // Flexibility precedence on schedule/availability
  const hasSchedule = /\b(overnight|random times?|fixed hours|non[-\s]?traditional|on[-\s]?call|schedule|availability|always available|24\/?7|anytime)\b/i.test(t);
  if (hasSchedule && scores.flexibility > 0 && scores.information > 0) {
    scores.information = Math.min(scores.information, 1);      // demote info slightly
  }

  // Rank and cap at 3
  const ranked = [...CORES].sort((a,b)=> scores[b]-scores[a] || CORES.indexOf(a as any)-CORES.indexOf(b as any));
  let top = ranked.filter(c => scores[c] > 0).slice(0,3) as CoreId[];

  // If schedule cues exist and flexibility not in top-3 but present, force it into slot 3
  if (hasSchedule && scores.flexibility > 0 && !top.includes('flexibility')) {
    if (top.length === 0) top = ['flexibility']; else top[ Math.min(2, top.length-1) ] = 'flexibility';
    // ensure uniqueness and cap to 3
    top = Array.from(new Set(top)).slice(0,3) as CoreId[];
  }

  return top;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(()=> ({}));
    const psText = String(body?.problem_statement || '');
    const top = extractCores(psText);
    const pains = top.map(tag => ({ tag, why:'', confidence: 1.0 }));
    return NextResponse.json({ pains, block_next:false, warnings:{} }, { status:200 });
  } catch (e:any) {
    return NextResponse.json({ pains:[], block_next:false, warnings:{ error:true, message:e?.message || 'extract failed' } }, { status:200 });
  }
}

