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

/** Facets (short ids) → Core Dimension they primarily express */
export const FACETS_TO_CORE: Record<string, CoreDimensionId> = {
  // Care / childcare / human services examples
  referral_networks: 'trust',
  staff_rotation: 'reliability',
  overnight_care: 'flexibility',
  household_support: 'effort',
  medical_awareness: 'quality',
  caregiver_exhaustion: 'effort',
  // Streaming / content examples
  content_discovery: 'information',
  limited_selection: 'choice',
  ad_interruptions: 'quality',
  subscription_value: 'value',
  // Cross-domain common
  bilingual_support: 'access',
  community_support: 'support',
  translation_tools: 'access',
  reliable_care: 'reliability',
  non_traditional_schedules: 'flexibility',
  work_travel: 'flexibility'
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
  findability:'information', info_fragmentation:'information', content_discovery:'information', limited_selection:'information',
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
  non_traditional_schedules:'non_traditional_schedules', work_travel:'work_travel'
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
  if (/(risk|uncertain|lock|renew|cancel)/.test(base)) return 'risk';
  if (/(support|help|service)/.test(base)) return 'support';
  if (/(access|coverage|eligib|inclusion)/.test(base)) return 'access';
  if (/(value|worth)/.test(base)) return 'value';
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
