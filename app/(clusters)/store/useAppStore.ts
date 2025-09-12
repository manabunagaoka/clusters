'use client'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { fetchJsonSafe } from '../lib/net'
import { canonicalTag, humanizeTag } from '../lib/canonical'
import type { AppState, Archetype, Analysis, Insights } from '../lib/types'

const DEFAULT_ANCHORS = ['confusing', 'slow', 'manual', 'inconsistent', 'risky', 'expensive', 'time-consuming']

function unique<T>(arr: T[]): T[] { return Array.from(new Set(arr)) }

function inferTagsFromText(text: string): string[] {
  const words = (text || '').toLowerCase().match(/[a-z]{4,}/g) || []
  const hits = words.filter((w) => DEFAULT_ANCHORS.includes(w))
  return unique(hits.length ? hits : words.slice(0, 5)).map(canonicalTag)
}

function stubArchetypes(notes: string, anchors: string[]): Archetype[] {
  const lines = (notes || '').split(/\n+/).map((l) => l.trim()).filter(Boolean)
  const aligned = lines.filter((l) => anchors.some((a) => l.toLowerCase().includes(a)))
  const groups = anchors.slice(0, 3).map((a, i) => ({ key: a, quotes: aligned.filter((q) => q.toLowerCase().includes(a)) }))
  return groups.map((g, i) => ({
    id: `a${i+1}`,
    name: humanizeTag(g.key),
    narrative: `Often deals with ${humanizeTag(g.key)} situations and wants fewer steps.`,
    tags: [g.key],
    quotes: g.quotes.slice(0, 6),
  }))
}

function stubAnalysis(archetypes: Archetype[]): Analysis {
  const totalQuotes = archetypes.reduce((s, a) => s + a.quotes.length, 0)
  const density = Math.max(0.1, Math.min(1, totalQuotes / 12))
  return {
    readiness: {
      overall: density,
      focus: Math.min(1, (archetypes.length || 1) / 4),
      clear: Math.min(1, density * 0.9 + 0.05),
      action: Math.min(1, density * 0.8 + 0.1),
    },
    clusters: archetypes.map((a, i) => ({ id: a.id, label: a.name, tags: a.tags, size: a.quotes.length || 1 })),
  }
}

function stubInsights(state: AppState): Insights {
  const top = state.psTags[0] ? humanizeTag(state.psTags[0]) : 'Pain'
  return {
    summary: `Students are running into ${top.toLowerCase()} in their current flow. Prioritize reducing friction before adding features.`,
    focusNow: [`Reduce ${top.toLowerCase()} in the first-run experience`],
    twoExperiments: [
      'Run a 5-user think-aloud test on the onboarding path',
      'Ship an A/B removing one step and measure completion rate',
    ],
    tightenData: ['Add a one-question exit survey for drop-offs', 'Tag events for time-on-step in onboarding'],
    whyThisMakesSense: 'Focus on the highest-friction moments first to unlock downstream gains.',
  }
}

export const useAppStore = create<AppState & {
  setNotes: (v: string) => void
  setPSText: (v: string) => void
  generatePS: () => Promise<void>
  extractPains: () => Promise<void>
  generateArchetypes: () => Promise<void>
  runAnalysis: () => Promise<void>
  getInsights: () => Promise<void>
  canGoArchetypes: () => boolean
  canRunAnalysis: () => boolean
  canSeeInsights: () => boolean
}>()(
  persist((set, get) => ({
    psText: '',
    psTags: [],
    notes: '',
    archetypes: [],
    result: null,
    insights: null,

    setNotes: (v) => set({ notes: v }),
    setPSText: (v) => set({ psText: v }),

    async generatePS() {
      const { psText } = get()
      const res = await fetchJsonSafe<{ text: string }>('/api/ps', { method: 'POST', body: JSON.stringify({ text: psText }) })
      const text = res.ok && res.data?.text ? res.data.text : (psText || '').trim()
      set({ psText: text })
    },

    async extractPains() {
      const { psText } = get()
      const res = await fetchJsonSafe<{ tags: string[] }>('/api/pains', { method: 'POST', body: JSON.stringify({ text: psText }) })
      const tags = res.ok && Array.isArray(res.data?.tags) && res.data!.tags.length ? res.data!.tags : inferTagsFromText(psText)
      set({ psTags: unique(tags.map(canonicalTag)) })
    },

    async generateArchetypes() {
      const { notes, psTags } = get()
      const res = await fetchJsonSafe<Archetype[]>('/api/archetypes', { method: 'POST', body: JSON.stringify({ notes, anchors: psTags }) })
      const data = res.ok && Array.isArray(res.data) ? res.data as any : stubArchetypes(notes, psTags)
      set({ archetypes: data })
    },

    async runAnalysis() {
      const { archetypes } = get()
      const res = await fetchJsonSafe<Analysis>('/api/analysis', { method: 'POST', body: JSON.stringify({ archetypes }) })
      const data = res.ok && res.data ? res.data : stubAnalysis(archetypes)
      set({ result: data })
    },

    async getInsights() {
      const state = get()
      const res = await fetchJsonSafe<Insights>('/api/insights', { method: 'POST', body: JSON.stringify({ state }) })
      const data = res.ok && res.data ? res.data : stubInsights(state)
      set({ insights: data })
    },

    canGoArchetypes() {
      const s = get(); return !!s.psText && (s.psTags?.length || 0) > 0
    },
    canRunAnalysis() {
      const s = get(); return (s.archetypes?.length || 0) > 0
    },
    canSeeInsights() {
      const s = get(); return !!s.result
    },
  }), { name: 'clusters-ui' })
)
