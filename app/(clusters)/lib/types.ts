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
  psText: string
  psTags: string[]
  notes: string
  archetypes: Archetype[]
  result: Analysis | null
  insights: Insights | null
}
