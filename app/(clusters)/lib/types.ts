export type Pain = {
  tag: string
  why?: string
  confidence?: number
}

export type PsChip = { tag: string; label?: string }
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

  // Rest of the flow
  notes: string
  archetypes: Archetype[]
  result: Analysis | null
  insights: Insights | null
}
