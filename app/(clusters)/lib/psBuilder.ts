// Central deterministic Problem Statement builder
// Produces a polished multi-sentence paragraph independent of model output.
// Goals:
//  - Normalize awkward user phrasing (e.g., "had hired or thinking" -> "have hired or are considering")
//  - De-duplicate group phrase (avoid repeating full 'who' clause in later sentences)
//  - Consistent sequence: Project intro (if name) -> Who + struggle -> Current workaround -> Barrier -> Success outcome
//  - Keep language plain and grammatical

type RawInputs = {
  projectName?: string;
  who: string;
  struggle: string;
  current: string;
  gap: string;
  success: string;
};

const trimQuotes = (s: string) => (s||'').trim().replace(/^["'“”`]+|["'“”`]+$/g,'');
const norm = (s: string) => trimQuotes(s).replace(/\s+/g,' ').replace(/\u00A0/g,' ');
const stripFinalPunct = (s: string) => s.replace(/[\.?!]+$/,'');
const lcFirst = (s:string) => s ? s.charAt(0).toLowerCase()+s.slice(1) : s;
const cap = (s:string) => s ? s.charAt(0).toUpperCase()+s.slice(1) : s;

function smoothGroup(whoRaw: string): { group: string; label: string } {
  let g = norm(whoRaw);
  g = g
    .replace(/\bwho had hired or thinking of hiring\b/gi,'who have hired or are considering hiring')
    .replace(/\bwho had hired or are thinking of hiring\b/gi,'who have hired or are considering hiring')
    .replace(/\bhad hired or thinking of hiring\b/gi,'have hired or are considering hiring')
    .replace(/\bhad hired\b/gi,'have hired');
  // Extract base label (first 1-2 words if they look like plural group)
  const match = g.match(/^(Parents|Customers|Users|Subscribers|Teachers|Students|Buyers|Shoppers|Caregivers|Families|Professionals)\b/i);
  const label = match ? match[0].toLowerCase() : 'they';
  return { group: g, label };
}

export function buildProblemStatement(inputs: RawInputs): string {
  const { projectName='', who, struggle, current, gap, success } = inputs;
  const { group, label } = smoothGroup(who);
  const struggleN = stripFinalPunct(norm(struggle));
  const currentN = stripFinalPunct(norm(current)).replace(/^they\s+/i,'');
  const gapN = stripFinalPunct(norm(gap)).replace(/^they\s+/i,'');
  const successN = stripFinalPunct(norm(success)).replace(/^they\s+/i,'');

  // Sentence 1: project (if any) + who
  const intro = projectName
    ? `The project "${norm(projectName)}" targets ${group}.`
    : `${cap(group)}.`;
  // Sentence 2: struggle distilled
  const struggleSentence = struggleN ? `${cap(label === 'they' ? 'They' : label.charAt(0).toUpperCase()+label.slice(1))} struggle with ${lcFirst(struggleN)}.` : '';
  // Sentence 3: current workaround
  const currentSentence = currentN ? `They currently ${lcFirst(currentN)}.` : '';
  // Sentence 4: barrier / gap
  let gapSentence = '';
  if (gapN) {
    const hasIntro = /^(however|but|yet|because)\b/i.test(gapN);
    gapSentence = hasIntro ? `${cap(gapN)}.` : `However, ${lcFirst(gapN)}.`;
  }
  // Sentence 5: success outcome
  const successSentence = successN ? `Success would mean ${lcFirst(successN)}.` : '';

  return [intro, struggleSentence, currentSentence, gapSentence, successSentence]
    .filter(Boolean)
    .map(s => s.replace(/\s+\./g,'.').replace(/[\.?!]+$/,'.'))
    .join(' ')
    .replace(/\s{2,}/g,' ') // collapse double spaces
    .trim();
}

// Heuristic quality signal: used to decide overriding model output
export function looksLowQuality(text: string, inputs: RawInputs): boolean {
  const t = (text||'').trim();
  if (t.length < 80) return true;
  const whoStart = norm(inputs.who).slice(0,30).toLowerCase();
  if (t.toLowerCase().startsWith(whoStart)) return true; // echoes raw who directly
  // excessive repeated phrases
  const repeats = /(had hired or thinking of hiring)/i.test(t);
  return repeats;
}
