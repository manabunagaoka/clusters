// Deterministic Problem Statement (PS) rubric (sector-agnostic)
// - Pure regex / rule scoring (no model calls)
// - Returns up to 3 Action + 1 Meta core themes (fixed cap)
// - Domain overrides may flip Action/Meta role classification
// - Explicit gating: risk/value/information/support require direct cues
// - Scheduling (flexibility) can suppress information precedence
// - Solution-ish wording demotes meta (so problem framing leads)

export const CORE_IDS = [
  'cost','time','effort','quality','reliability','trust','flexibility',
  'choice','information','access','support','risk','value'
] as const;
export type CoreId = typeof CORE_IDS[number];

export type DomainProfile = 'general' | 'marketplace' | 'self_serve_saas' | 'field_services';

// Default role groupings
export const ACTION_DEFAULT: CoreId[] = [
  'cost','time','effort','quality','reliability','trust','flexibility','access','support'
];
export const META_DEFAULT: CoreId[] = ['information','choice','value','risk'];

// Domain-specific overrides (assumptions: documented for later refinement)
// Assumptions:
//  - marketplace: choice is more executional (supply breadth) => action
//  - self_serve_saas: information often tied to onboarding friction => action
//  - field_services: reliability & scheduling remain action (default), risk may elevate to action
export const ROLE_OVERRIDES_BY_DOMAIN: Record<DomainProfile, Partial<Record<CoreId,'action'|'meta'>>> = {
  general: {},
  marketplace: { choice: 'action' },
  self_serve_saas: { information: 'action' },
  field_services: { risk: 'action' }
};

export const PRIORITY: CoreId[] = [
  'cost','time','effort','quality','reliability','trust','flexibility','access','support',
  'information','choice','value','risk'
];

// Expanded scoring cues (strong signals = +2 each)
export const CUES: Record<CoreId, RegExp[]> = {
  cost: [
    /\b(price|prices|pricing|fee|fees|costs?|expensive|cheap|discount|overpriced|pay( again| twice)?|another \$?\d+|unaffordable|can('|no)t afford|too expensive|budget)\b/i
  ],
  time: [
    /\b(wait|waiting|takes forever|delay(ed)?|delays|slow|hours? long|time[-\s]?consuming|late nights?)\b/i
  ],
  effort: [
    /\b(re[-\s]?explain|juggle|coordinate|too many steps|hassle|overhead|manual(ly)?|copy[-\s]?paste|context switching|switch(ing)? tabs?)\b/i
  ],
  quality: [
    /\b(quality|accuracy|clean data|data quality|first aid|cpr|allerg(y|ies)|protocol|expert( in)?|expertise|qualified|certified|early childhood development|ecd|inconsistent results?)\b/i
  ],
  reliability: [
    /\b(rotation|rotating|new faces|continuity|same person|uptime|stable|downtime|crash(es|ing)?|flaky|fails?|unreliable)\b/i
  ],
  trust: [
    /\b(trust( issues)?|trustworthy|background check|background screened|safety|privacy|security|secure|verification|vetted)\b/i
  ],
  flexibility: [
    /\b(overnight|random times?|fixed hours|non[-\s]?traditional|on[-\s]?call|schedule|scheduling|always available|availability|available 24\/ ?7|24x7|reschedul(e|ing)|last[-\s]?minute)\b/i
  ],
  choice: [
    /\b(assortment|only on|exclusive|catalog|selection|variety|options?|limited options?|inventory)\b/i
  ],
  information: [
    /\b(find|discover|compare|comparison|clarity|hidden info|hidden fees?|scroll(ing)? forever|no info|lack of info|unclear|not (sure|clear))\b/i
  ],
  access: [
    /\b(in[-\s]?network|eligible|eligibility|coverage|spanish|bilingual|language|accessible|accessibility|locked out|location|geo( ?restricted)?)\b/i
  ],
  support: [
    /\b(customer support|support agent|someone to (call|chat)|on[-\s]?call backup|need (a |some )?help|live chat|human support)\b/i
  ],
  risk: [
    /\b(lock[-\s]?in|penalt(y|ies)|contract|early termination|compliance|legal|liabilit(y|ies)|exposure|risk|risky)\b/i
  ],
  value: [
    /\b(worth it|renew|cancel|churn|bang for (the )?buck|roi|return on investment|not worth|justify the cost)\b/i
  ],
};

// Hard rules (explicit gating / precedence)
export const HARD = {
  risk: (t:string)=> CUES.risk.some(r=> r.test(t)),
  value: (t:string)=> /\b(worth it|renew|cancel|roi|return on investment)\b/i.test(t),
  info: (t:string)=> /\b(find|discover|compare|comparison|clarity|hidden info|hidden fees?)\b/i.test(t),
  sched: (t:string)=> /\b(overnight|random times?|fixed hours|non[-\s]?traditional|on[-\s]?call|schedule|scheduling|always available|availability|reschedul(e|ing)|last[-\s]?minute)\b/i.test(t),
  supportProvider: (t:string)=> /\b(customer support|support agent|on[-\s]?call backup|live chat|human support)\b/i.test(t),
  solutionish: (t:string)=> /\b(platform|solution|app|feature|tool|dashboard|portal|system|integration|ai[- ]?powered|automate(d|)|automation)\b/i.test(t)
};

export type ScoreResult = {
  scores: Record<CoreId, number>;
  cues:   Record<CoreId,string[]>;
};

export function scorePS(textRaw: string): ScoreResult {
  const text = (textRaw || '').normalize('NFKC');
  const scores: Record<CoreId, number> = Object.fromEntries(CORE_IDS.map(k=>[k,0])) as any;
  const cues:   Record<CoreId,string[]> = Object.fromEntries(CORE_IDS.map(k=>[k,[]])) as any;

  for (const core of CORE_IDS) {
    for (const rx of CUES[core] || []) {
      const m = text.match(rx);
      if (m) { scores[core] += 2; cues[core].push(m[0]); }
    }
  }
  // Soft boosts (lightweight, not exceeding hard gating intent)
  if (/\b(hours?|late|long|delay)\b/i.test(text)) scores.time += 1;
  if (/\b(help|backup|escalat(e|ion)|support)\b/i.test(text)) scores.support += 1;
  if (/\b(trust|safe|secure)\b/i.test(text)) scores.trust += 1;

  return { scores, cues };
}

function roleOf(core: CoreId, domain: DomainProfile): 'action'|'meta' {
  const override = ROLE_OVERRIDES_BY_DOMAIN[domain]?.[core];
  if (override) return override;
  return ACTION_DEFAULT.includes(core) ? 'action' : 'meta';
}

export function pickTop3Plus1(opts: { text: string; domain?: DomainProfile; interviewFreq?: Record<CoreId, number> }): { action: CoreId[]; meta?: CoreId; scores: Record<CoreId, number> } {
  const { text, domain = 'general', interviewFreq } = opts;
  const { scores } = scorePS(text);

  // Gating resets (strict presence required)
  if (!HARD.risk(text)) scores.risk = 0;
  if (!HARD.value(text)) scores.value = 0;
  if (!HARD.info(text)) scores.information = 0;
  if (!HARD.supportProvider(text)) scores.support = 0;

  // Scheduling precedence: if scheduling/flex cues present with info, dampen info to max 1
  if (HARD.sched(text) && scores.flexibility > 0 && scores.information > 0) {
    scores.information = Math.min(scores.information, 1);
  }

  // Solutionish demotion: if solution framing detected, reduce meta emphasis (but not action)
  if (HARD.solutionish(text)) {
    for (const c of CORE_IDS) {
      if (roleOf(c, domain) === 'meta') {
        scores[c] = Math.max(0, scores[c] - 1);
      }
    }
  }

  const ranked = [...CORE_IDS].sort((a,b)=>{
    if (scores[b] !== scores[a]) return scores[b]-scores[a];
    const ra = roleOf(a, domain); const rb = roleOf(b, domain);
    if (ra !== rb) return ra === 'action' ? -1 : 1; // action before meta
    return PRIORITY.indexOf(a) - PRIORITY.indexOf(b);
  });

  const action = ranked.filter(c=> roleOf(c, domain)==='action' && scores[c]>0).slice(0,3);

  // Tie-break using interview frequency (if provided) for the 3rd slot
  if (action.length === 3 && interviewFreq){
    const third = action[2];
    const sThird = scores[third];
    const ties = ranked.filter(c=> roleOf(c, domain)==='action' && scores[c]===sThird);
    if (ties.length>1){
      ties.sort((a,b)=>(interviewFreq[b]||0)-(interviewFreq[a]||0));
      action[2] = ties[0];
    }
  }

  let meta: CoreId|undefined;
  const metaRanked = ranked.filter(c=> roleOf(c, domain)==='meta' && scores[c]>0);
  // Pick first meta with score >=2 else the first positive (?)
  const strongMeta = metaRanked.filter(c=> scores[c] >= 2);
  if (strongMeta.length) meta = strongMeta[0]; else if (metaRanked.length) meta = metaRanked[0];

  return { action, meta, scores };
}

// Hash for snapshot lock
export function textHash(s: string): string {
  let h = 0, i = 0, l = s.length;
  while (i < l) { h = (h << 5) - h + s.charCodeAt(i++) | 0; }
  return String(h >>> 0);
}
