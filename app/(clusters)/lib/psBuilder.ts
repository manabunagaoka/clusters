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
  // Ensure article before singular nanny phrases
  g = g
    .replace(/hiring nanny/gi,'hiring a nanny')
    .replace(/hired nanny/gi,'hired a nanny')
    .replace(/considering hiring nanny/gi,'considering hiring a nanny')
    .replace(/their home childcare provider/gi,'their home childcare provider');
  // Decapitalize initial common group after we will prepend 'targets'
  const firstWord = g.split(/\s+/)[0];
  const commonGroups = ['parents','customers','users','subscribers','teachers','students','buyers','shoppers','caregivers','families','professionals'];
  if (commonGroups.includes(firstWord.toLowerCase())) {
    g = firstWord.toLowerCase() + g.slice(firstWord.length);
  }
  const match = g.match(/^(Parents|Customers|Users|Subscribers|Teachers|Students|Buyers|Shoppers|Caregivers|Families|Professionals)\b/i);
  const label = match ? match[0].toLowerCase() : 'they';
  return { group: g, label };
}

function transformStruggle(raw: string, label: string): string {
  let s = norm(raw);
  // Canonical "cannot"
  s = s.replace(/\bcan not\b/gi,'cannot');
  // Pattern: They cannot trust X but cannot afford Y -> trust issues regarding X while also finding Y unaffordable
  s = s.replace(/^(they|these [a-z]+) cannot trust ([^.]+?) but cannot afford ([^.]+)$/i, (_m,_p,x,y)=>`trust issues regarding ${x} while also finding ${y} unaffordable`);
  // Remove leading pronoun phrases
  s = s.replace(/^they\s+/i,'').replace(/^these [a-z]+\s+/i,'');
  // If still starts with 'cannot trust'
  s = s.replace(/^cannot trust ([^.]+?) but cannot afford ([^.]+)$/i, (_m,x,y)=>`trust issues regarding ${x} while also finding ${y} unaffordable`);
  // Final tidy
  s = s.replace(/\bECD\b/g,'early childhood development');
  return s;
}

function transformCurrent(raw: string): string {
  let c = norm(raw).replace(/^they\s+/i,'');
  c = c.replace(/^nanny or babysitter share with friends and ask for grandparents' help when urgent$/i,'share nannies or babysitters with friends and seek help from grandparents in urgent situations');
  c = c
    .replace(/nanny or babysitter share/gi,'share nannies or babysitters')
    .replace(/ask for grandparents'? help when urgent/gi,'seek help from grandparents in urgent situations');
  return c;
}

function transformGap(raw: string): { text: string; mergeWithCurrent: boolean } {
  let g = norm(raw).replace(/^they\s+/i,'');
  const mergePattern = /^(everyone has different needs.*|everyone has different needs, time.*)$/i;
  if (mergePattern.test(g)) {
    return { text: 'but managing different needs and schedules can be challenging', mergeWithCurrent: true };
  }
  g = g.replace(/^everyone has different needs.*$/i,'managing different needs and schedules can be challenging');
  return { text: g, mergeWithCurrent: false };
}

function transformSuccess(raw: string): string {
  let s = norm(raw).replace(/^they\s+/i,'').replace(/^my\s+/i,'their ');
  s = s.replace(/my child/gi,'their child');
  s = s.replace(/worry ?free/gi,'worry-free');
  s = s.replace(/\bECD\b/g,'early childhood development');
  // Specific pattern rewrite
  s = s.replace(/^a trustworthy and affordable nanny is taking care of (?:their|my) child worry-free,? always available,? and is an expert in early childhood development$/i,
    'having a trustworthy and affordable nanny who takes care of their child worry-free, is always available, and is an expert in early childhood development');
  // If starts with 'a trustworthy and affordable nanny is taking care of'
  s = s.replace(/^a trustworthy and affordable nanny is taking care of (?:their|my) child/gi,'having a trustworthy and affordable nanny who takes care of their child');
  return s;
}

export function buildProblemStatement(inputs: RawInputs): string {
  const { projectName='', who, struggle, current, gap, success } = inputs;
  const { group, label } = smoothGroup(who);
  const struggleN = stripFinalPunct(transformStruggle(struggle, label));
  const currentN = stripFinalPunct(transformCurrent(current));
  const gapT = transformGap(gap);
  const gapN = stripFinalPunct(gapT.text);
  const successN = stripFinalPunct(transformSuccess(success));

  // Sentence 1
  const intro = projectName
    ? `The project "${norm(projectName)}" targets ${group}.`
    : `${cap(group)}.`;
  // Sentence 2
  const struggleSubject = label !== 'they' ? `These ${label}` : 'They';
  const struggleSentence = struggleN ? `${cap(struggleSubject)} struggle with ${lcFirst(struggleN)}.` : '';
  // Sentence 3 (+ optional merged gap)
  let currentSentence = currentN ? `Currently, they ${lcFirst(currentN)}.` : '';
  let gapSentence = '';
  if (gapN) {
    if (gapT.mergeWithCurrent && currentSentence) {
      // Merge: turn period into comma + conjunction
      currentSentence = currentSentence.replace(/\.$/, ', but managing different needs and schedules can be challenging.');
    } else {
      const hasIntro = /^(however|but|yet|because)\b/i.test(gapN);
      const gapBody = hasIntro ? gapN : `However, ${lcFirst(gapN)}`;
      gapSentence = `${cap(gapBody)}.`;
    }
  }
  // Sentence 5
  const successSentence = successN ? `Success would mean ${lcFirst(successN)}.` : '';

  // Minor tense/style smoothing inside assembled sentences
  const sentences = [intro, struggleSentence, currentSentence, gapSentence, successSentence]
    .filter(Boolean)
    .map(s => s
      .replace(/Parents struggle with trust issues regarding nannies while also finding daycare or preschool unaffordable\./i, 'These parents struggle with trust issues regarding nannies while also finding daycare or preschool unaffordable.')
      .replace(/worry ?-?free/gi,'worry-free')
    );

  return sentences
    .map(s => s.replace(/\s+\./g,'.').replace(/[\.?!]+$/,'.'))
    .join(' ')
    .replace(/\s{2,}/g,' ')
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
