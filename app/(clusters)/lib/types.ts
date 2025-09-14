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
