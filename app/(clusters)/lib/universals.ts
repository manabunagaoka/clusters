/* app/(clusters)/lib/universals.ts
   Universal Theme Registry & mappers
   - Core Dimensions: single-word, cross-domain (use these for math)
   - Facets: expressive domain specifics that map to a Core Dimension
   - Synonyms: noisy phrases → core or facet
*/

export type CoreDimensionId =
  | 'cost' | 'time' | 'effort' | 'quality' | 'reliability' | 'trust'
  | 'flexibility' | 'choice' | 'information' | 'risk' | 'support' | 'access' | 'value';

export const CORE_DIMENSIONS: CoreDimensionId[] = [
  'cost','time','effort','quality','reliability','trust',
  'flexibility','choice','information','risk','support','access','value'
];

export const FACET_BLOCKLIST = new Set(['snake_case','misc','unknown','general','other']);

// Facets that if present should be preserved verbatim (not remapped / inferred into a core)
export const CLINICAL_EXPLICIT = new Set<string>([
  'adhd','autism','asd','aspergers','depression','anxiety_disorder','bipolar','ptsd','ocd','dyslexia','dyscalculia',
  'iep','504_plan','disability','disabled'
]);

/** Facets (short ids) → Core Dimension they primarily express */
export const FACETS_TO_CORE: Record<string, CoreDimensionId> = {
  // Care / childcare / human services examples
  referral_networks: 'trust',
  staff_rotation: 'reliability',
  continuity: 'reliability',
  same_person: 'reliability',
  long_term: 'reliability',
  part_of_family: 'reliability',
  overnight_care: 'flexibility',
  household_support: 'effort',
  medical_awareness: 'quality',
  caregiver_exhaustion: 'effort',
  // Streaming / content examples
  content_discovery: 'information',
  limited_selection: 'choice',
  ad_interruptions: 'quality',
  subscription_value: 'value',
  catalog_fragmentation: 'information',
  buffering_quality: 'quality',
  bundle_value: 'value',
  // Cross-domain common
  bilingual_support: 'access',
  community_support: 'support',
  translation_tools: 'access',
  reliable_care: 'reliability',
  non_traditional_schedules: 'flexibility',
  work_travel: 'flexibility',
  // Added generic cross-domain business facets
  continuity_of_caregiver: 'reliability',
  transport_support: 'effort',
  emergency_readiness: 'quality',
  food_allergy_protocols: 'quality',
  non_traditional_schedule: 'flexibility'
};

/** Facets that are mostly context (don’t display as emergents on cards) */
export const CONTEXT_FACETS = new Set<string>([
  'work_travel', 'geo', 'language_pref', 'family_structure', 'household_composition',
  'role_title', 'industry'
]);

/** Phrase → Core or Facet (lowercased; snake or space OK) */
const SYNONYM_MAP: Record<string, string> = {
  // Core synonyms (map directly to a core id)
  price:'cost', prices:'cost', fees:'cost', budget:'cost', affordability:'cost', rising_costs:'cost',
  time_to_find:'time', waiting:'time', hours_comparing:'time',
  friction:'effort', cumbersome:'effort', hard_to_manage:'effort',
  fit:'quality', performance:'quality',
  uptime:'reliability', consistency:'reliability', reliable:'reliability',
  safety:'trust', privacy:'trust', trustworthiness:'trust', trustworthy_care:'trust', trust_issues:'trust',
  flexibility_needs:'flexibility', schedule_flex:'flexibility', scheduling_challenge:'flexibility', coordination_challenge:'flexibility',
  too_many_options:'choice', option_overload:'choice', decision_friction:'choice',
  findability:'information', info_fragmentation:'information', content_discovery:'content_discovery', limited_selection:'limited_selection',
  risk:'risk', lock_in:'risk', cancellation_friction:'risk', value_uncertainty:'value',
  support_quality:'support', helpful_service:'support',
  access_barrier:'access', coverage:'access',
  // Facet synonyms (map to facet id)
  referrals:'referral_networks', referral_networks:'referral_networks',
  rotating_staff:'staff_rotation', staff_rotation:'staff_rotation',
  overnight:'overnight_care', overnight_care:'overnight_care',
  bilingual:'bilingual_support', bilingual_support:'bilingual_support',
  community_groups:'community_support', community_support:'community_support',
  translation:'translation_tools', translation_tools:'translation_tools',
  household_support:'household_support', medical_awareness:'medical_awareness',
  non_traditional_schedules:'non_traditional_schedules', work_travel:'work_travel',
  // New facet synonyms (map to facet ids)
  continuity:'continuity_of_caregiver', same_person:'continuity_of_caregiver',
  no_rotation:'continuity_of_caregiver', part_of_family:'continuity_of_caregiver', long_term:'continuity_of_caregiver',
  school_pickup:'transport_support', driving:'transport_support', drop_off:'transport_support',
  handle_emergencies:'emergency_readiness', first_aid:'emergency_readiness', cpr:'emergency_readiness',
  food_allergies:'food_allergy_protocols', epi_pen:'food_allergy_protocols', allergy_safe:'food_allergy_protocols',
  non_traditional:'non_traditional_schedule', midnight:'non_traditional_schedule', odd_hours:'non_traditional_schedule'
  ,
  // Streaming facet & phrase expansions
  // content discovery (information)
  scrolling_through_apps:'content_discovery', cant_find_something_good:'content_discovery', browse_forever:'content_discovery',
  // catalog fragmentation (choice/information)
  only_on_another_platform:'catalog_fragmentation', removed_mid_season:'catalog_fragmentation', exclusive_release:'catalog_fragmentation',
  // ad interruptions (quality)
  ads_every_five_minutes:'ad_interruptions', ad_load:'ad_interruptions',
  // buffering / quality issues (quality)
  picture_quality:'buffering_quality', no_buffering:'buffering_quality', lag:'buffering_quality', buffering:'buffering_quality',
  // bundle value / subscription overload (value)
  too_many_subscriptions:'bundle_value', worth_it:'bundle_value', another_20:'bundle_value'
  , pay_double:'bundle_value'
};

export function toSnake(value: string): string {
  return (value||'')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/['’]/g,'')
    .replace(/[^\p{Letter}\p{Number}\s-]/gu,' ')
    .replace(/[-\s]+/g,' ')
    .trim()
    .split(' ')
    .filter(Boolean)
    .slice(0,3)
    .join('_');
}

/** Map a raw tag/phrase to { core?:CoreDimensionId, facet?:string } */
export function mapPhraseToUniversal(raw: string): { core?: CoreDimensionId; facet?: string } {
  const base = toSnake(raw);
  if (!base || FACET_BLOCKLIST.has(base)) return {};

  // Clinical explicit facets: preserve only as facet (do not infer a core)
  if (CLINICAL_EXPLICIT.has(base)) {
    return { facet: base };
  }

  // direct synonym
  const syn = SYNONYM_MAP[base];
  if (syn && (CORE_DIMENSIONS as string[]).includes(syn)) return { core: syn as CoreDimensionId };
  if (syn && FACETS_TO_CORE[syn]) return { core: FACETS_TO_CORE[syn], facet: syn };

  // facet by id
  if (FACETS_TO_CORE[base]) return { core: FACETS_TO_CORE[base], facet: base };

  // try to infer a core by family keywords
  const family = inferCoreFromKeyword(base);
  if (family) return { core: family };

  return {}; // keep as emergent elsewhere if needed
}

/** Heuristic “last mile” to infer a Core from a generic phrase */
function inferCoreFromKeyword(base: string): CoreDimensionId | '' {
  if (/(cost|fee|price|budget|afford)/.test(base)) return 'cost';
  if (/(time|wait|speed|fast|slow)/.test(base)) return 'time';
  if (/(effort|friction|hard|overhead)/.test(base)) return 'effort';
  if (/(quality|fit|accur|good|bad)/.test(base)) return 'quality';
  if (/(reliab|uptime|consisten|stable)/.test(base)) return 'reliability';
  if (/(trust|privacy|safety|credib)/.test(base)) return 'trust';
  if (/(flex|schedul|adapt|custom)/.test(base)) return 'flexibility';
  if (/(option|choice|variety|assort)/.test(base)) return 'choice';
  if (/(info|content|find|discover|fragment)/.test(base)) return 'information';
  // Risk only on lock-in/penalty/contract terms
  if (/(risk|uncertain|lock_?in|penalty|contract|early_?termination)/.test(base)) return 'risk';
  // Support must be explicit, not inferred from UI confusion
  if (/(support|help|human_support|customer_service|agent)/.test(base)) return 'support';
  if (/(access|coverage|eligib|inclusion)/.test(base)) return 'access';
  if (/(value|worth|renew|cancel|renewal)/.test(base)) return 'value';
  return '';
}

/** Fold a bag of raw tags into core dimension weights & facet set */
export function foldToUniversals(rawTags: string[]): { coreWeights: Map<CoreDimensionId, number>; facets: Set<string> } {
  const coreWeights = new Map<CoreDimensionId, number>();
  const facets = new Set<string>();

  for (const raw of rawTags) {
    const m = mapPhraseToUniversal(raw);
    if (m.core) coreWeights.set(m.core, (coreWeights.get(m.core)||0) + 1);
    if (m.facet && !FACET_BLOCKLIST.has(m.facet)) facets.add(m.facet);
  }
  return { coreWeights, facets };
}

/** Fold a bag of raw tags into core dimension & facet weights */
export function foldToUniversalsWithFacetWeights(rawTags: string[]): {
  coreWeights: Map<CoreDimensionId, number>;
  facetWeights: Map<string, number>;
} {
  const coreWeights = new Map<CoreDimensionId, number>();
  const facetWeights = new Map<string, number>();

  for (const raw of rawTags) {
    const m = mapPhraseToUniversal(raw);
    if (m.core) coreWeights.set(m.core, (coreWeights.get(m.core)||0) + 1);
    if (m.facet && !FACET_BLOCKLIST.has(m.facet)) {
      if (!CONTEXT_FACETS.has(m.facet)) facetWeights.set(m.facet, (facetWeights.get(m.facet)||0) + 1);
    }
  }
  return { coreWeights, facetWeights };
}

/** Normalize core weights into coarse magnitudes (0.33/0.67/1.0) */
export function normalizeWeights(coreWeights: Map<CoreDimensionId, number>): Record<string, 0.33|0.67|1.0> {
  const max = Math.max(1, ...Array.from(coreWeights.values()));
  const out: Record<string, 0.33|0.67|1.0> = {};
  coreWeights.forEach((cnt, k) => {
    const w = cnt / max;
    out[k] = w >= 0.8 ? 1.0 : w >= 0.5 ? 0.67 : 0.33;
  });
  return out;
}

/** Pick top-N critical facets by weight, excluding context facets */
export function pickCriticalFacets(facetWeights: Map<string, number>, limit = 3): string[] {
  return Array
    .from(facetWeights.entries())
    .filter(([f]) => !CONTEXT_FACETS.has(f))
    .sort((a,b)=> b[1]-a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([f]) => f);
}

// ---------------- Domain-agnostic sentence cue matching (Theme-Only Mode) ----------------

// Neutral cross-domain regex cues per core (word-boundary contains search; case-insensitive)
// NOTE: Keep patterns additive (no lookbehinds) for broad compatibility.
export const CORE_CUES: Record<CoreDimensionId, RegExp> = {
  cost: /(\b(cost|price|prices?|fee|fees|expensive|cheap|cheaper|discount|another \$?\d{1,4}|budget)\b)/i,
  time: /(\b(time|wait|waiting|queue|queued|delay|delays|takes forever|slow|faster?|instant|minutes? lost|time lost)\b)/i,
  effort: /(\b(effort|hard to manage|hard to|manual|too many steps|hassle|friction|setup pain|configure|coordinate|onboarding steps?)\b)/i,
  // QUALITY: extended with streaming / narrative craft synonyms
  quality: /(\b(quality|picture quality|accuracy|accurate|safety|bug|bugs|lag|buffering|crash|broken|defect|poor quality|handle emergencies|emergency readiness|epi ?pen|food allergies|allergy protocol|pacing|production values?|production polish|writing depth|story depth|character development|character depth|originality|derivative|craftsmanship|narrative stakes?|sound mix|audio mix|uneven tone|production polish|visuals?|thin narrative)\b)/i,
  reliability: /(\b(reliable|reliability|inconsistent|downtime|uptime|rotation|staff rotation|turnover|stable|stability|continuity|same person|long-term|keeps failing|keeps breaking|keeps sending different (people|nannies|caregivers)|new faces every (week|time)|different person each (time|week))\b)/i,
  trust: /(\b(trust|trustworthy|background checks?|background screening|privacy|security|secure|safety check|credibility)\b)/i,
  flexibility: /(\b(flexible|flexibility|overnight|non[- ]?traditional|random times|on[- ]?call|customizable|adapts?|variable schedule|schedule changes?)\b)/i,
  // CHOICE: broaden synonyms (breadth, variety, range) used in Netflix test data
  choice: /(\b(choice|choices|limited selection|only on|exclusive|exclusivity|fragmentation|fragmented|catalog|catalog issue|too few options|only available on|removed mid-season|removed mid season|only on another platform|breadth|variety|range|selection is thin|selection feels thin)\b)/i,
  // INFORMATION: add visibility / discovery gap phrases (no indicator / can’t tell what’s new)
  information: /(\b(info|information|discover|discovery|find|finding|findability|compare|comparison|recommendations?|algorithm|filter|filtered|hidden info|unclear docs|documentation|scrolling forever|searching forever|can'?t tell|can'?t see|no (clear )?(list|indicator|panel|summary|ledger)|no way to see|unclear what (was )?added|what (was )?added (this|last) (week|month)|newly added (titles?|shows?)|newly added this (week|month))\b)/i,
  access: /(\b(access|in-network|network coverage|eligible|eligibility|coverage|language|bilingual|device|devices|geo|geography|available|availability)\b)/i,
  support: /(\b(customer support|support team|agent|someone to call|chat support|human help|live chat|phone support|need someone|need a person)\b)/i,
  risk: /(\b(risk|lock[- ]?in|locked in|penalty|penalties|contract|contracts|early termination|compliance|legal exposure|legal risk)\b)/i,
  value: /(\b(value|good value|worth it|worth the|renew|renewal|cancel|cancellation|pay double|pay more|bang for (the )?buck)\b)/i,
};

// Display-only facet cues (emergent themes), each mapped to exactly one core.
// Structure allows easy extension without refactor.
export const FACET_CUES: Record<string, { core: CoreDimensionId; re: RegExp }> = {
  // Reliability
  staff_rotation: { core: 'reliability', re: /\bstaff rotation|rotating staff|staff turnover\b/i },
  continuity_of_caregiver: { core: 'reliability', re: /\bcontinuity of (care|caregiver)|same caregiver|same person\b/i },
  // Flexibility
  overnight_care: { core: 'flexibility', re: /\bovernight (care|coverage|support)|overnight shift\b/i },
  non_traditional_schedule: { core: 'flexibility', re: /\bnon[- ]?traditional schedule|odd hours|random hours|weekend coverage\b/i },
  // Quality
  emergency_readiness: { core: 'quality', re: /\bemergency readiness|handle emergencies|first aid|cpr certified?\b/i },
  food_allergy_protocols: { core: 'quality', re: /\b(allergy safe|food allergies|epi[- ]?pen|allergy protocol)\b/i },
  homework_support: { core: 'quality', re: /\bhomework support|help with homework|tutoring\b/i },
  buffering_quality: { core: 'quality', re: /\b(buffering|lag|picture quality|video quality)\b/i },
  ad_interruptions: { core: 'quality', re: /\bad (interruptions?|every (few|five) minutes|ad load)\b/i },
  // Effort
  household_support: { core: 'effort', re: /\b(household support|light cleaning|meal prep|meal preparation|errands)\b/i },
  transport_support: { core: 'effort', re: /\b(transport|school pickup|drop ?off|driving between)\b/i },
  // Access
  bilingual_support: { core: 'access', re: /\bbilingual|spanish speaking|language match\b/i },
  // Information / Choice / Value
  content_discovery: { core: 'information', re: /\bcontent discovery|cant find (something )?good|brows(e|ing) forever|scrolling forever\b/i },
  catalog_fragmentation: { core: 'choice', re: /\bcatalog fragmentation|only on (another|one) (platform|service)|exclusive release\b/i },
  bundle_value: { core: 'value', re: /\b(bundle value|too many subscriptions|subscription overload|another \$?\d{1,4})\b/i },
  // Clinical support (display-only) mapping ADHD presence to quality for color context
  adhd_support: { core: 'quality', re: /\bADHD\b/i },
};

export function matchCuesInSentence(sentence: string): { coreHits: Record<CoreDimensionId, number>; facetHits: Record<string, number> } {
  const coreHits = {} as Record<CoreDimensionId, number>;
  const facetHits: Record<string, number> = {};
  const s = sentence.toLowerCase();
  // Core cues
  (Object.keys(CORE_CUES) as CoreDimensionId[]).forEach(core => {
    const re = CORE_CUES[core];
    if (re.test(s)) {
      coreHits[core] = (coreHits[core] || 0) + 1;
    }
  });
  // Facet cues
  Object.entries(FACET_CUES).forEach(([facet, obj]) => {
    if (obj.re.test(s)) facetHits[facet] = (facetHits[facet] || 0) + 1;
  });
  return { coreHits, facetHits };
}

export type SentenceCueResult = ReturnType<typeof matchCuesInSentence>;
