// For Problem Statement anchor chips (pain tags)
export type PsChip = { tag: string; label?: string };
export type Pain = {
  tag: string
  why?: string
  confidence?: number
}
export type Problem = {
  text: string
  tags: string[]
}

export type Archetype = {
  id: string
  name: string
  narrative: string
  tags: string[]
  quotes: string[]
}

// Evidence aligned to a primary theme
// Evidence item aligned to a primary theme tag (may include all tags)
export type ArchetypeEvidence = {
  id?: string
  text: string
  primary_tag: string
  approved?: boolean
  tags?: string[]
}

// Legacy archetype container used to carry evidence for alignment UI
export type LegacyArchetype = {
  id: string
  profile?: Record<string, unknown>
  evidence: ArchetypeEvidence[]
}

// Pattern card returned by the archetype API
// Pattern card returned by archetype API
export type PatternNarrative = {
  id: string
  kind: 'pattern'
  name: string
  who_where?: string
  one_liner?: string
  core_goals?: string[]
  pains?: string[]
  behaviors?: string[]
  signals?: string[]
  likely_tags?: string[]
  top_tags?: string[]
  interviews?: string[]
  count?: number
  member_ids?: string[]
  jtbd_fields?: {
    who?: string[]
    context?: { role?: string[]; geo?: string[]; work_pattern?: string[]; language_pref?: string[] }
    struggling_moments?: string[]
    jobs?: string[]
    workarounds?: string[]
    selection_criteria?: string[]
    anxieties?: string[]
    outcomes?: string[]
  }
}

export type PatternCard = PatternNarrative

export type Summary = {
  patterns?: { name: string; count: number }[]
  anchor_coverage: { tag: string; count: number }[]
  top_emergents: { tag: string; count: number }[]
}

export type ArchetypeAPIResponse = {
  summary: Summary
  cards: { pattern: PatternCard[] }
  archetypes: LegacyArchetype[]
  emergent?: { paragraph?: string; bullets?: { facet:string; explanation:string }[] }
  dropped_items?: number
}

export type Analysis = {
  readiness: {
    overall: number
    focus: number
    clear: number
    action: number
  }
  clusters: Array<{
    id: string
    label: string
    tags: string[]
    size?: number
  }>
}

export type Insights = {
  summary: string
  focusNow: string | string[]
  twoExperiments: string[]
  tightenData: string[]
  whyThisMakesSense: string
}

// New richer narrative insights output (superset produced by narrative engine)
export type NarrativeInsights = Insights & {
  status: 'early' | 'validating' | 'pivot_signal' | 'fragmented' | 'focused'
  confidence: 'low' | 'medium' | 'high'
  validatedThemes: string[]
  gaps: string[]
  emergent: string[]
  earlySignals: string[]
  // evidence is intentionally not typed here to avoid import cycle; attach separately if needed
  evidence?: unknown
}

export type AppState = {
  // Wizard fields
  title: string
  wizWho: string
  wizStruggle: string
  wizCurrent: string
  wizGap: string
  wizSuccess: string

  // Problem statement and pains
  psText: string
  psTags: PsChip[]
  psWarnings?: string
  psBlocked?: boolean
  psJustGenerated?: boolean
  busyPS?: boolean
  busyExtract?: boolean
  busyArch?: boolean
  // Persistable PS draft paragraph (used for Extract)
  psDraft: string

  // Rest of the flow
  notes: string
  archetypes: LegacyArchetype[]
  // patterns from archetype cards API
  patterns?: PatternCard[]
  // summary from archetype API
  summary?: Summary | null
  // emergent paragraph from archetype API
  emergent?: { paragraph?: string; bullets?: { facet:string; explanation:string }[] } | null
  result: Analysis | null
  insights: Insights | null
  // last error message for UX (e.g., server failure on archetypes)
  error?: string

  // JTBD Profiles (new flow)
  profiles?: JTBDProfile[]
  profilesMatrix?: ProfilesMatrixRow[]
  profilesSummary?: ProfilesSummary | null
  profilesError?: string
  busyProfiles?: boolean

  // Quality Metrics & Clusters (new deterministic flow)
  metricsRes?: MetricsResult | null
  clustersRes?: ClustersResult | null
  readiness?: Readiness | null
  busyQC?: boolean
  // gating flag: themes extracted so Clusters nav can enable
  themesReady?: boolean
  // snapshot of extracted PS core themes (for simplified PS page chips)
  psSnapshot?: { themes: string[] } | null
  // snapshot of interview matrix rows (used to gate Clusters nav and resets)
  interviewMatrix?: any[]
  // explicit gating flags (monotonic within session unless user clears or hard refreshes)
  psReady?: boolean
  interviewReady?: boolean
}

// JTBD Profiles types
export type JTBDContext = { role?: string; geo?: string; work_pattern?: string; language_pref?: string }
export type JTBDFields = {
  who?: string
  context?: JTBDContext
  struggling_moment?: string
  jobs?: string[]
  workarounds?: string[]
  selection_criteria?: string[]
  anxieties?: string[]
  outcomes?: string[]
}
export type JTBDProfile = {
  id: string
  title?: string
  narrative: string
  themes: { core: string[]; facets: string[] }
  theme_weights: Record<string, number>
  jtbd: JTBDFields
  // NEW — non-math, kept for Insights and display
  other?: {
    dependent?: { relation: 'child'|'spouse'|'parent'|'other'; conditions: string[] }
    language?: string
    schedule?: string[]          // (legacy – not shown in UI now)
    household_scope?: string[]   // ['groceries','meal prep','light cleaning']
    transport?: string[]         // ['school pickup','driving','drop-off']
    continuity?: string[]        // ['no rotation','same person','part of family','long-term']
    missed_by_summary?: string[] // up to 3 facts absent from summary
    // keep?: string[]           // deprecated: no longer rendered
  }

  // NEW — data quality flags (optional)
  flags?: {
    coverage_pct?: number
    thin_interview?: boolean
    missing_outcomes?: boolean
    pricing_misplaced?: boolean
    solution_bias?: boolean
  }

  // NEW — review flow
  approved?: boolean
  edited?: boolean
  original?: JTBDProfile    // snapshot for "Reset to Extracted"
}
export type ProfilesSummary = { anchor_coverage: { tag: string; count: number }[]; top_emergents: { tag: string; count: number }[] }
export type ProfilesMatrixRow = [string, Record<string, number>]
export type ProfilesAPIResponse = {
  profiles: JTBDProfile[]
  matrix: ProfilesMatrixRow[]
  summary: ProfilesSummary
  note?: string
  theme_universe?: string[]
}

// ================= Quality Metrics & Clusters types =================
export type MetricsResult = {
  coverage: { core_totals: { tag: string; sum: number }[] }
  completeness: {
    per_profile: { id: string; who_or_context: boolean; struggle: boolean; workarounds: boolean; jobs: boolean; outcomes: boolean; extras?: unknown }[]
    overall: Record<'who_or_context' | 'struggle' | 'workarounds' | 'jobs' | 'outcomes', number>
  }
  imbalance?: { dominant?: string; ratio?: number; flag?: boolean }
  warnings?: { solution_bias?: boolean; thin_interviews?: number; thin_fraction?: number; thin_flag?: boolean; low_coverage?: boolean }
  note?: string
}

export type ClustersResult = {
  k_selected: number
  validity: { silhouette: number; alt: { k: number; silhouette: number }[] }
  clusters: { id: number; size: number; centroid: Record<string, number>; top_dims: string[]; top_facets: string[]; representatives: string[] }[]
  assignments: { id: string; cluster: number }[]
  note?: string
}

export type Readiness = { overall: number; focus: number; clear: number; action: number }
